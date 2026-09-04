import { describe, it, expect } from 'vitest';
import { crearSilueta, alfaDesdeConfianza } from '../../espejo/silueta.js';

/** Lo minimo de un canvas que necesita crearSilueta. */
function lienzoDeMentira() {
  const lienzo = {
    width: 0,
    height: 0,
    puestas: [],
    getContext: () => ({
      createImageData: (ancho, alto) => ({
        width: ancho,
        height: alto,
        data: new Uint8ClampedArray(ancho * alto * 4),
      }),
      putImageData: (imagen) => lienzo.puestas.push(imagen),
    }),
  };
  return lienzo;
}

const mascara = (ancho, alto, valores) => ({
  width: ancho,
  height: alto,
  getAsUint8Array: () => Uint8Array.from(valores),
});

describe('alfaDesdeConfianza', () => {
  // Es la traduccion entera: la mascara viene como un byte de confianza por
  // pixel y sin alfa, asi que dibujada tal cual el lienzo la ve opaca en todos
  // lados y `destination-in` no recorta nada.
  it('escribe blanco con el alfa de la confianza', () => {
    const destino = new Uint8ClampedArray(3 * 4);
    alfaDesdeConfianza(Uint8Array.from([0, 128, 255]), destino);

    expect([...destino]).toEqual([
      255, 255, 255, 0,
      255, 255, 255, 128,
      255, 255, 255, 255,
    ]);
  });

  it('confianza cero deja el pixel transparente, no negro', () => {
    const destino = new Uint8ClampedArray(4);
    alfaDesdeConfianza(Uint8Array.from([0]), destino);
    // Si el fondo saliera negro en vez de transparente, la persona quedaria
    // recortada sobre un rectangulo negro tapando el fondo de la carrera.
    expect(destino[3]).toBe(0);
  });
});

describe('crearSilueta', () => {
  it('convierte la mascara y devuelve el lienzo', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo });

    const salida = silueta.actualizar(mascara(2, 2, [0, 255, 255, 0]));

    expect(salida).toBe(lienzo);
    expect(lienzo.width).toBe(2);
    expect(lienzo.height).toBe(2);
    expect([...lienzo.puestas.at(-1).data]).toEqual([
      255, 255, 255, 0,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 0,
    ]);
  });

  it('devuelve null sin mascara', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira });
    expect(silueta.actualizar(null)).toBeNull();
    expect(silueta.actualizar(undefined)).toBeNull();
    expect(silueta.actualizar({})).toBeNull();
  });

  // Pasa cuando la pose se pierde justo entre dos cuadros y MediaPipe ya cerro
  // la mascara. Tiene que degradar a "no hay silueta", no tirar el bucle entero.
  it('una mascara ya cerrada no rompe el cuadro', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira });
    const rota = {
      width: 2,
      height: 2,
      getAsUint8Array: () => {
        throw new Error('la mascara ya se cerro');
      },
    };
    expect(() => silueta.actualizar(rota)).not.toThrow();
    expect(silueta.actualizar(rota)).toBeNull();
  });

  it('rechaza una mascara con menos datos de los que dice medir', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira });
    expect(silueta.actualizar(mascara(4, 4, [1, 2, 3]))).toBeNull();
  });

  it('rechaza una mascara de tamaño cero', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira });
    expect(silueta.actualizar(mascara(0, 0, []))).toBeNull();
  });

  // Crear un lienzo por cuadro es basura para el recolector cada 50 ms.
  it('reusa el mismo lienzo entre cuadros', () => {
    let creados = 0;
    const silueta = crearSilueta({
      crearLienzo: () => {
        creados++;
        return lienzoDeMentira();
      },
    });

    silueta.actualizar(mascara(2, 2, [0, 0, 0, 0]));
    silueta.actualizar(mascara(2, 2, [1, 1, 1, 1]));
    expect(creados).toBe(1);
  });

  it('se adapta si cambia el tamaño de la mascara', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo });

    silueta.actualizar(mascara(2, 2, [0, 0, 0, 0]));
    silueta.actualizar(mascara(3, 1, [10, 20, 30]));

    expect(lienzo.width).toBe(3);
    expect(lienzo.height).toBe(1);
    expect(lienzo.puestas.at(-1).data).toHaveLength(12);
  });
});
