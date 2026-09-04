import { describe, it, expect } from 'vitest';
import { alfaDeHumo } from '../../espejo/humo.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { enganche: 2000, humo: 3000, revelacion: 2500, cierre: 3000 };
const HUMO = {
  fraccionDeEntrada: 0.55,
  msDeSalida: 1400,
  enReposo: 0.35,
  msParaAsentarse: 1500,
  msDeRespiro: 5200,
};

const alfa = (estado, transcurrido) =>
  alfaDeHumo({ estado, transcurrido, tiempos: TIEMPOS, humo: HUMO });

describe('alfaDeHumo', () => {
  // EL ESPEJO DESCANSA CUBIERTO DE HUMO. Es la imagen que ve la fila mientras
  // espera, y era lo unico de la experiencia que estaba quieto: el video ya
  // estaba cargado y en loop, sin usarse.
  it('en reposo el espejo queda cubierto de humo', () => {
    expect(alfa(ESTADOS.ATRACCION, 0)).toBe(0);
    expect(alfa(ESTADOS.ATRACCION, 4000)).toBeGreaterThan(0);
  });

  it('el humo del reposo nunca tapa tanto como el de la transicion', () => {
    for (let t = 0; t <= 40000; t += 137) {
      expect(alfa(ESTADOS.ATRACCION, t)).toBeLessThanOrEqual(HUMO.enReposo);
      expect(alfa(ESTADOS.ATRACCION, t)).toBeGreaterThanOrEqual(0);
    }
  });

  // Sin la entrada, al volver del cierre el humo aparecia de golpe a la mitad
  // de su valor: un salto justo en el cuadro en que la pantalla se apaga.
  it('el humo del reposo entra desde cero, no de golpe', () => {
    expect(alfa(ESTADOS.ATRACCION, 0)).toBe(0);
    expect(alfa(ESTADOS.ATRACCION, 200)).toBeLessThan(alfa(ESTADOS.ATRACCION, 1400));
  });

  // Respira: sin eso es una textura fija y la pantalla de espera se ve congelada
  // desde la fila, que es exactamente lo que no queremos que parezca.
  it('el humo del reposo respira', () => {
    const valores = [];
    for (let t = 4000; t <= 4000 + HUMO.msDeRespiro; t += 100) {
      valores.push(alfa(ESTADOS.ATRACCION, t));
    }
    expect(Math.max(...valores) - Math.min(...valores)).toBeGreaterThan(0.02);
  });

  it('en el enganche no hay humo', () => {
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
    expect(alfa(ESTADOS.EXPLORACION, 0)).toBe(1);
    expect(alfa(ESTADOS.EXPLORACION, 700)).toBeLessThan(1);
    expect(alfa(ESTADOS.EXPLORACION, 700)).toBeGreaterThan(0);
    expect(alfa(ESTADOS.EXPLORACION, HUMO.msDeSalida)).toBe(0);
  });

  it('no vuelve a aparecer mientras dura la eleccion', () => {
    expect(alfa(ESTADOS.EXPLORACION, 20000)).toBe(0);
  });

  // El cierre ya tiene su propio desvanecido: el fondo y la ficha se van
  // juntos. Meterle humo encima seria taparlo dos veces.
  it('no hay humo durante el cierre', () => {
    expect(alfa(ESTADOS.CIERRE, 0)).toBe(0);
    expect(alfa(ESTADOS.CIERRE, 1000)).toBe(0);
    expect(alfa(ESTADOS.CIERRE, 1200)).toBe(0);
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
