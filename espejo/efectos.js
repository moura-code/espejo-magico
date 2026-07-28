// Un comportamiento de particulas por carrera, para que cada ingenieria tenga
// textura propia sin depender de un solo archivo de diseño.
//
// Se dibujan encima del video y debajo de los objetos, para que el participante
// quede dentro de la escena y no tapado por ella.
//
// CONTRATO
//   crearEfecto(tipo, opciones) -> { actualizar(dt, ctxo), dibujar(ctx, ctxo) } | null
//   ctxo = { ancho, alto, color, rostro, ahora }
//
// Las particulas viven en coordenadas normalizadas (0 a 1), asi un cambio de
// tamaño de pantalla no las descoloca. Misma leccion que el resto del proyecto.

import { dibujarFigura } from './figuras.js';

const TAU = Math.PI * 2;
const SIMBOLOS = ['π', 'Σ', '∫', '∞', '√', 'Δ', 'λ', 'θ', '∂', 'α', 'ω', '≈'];
const CARACTERES = '01{}<>/[]=+*;:!?';

const entre = (azar, min, max) => min + azar() * (max - min);

// ─────────────────────────────── MECANICA ───────────────────────────────

function engranajes({ azar, presupuesto }) {
  const piezas = Array.from({ length: Math.min(presupuesto, 9) }, () => ({
    x: azar(),
    y: azar(),
    radio: entre(azar, 0.05, 0.13),
    giro: azar() * TAU,
    velocidad: entre(azar, -0.5, 0.5),
  }));

  return {
    actualizar(dt) {
      for (const pieza of piezas) pieza.giro += pieza.velocidad * dt;
    },
    dibujar(ctx, { ancho, alto, color }) {
      const corto = Math.min(ancho, alto);
      ctx.save();
      ctx.globalAlpha = 0.22;
      for (const pieza of piezas) {
        ctx.save();
        ctx.translate(pieza.x * ancho, pieza.y * alto);
        ctx.rotate(pieza.giro);
        dibujarFigura(ctx, 'engranaje', pieza.radio * corto, color);
        ctx.restore();
      }
      ctx.restore();
    },
  };
}

// ─────────────────────────────── ELECTRICA ───────────────────────────────

function chispas({ azar, presupuesto }) {
  const chispa = () => ({
    x: azar(),
    y: azar(),
    vx: entre(azar, -0.25, 0.25),
    vy: entre(azar, -0.25, 0.25),
    vida: entre(azar, 0.2, 0.8),
    edad: 0,
  });

  const particulas = Array.from({ length: presupuesto }, chispa);
  let arco = null;
  let proximoArco = 0;

  return {
    actualizar(dt) {
      for (const p of particulas) {
        p.edad += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.edad >= p.vida || p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) {
          Object.assign(p, chispa());
        }
      }

      proximoArco -= dt;
      if (proximoArco <= 0) {
        proximoArco = entre(azar, 0.4, 1.4);
        arco = {
          desde: { x: azar(), y: azar() * 0.6 },
          hasta: { x: azar(), y: azar() * 0.6 },
          vida: 0.12,
        };
      }
      if (arco) {
        arco.vida -= dt;
        if (arco.vida <= 0) arco = null;
      }
    },

    dibujar(ctx, { ancho, alto, color }) {
      ctx.save();
      ctx.fillStyle = color;
      for (const p of particulas) {
        ctx.globalAlpha = 0.85 * (1 - p.edad / p.vida);
        const lado = Math.min(ancho, alto) * 0.008;
        ctx.fillRect(p.x * ancho, p.y * alto, lado, lado * 3);
      }

      if (arco) {
        ctx.globalAlpha = 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = Math.max(2, Math.min(ancho, alto) * 0.004);
        ctx.beginPath();
        ctx.moveTo(arco.desde.x * ancho, arco.desde.y * alto);
        // Quiebre al medio: un rayo recto no parece un rayo.
        const medioX = ((arco.desde.x + arco.hasta.x) / 2 + entre(azar, -0.08, 0.08)) * ancho;
        const medioY = ((arco.desde.y + arco.hasta.y) / 2 + entre(azar, -0.08, 0.08)) * alto;
        ctx.lineTo(medioX, medioY);
        ctx.lineTo(arco.hasta.x * ancho, arco.hasta.y * alto);
        ctx.stroke();
      }
      ctx.restore();
    },
  };
}

// ────────────────────────────── COMPUTACION ──────────────────────────────

function codigo({ azar, presupuesto }) {
  const columnas = Array.from({ length: Math.min(presupuesto, 26) }, () => ({
    x: azar(),
    y: azar(),
    velocidad: entre(azar, 0.12, 0.4),
    largo: Math.floor(entre(azar, 4, 11)),
    letras: Array.from({ length: 12 }, () =>
      CARACTERES[Math.floor(azar() * CARACTERES.length)],
    ),
  }));

  let desdeElCambio = 0;

  return {
    actualizar(dt) {
      desdeElCambio += dt;
      const cambiar = desdeElCambio > 0.1;
      if (cambiar) desdeElCambio = 0;

      for (const columna of columnas) {
        columna.y += columna.velocidad * dt;
        if (columna.y > 1.2) {
          columna.y = -0.2;
          columna.x = azar();
        }
        if (cambiar) {
          const i = Math.floor(azar() * columna.letras.length);
          columna.letras[i] = CARACTERES[Math.floor(azar() * CARACTERES.length)];
        }
      }
    },

    dibujar(ctx, { ancho, alto, color }) {
      const tamano = Math.min(ancho, alto) * 0.028;
      ctx.save();
      ctx.font = `700 ${tamano}px "Consolas", monospace`;
      ctx.textAlign = 'center';
      ctx.fillStyle = color;

      for (const columna of columnas) {
        for (let i = 0; i < columna.largo; i++) {
          const y = (columna.y * alto) - i * tamano * 1.15;
          if (y < -tamano || y > alto + tamano) continue;
          ctx.globalAlpha = 0.75 * (1 - i / columna.largo);
          ctx.fillText(columna.letras[i % columna.letras.length], columna.x * ancho, y);
        }
      }
      ctx.restore();
    },
  };
}

// ───────────────────────── FISICO-MATEMATICA ─────────────────────────

function formulas({ azar, presupuesto }) {
  const simbolos = Array.from({ length: Math.min(presupuesto, 14) }, (_, i) => ({
    texto: SIMBOLOS[i % SIMBOLOS.length],
    angulo: azar() * TAU,
    velocidad: entre(azar, 0.25, 0.7) * (azar() < 0.5 ? -1 : 1),
    radio: entre(azar, 1.5, 3.2),
    achatado: entre(azar, 0.35, 0.7),
    inclinacion: azar() * Math.PI,
  }));

  return {
    actualizar(dt) {
      for (const simbolo of simbolos) simbolo.angulo += simbolo.velocidad * dt;
    },

    dibujar(ctx, { ancho, alto, color, rostro }) {
      // Orbitan la cabeza. Si no hay nadie, orbitan el centro de la pantalla.
      const centro = rostro?.centro ?? { x: ancho / 2, y: alto * 0.4 };
      const base = rostro?.radio ?? Math.min(ancho, alto) * 0.16;
      const tamano = Math.min(ancho, alto) * 0.038;

      ctx.save();
      ctx.font = `700 ${tamano}px "Cambria Math", Georgia, serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = tamano * 0.4;

      for (const simbolo of simbolos) {
        const rx = base * simbolo.radio;
        const ry = rx * simbolo.achatado;
        const cos = Math.cos(simbolo.inclinacion);
        const sen = Math.sin(simbolo.inclinacion);
        const px = Math.cos(simbolo.angulo) * rx;
        const py = Math.sin(simbolo.angulo) * ry;

        // Los que pasan por detras se ven mas tenues: da sensacion de orbita.
        ctx.globalAlpha = 0.35 + 0.5 * ((Math.sin(simbolo.angulo) + 1) / 2);
        ctx.fillText(simbolo.texto, centro.x + px * cos - py * sen, centro.y + px * sen + py * cos);
      }
      ctx.restore();
    },
  };
}

// ───────────────────────────────── CIVIL ─────────────────────────────────

function planos({ azar, presupuesto }) {
  const polvo = Array.from({ length: Math.min(presupuesto, 40) }, () => ({
    x: azar(),
    y: azar(),
    velocidad: entre(azar, 0.03, 0.12),
    deriva: entre(azar, -0.02, 0.02),
    tamano: entre(azar, 0.002, 0.006),
  }));

  let trazado = 0;

  return {
    actualizar(dt) {
      trazado = Math.min(1, trazado + dt * 0.35);
      for (const mota of polvo) {
        mota.y += mota.velocidad * dt;
        mota.x += mota.deriva * dt;
        if (mota.y > 1.05) {
          mota.y = -0.05;
          mota.x = azar();
        }
      }
    },

    dibujar(ctx, { ancho, alto, color }) {
      const corto = Math.min(ancho, alto);
      ctx.save();

      // Grilla de plano que se traza sola de izquierda a derecha.
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.18;
      ctx.lineWidth = Math.max(1, corto * 0.0025);
      const paso = corto * 0.09;

      for (let x = 0; x < ancho * trazado; x += paso) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, alto);
        ctx.stroke();
      }
      for (let y = 0; y < alto; y += paso) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(ancho * trazado, y);
        ctx.stroke();
      }

      ctx.globalAlpha = 0.45;
      ctx.fillStyle = '#e8dcc8';
      for (const mota of polvo) {
        ctx.fillRect(mota.x * ancho, mota.y * alto, mota.tamano * corto, mota.tamano * corto);
      }
      ctx.restore();
    },
  };
}

// ──────────────────────────────── QUIMICA ────────────────────────────────

function burbujas({ azar, presupuesto }) {
  const burbuja = () => ({
    x: azar(),
    y: 1 + azar() * 0.3,
    radio: entre(azar, 0.008, 0.032),
    velocidad: entre(azar, 0.08, 0.28),
    fase: azar() * TAU,
    vaiven: entre(azar, 0.01, 0.04),
  });

  const particulas = Array.from({ length: Math.min(presupuesto, 45) }, () => {
    const b = burbuja();
    b.y = azar();
    return b;
  });

  let tiempo = 0;

  return {
    actualizar(dt) {
      tiempo += dt;
      for (const b of particulas) {
        b.y -= b.velocidad * dt;
        if (b.y < -0.1) Object.assign(b, burbuja());
      }
    },

    dibujar(ctx, { ancho, alto, color }) {
      const corto = Math.min(ancho, alto);
      ctx.save();
      ctx.lineWidth = Math.max(1.5, corto * 0.003);

      for (const b of particulas) {
        const x = (b.x + Math.sin(tiempo * 1.4 + b.fase) * b.vaiven) * ancho;
        const y = b.y * alto;
        const r = b.radio * corto;

        ctx.globalAlpha = 0.3;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TAU);
        ctx.fill();

        ctx.globalAlpha = 0.6;
        ctx.strokeStyle = color;
        ctx.stroke();

        ctx.globalAlpha = 0.7;
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.22, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    },
  };
}

// ───────────────────────────────── registro ─────────────────────────────────

export const EFECTOS = { engranajes, chispas, codigo, formulas, planos, burbujas };

export const efectosDisponibles = () => Object.keys(EFECTOS);
export const hayEfecto = (tipo) => Boolean(EFECTOS[tipo]);

export function crearEfecto(tipo, { azar = Math.random, presupuesto = 60 } = {}) {
  const constructor = EFECTOS[tipo];
  return constructor ? constructor({ azar, presupuesto }) : null;
}
