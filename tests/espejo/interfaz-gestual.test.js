import { describe, it, expect } from 'vitest';
import { calcularCierreDeAusencia } from '../../espejo/interfaz-gestual.js';

describe('calcularCierreDeAusencia', () => {
  const OPCIONES = {
    ausenciaDesde: 0,
    esperaInicialMs: 3000,
    intervaloMs: 5000,
    cierreMs: 1000,
    cerradoMs: 300,
    aperturaMs: 1000,
  };

  it('espera antes del primer cierre', () => {
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 2999 })).toBe(0);
  });

  it('cierra, permanece cerrado y vuelve a abrir', () => {
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 3500 })).toBeCloseTo(0.5);
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 4100 })).toBe(1);
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 4800 })).toBeCloseTo(0.5);
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 5300 })).toBe(0);
  });

  it('no anima cuando la ausencia se cancelo', () => {
    expect(
      calcularCierreDeAusencia({ ...OPCIONES, ahora: 4000, ausenciaDesde: null }),
    ).toBe(0);
  });
});
