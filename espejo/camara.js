// La camara del espejo. Dos piezas separadas a proposito:
//
//   abrirCamara       toca el DOM, no se prueba en Node
//   crearReintentador logica pura de reintento, si se prueba
//
// El reintento es lo que hace que el dia del evento nadie tenga que ir a tocar
// nada: si alguien patea el cable USB, la pantalla sigue mostrando la invitacion
// y se recupera sola al enchufarlo de nuevo.

export const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

/**
 * Avisa una sola vez cuando el flujo se corta: un cable pateado, un dispositivo
 * desconectado. Es lo que despierta al reintentador; sin esto el espejo se
 * queda mirando una camara muerta hasta que alguien recargue la pagina.
 */
export function vigilarFlujo(flujo, alPerder) {
  let avisado = false;
  const avisar = () => {
    if (avisado) return;
    avisado = true;
    alPerder();
  };

  for (const pista of flujo.getTracks()) pista.addEventListener('ended', avisar);
  return avisar;
}

export async function abrirCamara({ ancho, alto, obtenerMedia, alPerder = () => {} }) {
  const flujo = await obtenerMedia({
    video: { width: { ideal: ancho }, height: { ideal: alto }, facingMode: 'user' },
    audio: false,
  });

  vigilarFlujo(flujo, alPerder);

  const video = document.createElement('video');
  video.srcObject = flujo;
  video.playsInline = true;
  video.muted = true;
  await video.play();

  return { video, detener: () => flujo.getTracks().forEach((pista) => pista.stop()) };
}

export function crearReintentador({ abrir, reintentoMs, alEstado, dormir: esperar = dormir }) {
  let actual = null;
  let vivo = true;
  let enCurso = null;

  function intentar() {
    enCurso = (async () => {
      while (vivo && !actual) {
        try {
          const camara = await abrir();
          if (!vivo) {
            // Se detuvo mientras la camara estaba abriendo. Soltarla igual:
            // si no, el led queda prendido y el dispositivo ocupado.
            camara.detener();
            return;
          }
          actual = camara;
          alEstado({ lista: true });
        } catch (error) {
          alEstado({ lista: false, error: String(error) });
          await esperar(reintentoMs);
        }
      }
    })();
    return enCurso;
  }

  intentar();

  return {
    listo: () => enCurso,
    obtener: () => actual,

    perdida() {
      actual = null;
      alEstado({ lista: false, error: 'camara perdida' });
      intentar();
    },

    detener() {
      vivo = false;
      actual?.detener();
      actual = null;
    },
  };
}
