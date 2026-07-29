import { describe, expect, it } from 'vitest';
import { CONFIG } from '../../espejo/config.js';

describe('ritmo inmersivo de la experiencia', () => {
  it('mantiene tiempos suficientes para leer y explorar cada estado', () => {
    expect(CONFIG.tiempos.enganche).toBeGreaterThanOrEqual(4000);
    expect(CONFIG.tiempos.sorteo).toBeGreaterThanOrEqual(5000);
    expect(CONFIG.tiempos.revelacion).toBeGreaterThanOrEqual(4000);
    expect(CONFIG.tiempos.escena).toBeGreaterThanOrEqual(30000);
    expect(CONFIG.tiempos.reflexion).toBeGreaterThanOrEqual(10000);
    expect(CONFIG.tiempos.cierre).toBeGreaterThanOrEqual(7000);
  });

  it('entra dentro del límite máximo de sesión', () => {
    const duracionProgramada =
      CONFIG.tiempos.enganche +
      CONFIG.tiempos.sorteo +
      CONFIG.tiempos.revelacion +
      CONFIG.tiempos.escena +
      CONFIG.tiempos.reflexion +
      CONFIG.tiempos.cierre;

    expect(duracionProgramada).toBeLessThan(CONFIG.tiempos.sesionMaxima);
  });
});

describe('segmentacion de persona', () => {
  it('mantiene una frecuencia suficiente sin competir con el render', () => {
    expect(CONFIG.segmentacion.fps).toBeGreaterThanOrEqual(10);
    expect(CONFIG.segmentacion.fps).toBeLessThanOrEqual(20);
  });

  it('usa una transicion de mascara gradual', () => {
    expect(CONFIG.segmentacion.umbral).toBeGreaterThanOrEqual(0);
    expect(CONFIG.segmentacion.umbral).toBeLessThan(1);
    expect(CONFIG.segmentacion.suavidad).toBeGreaterThan(0);
  });
});
