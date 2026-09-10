import { describe, it, expect } from 'vitest';
import { lugaresDelFondo, esconder, balanceo } from '../../espejo/escondites.js';

const POR_DEFECTO = {
  lugar: { x: 0.2, y: 0.22, escala: 0.16 },
  escondites: [
    { x: 0.8, y: 0.2, escala: 0.1 },
    { x: 0.15, y: 0.45, escala: 0.1 },
  ],
};

describe('lugaresDelFondo', () => {
  // El primero es el del objeto que llega volando del carrusel; despues, los
  // escondites en su orden.
  it('el primero es el lugar del que vuela y despues los escondites', () => {
    const fondo = {
      img: 'a.jpg',
      lugar: { x: 0.8, y: 0.15, escala: 0.15 },
      escondites: [{ x: 0.1, y: 0.2, escala: 0.11 }],
    };
    expect(lugaresDelFondo(fondo, POR_DEFECTO)).toEqual([
      { x: 0.8, y: 0.15, escala: 0.15 },
      { x: 0.1, y: 0.2, escala: 0.11 },
    ]);
  });

  // Un fondo sin lugares —el respaldo vectorial, una carrera sin fondos— igual
  // esconde sus objetos, y en la periferia: los de config son un seguro.
  it('lo que el fondo no declara sale de los valores por defecto', () => {
    const esperados = [
      { x: 0.2, y: 0.22, escala: 0.16 },
      { x: 0.8, y: 0.2, escala: 0.1 },
      { x: 0.15, y: 0.45, escala: 0.1 },
    ];
    expect(lugaresDelFondo({ img: 'a.png' }, POR_DEFECTO)).toEqual(esperados);
    expect(lugaresDelFondo(null, POR_DEFECTO)).toEqual(esperados);
  });

  // Mezclar escondites del fondo con los de config podria poner dos objetos uno
  // encima del otro: si el fondo declara los suyos, van solo esos.
  it('si el fondo declara escondites, no se mezclan con los de config', () => {
    const fondo = { img: 'a.jpg', escondites: [{ x: 0.1, y: 0.2, escala: 0.11 }] };
    expect(lugaresDelFondo(fondo, POR_DEFECTO)).toEqual([
      { x: 0.2, y: 0.22, escala: 0.16 },
      { x: 0.1, y: 0.2, escala: 0.11 },
    ]);
  });
});

describe('esconder', () => {
  const b = { img: 'b.png' };
  const c = { img: 'c.png' };
  const arriba = { x: 0.8, y: 0.2, escala: 0.1 };
  const abajo = { x: 0.15, y: 0.45, escala: 0.1 };

  it('pone cada objeto en su escondite, en orden', () => {
    expect(esconder([b, c], [arriba, abajo])).toEqual([
      { definicion: b, lugar: arriba },
      { definicion: c, lugar: abajo },
    ]);
  });

  // Meter en cualquier lado un objeto sin escondite es arriesgarse a taparle la
  // cara a la persona, que es justo lo que la periferia existe para evitar.
  it('un objeto sin escondite no se muestra', () => {
    expect(esconder([b, c], [arriba])).toEqual([{ definicion: b, lugar: arriba }]);
  });

  it('un escondite sin objeto queda vacio', () => {
    expect(esconder([b], [arriba, abajo])).toEqual([{ definicion: b, lugar: arriba }]);
    expect(esconder([], [arriba])).toEqual([]);
  });
});

describe('balanceo', () => {
  const ajuste = { grados: 6, amplitud: 0.06, periodoMs: 4000 };
  const GRADO = Math.PI / 180;

  it('se mece dentro de lo pedido', () => {
    for (let ahora = 0; ahora < 12000; ahora += 53) {
      for (const indice of [0, 1, 2, 3]) {
        const { dy, giro } = balanceo(ahora, indice, 50, ajuste);
        expect(Math.abs(giro)).toBeLessThanOrEqual(6 * GRADO + 1e-9);
        expect(Math.abs(dy)).toBeLessThanOrEqual(3 + 1e-9); // 0.06 radios de 50
      }
    }
  });

  // El movimiento es lo que delata a un objeto escondido: tiene que haberlo.
  it('se mueve de verdad', () => {
    const giros = new Set();
    for (let ahora = 0; ahora < 4000; ahora += 200) {
      giros.add(balanceo(ahora, 0, 50, ajuste).giro.toFixed(3));
    }
    expect(giros.size).toBeGreaterThan(5);
  });

  // Tres objetos meciendose al unisono se leen como una animacion pegada encima
  // del fondo; cada uno a su ritmo, como cosas que estan ahi.
  it('cada objeto se mece a su propio ritmo', () => {
    for (const ahora of [0, 1000, 2500, 7000]) {
      const giros = [0, 1, 2, 3].map((indice) => balanceo(ahora, indice, 50, ajuste).giro.toFixed(4));
      expect(new Set(giros).size).toBe(4);
    }
  });

  // Un movimiento a los saltos se lee como un parpadeo, que es lo primero que
  // pidio evitar la catedra: entre dos cuadros seguidos cambia apenas.
  it('es continuo: entre dos cuadros seguidos cambia muy poco', () => {
    for (const indice of [0, 1, 2, 3]) {
      for (let ahora = 0; ahora < 9000; ahora += 16) {
        const a = balanceo(ahora, indice, 50, ajuste);
        const b = balanceo(ahora + 16, indice, 50, ajuste);
        expect(Math.abs(b.giro - a.giro)).toBeLessThan(0.3 * GRADO);
        expect(Math.abs(b.dy - a.dy)).toBeLessThan(0.1);
      }
    }
  });
});
