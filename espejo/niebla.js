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
 *   objetos    el carrusel de los que se ofrecen. Aparecen tapados por el humo
 *              y se apagan en cuanto la persona agarra el suyo.
 *   elegido    el objeto agarrado: el que vuela y despues se queda apoyado en
 *              el fondo. Va aparte de `objetos` justamente porque sobrevive al
 *              carrusel — es lo unico que queda de el.
 *   fondo      la imagen de la ingenieria detras de la persona.
 *   contenido  el nombre de la ingenieria, al pie.
 *   vuelo      el objeto agarrado, de su ranura (0) a su lugar en el fondo (1).
 *   escondidos los otros objetos de la carrera, integrados al fondo. Entran
 *              cuando el elegido ya aterrizo: primero se sigue el vuelo.
 *   explorar   la consigna que enseña a pasar la mano sobre ellos. Espera a la
 *              escena entera y se va para siempre al abrirse la primera ficha.
 *
 * `desdeLaMirada` es hace cuanto se muestra la ingenieria, o null si todavia no
 * hay ninguna. Es un reloj propio, distinto del del estado: la ingenieria
 * aparece sin que el estado haya cambiado. Como se elige una sola vez, tambien
 * es lo que dice si la eleccion sigue abierta. `desdeElDescubrimiento` es hace
 * cuanto se abrio la primera ficha de la sesion, o null si todavia ninguna.
 */
export function calcularTransicionEscena({
  estado,
  transcurrido,
  desdeLaMirada,
  desdeElDescubrimiento = null,
  tiempos,
}) {
  // Lo que vive en el fondo de la ingenieria ya elegida. Tiene sus propios
  // relojes, los dos de la mirada: por eso se calcula aparte y el cierre lo
  // reusa tal como estaba, para apagarlo desde ahi y no desde otro lado.
  const delFondo = () => {
    if (desdeLaMirada === null) return { escondidos: 0, explorar: 0 };
    const entra = progreso(desdeLaMirada - tiempos.aparicion, tiempos.escondidos);
    const sale =
      desdeElDescubrimiento === null ? 0 : progreso(desdeElDescubrimiento, tiempos.escondidos);
    return {
      escondidos: progreso(desdeLaMirada - tiempos.vuelo, tiempos.escondidos),
      explorar: entra * (1 - sale),
    };
  };

  // Las capas de la exploracion con la ingenieria ya elegida, en este momento.
  const conLaMirada = () => {
    const t = progreso(desdeLaMirada, tiempos.aparicion);
    const vuelo = progreso(desdeLaMirada, tiempos.vuelo);
    return { objetos: 1 - vuelo, elegido: 1, fondo: t, contenido: t, vuelo, ...delFondo() };
  };

  // Todas las capas, apagadas salvo las que se pidan. En el reposo y en el
  // enganche no se ve ninguna: la invitacion no es una capa de la escena, la
  // sigue un desvanecedor (suavizado.js), como a las nubes, para que siga desde
  // donde este aunque el estado rebote entre los dos.
  const capas = (encendidas) => ({
    objetos: 0,
    elegido: 0,
    fondo: 0,
    contenido: 0,
    vuelo: 0,
    escondidos: 0,
    explorar: 0,
    ...encendidas,
  });

  switch (estado) {
    // Los objetos se encienden en la segunda mitad del humo. Estan puestos
    // desde el principio del estado, pero encenderlos antes de que el humo
    // este espeso los deja verse a traves y arruina la aparicion.
    case ESTADOS.HUMO:
      return capas({ objetos: progreso(transcurrido - tiempos.humo / 2, tiempos.humo / 2) });

    // EL CARRUSEL SE APAGA AL ELEGIR, y es lo que dice que la eleccion se
    // termino: se elige una sola vez, asi que dejar los objetos puestos seria
    // ofrecer algo que ya no se puede agarrar. Se van con el mismo plazo que
    // dura el vuelo, de manera que el carrusel termina de vaciarse justo cuando
    // el objeto elegido aterriza en su lugar: se lee como que todo lo demas se
    // aparto para dejarlo pasar.
    //
    // El elegido no se va con ellos: vuela a su lugar y se queda ahi, entero,
    // hasta el final de la sesion.
    case ESTADOS.EXPLORACION:
      return desdeLaMirada === null ? capas({ objetos: 1 }) : capas(conLaMirada());

    // EL CIERRE ARRANCA DESDE DONDE QUEDO LA EXPLORACION y se apaga desde ahi.
    // Sin eleccion, lo unico que habia era el carrusel. Con eleccion, cada capa
    // sigue su propio reloj multiplicada por la salida: si el cierre llega en
    // pleno vuelo —el tope de sesion, un ESPACIO en manual— el objeto termina
    // de volar mientras se apaga, en vez de saltar a su lugar con el fondo
    // entero; y el carrusel, si ya estaba apagado, no se enciende para
    // apagarse otra vez, ni la consigna de explorar vuelve para despedirse.
    case ESTADOS.CIERRE: {
      const salida = 1 - progreso(transcurrido, tiempos.cierre);
      if (desdeLaMirada === null) return capas({ objetos: salida });
      const quedo = conLaMirada();
      return capas({
        objetos: quedo.objetos * salida,
        elegido: quedo.elegido * salida,
        fondo: quedo.fondo * salida,
        contenido: quedo.contenido * salida,
        vuelo: quedo.vuelo,
        escondidos: quedo.escondidos * salida,
        explorar: quedo.explorar * salida,
      });
    }

    default:
      return capas({});
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
