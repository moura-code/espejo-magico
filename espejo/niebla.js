// La niebla del sorteo y el agujero de la revelacion.
//
// `cobertura` es cuanta niebla hay. `revelado` es cuanto se abrio el agujero
// alrededor de la cara. Separarlos deja que la revelacion se anime sin que la
// niebla desaparezca de golpe.

import { ESTADOS } from './maquina-estados.js';

const acotar = (valor) => Math.min(1, Math.max(0, valor));

export function calcularNiebla({ estado, transcurrido, tiempos }) {
  switch (estado) {
    case ESTADOS.ATRACCION:
      return { cobertura: 1, revelado: 0 };
    case ESTADOS.ENGANCHE:
      return {
        cobertura: 1 - acotar(transcurrido / tiempos.enganche),
        revelado: acotar(transcurrido / tiempos.enganche),
      };
    case ESTADOS.SORTEO:
      return { cobertura: 0, revelado: 1 };
    case ESTADOS.REVELACION:
    case ESTADOS.ESCENA:
      return { cobertura: 0, revelado: 1 };
    case ESTADOS.CIERRE:
      return {
        cobertura: acotar(transcurrido / tiempos.cierre),
        revelado: 0,
      };
    default:
      return { cobertura: 0, revelado: 0 };
  }
}

export function crearNiebla({ cantidad, azar = Math.random }) {
  const jirones = Array.from({ length: cantidad }, () => ({
    x: azar(),
    y: azar(),
    radio: 0.18 + azar() * 0.28,
    velocidad: (azar() - 0.5) * 0.06,
    fase: azar() * Math.PI * 2,
  }));

  let tiempo = 0;

  return {
    jirones: () => jirones,

    actualizar(dt) {
      tiempo += dt;
      for (const jiron of jirones) {
        jiron.x += jiron.velocidad * dt;
        // Se envuelven a los costados. Los limites son mas anchos que la
        // pantalla para que un jiron no aparezca de la nada en el borde.
        if (jiron.x < -0.3) jiron.x = 1.3;
        else if (jiron.x > 1.3) jiron.x = -0.3;
      }
    },

    dibujar(ctx, disposicion, { cobertura, revelado, centro }) {
      if (cobertura <= 0) return;
      const { ancho, alto } = disposicion;

      ctx.save();
      ctx.globalAlpha = cobertura;

      for (const jiron of jirones) {
        const x = jiron.x * ancho;
        const y = (jiron.y + Math.sin(tiempo * 0.4 + jiron.fase) * 0.02) * alto;
        const radio = jiron.radio * Math.max(ancho, alto) * 0.6;

        const degradado = ctx.createRadialGradient(x, y, 0, x, y, radio);
        degradado.addColorStop(0, 'rgba(232,240,255,0.55)');
        degradado.addColorStop(1, 'rgba(232,240,255,0)');
        ctx.fillStyle = degradado;
        ctx.beginPath();
        ctx.arc(x, y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      // El agujero borra la niebla ya dibujada en vez de pintar encima. Por eso
      // la niebla va en su propia capa: asi el borrado no toca el video ni los
      // objetos que estan debajo.
      if (revelado > 0 && centro) {
        const maximo = Math.hypot(ancho, alto);
        const radio = Math.pow(revelado, 0.7) * maximo;

        ctx.globalCompositeOperation = 'destination-out';
        const agujero = ctx.createRadialGradient(
          centro.x,
          centro.y,
          radio * 0.6,
          centro.x,
          centro.y,
          radio,
        );
        agujero.addColorStop(0, 'rgba(0,0,0,1)');
        agujero.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = agujero;
        ctx.beginPath();
        ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
  };
}
