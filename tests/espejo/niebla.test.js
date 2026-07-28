import { describe, it, expect } from 'vitest';
import { calcularNiebla, crearNiebla } from '../../espejo/niebla.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { sorteo: 3000, revelacion: 2000, cierre: 4000 };
const en = (estado, transcurrido) => calcularNiebla({ estado, transcurrido, tiempos: TIEMPOS });

describe('calcularNiebla', () => {
  it('no hay niebla en atraccion ni en enganche', () => {
    expect(en(ESTADOS.ATRACCION, 0)).toEqual({ cobertura: 0, revelado: 0 });
    expect(en(ESTADOS.ENGANCHE, 1000)).toEqual({ cobertura: 0, revelado: 0 });
  });

  it('la niebla entra rapido al empezar el sorteo', () => {
    expect(en(ESTADOS.SORTEO, 0).cobertura).toBe(0);
    expect(en(ESTADOS.SORTEO, 600).cobertura).toBeCloseTo(0.5);
    expect(en(ESTADOS.SORTEO, 1200).cobertura).toBe(1);
  });

  it('la niebla se queda cerrada el resto del sorteo', () => {
    expect(en(ESTADOS.SORTEO, 2900)).toEqual({ cobertura: 1, revelado: 0 });
  });

  it('en la revelacion la niebla sigue puesta y el agujero se abre', () => {
    expect(en(ESTADOS.REVELACION, 0)).toEqual({ cobertura: 1, revelado: 0 });
    expect(en(ESTADOS.REVELACION, 1000).revelado).toBeCloseTo(0.5);
    expect(en(ESTADOS.REVELACION, 2000)).toEqual({ cobertura: 1, revelado: 1 });
  });

  it('en escena ya no queda nada de niebla', () => {
    expect(en(ESTADOS.ESCENA, 5000)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('en cierre tampoco', () => {
    expect(en(ESTADOS.CIERRE, 100).cobertura).toBe(0);
  });

  it('nunca devuelve valores fuera de 0 a 1', () => {
    const casos = [
      [ESTADOS.SORTEO, -500],
      [ESTADOS.SORTEO, 99999],
      [ESTADOS.REVELACION, -100],
      [ESTADOS.REVELACION, 99999],
    ];
    for (const [estado, t] of casos) {
      const { cobertura, revelado } = en(estado, t);
      expect(cobertura).toBeGreaterThanOrEqual(0);
      expect(cobertura).toBeLessThanOrEqual(1);
      expect(revelado).toBeGreaterThanOrEqual(0);
      expect(revelado).toBeLessThanOrEqual(1);
    }
  });

  it('la cobertura crece sin retroceder durante el sorteo', () => {
    let anterior = -1;
    for (let t = 0; t <= 3000; t += 100) {
      const { cobertura } = en(ESTADOS.SORTEO, t);
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
