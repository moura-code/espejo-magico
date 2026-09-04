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

/**
 * Cuanto se ve de cada capa en cada momento, sin tocar la apertura lateral de
 * las nubes:
 *
 *   objetos   el carrusel de los que se ofrecen. Aparecen tapados por el humo
 *             y se apagan en cuanto la persona agarra el suyo.
 *   elegido   el objeto agarrado: el que vuela y despues se queda apoyado en
 *             el fondo. Va aparte de `objetos` justamente porque sobrevive al
 *             carrusel — es lo unico que queda de el.
 *   fondo     la imagen de la ingenieria detras de la persona.
 *   contenido el nombre de la ingenieria, al pie.
 *   vuelo     el objeto agarrado, de su ranura (0) a su lugar en el fondo (1).
 *
 * `desdeLaMirada` es hace cuanto se muestra la ingenieria, o null si todavia no
 * hay ninguna. Es un reloj propio, distinto del del estado: la ingenieria
 * aparece sin que el estado haya cambiado. Como se elige una sola vez, tambien
 * es lo que dice si la eleccion sigue abierta.
 */
export function calcularTransicionEscena({ estado, transcurrido, desdeLaMirada, tiempos }) {
  switch (estado) {
    case ESTADOS.ATRACCION:
    case ESTADOS.ENGANCHE:
      return { objetos: 0, elegido: 0, fondo: 0, contenido: 0, vuelo: 0 };

    // Los objetos se encienden en la segunda mitad del humo. Estan puestos
    // desde el principio del estado, pero encenderlos antes de que el humo
    // este espeso los deja verse a traves y arruina la aparicion.
    case ESTADOS.HUMO:
      return {
        objetos: progreso(transcurrido - tiempos.humo / 2, tiempos.humo / 2),
        elegido: 0,
        fondo: 0,
        contenido: 0,
        vuelo: 0,
      };

    // EL CARRUSEL SE APAGA AL ELEGIR, y es lo que dice que la eleccion se
    // termino: se elige una sola vez, asi que dejar los objetos puestos seria
    // ofrecer algo que ya no se puede agarrar. Se van con el mismo plazo que
    // dura el vuelo, de manera que el carrusel termina de vaciarse justo cuando
    // el objeto elegido aterriza en su lugar: se lee como que todo lo demas se
    // aparto para dejarlo pasar.
    //
    // El elegido no se va con ellos: vuela a su lugar y se queda ahi, entero,
    // hasta el final de la sesion.
    case ESTADOS.EXPLORACION: {
      if (desdeLaMirada === null) {
        return { objetos: 1, elegido: 0, fondo: 0, contenido: 0, vuelo: 0 };
      }
      const t = progreso(desdeLaMirada, tiempos.aparicion);
      const vuelo = progreso(desdeLaMirada, tiempos.vuelo);
      return { objetos: 1 - vuelo, elegido: 1, fondo: t, contenido: t, vuelo };
    }

    // En el cierre el objeto elegido ya esta apoyado: se desvanece con todo lo
    // demas. El carrusel solo tiene algo que desvanecer si la persona se fue
    // sin elegir; si ya habia elegido estaba apagado, y encenderlo para
    // apagarlo otra vez seria un parpadeo en el ultimo segundo.
    case ESTADOS.CIERRE: {
      const salida = 1 - progreso(transcurrido, tiempos.cierre);
      return {
        objetos: desdeLaMirada === null ? salida : 0,
        elegido: salida,
        fondo: salida,
        contenido: salida,
        vuelo: 1,
      };
    }

    default:
      return { objetos: 0, elegido: 0, fondo: 0, contenido: 0, vuelo: 0 };
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
