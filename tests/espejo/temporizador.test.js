import { describe, expect, it } from 'vitest';
import { ESTADOS } from '../../espejo/maquina-estados.js';
import { calcularTemporizadorEstado } from '../../espejo/temporizador.js';

const TIEMPOS = {
  enganche: 2000,
  sorteo: 3000,
  revelacion: 2000,
  escena: 20000,
  reflexion: 10000,
  cierre: 4000,
};

describe('calcularTemporizadorEstado', () => {
  it('muestra segundos redondeados hacia arriba y progreso restante', () => {
    expect(
      calcularTemporizadorEstado({
        estado: ESTADOS.SORTEO,
        transcurrido: 1200,
        tiempos: TIEMPOS,
        manual: false,
      }),
    ).toEqual({
      duracionMs: 3000,
      restanteMs: 1800,
      segundosRestantes: 2,
      proporcionRestante: 0.6,
    });
  });

  it('se oculta durante la espera y el modo manual', () => {
    expect(
      calcularTemporizadorEstado({
        estado: ESTADOS.ATRACCION,
        transcurrido: 5000,
        tiempos: TIEMPOS,
        manual: false,
      }),
    ).toBeNull();
    expect(
      calcularTemporizadorEstado({
        estado: ESTADOS.ESCENA,
        transcurrido: 5000,
        tiempos: TIEMPOS,
        manual: true,
      }),
    ).toBeNull();
  });

  it('limita el tiempo entre cero y la duracion del estado', () => {
    expect(
      calcularTemporizadorEstado({
        estado: ESTADOS.CIERRE,
        transcurrido: -100,
        tiempos: TIEMPOS,
        manual: false,
      }).restanteMs,
    ).toBe(4000);
    expect(
      calcularTemporizadorEstado({
        estado: ESTADOS.CIERRE,
        transcurrido: 9000,
        tiempos: TIEMPOS,
        manual: false,
      }).restanteMs,
    ).toBe(0);
  });
});
