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
 * ES UNA SOLA NIEBLA QUE SE ESPESA Y SE ABRE UNA VEZ. Al detectar a la persona
 * el humo del reposo no se va: empieza a espesarse en el ENGANCHE, termina de
 * tapar en el HUMO —con las nubes todavia puestas y los objetos poniendose en
 * su lugar debajo— y se disipa ya dentro de la EXPLORACION, junto con las nubes
 * que se apartan, descubriendolos. Antes se cortaba en el enganche y volvia a
 * entrar desde cero, y se leia como que las nubes se iban y volvian. La entrada
 * es mas lenta que la salida a proposito: entrar despacio se lee como algo que
 * llega, salir rapido devuelve el control.
 *
 * Es la curva de cada estado; lo que se ve la sigue con acercarHumo, que es lo
 * que la hace continua cuando el estado cambia a mitad de camino.
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

    // Del humo del reposo hasta `enEnganche`, mientras se confirma que la
    // persona se quedo. Si el enganche se estira —un rostro que va y viene—
    // no pasa de ahi.
    case ESTADOS.ENGANCHE: {
      const reposo = humo.enReposo ?? 0;
      const tope = humo.enEnganche ?? reposo;
      return reposo + (tope - reposo) * suavizar(transcurrido / Math.max(1, tiempos.enganche));
    }

    // Desde donde lo dejo el enganche hasta tapar todo.
    case ESTADOS.HUMO: {
      const desde = humo.enEnganche ?? 0;
      const entrada = Math.max(1, tiempos.humo * humo.fraccionDeEntrada);
      return desde + (1 - desde) * suavizar(transcurrido / entrada);
    }
    case ESTADOS.EXPLORACION:
      return 1 - suavizar(transcurrido / Math.max(1, humo.msDeSalida));
    default:
      return 0;
  }
}

/**
 * El humo que se ve, un paso mas cerca de `objetivo` (alfaDeHumo), sin moverse
 * mas de `velocidad` por segundo. Las curvas de cada estado ya son suaves, y
 * con la velocidad de la config se siguen sin atrasarse; lo que esto evita son
 * los saltos de una a otra cuando el estado cambia a mitad de camino: alguien
 * que se va en pleno enganche, o una sesion que se corta con el humo espeso. El
 * humo va desde donde estaba, en vez de cortarse. `dt` en segundos.
 */
export function acercarHumo(actual, objetivo, dt, velocidad) {
  const paso = velocidad * Math.max(0, dt);
  const delta = objetivo - actual;
  return Math.abs(delta) <= paso ? objetivo : actual + Math.sign(delta) * paso;
}
