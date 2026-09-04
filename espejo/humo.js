// El humo que entra cuando alguien se sienta.
//
// Es un video blanco sobre negro que se compone en `screen`: el negro
// desaparece solo y no hace falta canal alfa, que el mp4 no tiene. Lo unico que
// vive aca es CUANTO humo hay en cada momento; dibujarlo es tarea de escena.js.
//
// Cargar el video es tarea de videos.js, que es donde vive todo lo que sabe de
// videos en el navegador.
//
// Es un agregado opcional, como las manos y la pose: si el archivo falta o el
// navegador no lo puede reproducir, el espejo arranca igual y lo unico que se
// pierde es la transicion. Nunca una pantalla en negro con publico delante.

import { ESTADOS } from './maquina-estados.js';

const acotar = (valor) => Math.min(1, Math.max(0, valor));
const suavizar = (valor) => {
  const t = acotar(valor);
  return t * t * (3 - 2 * t);
};

/**
 * Cuanto humo hay, de 0 a 1.
 *
 * Se espesa mientras dura el HUMO —tapando el momento en que las nubes se abren
 * y los objetos se ponen en su lugar— y se disipa ya dentro de la EXPLORACION,
 * descubriendolos. La entrada es mas lenta que la salida a proposito: entrar
 * despacio se lee como algo que llega, salir rapido devuelve el control.
 */
export function alfaDeHumo({ estado, transcurrido, tiempos, humo }) {
  switch (estado) {
    // EL ESPEJO DESCANSA CUBIERTO DE HUMO. Es lo que ve la fila mientras espera,
    // y respira para que no se lea como una pantalla congelada. Nunca llega a
    // tapar: por debajo se tiene que adivinar que hay un espejo.
    case ESTADOS.ATRACCION: {
      const asentado = suavizar(transcurrido / Math.max(1, humo.msParaAsentarse ?? 1));
      const respiro =
        0.5 + 0.5 * Math.sin((transcurrido / Math.max(1, humo.msDeRespiro ?? 1)) * Math.PI * 2);
      return (humo.enReposo ?? 0) * asentado * (0.7 + 0.3 * respiro);
    }

    case ESTADOS.HUMO: {
      const entrada = Math.max(1, tiempos.humo * humo.fraccionDeEntrada);
      return suavizar(transcurrido / entrada);
    }
    case ESTADOS.EXPLORACION:
      return 1 - suavizar(transcurrido / Math.max(1, humo.msDeSalida));
    default:
      return 0;
  }
}
