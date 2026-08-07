// La niebla que cubre el reposo y se abre hacia los costados.
//
// `cobertura` controla la opacidad y `desplazamiento` cuanto se alejaron los
// jirones hacia su borde mas cercano. Separarlos evita que la niebla aparezca o
// desaparezca como un simple fundido.

import { ESTADOS } from './maquina-estados.js';

const acotar = (valor) => Math.min(1, Math.max(0, valor));
const suavizar = (valor) => {
  const t = acotar(valor);
  return t * t * (3 - 2 * t);
};

const progreso = (transcurrido, duracion) => suavizar(transcurrido / Math.max(1, duracion));

export function calcularNiebla({ estado, transcurrido, tiempos }) {
  switch (estado) {
    case ESTADOS.ATRACCION:
      return { cobertura: 1, desplazamiento: 0 };
    case ESTADOS.ENGANCHE:
      {
        const apertura = progreso(transcurrido, tiempos.enganche);
        return {
          cobertura: 1 - apertura,
          desplazamiento: apertura,
        };
      }
    case ESTADOS.SORTEO:
      return { cobertura: 0, desplazamiento: 1 };
    case ESTADOS.REVELACION:
    case ESTADOS.ESCENA:
      return { cobertura: 0, desplazamiento: 1 };
    case ESTADOS.CIERRE:
      {
        const cierre = progreso(transcurrido, tiempos.cierre);
        return { cobertura: cierre, desplazamiento: 1 - cierre };
      }
    default:
      return { cobertura: 0, desplazamiento: 1 };
  }
}

export function posicionLateralNube(
  xNormalizada,
  radio,
  ancho,
  desplazamiento,
  lado = xNormalizada < 0.5 ? -1 : 1,
) {
  const base = xNormalizada * ancho;
  return base + lado * acotar(desplazamiento) * (ancho * 0.65 + radio);
}

/** Coordina la entrada y salida del efecto, el accesorio y los textos. */
export function calcularTransicionEscena({ estado, transcurrido, tiempos }) {
  switch (estado) {
    case ESTADOS.ATRACCION:
      return { efecto: 0, contenido: 0 };
    case ESTADOS.ENGANCHE:
      return {
        efecto: progreso(transcurrido, tiempos.enganche) * 0.4,
        contenido: 0,
      };
    case ESTADOS.SORTEO:
      return {
        efecto: 0.4 + progreso(transcurrido, tiempos.sorteo) * 0.6,
        contenido: 0,
      };
    case ESTADOS.REVELACION:
      return { efecto: 1, contenido: progreso(transcurrido, tiempos.revelacion) };
    case ESTADOS.ESCENA:
      return { efecto: 1, contenido: 1 };
    case ESTADOS.CIERRE: {
      const salida = 1 - progreso(transcurrido, tiempos.cierre);
      return { efecto: salida, contenido: salida };
    }
    default:
      return { efecto: 0, contenido: 0 };
  }
}

export function crearNiebla({ cantidad, azar = Math.random }) {
  const jirones = Array.from({ length: cantidad }, () => {
    const x = azar();
    return {
      x,
      lado: x < 0.5 ? -1 : 1,
      y: azar(),
      radio: 0.18 + azar() * 0.28,
      velocidad: (azar() - 0.5) * 0.06,
      fase: azar() * Math.PI * 2,
    };
  });

  let tiempo = 0;

  return {
    jirones: () => jirones,

    actualizar(dt) {
      tiempo += dt;
      for (const jiron of jirones) {
        jiron.x += jiron.velocidad * dt;
        // Cada jiron permanece en su mitad para que nunca cambie de direccion
        // en medio de una entrada o salida lateral.
        if (jiron.lado < 0) {
          if (jiron.x < -0.3) jiron.x = 0.5;
          else if (jiron.x > 0.5) jiron.x = -0.3;
        } else if (jiron.x < 0.5) jiron.x = 1.3;
        else if (jiron.x > 1.3) jiron.x = 0.5;
      }
    },

    dibujar(ctx, disposicion, { cobertura, desplazamiento = 0 }) {
      if (cobertura <= 0) return;
      const { ancho, alto } = disposicion;

      ctx.save();
      ctx.globalAlpha = cobertura;

      for (const jiron of jirones) {
        const radio = jiron.radio * Math.max(ancho, alto) * 0.6;
        const x = posicionLateralNube(jiron.x, radio, ancho, desplazamiento, jiron.lado);
        const y = (jiron.y + Math.sin(tiempo * 0.4 + jiron.fase) * 0.02) * alto;

        const degradado = ctx.createRadialGradient(x, y, 0, x, y, radio);
        degradado.addColorStop(0, 'rgba(232,240,255,0.55)');
        degradado.addColorStop(1, 'rgba(232,240,255,0)');
        ctx.fillStyle = degradado;
        ctx.beginPath();
        ctx.arc(x, y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
  };
}
