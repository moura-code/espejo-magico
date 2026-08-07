import { describe, it, expect } from 'vitest';
import { crearDetectorDePose, mapearPose } from '../../espejo/pose.js';

const RECT = { x: 0, y: 0, ancho: 1000, alto: 800 };

function poseSintetica() {
  const puntos = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5 }));
  puntos[11] = { x: 0.3, y: 0.6 };
  puntos[12] = { x: 0.7, y: 0.62 };
  return puntos;
}

describe('mapearPose', () => {
  it('mapea hombros a pixeles y espeja la x', () => {
    const pose = mapearPose(poseSintetica(), null, { ...RECT, espejar: true });

    expect(pose.hombroIzq.x).toBeCloseTo(300);
    expect(pose.hombroDer.x).toBeCloseTo(700);
    expect(pose.centroHombros.x).toBeCloseTo(500);
    expect(pose.anchoHombros).toBeGreaterThan(390);
  });

  it('respeta el rectangulo del video', () => {
    const pose = mapearPose(poseSintetica(), null, {
      x: 100,
      y: 50,
      ancho: 500,
      alto: 400,
      espejar: false,
    });

    expect(pose.hombroIzq.x).toBeCloseTo(250);
    expect(pose.hombroIzq.y).toBeCloseTo(290);
  });

  it('devuelve null si faltan landmarks', () => {
    expect(mapearPose([], null, RECT)).toBeNull();
    expect(mapearPose(null, null, RECT)).toBeNull();
  });
});

describe('crearDetectorDePose', () => {
  const video = { videoWidth: 1280, videoHeight: 720 };

  it('devuelve una pose con mascara cuando el detector la entrega', () => {
    const mascara = { canvas: {} };
    const detector = crearDetectorDePose({
      detectorCrudo: {
        detectForVideo: () => ({ landmarks: [poseSintetica()], segmentationMasks: [mascara] }),
        close: () => {},
      },
      segmentacion: true,
    });

    const pose = detector.detectar(video, 0, RECT);
    expect(pose.mascara).toBe(mascara);
    expect(detector.crudasDetectadas()).toBe(1);
  });

  it('devuelve null si el video todavia no tiene tamaño', () => {
    const detector = crearDetectorDePose({
      detectorCrudo: { detectForVideo: () => ({ landmarks: [poseSintetica()] }), close: () => {} },
    });

    expect(detector.detectar({ videoWidth: 0 }, 0, RECT)).toBeNull();
    expect(detector.crudasDetectadas()).toBe(0);
  });
});
