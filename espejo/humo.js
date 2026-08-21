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
 *
 * El tope no es una comodidad: es lo que hace verdadera la promesa de arriba.
 * Con la ventana tapada por otra —o minimizada— Chrome posterga la descarga del
 * video y no dispara ni `canplaythrough` ni `error`. El elemento se queda en
 * readyState 0 y la promesa no termina nunca, asi que el `await` de main.js
 * frena el arranque ANTES de la camara y de MediaPipe: la pantalla se queda en
 * "cargando..." con publico delante. Un agregado opcional no puede decidir si
 * el espejo arranca; si no contesta a tiempo, se sigue sin humo.
 */
export function cargarVideoDelNavegador(
  ruta,
  {
    msMaximos = 8000,
    crearVideo = () => document.createElement('video'),
    programar = (fn, ms) => setTimeout(fn, ms),
    cancelar = (id) => clearTimeout(id),
  } = {},
) {
  return new Promise((ok, falla) => {
    const video = crearVideo();
    let reloj;
    let terminado = false;

    // Una sola respuesta: despues del tope, un `canplaythrough` tardio llega a
    // un espejo que ya arranco sin humo y no tiene que revivir nada.
    const cerrar = (responder) => (valor) => {
      if (terminado) return;
      terminado = true;
      cancelar(reloj);
      video.oncanplaythrough = null;
      video.onerror = null;
      responder(valor);
    };

    const listo = cerrar((v) => ok(v));
    const fallar = cerrar((error) => falla(error));

    reloj = programar(
      () => fallar(new Error(`El video ${ruta} tardo demasiado en cargar`)),
      msMaximos,
    );

    video.src = ruta;
    video.loop = true;
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.oncanplaythrough = () => {
      video.play().catch(() => {});
      listo(video);
    };
    video.onerror = () => fallar(new Error(`No se pudo cargar ${ruta}`));
    video.load();
  });
}
