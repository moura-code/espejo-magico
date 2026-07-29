// Los objetos de cada carrera, dibujados con formas vectoriales.
//
// Esto saca los PNG del camino critico del proyecto: hay engranajes, matraces y
// gruas desde el primer dia. Cuando diseño entregue, los PNG reemplazan a estas
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

// ───────────────────────────── NUEVAS PROPUESTAS ─────────────────────────────

function manzana(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.55);
  ctx.bezierCurveTo(r * 0.5, -r * 0.82, r * 0.9, -r * 0.25, r * 0.66, r * 0.45);
  ctx.bezierCurveTo(r * 0.5, r * 0.92, r * 0.15, r * 0.9, 0, r * 0.72);
  ctx.bezierCurveTo(-r * 0.15, r * 0.9, -r * 0.5, r * 0.92, -r * 0.66, r * 0.45);
  ctx.bezierCurveTo(-r * 0.9, -r * 0.25, -r * 0.5, -r * 0.82, 0, -r * 0.55);
  ctx.closePath();
  pintar(ctx);

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.55);
  ctx.lineTo(r * 0.08, -r * 0.92);
  ctx.stroke();
  ctx.fillStyle = CLARO;
  ctx.beginPath();
  ctx.ellipse(r * 0.34, -r * 0.76, r * 0.3, r * 0.14, -0.45, 0, TAU);
  pintar(ctx);
}

function espiga(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2.5, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.92);
  ctx.lineTo(0, -r * 0.86);
  ctx.stroke();

  for (let indice = 0; indice < 5; indice++) {
    const y = r * 0.5 - indice * r * 0.3;
    const apertura = indice % 2 === 0 ? 0.5 : 0.42;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(-r * 0.25, y, r * 0.34, r * 0.15, apertura, 0, TAU);
    pintar(ctx);
    ctx.beginPath();
    ctx.ellipse(r * 0.25, y - r * 0.1, r * 0.34, r * 0.15, -apertura, 0, TAU);
    pintar(ctx);
  }
}

function cintaTransportadora(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.9, -r * 0.12, r * 1.8, r * 0.55, r * 0.22);
  pintar(ctx);
  ctx.fillStyle = OSCURO;
  for (const x of [-r * 0.58, 0, r * 0.58]) {
    circulo(ctx, x, r * 0.16, r * 0.18);
    pintar(ctx);
  }
  rectR(ctx, -r * 0.65, -r * 0.72, r * 0.52, r * 0.6, r * 0.08);
  ctx.fillStyle = color;
  pintar(ctx);
  rectR(ctx, r * 0.12, -r * 0.58, r * 0.48, r * 0.46, r * 0.08);
  pintar(ctx);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-r * 0.62, r * 0.43);
  ctx.lineTo(-r * 0.72, r * 0.9);
  ctx.moveTo(r * 0.62, r * 0.43);
  ctx.lineTo(r * 0.72, r * 0.9);
  ctx.stroke();
}

function diagramaFlujo(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.78, -r * 0.82, r * 0.68, r * 0.42, r * 0.1);
  pintar(ctx);
  rectR(ctx, r * 0.1, -r * 0.18, r * 0.68, r * 0.42, r * 0.1);
  pintar(ctx);
  rectR(ctx, -r * 0.78, r * 0.44, r * 0.68, r * 0.42, r * 0.1);
  pintar(ctx);

  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(-r * 0.1, -r * 0.61);
  ctx.lineTo(r * 0.44, -r * 0.61);
  ctx.lineTo(r * 0.44, -r * 0.18);
  ctx.moveTo(r * 0.44, r * 0.24);
  ctx.lineTo(r * 0.44, r * 0.65);
  ctx.lineTo(-r * 0.1, r * 0.65);
  ctx.stroke();
  poligono(ctx, [
    [r * 0.28, -r * 0.28],
    [r * 0.6, -r * 0.28],
    [r * 0.44, -r * 0.08],
  ]);
  ctx.fillStyle = CLARO;
  pintar(ctx);
}

function mapa(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.9, -r * 0.62],
    [-r * 0.3, -r * 0.82],
    [r * 0.3, -r * 0.58],
    [r * 0.9, -r * 0.78],
    [r * 0.9, r * 0.62],
    [r * 0.3, r * 0.82],
    [-r * 0.3, r * 0.58],
    [-r * 0.9, r * 0.78],
  ]);
  pintar(ctx);
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.82);
  ctx.lineTo(-r * 0.3, r * 0.58);
  ctx.moveTo(r * 0.3, -r * 0.58);
  ctx.lineTo(r * 0.3, r * 0.82);
  ctx.moveTo(-r * 0.72, r * 0.25);
  ctx.quadraticCurveTo(0, -r * 0.35, r * 0.68, r * 0.18);
  ctx.stroke();
}

function satelite(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.32, -r * 0.42, r * 0.64, r * 0.84, r * 0.12);
  pintar(ctx);
  for (const x of [-r * 0.78, r * 0.38]) {
    rectR(ctx, x, -r * 0.38, r * 0.4, r * 0.76, r * 0.05);
    ctx.fillStyle = color;
    pintar(ctx);
    ctx.strokeStyle = CLARO;
    ctx.lineWidth = Math.max(1, r * 0.05);
    ctx.beginPath();
    ctx.moveTo(x + r * 0.2, -r * 0.38);
    ctx.lineTo(x + r * 0.2, r * 0.38);
    ctx.moveTo(x, 0);
    ctx.lineTo(x + r * 0.4, 0);
    ctx.stroke();
  }
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.42);
  ctx.lineTo(0, -r * 0.72);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -r * 0.72, r * 0.28, Math.PI, TAU);
  ctx.stroke();
}

function antena(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [0, -r * 0.86],
    [-r * 0.52, r * 0.88],
    [r * 0.52, r * 0.88],
  ]);
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  pintar(ctx);
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.09);
  for (const y of [-r * 0.25, r * 0.18, r * 0.58]) {
    const ancho = (y + r) * 0.38;
    ctx.beginPath();
    ctx.moveTo(-ancho, y);
    ctx.lineTo(ancho, y);
    ctx.stroke();
  }
  ctx.strokeStyle = color;
  for (const radio of [r * 0.28, r * 0.48]) {
    ctx.beginPath();
    ctx.arc(0, -r * 0.58, radio, -Math.PI * 0.8, -Math.PI * 0.2);
    ctx.stroke();
  }
}

function fibraOptica(ctx, r, color) {
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(5, r * 0.35);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.88, r * 0.55);
  ctx.bezierCurveTo(-r * 0.2, r * 0.1, r * 0.05, r * 0.75, r * 0.48, -r * 0.22);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.18);
  ctx.stroke();

  const tonos = ['#FF5D8F', '#FFD23F', '#00E5A0', '#4FC3F7'];
  tonos.forEach((tono, indice) => {
    ctx.strokeStyle = tono;
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.moveTo(r * 0.48, -r * 0.22);
    ctx.lineTo(r * (0.58 + indice * 0.08), -r * (0.62 + (indice % 2) * 0.18));
    ctx.stroke();
    ctx.fillStyle = tono;
    circulo(
      ctx,
      r * (0.58 + indice * 0.08),
      -r * (0.62 + (indice % 2) * 0.18),
      r * 0.09,
    );
    ctx.fill();
  });
}

function barco(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [-r * 0.92, r * 0.18],
    [r * 0.92, r * 0.18],
    [r * 0.58, r * 0.72],
    [-r * 0.58, r * 0.72],
  ]);
  pintar(ctx);
  rectR(ctx, -r * 0.45, -r * 0.34, r * 0.9, r * 0.52, r * 0.08);
  ctx.fillStyle = CLARO;
  pintar(ctx);
  ctx.fillStyle = OSCURO;
  for (const x of [-r * 0.25, 0, r * 0.25]) {
    ctx.fillRect(x - r * 0.07, -r * 0.2, r * 0.14, r * 0.14);
  }
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.34);
  ctx.lineTo(0, -r * 0.82);
  ctx.stroke();
  ctx.fillStyle = color;
  poligono(ctx, [[0, -r * 0.8], [r * 0.45, -r * 0.52], [0, -r * 0.48]]);
  pintar(ctx);
}

function ancla(ctx, r, color) {
  preparar(ctx, r, color);
  circulo(ctx, 0, -r * 0.72, r * 0.2);
  pintar(ctx);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(4, r * 0.24);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.52);
  ctx.lineTo(0, r * 0.62);
  ctx.moveTo(-r * 0.62, -r * 0.3);
  ctx.lineTo(r * 0.62, -r * 0.3);
  ctx.moveTo(-r * 0.82, r * 0.18);
  ctx.quadraticCurveTo(-r * 0.65, r * 0.82, 0, r * 0.82);
  ctx.quadraticCurveTo(r * 0.65, r * 0.82, r * 0.82, r * 0.18);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, r * 0.12);
  ctx.stroke();
}

function nube(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.moveTo(-r * 0.82, r * 0.42);
  ctx.quadraticCurveTo(-r * 1.0, -r * 0.1, -r * 0.55, -r * 0.25);
  ctx.quadraticCurveTo(-r * 0.42, -r * 0.78, r * 0.05, -r * 0.65);
  ctx.quadraticCurveTo(r * 0.45, -r * 0.8, r * 0.6, -r * 0.35);
  ctx.quadraticCurveTo(r * 1.0, -r * 0.18, r * 0.82, r * 0.42);
  ctx.closePath();
  pintar(ctx);
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(2, r * 0.09);
  for (const x of [-r * 0.45, 0, r * 0.45]) {
    ctx.beginPath();
    ctx.moveTo(x, r * 0.58);
    ctx.lineTo(x - r * 0.14, r * 0.88);
    ctx.stroke();
  }
}

function anemometro(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2.5, r * 0.11);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.15);
  ctx.lineTo(0, r * 0.9);
  ctx.stroke();
  circulo(ctx, 0, -r * 0.15, r * 0.14);
  pintar(ctx);

  for (let indice = 0; indice < 3; indice++) {
    const angulo = -Math.PI / 2 + (indice * TAU) / 3;
    const extremoX = Math.cos(angulo) * r * 0.62;
    const extremoY = -r * 0.15 + Math.sin(angulo) * r * 0.62;
    ctx.strokeStyle = CONTORNO;
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.15);
    ctx.lineTo(extremoX, extremoY);
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(extremoX, extremoY, r * 0.26, r * 0.14, angulo + Math.PI / 2, 0, TAU);
    pintar(ctx);
  }
}

function algoritmo(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.38, -r * 0.88, r * 0.76, r * 0.34, r * 0.16);
  pintar(ctx);
  poligono(ctx, [
    [0, -r * 0.36],
    [r * 0.45, 0],
    [0, r * 0.36],
    [-r * 0.45, 0],
  ]);
  pintar(ctx);
  rectR(ctx, -r * 0.38, r * 0.55, r * 0.76, r * 0.34, r * 0.16);
  pintar(ctx);
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.09);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.54);
  ctx.lineTo(0, -r * 0.36);
  ctx.moveTo(0, r * 0.36);
  ctx.lineTo(0, r * 0.55);
  ctx.moveTo(r * 0.45, 0);
  ctx.lineTo(r * 0.82, 0);
  ctx.lineTo(r * 0.82, r * 0.72);
  ctx.lineTo(r * 0.38, r * 0.72);
  ctx.stroke();
}

function baseDatos(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.ellipse(0, -r * 0.65, r * 0.72, r * 0.28, 0, 0, TAU);
  pintar(ctx);
  ctx.fillRect(-r * 0.72, -r * 0.65, r * 1.44, r * 1.3);
  ctx.strokeRect(-r * 0.72, -r * 0.65, r * 1.44, r * 1.3);
  ctx.beginPath();
  ctx.ellipse(0, r * 0.65, r * 0.72, r * 0.28, 0, 0, TAU);
  pintar(ctx);
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(1.5, r * 0.07);
  for (const y of [-r * 0.18, r * 0.25]) {
    ctx.beginPath();
    ctx.ellipse(0, y, r * 0.72, r * 0.28, 0, 0, Math.PI);
    ctx.stroke();
  }
}

function adn(ctx, r, color) {
  ctx.lineCap = 'round';
  for (const desplazamiento of [0, Math.PI]) {
    ctx.strokeStyle = CONTORNO;
    ctx.lineWidth = Math.max(3, r * 0.2);
    ctx.beginPath();
    for (let paso = 0; paso <= 36; paso++) {
      const t = paso / 36;
      const y = -r * 0.9 + t * r * 1.8;
      const x = Math.sin(t * TAU * 1.25 + desplazamiento) * r * 0.48;
      paso === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.5, r * 0.1);
    ctx.stroke();
  }
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  for (let paso = 3; paso < 34; paso += 5) {
    const t = paso / 36;
    const y = -r * 0.9 + t * r * 1.8;
    const x = Math.sin(t * TAU * 1.25) * r * 0.48;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(-x, y);
    ctx.stroke();
  }
}

function celula(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.9, r * 0.72, -0.18, 0, TAU);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  pintar(ctx);
  circulo(ctx, -r * 0.14, r * 0.02, r * 0.3);
  ctx.fillStyle = color;
  pintar(ctx);
  ctx.fillStyle = CLARO;
  for (const [x, y, rx, ry, giro] of [
    [-0.48, -0.24, 0.2, 0.1, 0.4],
    [0.48, -0.18, 0.18, 0.09, -0.5],
    [0.38, 0.35, 0.22, 0.1, 0.2],
    [-0.5, 0.32, 0.15, 0.08, -0.2],
  ]) {
    ctx.beginPath();
    ctx.ellipse(x * r, y * r, rx * r, ry * r, giro, 0, TAU);
    pintar(ctx);
  }
}

function termometro(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.2, -r * 0.88, r * 0.4, r * 1.32, r * 0.2);
  ctx.fillStyle = CLARO;
  pintar(ctx);
  circulo(ctx, 0, r * 0.62, r * 0.34);
  ctx.fillStyle = color;
  pintar(ctx);
  ctx.fillStyle = color;
  rectR(ctx, -r * 0.09, -r * 0.55, r * 0.18, r * 1.08, r * 0.09);
  ctx.fill();
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(1.5, r * 0.06);
  for (const y of [-r * 0.55, -r * 0.25, r * 0.05]) {
    ctx.beginPath();
    ctx.moveTo(r * 0.2, y);
    ctx.lineTo(r * 0.45, y);
    ctx.stroke();
  }
}

function escudoCalidad(ctx, r, color) {
  preparar(ctx, r, color);
  poligono(ctx, [
    [0, -r * 0.9],
    [r * 0.72, -r * 0.58],
    [r * 0.58, r * 0.35],
    [0, r * 0.9],
    [-r * 0.58, r * 0.35],
    [-r * 0.72, -r * 0.58],
  ]);
  pintar(ctx);
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(3, r * 0.17);
  ctx.beginPath();
  ctx.moveTo(-r * 0.36, 0);
  ctx.lineTo(-r * 0.08, r * 0.28);
  ctx.lineTo(r * 0.42, -r * 0.3);
  ctx.stroke();
}

function brujula(ctx, r, color) {
  preparar(ctx, r, color);
  circulo(ctx, 0, 0, r * 0.9);
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  pintar(ctx);
  poligono(ctx, [
    [0, -r * 0.75],
    [r * 0.2, r * 0.08],
    [0, r * 0.75],
    [-r * 0.2, -r * 0.08],
  ]);
  ctx.fillStyle = color;
  pintar(ctx);
  ctx.fillStyle = CLARO;
  poligono(ctx, [[0, -r * 0.75], [r * 0.2, r * 0.08], [0, 0]]);
  pintar(ctx);
  circulo(ctx, 0, 0, r * 0.1);
  ctx.fillStyle = OSCURO;
  pintar(ctx);
}

function pinMapa(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.moveTo(0, r * 0.92);
  ctx.bezierCurveTo(-r * 0.18, r * 0.52, -r * 0.7, r * 0.12, -r * 0.7, -r * 0.35);
  ctx.arc(0, -r * 0.35, r * 0.7, Math.PI, 0);
  ctx.bezierCurveTo(r * 0.7, r * 0.12, r * 0.18, r * 0.52, 0, r * 0.92);
  ctx.closePath();
  pintar(ctx);
  circulo(ctx, 0, -r * 0.35, r * 0.25);
  ctx.fillStyle = CLARO;
  pintar(ctx);
}

function calibre(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.92, -r * 0.12, r * 1.84, r * 0.24, r * 0.06);
  pintar(ctx);
  poligono(ctx, [
    [-r * 0.82, -r * 0.12],
    [-r * 0.82, -r * 0.78],
    [-r * 0.55, -r * 0.78],
    [-r * 0.55, -r * 0.12],
  ]);
  pintar(ctx);
  poligono(ctx, [
    [r * 0.48, -r * 0.12],
    [r * 0.48, -r * 0.58],
    [r * 0.7, -r * 0.58],
    [r * 0.7, r * 0.12],
  ]);
  pintar(ctx);
  rectR(ctx, -r * 0.2, -r * 0.3, r * 0.72, r * 0.6, r * 0.08);
  ctx.fillStyle = OSCURO;
  pintar(ctx);
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(1, r * 0.04);
  for (let indice = 0; indice < 7; indice++) {
    const x = -r * 0.42 + indice * r * 0.2;
    ctx.beginPath();
    ctx.moveTo(x, r * 0.12);
    ctx.lineTo(x, r * (indice % 2 === 0 ? 0.34 : 0.26));
    ctx.stroke();
  }
}

function cascoIndustrial(ctx, r, color) {
  preparar(ctx, r, color);
  ctx.beginPath();
  ctx.arc(0, r * 0.05, r * 0.72, Math.PI, TAU);
  ctx.lineTo(r * 0.72, r * 0.42);
  ctx.lineTo(-r * 0.72, r * 0.42);
  ctx.closePath();
  pintar(ctx);
  rectR(ctx, -r * 0.92, r * 0.34, r * 1.84, r * 0.28, r * 0.1);
  pintar(ctx);
  ctx.strokeStyle = CLARO;
  ctx.lineWidth = Math.max(2, r * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.66);
  ctx.lineTo(0, r * 0.34);
  ctx.stroke();
}

function terminal(ctx, r, color) {
  preparar(ctx, r, color);
  rectR(ctx, -r * 0.9, -r * 0.72, r * 1.8, r * 1.44, r * 0.14);
  pintar(ctx);
  ctx.fillStyle = OSCURO;
  rectR(ctx, -r * 0.72, -r * 0.48, r * 1.44, r * 0.96, r * 0.06);
  ctx.fill();
  ctx.fillStyle = CLARO;
  ctx.font = `700 ${r * 0.48}px ui-monospace, monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('>_', 0, 0);
  ctx.fillStyle = color;
  for (const x of [-r * 0.62, -r * 0.42, -r * 0.22]) {
    circulo(ctx, x, -r * 0.6, r * 0.06);
    ctx.fill();
  }
}

function red(ctx, r, color) {
  const nodos = [
    [0, -r * 0.78],
    [-r * 0.72, -r * 0.18],
    [r * 0.72, -r * 0.18],
    [-r * 0.45, r * 0.68],
    [r * 0.45, r * 0.68],
    [0, r * 0.12],
  ];
  ctx.strokeStyle = CONTORNO;
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  for (const [desde, hasta] of [[0, 1], [0, 2], [1, 3], [2, 4], [3, 5], [4, 5], [1, 5], [2, 5]]) {
    ctx.moveTo(...nodos[desde]);
    ctx.lineTo(...nodos[hasta]);
  }
  ctx.stroke();
  preparar(ctx, r, color);
  nodos.forEach(([x, y], indice) => {
    circulo(ctx, x, y, indice === 5 ? r * 0.22 : r * 0.16);
    ctx.fillStyle = indice === 5 ? CLARO : color;
    pintar(ctx);
  });
}

// ───────────────────────────────── registro ─────────────────────────────────

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

  manzana,
  espiga,
  'cinta-transportadora': cintaTransportadora,
  'diagrama-flujo': diagramaFlujo,
  mapa,
  satelite,
  antena,
  'fibra-optica': fibraOptica,
  barco,
  ancla,
  nube,
  anemometro,
  algoritmo,
  'base-datos': baseDatos,
  adn,
  celula,
  termometro,
  'escudo-calidad': escudoCalidad,
  brujula,
  'pin-mapa': pinMapa,
  calibre,
  'casco-industrial': cascoIndustrial,
  terminal,
  red,
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
