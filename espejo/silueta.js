// Convierte la mascara de segmentacion de MediaPipe en algo que el lienzo pueda
// usar para recortar: una imagen blanca cuyo CANAL ALFA dice cuanto de persona
// hay en cada pixel.
//
// Hace falta esta traduccion porque la mascara viene como una confianza por
// pixel, sin alfa: dibujada tal cual, `destination-in` la ve opaca en todos
// lados y no recorta nada. Con el alfa puesto, recortar la persona del espejo
// para meter el fondo de la carrera atras es una sola operacion del lienzo.
//
// LA CONFIANZA NO VA DIRECTO AL ALFA. Lo que el modelo no sabe si es persona
// —el respaldo de la silla, el marco de una ventana, la mesa— no le sale ni 0
// ni 1: le sale 0,2 en una mascara y 0,8 en la siguiente. Usada tal cual, es
// la sala real a medio dibujar detras de la persona, parpadeando veinte veces
// por segundo. Medido con un video de una persona sentada: de cada mil pixeles,
// treinta iban y volvian entre una mascara y la siguiente. Con los dos pasos de
// aca, dos. En este orden:
//
// - Donde el modelo duda, la confianza se mezcla con la de la mascara anterior
//   (`incertidumbre`). Es lo que hacia MediaPipe en su API vieja
//   (`smoothSegmentation`) y que el PoseLandmarker de la nueva no expone. Lo
//   seguro pasa de inmediato: una mano que entra o sale no deja estela.
// - Despues, contraste (`curvaDeRecorte`): lo que el modelo vio a medias no se
//   dibuja, la persona es entera y el borde sigue suave —un borde duro delata
//   el truco, uno difuso se lee como profundidad—. Sola, sin la mezcla, la
//   curva agranda el parpadeo del borde en vez de sacarlo.
//
// Y antes de los dos, si llega, una segunda opinion (segmentador.js): de cada
// pixel se toma lo menos que den por persona la pose y el segmentador selfie.
// Lo que la pose se lleva con confianza alta —el marco de la ventana pegado al
// pelo, los papeles de la mesa— ningun suavizado lo saca; el selfie si.

// El polinomio con el que MediaPipe aproxima cuanto duda una confianza
// (segmentation_smoothing_calculator.cc): 1 en 0,5 y 0 en las puntas.
const C1 = 5.68842;
const C2 = -0.748699;
const C3 = -57.8051;
const C4 = 291.309;
const C5 = -624.717;

/** Cuanto duda el modelo de un pixel con esta confianza: de 0 a 1. */
export function incertidumbre(confianza) {
  const t = confianza - 0.5;
  const x = t * t;
  return 1 - Math.min(1, x * (C1 + x * (C2 + x * (C3 + x * (C4 + x * C5)))));
}

/** Un escalon suave: 0 hasta `transparenteHasta`, 1 desde `opacaDesde`. */
export function curvaDeRecorte(confianza, transparenteHasta, opacaDesde) {
  const t = Math.min(
    1,
    Math.max(0, (confianza - transparenteHasta) / (opacaDesde - transparenteHasta)),
  );
  return t * t * (3 - 2 * t);
}

// Las dos cuentas de cada pixel van tabuladas: hechas en cada uno, con un
// millon de pixeles veinte veces por segundo, costaban el triple.
const PASOS = 1024;

/**
 * Para cada confianza, cuanto se queda de la mascara anterior (`retener`) y que
 * alfa le toca (`alfa`). Se arma una sola vez.
 */
export function tabularRecorte({ mezcla, transparenteHasta, opacaDesde }) {
  const retener = new Float32Array(PASOS + 1);
  const alfa = new Uint8ClampedArray(PASOS + 1);
  for (let k = 0; k <= PASOS; k++) {
    const confianza = k / PASOS;
    retener[k] = incertidumbre(confianza) * mezcla;
    alfa[k] = Math.round(255 * curvaDeRecorte(confianza, transparenteHasta, opacaDesde));
  }
  return { retener, alfa };
}

/**
 * Escribe en el canal alfa de `destino` (RGBA) cuanto de persona hay en cada
 * pixel. El color no lo toca: lo pone una sola vez quien crea la imagen.
 *
 * `confirmacion` es la segunda opinion (segmentador.js): de cada pixel se toma
 * lo que los dos dan por persona, el menor. Sin segunda opinion es la
 * confianza misma.
 *
 * `suavizada` trae la confianza suavizada de la mascara anterior y se queda con
 * la de esta. Para no mezclar con nada —la primera mascara, o la que sigue a un
 * corte— basta con copiarle antes la confianza confirmada.
 *
 * La confianza va de 0 a 1, como la entrega MediaPipe. No se acota pixel por
 * pixel a proposito: costaba tanto como todo lo demas junto.
 *
 * Se separa del lienzo a proposito: es la parte que se puede probar sin
 * navegador, y es donde estaria el error si la silueta saliera invertida.
 */
export function alfaDesdeConfianza(
  confianza,
  destino,
  suavizada,
  { retener, alfa },
  confirmacion = confianza,
) {
  for (let i = 0, j = 3; i < suavizada.length; i++, j += 4) {
    let p = confianza[i];
    const q = confirmacion[i];
    if (q < p) p = q;
    p += (suavizada[i] - p) * retener[(p * PASOS + 0.5) | 0];
    suavizada[i] = p;
    destino[j] = alfa[(p * PASOS + 0.5) | 0];
  }
  return destino;
}

// Para saber si la segunda opinion vio a la persona alcanza con mirar uno de
// cada siete pixeles. Siete y no ocho: un paso que divide al ancho mira
// siempre la misma columna.
const PASO_DE_CONTROL = 7;

/**
 * Que parte de lo que la pose ve como persona ve tambien `confirmacion`: de 0 a
 * 1. Sin persona en la pose no hay nada que desmentir, y da 1.
 */
export function fraccionConfirmada(confianza, confirmacion) {
  let vista = 0;
  let confirmada = 0;
  for (let i = 0; i < confianza.length; i += PASO_DE_CONTROL) {
    const p = confianza[i];
    const q = confirmacion[i];
    vista += p;
    confirmada += q < p ? q : p;
  }
  return vista > 0 ? confirmada / vista : 1;
}

/**
 * `crearLienzo` se inyecta para poder probar esto sin DOM. En el navegador es
 * `() => document.createElement('canvas')`. `mezcla`, `transparenteHasta`,
 * `opacaDesde` y `confirmacionMinima` son los de CONFIG.silueta.
 */
export function crearSilueta({
  crearLienzo,
  medir = (_nombre, fn) => fn(),
  mezcla,
  transparenteHasta,
  opacaDesde,
  confirmacionMinima = 0,
}) {
  const lienzo = crearLienzo();
  const ctx = lienzo.getContext('2d');
  const tablas = tabularRecorte({ mezcla, transparenteHasta, opacaDesde });
  let imagen = null;
  let suavizada = null;
  // Si `suavizada` es de la mascara anterior o hay que arrancar de cero.
  let conAnterior = false;

  /** La segunda mascara en flotantes, o null si no llego o no calza. */
  const leerConfirmacion = (confirmacion, ancho, alto) => {
    if (!confirmacion?.getAsFloat32Array) return null;
    if (confirmacion.width !== ancho || confirmacion.height !== alto) return null;
    try {
      const datos = medir('selfieRead', () => confirmacion.getAsFloat32Array());
      return datos?.length === ancho * alto ? datos : null;
    } catch {
      return null;
    }
  };

  return {
    /**
     * Devuelve el lienzo con la silueta lista para recortar, o null si no hay
     * mascara. El lienzo se reusa entre cuadros: crear uno nuevo por cuadro es
     * basura para el recolector cada 50 ms.
     *
     * `confirmacion` es la mascara del segmentador selfie del mismo cuadro, o
     * null: sin ella, o si no sirve, la silueta sale de la pose sola.
     *
     * Nunca lanza. Una mascara ya cerrada por MediaPipe —pasa cuando la pose se
     * pierde justo entre dos cuadros— tiene que degradar a "no hay silueta", no
     * tirar el bucle de dibujo entero. Y corta la mezcla: lo que se venia
     * suavizando queda de otro momento.
     */
    actualizar(mascara, confirmacion = null) {
      let confianza = null;
      if (mascara?.getAsFloat32Array) {
        try {
          // En flotantes y no en bytes: pasarla a bytes la hace MediaPipe en
          // JavaScript, y era lo mas caro de todo el recorte.
          confianza = medir('maskRead', () => mascara.getAsFloat32Array());
        } catch {
          confianza = null;
        }
      }

      const ancho = mascara?.width;
      const alto = mascara?.height;
      if (!confianza || !ancho || !alto || confianza.length !== ancho * alto) {
        conAnterior = false;
        return null;
      }

      // Si la segunda opinion no ve a la persona —un cuadro que falla, mala
      // luz—, intersecar la borraria entera y quedaria el fondo sin nadie
      // adelante: ahi se le cree a la pose sola.
      const segunda = leerConfirmacion(confirmacion, ancho, alto);
      const confirmada =
        segunda && fraccionConfirmada(confianza, segunda) >= confirmacionMinima
          ? segunda
          : confianza;

      if (lienzo.width !== ancho || lienzo.height !== alto) {
        lienzo.width = ancho;
        lienzo.height = alto;
        imagen = null;
      }
      if (!imagen) {
        imagen = ctx.createImageData(ancho, alto);
        // Blanca de una vez: de ahi en mas solo cambia el alfa.
        imagen.data.fill(255);
        suavizada = new Float32Array(ancho * alto);
        conAnterior = false;
      }
      if (!conAnterior) {
        for (let i = 0; i < suavizada.length; i++) {
          suavizada[i] = Math.min(confianza[i], confirmada[i]);
        }
      }

      medir('maskConvert', () => {
        alfaDesdeConfianza(confianza, imagen.data, suavizada, tablas, confirmada);
        ctx.putImageData(imagen, 0, 0);
      });
      conAnterior = true;
      return lienzo;
    },

    /** La proxima mascara arranca de cero, sin mezclarse con la ultima. */
    reiniciar() {
      conAnterior = false;
    },

    lienzo: () => lienzo,
  };
}
