import { describe, it, expect } from 'vitest';
import {
  atraerHaciaCirculo,
  elegirAtractor,
  separarCuerpos,
  crearCuerpo,
  integrar,
  rebotarContraCirculo,
  limitarACaja,
  paso,
} from '../../espejo/fisica.js';

const CAJA = { x: 0, y: 0, ancho: 1000, alto: 1000 };

describe('integrar', () => {
  it('acelera hacia abajo y avanza segun la velocidad', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 0, radio: 10 });
    integrar(cuerpo, 0.1, 1000);
    expect(cuerpo.vy).toBeCloseTo(100);
    expect(cuerpo.y).toBeCloseTo(10);
  });

  it('conserva la velocidad horizontal', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 0, vx: 50, radio: 10 });
    integrar(cuerpo, 0.2, 1000);
    expect(cuerpo.vx).toBe(50);
    expect(cuerpo.x).toBeCloseTo(10);
  });

  it('hace girar el objeto', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 0, radio: 10, velocidadGiro: 2 });
    integrar(cuerpo, 0.5, 0);
    expect(cuerpo.giro).toBeCloseTo(1);
  });
});

describe('rebotarContraCirculo', () => {
  const cabeza = { x: 100, y: 150, radio: 40 };

  it('no toca nada si esta lejos', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 0, vy: 200, radio: 10 });
    expect(rebotarContraCirculo(cuerpo, cabeza, 0.5)).toBe(false);
    expect(cuerpo.vy).toBe(200);
  });

  it('empuja el objeto fuera del circulo y lo manda hacia arriba', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 120, vy: 200, radio: 10 });
    expect(rebotarContraCirculo(cuerpo, cabeza, 0.5)).toBe(true);
    expect(cuerpo.y).toBeCloseTo(100);
    expect(cuerpo.vy).toBeCloseTo(-100);
  });

  it('no lo frena si ya se esta alejando', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 120, vy: -80, radio: 10 });
    rebotarContraCirculo(cuerpo, cabeza, 0.5);
    expect(cuerpo.vy).toBeCloseTo(-80);
  });

  it('rebota de costado cuando el golpe es lateral', () => {
    const cuerpo = crearCuerpo({ x: 70, y: 150, vx: 100, radio: 10 });
    rebotarContraCirculo(cuerpo, cabeza, 0.5);
    expect(cuerpo.x).toBeCloseTo(50);
    expect(cuerpo.vx).toBeCloseTo(-50);
  });

  it('no divide por cero si el objeto cae justo en el centro', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 150, vy: 200, radio: 10 });
    expect(() => rebotarContraCirculo(cuerpo, cabeza, 0.5)).not.toThrow();
    expect(Number.isFinite(cuerpo.x)).toBe(true);
    expect(Number.isFinite(cuerpo.y)).toBe(true);
  });

  // Sin esto, mover la mano contra un objeto se siente como chocar una pared:
  // el objeto rebota igual estes quieto o manoteando.
  it('un colisionador en movimiento manda el objeto mas lejos que uno quieto', () => {
    const quieta = { x: 100, y: 150, radio: 40, vx: 0, vy: 0 };
    const manoteando = { x: 100, y: 150, radio: 40, vx: 0, vy: -600 };

    const contraQuieta = crearCuerpo({ x: 100, y: 120, vy: 200, radio: 10 });
    const contraManoteo = crearCuerpo({ x: 100, y: 120, vy: 200, radio: 10 });

    rebotarContraCirculo(contraQuieta, quieta, 0.5);
    rebotarContraCirculo(contraManoteo, manoteando, 0.5);

    expect(contraManoteo.vy).toBeLessThan(contraQuieta.vy);
  });

  it('una mano que se aleja no arrastra al objeto hacia ella', () => {
    const alejandose = { x: 100, y: 150, radio: 40, vx: 0, vy: 400 };
    const cuerpo = crearCuerpo({ x: 100, y: 120, vy: 0, radio: 10 });

    rebotarContraCirculo(cuerpo, alejandose, 0.5);
    expect(cuerpo.vy).toBeLessThanOrEqual(0);
  });

  it('un colisionador sin velocidad declarada se comporta como antes', () => {
    const sinVelocidad = { x: 100, y: 150, radio: 40 };
    const cuerpo = crearCuerpo({ x: 100, y: 120, vy: 200, radio: 10 });

    rebotarContraCirculo(cuerpo, sinVelocidad, 0.5);
    expect(cuerpo.vy).toBeCloseTo(-100);
  });

  it('un manotazo lateral empuja el objeto hacia el costado', () => {
    const mano = { x: 70, y: 150, radio: 40, vx: 900, vy: 0 };
    const cuerpo = crearCuerpo({ x: 105, y: 150, vx: 0, radio: 10 });

    rebotarContraCirculo(cuerpo, mano, 0.5);
    expect(cuerpo.vx).toBeGreaterThan(300);
  });

  it('deja el objeto justo tocando el borde, nunca adentro', () => {
    const cuerpo = crearCuerpo({ x: 105, y: 130, vy: 300, radio: 15 });
    rebotarContraCirculo(cuerpo, cabeza, 0.5);
    const distancia = Math.hypot(cuerpo.x - cabeza.x, cuerpo.y - cabeza.y);
    expect(distancia).toBeCloseTo(cabeza.radio + cuerpo.radio);
  });
});

// El modo iman: en lugar de manotear los objetos, la mano los junta a su
// alrededor. El campo es un resorte hacia un anillo de reposo alrededor de la
// palma — afuera del anillo tira, adentro empuja — y dentro del campo los
// objetos se frenan para no pasar de largo. Sin anillo, todo lo capturado
// converge a un unico punto y se encima; sin freno, pasa de largo como una
// honda. Las dos cosas se vieron en pantalla antes de llegar a esta forma.
describe('atraerHaciaCirculo', () => {
  const CAMPO = { fuerza: 4000, amortiguacion: 2.5 };
  // Un cuerpo de radio 10 descansa a 110 del centro (reposo + su radio).
  const atractor = { x: 400, y: 500, alcance: 300, reposo: 100 };

  it('acelera hacia el anillo de reposo a un objeto que esta afuera', () => {
    const cuerpo = crearCuerpo({ x: 250, y: 500, radio: 10 });
    expect(atraerHaciaCirculo(cuerpo, atractor, 0.1, CAMPO)).toBe(true);
    expect(cuerpo.vx).toBeGreaterThan(0);
    expect(cuerpo.vy).toBeCloseTo(0);
  });

  it('empuja hacia afuera a un objeto metido dentro del anillo', () => {
    const cuerpo = crearCuerpo({ x: 360, y: 500, radio: 10 });
    expect(atraerHaciaCirculo(cuerpo, atractor, 0.1, CAMPO)).toBe(true);
    expect(cuerpo.vx).toBeLessThan(0);
  });

  it('no hace nada fuera del alcance', () => {
    const cuerpo = crearCuerpo({ x: 50, y: 500, vx: 30, radio: 10 });
    expect(atraerHaciaCirculo(cuerpo, atractor, 0.1, CAMPO)).toBe(false);
    expect(cuerpo.vx).toBe(30);
  });

  it('el resorte tira mas fuerte cuanto mas lejos del anillo', () => {
    const cerca = crearCuerpo({ x: 270, y: 500, radio: 10 });
    const lejos = crearCuerpo({ x: 130, y: 500, radio: 10 });
    atraerHaciaCirculo(cerca, atractor, 0.1, CAMPO);
    atraerHaciaCirculo(lejos, atractor, 0.1, CAMPO);
    expect(Math.abs(lejos.vx)).toBeGreaterThan(Math.abs(cerca.vx));
  });

  it('frena al objeto dentro del campo para que no pase de largo', () => {
    const cuerpo = crearCuerpo({ x: 400, y: 450, vy: 1000, radio: 10 });
    atraerHaciaCirculo(cuerpo, atractor, 0.2, { fuerza: 0, amortiguacion: 2.5 });
    expect(cuerpo.vy).toBeLessThan(1000);
    expect(cuerpo.vy).toBeGreaterThan(0);
  });

  it('el frenado no depende del tamaño del paso', () => {
    const dePaso = crearCuerpo({ x: 400, y: 450, vy: 1000, radio: 10 });
    const dePasitos = crearCuerpo({ x: 400, y: 450, vy: 1000, radio: 10 });

    atraerHaciaCirculo(dePaso, atractor, 0.4, { fuerza: 0, amortiguacion: 2.5 });
    atraerHaciaCirculo(dePasitos, atractor, 0.2, { fuerza: 0, amortiguacion: 2.5 });
    atraerHaciaCirculo(dePasitos, atractor, 0.2, { fuerza: 0, amortiguacion: 2.5 });

    expect(dePaso.vy).toBeCloseTo(dePasitos.vy, 5);
  });

  it('no divide por cero si el objeto esta justo en el centro', () => {
    const cuerpo = crearCuerpo({ x: 400, y: 500, vx: 100, radio: 10 });
    expect(() => atraerHaciaCirculo(cuerpo, atractor, 0.1, CAMPO)).not.toThrow();
    expect(Number.isFinite(cuerpo.vx) && Number.isFinite(cuerpo.vy)).toBe(true);
  });
});

describe('elegirAtractor', () => {
  const cuerpo = crearCuerpo({ x: 500, y: 500, radio: 20 });

  it('elige la mano mas cercana cuando los campos se superponen', () => {
    const izquierda = { x: 450, y: 500, alcance: 200, reposo: 20 };
    const derecha = { x: 620, y: 500, alcance: 200, reposo: 20 };
    expect(elegirAtractor(cuerpo, [derecha, izquierda])).toBe(izquierda);
  });

  it('no elige una mano fuera de alcance', () => {
    expect(elegirAtractor(cuerpo, [{ x: 800, y: 500, alcance: 100, reposo: 20 }])).toBeNull();
  });
});

// La otra mitad del racimo: los objetos capturados no pueden encimarse. La
// correccion es posicional y ademas anula la velocidad de acercamiento
// (contacto inelastico): solo apartar posiciones deja que el resorte reacelere
// lo corregido y el racimo hierve en vez de asentarse.
describe('separarCuerpos', () => {
  it('aparta de a poco un par solapado, sin inyectarle velocidad', () => {
    const a = crearCuerpo({ x: 500, y: 500, radio: 25 });
    const b = crearCuerpo({ x: 520, y: 500, radio: 25 });

    separarCuerpos([a, b], 1 / 60, 10);

    const distancia = Math.hypot(b.x - a.x, b.y - a.y);
    expect(distancia).toBeGreaterThan(20);
    expect(distancia).toBeLessThan(50);
    expect(a.vx).toBe(0);
    expect(b.vx).toBe(0);
  });

  it('anula la velocidad con la que un par solapado se acerca', () => {
    const a = crearCuerpo({ x: 500, y: 500, vx: 100, radio: 25 });
    const b = crearCuerpo({ x: 520, y: 500, vx: -100, radio: 25 });

    separarCuerpos([a, b], 1 / 60, 10);

    const acercamiento = (b.vx - a.vx) * 1;
    expect(acercamiento).toBeGreaterThanOrEqual(0);
  });

  it('a un par que se esta alejando no lo frena', () => {
    const a = crearCuerpo({ x: 500, y: 500, vx: -80, radio: 25 });
    const b = crearCuerpo({ x: 520, y: 500, vx: 80, radio: 25 });

    separarCuerpos([a, b], 1 / 60, 10);

    expect(a.vx).toBe(-80);
    expect(b.vx).toBe(80);
  });

  it('no toca un par que no se solapa', () => {
    const a = crearCuerpo({ x: 100, y: 500, vx: 10, radio: 25 });
    const b = crearCuerpo({ x: 400, y: 500, vx: -10, radio: 25 });

    separarCuerpos([a, b], 1 / 60, 10);

    expect([a.x, a.vx, b.x, b.vx]).toEqual([100, 10, 400, -10]);
  });

  it('no divide por cero con dos cuerpos exactamente encimados', () => {
    const a = crearCuerpo({ x: 500, y: 500, radio: 25 });
    const b = crearCuerpo({ x: 500, y: 500, radio: 25 });

    expect(() => separarCuerpos([a, b], 1 / 60, 10)).not.toThrow();
    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(0);
  });
});

describe('limitarACaja', () => {
  it('no deja que atraviese el piso', () => {
    const cuerpo = crearCuerpo({ x: 500, y: 995, vy: 400, radio: 20 });
    expect(limitarACaja(cuerpo, CAJA, 0.5, 0.9)).toBe(true);
    expect(cuerpo.y).toBeCloseTo(980);
    expect(cuerpo.vy).toBeCloseTo(-200);
  });

  it('frena el deslizamiento al tocar el piso', () => {
    const cuerpo = crearCuerpo({ x: 500, y: 995, vx: 100, vy: 10, radio: 20 });
    limitarACaja(cuerpo, CAJA, 0.5, 0.9);
    expect(cuerpo.vx).toBeCloseTo(90);
  });

  it('rebota contra las paredes', () => {
    const izquierda = crearCuerpo({ x: 5, y: 500, vx: -100, radio: 20 });
    limitarACaja(izquierda, CAJA, 0.5, 0.9);
    expect(izquierda.x).toBeCloseTo(20);
    expect(izquierda.vx).toBeCloseTo(50);

    const derecha = crearCuerpo({ x: 995, y: 500, vx: 100, radio: 20 });
    limitarACaja(derecha, CAJA, 0.5, 0.9);
    expect(derecha.x).toBeCloseTo(980);
    expect(derecha.vx).toBeCloseTo(-50);
  });

  it('deja en paz a un objeto que va por el medio', () => {
    const cuerpo = crearCuerpo({ x: 500, y: 500, vx: 10, vy: 10, radio: 20 });
    expect(limitarACaja(cuerpo, CAJA, 0.5, 0.9)).toBe(false);
  });

  it('no molesta a un objeto que todavia no entro por arriba', () => {
    const cuerpo = crearCuerpo({ x: 500, y: -80, vy: 200, radio: 30 });
    expect(limitarACaja(cuerpo, CAJA, 0.5, 0.9)).toBe(false);
    expect(cuerpo.y).toBe(-80);
  });
});

describe('paso', () => {
  it('choca contra todos los colisionadores, no solo el primero', () => {
    const mundo = {
      gravedad: 0,
      restitucion: 0.5,
      friccion: 1,
      caja: CAJA,
      colisionadores: [
        { x: 200, y: 500, radio: 50 },
        { x: 800, y: 500, radio: 50 },
      ],
    };

    const izquierdo = crearCuerpo({ x: 240, y: 500, vx: -300, radio: 20 });
    const derecho = crearCuerpo({ x: 760, y: 500, vx: 300, radio: 20 });
    paso([izquierdo, derecho], 1 / 60, mundo);

    expect(izquierdo.vx).toBeGreaterThan(0);
    expect(derecho.vx).toBeLessThan(0);
  });

  it('sin colisionadores no se rompe, que es el caso de la atraccion', () => {
    const cuerpos = [crearCuerpo({ x: 500, y: 0, radio: 10 })];
    expect(() =>
      paso(cuerpos, 1 / 60, {
        gravedad: 1600,
        restitucion: 0.5,
        friccion: 0.98,
        caja: CAJA,
        colisionadores: [],
      }),
    ).not.toThrow();
  });

  it('ningun objeto termina fuera de la caja despues de caer un rato', () => {
    const mundo = {
      gravedad: 1600,
      restitucion: 0.55,
      friccion: 0.98,
      caja: CAJA,
      colisionadores: [{ x: 500, y: 400, radio: 90 }],
    };
    const cuerpos = Array.from({ length: 20 }, (_, i) =>
      crearCuerpo({ x: 100 + i * 40, y: -50, vx: (i % 5) * 20 - 40, radio: 25 }),
    );

    for (let i = 0; i < 600; i++) paso(cuerpos, 1 / 60, mundo);

    for (const cuerpo of cuerpos) {
      expect(cuerpo.x).toBeGreaterThanOrEqual(CAJA.x + cuerpo.radio - 0.5);
      expect(cuerpo.x).toBeLessThanOrEqual(CAJA.x + CAJA.ancho - cuerpo.radio + 0.5);
      expect(cuerpo.y).toBeLessThanOrEqual(CAJA.y + CAJA.alto - cuerpo.radio + 0.5);
      expect(Number.isFinite(cuerpo.x) && Number.isFinite(cuerpo.y)).toBe(true);
    }
  });

  it('los atractores del mundo tiran de los objetos', () => {
    const mundo = {
      gravedad: 0,
      restitucion: 0.5,
      friccion: 1,
      caja: CAJA,
      colisionadores: [],
      atractores: [{ x: 800, y: 500, alcance: 300, reposo: 100 }],
      atraccion: { fuerza: 4000, amortiguacion: 2.5, separacion: 10 },
    };

    const cuerpo = crearCuerpo({ x: 600, y: 500, radio: 20 });
    paso([cuerpo], 1 / 60, mundo);
    expect(cuerpo.vx).toBeGreaterThan(0);
  });

  // En modo iman la mano NO es colisionador: el anillo de reposo del propio
  // campo es lo que regula donde descansan los objetos. El anillo es bien chico
  // (reposoFactor) para que el racimo se abrace a la palma en vez de flotar
  // lejos. Los numeros son los de config.js: si alguien los baja hasta que el
  // iman deja de sostener contra la gravedad, o de calmar el racimo, esto avisa.
  const MUNDO_IMAN = () => ({
    gravedad: 1600,
    restitucion: 0.55,
    friccion: 0.98,
    caja: CAJA,
    colisionadores: [],
    atractores: [{ x: 500, y: 400, alcance: 90 * 2.6, reposo: 90 * 0.3 }],
    atraccion: { fuerza: 8000, amortiguacion: 3.5, separacion: 10 },
  });

  it('un objeto cerca de la mano queda abrazado a la palma en vez de caer', () => {
    // Arranca al costado de la mano, donde nada lo sostiene: sin el iman cae al
    // piso y la prueba falla.
    const cuerpo = crearCuerpo({ x: 650, y: 400, radio: 25 });
    for (let i = 0; i < 600; i++) paso([cuerpo], 1 / 60, MUNDO_IMAN());

    const distancia = Math.hypot(cuerpo.x - 500, cuerpo.y - 400);
    // Cuelga apenas debajo del anillo de reposo (27 + 25 px), pegado a la mano.
    expect(distancia).toBeLessThan(120);
    expect(distancia).toBeGreaterThan(40);
    expect(cuerpo.y).toBeLessThan(750);
  });

  it('combina el iman con una colision de cabeza', () => {
    const mundo = {
      ...MUNDO_IMAN(),
      gravedad: 0,
      colisionadores: [{ x: 500, y: 300, radio: 60 }],
    };
    const cuerpo = crearCuerpo({ x: 500, y: 340, radio: 20 });
    const distanciaInicialAlIman = Math.hypot(cuerpo.x - 500, cuerpo.y - 500);

    mundo.atractores = [{ x: 500, y: 500, alcance: 300, reposo: 30 }];
    paso([cuerpo], 1 / 60, mundo);

    expect(Math.hypot(cuerpo.x - 500, cuerpo.y - 500)).toBeLessThan(distanciaInicialAlIman);
    expect(Math.hypot(cuerpo.x - 500, cuerpo.y - 300)).toBeGreaterThanOrEqual(80);
  });

  it('solo separa cuerpos capturados por el iman', () => {
    const mundo = {
      ...MUNDO_IMAN(),
      gravedad: 0,
      atractores: [{ x: 100, y: 400, alcance: 100, reposo: 20 }],
    };
    const capturadoA = crearCuerpo({ x: 140, y: 400, radio: 30 });
    const capturadoB = crearCuerpo({ x: 145, y: 400, radio: 30 });
    const fuera = crearCuerpo({ x: 230, y: 400, radio: 60 });

    paso([capturadoA, capturadoB, fuera], 1 / 60, mundo);

    expect(Math.hypot(capturadoB.x - capturadoA.x, capturadoB.y - capturadoA.y)).toBeGreaterThan(5);
    expect(fuera.x).toBe(230);
    expect(fuera.y).toBe(400);
  });

  // El zumbido que se vio en pantalla: el objeto capturado nunca se aquietaba,
  // porque el tiron continuo del iman peleaba con el rebote del colisionador.
  it('un objeto capturado se aquieta en vez de vibrar contra la mano', () => {
    const cuerpo = crearCuerpo({ x: 650, y: 400, radio: 25 });
    for (let i = 0; i < 600; i++) paso([cuerpo], 1 / 60, MUNDO_IMAN());

    expect(Math.hypot(cuerpo.vx, cuerpo.vy)).toBeLessThan(80);
  });

  // El bollo que se vio en pantalla: todos los capturados convergian al mismo
  // punto de equilibrio y quedaban encimados en un solo lugar.
  it('dos objetos capturados no quedan encimados', () => {
    const a = crearCuerpo({ x: 650, y: 400, radio: 25 });
    const b = crearCuerpo({ x: 360, y: 380, radio: 25 });
    for (let i = 0; i < 600; i++) paso([a, b], 1 / 60, MUNDO_IMAN());

    expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(40);
  });

  it('los objetos se aquietan en el piso en vez de rebotar para siempre', () => {
    const mundo = {
      gravedad: 1600,
      restitucion: 0.55,
      friccion: 0.98,
      caja: CAJA,
      colisionadores: [],
    };
    const cuerpo = crearCuerpo({ x: 500, y: 0, vx: 300, radio: 20 });

    for (let i = 0; i < 1200; i++) paso([cuerpo], 1 / 60, mundo);

    expect(Math.abs(cuerpo.vx)).toBeLessThan(20);
    expect(cuerpo.y).toBeGreaterThan(900);
  });

  it.each([
    ['borde izquierdo', 20, 30],
    ['borde derecho', 980, -30],
  ])('la separacion no expulsa el racimo por el %s', (_, x, separacion) => {
    const mundo = {
      ...MUNDO_IMAN(),
      gravedad: 0,
      atractores: [{ x, y: 500, alcance: 200, reposo: 20 }],
    };
    const a = crearCuerpo({ x, y: 500, radio: 30 });
    const b = crearCuerpo({ x: x + separacion, y: 500, radio: 30 });

    paso([a, b], 1 / 60, mundo);

    for (const cuerpo of [a, b]) {
      expect(cuerpo.x - cuerpo.radio).toBeGreaterThanOrEqual(CAJA.x);
      expect(cuerpo.x + cuerpo.radio).toBeLessThanOrEqual(CAJA.x + CAJA.ancho);
    }
  });

  it('la separacion no hunde un racimo en el piso', () => {
    const mundo = {
      ...MUNDO_IMAN(),
      gravedad: 0,
      atractores: [{ x: 500, y: 980, alcance: 200, reposo: 20 }],
    };
    const a = crearCuerpo({ x: 500, y: 970, radio: 30 });
    const b = crearCuerpo({ x: 500, y: 980, radio: 30 });

    paso([a, b], 1 / 60, mundo);

    expect(a.y + a.radio).toBeLessThanOrEqual(CAJA.y + CAJA.alto);
    expect(b.y + b.radio).toBeLessThanOrEqual(CAJA.y + CAJA.alto);
  });
});
