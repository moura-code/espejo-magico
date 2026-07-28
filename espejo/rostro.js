// Deteccion de rostro. Este archivo no sabe que es una carrera, ni que hay
// tablets, ni como se dibuja nada. Entra un cuadro de video, sale esto:
//
//   { presente, centro:{x,y}, ojoIzq:{x,y}, ojoDer:{x,y}, radio, angulo, confianza }
//
// o null. Si algun dia hay que cambiar de libreria, se cambia solo este archivo.

import { cargarVision } from './vision.js';

function promediar(puntos, indices, rect, espejar) {
  let sumaX = 0;
  let sumaY = 0;
  for (const indice of indices) {
    const punto = puntos[indice];
    if (!punto) return null;
    sumaX += espejar ? 1 - punto.x : punto.x;
    sumaY += punto.y;
  }
  return {
    x: rect.x + (sumaX / indices.length) * rect.ancho,
    y: rect.y + (sumaY / indices.length) * rect.alto,
  };
}

/**
 * `x` e `y` son el origen del rectangulo donde se dibuja el video, que puede
 * sobresalir del lienzo cuando la camara y la pantalla no tienen la misma
 * relacion de aspecto. Sin ellos, los puntos caerian sobre un rectangulo
 * distinto del que ve el visitante.
 */
export function mapearRostro(
  puntos,
  { x = 0, y = 0, ancho, alto, indices, factorRadio, espejar = true },
) {
  if (!puntos || puntos.length === 0) return null;

  const rect = { x, y, ancho, alto };
  const unoDeLosOjos = promediar(puntos, indices.ojoIzq, rect, espejar);
  const elOtro = promediar(puntos, indices.ojoDer, rect, espejar);
  if (!unoDeLosOjos || !elOtro) return null;

  // Ordenar por posicion en pantalla elimina de raiz la duda de cual indice de
  // MediaPipe es cual ojo: despues de espejar, el izquierdo es el que quedo a la
  // izquierda, y punto.
  const [ojoIzq, ojoDer] =
    unoDeLosOjos.x <= elOtro.x ? [unoDeLosOjos, elOtro] : [elOtro, unoDeLosOjos];

  const dx = ojoDer.x - ojoIzq.x;
  const dy = ojoDer.y - ojoIzq.y;
  const distancia = Math.hypot(dx, dy);

  return {
    presente: true,
    centro: { x: (ojoIzq.x + ojoDer.x) / 2, y: (ojoIzq.y + ojoDer.y) / 2 },
    ojoIzq,
    ojoDer,
    radio: distancia * factorRadio,
    angulo: Math.atan2(dy, dx),
    confianza: 1,
  };
}

/**
 * El modelo con iris entrega 478 puntos; los cuatro del anillo de cada iris dan
 * el centro exacto de la pupila. Si algun modelo entregara menos, se cae a las
 * esquinas de los parpados, que son menos precisas pero siempre estan.
 */
export function elegirIndices(cantidadDePuntos, { conIris, sinIris }) {
  return cantidadDePuntos >= 478 ? conIris : sinIris;
}

export function crearMedidorConfianza(ventana) {
  const lecturas = [];
  return {
    registrar(huboRostro) {
      lecturas.push(huboRostro ? 1 : 0);
      if (lecturas.length > ventana) lecturas.shift();
    },
    valor() {
      if (lecturas.length === 0) return 0;
      return lecturas.reduce((a, b) => a + b, 0) / lecturas.length;
    },
  };
}

/**
 * Rostro simulado que se mueve solo. Sirve para desarrollar la escena, la fisica
 * y el anclaje sin estar sentado frente a la webcam, para que varias personas
 * trabajen en paralelo con una sola camara, y para el modo demo del stand.
 */
export function crearFuenteSintetica() {
  return {
    detectar(ahora, { ancho, alto }) {
      const t = ahora / 1000;
      const centro = {
        x: ancho / 2 + Math.sin(t * 0.7) * ancho * 0.18,
        y: alto * 0.38 + Math.cos(t * 0.5) * alto * 0.05,
      };
      const mitad = ancho * 0.055;
      const angulo = Math.sin(t * 0.4) * 0.22;
      const dx = Math.cos(angulo) * mitad;
      const dy = Math.sin(angulo) * mitad;

      return {
        presente: true,
        centro,
        ojoIzq: { x: centro.x - dx, y: centro.y - dy },
        ojoDer: { x: centro.x + dx, y: centro.y + dy },
        radio: mitad * 2 * 1.6,
        angulo,
        confianza: 1,
      };
    },
  };
}

function transformarPunto(rostro, localX, localY) {
  const coseno = Math.cos(rostro.angulo);
  const seno = Math.sin(rostro.angulo);
  return {
    x: rostro.centro.x + localX * coseno - localY * seno,
    y: rostro.centro.y + localX * seno + localY * coseno,
  };
}

function agregarElipse(
  puntos,
  rostro,
  centroX,
  centroY,
  radioX,
  radioY,
  cantidad,
  inicio = 0,
  recorrido = Math.PI * 2,
) {
  const divisor = recorrido === Math.PI * 2 ? cantidad : Math.max(1, cantidad - 1);
  for (let indice = 0; indice < cantidad; indice++) {
    const angulo = inicio + (indice / divisor) * recorrido;
    puntos.push(
      transformarPunto(
        rostro,
        centroX + Math.cos(angulo) * radioX,
        centroY + Math.sin(angulo) * radioY,
      ),
    );
  }
}

/**
 * Landmarks inventados para hacer visible a la persona del modo demo. No
 * pretenden copiar los 478 puntos de MediaPipe: representan los mismos rasgos
 * importantes con una nube liviana que sigue posicion, escala e inclinacion.
 */
export function generarPuntosRostroSintetico(rostro) {
  if (!rostro || !Number.isFinite(rostro.radio) || rostro.radio <= 0) return [];

  const puntos = [];
  const radio = rostro.radio;
  const ojoX = radio * 0.3125;

  agregarElipse(puntos, rostro, 0, radio * 0.18, radio * 0.72, radio * 0.94, 32);
  agregarElipse(puntos, rostro, -ojoX, 0, radio * 0.16, radio * 0.085, 10);
  agregarElipse(puntos, rostro, ojoX, 0, radio * 0.16, radio * 0.085, 10);
  puntos.push(transformarPunto(rostro, -ojoX, 0), transformarPunto(rostro, ojoX, 0));

  agregarElipse(
    puntos,
    rostro,
    -ojoX,
    -radio * 0.16,
    radio * 0.2,
    radio * 0.08,
    7,
    Math.PI,
    Math.PI,
  );
  agregarElipse(
    puntos,
    rostro,
    ojoX,
    -radio * 0.16,
    radio * 0.2,
    radio * 0.08,
    7,
    Math.PI,
    Math.PI,
  );

  for (let indice = 0; indice < 7; indice++) {
    const progreso = indice / 6;
    puntos.push(
      transformarPunto(
        rostro,
        Math.sin(progreso * Math.PI) * radio * 0.035,
        radio * (0.04 + progreso * 0.39),
      ),
    );
  }
  agregarElipse(puntos, rostro, 0, radio * 0.43, radio * 0.13, radio * 0.055, 7);
  agregarElipse(puntos, rostro, 0, radio * 0.65, radio * 0.3, radio * 0.12, 16);

  return puntos;
}

/**
 * La logica del detector, separada de MediaPipe para poder probarla.
 * `detectorCrudo` solo tiene que saber `detectForVideo(video, ahora)` y `close()`.
 */
export function crearDetector({
  detectorCrudo,
  indices,
  indicesSinIris,
  factorRadio,
  ventanaConfianza,
}) {
  const detector = detectorCrudo;
  const medidor = crearMedidorConfianza(ventanaConfianza);
  const juegos = { conIris: indices, sinIris: indicesSinIris };
  let ultimosPuntos = null;

  return {
    /**
     * Las medidas van por parametro en cada llamada, no congeladas al crear el
     * detector: el lienzo cambia de tamano al pasar a kiosco, al conectar otra
     * pantalla y al girarla. Un tamano viejo comprime todos los puntos hacia el
     * angulo superior izquierdo.
     */
    detectar(video, ahora, rectangulo) {
      if (!video.videoWidth) return null;

      const salida = detector.detectForVideo(video, ahora);
      const puntos = salida?.faceLandmarks?.[0];
      medidor.registrar(Boolean(puntos));
      ultimosPuntos = puntos ?? null;
      if (!puntos) return null;

      const rostro = mapearRostro(puntos, {
        ...rectangulo,
        indices: elegirIndices(puntos.length, juegos),
        factorRadio,
        espejar: true,
      });
      if (rostro) rostro.confianza = medidor.valor();
      return rostro;
    },

    // Puntos crudos normalizados de la ultima deteccion. Solo para diagnostico:
    // dibujar la malla entera dice de un vistazo si el mapeo esta bien.
    puntosCrudos: () => ultimosPuntos,
    cantidadDePuntos: () => ultimosPuntos?.length ?? 0,
    cerrar: () => detector.close(),
  };
}

export async function crearDetectorMediaPipe({ base, ...resto }) {
  const { modulo, recursos } = await cargarVision(base);

  const detectorCrudo = await modulo.FaceLandmarker.createFromOptions(recursos, {
    baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  return crearDetector({ detectorCrudo, ...resto });
}
