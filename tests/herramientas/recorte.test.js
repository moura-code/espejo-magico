import { describe, it, expect } from 'vitest';
import { limitesOpacos, recorteSimetrico, tocaElBorde } from '../../herramientas/recorte.js';

/** Imagen RGBA transparente con algunos pixeles pintados: [x, y, alfa]. */
function imagen(ancho, alto, pintados = []) {
  const datos = new Uint8ClampedArray(ancho * alto * 4);
  for (const [x, y, alfa = 255] of pintados) datos[(y * ancho + x) * 4 + 3] = alfa;
  return { ancho, alto, datos };
}

describe('limitesOpacos', () => {
  it('devuelve null si toda la imagen es transparente', () => {
    expect(limitesOpacos(imagen(8, 8))).toBeNull();
  });

  it('abarca todos los pixeles pintados', () => {
    const limites = limitesOpacos(imagen(8, 8, [[3, 2], [5, 6]]));
    expect(limites).toEqual({ izquierda: 3, derecha: 5, arriba: 2, abajo: 6 });
  });

  it('cuenta el alfa minimo del antialias, no solo el opaco pleno', () => {
    const limites = limitesOpacos(imagen(8, 8, [[4, 4, 1]]));
    expect(limites).toEqual({ izquierda: 4, derecha: 4, arriba: 4, abajo: 4 });
  });
});

describe('recorteSimetrico', () => {
  it('mantiene el centro del lienzo como centro del recorte', () => {
    const limites = limitesOpacos(imagen(8, 8, [[3, 2]]));
    const recorte = recorteSimetrico(limites, 8, 8);

    expect(recorte).toEqual({ x: 3, y: 2, ancho: 2, alto: 4 });
    expect(recorte.x + recorte.ancho / 2).toBe(4);
    expect(recorte.y + recorte.alto / 2).toBe(4);
  });

  it('cubre los limites enteros: no recorta arte', () => {
    const limites = limitesOpacos(imagen(8, 8, [[1, 1], [6, 2]]));
    const recorte = recorteSimetrico(limites, 8, 8);

    expect(recorte.x).toBeLessThanOrEqual(limites.izquierda);
    expect(recorte.y).toBeLessThanOrEqual(limites.arriba);
    expect(recorte.x + recorte.ancho).toBeGreaterThan(limites.derecha);
    expect(recorte.y + recorte.alto).toBeGreaterThan(limites.abajo);
  });

  it('no se sale del lienzo cuando el arte esta contra un borde', () => {
    const limites = limitesOpacos(imagen(8, 8, [[0, 4]]));
    const recorte = recorteSimetrico(limites, 8, 8);

    expect(recorte.x).toBeGreaterThanOrEqual(0);
    expect(recorte.x + recorte.ancho).toBeLessThanOrEqual(8);
  });

  it('con lienzo de lado impar recorta exactamente el pixel central', () => {
    const limites = limitesOpacos(imagen(7, 7, [[3, 3]]));
    expect(recorteSimetrico(limites, 7, 7)).toEqual({ x: 3, y: 3, ancho: 1, alto: 1 });
  });
});

describe('tocaElBorde', () => {
  it('avisa cuando el arte llega a cualquier borde', () => {
    expect(tocaElBorde(limitesOpacos(imagen(8, 8, [[0, 3]])), 8, 8)).toBe(true);
    expect(tocaElBorde(limitesOpacos(imagen(8, 8, [[7, 7]])), 8, 8)).toBe(true);
  });

  it('queda callado cuando el arte tiene margen', () => {
    expect(tocaElBorde(limitesOpacos(imagen(8, 8, [[3, 3]])), 8, 8)).toBe(false);
  });
});
