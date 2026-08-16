import { describe, it, expect } from 'vitest';
import { mapearMano, crearDetectorDeManos } from '../../espejo/manos.js';

const RECT = { x: 0, y: 0, ancho: 1000, alto: 1000 };

/**
 * Arma una mano sintetica en coordenadas normalizadas.
 * `extension` 0 = puño cerrado, 1 = mano bien abierta.
 */
function manoSintetica({ centroX = 0.5, centroY = 0.5, palma = 0.1, extension = 1 }) {
  const puntos = Array.from({ length: 21 }, () => ({ x: centroX, y: centroY }));

  // Muñeca abajo, nudillo medio arriba: la distancia entre ambos es el largo de palma.
  puntos[0] = { x: centroX, y: centroY + palma / 2 };
  puntos[9] = { x: centroX, y: centroY - palma / 2 };

  // Nudillos repartidos a lo ancho de la palma.
  puntos[5] = { x: centroX - palma * 0.3, y: centroY - palma * 0.4 };
  puntos[13] = { x: centroX + palma * 0.25, y: centroY - palma * 0.4 };
  puntos[17] = { x: centroX + palma * 0.45, y: centroY - palma * 0.2 };

  // Puntas de los dedos: se alejan del centro segun `extension`.
  const alcance = palma * (0.55 + extension * 1.1);
  [4, 8, 12, 16, 20].forEach((indice, i) => {
    const angulo = -Math.PI / 2 + (i - 2) * 0.35;
    puntos[indice] = {
      x: centroX + Math.cos(angulo) * alcance,
      y: centroY + Math.sin(angulo) * alcance,
    };
  });

  return puntos;
}

describe('mapearMano', () => {
  it('ubica la palma en pixeles', () => {
    const mano = mapearMano(manoSintetica({ centroX: 0.5, centroY: 0.5 }), {
      ...RECT,
      espejar: false,
    });
    expect(mano.palma.x).toBeGreaterThan(400);
    expect(mano.palma.x).toBeLessThan(600);
    expect(mano.palma.y).toBeGreaterThan(300);
    expect(mano.palma.y).toBeLessThan(700);
  });

  it('espeja la x igual que el rostro', () => {
    const puntos = manoSintetica({ centroX: 0.25 });
    const derecho = mapearMano(puntos, { ...RECT, espejar: false });
    const espejado = mapearMano(puntos, { ...RECT, espejar: true });

    expect(derecho.palma.x).toBeCloseTo(1000 - espejado.palma.x, 0);
  });

  it('respeta el rectangulo del video, como el rostro', () => {
    const puntos = manoSintetica({ centroX: 0.5, centroY: 0.5 });
    const corrido = mapearMano(puntos, { x: 200, y: 100, ancho: 400, alto: 400, espejar: false });

    expect(corrido.palma.x).toBeGreaterThan(200);
    expect(corrido.palma.x).toBeLessThan(600);
    expect(corrido.palma.y).toBeGreaterThan(100);
    expect(corrido.palma.y).toBeLessThan(500);
  });

  // El corazon de la funcion elegida: el circulo crece al abrir los dedos.
  it('la mano abierta tiene un radio mayor que el puño cerrado', () => {
    const abierta = mapearMano(manoSintetica({ extension: 1 }), { ...RECT, espejar: false });
    const cerrada = mapearMano(manoSintetica({ extension: 0 }), { ...RECT, espejar: false });

    expect(abierta.radio).toBeGreaterThan(cerrada.radio * 1.5);
  });

  it('la apertura crece con los dedos y no depende del tamaño de la mano', () => {
    const chicaAbierta = mapearMano(manoSintetica({ palma: 0.06, extension: 1 }), {
      ...RECT,
      espejar: false,
    });
    const grandeAbierta = mapearMano(manoSintetica({ palma: 0.18, extension: 1 }), {
      ...RECT,
      espejar: false,
    });
    const grandeCerrada = mapearMano(manoSintetica({ palma: 0.18, extension: 0 }), {
      ...RECT,
      espejar: false,
    });

    // Dos manos de distinto tamaño con los dedos igual de abiertos: misma apertura.
    expect(chicaAbierta.apertura).toBeCloseTo(grandeAbierta.apertura, 1);
    expect(grandeAbierta.apertura).toBeGreaterThan(grandeCerrada.apertura);
  });

  it('una mano mas cerca de la camara da un radio mayor', () => {
    const lejos = mapearMano(manoSintetica({ palma: 0.06 }), { ...RECT, espejar: false });
    const cerca = mapearMano(manoSintetica({ palma: 0.18 }), { ...RECT, espejar: false });

    expect(cerca.radio).toBeGreaterThan(lejos.radio * 2);
  });

  it('el puño cerrado conserva un radio util', () => {
    const cerrada = mapearMano(manoSintetica({ palma: 0.1, extension: 0 }), {
      ...RECT,
      espejar: false,
    });
    expect(cerrada.radio).toBeGreaterThan(0);
    expect(cerrada.radio).toBeGreaterThanOrEqual(cerrada.largoPalma * 0.5);
  });

  it('devuelve las cinco puntas de los dedos', () => {
    const mano = mapearMano(manoSintetica({}), { ...RECT, espejar: false });
    expect(mano.puntas).toHaveLength(5);
    for (const punta of mano.puntas) {
      expect(Number.isFinite(punta.x) && Number.isFinite(punta.y)).toBe(true);
    }
  });

  it('devuelve null con datos incompletos', () => {
    expect(mapearMano(null, RECT)).toBeNull();
    expect(mapearMano([], RECT)).toBeNull();
    expect(mapearMano(Array.from({ length: 10 }, () => ({ x: 0, y: 0 })), RECT)).toBeNull();
  });

  it('devuelve null si la mano esta degenerada en un punto', () => {
    const planos = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
    expect(mapearMano(planos, RECT)).toBeNull();
  });

  it('el radio se puede agrandar desde config sin tocar codigo', () => {
    const puntos = manoSintetica({ extension: 1 });
    const normal = mapearMano(puntos, { ...RECT, espejar: false, factorRadio: 1.4 });
    const generoso = mapearMano(puntos, { ...RECT, espejar: false, factorRadio: 2.2 });

    expect(generoso.radio).toBeGreaterThan(normal.radio * 1.4);
  });

  it('el piso del radio se puede subir para que el puño perdone mas', () => {
    const puno = manoSintetica({ palma: 0.1, extension: 0 });
    const justo = mapearMano(puno, { ...RECT, espejar: false, radioMinimoEnPalmas: 0.5 });
    const amplio = mapearMano(puno, { ...RECT, espejar: false, radioMinimoEnPalmas: 2 });

    expect(amplio.radio).toBeGreaterThan(justo.radio);
    expect(amplio.radio).toBeCloseTo(amplio.largoPalma * 2, 0);
  });
});

describe('crearDetectorDeManos', () => {
  const video = { videoWidth: 1280, videoHeight: 720 };

  const crudoCon = (manos, lados = []) => ({
    detectForVideo: () => ({
      landmarks: manos,
      handedness: lados.map((nombre) => [{ categoryName: nombre }]),
    }),
    close: () => {},
  });

  it('devuelve una mano por cada juego de puntos', () => {
    const detector = crearDetectorDeManos({
      detectorCrudo: crudoCon(
        [manoSintetica({ centroX: 0.3 }), manoSintetica({ centroX: 0.7 })],
        ['Left', 'Right'],
      ),
    });

    const manos = detector.detectar(video, 0, RECT);
    expect(manos).toHaveLength(2);
    expect(manos.map((m) => m.lado)).toEqual(['Left', 'Right']);
  });

  it('respeta el maximo de manos', () => {
    const detector = crearDetectorDeManos({
      detectorCrudo: crudoCon([manoSintetica({}), manoSintetica({}), manoSintetica({})]),
      maximo: 2,
    });
    expect(detector.detectar(video, 0, RECT)).toHaveLength(2);
  });

  it('devuelve lista vacia cuando no hay manos', () => {
    const detector = crearDetectorDeManos({ detectorCrudo: crudoCon([]) });
    expect(detector.detectar(video, 0, RECT)).toEqual([]);
  });

  it('devuelve lista vacia si el video todavia no tiene tamaño', () => {
    const detector = crearDetectorDeManos({ detectorCrudo: crudoCon([manoSintetica({})]) });
    expect(detector.detectar({ videoWidth: 0 }, 0, RECT)).toEqual([]);
  });

  // main.js le pasa el lienzo del recorte visible, no el <video>.
  it('acepta un lienzo, no solo un elemento de video', () => {
    const detector = crearDetectorDeManos({ detectorCrudo: crudoCon([manoSintetica({})]) });
    expect(detector.detectar({ width: 405, height: 720 }, 0, RECT)).toHaveLength(1);
  });

  it('le pone un nombre a la mano aunque MediaPipe no diga cual es', () => {
    const detector = crearDetectorDeManos({ detectorCrudo: crudoCon([manoSintetica({})]) });
    const [mano] = detector.detectar(video, 0, RECT);
    expect(typeof mano.lado).toBe('string');
    expect(mano.lado.length).toBeGreaterThan(0);
  });

  // MediaPipe cambio el nombre del campo entre versiones. Si solo se aceptara uno,
  // el seguimiento de velocidad de cada mano se romperia en silencio.
  it('acepta el campo de lado con cualquiera de sus dos nombres', () => {
    const conPlural = {
      detectForVideo: () => ({
        landmarks: [manoSintetica({})],
        handednesses: [[{ categoryName: 'Right' }]],
      }),
      close: () => {},
    };
    const detector = crearDetectorDeManos({ detectorCrudo: conPlural });
    expect(detector.detectar(video, 0, RECT)[0].lado).toBe('Right');
  });

  it('informa cuantas manos vio MediaPipe antes de mapearlas', () => {
    const detector = crearDetectorDeManos({
      detectorCrudo: crudoCon([manoSintetica({}), manoSintetica({})]),
    });
    expect(detector.crudasDetectadas()).toBe(0);

    detector.detectar(video, 0, RECT);
    expect(detector.crudasDetectadas()).toBe(2);
  });

  it('pasa los ajustes de radio a cada mano', () => {
    const detector = crearDetectorDeManos({
      detectorCrudo: crudoCon([manoSintetica({ extension: 1 })]),
      factorRadio: 3,
    });
    const generoso = detector.detectar(video, 0, RECT)[0];

    const porDefecto = crearDetectorDeManos({
      detectorCrudo: crudoCon([manoSintetica({ extension: 1 })]),
    }).detectar(video, 0, RECT)[0];

    expect(generoso.radio).toBeGreaterThan(porDefecto.radio);
  });

  it('descarta manos que no se pudieron mapear', () => {
    const planos = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 }));
    const detector = crearDetectorDeManos({
      detectorCrudo: crudoCon([manoSintetica({}), planos], ['Left', 'Right']),
    });
    expect(detector.detectar(video, 0, RECT)).toHaveLength(1);
  });
});
