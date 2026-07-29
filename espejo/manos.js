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

function transformarPuntosSinteticos(puntos, { centro, escala, angulo, espejar }) {
  const centroLocal = PALMA.reduce(
    (suma, indice) => ({
      x: suma.x + puntos[indice].x / PALMA.length,
      y: suma.y + puntos[indice].y / PALMA.length,
    }),
    { x: 0, y: 0 },
  );
  const coseno = Math.cos(angulo);
  const seno = Math.sin(angulo);

  return puntos.map((punto) => {
    const localX = (punto.x - centroLocal.x) * escala * (espejar ? -1 : 1);
    const localY = (punto.y - centroLocal.y) * escala;
    return {
      x: centro.x + localX * coseno - localY * seno,
      y: centro.y + localX * seno + localY * coseno,
    };
  });
}

function crearPuntosDeMano({ centro, escala, angulo, apertura, espejar }) {
  const puntos = Array.from({ length: 21 });
  puntos[0] = { x: 0, y: 0.92 };

  const pulgarX = [-0.16, -0.38, -0.62, -0.84];
  const pulgarY = [0.42, 0.25, 0.04, -0.17];
  for (let indice = 1; indice <= 4; indice++) {
    puntos[indice] = { x: pulgarX[indice - 1], y: pulgarY[indice - 1] * apertura };
  }

  const dedos = [
    { indice: 5, x: -0.34, largo: 1.03, curva: -0.08 },
    { indice: 9, x: -0.11, largo: 1.2, curva: -0.02 },
    { indice: 13, x: 0.13, largo: 1.12, curva: 0.035 },
    { indice: 17, x: 0.35, largo: 0.94, curva: 0.1 },
  ];
  for (const dedo of dedos) {
    for (let articulacion = 0; articulacion < 4; articulacion++) {
      const progreso = articulacion / 3;
      puntos[dedo.indice + articulacion] = {
        x: dedo.x + dedo.curva * progreso,
        y: -dedo.largo * apertura * progreso,
      };
    }
  }

  return transformarPuntosSinteticos(puntos, { centro, escala, angulo, espejar });
}

function armarManoSintetica({ lado, centro, escala, angulo, apertura, espejar }) {
  const puntosPantalla = crearPuntosDeMano({ centro, escala, angulo, apertura, espejar });
  const palma = {
    x: PALMA.reduce((suma, indice) => suma + puntosPantalla[indice].x, 0) / PALMA.length,
    y: PALMA.reduce((suma, indice) => suma + puntosPantalla[indice].y, 0) / PALMA.length,
  };
  const puntas = PUNTAS.map((indice) => puntosPantalla[indice]);
  const largoPalma = distancia(puntosPantalla[MUNECA], puntosPantalla[NUDILLO_MEDIO]);
  const alcance =
    puntas.reduce((suma, punta) => suma + distancia(palma, punta), 0) / puntas.length;

  return {
    palma,
    largoPalma,
    puntas,
    radio: alcance * 1.35,
    apertura: alcance / largoPalma,
    lado,
    puntosPantalla,
  };
}

function acercarManoAObjetivo(mano, objetivo) {
  if (!objetivo) return mano;
  const progreso = Math.max(0, Math.min(1, objetivo.progreso ?? 1));
  const dx = (objetivo.x - mano.palma.x) * progreso;
  const dy = (objetivo.y - mano.palma.y) * progreso;
  const trasladar = (punto) => ({ x: punto.x + dx, y: punto.y + dy });

  return {
    ...mano,
    palma: trasladar(mano.palma),
    puntas: mano.puntas.map(trasladar),
    puntosPantalla: mano.puntosPantalla.map(trasladar),
  };
}

export function crearFuenteDeManosSinteticas() {
  return {
    detectar(
      ahora,
      { ancho, alto, unidad = Math.min(ancho, alto * 0.5625) },
      { objetivoDerecha = null } = {},
    ) {
      const tiempo = ahora / 1000;
      const escala = unidad * 0.085;

      const manos = [
        armarManoSintetica({
          lado: 'sintetica-izquierda',
          centro: {
            x: ancho * (0.28 + Math.sin(tiempo * 0.73) * 0.075),
            y: alto * (0.59 + Math.cos(tiempo * 0.61) * 0.055),
          },
          escala,
          angulo: -0.28 + Math.sin(tiempo * 0.47) * 0.24,
          apertura: 0.88 + Math.sin(tiempo * 1.1) * 0.08,
          espejar: false,
        }),
        armarManoSintetica({
          lado: 'sintetica-derecha',
          centro: {
            x: ancho * (0.72 + Math.cos(tiempo * 0.69) * 0.075),
            y: alto * (0.6 + Math.sin(tiempo * 0.57) * 0.055),
          },
          escala,
          angulo: 0.28 + Math.cos(tiempo * 0.43) * 0.24,
          apertura: 0.88 + Math.cos(tiempo * 1.03) * 0.08,
          espejar: true,
        }),
      ];

      manos[1] = acercarManoAObjetivo(manos[1], objetivoDerecha);
      return manos;
    },
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
