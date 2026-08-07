import { describe, it, expect } from 'vitest';
import {
  crearCuerpo,
  integrar,
  rebotarContraCirculo,
  atraerHaciaCirculo,
  repelerDesdeCirculo,
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

describe('atraerHaciaCirculo', () => {
  it('acelera el objeto hacia el centro del circulo', () => {
    const cuerpo = crearCuerpo({ x: 60, y: 100, radio: 10 });
    const mano = { x: 100, y: 100, alcance: 80, fuerza: 1000 };

    expect(atraerHaciaCirculo(cuerpo, mano, 0.1)).toBe(true);
    expect(cuerpo.vx).toBeGreaterThan(0);
    expect(cuerpo.vy).toBeCloseTo(0);
  });

  it('no atrae objetos fuera de alcance', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 100, radio: 10 });
    const mano = { x: 100, y: 100, alcance: 50, fuerza: 1000 };

    expect(atraerHaciaCirculo(cuerpo, mano, 0.1)).toBe(false);
    expect(cuerpo.vx).toBe(0);
  });
});

describe('repelerDesdeCirculo', () => {
  it('acelera el objeto alejandolo del centro del circulo', () => {
    const cuerpo = crearCuerpo({ x: 140, y: 100, radio: 10 });
    const mano = { x: 100, y: 100, alcance: 80, fuerza: 1000 };

    expect(repelerDesdeCirculo(cuerpo, mano, 0.1)).toBe(true);
    expect(cuerpo.vx).toBeGreaterThan(0);
    expect(cuerpo.vy).toBeCloseTo(0);
  });

  it('no repele objetos fuera de alcance', () => {
    const cuerpo = crearCuerpo({ x: 200, y: 100, radio: 10 });
    const mano = { x: 100, y: 100, alcance: 50, fuerza: 1000 };

    expect(repelerDesdeCirculo(cuerpo, mano, 0.1)).toBe(false);
    expect(cuerpo.vx).toBe(0);
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

  it('permite que un colisionador atraiga en vez de rebotar', () => {
    const cuerpo = crearCuerpo({ x: 60, y: 100, radio: 10 });
    paso([cuerpo], 1 / 60, {
      gravedad: 0,
      restitucion: 0.5,
      friccion: 1,
      caja: CAJA,
      colisionadores: [
        { x: 100, y: 100, radio: 40, interaccion: 'atraer', alcance: 80, fuerza: 1200 },
      ],
    });

    expect(cuerpo.vx).toBeGreaterThan(0);
  });

  it('permite que un colisionador repela objetos', () => {
    const cuerpo = crearCuerpo({ x: 140, y: 100, radio: 10 });
    paso([cuerpo], 1 / 60, {
      gravedad: 0,
      restitucion: 0.5,
      friccion: 1,
      caja: CAJA,
      colisionadores: [
        { x: 100, y: 100, radio: 40, interaccion: 'repeler', alcance: 80, fuerza: 1200 },
      ],
    });

    expect(cuerpo.vx).toBeGreaterThan(0);
  });

  it('no mueve un cuerpo fijo porque esta agarrado por una mano', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 100, vx: 1000, vy: 1000, radio: 20 });
    cuerpo.fijo = true;

    paso([cuerpo], 1, {
      gravedad: 1600,
      restitucion: 0.5,
      friccion: 1,
      caja: CAJA,
      colisionadores: [{ x: 100, y: 100, radio: 200 }],
    });

    expect(cuerpo.x).toBe(100);
    expect(cuerpo.y).toBe(100);
    expect(cuerpo.vx).toBe(1000);
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
});
