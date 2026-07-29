import { describe, expect, it } from 'vitest';
import {
  convertirConfianzaEnPixeles,
  crearSegmentadorDePersona,
} from '../../espejo/segmentacion.js';

describe('convertirConfianzaEnPixeles', () => {
  it('crea un borde suave entre fondo y persona', () => {
    const pixeles = convertirConfianzaEnPixeles(
      new Float32Array([0, 0.18, 0.3, 0.42, 1]),
      { umbral: 0.18, suavidad: 0.24 },
    );
    const alfas = Array.from(
      { length: 5 },
      (_, indice) => pixeles[indice * 4 + 3],
    );

    expect(alfas).toEqual([0, 0, 128, 255, 255]);
    expect(pixeles[0]).toBe(255);
    expect(pixeles[1]).toBe(255);
    expect(pixeles[2]).toBe(255);
  });
});

describe('crearSegmentadorDePersona', () => {
  it('copia la mascara antes de cerrar el resultado de MediaPipe', () => {
    let imagen = null;
    let cierres = 0;
    const contexto = {
      putImageData(valor) {
        imagen = valor;
      },
      clearRect() {},
    };
    const lienzo = {
      width: 0,
      height: 0,
      getContext: () => contexto,
    };
    const segmentador = crearSegmentadorDePersona({
      segmentadorCrudo: {
        segmentForVideo(_video, _ahora, entregar) {
          entregar({
            confidenceMasks: [{
              width: 2,
              height: 1,
              getAsFloat32Array: () => new Float32Array([0, 1]),
            }],
            close() {
              cierres += 1;
            },
          });
        },
        close() {},
      },
      umbral: 0.2,
      suavidad: 0.2,
      crearLienzo: () => lienzo,
      crearImagen: (pixeles, ancho, alto) => ({ pixeles, ancho, alto }),
    });

    expect(segmentador.detectar({}, 100)).toBe(lienzo);
    expect(lienzo.width).toBe(2);
    expect(lienzo.height).toBe(1);
    expect(Array.from(imagen.pixeles)).toEqual([
      255, 255, 255, 0,
      255, 255, 255, 255,
    ]);
    expect(cierres).toBe(1);
  });

  it('olvida la mascara al reiniciar', () => {
    const contexto = {
      putImageData() {},
      clearRect() {},
    };
    const segmentador = crearSegmentadorDePersona({
      segmentadorCrudo: {
        segmentForVideo(_video, _ahora, entregar) {
          entregar({
            confidenceMasks: [{
              width: 1,
              height: 1,
              getAsFloat32Array: () => new Float32Array([1]),
            }],
          });
        },
        close() {},
      },
      crearLienzo: () => ({
        width: 1,
        height: 1,
        getContext: () => contexto,
      }),
      crearImagen: () => ({}),
    });

    segmentador.detectar({}, 100);
    segmentador.reiniciar();

    expect(segmentador.obtener()).toBeNull();
  });
});
