// El puente entre el contenido y la operacion del stand.
//
// `operacion.js` no sabe que existe carreras.json, y esta bien que sea asi. Pero
// la lista de teclas y la lista de carreras tienen que crecer juntas: cuando el
// catalogo paso a doce carreras la tecla de la ultima no llego con ella, y Naval
// quedo sin forma de forzarse desde el teclado. La prueba de operacion no podia
// verlo porque usa su propio fixture; esta lo mira contra el contenido real.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { interpretarTecla, TECLAS_CARRERA } from '../../espejo/operacion.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

const idsDeCarreras = async () => {
  const crudo = await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8');
  return JSON.parse(crudo).carreras.map((carrera) => carrera.id);
};

describe('atajos de carrera', () => {
  it('cada carrera del catalogo tiene su tecla', async () => {
    const ids = await idsDeCarreras();
    const sinTecla = ids.filter((_, indice) => indice >= TECLAS_CARRERA.length);
    expect(sinTecla).toEqual([]);
  });

  it('cada tecla fuerza la carrera que ocupa esa posicion', async () => {
    const ids = await idsDeCarreras();
    const forzadas = TECLAS_CARRERA.slice(0, ids.length).map(
      (tecla) => interpretarTecla(tecla, ids)?.id ?? null,
    );
    expect(forzadas).toEqual(ids);
  });

  it('no hay teclas repetidas', () => {
    expect(new Set(TECLAS_CARRERA).size).toBe(TECLAS_CARRERA.length);
  });
});
