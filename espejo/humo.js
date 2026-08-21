// El humo que entra cuando alguien se sienta.
//
// Es un video blanco sobre negro que se compone en `screen`: el negro
// desaparece solo y no hace falta canal alfa, que el mp4 no tiene. Lo unico que
// vive aca es CUANTO humo hay en cada momento; dibujarlo es tarea de escena.js.
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
 * y los objetos se ponen en su lugar— y se disipa ya dentro de la ELECCION,
 * descubriendolos. La entrada es mas lenta que la salida a proposito: entrar
 * despacio se lee como algo que llega, salir rapido devuelve el control.
 */
export function alfaDeHumo({ estado, transcurrido, tiempos, humo }) {
  switch (estado) {
    case ESTADOS.HUMO: {
      const entrada = Math.max(1, tiempos.humo * humo.fraccionDeEntrada);
      return suavizar(transcurrido / entrada);
    }
    case ESTADOS.ELECCION:
      return 1 - suavizar(transcurrido / Math.max(1, humo.msDeSalida));
    default:
      return 0;
  }
}

/**
 * Carga el video y lo deja andando en loop, mudo y sin sonido, listo para
 * dibujarse en cualquier momento. Un video que arranca recien cuando hace falta
 * llega tarde: el primer medio segundo de humo seria un cuadro negro.
 */
export function cargarVideoDelNavegador(ruta) {
  return new Promise((ok, falla) => {
    const video = document.createElement('video');
    video.src = ruta;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.oncanplaythrough = () => {
      video.play().catch(() => {});
      ok(video);
    };
    video.onerror = () => falla(new Error(`No se pudo cargar ${ruta}`));
    video.load();
  });
}
