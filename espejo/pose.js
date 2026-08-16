// Deteccion de pose y silueta. El modelo entrega hombros como landmarks y, si
// se habilita, una mascara de segmentacion de la persona completa.

import { cargarVision } from './vision.js';

const HOMBRO_IZQ = 11;
const HOMBRO_DER = 12;

function aPantalla(punto, rect, espejar) {
  return {
    x: rect.x + (espejar ? 1 - punto.x : punto.x) * rect.ancho,
    y: rect.y + punto.y * rect.alto,
  };
}

export function mapearPose(puntos, mascara, { x = 0, y = 0, ancho, alto, espejar = true }) {
  if (!puntos || puntos.length <= HOMBRO_DER) return null;

  const rect = { x, y, ancho, alto };
  const hombroA = puntos[HOMBRO_IZQ];
  const hombroB = puntos[HOMBRO_DER];
  if (!hombroA || !hombroB) return null;

  const [hombroIzq, hombroDer] = [aPantalla(hombroA, rect, espejar), aPantalla(hombroB, rect, espejar)]
    .sort((a, b) => a.x - b.x);

  return {
    hombroIzq,
    hombroDer,
    centroHombros: {
      x: (hombroIzq.x + hombroDer.x) / 2,
      y: (hombroIzq.y + hombroDer.y) / 2,
    },
    anchoHombros: Math.hypot(hombroDer.x - hombroIzq.x, hombroDer.y - hombroIzq.y),
    mascara: mascara ?? null,
  };
}

export function crearDetectorDePose({ detectorCrudo, segmentacion = true }) {
  let ultima = null;
  let ultimaMascara = null;
  let crudasDetectadas = 0;

  return {
    detectar(fuente, ahora, rectangulo) {
      // `fuente` es el lienzo con el recorte visible, no el <video>: un lienzo
      // no tiene videoWidth.
      if (!(fuente.videoWidth || fuente.width)) {
        ultimaMascara?.close?.();
        ultimaMascara = null;
        crudasDetectadas = 0;
        ultima = null;
        return null;
      }

      const salida = detectorCrudo.detectForVideo(fuente, ahora);
      const puntos = salida?.landmarks?.[0];
      const mascara = segmentacion ? salida?.segmentationMasks?.[0] : null;
      const mascaraPropia = mascara?.clone ? mascara.clone() : mascara;
      if (mascaraPropia !== ultimaMascara) ultimaMascara?.close?.();
      ultimaMascara = mascaraPropia ?? null;
      crudasDetectadas = salida?.landmarks?.length ?? 0;
      ultima = mapearPose(puntos, ultimaMascara, { ...rectangulo, espejar: true });
      salida?.close?.();
      return ultima;
    },

    crudasDetectadas: () => crudasDetectadas,
    ultima: () => ultima,
    cerrar() {
      ultimaMascara?.close?.();
      detectorCrudo.close();
    },
  };
}

export async function crearDetectorDePoseMediaPipe({ base, segmentacion = true }) {
  const { modulo, recursos } = await cargarVision(base);

  const detectorCrudo = await modulo.PoseLandmarker.createFromOptions(recursos, {
    baseOptions: { modelAssetPath: `${base}/pose_landmarker_full.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numPoses: 1,
    outputSegmentationMasks: segmentacion,
    minPoseDetectionConfidence: 0.25,
    minPosePresenceConfidence: 0.25,
    minTrackingConfidence: 0.25,
  });

  return crearDetectorDePose({ detectorCrudo, segmentacion });
}
