import { describe, it, expect } from 'vitest';
import { crearPool, fuenteDeObjetos } from '../../espejo/objetos.js';
import { crearCuerpo } from '../../espejo/fisica.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const MUNDO = {
  gravedad: 0,
  restitucion: 0.5,
  friccion: 1,
  caja: { x: 0, y: 0, ancho: 1000, alto: 1000 },
  colisionadores: [],
};
const cuerpo = () => crearCuerpo({ x: 500, y: 100, radio: 10 });

describe('crearPool', () => {
  it('guarda lo que aparece', () => {
    const pool = crearPool({ maximo: 3, vidaMs: 1000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    expect(pool.vivos()).toHaveLength(1);
    expect(pool.vivos()[0].definicion.img).toBe('a.png');
  });

  it('respeta el maximo tirando el mas viejo', () => {
    const pool = crearPool({ maximo: 2, vidaMs: 10000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.aparecer({ img: 'b.png' }, cuerpo(), 10);
    pool.aparecer({ img: 'c.png' }, cuerpo(), 20);

    expect(pool.vivos()).toHaveLength(2);
    expect(pool.vivos().map((o) => o.definicion.img)).toEqual(['b.png', 'c.png']);
  });

  it('mantiene alfa 1 mientras al objeto le sobra vida', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 2000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.actualizar(1 / 60, 1000, MUNDO);
    expect(pool.vivos()[0].alfa).toBe(1);
  });

  it('lo desvanece en el ultimo medio segundo', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 2000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.actualizar(1 / 60, 1750, MUNDO);
    expect(pool.vivos()[0].alfa).toBeCloseTo(0.5);
  });

  it('retira los vencidos', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 1000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.aparecer({ img: 'b.png' }, cuerpo(), 800);
    pool.actualizar(1 / 60, 1100, MUNDO);

    expect(pool.vivos().map((o) => o.definicion.img)).toEqual(['b.png']);
  });

  it('mueve los cuerpos al actualizar', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 5000 });
    pool.aparecer({ img: 'a.png' }, crearCuerpo({ x: 500, y: 100, vy: 60, radio: 10 }), 0);
    pool.actualizar(0.5, 100, MUNDO);
    expect(pool.vivos()[0].cuerpo.y).toBeCloseTo(130);
  });

  it('el presupuesto se respeta pase lo que pase', () => {
    const pool = crearPool({ maximo: 40, vidaMs: 100000 });
    for (let i = 0; i < 500; i++) pool.aparecer({ img: `${i}.png` }, cuerpo(), i);
    expect(pool.vivos()).toHaveLength(40);
  });

  it('vaciar los saca a todos', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 5000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.vaciar();
    expect(pool.vivos()).toHaveLength(0);
  });

  it('actualizar sin objetos no se rompe', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 1000 });
    expect(() => pool.actualizar(1 / 60, 0, MUNDO)).not.toThrow();
  });
});

describe('retirar', () => {
  it('hace que todo lo vivo se vaya en el plazo pedido', () => {
    const pool = crearPool({ maximo: 10, vidaMs: 20000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.aparecer({ img: 'b.png' }, cuerpo(), 100);

    pool.retirar(1000, 600);

    pool.actualizar(1 / 60, 1500, MUNDO);
    expect(pool.vivos()).toHaveLength(2);

    pool.actualizar(1 / 60, 1650, MUNDO);
    expect(pool.vivos()).toHaveLength(0);
  });

  it('los desvanece en vez de hacerlos desaparecer de golpe', () => {
    const pool = crearPool({ maximo: 10, vidaMs: 20000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);

    pool.retirar(1000, 600);
    pool.actualizar(1 / 60, 1300, MUNDO);

    const alfa = pool.vivos()[0].alfa;
    expect(alfa).toBeGreaterThan(0);
    expect(alfa).toBeLessThan(1);
  });

  it('no le alarga la vida a un objeto que ya se estaba por ir', () => {
    const pool = crearPool({ maximo: 10, vidaMs: 1000 });
    pool.aparecer({ img: 'viejo.png' }, cuerpo(), 0);

    pool.retirar(900, 5000);

    pool.actualizar(1 / 60, 1100, MUNDO);
    expect(pool.vivos()).toHaveLength(0);
  });

  it('no toca a los que aparecen despues', () => {
    const pool = crearPool({ maximo: 10, vidaMs: 20000 });
    pool.aparecer({ img: 'viejo.png' }, cuerpo(), 0);
    pool.retirar(1000, 500);
    pool.aparecer({ img: 'nuevo.png' }, cuerpo(), 1100);

    pool.actualizar(1 / 60, 2000, MUNDO);
    expect(pool.vivos().map((o) => o.definicion.img)).toEqual(['nuevo.png']);
  });
});

describe('fuenteDeObjetos', () => {
  const CIVIL = { id: 'civil', objetos: [{ img: 'grua.png' }] };
  const QUIMICA = { id: 'quimica', objetos: [{ img: 'matraz.png' }] };
  const TODAS = [CIVIL, QUIMICA];

  it('en reposo no caen objetos', () => {
    expect(fuenteDeObjetos(ESTADOS.ATRACCION, null, TODAS)).toBeNull();
  });

  it('desde la revelacion caen solo los de la carrera sorteada', () => {
    expect(fuenteDeObjetos(ESTADOS.REVELACION, CIVIL, TODAS)).toEqual(CIVIL.objetos);
    expect(fuenteDeObjetos(ESTADOS.ESCENA, CIVIL, TODAS)).toEqual(CIVIL.objetos);
  });

  // La preparacion queda limpia para que la revelacion muestre una sola carrera.
  it('no aparece nada durante el enganche ni el sorteo', () => {
    expect(fuenteDeObjetos(ESTADOS.ENGANCHE, null, TODAS)).toBeNull();
    expect(fuenteDeObjetos(ESTADOS.SORTEO, CIVIL, TODAS)).toBeNull();
  });

  it('no aparece nada durante el cierre', () => {
    expect(fuenteDeObjetos(ESTADOS.CIERRE, CIVIL, TODAS)).toBeNull();
  });

  it('sin carrera no inventa objetos', () => {
    expect(fuenteDeObjetos(ESTADOS.ESCENA, null, TODAS)).toBeNull();
  });
});
