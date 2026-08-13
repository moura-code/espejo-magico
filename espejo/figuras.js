// Los objetos de cada carrera, dibujados con formas vectoriales.
//
// Esto saca los 42 PNG del camino critico del proyecto: hay engranajes, matraces
// y gruas desde el primer dia. Cuando diseño entregue, los PNG reemplazan a estas
// figuras sin tocar una linea (ver el orden de preferencia en escena.js).
//
// CONTRATO DE CADA FIGURA
//   - Dibuja centrada en el origen, dentro de un circulo de radio `r`.
//   - Recibe el color de la carrera y lo usa como relleno principal.
//   - No deja transformaciones ni estilos pegados al contexto: siempre entre
//     save() y restore(), que hace dibujarFigura().
//
// Se revisan todas juntas en herramientas/figuras.html.

const TAU = Math.PI * 2;
const CONTORNO = 'rgba(0,0,0,0.6)';
const CLARO = 'rgba(255,255,255,0.9)';
const OSCURO = 'rgba(0,0,0,0.4)';

function preparar(ctx, r, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

const pintar = (ctx) => {
  ctx.fill();
  ctx.stroke();
};

function rectR(ctx, x, y, ancho, alto, radio) {
  const rr = Math.min(radio, Math.abs(ancho) / 2, Math.abs(alto) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + ancho - rr, y);
  ctx.quadraticCurveTo(x + ancho, y, x + ancho, y + rr);
  ctx.lineTo(x + ancho, y + alto - rr);
  ctx.quadraticCurveTo(x + ancho, y + alto, x + ancho - rr, y + alto);
  ctx.lineTo(x + rr, y + alto);
  ctx.quadraticCurveTo(x, y + alto, x, y + alto - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x, y + rr);
  ctx.closePath();
}

function poligono(ctx, puntos) {
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function circulo(ctx, x, y, radio) {
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, TAU);
}

function glifo(ctx, r, color, texto, escala = 1.7) {
  ctx.fillStyle = color;
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, r * 0.09);
  ctx.lineJoin = 'round';
  ctx.font = `700 ${r * escala}px "Cambria Math", Georgia, "Times New Roman", serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeText(texto, 0, 0);
  ctx.fillText(texto, 0, 0);
}

// ─────────────────────────────── MECANICA ───────────────────────────────

function engranaje(ctx, r, color) {
  preparar(ctx, r, color);
  const dientes = 8;
  const pasos = dientes * 4;
  const puntos = [];
  for (let i = 0; i < pasos; i++) {
    const a = (i / pasos) * TAU;
    const fase = i % 4;
    const radio = fase === 1 || fase === 2 ? r * 0.98 : r * 0.74;
    puntos.push([Math.cos(a) * radio, Math.sin(a) * radio]);
  }
  poligono(ctx, puntos);
  pintar(ctx);

  circulo(ctx, 0, 0, r * 0.3);
  ctx.fillStyle = OSCURO;
  pintar(ctx);
}

function llave(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.75, -r * 0.85],
    [-r * 0.2, -r * 0.85],
    [-r * 0.2, -r * 0.5],
    [-r * 0.45, -r * 0.5],
    [-r * 0.45, -r * 0.2],
    [-r * 0.2, -r * 0.2],
    [-r * 0.2, 0.0],
    [-r * 0.75, 0.0],
  ]);
  pintar(ctx);
  rectR(ctx, -r * 0.55, -r * 0.15, r * 0.3, r * 1.0, r * 0.14);
  pintar(ctx);
}

function piston(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.55, -r * 0.9, r * 1.1, r * 0.75, r * 0.16);
  pintar(ctx);
  rectR(ctx, -r * 0.16, -r * 0.2, r * 0.32, r * 0.8, r * 0.1);
  pintar(ctx);
  circulo(ctx, 0, r * 0.72, r * 0.24);
  ctx.fillStyle = OSCURO;
  pintar(ctx);
}

function resorte(ctx, r, color) {
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(3, r * 0.26);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = -r * 0.85 + t * r * 1.7;
    const x = Math.sin(t * TAU * 3) * r * 0.6;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.15);
  ctx.stroke();
}

function rodamiento(ctx, r, color) {
  preparar(ctx, r, color);
  circulo(ctx, 0, 0, r * 0.95);
  pintar(ctx);
  circulo(ctx, 0, 0, r * 0.62);
  ctx.fillStyle = OSCURO;
  pintar(ctx);

  ctx.fillStyle = CLARO;
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    circulo(ctx, Math.cos(a) * r * 0.78, Math.sin(a) * r * 0.78, r * 0.15);
    pintar(ctx);
  }
}

function motor(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.8, -r * 0.55, r * 1.4, r * 1.1, r * 0.18);
  pintar(ctx);
  rectR(ctx, r * 0.6, -r * 0.14, r * 0.35, r * 0.28, r * 0.08);
  ctx.fillStyle = OSCURO;
  pintar(ctx);

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  for (let i = 0; i < 4; i++) {
    const x = -r * 0.6 + i * r * 0.32;
    ctx.beginPath();
    ctx.moveTo(x, -r * 0.45);
    ctx.lineTo(x, r * 0.45);
    ctx.stroke();
  }
}

// ─────────────────────────────── ELECTRICA ───────────────────────────────

function rayo(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [r * 0.2, -r * 0.95],
    [-r * 0.6, r * 0.12],
    [-r * 0.08, r * 0.12],
    [-r * 0.25, r * 0.95],
    [r * 0.62, -r * 0.16],
    [r * 0.06, -r * 0.16],
  ]);
  pintar(ctx);
}

function resistencia(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, 0);
  ctx.lineTo(-r * 0.55, 0);
  ctx.moveTo(r * 0.55, 0);
  ctx.lineTo(r * 0.95, 0);
  ctx.stroke();

  rectR(ctx, -r * 0.58, -r * 0.32, r * 1.16, r * 0.64, r * 0.14);
  ctx.fillStyle = color;
  pintar(ctx);

  ctx.fillStyle = OSCURO;
  for (const x of [-r * 0.3, -r * 0.05, r * 0.2]) {
    ctx.fillRect(x, -r * 0.32, r * 0.11, r * 0.64);
  }
}

function lampara(ctx, r, color) {
  preparar(ctx, r, color);
  circulo(ctx, 0, -r * 0.2, r * 0.62);
  pintar(ctx);
  rectR(ctx, -r * 0.3, r * 0.38, r * 0.6, r * 0.45, r * 0.1);
  ctx.fillStyle = OSCURO;
  pintar(ctx);

  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(-r * 0.18, r * 0.05);
  ctx.lineTo(-r * 0.06, -r * 0.28);
  ctx.lineTo(r * 0.06, -r * 0.02);
  ctx.lineTo(r * 0.18, -r * 0.35);
  ctx.stroke();
}

function bateria(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.85, -r * 0.5, r * 1.55, r * 1.0, r * 0.16);
  pintar(ctx);
  rectR(ctx, r * 0.7, -r * 0.2, r * 0.22, r * 0.4, r * 0.07);
  pintar(ctx);

  ctx.fillStyle = CLARO;
  for (let i = 0; i < 3; i++) {
    ctx.fillRect(-r * 0.68 + i * r * 0.42, -r * 0.3, r * 0.26, r * 0.6);
  }
}

function panelSolar(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.95, r * 0.45],
    [-r * 0.6, -r * 0.6],
    [r * 0.95, -r * 0.6],
    [r * 0.6, r * 0.45],
  ]);
  pintar(ctx);

  ctx.strokeStyle = OSCURO;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  for (let i = 1; i < 4; i++) {
    const t = i / 4;
    ctx.beginPath();
    ctx.moveTo(-r * 0.95 + t * r * 0.35, r * 0.45 - t * r * 1.05);
    ctx.lineTo(r * 0.6 + t * r * 0.35, r * 0.45 - t * r * 1.05);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(-r * 0.05, r * 0.45);
  ctx.lineTo(r * 0.3, -r * 0.6);
  ctx.stroke();

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.45);
  ctx.lineTo(0, r * 0.9);
  ctx.stroke();
}

function onda(ctx, r, color) {
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(3, r * 0.3);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const t = i / 48;
    const x = -r * 0.92 + t * r * 1.84;
    const y = -Math.sin(t * TAU * 1.5) * r * 0.62;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.17);
  ctx.stroke();
}

// ────────────────────────────── COMPUTACION ──────────────────────────────

function laptop(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.62, -r * 0.75, r * 1.24, r * 0.9, r * 0.1);
  pintar(ctx);

  ctx.fillStyle = OSCURO;
  ctx.fillRect(-r * 0.5, -r * 0.63, r * 1.0, r * 0.66);

  ctx.fillStyle = color;
  poligono(ctx, [
    [-r * 0.92, r * 0.5],
    [-r * 0.62, r * 0.15],
    [r * 0.62, r * 0.15],
    [r * 0.92, r * 0.5],
  ]);
  pintar(ctx);
}

function robot(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.62);
  ctx.lineTo(0, -r * 0.92);
  ctx.stroke();
  circulo(ctx, 0, -r * 0.95, r * 0.13);
  pintar(ctx);

  rectR(ctx, -r * 0.72, -r * 0.62, r * 1.44, r * 1.15, r * 0.22);
  pintar(ctx);

  ctx.fillStyle = OSCURO;
  circulo(ctx, -r * 0.26, -r * 0.16, r * 0.16);
  ctx.fill();
  circulo(ctx, r * 0.26, -r * 0.16, r * 0.16);
  ctx.fill();
  ctx.fillRect(-r * 0.3, r * 0.22, r * 0.6, r * 0.12);
}

function chip(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.11);
  for (let i = 0; i < 3; i++) {
    const p = -r * 0.36 + i * r * 0.36;
    ctx.beginPath();
    ctx.moveTo(p, -r * 0.62);
    ctx.lineTo(p, -r * 0.95);
    ctx.moveTo(p, r * 0.62);
    ctx.lineTo(p, r * 0.95);
    ctx.moveTo(-r * 0.62, p);
    ctx.lineTo(-r * 0.95, p);
    ctx.moveTo(r * 0.62, p);
    ctx.lineTo(r * 0.95, p);
    ctx.stroke();
  }

  rectR(ctx, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24, r * 0.14);
  ctx.fillStyle = color;
  pintar(ctx);

  rectR(ctx, -r * 0.28, -r * 0.28, r * 0.56, r * 0.56, r * 0.08);
  ctx.fillStyle = OSCURO;
  pintar(ctx);
}

function llaves(ctx, r, color) {
  glifo(ctx, r, color, '{ }', 1.5);
}

function servidor(ctx, r, color) {
  preparar(ctx, r, color);
  for (let i = 0; i < 3; i++) {
    const y = -r * 0.82 + i * r * 0.58;
    rectR(ctx, -r * 0.75, y, r * 1.5, r * 0.46, r * 0.1);
    ctx.fillStyle = color;
    pintar(ctx);

    ctx.fillStyle = CLARO;
    circulo(ctx, r * 0.5, y + r * 0.23, r * 0.08);
    ctx.fill();
    ctx.fillStyle = OSCURO;
    ctx.fillRect(-r * 0.6, y + r * 0.17, r * 0.55, r * 0.12);
  }
}

function dron(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, -r * 0.62);
  ctx.lineTo(r * 0.62, r * 0.62);
  ctx.moveTo(r * 0.62, -r * 0.62);
  ctx.lineTo(-r * 0.62, r * 0.62);
  ctx.stroke();

  ctx.fillStyle = color;
  for (const [x, y] of [
    [-r * 0.68, -r * 0.68],
    [r * 0.68, -r * 0.68],
    [-r * 0.68, r * 0.68],
    [r * 0.68, r * 0.68],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 0.3, r * 0.12, 0, 0, TAU);
    pintar(ctx);
  }

  rectR(ctx, -r * 0.3, -r * 0.24, r * 0.6, r * 0.48, r * 0.14);
  ctx.fillStyle = color;
  pintar(ctx);
  ctx.fillStyle = OSCURO;
  circulo(ctx, 0, r * 0.06, r * 0.12);
  ctx.fill();
}

// ───────────────────────── FISICO-MATEMATICA ─────────────────────────

const pi = (ctx, r, color) => glifo(ctx, r, color, 'π');
const sumatoria = (ctx, r, color) => glifo(ctx, r, color, 'Σ');
const integral = (ctx, r, color) => glifo(ctx, r, color, '∫', 2.1);

function atomo(ctx, r, color) {
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2.5, r * 0.14);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.36, (i * Math.PI) / 3, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.08);
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, r * 0.95, r * 0.36, (i * Math.PI) / 3, 0, TAU);
    ctx.stroke();
  }

  preparar(ctx, r, color);
  circulo(ctx, 0, 0, r * 0.24);
  pintar(ctx);
}

function prisma(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [0, -r * 0.85],
    [r * 0.8, r * 0.6],
    [-r * 0.8, r * 0.6],
  ]);
  pintar(ctx);

  const arcoiris = ['#FF5D8F', '#FF8A3D', '#FFD23F', '#00E5A0', '#4FC3F7', '#A78BFA'];
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  arcoiris.forEach((tono, i) => {
    ctx.strokeStyle = tono;
    ctx.beginPath();
    ctx.moveTo(r * 0.12, r * 0.02);
    ctx.lineTo(r * 0.95, r * 0.02 + (i - 2.5) * r * 0.16);
    ctx.stroke();
  });
}

function curva(ctx, r, color) {
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-r * 0.85, -r * 0.85);
  ctx.lineTo(-r * 0.85, r * 0.85);
  ctx.lineTo(r * 0.85, r * 0.85);
  ctx.stroke();

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(3, r * 0.28);
  ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const x = -r * 0.8 + t * r * 1.6;
    const y = r * 0.7 - Math.pow(t, 0.55) * r * 1.4;
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, r * 0.16);
  ctx.stroke();
}

// ───────────────────────────────── CIVIL ─────────────────────────────────

function grua(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.14, -r * 0.55, r * 0.28, r * 1.4);
  ctx.strokeRect(-r * 0.14, -r * 0.55, r * 0.28, r * 1.4);

  ctx.fillRect(-r * 0.7, -r * 0.75, r * 1.6, r * 0.22);
  ctx.strokeRect(-r * 0.7, -r * 0.75, r * 1.6, r * 0.22);

  ctx.fillRect(-r * 0.55, r * 0.85, r * 1.1, r * 0.16);
  ctx.strokeRect(-r * 0.55, r * 0.85, r * 1.1, r * 0.16);

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(r * 0.62, -r * 0.53);
  ctx.lineTo(r * 0.62, r * 0.05);
  ctx.stroke();
  poligono(ctx, [
    [r * 0.48, r * 0.05],
    [r * 0.76, r * 0.05],
    [r * 0.62, r * 0.32],
  ]);
  ctx.fillStyle = color;
  pintar(ctx);
}

function puente(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.fillRect(-r * 0.95, r * 0.25, r * 1.9, r * 0.24);
  ctx.strokeRect(-r * 0.95, r * 0.25, r * 1.9, r * 0.24);

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2.5, r * 0.13);
  ctx.beginPath();
  ctx.moveTo(-r * 0.95, r * 0.25);
  ctx.quadraticCurveTo(0, -r * 1.05, r * 0.95, r * 0.25);
  ctx.stroke();

  ctx.lineWidth = Math.max(1, r * 0.05);
  for (const x of [-r * 0.6, -r * 0.3, 0, r * 0.3, r * 0.6]) {
    const t = (x + r * 0.95) / (r * 1.9);
    const y = r * 0.25 + (-r * 1.3) * (4 * t * (1 - t)) * 0.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, r * 0.25);
    ctx.stroke();
  }
}

function plano(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.8, -r * 0.6, r * 1.6, r * 1.2, r * 0.08);
  pintar(ctx);

  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(1, r * 0.05);
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(-r * 0.8 + (i * r * 1.6) / 4, -r * 0.6);
    ctx.lineTo(-r * 0.8 + (i * r * 1.6) / 4, r * 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, -r * 0.6 + (i * r * 1.2) / 4);
    ctx.lineTo(r * 0.8, -r * 0.6 + (i * r * 1.2) / 4);
    ctx.stroke();
  }
  ctx.strokeStyle = OSCURO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.strokeRect(-r * 0.45, -r * 0.28, r * 0.75, r * 0.6);
}

function teodolito(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2.5, r * 0.12);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.1);
  ctx.lineTo(-r * 0.6, r * 0.9);
  ctx.moveTo(0, -r * 0.1);
  ctx.lineTo(r * 0.6, r * 0.9);
  ctx.moveTo(0, -r * 0.1);
  ctx.lineTo(0, r * 0.9);
  ctx.stroke();

  rectR(ctx, -r * 0.42, -r * 0.62, r * 0.84, r * 0.52, r * 0.12);
  ctx.fillStyle = color;
  pintar(ctx);

  rectR(ctx, r * 0.3, -r * 0.5, r * 0.5, r * 0.24, r * 0.08);
  ctx.fillStyle = OSCURO;
  pintar(ctx);
}

function ladrillo(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.9, -r * 0.2],
    [-r * 0.25, -r * 0.6],
    [r * 0.9, -r * 0.25],
    [r * 0.9, r * 0.3],
    [-r * 0.25, r * 0.65],
    [-r * 0.9, r * 0.35],
  ]);
  pintar(ctx);

  ctx.strokeStyle = OSCURO;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r * 0.25, -r * 0.6);
  ctx.lineTo(-r * 0.25, r * 0.65);
  ctx.moveTo(-r * 0.9, -r * 0.2);
  ctx.lineTo(-r * 0.9, r * 0.35);
  ctx.stroke();
}

function viga(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.8, -r * 0.85],
    [r * 0.8, -r * 0.85],
    [r * 0.8, -r * 0.5],
    [r * 0.2, -r * 0.5],
    [r * 0.2, r * 0.5],
    [r * 0.8, r * 0.5],
    [r * 0.8, r * 0.85],
    [-r * 0.8, r * 0.85],
    [-r * 0.8, r * 0.5],
    [-r * 0.2, r * 0.5],
    [-r * 0.2, -r * 0.5],
    [-r * 0.8, -r * 0.5],
  ]);
  pintar(ctx);
}

// ──────────────────────────────── QUIMICA ────────────────────────────────

function matraz(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.11);

  poligono(ctx, [
    [-r * 0.22, -r * 0.9],
    [r * 0.22, -r * 0.9],
    [r * 0.22, -r * 0.3],
    [r * 0.8, r * 0.8],
    [-r * 0.8, r * 0.8],
    [-r * 0.22, -r * 0.3],
  ]);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  pintar(ctx);

  poligono(ctx, [
    [-r * 0.55, r * 0.3],
    [r * 0.55, r * 0.3],
    [r * 0.8, r * 0.8],
    [-r * 0.8, r * 0.8],
  ]);
  ctx.fillStyle = color;
  pintar(ctx);
}

function tubo(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.11);

  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.9);
  ctx.lineTo(-r * 0.3, r * 0.55);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.92, 0, r * 0.92);
  ctx.quadraticCurveTo(r * 0.3, r * 0.92, r * 0.3, r * 0.55);
  ctx.lineTo(r * 0.3, -r * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-r * 0.3, r * 0.1);
  ctx.lineTo(-r * 0.3, r * 0.55);
  ctx.quadraticCurveTo(-r * 0.3, r * 0.92, 0, r * 0.92);
  ctx.quadraticCurveTo(r * 0.3, r * 0.92, r * 0.3, r * 0.55);
  ctx.lineTo(r * 0.3, r * 0.1);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function molecula(ctx, r, color) {
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2.5, r * 0.13);
  const nodos = [
    [0, -r * 0.1],
    [-r * 0.68, r * 0.5],
    [r * 0.68, r * 0.5],
    [0, -r * 0.82],
  ];
  ctx.beginPath();
  for (const [x, y] of nodos.slice(1)) {
    ctx.moveTo(nodos[0][0], nodos[0][1]);
    ctx.lineTo(x, y);
  }
  ctx.stroke();

  preparar(ctx, r, color);
  nodos.forEach(([x, y], i) => {
    circulo(ctx, x, y, i === 0 ? r * 0.3 : r * 0.22);
    ctx.fillStyle = i === 0 ? color : CLARO;
    pintar(ctx);
  });
}

function mechero(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.65, r * 0.9],
    [r * 0.65, r * 0.9],
    [r * 0.4, r * 0.65],
    [-r * 0.4, r * 0.65],
  ]);
  pintar(ctx);
  ctx.fillRect(-r * 0.16, -r * 0.1, r * 0.32, r * 0.78);
  ctx.strokeRect(-r * 0.16, -r * 0.1, r * 0.32, r * 0.78);

  ctx.beginPath();
  ctx.moveTo(0, -r * 0.95);
  ctx.quadraticCurveTo(r * 0.42, -r * 0.35, 0, -r * 0.05);
  ctx.quadraticCurveTo(-r * 0.42, -r * 0.35, 0, -r * 0.95);
  ctx.fillStyle = color;
  pintar(ctx);
}

function pipeta(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);

  ctx.beginPath();
  ctx.ellipse(0, -r * 0.4, r * 0.28, r * 0.42, 0, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  pintar(ctx);

  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.02);
  ctx.lineTo(-r * 0.05, r * 0.68);
  ctx.lineTo(r * 0.05, r * 0.68);
  ctx.lineTo(r * 0.1, -r * 0.02);
  ctx.closePath();
  ctx.fillStyle = color;
  pintar(ctx);

  circulo(ctx, 0, r * 0.86, r * 0.14);
  ctx.fillStyle = color;
  pintar(ctx);
}

function gota(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.92);
  ctx.quadraticCurveTo(r * 0.78, r * 0.1, r * 0.42, r * 0.56);
  ctx.quadraticCurveTo(0, r * 1.0, -r * 0.42, r * 0.56);
  ctx.quadraticCurveTo(-r * 0.78, r * 0.1, 0, -r * 0.92);
  pintar(ctx);

  ctx.fillStyle = CLARO;
  ctx.beginPath();
  ctx.ellipse(-r * 0.2, r * 0.3, r * 0.12, r * 0.2, -0.4, 0, TAU);
  ctx.fill();
}

// ──────────────────────────────── ACCESORIOS ────────────────────────────────
//
// Lo que la carrera le pone en la cara al visitante. Mientras el PNG no este,
// esto es lo que se ve (el orden de preferencia lo aplica dibujarAccesorio en
// escena.js).
//
// CONTRATO DE CADA ACCESORIO — es otro espacio que el de los objetos:
//   - `d` es la distancia entre los ojos detectados, en pixeles. Todo se mide
//     en multiplos de esa distancia, asi el accesorio crece con la cara.
//   - El origen esta en el punto medio entre los ojos y la cabeza viene
//     derecha: la rotacion la aplica quien llama. La frente queda en -y.
//   - Cada figura se planta sola donde va (una gorra arriba, unos anteojos
//     sobre los ojos). No mira anclaOjoIzq/anclaOjoDer/offsetY: esos numeros
//     describen un PNG que todavia no existe.
//   - No deja transformaciones ni estilos pegados: eso lo garantiza el
//     save()/restore() de dibujarFiguraAccesorio.
//
// Medidas de una cabeza en multiplos de la distancia entre ojos, por si hay que
// dibujar una figura nueva: media cara ancha 1.15, frente 0.4 arriba de los
// ojos, alto del craneo 1.5 arriba, orejas a 1.1 del centro.

// Todo lo que se apoya sobre los ojos —lentes, visores, la rejilla del casco
// forestal— va con vidrio y no con relleno: el visitante se tiene que seguir
// viendo a si mismo, que es de lo que se trata la instalacion entera.
const VIDRIO = 'rgba(255,255,255,0.22)';
const VIDRIO_OSCURO = 'rgba(0,0,0,0.3)';

function prepararAccesorio(ctx, d, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, d * 0.055);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
}

/** Media elipse hacia arriba: la copa de cualquier casco o gorra. */
function cupula(ctx, cx, cy, rx, ry) {
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, TAU);
  ctx.closePath();
}

/**
 * Las dos patillas que sostienen unos anteojos. Salen al costado de los lentes
 * y no cruzan por delante: una vincha entera a la altura de los ojos se los
 * tapa aunque los lentes sean de vidrio.
 */
function patillas(ctx, d, y, alto) {
  for (const lado of [-1, 1]) {
    rectR(ctx, lado * d * 0.82, y, lado * d * 0.36, alto, alto / 2);
    pintar(ctx);
  }
}

/** Lente o visor: se ve la cara a traves, con el marco del color de la carrera. */
function vidrio(ctx, d, color, oscuro = false) {
  ctx.fillStyle = oscuro ? VIDRIO_OSCURO : VIDRIO;
  ctx.strokeStyle = color;
  ctx.lineWidth = d * 0.12;
  pintar(ctx);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, d * 0.03);
  ctx.stroke();
}

function casco(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  rectR(ctx, -d * 1.3, -d * 0.72, d * 2.6, d * 0.26, d * 0.13);
  pintar(ctx);

  cupula(ctx, 0, -d * 0.6, d * 0.98, d * 0.95);
  pintar(ctx);

  ctx.fillStyle = OSCURO;
  rectR(ctx, -d * 0.09, -d * 1.5, d * 0.18, d * 0.9, d * 0.06);
  pintar(ctx);
}

function cascoVisor(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  cupula(ctx, 0, -d * 0.5, d * 1.05, d * 1.0);
  pintar(ctx);

  ctx.beginPath();
  ctx.moveTo(-d * 1.0, -d * 0.5);
  ctx.quadraticCurveTo(0, d * 0.5, d * 1.0, -d * 0.5);
  ctx.closePath();
  vidrio(ctx, d, color);

  prepararAccesorio(ctx, d, color);
  rectR(ctx, -d * 1.1, -d * 0.64, d * 2.2, d * 0.22, d * 0.11);
  pintar(ctx);
}

function gafasVr(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  patillas(ctx, d, -d * 0.24, d * 0.18);

  rectR(ctx, -d * 1.02, -d * 0.6, d * 2.04, d * 1.0, d * 0.24);
  vidrio(ctx, d, color, true);

  prepararAccesorio(ctx, d, color);
  rectR(ctx, -d * 1.02, -d * 0.66, d * 2.04, d * 0.24, d * 0.12);
  pintar(ctx);

  ctx.fillStyle = CLARO;
  for (const lado of [-1, 1]) {
    circulo(ctx, lado * d * 0.55, -d * 0.54, d * 0.07);
    ctx.fill();
  }
}

function orbitas(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  ctx.fillStyle = 'transparent';

  // Tres anillos girados sobre la coronilla: el atomo de toda la vida, puesto
  // de sombrero. Van solo con trazo para que se vea la cabeza por dentro, y
  // dos veces cada uno para que el anillo tenga borde y se vea sobre cualquier
  // fondo, claro u oscuro.
  for (const giro of [0, 1.05, -1.05]) {
    ctx.beginPath();
    ctx.ellipse(0, -d * 1.05, d * 0.92, d * 0.36, giro, 0, TAU);
    ctx.strokeStyle = CONTORNO;
    ctx.lineWidth = d * 0.13;
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = d * 0.08;
    ctx.stroke();
  }

  prepararAccesorio(ctx, d, color);
  circulo(ctx, 0, -d * 1.05, d * 0.2);
  pintar(ctx);
}

function antiparras(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  patillas(ctx, d, -d * 0.1, d * 0.16);

  rectR(ctx, -d * 0.16, -d * 0.14, d * 0.32, d * 0.16, d * 0.07);
  pintar(ctx);

  for (const lado of [-1, 1]) {
    rectR(ctx, lado * d * 0.14, -d * 0.38, lado * d * 0.76, d * 0.76, d * 0.24);
    vidrio(ctx, d, color);
  }
}

function antiparrasLab(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  patillas(ctx, d, -d * 0.08, d * 0.16);

  rectR(ctx, -d * 0.96, -d * 0.44, d * 1.92, d * 0.86, d * 0.34);
  vidrio(ctx, d, color);

  prepararAccesorio(ctx, d, color);
  rectR(ctx, -d * 0.08, -d * 0.3, d * 0.16, d * 0.58, d * 0.07);
  pintar(ctx);
}

function cofia(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  for (const [cx, cy, r] of [
    [-d * 0.62, -d * 1.2, d * 0.46],
    [d * 0.62, -d * 1.2, d * 0.46],
    [0, -d * 1.34, d * 0.52],
  ]) {
    circulo(ctx, cx, cy, r);
    pintar(ctx);
  }

  rectR(ctx, -d * 1.06, -d * 1.0, d * 2.12, d * 0.3, d * 0.15);
  pintar(ctx);
}

function cascoIndustrial(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  rectR(ctx, -d * 1.18, -d * 0.78, d * 2.36, d * 0.24, d * 0.12);
  pintar(ctx);

  cupula(ctx, 0, -d * 0.68, d * 0.92, d * 0.88);
  pintar(ctx);

  // Protectores auditivos: lo que distingue a un casco de planta.
  for (const lado of [-1, 1]) {
    rectR(ctx, lado * d * 1.02, -d * 0.62, lado * d * 0.38, d * 0.74, d * 0.16);
    pintar(ctx);
  }

  ctx.fillStyle = OSCURO;
  rectR(ctx, -d * 0.08, -d * 1.5, d * 0.16, d * 0.78, d * 0.05);
  pintar(ctx);
}

function gorra(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  // La visera va hacia adelante, o sea hacia la camara: de frente se ve como
  // media elipse colgando de la copa. Una elipse entera queda bombin.
  ctx.beginPath();
  ctx.ellipse(0, -d * 0.64, d * 1.18, d * 0.46, 0, 0, Math.PI);
  ctx.closePath();
  pintar(ctx);

  cupula(ctx, 0, -d * 0.64, d * 0.96, d * 0.88);
  pintar(ctx);

  ctx.fillStyle = OSCURO;
  circulo(ctx, 0, -d * 1.48, d * 0.1);
  pintar(ctx);
}

function gorraCapitan(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  ctx.fillStyle = OSCURO;
  ctx.beginPath();
  ctx.ellipse(0, -d * 0.62, d * 1.16, d * 0.34, 0, 0, Math.PI);
  ctx.closePath();
  pintar(ctx);

  rectR(ctx, -d * 1.0, -d * 0.94, d * 2.0, d * 0.34, d * 0.1);
  pintar(ctx);

  ctx.fillStyle = color;
  cupula(ctx, 0, -d * 0.94, d * 1.04, d * 0.82);
  pintar(ctx);

  ctx.fillStyle = CLARO;
  circulo(ctx, 0, -d * 0.77, d * 0.14);
  pintar(ctx);
}

function auriculares(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  ctx.lineWidth = d * 0.2;
  ctx.strokeStyle = color;
  cupula(ctx, 0, -d * 0.5, d * 1.12, d * 0.98);
  ctx.stroke();

  prepararAccesorio(ctx, d, color);
  for (const lado of [-1, 1]) {
    rectR(ctx, lado * d * 0.96, -d * 0.56, lado * d * 0.42, d * 0.8, d * 0.18);
    pintar(ctx);
  }

  // Vincha de operador: el microfono es lo que dice "comunicacion" de un vistazo.
  ctx.beginPath();
  ctx.moveTo(-d * 1.14, d * 0.1);
  ctx.quadraticCurveTo(-d * 1.02, d * 0.46, -d * 0.68, d * 0.46);
  ctx.stroke();
  circulo(ctx, -d * 0.6, d * 0.46, d * 0.12);
  pintar(ctx);
}

function cascoForestal(ctx, d, color) {
  prepararAccesorio(ctx, d, color);
  rectR(ctx, -d * 1.16, -d * 0.82, d * 2.32, d * 0.24, d * 0.12);
  pintar(ctx);

  cupula(ctx, 0, -d * 0.72, d * 0.94, d * 0.86);
  pintar(ctx);

  for (const lado of [-1, 1]) {
    rectR(ctx, lado * d * 1.0, -d * 0.66, lado * d * 0.36, d * 0.7, d * 0.15);
    pintar(ctx);
  }

  // Rejilla protectora: se ve a traves, como el visor del casco de electrica.
  rectR(ctx, -d * 0.9, -d * 0.6, d * 1.8, d * 0.62, d * 0.14);
  vidrio(ctx, d, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1, d * 0.03);
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(d * 0.24 * i, -d * 0.58);
    ctx.lineTo(d * 0.24 * i, -d * 0.02);
    ctx.stroke();
  }
}

// ───────────────────────────────── registro ─────────────────────────────────

export const FIGURAS_ACCESORIO = {
  antiparras,
  'casco-visor': cascoVisor,
  'gafas-vr': gafasVr,
  orbitas,
  casco,
  'antiparras-lab': antiparrasLab,
  cofia,
  'casco-industrial': cascoIndustrial,
  gorra,
  auriculares,
  'casco-forestal': cascoForestal,
  'gorra-capitan': gorraCapitan,
};

export const figurasAccesorioDisponibles = () => Object.keys(FIGURAS_ACCESORIO);
export const hayFiguraAccesorio = (nombre) => Boolean(FIGURAS_ACCESORIO[nombre]);

/** Devuelve true si dibujo algo. False si el nombre no existe. */
export function dibujarFiguraAccesorio(ctx, nombre, distanciaOjos, color) {
  const figura = FIGURAS_ACCESORIO[nombre];
  if (!figura) return false;

  ctx.save();
  figura(ctx, distanciaOjos, color);
  ctx.restore();
  return true;
}

export const FIGURAS = {
  engranaje,
  llave,
  piston,
  resorte,
  rodamiento,
  motor,

  rayo,
  resistencia,
  lampara,
  bateria,
  'panel-solar': panelSolar,
  onda,

  laptop,
  robot,
  chip,
  llaves,
  servidor,
  dron,

  pi,
  sumatoria,
  integral,
  atomo,
  prisma,
  curva,

  grua,
  puente,
  plano,
  teodolito,
  ladrillo,
  viga,

  matraz,
  tubo,
  molecula,
  mechero,
  pipeta,
  gota,
};

export const figurasDisponibles = () => Object.keys(FIGURAS);
export const hayFigura = (nombre) => Boolean(FIGURAS[nombre]);

/** Devuelve true si dibujo algo. False si el nombre no existe. */
export function dibujarFigura(ctx, nombre, radio, color) {
  const figura = FIGURAS[nombre];
  if (!figura) return false;

  ctx.save();
  figura(ctx, radio, color);
  ctx.restore();
  return true;
}
