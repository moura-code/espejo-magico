// El lugar donde se trabaja cada ingenieria, dibujado con formas vectoriales.
//
// Un degradado del color no le dice a nadie que es Ingenieria Quimica; un
// laboratorio si. Estas escenas son el fondo que aparece detras de la persona
// cuando agarra un objeto, y existen por la misma razon que figuras.js: sacar
// del camino critico un contenido que todavia no esta. El dia que haya
// fotografias de verdad, se dejan en la ruta que declara carreras.json y estas
// dejan de usarse sin tocar una linea.
//
// CONTRATO DE CADA ESCENA
//   - Pinta el lienzo ENTERO. Es el fondo de una pantalla completa: un borde sin
//     pintar deja asomando el espejo crudo detras de la persona.
//   - Arranca de un color solido oscuro. Encima va la persona recortada y sobre
//     ella su nombre y su historia en blanco: una escena clara se los come.
//   - Usa el color de la carrera como acento, no como relleno de todo.
//   - No deja transformaciones ni estilos pegados al contexto.
//   - La mitad de abajo y el centro quedan tranquilos: ahi va la persona. Lo que
//     identifica a la ingenieria vive arriba y a los costados.
//
// Se generan a PNG con `npm run generar-fondos`, que las dibuja con el Chrome de
// la maquina. Tambien son el respaldo en vivo si el PNG falta.

const TAU = Math.PI * 2;

// ---------- color ----------

const aRgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const aHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

/** Mezcla dos colores. `t` es cuanto del segundo entra. */
function mezclar(a, b, t) {
  const [ra, ga, ba] = aRgb(a);
  const [rb, gb, bb] = aRgb(b);
  return aHex([ra + (rb - ra) * t, ga + (gb - ga) * t, ba + (bb - ba) * t]);
}

// Casi negro, pero no negro: el negro puro contra el borde de la silueta hace un
// corte duro que delata el recorte.
const NOCHE = '#070a0f';

const oscuro = (color, t = 0.12) => mezclar(NOCHE, color, t);
const claro = (color, t = 0.35) => mezclar(color, '#ffffff', t);

// ---------- pinceles ----------

/** El fondo solido sobre el que se apoya todo lo demas. */
function base(ctx, ancho, alto, color) {
  ctx.save();
  ctx.fillStyle = oscuro(color, 0.14);
  ctx.fillRect(0, 0, ancho, alto);
  ctx.restore();
}

/** Un degradado vertical encima de la base, para dar profundidad. */
function cielo(ctx, ancho, alto, arriba, abajo, hasta = 1) {
  const g = ctx.createLinearGradient(0, 0, 0, alto * hasta);
  g.addColorStop(0, arriba);
  g.addColorStop(1, abajo);
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, ancho, alto * hasta);
  ctx.restore();
}

/**
 * Oscurece el pie de la escena, donde apoya la ficha de la persona.
 *
 * Suave a proposito: con la caida fuerte que tenia, la mitad de abajo de las
 * doce escenas quedaba en negro y no se leia ni el suelo. Lo que despega a la
 * persona del fondo es el recorte de la silueta, no una sombra.
 */
function reposo(ctx, ancho, alto) {
  const g = ctx.createLinearGradient(0, alto * 0.72, 0, alto);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(0, alto * 0.72, ancho, alto * 0.28);
  ctx.restore();
}

function poligono(ctx, puntos) {
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.closePath();
}

function caja(ctx, x, y, ancho, alto, relleno, borde = null, grosor = 2) {
  ctx.save();
  ctx.fillStyle = relleno;
  ctx.fillRect(x, y, ancho, alto);
  if (borde) {
    ctx.strokeStyle = borde;
    ctx.lineWidth = grosor;
    ctx.strokeRect(x, y, ancho, alto);
  }
  ctx.restore();
}

function disco(ctx, x, y, radio, relleno) {
  ctx.save();
  ctx.fillStyle = relleno;
  ctx.beginPath();
  ctx.arc(x, y, radio, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function trazo(ctx, puntos, color, grosor) {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = grosor;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  puntos.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.stroke();
  ctx.restore();
}

/** Un engranaje visto de frente, en silueta. */
function engranaje(ctx, x, y, radio, dientes, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < dientes * 2; i++) {
    const r = i % 2 === 0 ? radio : radio * 0.82;
    const a = (i / (dientes * 2)) * TAU;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(0, 0, radio * 0.34, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/** Vidrio de laboratorio con liquido adentro. */
function matraz(ctx, x, y, alto, color) {
  const ancho = alto * 0.78;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = Math.max(2, alto * 0.045);
  ctx.lineJoin = 'round';

  ctx.beginPath();
  ctx.moveTo(-alto * 0.12, -alto);
  ctx.lineTo(-alto * 0.12, -alto * 0.45);
  ctx.lineTo(-ancho / 2, 0);
  ctx.lineTo(ancho / 2, 0);
  ctx.lineTo(alto * 0.12, -alto * 0.45);
  ctx.lineTo(alto * 0.12, -alto);
  ctx.stroke();

  // El liquido llena el tercio de abajo, que es la parte ancha.
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.moveTo(-ancho * 0.38, -alto * 0.16);
  ctx.lineTo(-ancho / 2, 0);
  ctx.lineTo(ancho / 2, 0);
  ctx.lineTo(ancho * 0.38, -alto * 0.16);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Tanque cilindrico de planta, visto de frente. */
function tanque(ctx, x, y, ancho, alto, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y - alto, ancho / 2, ancho * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.fillRect(x - ancho / 2, y - alto, ancho, alto);
  ctx.beginPath();
  ctx.ellipse(x, y, ancho / 2, ancho * 0.16, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

// ---------- las escenas ----------

/**
 * Laboratorio: mesada, campana extractora, estanteria de frascos y vidrio con
 * liquido. Es la escena que se pidio por nombre, y la que fija el tono de todas.
 */
function quimica(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.2), oscuro(color, 0.04), 0.7);

  const azulejo = mezclar(NOCHE, color, 0.16);
  // Pared de azulejos: solo se insinua, con lineas muy tenues.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  for (let x = 0; x <= ancho; x += ancho / 9) trazo(ctx, [[x, 0], [x, alto * 0.62]], 'rgba(255,255,255,0.05)', 2);
  for (let y = 0; y <= alto * 0.62; y += alto / 16) trazo(ctx, [[0, y], [ancho, y]], 'rgba(255,255,255,0.05)', 2);
  ctx.restore();

  // Campana extractora, arriba a la izquierda.
  caja(ctx, ancho * 0.03, alto * 0.06, ancho * 0.36, alto * 0.26, azulejo, claro(color, 0.5), 4);
  caja(ctx, ancho * 0.06, alto * 0.1, ancho * 0.3, alto * 0.16, 'rgba(255,255,255,0.07)');
  matraz(ctx, ancho * 0.14, alto * 0.255, alto * 0.075, color);
  matraz(ctx, ancho * 0.28, alto * 0.255, alto * 0.055, claro(color, 0.3));

  // Estanteria de frascos, arriba a la derecha.
  for (let fila = 0; fila < 2; fila++) {
    const y = alto * (0.12 + fila * 0.13);
    trazo(ctx, [[ancho * 0.55, y], [ancho * 0.98, y]], claro(color, 0.4), 5);
    for (let i = 0; i < 6; i++) {
      const x = ancho * (0.58 + i * 0.068);
      const h = alto * (0.05 + ((i * 7) % 3) * 0.012);
      caja(ctx, x, y - h, ancho * 0.045, h, i % 2 ? claro(color, 0.15) : 'rgba(255,255,255,0.16)');
    }
  }

  // Mesada, que hace de horizonte.
  caja(ctx, 0, alto * 0.6, ancho, alto * 0.035, claro(color, 0.45));
  caja(ctx, 0, alto * 0.635, ancho, alto * 0.4, mezclar(NOCHE, color, 0.07));

  // El vidrio de la mesada, a los costados para no taparle la cara a nadie.
  matraz(ctx, ancho * 0.12, alto * 0.6, alto * 0.11, color);
  matraz(ctx, ancho * 0.9, alto * 0.6, alto * 0.085, claro(color, 0.25));
  for (let i = 0; i < 4; i++) {
    caja(ctx, ancho * (0.78 + i * 0.035), alto * 0.545, ancho * 0.02, alto * 0.055, 'rgba(255,255,255,0.2)');
    caja(ctx, ancho * (0.78 + i * 0.035), alto * 0.575, ancho * 0.02, alto * 0.025, color);
  }

  reposo(ctx, ancho, alto);
}

/** Obra: puente atirantado y grua torre contra el cielo. */
function civil(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.28), oscuro(color, 0.03), 0.8);

  const hierro = mezclar(NOCHE, color, 0.3);
  const tablero = alto * 0.52;

  // Los dos pilonos, con sus tirantes en abanico.
  for (const px of [ancho * 0.22, ancho * 0.78]) {
    poligono(ctx, [
      [px - ancho * 0.028, tablero],
      [px - ancho * 0.012, alto * 0.1],
      [px + ancho * 0.012, alto * 0.1],
      [px + ancho * 0.028, tablero],
    ]);
    ctx.save();
    ctx.fillStyle = hierro;
    ctx.fill();
    ctx.restore();

    for (let i = 1; i <= 6; i++) {
      const cima = alto * (0.12 + i * 0.012);
      const lejos = px + (px < ancho / 2 ? -1 : 1) * ancho * 0.045 * i;
      const cerca = px + (px < ancho / 2 ? 1 : -1) * ancho * 0.045 * i;
      trazo(ctx, [[px, cima], [lejos, tablero]], claro(color, 0.35), 3);
      trazo(ctx, [[px, cima], [cerca, tablero]], claro(color, 0.35), 3);
    }
  }

  // El tablero del puente.
  caja(ctx, 0, tablero, ancho, alto * 0.03, claro(color, 0.5));
  caja(ctx, 0, tablero + alto * 0.03, ancho, alto * 0.012, hierro);

  // Grua torre detras, a la izquierda.
  trazo(ctx, [[ancho * 0.08, alto * 0.5], [ancho * 0.08, alto * 0.14]], hierro, 10);
  trazo(ctx, [[ancho * -0.02, alto * 0.16], [ancho * 0.42, alto * 0.16]], hierro, 8);
  trazo(ctx, [[ancho * 0.3, alto * 0.16], [ancho * 0.3, alto * 0.3]], hierro, 4);
  caja(ctx, ancho * 0.28, alto * 0.3, ancho * 0.04, alto * 0.02, claro(color, 0.4));

  // Terreno y andamios abajo.
  caja(ctx, 0, alto * 0.72, ancho, alto * 0.3, mezclar(NOCHE, color, 0.06));
  for (let i = 0; i < 7; i++) {
    const x = ancho * (0.02 + i * 0.15);
    trazo(ctx, [[x, alto * 0.72], [x, alto * 0.95]], 'rgba(255,255,255,0.07)', 6);
  }
  trazo(ctx, [[0, alto * 0.82], [ancho, alto * 0.82]], 'rgba(255,255,255,0.07)', 6);

  reposo(ctx, ancho, alto);
}

/** Astillero: el barco en grada, las gruas portico y el agua. */
function naval(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.34), oscuro(color, 0.08), 0.75);

  const casco = mezclar(NOCHE, color, 0.34);
  const linea = claro(color, 0.45);
  const agua = alto * 0.74;

  // Gruas portico: patas que llegan al suelo y viga arriba. Antes eran lineas
  // sueltas flotando y no se leian como gruas.
  for (const gx of [ancho * 0.12, ancho * 0.88]) {
    const viga = alto * 0.16;
    trazo(ctx, [[gx - ancho * 0.07, agua], [gx - ancho * 0.07, viga]], casco, 9);
    trazo(ctx, [[gx + ancho * 0.07, agua], [gx + ancho * 0.07, viga]], casco, 9);
    trazo(ctx, [[gx - ancho * 0.13, viga], [gx + ancho * 0.13, viga]], casco, 12);
    // Riostras y carro con su cable.
    trazo(ctx, [[gx - ancho * 0.07, alto * 0.34], [gx + ancho * 0.07, alto * 0.42]], casco, 4);
    trazo(ctx, [[gx + ancho * 0.07, alto * 0.34], [gx - ancho * 0.07, alto * 0.42]], casco, 4);
    trazo(ctx, [[gx, viga], [gx, alto * 0.3]], linea, 3);
    caja(ctx, gx - ancho * 0.02, alto * 0.3, ancho * 0.04, alto * 0.018, linea);
  }

  // EL BARCO, DE PERFIL. Proa levantada a la derecha, popa recta a la
  // izquierda: es la silueta que se reconoce de lejos y de costado.
  ctx.save();
  ctx.fillStyle = casco;
  ctx.beginPath();
  ctx.moveTo(ancho * 0.16, alto * 0.44);
  ctx.lineTo(ancho * 0.16, alto * 0.6);
  ctx.quadraticCurveTo(ancho * 0.2, alto * 0.66, ancho * 0.34, alto * 0.67);
  ctx.lineTo(ancho * 0.72, alto * 0.67);
  ctx.quadraticCurveTo(ancho * 0.86, alto * 0.65, ancho * 0.9, alto * 0.52);
  ctx.lineTo(ancho * 0.93, alto * 0.36);
  ctx.lineTo(ancho * 0.8, alto * 0.42);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Superestructura sobre la popa, con su chimenea y las ventanas del puente.
  caja(ctx, ancho * 0.2, alto * 0.32, ancho * 0.22, alto * 0.12, mezclar(NOCHE, color, 0.42));
  caja(ctx, ancho * 0.28, alto * 0.24, ancho * 0.08, alto * 0.08, linea);
  for (let i = 0; i < 4; i++) {
    caja(ctx, ancho * (0.225 + i * 0.05), alto * 0.35, ancho * 0.03, alto * 0.02, 'rgba(255,255,255,0.35)');
  }

  // Linea de flotacion y portillos.
  trazo(ctx, [[ancho * 0.17, alto * 0.55], [ancho * 0.88, alto * 0.55]], linea, 5);
  for (let i = 0; i < 8; i++) {
    disco(ctx, ancho * (0.24 + i * 0.075), alto * 0.5, ancho * 0.009, 'rgba(255,255,255,0.3)');
  }

  // Agua, con su reflejo quebrado.
  caja(ctx, 0, agua, ancho, alto * 0.28, mezclar(NOCHE, color, 0.2));
  for (let i = 0; i < 16; i++) {
    const y = agua + alto * 0.012 + i * alto * 0.015;
    const largo = ancho * (0.12 + ((i * 13) % 7) * 0.055);
    const x = ancho * 0.5 - largo / 2 + ((i % 3) - 1) * ancho * 0.09;
    trazo(ctx, [[x, y], [x + largo, y]], 'rgba(255,255,255,0.1)', 3);
  }

  reposo(ctx, ancho, alto);
}

/** Bosque: troncos en tres profundidades y la luz que baja entre las copas. */
function forestal(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, mezclar(NOCHE, color, 0.34), NOCHE, 1);

  const suelo = alto * 0.84;

  /**
   * Un tronco que se afina hacia arriba y se ensancha en la base. La conicidad
   * es lo que lo hace leer como arbol: con barras parejas todo el plano parecia
   * pasto, sin escala ni distancia.
   */
  function tronco(x, grosor, tono, hastaArriba) {
    const arriba = hastaArriba ? -alto * 0.05 : alto * 0.1;
    ctx.save();
    ctx.fillStyle = mezclar(NOCHE, color, tono);
    ctx.beginPath();
    ctx.moveTo(x - grosor * 0.42, arriba);
    ctx.lineTo(x + grosor * 0.42, arriba);
    ctx.lineTo(x + grosor * 0.62, suelo);
    ctx.quadraticCurveTo(x + grosor * 0.9, suelo + alto * 0.02, x + grosor * 1.15, suelo + alto * 0.03);
    ctx.lineTo(x - grosor * 1.15, suelo + alto * 0.03);
    ctx.quadraticCurveTo(x - grosor * 0.9, suelo + alto * 0.02, x - grosor * 0.62, suelo);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Fondo: muchos troncos finos y casi negros, apenas insinuados.
  for (let i = 0; i < 13; i++) {
    const x = ancho * (0.03 + (i * 0.077) + ((i * 37) % 5) * 0.006);
    tronco(x, ancho * 0.016, 0.1, false);
  }

  // Plano medio: menos, mas gruesos, con alguna rama.
  for (let i = 0; i < 6; i++) {
    const x = ancho * (0.08 + i * 0.17 + ((i * 23) % 3) * 0.015);
    tronco(x, ancho * 0.038, 0.2, false);
    if (i % 2 === 0) {
      trazo(
        ctx,
        [[x, alto * 0.34], [x + ancho * (i % 4 ? 0.1 : -0.1), alto * 0.26]],
        mezclar(NOCHE, color, 0.2),
        Math.max(4, ancho * 0.012),
      );
    }
  }

  // Primer plano: tres troncos gruesos, contra los bordes y saliendo por arriba.
  // Son los que dan la escala; sin ellos el bosque no tiene profundidad.
  for (const [x, grosor] of [[0.04, 0.1], [0.32, 0.062], [0.96, 0.088]]) {
    tronco(ancho * x, ancho * grosor, 0.32, true);
  }

  // Copas: una banda densa arriba que cierra el bosque.
  ctx.save();
  ctx.fillStyle = mezclar(NOCHE, color, 0.26);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(ancho, 0);
  ctx.lineTo(ancho, alto * 0.14);
  for (let i = 10; i >= 0; i--) {
    ctx.quadraticCurveTo(
      ancho * (i / 10 + 0.05),
      alto * (i % 2 ? 0.23 : 0.1),
      ancho * (i / 10),
      alto * 0.15,
    );
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  // Los haces de luz que se cuelan entre las copas.
  ctx.save();
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = claro(color, 0.7);
  for (const hx of [0.18, 0.58, 0.82]) {
    poligono(ctx, [
      [ancho * hx, 0],
      [ancho * (hx + 0.05), 0],
      [ancho * (hx + 0.22), suelo],
      [ancho * (hx + 0.04), suelo],
    ]);
    ctx.fill();
  }
  ctx.restore();

  // Suelo con maleza: el borde irregular lo separa de los troncos.
  ctx.save();
  ctx.fillStyle = mezclar(NOCHE, color, 0.16);
  ctx.beginPath();
  ctx.moveTo(0, alto);
  ctx.lineTo(0, suelo + alto * 0.02);
  for (let i = 0; i <= 12; i++) {
    ctx.quadraticCurveTo(
      ancho * (i / 12 + 0.02),
      suelo + alto * (i % 2 ? 0.005 : 0.035),
      ancho * ((i + 1) / 12),
      suelo + alto * 0.02,
    );
  }
  ctx.lineTo(ancho, alto);
  ctx.closePath();
  ctx.fill();
  ctx.restore();

  reposo(ctx, ancho, alto);
}

/** Taller: engranajes grandes en la pared, cerchas y banco de trabajo. */
function mecanica(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.3), oscuro(color, 0.06), 0.8);

  const acero = mezclar(NOCHE, color, 0.26);

  // Cerchas del techo: dos vigas con su celosia en zigzag, que es lo que dice
  // "nave industrial" y no "pared con dibujos".
  for (const y of [alto * 0.07, alto * 0.15]) {
    trazo(ctx, [[0, y], [ancho, y]], acero, 11);
    trazo(ctx, [[0, y + alto * 0.045], [ancho, y + alto * 0.045]], acero, 7);
    for (let x = 0; x <= ancho; x += ancho / 7) {
      trazo(ctx, [[x, y], [x + ancho / 14, y + alto * 0.045]], acero, 4);
      trazo(ctx, [[x + ancho / 7, y], [x + ancho / 14, y + alto * 0.045]], acero, 4);
    }
  }

  // LOS ENGRANAJES SON LA FIRMA. Grandes y mordidos por el borde: asi se leen
  // como maquinaria de verdad y no como iconos sueltos flotando en la pared.
  engranaje(ctx, ancho * 0.04, alto * 0.42, ancho * 0.3, 14, claro(color, 0.3));
  engranaje(ctx, ancho * 0.33, alto * 0.29, ancho * 0.16, 11, mezclar(NOCHE, color, 0.42));
  engranaje(ctx, ancho * 0.98, alto * 0.5, ancho * 0.26, 13, claro(color, 0.22));
  engranaje(ctx, ancho * 0.74, alto * 0.34, ancho * 0.12, 10, mezclar(NOCHE, color, 0.38));

  // Banco de trabajo con las herramientas colgadas del tablero perforado.
  const banco = alto * 0.68;
  trazo(ctx, [[ancho * 0.04, alto * 0.58], [ancho * 0.96, alto * 0.58]], claro(color, 0.4), 6);
  for (let i = 0; i < 9; i++) {
    const x = ancho * (0.07 + i * 0.105);
    trazo(ctx, [[x, alto * 0.58], [x, alto * (0.615 + (i % 3) * 0.018)]], 'rgba(255,255,255,0.25)', 5);
  }
  caja(ctx, 0, banco, ancho, alto * 0.035, claro(color, 0.45));
  caja(ctx, 0, banco + alto * 0.035, ancho, alto * 0.32, mezclar(NOCHE, color, 0.11));
  // Las patas del banco, que le dan suelo.
  for (const px of [0.06, 0.42, 0.94]) {
    caja(ctx, ancho * px - ancho * 0.015, banco + alto * 0.035, ancho * 0.03, alto * 0.14, acero);
  }

  reposo(ctx, ancho, alto);
}

/** Torres de alta tension contra un cielo nocturno, y el tendido colgando. */
function electrica(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, mezclar(NOCHE, color, 0.24), NOCHE, 1);

  const hierro = mezclar(NOCHE, color, 0.32);

  function torre(x, escala) {
    const alturaTorre = alto * 0.5 * escala;
    const pie = alto * 0.72;
    const cima = pie - alturaTorre;
    const anchoPie = ancho * 0.11 * escala;

    trazo(ctx, [[x - anchoPie, pie], [x - anchoPie * 0.18, cima]], hierro, 6 * escala);
    trazo(ctx, [[x + anchoPie, pie], [x + anchoPie * 0.18, cima]], hierro, 6 * escala);
    // Las crucetas, que son lo que hace reconocible la silueta.
    for (const [fy, largo] of [[0.16, 1], [0.34, 0.8], [0.52, 0.62]]) {
      const y = cima + alturaTorre * fy;
      const l = anchoPie * 1.7 * largo;
      trazo(ctx, [[x - l, y], [x + l, y]], hierro, 5 * escala);
      disco(ctx, x - l, y + alto * 0.008, ancho * 0.006 * escala, claro(color, 0.5));
      disco(ctx, x + l, y + alto * 0.008, ancho * 0.006 * escala, claro(color, 0.5));
    }
    // Celosia interna.
    for (let i = 0; i < 6; i++) {
      const y1 = cima + (alturaTorre * i) / 6;
      const y2 = cima + (alturaTorre * (i + 1)) / 6;
      const w1 = anchoPie * (0.18 + (0.82 * i) / 6);
      const w2 = anchoPie * (0.18 + (0.82 * (i + 1)) / 6);
      trazo(ctx, [[x - w1, y1], [x + w2, y2]], hierro, 2.5 * escala);
      trazo(ctx, [[x + w1, y1], [x - w2, y2]], hierro, 2.5 * escala);
    }
    return cima;
  }

  // Una torre grande a cada lado y una chica al fondo, en el medio.
  torre(ancho * 0.5, 0.55);
  const cimaIzq = torre(ancho * 0.1, 1);
  const cimaDer = torre(ancho * 0.9, 1);

  // El tendido: catenarias de lado a lado.
  ctx.save();
  ctx.strokeStyle = claro(color, 0.25);
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    const y = cimaIzq + alto * (0.08 + i * 0.09);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.quadraticCurveTo(ancho * 0.5, y + alto * 0.07, ancho, cimaDer + alto * (0.08 + i * 0.09));
    ctx.stroke();
  }
  ctx.restore();

  caja(ctx, 0, alto * 0.72, ancho, alto * 0.3, mezclar(NOCHE, color, 0.08));
  reposo(ctx, ancho, alto);
}

/** Sala de servidores: dos hileras de racks y el pasillo frio en el medio. */
function computacion(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.2), NOCHE, 1);

  const chasis = mezclar(NOCHE, color, 0.2);

  // EL PASILLO VA EN EL MEDIO. Los racks arrancan pegados al borde y se van
  // hacia el fondo, pero nunca cruzan el centro: ahi va la persona, y un rack
  // detras de su cara tapa lo unico que el espejo tiene que mostrar.
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const t = i / 3;
      const w = ancho * (0.26 - t * 0.09);
      const h = alto * (0.66 - t * 0.17);
      const x = lado < 0 ? -ancho * 0.02 + t * ancho * 0.15 : ancho * 1.02 - t * ancho * 0.15 - w;
      const y = alto * (0.08 + t * 0.1);

      caja(ctx, x, y, w, h, chasis, 'rgba(255,255,255,0.1)', 2);
      // Las lucecitas de cada bandeja, siempre del lado del pasillo.
      const filas = Math.round(16 - t * 4);
      const desde = lado < 0 ? 0.55 : 0.1;
      for (let f = 0; f < filas; f++) {
        const fy = y + (h * (f + 0.5)) / filas;
        trazo(ctx, [[x + w * 0.08, fy], [x + w * 0.92, fy]], 'rgba(255,255,255,0.06)', 2);
        const encendida = (f * 7 + i * 3) % 5 !== 0;
        disco(ctx, x + w * desde, fy, Math.max(2, w * 0.02), encendida ? color : 'rgba(255,255,255,0.15)');
        if (encendida && f % 3 === 0) {
          disco(ctx, x + w * (desde + 0.09), fy, Math.max(2, w * 0.015), claro(color, 0.55));
        }
      }
    }
  }

  // Piso tecnico: baldosas que se juntan hacia el fondo del pasillo.
  caja(ctx, 0, alto * 0.74, ancho, alto * 0.28, mezclar(NOCHE, color, 0.09));
  for (let i = -3; i <= 3; i++) {
    trazo(
      ctx,
      [[ancho * (0.5 + i * 0.05), alto * 0.74], [ancho * (0.5 + i * 0.24), alto]],
      'rgba(255,255,255,0.07)',
      2,
    );
  }
  for (let i = 1; i < 5; i++) {
    const y = alto * (0.74 + i * i * 0.013);
    trazo(ctx, [[0, y], [ancho, y]], 'rgba(255,255,255,0.07)', 2);
  }

  reposo(ctx, ancho, alto);
}

/** Cielo con orbitas y un pizarron con la parabola: calculo y cosmos. */
function fisicoMatematico(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, mezclar(NOCHE, color, 0.2), NOCHE, 1);

  // Estrellas, con un patron fijo: nada de azar, que hace irrepetible el PNG.
  ctx.save();
  for (let i = 0; i < 90; i++) {
    const x = ((i * 197) % 1000) / 1000;
    const y = ((i * 419) % 1000) / 1000;
    const r = 1 + ((i * 13) % 3);
    ctx.fillStyle = i % 7 === 0 ? claro(color, 0.4) : 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.arc(ancho * x, alto * y * 0.72, r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();

  // Orbitas concentricas, inclinadas.
  ctx.save();
  ctx.translate(ancho * 0.5, alto * 0.34);
  ctx.rotate(-0.35);
  ctx.strokeStyle = claro(color, 0.2);
  ctx.lineWidth = 3;
  for (let i = 1; i <= 3; i++) {
    ctx.beginPath();
    ctx.ellipse(0, 0, ancho * 0.16 * i, ancho * 0.06 * i, 0, 0, TAU);
    ctx.stroke();
  }
  ctx.restore();
  disco(ctx, ancho * 0.5, alto * 0.34, ancho * 0.035, claro(color, 0.55));

  // Pizarron abajo a la izquierda, con ejes y una parabola.
  const px = ancho * 0.04;
  const py = alto * 0.6;
  const pw = ancho * 0.42;
  const ph = alto * 0.24;
  caja(ctx, px, py, pw, ph, 'rgba(255,255,255,0.05)', claro(color, 0.3), 4);
  trazo(ctx, [[px + pw * 0.1, py + ph * 0.85], [px + pw * 0.9, py + ph * 0.85]], 'rgba(255,255,255,0.4)', 3);
  trazo(ctx, [[px + pw * 0.18, py + ph * 0.12], [px + pw * 0.18, py + ph * 0.92]], 'rgba(255,255,255,0.4)', 3);

  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px + pw * 0.22, py + ph * 0.2);
  ctx.quadraticCurveTo(px + pw * 0.5, py + ph * 1.25, px + pw * 0.88, py + ph * 0.25);
  ctx.stroke();
  ctx.restore();

  reposo(ctx, ancho, alto);
}

/** Planta de alimentos: tanques de acero, tuberia y cinta transportadora. */
function alimentos(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.26), oscuro(color, 0.06), 0.8);

  const acero = mezclar(NOCHE, color, 0.26);
  const brillo = claro(color, 0.4);
  const piso = alto * 0.66;

  // Los tanques, altos y a los costados. Antes eran dos bultos: lo que los hace
  // leer como tanques son las patas, la tapa y los aros de refuerzo.
  for (const [tx, tw] of [
    [0.14, 0.28],
    [0.86, 0.28],
    [0.5, 0.16],
  ]) {
    const x = ancho * tx;
    const w = ancho * tw;
    const grande = tw > 0.2;
    const h = grande ? alto * 0.4 : alto * 0.22;
    const pie = grande ? piso : alto * 0.55;

    tanque(ctx, x, pie, w, h, grande ? acero : mezclar(NOCHE, color, 0.18));
    for (let i = 1; i <= 3; i++) {
      const y = pie - (h * i) / 4;
      trazo(ctx, [[x - w / 2, y], [x + w / 2, y]], 'rgba(255,255,255,0.12)', 4);
    }
    // El brillo vertical que dice "acero inoxidable".
    caja(ctx, x - w * 0.3, pie - h * 0.95, w * 0.06, h * 0.9, 'rgba(255,255,255,0.16)');
    if (grande) {
      for (const lado of [-0.34, 0.34]) {
        caja(ctx, x + w * lado, pie, w * 0.07, alto * 0.06, acero);
      }
    }
  }

  // Tuberia que los une por arriba, con sus codos y sus valvulas.
  trazo(
    ctx,
    [
      [ancho * 0.14, alto * 0.245],
      [ancho * 0.14, alto * 0.13],
      [ancho * 0.86, alto * 0.13],
      [ancho * 0.86, alto * 0.245],
    ],
    brillo,
    14,
  );
  trazo(ctx, [[ancho * 0.5, alto * 0.13], [ancho * 0.5, alto * 0.32]], brillo, 10);
  for (const vx of [0.3, 0.7]) {
    caja(ctx, ancho * vx - ancho * 0.022, alto * 0.105, ancho * 0.044, ancho * 0.044, acero, brillo, 3);
  }

  // Cinta transportadora con cajas.
  caja(ctx, 0, alto * 0.72, ancho, alto * 0.028, brillo);
  caja(ctx, 0, alto * 0.748, ancho, alto * 0.022, acero);
  for (let i = 0; i < 10; i++) {
    disco(ctx, ancho * (0.04 + i * 0.104), alto * 0.759, ancho * 0.013, 'rgba(255,255,255,0.2)');
  }
  for (const cx of [0.07, 0.22, 0.78, 0.93]) {
    caja(ctx, ancho * cx - ancho * 0.05, alto * 0.655, ancho * 0.1, alto * 0.065, mezclar(NOCHE, color, 0.34), brillo, 2);
  }

  caja(ctx, 0, alto * 0.78, ancho, alto * 0.24, mezclar(NOCHE, color, 0.1));
  reposo(ctx, ancho, alto);
}

/** Linea de montaje: brazos roboticos sobre la cinta. */
function produccion(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, oscuro(color, 0.2), oscuro(color, 0.04), 0.8);

  const acero = mezclar(NOCHE, color, 0.24);

  function brazo(x, escala, giro) {
    ctx.save();
    ctx.translate(x, alto * 0.58);
    ctx.scale(escala, escala);
    // Base.
    caja(ctx, -ancho * 0.05, -alto * 0.03, ancho * 0.1, alto * 0.03, acero);
    ctx.rotate(giro);
    // Primer tramo.
    caja(ctx, -ancho * 0.018, -alto * 0.22, ancho * 0.036, alto * 0.2, acero);
    ctx.translate(0, -alto * 0.21);
    ctx.rotate(-giro * 2.2);
    // Segundo tramo y pinza.
    caja(ctx, -ancho * 0.014, -alto * 0.17, ancho * 0.028, alto * 0.17, mezclar(NOCHE, color, 0.32));
    disco(ctx, 0, 0, ancho * 0.022, claro(color, 0.4));
    ctx.translate(0, -alto * 0.17);
    trazo(ctx, [[-ancho * 0.02, 0], [-ancho * 0.03, -alto * 0.025]], claro(color, 0.5), 6);
    trazo(ctx, [[ancho * 0.02, 0], [ancho * 0.03, -alto * 0.025]], claro(color, 0.5), 6);
    ctx.restore();
  }

  brazo(ancho * 0.16, 1, 0.35);
  brazo(ancho * 0.84, 1, -0.35);
  brazo(ancho * 0.5, 0.6, 0.15);

  // La cinta, con sus rodillos y las piezas encima.
  caja(ctx, 0, alto * 0.6, ancho, alto * 0.028, claro(color, 0.45));
  caja(ctx, 0, alto * 0.628, ancho, alto * 0.022, acero);
  for (let i = 0; i < 11; i++) {
    disco(ctx, ancho * (0.03 + i * 0.094), alto * 0.639, ancho * 0.011, 'rgba(255,255,255,0.15)');
  }
  for (const cx of [0.1, 0.3, 0.7, 0.9]) {
    caja(ctx, ancho * cx - ancho * 0.04, alto * 0.545, ancho * 0.08, alto * 0.055, mezclar(NOCHE, color, 0.3), claro(color, 0.3), 3);
  }

  caja(ctx, 0, alto * 0.68, ancho, alto * 0.34, mezclar(NOCHE, color, 0.07));
  reposo(ctx, ancho, alto);
}

/** Campo con curvas de nivel, el teodolito en su tripode y los mojones. */
function agrimensura(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, mezclar(NOCHE, color, 0.34), oscuro(color, 0.1), 0.55);

  // Dos hileras de cerros, la de atras mas clara: sin esa diferencia el
  // horizonte quedaba plano y no se leia el terreno.
  const cerros = (puntos, tono) => {
    ctx.save();
    ctx.fillStyle = mezclar(NOCHE, color, tono);
    ctx.beginPath();
    ctx.moveTo(0, alto);
    puntos.forEach(([x, y]) => ctx.lineTo(ancho * x, alto * y));
    ctx.lineTo(ancho, alto);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  cerros([[0, 0.5], [0.22, 0.36], [0.45, 0.47], [0.68, 0.33], [0.88, 0.45], [1, 0.4]], 0.2);
  cerros([[0, 0.58], [0.3, 0.48], [0.55, 0.57], [0.8, 0.5], [1, 0.56]], 0.12);

  // Curvas de nivel: la firma del oficio, y tienen que verse.
  ctx.save();
  ctx.strokeStyle = claro(color, 0.45);
  ctx.globalAlpha = 0.5;
  ctx.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const y = alto * (0.63 + i * 0.05);
    ctx.beginPath();
    ctx.moveTo(-ancho * 0.05, y);
    ctx.quadraticCurveTo(ancho * 0.3, y - alto * (0.035 + i * 0.007), ancho * 0.55, y);
    ctx.quadraticCurveTo(ancho * 0.82, y + alto * (0.035 + i * 0.007), ancho * 1.05, y - alto * 0.012);
    ctx.stroke();
  }
  ctx.restore();

  // Teodolito sobre su tripode, grande y a la derecha.
  const tx = ancho * 0.8;
  const ty = alto * 0.5;
  trazo(ctx, [[tx, ty], [tx - ancho * 0.11, alto * 0.79]], claro(color, 0.4), 8);
  trazo(ctx, [[tx, ty], [tx + ancho * 0.11, alto * 0.79]], claro(color, 0.4), 8);
  trazo(ctx, [[tx, ty], [tx + ancho * 0.015, alto * 0.8]], claro(color, 0.28), 8);
  caja(ctx, tx - ancho * 0.055, ty - alto * 0.06, ancho * 0.11, alto * 0.06, mezclar(NOCHE, color, 0.42));
  trazo(
    ctx,
    [[tx - ancho * 0.085, ty - alto * 0.042], [tx + ancho * 0.085, ty - alto * 0.042]],
    claro(color, 0.6),
    9,
  );
  disco(ctx, tx + ancho * 0.085, ty - alto * 0.042, ancho * 0.016, claro(color, 0.7));

  // Mojones alineados hacia el fondo, que dan la profundidad.
  for (let i = 0; i < 5; i++) {
    const x = ancho * (0.07 + i * 0.075);
    const h = alto * (0.07 - i * 0.011);
    const y = alto * (0.72 - i * 0.028);
    caja(ctx, x, y - h, ancho * 0.016, h, claro(color, 0.5));
    caja(ctx, x, y - h, ancho * 0.016, h * 0.35, 'rgba(255,255,255,0.85)');
  }

  reposo(ctx, ancho, alto);
}

/** Antenas parabolicas y la torre, con las ondas saliendo. */
function comunicacion(ctx, ancho, alto, color) {
  base(ctx, ancho, alto, color);
  cielo(ctx, ancho, alto, mezclar(NOCHE, color, 0.22), NOCHE, 1);

  const hierro = mezclar(NOCHE, color, 0.3);

  // La torre, en el centro pero alta: la cara de la persona queda mas abajo.
  const cx = ancho * 0.5;
  trazo(ctx, [[cx - ancho * 0.09, alto * 0.6], [cx - ancho * 0.02, alto * 0.08]], hierro, 7);
  trazo(ctx, [[cx + ancho * 0.09, alto * 0.6], [cx + ancho * 0.02, alto * 0.08]], hierro, 7);
  for (let i = 0; i < 8; i++) {
    const t1 = i / 8;
    const t2 = (i + 1) / 8;
    const y1 = alto * (0.08 + t1 * 0.52);
    const y2 = alto * (0.08 + t2 * 0.52);
    const w1 = ancho * (0.02 + t1 * 0.07);
    const w2 = ancho * (0.02 + t2 * 0.07);
    trazo(ctx, [[cx - w1, y1], [cx + w2, y2]], hierro, 3);
    trazo(ctx, [[cx + w1, y1], [cx - w2, y2]], hierro, 3);
    trazo(ctx, [[cx - w2, y2], [cx + w2, y2]], hierro, 2.5);
  }
  disco(ctx, cx, alto * 0.06, ancho * 0.012, claro(color, 0.6));

  // Las ondas, concentricas desde la punta.
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  for (let i = 1; i <= 4; i++) {
    ctx.globalAlpha = 0.4 / i;
    ctx.beginPath();
    ctx.arc(cx, alto * 0.06, ancho * 0.1 * i, Math.PI * 1.15, Math.PI * 1.85);
    ctx.stroke();
  }
  ctx.restore();

  // Dos parabolicas, una a cada lado, mirando afuera.
  function parabolica(x, y, radio, hacia) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(hacia, 1);
    ctx.fillStyle = mezclar(NOCHE, color, 0.26);
    ctx.beginPath();
    ctx.ellipse(0, 0, radio * 0.42, radio, -0.5, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = claro(color, 0.4);
    ctx.lineWidth = 4;
    ctx.stroke();
    trazo(ctx, [[0, 0], [radio * 0.55, -radio * 0.25]], claro(color, 0.5), 5);
    disco(ctx, radio * 0.55, -radio * 0.25, radio * 0.1, claro(color, 0.6));
    ctx.restore();
    trazo(ctx, [[x, y + radio * 0.6], [x, alto * 0.72]], hierro, 8);
  }

  parabolica(ancho * 0.13, alto * 0.42, ancho * 0.14, -1);
  parabolica(ancho * 0.87, alto * 0.42, ancho * 0.14, 1);

  caja(ctx, 0, alto * 0.72, ancho, alto * 0.3, mezclar(NOCHE, color, 0.08));
  reposo(ctx, ancho, alto);
}

export const ESCENARIOS = {
  quimica,
  civil,
  naval,
  forestal,
  mecanica,
  electrica,
  computacion,
  'fisico-matematico': fisicoMatematico,
  alimentos,
  produccion,
  agrimensura,
  comunicacion,
};

/**
 * Dibuja el escenario de una ingenieria cubriendo `ancho` x `alto`. Devuelve
 * false si no hay escena para ese id, para que el llamador caiga a lo que tenga.
 */
export function dibujarEscenario(ctx, id, ancho, alto, color) {
  const escena = ESCENARIOS[id];
  if (!escena) return false;

  ctx.save();
  escena(ctx, ancho, alto, color);
  ctx.restore();
  return true;
}

/**
 * Las escenas ya dibujadas, listas para copiar.
 *
 * Una escena son cientos de trazos: dibujarla en cada cuadro tiraria los 60 FPS
 * al piso. Se dibuja UNA vez sobre un lienzo aparte, y de ahi en mas es un solo
 * drawImage, igual de barato que el PNG al que reemplaza.
 *
 * `crearLienzo(ancho, alto)` devuelve `{ lienzo, ctx }`. Se inyecta para que
 * esto se pruebe en Node, sin pantalla.
 */
export function crearBancoDeEscenarios({ crearLienzo }) {
  const hechas = new Map();

  return {
    /** El lienzo con la escena, o null si esa ingenieria no tiene. */
    obtener(id, ancho, alto, color) {
      if (!ESCENARIOS[id]) return null;

      const clave = `${id}|${ancho}x${alto}|${color}`;
      const guardada = hechas.get(clave);
      if (guardada) return guardada;

      const { lienzo, ctx } = crearLienzo(ancho, alto);
      dibujarEscenario(ctx, id, ancho, alto, color);
      hechas.set(clave, lienzo);
      return lienzo;
    },

    olvidar() {
      hechas.clear();
    },
  };
}
