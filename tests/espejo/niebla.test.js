import { describe, it, expect } from 'vitest';
import { calcularNiebla, crearNiebla } from '../../espejo/niebla.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { enganche: 2000, sorteo: 3000, revelacion: 2000, cierre: 4000 };
const en = (estado, transcurrido) => calcularNiebla({ estado, transcurrido, tiempos: TIEMPOS });

describe('calcularNiebla', () => {
  it('hay nubes en atraccion', () => {
    expect(en(ESTADOS.ATRACCION, 0)).toEqual({ cobertura: 1, revelado: 0 });
  });

  it('las nubes se despejan durante el enganche', () => {
    expect(en(ESTADOS.ENGANCHE, 0)).toEqual({ cobertura: 1, revelado: 0 });
    expect(en(ESTADOS.ENGANCHE, 1000).cobertura).toBeCloseTo(0.5);
    expect(en(ESTADOS.ENGANCHE, 2000)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('durante el sorteo ya no quedan nubes', () => {
    expect(en(ESTADOS.SORTEO, 0)).toEqual({ cobertura: 0, revelado: 1 });
    expect(en(ESTADOS.SORTEO, 2900)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('en la revelacion ya no quedan nubes', () => {
    expect(en(ESTADOS.REVELACION, 0)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('en escena ya no queda nada de niebla', () => {
    expect(en(ESTADOS.ESCENA, 5000)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('en cierre las nubes vuelven gradualmente', () => {
    expect(en(ESTADOS.CIERRE, 0)).toEqual({ cobertura: 0, revelado: 0 });
    expect(en(ESTADOS.CIERRE, 2000).cobertura).toBeCloseTo(0.5);
    expect(en(ESTADOS.CIERRE, 4000)).toEqual({ cobertura: 1, revelado: 0 });
  });

  it('nunca devuelve valores fuera de 0 a 1', () => {
    const casos = [
      [ESTADOS.ENGANCHE, -500],
      [ESTADOS.ENGANCHE, 99999],
      [ESTADOS.CIERRE, -100],
      [ESTADOS.CIERRE, 99999],
    ];
    for (const [estado, t] of casos) {
      const { cobertura, revelado } = en(estado, t);
      expect(cobertura).toBeGreaterThanOrEqual(0);
      expect(cobertura).toBeLessThanOrEqual(1);
      expect(revelado).toBeGreaterThanOrEqual(0);
      expect(revelado).toBeLessThanOrEqual(1);
    }
  });

  it('la cobertura baja sin retroceder durante el enganche', () => {
    let anterior = 2;
    for (let t = 0; t <= 2000; t += 100) {
      const { cobertura } = en(ESTADOS.ENGANCHE, t);
      expect(cobertura).toBeLessThanOrEqual(anterior);
      anterior = cobertura;
    }
  });

  it('la cobertura crece sin retroceder durante el cierre', () => {
    let anterior = -1;
    for (let t = 0; t <= 4000; t += 100) {
      const { cobertura } = en(ESTADOS.CIERRE, t);
      expect(cobertura).toBeGreaterThanOrEqual(anterior);
      anterior = cobertura;
    }
  });
});

describe('crearNiebla', () => {
  const azarFijo = () => {
    let n = 0;
    return () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
  };

  it('arma la cantidad de jirones pedida', () => {
    const niebla = crearNiebla({ cantidad: 12, azar: azarFijo() });
    expect(niebla.jirones()).toHaveLength(12);
  });

  it('los jirones se mueven con el tiempo', () => {
    const niebla = crearNiebla({ cantidad: 5, azar: azarFijo() });
    const antes = niebla.jirones().map((j) => j.x);
    niebla.actualizar(1);
    expect(niebla.jirones().map((j) => j.x)).not.toEqual(antes);
  });

  it('los jirones nunca se van tan lejos que dejen un hueco', () => {
    const niebla = crearNiebla({ cantidad: 20, azar: azarFijo() });
    for (let i = 0; i < 5000; i++) niebla.actualizar(1 / 60);

    for (const jiron of niebla.jirones()) {
      expect(jiron.x).toBeGreaterThanOrEqual(-0.35);
      expect(jiron.x).toBeLessThanOrEqual(1.35);
    }
  });
});
