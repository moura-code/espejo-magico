import { cargarVision } from './vision.js';

function acotar(valor, minimo, maximo) {
  return Math.max(minimo, Math.min(maximo, valor));
}

export function convertirConfianzaEnPixeles(
  confianza,
  { umbral = 0.18, suavidad = 0.24 } = {},
) {
  const pixeles = new Uint8ClampedArray(confianza.length * 4);
  const amplitud = Math.max(Number.EPSILON, suavidad);

  for (let indice = 0; indice < confianza.length; indice++) {
    const alfa = Math.round(
      acotar((confianza[indice] - umbral) / amplitud, 0, 1) * 255,
    );
    const pixel = indice * 4;
    pixeles[pixel] = 255;
    pixeles[pixel + 1] = 255;
    pixeles[pixel + 2] = 255;
    pixeles[pixel + 3] = alfa;
  }

  return pixeles;
}

export function crearSegmentadorDePersona({
  segmentadorCrudo,
  umbral,
  suavidad,
  crearLienzo = () => document.createElement('canvas'),
  crearImagen = (pixeles, ancho, alto) =>
    new ImageData(pixeles, ancho, alto),
}) {
  const lienzo = crearLienzo();
  const contexto = lienzo.getContext('2d');
  let disponible = false;

  function copiarMascara(mascara) {
    if (!mascara) {
      disponible = false;
      return;
    }

    const confianza = mascara.getAsFloat32Array();
    const pixeles = convertirConfianzaEnPixeles(confianza, {
      umbral,
      suavidad,
    });

    if (lienzo.width !== mascara.width || lienzo.height !== mascara.height) {
      lienzo.width = mascara.width;
      lienzo.height = mascara.height;
    }
    contexto.putImageData(
      crearImagen(pixeles, mascara.width, mascara.height),
      0,
      0,
    );
    disponible = true;
  }

  return {
    detectar(video, ahora) {
      segmentadorCrudo.segmentForVideo(video, ahora, (resultado) => {
        copiarMascara(resultado.confidenceMasks?.[0]);
        resultado.close?.();
      });
      return disponible ? lienzo : null;
    },

    obtener: () => (disponible ? lienzo : null),

    reiniciar() {
      contexto.clearRect(0, 0, lienzo.width, lienzo.height);
      disponible = false;
    },

    cerrar() {
      segmentadorCrudo.close();
    },
  };
}

export async function crearSegmentadorMediaPipe({
  base,
  umbral,
  suavidad,
}) {
  const { modulo, recursos } = await cargarVision(base);
  const segmentadorCrudo = await modulo.ImageSegmenter.createFromOptions(
    recursos,
    {
      baseOptions: {
        modelAssetPath: `${base}/selfie_segmenter_landscape.tflite`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    },
  );

  return crearSegmentadorDePersona({
    segmentadorCrudo,
    umbral,
    suavidad,
  });
}
