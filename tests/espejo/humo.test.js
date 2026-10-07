import { describe, it, expect } from 'vitest';
import { acercarHumo, alfaDeHumo } from '../../espejo/humo.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { enganche: 2000, humo: 3000, revelacion: 2500, cierre: 3000 };
const HUMO = {
  fraccionDeEntrada: 0.55,
  msDeSalida: 1400,
  enReposo: 0.35,
  enEnganche: 0.6,
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

  // AL DETECTAR A LA PERSONA EL HUMO NO SE VA: empieza a espesarse desde el
  // del reposo. Se cortaba de golpe, el espejo quedaba limpio un momento y el
  // humo volvia a entrar desde cero: se leia como que las nubes se iban y
  // volvian.
  it('en el enganche el humo del reposo empieza a espesarse', () => {
    expect(alfa(ESTADOS.ENGANCHE, 0)).toBeCloseTo(HUMO.enReposo);
    expect(alfa(ESTADOS.ENGANCHE, 1000)).toBeGreaterThan(HUMO.enReposo);
    expect(alfa(ESTADOS.ENGANCHE, TIEMPOS.enganche)).toBeCloseTo(HUMO.enEnganche);
    // Un enganche que se estira —un rostro que va y viene— no pasa de ahi.
    expect(alfa(ESTADOS.ENGANCHE, 60000)).toBeCloseTo(HUMO.enEnganche);
  });

  it('se espesa durante el humo hasta tapar todo, desde donde lo dejo el enganche', () => {
    expect(alfa(ESTADOS.HUMO, 0)).toBeCloseTo(alfa(ESTADOS.ENGANCHE, TIEMPOS.enganche));
    expect(alfa(ESTADOS.HUMO, 800)).toBeGreaterThan(HUMO.enEnganche);
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

// Lo que se ve sigue a alfaDeHumo, pero nunca a los saltos. Cuando el estado
// cambia a mitad de camino —alguien que se va en pleno enganche, una sesion que
// se corta con el humo espeso— el humo va desde donde estaba, y no se corta.
describe('acercarHumo', () => {
  it('va hacia el objetivo sin pasar de su velocidad', () => {
    expect(acercarHumo(0.6, 0, 0.1, 1.2)).toBeCloseTo(0.48);
    expect(acercarHumo(0.2, 1, 0.25, 1.2)).toBeCloseTo(0.5);
  });

  it('llega al objetivo sin pasarse', () => {
    expect(acercarHumo(0.34, 0.35, 0.1, 1.2)).toBe(0.35);
    expect(acercarHumo(0.36, 0.35, 0.1, 1.2)).toBe(0.35);
  });

  // Las curvas de alfaDeHumo ya son suaves: seguidas con la velocidad de la
  // config no se atrasan, y el humo llega tapando al final del estado.
  it('no atrasa una curva que ya es suave', () => {
    let visto = alfa(ESTADOS.EXPLORACION, 0);
    for (let t = 16; t <= HUMO.msDeSalida; t += 16) {
      visto = acercarHumo(visto, alfa(ESTADOS.EXPLORACION, t), 0.016, 1.2);
      expect(Math.abs(visto - alfa(ESTADOS.EXPLORACION, t))).toBeLessThan(1e-9);
    }
  });
});
