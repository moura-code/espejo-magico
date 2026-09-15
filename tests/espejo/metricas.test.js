import { describe, it, expect } from 'vitest';
import { crearAcumuladorDeEtapas, crearMedidorDeEtapas } from '../../espejo/metricas.js';

describe('crearMedidorDeEtapas', () => {
  it('promedia una ventana acotada y conserva el máximo reciente', () => {
    const medidor = crearMedidorDeEtapas({ ventana: 2 });
    medidor.registrar('face', 4);
    medidor.registrar('face', 8);
    medidor.registrar('face', 12);

    expect(medidor.instantanea().face).toEqual({ ms: 10, muestras: 2, maximoMs: 12 });
  });

  it('mide una función y devuelve su resultado', () => {
    const tiempos = [100, 100];
    const medidor = crearMedidorDeEtapas({ ahora: () => tiempos.shift() });

    expect(medidor.medir('ui', () => 'dibujado')).toBe('dibujado');
    expect(medidor.instantanea().ui).toEqual({ ms: 0, muestras: 1, maximoMs: 0 });
  });
});

describe('crearAcumuladorDeEtapas', () => {
  it('registra una sola muestra por etapa al sumar sus llamadas de un cuadro', () => {
    const tiempos = [0, 2, 5, 9];
    const acumulador = crearAcumuladorDeEtapas({ ahora: () => tiempos.shift() });
    const medidor = crearMedidorDeEtapas();

    acumulador.medir('objects', () => 'escondidos');
    acumulador.medir('objects', () => 'carrusel');
    acumulador.registrarEn(medidor);

    expect(medidor.instantanea().objects).toEqual({ ms: 6, muestras: 1, maximoMs: 6 });
  });
});
