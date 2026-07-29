import { crearAlmacenDeMascara } from './segmentacion.js';
import { cargarVision } from './vision.js';

export const INDICES_POSE = Object.freeze({
  nariz: 0,
  hombroA: 11,
  hombroB: 12,
  codoA: 13,
  codoB: 14,
  munecaA: 15,
  munecaB: 16,
  caderaA: 23,
  caderaB: 24,
});

const distancia = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

function promedio(...puntos) {
  const validos = puntos.filter(Boolean);
  if (validos.length === 0) return null;
  return {
    x: validos.reduce((suma, punto) => suma + punto.x, 0) / validos.length,
    y: validos.reduce((suma, punto) => suma + punto.y, 0) / validos.length,
  };
}

function armarPose(puntos, crudos = null) {
  if (!puntos?.some(Boolean)) return null;
  const hombroA = puntos[INDICES_POSE.hombroA];
  const hombroB = puntos[INDICES_POSE.hombroB];
  const caderaA = puntos[INDICES_POSE.caderaA];
  const caderaB = puntos[INDICES_POSE.caderaB];

  return {
    puntos,
    crudos,
    centroHombros: promedio(hombroA, hombroB),
    centroCaderas: promedio(caderaA, caderaB),
    anchoHombros:
      hombroA && hombroB ? distancia(hombroA, hombroB) : 0,
  };
}

export function mapearPose(
  puntos,
  {
    x = 0,
    y = 0,
    ancho,
    alto,
    espejar = true,
    visibilidadMinima = 0.45,
  },
) {
  if (!puntos?.length || !(ancho > 0) || !(alto > 0)) return null;

  const mapeados = puntos.map((punto) => {
    const visibilidad = punto.visibility ?? 1;
    const presencia = punto.presence ?? 1;
    if (
      !Number.isFinite(punto.x) ||
      !Number.isFinite(punto.y) ||
      visibilidad < visibilidadMinima ||
      presencia < visibilidadMinima
    ) {
      return null;
    }

    return {
      x: x + (espejar ? 1 - punto.x : punto.x) * ancho,
      y: y + punto.y * alto,
      z: punto.z ?? 0,
      visibilidad,
      presencia,
    };
  });

  return armarPose(mapeados, puntos);
}

export function crearFiltroPose({ alfa = 0.28, cuadrosDeGracia = 4 } = {}) {
  const anteriores = [];
  const faltantes = [];
  let ausencias = 0;
  let ultimaPose = null;

  return {
    filtrar(pose) {
      if (!pose) {
        ausencias += 1;
        return ausencias <= cuadrosDeGracia ? ultimaPose : null;
      }
      ausencias = 0;
      const puntos = pose.puntos.map((punto, indice) => {
        if (!punto) {
          faltantes[indice] = (faltantes[indice] ?? 0) + 1;
          return faltantes[indice] <= cuadrosDeGracia
            ? anteriores[indice] ?? null
            : null;
        }

        faltantes[indice] = 0;
        const anterior = anteriores[indice];
        const filtrado = anterior
          ? {
              ...punto,
              x: anterior.x + alfa * (punto.x - anterior.x),
              y: anterior.y + alfa * (punto.y - anterior.y),
              z: anterior.z + alfa * (punto.z - anterior.z),
            }
          : { ...punto };
        anteriores[indice] = filtrado;
        return filtrado;
      });

      ultimaPose = armarPose(puntos, pose.crudos);
      return ultimaPose;
    },

    reiniciar() {
      anteriores.length = 0;
      faltantes.length = 0;
      ausencias = 0;
      ultimaPose = null;
    },
  };
}

function puntoSintetico(x, y) {
  return { x, y, z: 0, visibilidad: 1, presencia: 1 };
}

export function crearPoseSintetica(rostro, manos = [], disposicion = {}) {
  if (!rostro?.centro || !(rostro.radio > 0)) return null;

  const puntos = Array.from({ length: 33 }, () => null);
  const radio = rostro.radio;
  const centro = rostro.centro;
  const hombrosY = centro.y + radio * 1.18;
  const caderasY = Math.min(
    disposicion.piso ?? disposicion.alto ?? centro.y + radio * 3.4,
    centro.y + radio * 3.05,
  );
  const hombroA = puntoSintetico(centro.x - radio * 1.08, hombrosY);
  const hombroB = puntoSintetico(centro.x + radio * 1.08, hombrosY);
  const caderaA = puntoSintetico(centro.x - radio * 0.72, caderasY);
  const caderaB = puntoSintetico(centro.x + radio * 0.72, caderasY);
  const manosOrdenadas = [...manos].sort((a, b) => a.palma.x - b.palma.x);
  const munecaA =
    manosOrdenadas[0]?.palma ??
    puntoSintetico(centro.x - radio * 1.55, hombrosY + radio * 1.25);
  const munecaB =
    manosOrdenadas.at(-1)?.palma ??
    puntoSintetico(centro.x + radio * 1.55, hombrosY + radio * 1.25);

  puntos[0] = puntoSintetico(centro.x, centro.y + radio * 0.14);
  puntos[7] = puntoSintetico(centro.x - radio * 0.54, centro.y + radio * 0.16);
  puntos[8] = puntoSintetico(centro.x + radio * 0.54, centro.y + radio * 0.16);
  puntos[11] = hombroA;
  puntos[12] = hombroB;
  puntos[13] = puntoSintetico(
    hombroA.x + (munecaA.x - hombroA.x) * 0.52,
    hombroA.y + (munecaA.y - hombroA.y) * 0.48 - radio * 0.18,
  );
  puntos[14] = puntoSintetico(
    hombroB.x + (munecaB.x - hombroB.x) * 0.52,
    hombroB.y + (munecaB.y - hombroB.y) * 0.48 - radio * 0.18,
  );
  puntos[15] = puntoSintetico(munecaA.x, munecaA.y);
  puntos[16] = puntoSintetico(munecaB.x, munecaB.y);
  puntos[23] = caderaA;
  puntos[24] = caderaB;

  return armarPose(puntos);
}

function capsula(desde, hasta, radio, velocidad, nombre) {
  if (!desde || !hasta || !(radio > 0)) return null;
  return {
    tipo: 'capsula',
    desde,
    hasta,
    radio,
    vx: velocidad.vx ?? 0,
    vy: velocidad.vy ?? 0,
    nombre,
  };
}

export function crearColisionadoresPersona({
  rostro,
  pose,
  velocidadRostro = {},
  velocidadCuerpo = {},
  radioHombros = 0.11,
  radioBrazos = 0.075,
} = {}) {
  const colisionadores = [];

  if (rostro?.centro && rostro.radio > 0) {
    colisionadores.push(
      capsula(
        {
          x: rostro.centro.x,
          y: rostro.centro.y - rostro.radio * 0.2,
        },
        {
          x: rostro.centro.x,
          y: rostro.centro.y + rostro.radio * 0.28,
        },
        rostro.radio * 0.78,
        velocidadRostro,
        'rostro',
      ),
    );
  }

  const puntos = pose?.puntos;
  const hombroA = puntos?.[INDICES_POSE.hombroA];
  const hombroB = puntos?.[INDICES_POSE.hombroB];
  if (!hombroA || !hombroB) return colisionadores.filter(Boolean);

  const anchoHombros = Math.max(1, distancia(hombroA, hombroB));
  colisionadores.push(
    capsula(
      hombroA,
      hombroB,
      anchoHombros * radioHombros,
      velocidadCuerpo,
      'hombros',
    ),
  );

  let caderaA = puntos[INDICES_POSE.caderaA];
  let caderaB = puntos[INDICES_POSE.caderaB];
  if (!caderaA || !caderaB) {
    const centroHombros = promedio(hombroA, hombroB);
    caderaA = {
      x: centroHombros.x + (hombroA.x - centroHombros.x) * 0.72,
      y: centroHombros.y + anchoHombros * 1.45,
    };
    caderaB = {
      x: centroHombros.x + (hombroB.x - centroHombros.x) * 0.72,
      y: centroHombros.y + anchoHombros * 1.45,
    };
  }

  colisionadores.push({
    tipo: 'poligono',
    puntos: [hombroA, hombroB, caderaB, caderaA],
    vx: velocidadCuerpo.vx ?? 0,
    vy: velocidadCuerpo.vy ?? 0,
    nombre: 'torso',
  });

  for (const [hombro, codo, muneca, nombre] of [
    [
      INDICES_POSE.hombroA,
      INDICES_POSE.codoA,
      INDICES_POSE.munecaA,
      'brazo-a',
    ],
    [
      INDICES_POSE.hombroB,
      INDICES_POSE.codoB,
      INDICES_POSE.munecaB,
      'brazo-b',
    ],
  ]) {
    const puntoHombro = puntos[hombro];
    const puntoCodo = puntos[codo];
    const puntoMuneca = puntos[muneca];
    colisionadores.push(
      capsula(
        puntoHombro,
        puntoCodo,
        anchoHombros * radioBrazos,
        velocidadCuerpo,
        `${nombre}-superior`,
      ),
      capsula(
        puntoCodo,
        puntoMuneca,
        anchoHombros * radioBrazos * 0.86,
        velocidadCuerpo,
        `${nombre}-inferior`,
      ),
    );
  }

  return colisionadores.filter(Boolean);
}

export function crearDetectorPose({
  detectorCrudo,
  visibilidadMinima,
  umbralMascara,
  suavidadMascara,
  crearLienzo,
  crearImagen,
}) {
  const almacen = crearAlmacenDeMascara({
    umbral: umbralMascara,
    suavidad: suavidadMascara,
    crearLienzo,
    crearImagen,
  });
  let ultima = null;
  let ultimosCrudos = null;

  return {
    detectar(video, ahora, rectangulo) {
      if (!video.videoWidth) {
        ultima = null;
        return null;
      }

      detectorCrudo.detectForVideo(video, ahora, (resultado) => {
        const puntos = resultado.landmarks?.[0] ?? null;
        ultimosCrudos = puntos;
        ultima = mapearPose(puntos, {
          ...rectangulo,
          espejar: true,
          visibilidadMinima,
        });
        almacen.copiar(resultado.segmentationMasks?.[0]);
        resultado.close?.();
      });

      return ultima;
    },

    mascara: almacen.obtener,
    puntosCrudos: () => ultimosCrudos,

    reiniciar() {
      ultima = null;
      ultimosCrudos = null;
      almacen.reiniciar();
    },

    cerrar() {
      detectorCrudo.close();
    },
  };
}

export async function crearDetectorPoseMediaPipe({
  base,
  minDeteccion = 0.35,
  minPresencia = 0.35,
  minSeguimiento = 0.35,
  ...ajustes
}) {
  const { modulo, recursos } = await cargarVision(base);
  const detectorCrudo = await modulo.PoseLandmarker.createFromOptions(
    recursos,
    {
      baseOptions: {
        modelAssetPath: `${base}/pose_landmarker_lite.task`,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: minDeteccion,
      minPosePresenceConfidence: minPresencia,
      minTrackingConfidence: minSeguimiento,
      outputSegmentationMasks: true,
    },
  );

  return crearDetectorPose({ detectorCrudo, ...ajustes });
}
