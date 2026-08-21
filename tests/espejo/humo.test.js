import { describe, it, expect } from 'vitest';
import { alfaDeHumo } from '../../espejo/humo.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { enganche: 2000, humo: 3000, revelacion: 2500, cierre: 3000 };
const HUMO = { fraccionDeEntrada: 0.55, msDeSalida: 1400 };

const alfa = (estado, transcurrido) =>
  alfaDeHumo({ estado, transcurrido, tiempos: TIEMPOS, humo: HUMO });

describe('alfaDeHumo', () => {
  it('en reposo y en el enganche no hay humo', () => {
    expect(alfa(ESTADOS.ATRACCION, 0)).toBe(0);
    expect(alfa(ESTADOS.ATRACCION, 9000)).toBe(0);
    expect(alfa(ESTADOS.ENGANCHE, 1000)).toBe(0);
  });

  it('se espesa durante el humo hasta tapar todo', () => {
    expect(alfa(ESTADOS.HUMO, 0)).toBe(0);
    expect(alfa(ESTADOS.HUMO, 800)).toBeGreaterThan(0);
    expect(alfa(ESTADOS.HUMO, 800)).toBeLessThan(1);
    expect(alfa(ESTADOS.HUMO, 1650)).toBe(1);
  });

  it('crece siempre, sin volver atras', () => {
    let anterior = -1;
    for (let t = 0; t <= TIEMPOS.humo; t += 50) {
      const actual = alfa(ESTADOS.HUMO, t);
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  // El humo tiene que estar espeso cuando cambia el estado: si bajara antes, se
  // veria a los objetos aparecer de la nada, que es justo lo que viene a tapar.
  it('llega tapando al final del estado', () => {
    expect(alfa(ESTADOS.HUMO, TIEMPOS.humo)).toBe(1);
  });

  it('arranca la eleccion tapando y se disipa dejando los objetos', () => {
    expect(alfa(ESTADOS.ELECCION, 0)).toBe(1);
    expect(alfa(ESTADOS.ELECCION, 700)).toBeLessThan(1);
    expect(alfa(ESTADOS.ELECCION, 700)).toBeGreaterThan(0);
    expect(alfa(ESTADOS.ELECCION, HUMO.msDeSalida)).toBe(0);
  });

  it('no vuelve a aparecer mientras dura la eleccion', () => {
    expect(alfa(ESTADOS.ELECCION, 20000)).toBe(0);
  });

  it('no hay humo en la revelacion, la escena ni el cierre', () => {
    expect(alfa(ESTADOS.REVELACION, 0)).toBe(0);
    expect(alfa(ESTADOS.REVELACION, 1200)).toBe(0);
    expect(alfa(ESTADOS.ESCENA, 5000)).toBe(0);
    expect(alfa(ESTADOS.CIERRE, 1000)).toBe(0);
  });

  it('nunca se sale del rango, ni con tiempos raros', () => {
    for (const estado of Object.values(ESTADOS)) {
      for (const t of [-5000, -1, 0, 1, 999999]) {
        const valor = alfa(estado, t);
        expect(valor).toBeGreaterThanOrEqual(0);
        expect(valor).toBeLessThanOrEqual(1);
      }
    }
  });
});
