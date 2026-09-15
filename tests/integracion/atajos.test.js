// El puente entre el contenido y la operacion del stand.
//
// `operacion.js` no sabe que existe carreras.json, y esta bien que sea asi. Pero
// la lista de teclas y la lista de carreras tienen que crecer juntas: cuando el
// catalogo paso a doce carreras la tecla de la ultima no llego con ella, y Naval
// quedo sin forma de forzarse desde el teclado. La prueba de operacion no podia
// verlo porque usa su propio fixture; esta lo mira contra el contenido real.

import { describe, it, expect } from 'vitest';

import { interpretarTecla, TECLAS_CARRERA } from '../../espejo/operacion.js';
import { construirCatalogo } from '../../servidor/catalogo.js';

const idsDeCarreras = async () => {
  const { catalogo, errores } = await construirCatalogo();
  if (errores.length > 0) throw new Error(`Errores en catálogo: ${errores.join(', ')}`);
  return catalogo.carreras.map((carrera) => carrera.id);
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
