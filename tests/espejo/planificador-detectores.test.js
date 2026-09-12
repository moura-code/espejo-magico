import { describe, expect, it } from 'vitest';

const modulo = await import('../../espejo/planificador-detectores.js').catch(() => ({}));

const frecuencias = { rostro: 20, manos: 30, pose: 10 };
const todas = { rostro: true, manos: true, pose: true };

const crear = () => modulo.crearPlanificadorDeDetectores?.();

describe('crearPlanificadorDeDetectores', () => {
  it('arranca con rostro y escalona manos y pose', () => {
    const planificador = crear();

    expect(planificador?.pendientes({ ahora: 50, frecuencias, habilitados: todas })).toEqual({
      rostro: true,
      manos: false,
      pose: false,
    });
    planificador?.registrar('rostro', 50);

    expect(planificador?.pendientes({ ahora: 61, frecuencias, habilitados: todas })).toEqual({
      rostro: false,
      manos: false,
      pose: false,
    });
    expect(planificador?.pendientes({ ahora: 62, frecuencias, habilitados: todas }).manos).toBe(
      true,
    );
    expect(planificador?.pendientes({ ahora: 149, frecuencias, habilitados: todas }).pose).toBe(
      false,
    );
    expect(planificador?.pendientes({ ahora: 150, frecuencias, habilitados: todas }).pose).toBe(
      true,
    );
  });

  it('avanza sólo el reloj del detector que realmente se ejecutó', () => {
    const planificador = crear();
    planificador?.pendientes({ ahora: 50, frecuencias, habilitados: todas });
    planificador?.registrar('rostro', 50);
    planificador?.registrar('manos', 62);

    const aLos80 = planificador?.pendientes({ ahora: 80, frecuencias, habilitados: todas });
    expect(aLos80?.manos).toBe(false);
    expect(aLos80?.pose).toBe(false);

    const aLos96 = planificador?.pendientes({ ahora: 96, frecuencias, habilitados: todas });
    expect(aLos96?.manos).toBe(true);
    expect(aLos96?.pose).toBe(false);
  });

  it('no programa detectores que no están disponibles', () => {
    const planificador = crear();
    const habilitados = { rostro: true, manos: false, pose: false };

    planificador?.pendientes({ ahora: 50, frecuencias, habilitados });
    planificador?.registrar('rostro', 50);

    expect(planificador?.pendientes({ ahora: 500, frecuencias, habilitados })).toEqual({
      rostro: true,
      manos: false,
      pose: false,
    });
  });
});
