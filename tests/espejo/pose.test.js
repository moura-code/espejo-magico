import { describe, expect, it } from 'vitest';
import {
  completarPoseConRespaldo,
  crearColisionadoresPersona,
  crearDetectorPose,
  crearFiltroPose,
  crearPoseSintetica,
  mapearPose,
} from '../../espejo/pose.js';

function puntosPose() {
  return Array.from({ length: 33 }, (_, indice) => ({
    x: 0.2 + indice * 0.01,
    y: 0.1 + indice * 0.01,
    z: 0,
    visibility: 0.9,
    presence: 0.9,
  }));
}

describe('mapearPose', () => {
  it('usa el mismo rectangulo espejado que el video', () => {
    const pose = mapearPose(puntosPose(), {
      x: -100,
      y: 20,
      ancho: 1000,
      alto: 500,
      espejar: true,
    });

    expect(pose.puntos[11].x).toBeCloseTo(590);
    expect(pose.puntos[11].y).toBeCloseTo(125);
    expect(pose.puntos[12].x).toBeLessThan(pose.puntos[11].x);
  });

  it('descarta puntos que el modelo no considera visibles', () => {
    const puntos = puntosPose();
    puntos[15].visibility = 0.1;
    const pose = mapearPose(puntos, {
      ancho: 1000,
      alto: 500,
      visibilidadMinima: 0.4,
    });

    expect(pose.puntos[15]).toBeNull();
    expect(pose.puntos[11]).not.toBeNull();
  });
});

describe('crearFiltroPose', () => {
  it('suaviza el movimiento y tolera pérdidas breves', () => {
    const filtro = crearFiltroPose({ alfa: 0.5, cuadrosDeGracia: 1 });
    const primera = mapearPose(puntosPose(), {
      ancho: 1000,
      alto: 500,
      espejar: false,
    });
    const segunda = {
      ...primera,
      puntos: primera.puntos.map((punto) =>
        punto ? { ...punto, x: punto.x + 100 } : null,
      ),
    };

    filtro.filtrar(primera);
    const suavizada = filtro.filtrar(segunda);
    expect(suavizada.puntos[11].x).toBeCloseTo(primera.puntos[11].x + 50);

    const incompleta = {
      ...segunda,
      puntos: segunda.puntos.map((punto, indice) =>
        indice === 11 ? null : punto,
      ),
    };
    expect(filtro.filtrar(incompleta).puntos[11]).not.toBeNull();
    expect(filtro.filtrar(incompleta).puntos[11]).toBeNull();
  });

  it('conserva la pose completa durante una pérdida breve', () => {
    const filtro = crearFiltroPose({ alfa: 0.5, cuadrosDeGracia: 2 });
    const pose = mapearPose(puntosPose(), {
      ancho: 1000,
      alto: 500,
    });

    filtro.filtrar(pose);
    expect(filtro.filtrar(null)).not.toBeNull();
    expect(filtro.filtrar(null)).not.toBeNull();
    expect(filtro.filtrar(null)).toBeNull();
  });
});

describe('crearPoseSintetica', () => {
  it('representa cabeza, hombros, torso y brazos en el demo', () => {
    const pose = crearPoseSintetica(
      { centro: { x: 500, y: 250 }, radio: 100 },
      [
        { palma: { x: 250, y: 550 } },
        { palma: { x: 750, y: 550 } },
      ],
      { ancho: 1000, alto: 900, piso: 800 },
    );

    for (const indice of [0, 7, 8, 11, 12, 13, 14, 15, 16, 23, 24]) {
      expect(pose.puntos[indice]).not.toBeNull();
    }
    expect(pose.centroHombros.y).toBeGreaterThan(250);
    expect(pose.anchoHombros).toBeGreaterThan(200);
  });
});

describe('completarPoseConRespaldo', () => {
  it('estima hombros y torso cuando el modelo sólo detecta la cara', () => {
    const rostro = { centro: { x: 500, y: 250 }, radio: 100 };
    const incompleta = {
      puntos: Array.from({ length: 33 }, (_, indice) =>
        indice === 0 ? { x: 500, y: 250 } : null,
      ),
    };

    const pose = completarPoseConRespaldo(
      incompleta,
      rostro,
      [],
      { ancho: 1000, alto: 900, piso: 800 },
    );

    expect(pose.estimada).toBe(true);
    expect(pose.puntos[11]).not.toBeNull();
    expect(pose.puntos[12]).not.toBeNull();
    expect(pose.puntos[23]).not.toBeNull();
    expect(pose.puntos[24]).not.toBeNull();
  });

  it('conserva los hombros reales cuando ambos están disponibles', () => {
    const real = crearPoseSintetica(
      { centro: { x: 500, y: 250 }, radio: 100 },
      [],
      { ancho: 1000, alto: 900, piso: 800 },
    );

    const pose = completarPoseConRespaldo(real, null);

    expect(pose.estimada).toBe(false);
    expect(pose.puntos[11]).toEqual(real.puntos[11]);
    expect(pose.puntos[12]).toEqual(real.puntos[12]);
  });
});

describe('crearColisionadoresPersona', () => {
  it('crea una silueta corporal continua y los cuatro tramos de brazos', () => {
    const rostro = { centro: { x: 500, y: 250 }, radio: 100 };
    const pose = crearPoseSintetica(rostro, [], {
      ancho: 1000,
      alto: 900,
      piso: 800,
    });
    const colisionadores = crearColisionadoresPersona({ rostro, pose });

    expect(colisionadores).toHaveLength(5);
    expect(colisionadores.filter(({ tipo }) => tipo === 'capsula')).toHaveLength(4);
    expect(colisionadores.find(({ nombre }) => nombre === 'cuerpo').tipo).toBe(
      'poligono',
    );
  });
});

describe('crearDetectorPose', () => {
  it('copia landmarks y máscara antes de cerrar el resultado', () => {
    let imagen = null;
    let cierres = 0;
    const lienzo = {
      width: 0,
      height: 0,
      getContext: () => ({
        putImageData(valor) {
          imagen = valor;
        },
        clearRect() {},
      }),
    };
    const detector = crearDetectorPose({
      detectorCrudo: {
        detectForVideo(_video, _ahora, entregar) {
          entregar({
            landmarks: [puntosPose()],
            segmentationMasks: [
              {
                width: 2,
                height: 1,
                getAsFloat32Array: () => new Float32Array([0, 1]),
              },
            ],
            close() {
              cierres += 1;
            },
          });
        },
        close() {},
      },
      visibilidadMinima: 0.4,
      umbralMascara: 0.2,
      suavidadMascara: 0.2,
      crearLienzo: () => lienzo,
      crearImagen: (pixeles, ancho, alto) => ({ pixeles, ancho, alto }),
    });

    const pose = detector.detectar(
      { videoWidth: 1280 },
      100,
      { x: 0, y: 0, ancho: 1000, alto: 500 },
    );

    expect(pose.puntos).toHaveLength(33);
    expect(detector.mascara()).toBe(lienzo);
    expect(Array.from(imagen.pixeles).filter((_, indice) => indice % 4 === 3))
      .toEqual([0, 255]);
    expect(cierres).toBe(1);
  });
});
