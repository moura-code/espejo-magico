import { describe, it, expect } from 'vitest';
import {
  mapearRostro,
  crearMedidorConfianza,
  crearFuenteSintetica,
  elegirIndices,
  crearDetector,
} from '../../espejo/rostro.js';

const OPCIONES = {
  ancho: 1000,
  alto: 500,
  indices: { ojoIzq: [0], ojoDer: [1] },
  factorRadio: 2,
};

describe('mapearRostro', () => {
  it('convierte puntos normalizados a pixeles espejando la x', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: true });

    // Comparacion aproximada: espejar es una resta, y (1 - 0.7) * 1000 no da
    // exactamente 300 en punto flotante.
    expect(rostro.ojoIzq.x).toBeCloseTo(300);
    expect(rostro.ojoIzq.y).toBeCloseTo(200);
    expect(rostro.ojoDer.x).toBeCloseTo(700);
    expect(rostro.ojoDer.y).toBeCloseTo(200);
    expect(rostro.centro.x).toBeCloseTo(500);
    expect(rostro.centro.y).toBeCloseTo(200);
  });

  it('no espeja cuando se le pide que no', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(rostro.ojoIzq).toEqual({ x: 300, y: 200 });
  });

  it('llama izquierdo al ojo que queda a la izquierda en pantalla, sin importar el indice', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const alDerecho = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    const alReves = mapearRostro(puntos, {
      ...OPCIONES,
      espejar: false,
      indices: { ojoIzq: [1], ojoDer: [0] },
    });
    expect(alReves.ojoIzq).toEqual(alDerecho.ojoIzq);
    expect(alReves.ojoDer).toEqual(alDerecho.ojoDer);
  });

  it('promedia varios puntos por ojo, que es como se saca el centro del iris', () => {
    const puntos = [
      { x: 0.2, y: 0.4 }, { x: 0.4, y: 0.4 },
      { x: 0.6, y: 0.4 }, { x: 0.8, y: 0.4 },
    ];
    const rostro = mapearRostro(puntos, {
      ...OPCIONES,
      espejar: false,
      indices: { ojoIzq: [0, 1], ojoDer: [2, 3] },
    });
    expect(rostro.ojoIzq.x).toBeCloseTo(300);
    expect(rostro.ojoDer.x).toBeCloseTo(700);
  });

  it('deriva el radio de la distancia entre ojos', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(rostro.radio).toBeCloseTo(800);
  });

  it('calcula la inclinacion de la cabeza', () => {
    const puntos = [{ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.6 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(rostro.angulo).toBeCloseTo(Math.atan2(200, 200));
  });

  it('devuelve null si no hay puntos', () => {
    expect(mapearRostro([], OPCIONES)).toBeNull();
    expect(mapearRostro(null, OPCIONES)).toBeNull();
  });

  it('devuelve null en vez de romperse si falta un indice pedido', () => {
    const puntos = [{ x: 0.3, y: 0.4 }];
    expect(mapearRostro(puntos, { ...OPCIONES, indices: { ojoIzq: [0], ojoDer: [99] } })).toBeNull();
  });

  // El video se dibuja preservando su relacion de aspecto, en un rectangulo que
  // puede sobresalir del lienzo. Los puntos tienen que caer en ESE rectangulo.
  it('mapea dentro del rectangulo del video, no del lienzo entero', () => {
    const puntos = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
    const rostro = mapearRostro(puntos, {
      x: -200,
      y: 100,
      ancho: 800,
      alto: 400,
      indices: { ojoIzq: [0], ojoDer: [1] },
      factorRadio: 2,
      espejar: true,
    });

    expect(rostro.ojoIzq.x).toBeCloseTo(0);
    expect(rostro.ojoDer.x).toBeCloseTo(400);
    expect(rostro.ojoIzq.y).toBeCloseTo(300);
  });

  it('el rectangulo tambien corre los puntos sin espejar', () => {
    const puntos = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
    const rostro = mapearRostro(puntos, {
      x: 1000,
      y: 0,
      ancho: 400,
      alto: 400,
      indices: { ojoIzq: [0], ojoDer: [1] },
      factorRadio: 2,
      espejar: false,
    });

    expect(rostro.ojoIzq.x).toBeCloseTo(1100);
    expect(rostro.ojoDer.x).toBeCloseTo(1300);
  });

  it('sin rectangulo se comporta como si empezara en el origen', () => {
    const puntos = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }];
    const conCero = mapearRostro(puntos, { ...OPCIONES, x: 0, y: 0, espejar: false });
    const sinNada = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(sinNada).toEqual(conCero);
  });
});

describe('elegirIndices', () => {
  const juegos = {
    conIris: { ojoIzq: [474, 475, 476, 477], ojoDer: [469, 470, 471, 472] },
    sinIris: { ojoIzq: [362, 263], ojoDer: [33, 133] },
  };

  it('usa el iris cuando el modelo entrega los 478 puntos', () => {
    expect(elegirIndices(478, juegos)).toBe(juegos.conIris);
  });

  it('cae a las esquinas de los ojos con un modelo sin iris', () => {
    expect(elegirIndices(468, juegos)).toBe(juegos.sinIris);
  });
});

describe('crearMedidorConfianza', () => {
  it('vale 1 cuando todas las lecturas recientes tienen rostro', () => {
    const medidor = crearMedidorConfianza(4);
    for (let i = 0; i < 4; i++) medidor.registrar(true);
    expect(medidor.valor()).toBe(1);
  });

  it('baja a la mitad con la mitad de las lecturas vacias', () => {
    const medidor = crearMedidorConfianza(4);
    medidor.registrar(true);
    medidor.registrar(false);
    medidor.registrar(true);
    medidor.registrar(false);
    expect(medidor.valor()).toBe(0.5);
  });

  it('olvida lo que queda fuera de la ventana', () => {
    const medidor = crearMedidorConfianza(2);
    medidor.registrar(false);
    medidor.registrar(true);
    medidor.registrar(true);
    expect(medidor.valor()).toBe(1);
  });

  it('vale cero antes de la primera lectura', () => {
    expect(crearMedidorConfianza(4).valor()).toBe(0);
  });
});

describe('crearDetector', () => {
  const INDICES = {
    indices: { ojoIzq: [474, 475, 476, 477], ojoDer: [469, 470, 471, 472] },
    indicesSinIris: { ojoIzq: [362, 263], ojoDer: [33, 133] },
    factorRadio: 1.6,
    ventanaConfianza: 30,
  };

  function unaCara() {
    const puntos = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    for (const i of [469, 470, 471, 472]) puntos[i] = { x: 0.4, y: 0.3 };
    for (const i of [474, 475, 476, 477]) puntos[i] = { x: 0.6, y: 0.3 };
    return puntos;
  }

  const video = { videoWidth: 1280, videoHeight: 720 };
  const crudoCon = (caras) => ({
    detectForVideo: () => ({ faceLandmarks: caras }),
    close: () => {},
  });

  // REGRESION: el detector congelaba ancho y alto al crearse. Cuando Chrome
  // pasaba a pantalla completa despues de cargar el modulo, todos los puntos
  // quedaban comprimidos hacia el angulo superior izquierdo.
  it('usa las medidas de cada llamada y no las del primer cuadro', () => {
    const detector = crearDetector({ detectorCrudo: crudoCon([unaCara()]), ...INDICES });

    const chico = detector.detectar(video, 0, { ancho: 1000, alto: 500 });
    const grande = detector.detectar(video, 100, { ancho: 2000, alto: 1000 });

    expect(chico.centro.x).toBeCloseTo(500);
    expect(chico.centro.y).toBeCloseTo(150);
    expect(grande.centro.x).toBeCloseTo(1000);
    expect(grande.centro.y).toBeCloseTo(300);
  });

  it('devuelve null cuando no hay cara en el cuadro', () => {
    const detector = crearDetector({ detectorCrudo: crudoCon([]), ...INDICES });
    expect(detector.detectar(video, 0, { ancho: 1000, alto: 500 })).toBeNull();
  });

  it('devuelve null mientras el video todavia no tiene tamaño', () => {
    const detector = crearDetector({ detectorCrudo: crudoCon([unaCara()]), ...INDICES });
    expect(detector.detectar({ videoWidth: 0 }, 0, { ancho: 1000, alto: 500 })).toBeNull();
  });

  it('expone los puntos crudos para diagnostico', () => {
    const detector = crearDetector({ detectorCrudo: crudoCon([unaCara()]), ...INDICES });
    expect(detector.cantidadDePuntos()).toBe(0);

    detector.detectar(video, 0, { ancho: 1000, alto: 500 });
    expect(detector.cantidadDePuntos()).toBe(478);
    expect(detector.puntosCrudos()).toHaveLength(478);
  });

  it('la confianza refleja cuantas lecturas recientes encontraron cara', () => {
    let hayCara = true;
    const detectorCrudo = {
      detectForVideo: () => ({ faceLandmarks: hayCara ? [unaCara()] : [] }),
      close: () => {},
    };
    const detector = crearDetector({ detectorCrudo, ...INDICES, ventanaConfianza: 4 });

    detector.detectar(video, 0, { ancho: 1000, alto: 500 });
    detector.detectar(video, 10, { ancho: 1000, alto: 500 });
    hayCara = false;
    detector.detectar(video, 20, { ancho: 1000, alto: 500 });
    hayCara = true;

    expect(detector.detectar(video, 30, { ancho: 1000, alto: 500 }).confianza).toBeCloseTo(0.75);
  });
});

describe('crearFuenteSintetica', () => {
  const MEDIDAS = { ancho: 1080, alto: 1920 };

  it('entrega siempre un rostro valido que se mueve con el tiempo', () => {
    const fuente = crearFuenteSintetica();
    const a = fuente.detectar(0, MEDIDAS);
    const b = fuente.detectar(1200, MEDIDAS);

    expect(a.presente).toBe(true);
    expect(a.radio).toBeGreaterThan(0);
    expect(a.ojoIzq.x).toBeLessThan(a.ojoDer.x);
    expect(b.centro.x).not.toBeCloseTo(a.centro.x);
  });

  it('no se sale nunca de la pantalla', () => {
    const fuente = crearFuenteSintetica();
    for (let t = 0; t < 30000; t += 250) {
      const rostro = fuente.detectar(t, MEDIDAS);
      expect(rostro.centro.x).toBeGreaterThan(0);
      expect(rostro.centro.x).toBeLessThan(1080);
      expect(rostro.centro.y).toBeGreaterThan(0);
      expect(rostro.centro.y).toBeLessThan(1920);
    }
  });

  // Mismo motivo que en el detector: el tamaño no puede quedar congelado.
  it('se adapta al tamaño que le pasan en cada llamada', () => {
    const fuente = crearFuenteSintetica();
    const chico = fuente.detectar(500, { ancho: 1000, alto: 1000 });
    const grande = fuente.detectar(500, { ancho: 2000, alto: 2000 });

    expect(grande.centro.x).toBeCloseTo(chico.centro.x * 2);
    expect(grande.radio).toBeCloseTo(chico.radio * 2);
  });
});
