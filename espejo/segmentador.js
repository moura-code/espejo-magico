// La segunda opinion sobre que es persona: el segmentador "selfie" de MediaPipe.
//
// La mascara de la pose se lleva lo que la persona tiene pegado —el marco de
// una ventana junto al pelo, los papeles de la mesa— con confianza alta, y eso
// ningun suavizado lo saca. El segmentador selfie, entrenado con gente sentada
// frente a una camara, lo deja afuera. Pero solo no sirve: recorta a TODAS las
// personas del cuadro —la fila de atras quedaria pegada sobre el fondo de la
// ingenieria— y en el espejo vertical se lleva la mesa entera. Por eso no
// reemplaza a la pose, la confirma: silueta.js se queda, pixel por pixel, con
// lo que los dos dan por persona.
//
// Es un agregado opcional, como las manos: si no carga, o falla en un cuadro,
// la silueta sale de la pose sola.

import { cargarVision, crearConRespaldoEnCPU } from './vision.js';

export function crearSegmentador({ segmentadorCrudo }) {
  // El cuadro anterior. Sus mascaras viven en la GPU y hay que cerrarlas, pero
  // recien cuando llega el siguiente: la silueta lee la de este cuadro despues.
  let ultimo = null;
  let avisado = false;

  const soltar = () => {
    ultimo?.close?.();
    ultimo = null;
  };

  return {
    /**
     * La mascara de persona de este cuadro, o null. Vale hasta la proxima
     * llamada. `fuente` es el lienzo con el recorte visible, el mismo que ve la
     * pose: asi las dos mascaras caen pixel sobre pixel.
     *
     * Nunca lanza: un cuadro que falla deja la silueta en manos de la pose.
     */
    detectar(fuente, ahora) {
      soltar();
      if (!(fuente?.videoWidth || fuente?.width)) return null;

      try {
        ultimo = segmentadorCrudo.segmentForVideo(fuente, ahora);
      } catch (error) {
        if (!avisado) {
          avisado = true;
          console.warn('El segmentador selfie falló; la silueta sale de la pose sola:', error);
        }
        return null;
      }

      // El modelo selfie trae un solo canal, la persona. Uno que trajera fondo
      // y persona la pone ultima.
      return ultimo?.confidenceMasks?.at(-1) ?? null;
    },

    cerrar() {
      soltar();
      segmentadorCrudo.close?.();
    },
  };
}

export async function crearSegmentadorMediaPipe({ base }) {
  const { modulo, recursos } = await cargarVision(base);

  const segmentadorCrudo = await crearConRespaldoEnCPU(
    (opciones) => modulo.ImageSegmenter.createFromOptions(recursos, opciones),
    {
      baseOptions: { modelAssetPath: `${base}/selfie_segmenter.tflite` },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    },
  );

  return crearSegmentador({ segmentadorCrudo });
}
