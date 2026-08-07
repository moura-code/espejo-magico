import { describe, it, expect } from 'vitest';
import { actualizarAgarres } from '../../espejo/agarre.js';
import { crearCuerpo } from '../../espejo/fisica.js';

const OPCIONES = {
  aperturaParaAgarrar: 1.4,
  aperturaParaSoltar: 1.7,
  alcance: 1.2,
};

const mano = (apertura = 1.1) => ({
  lado: 'Right',
  apertura,
  radio: 50,
  palma: { x: 100, y: 100 },
});

function objeto(x = 120, y = 100) {
  return { cuerpo: crearCuerpo({ x, y, radio: 20 }) };
}

describe('actualizarAgarres', () => {
  it('agarra el objeto cercano cuando la mano esta cerrada', () => {
    const objetos = [objeto()];

    actualizarAgarres(objetos, [mano()], new Map([['Right', { vx: 10, vy: 20 }]]), OPCIONES);

    expect(objetos[0].agarradoPor).toBe('Right');
    expect(objetos[0].cuerpo.fijo).toBe(true);
    expect(objetos[0].cuerpo.x).toBe(100);
    expect(objetos[0].cuerpo.vy).toBe(20);
  });

  it('mantiene el objeto pegado mientras la mano siga cerrada', () => {
    const objetos = [objeto()];
    objetos[0].agarradoPor = 'Right';

    actualizarAgarres(
      objetos,
      [{ ...mano(), palma: { x: 220, y: 180 } }],
      new Map([['Right', { vx: 30, vy: -40 }]]),
      OPCIONES,
    );

    expect(objetos[0].cuerpo.x).toBe(220);
    expect(objetos[0].cuerpo.y).toBe(180);
    expect(objetos[0].cuerpo.vy).toBe(-40);
  });

  it('suelta el objeto cuando la mano se abre', () => {
    const objetos = [objeto()];
    objetos[0].agarradoPor = 'Right';
    objetos[0].cuerpo.fijo = true;

    actualizarAgarres(objetos, [mano(2)], new Map([['Right', { vx: 80, vy: -90 }]]), OPCIONES);

    expect(objetos[0].agarradoPor).toBeNull();
    expect(objetos[0].cuerpo.fijo).toBe(false);
    expect(objetos[0].cuerpo.vx).toBe(80);
  });

  it('no agarra objetos fuera de alcance', () => {
    const objetos = [objeto(500, 100)];

    actualizarAgarres(objetos, [mano()], new Map(), OPCIONES);

    expect(objetos[0].agarradoPor).toBeUndefined();
  });
});
