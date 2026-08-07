// Las nubes cubren el espejo en reposo y se apartan hacia los costados cuando
// llega una persona. La transicion tiene una sola magnitud (`apertura`): no hay
// mascaras, agujeros ni fundidos que puedan convertirla en un circulo.

import { ESTADOS } from './maquina-estados.js';

const acotar = (valor) => Math.min(1, Math.max(0, valor));
const suavizar = (valor) => {
  const t = acotar(valor);
  return t * t * (3 - 2 * t);
};
const progreso = (transcurrido, duracion) => suavizar(transcurrido / Math.max(1, duracion));

export function objetivoDeNiebla(estado) {
  return estado === ESTADOS.ATRACCION || estado === ESTADOS.CIERRE
    ? { apertura: 0 }
    : { apertura: 1 };
}

export function acercarNiebla(actual, objetivo, dt, velocidades) {
  const delta = objetivo.apertura - actual.apertura;
  const velocidad = delta >= 0 ? velocidades.abrir : velocidades.cerrar;
  const pasoMaximo = velocidad * dt;

  return {
    apertura:
      Math.abs(delta) <= pasoMaximo
        ? objetivo.apertura
        : acotar(actual.apertura + Math.sign(delta) * pasoMaximo),
  };
}

/**
 * Interpola cada nube entre su posicion de reposo y el borde exterior que le
 * corresponde. Con apertura 1 el circulo completo queda fuera del lienzo.
 */
export function posicionLateralNube(xNormalizada, radio, ancho, apertura, lado) {
  const origen = xNormalizada * ancho;
  const destino = lado < 0 ? -radio : ancho + radio;
  const t = acotar(apertura);
  return origen + (destino - origen) * t;
}

/** Coordina efecto, accesorio y textos sin cambiar la apertura lateral. */
export function calcularTransicionEscena({ estado, transcurrido, tiempos }) {
  switch (estado) {
    case ESTADOS.ATRACCION:
      return { efecto: 0, contenido: 0 };
    case ESTADOS.ENGANCHE:
      return { efecto: progreso(transcurrido, tiempos.enganche) * 0.4, contenido: 0 };
    case ESTADOS.SORTEO:
      return { efecto: 0.4 + progreso(transcurrido, tiempos.sorteo) * 0.6, contenido: 0 };
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
      // El lado queda fijado al crear el jiron. Asi nunca cambia de direccion
      // aunque su movimiento de reposo cruce el centro de la pantalla.
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

    actualizar(dt, agitacion = 1) {
      tiempo += dt * agitacion;
      for (const jiron of jirones) {
        jiron.x += jiron.velocidad * dt * agitacion;

        // Cada jiron circula solo por su mitad para conservar el sentido de la
        // apertura. Los margenes evitan apariciones bruscas sobre los bordes.
        if (jiron.lado < 0) {
          if (jiron.x < -0.3) jiron.x = 0.5;
          else if (jiron.x > 0.5) jiron.x = -0.3;
        } else if (jiron.x < 0.5) jiron.x = 1.3;
        else if (jiron.x > 1.3) jiron.x = 0.5;
      }
    },

    dibujar(ctx, disposicion, { apertura }) {
      if (apertura >= 1) return;
      const { ancho, alto } = disposicion;

      ctx.save();

      for (const jiron of jirones) {
        const radio = jiron.radio * Math.max(ancho, alto) * 0.6;
        const x = posicionLateralNube(jiron.x, radio, ancho, apertura, jiron.lado);
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
