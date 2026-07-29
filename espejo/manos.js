// Deteccion de manos. Mismo molde que rostro.js: entra un cuadro, sale una lista
// de manos en pixeles de pantalla, y nada mas. No sabe que es una carrera ni que
// existe la fisica.
//
//   { palma: {x,y}, radio, apertura, largoPalma, puntas: [{x,y} x5], lado }
//
// EL RADIO SALE DE LA GEOMETRIA, NO DE CONSTANTES.
// Es el alcance promedio de las cinco puntas de los dedos desde el centro de la
// palma. Con el puño cerrado las puntas estan cerca y el circulo es chico; con la
// mano abierta se alejan y el circulo crece. No hay ningun umbral que calibrar, y
// funciona igual con manos de adulto y de chico.

import { cargarVision } from './vision.js';

// Muñeca y los cuatro nudillos: el centro de la palma es su promedio.
const PALMA = [0, 5, 9, 13, 17];
const PUNTAS = [4, 8, 12, 16, 20];
const MUNECA = 0;
const NUDILLO_MEDIO = 9;

const distancia = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

export function mapearMano(
  puntos,
  {
    x = 0,
    y = 0,
    ancho,
    alto,
    espejar = true,
    // Generosos a proposito: es mas facil disfrutar un circulo que perdona que
    // uno exacto que te hace errar. Se ajustan desde config.js sin tocar codigo.
    factorRadio = 1.4,
    radioMinimoEnPalmas = 1.0,
  },
) {
  if (!puntos || puntos.length < 21) return null;

  const aPantalla = (punto) => ({
    x: x + (espejar ? 1 - punto.x : punto.x) * ancho,
    y: y + punto.y * alto,
  });

  const enPalma = PALMA.map((i) => aPantalla(puntos[i]));
  const palma = {
    x: enPalma.reduce((suma, p) => suma + p.x, 0) / enPalma.length,
    y: enPalma.reduce((suma, p) => suma + p.y, 0) / enPalma.length,
  };

  // Referencia de escala estable: no cambia al abrir o cerrar los dedos, asi que
  // sirve para saber que tan cerca de la camara esta la mano.
  const largoPalma = distancia(aPantalla(puntos[MUNECA]), aPantalla(puntos[NUDILLO_MEDIO]));
  if (largoPalma === 0) return null;

  const puntas = PUNTAS.map((i) => aPantalla(puntos[i]));
  const alcance = puntas.reduce((suma, p) => suma + distancia(palma, p), 0) / puntas.length;

  return {
    palma,
    largoPalma,
    puntas,
    radio: Math.max(alcance * factorRadio, largoPalma * radioMinimoEnPalmas),
    // Cerca de 1 con el puño cerrado, 2 o mas con la mano bien abierta.
    apertura: alcance / largoPalma,
  };
}

export function crearDetectorDeManos({ detectorCrudo, maximo = 2, ...ajustes }) {
  let ultimas = [];
  let crudasDetectadas = 0;

  return {
    detectar(video, ahora, rectangulo) {
      if (!video.videoWidth) {
        crudasDetectadas = 0;
        return (ultimas = []);
      }

      const salida = detectorCrudo.detectForVideo(video, ahora);
      const crudas = salida?.landmarks ?? [];
      crudasDetectadas = crudas.length;

      ultimas = crudas
        .slice(0, maximo)
        .map((puntos, i) => {
          const mano = mapearMano(puntos, { ...rectangulo, ...ajustes, espejar: true });
          if (!mano) return null;

          // El lado sirve de identidad para seguirle la velocidad a cada mano.
          // MediaPipe cambio el nombre del campo entre versiones: se aceptan los
          // dos, y si no viene ninguno se cae al indice.
          const lados = salida?.handedness ?? salida?.handednesses;
          mano.lado = lados?.[i]?.[0]?.categoryName ?? `mano${i}`;
          mano.puntos = puntos;
          return mano;
        })
        .filter(Boolean);

      return ultimas;
    },

    // Cuantas manos vio MediaPipe antes de mapearlas. Si esto da 0 el problema
    // es de deteccion; si da 2 y en pantalla no pasa nada, es de mapeo.
    crudasDetectadas: () => crudasDetectadas,
    ultimas: () => ultimas,
    cerrar: () => detectorCrudo.close(),
  };
}

export async function crearDetectorDeManosMediaPipe({ base, maximo = 2, ...ajustes }) {
  const { modulo, recursos } = await cargarVision(base);

  const detectorCrudo = await modulo.HandLandmarker.createFromOptions(recursos, {
    baseOptions: { modelAssetPath: `${base}/hand_landmarker.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: maximo,
    // Umbrales bajos a proposito: en un stand la mano suele estar de costado,
    // parcialmente fuera de cuadro o mal iluminada. Preferimos una deteccion
    // imperfecta a ninguna.
    minHandDetectionConfidence: 0.3,
    minHandPresenceConfidence: 0.3,
    minTrackingConfidence: 0.3,
  });

  return crearDetectorDeManos({ detectorCrudo, maximo, ...ajustes });
}
