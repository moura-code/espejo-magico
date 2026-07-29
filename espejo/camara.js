// La camara del espejo. Tres piezas separadas a proposito:
//
//   abrirCamara            abre y cierra el stream del navegador
//   crearSelectorDeCamara  recuerda y alterna el dispositivo
//   crearReintentador      recupera la captura cuando algo falla
//
// El reintento es lo que hace que el dia del evento nadie tenga que ir a tocar
// nada: si alguien patea el cable USB, la pantalla sigue mostrando la invitacion
// y se recupera sola al enchufarlo de nuevo.

export const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));

export async function abrirCamara({
  ancho,
  alto,
  obtenerMedia,
  dispositivoId = null,
  alPerderse = () => {},
  crearVideo = () => document.createElement('video'),
}) {
  const seleccion = dispositivoId
    ? { deviceId: { exact: dispositivoId } }
    : { facingMode: 'user' };
  const flujo = await obtenerMedia({
    video: { width: { ideal: ancho }, height: { ideal: alto }, ...seleccion },
    audio: false,
  });

  const pistas = flujo.getTracks();
  const pistaVideo =
    flujo.getVideoTracks?.()[0] ?? pistas.find((pista) => pista.kind === 'video') ?? null;
  let detenida = false;
  pistaVideo?.addEventListener?.(
    'ended',
    () => {
      if (!detenida) alPerderse();
    },
    { once: true },
  );

  const video = crearVideo();
  video.srcObject = flujo;
  video.playsInline = true;
  video.muted = true;
  try {
    await video.play();
  } catch (error) {
    pistas.forEach((pista) => pista.stop());
    throw error;
  }

  const ajustes = pistaVideo?.getSettings?.() ?? {};

  return {
    video,
    dispositivoId: ajustes.deviceId ?? dispositivoId,
    nombre: pistaVideo?.label || null,
    detener() {
      detenida = true;
      pistas.forEach((pista) => pista.stop());
    },
  };
}

export async function listarCamaras({ enumerarDispositivos }) {
  const dispositivos = await enumerarDispositivos();
  return dispositivos
    .filter((dispositivo) => dispositivo.kind === 'videoinput' && dispositivo.deviceId)
    .map((dispositivo, indice) => ({
      id: dispositivo.deviceId,
      nombre: dispositivo.label || `Camara ${indice + 1}`,
    }));
}

export function siguienteCamara(camaras, dispositivoActual) {
  if (camaras.length === 0) return null;
  const indiceActual = camaras.findIndex((camara) => camara.id === dispositivoActual);
  return camaras[(indiceActual + 1) % camaras.length];
}

export function crearSelectorDeCamara({
  abrir,
  enumerarDispositivos,
  seleccionGuardada = null,
  alGuardar = () => {},
}) {
  let seleccion = seleccionGuardada || null;

  async function disponibles() {
    return listarCamaras({ enumerarDispositivos });
  }

  function guardar(dispositivoId) {
    seleccion = dispositivoId;
    alGuardar(seleccion);
  }

  return {
    async abrir() {
      try {
        return await abrir(seleccion);
      } catch (error) {
        const seleccionDesaparecida =
          seleccion && ['NotFoundError', 'OverconstrainedError'].includes(error?.name);
        if (!seleccionDesaparecida) throw error;

        guardar(null);
        return abrir(null);
      }
    },

    async siguiente(dispositivoActual) {
      const camaras = await disponibles();
      const siguiente = siguienteCamara(camaras, dispositivoActual);
      if (!siguiente || siguiente.id === dispositivoActual) return null;

      guardar(siguiente.id);
      return siguiente;
    },

    async seleccionar(dispositivoId, dispositivoActual) {
      if (!dispositivoId || dispositivoId === dispositivoActual) return null;
      const camaras = await disponibles();
      const elegida = camaras.find((camara) => camara.id === dispositivoId);
      if (!elegida) throw new Error('La camara elegida ya no esta disponible');

      guardar(elegida.id);
      return elegida;
    },

    disponibles,
    seleccionada: () => seleccion,
  };
}

export function crearReintentador({ abrir, reintentoMs, alEstado, dormir: esperar = dormir }) {
  let actual = null;
  let vivo = true;
  let enCurso = null;
  let generacion = 0;

  function intentar() {
    const generacionDelIntento = generacion;
    enCurso = (async () => {
      while (vivo && generacionDelIntento === generacion && !actual) {
        try {
          const camara = await abrir();
          if (!vivo || generacionDelIntento !== generacion) {
            // Se detuvo mientras la camara estaba abriendo. Soltarla igual:
            // si no, el led queda prendido y el dispositivo ocupado.
            camara.detener();
            return;
          }
          actual = camara;
          alEstado({
            lista: true,
            ...(camara.nombre ? { nombre: camara.nombre } : {}),
            ...(camara.dispositivoId ? { dispositivoId: camara.dispositivoId } : {}),
          });
        } catch (error) {
          if (!vivo || generacionDelIntento !== generacion) return;
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
      generacion += 1;
      actual?.detener();
      actual = null;
      alEstado({ lista: false, error: 'camara perdida' });
      return intentar();
    },

    reabrir() {
      generacion += 1;
      actual?.detener();
      actual = null;
      alEstado({ lista: false, cambiando: true });
      return intentar();
    },

    detener() {
      vivo = false;
      generacion += 1;
      actual?.detener();
      actual = null;
    },
  };
}
