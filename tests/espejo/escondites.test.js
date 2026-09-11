import { describe, it, expect } from 'vitest';
import { lugaresDelFondo, esconder, balanceo, aspectoDelObjeto } from '../../espejo/escondites.js';

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

  // Cuanto cambia el ritmo de un objeto al siguiente sale de la config: en
  // cero, todos se mecen con el mismo periodo (y fases distintas).
  it('la variacion del ritmo sale de lo pedido', () => {
    const parejo = { ...ajuste, variacion: 0 };
    for (const indice of [0, 1, 2]) {
      const antes = balanceo(1000, indice, 50, parejo);
      const unaVueltaDespues = balanceo(1000 + parejo.periodoMs, indice, 50, parejo);
      expect(unaVueltaDespues.giro).toBeCloseTo(antes.giro);
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

describe('aspectoDelObjeto', () => {
  // Con la forma de CONFIG: el espejo y herramientas/fondos.html le pasan la de
  // verdad, y asi la herramienta muestra exactamente lo que hace el espejo.
  const CONFIG_FALSA = {
    fondo: { flotar: { amplitud: 0.08, periodoMs: 3200 }, haloDelLugar: 0.3, msDeAterrizaje: 400 },
    escondidos: {
      halo: 0.18,
      haloAlLeer: 0.45,
      balanceo: { grados: 6, amplitud: 0.05, periodoMs: 4400, variacion: 0.17 },
      resalte: 0.14,
      calmaAlLeer: 0.7,
    },
  };
  const aspecto = (extra) =>
    aspectoDelObjeto({ ahora: 1234, indice: 1, radio: 60, esElegido: false, ...extra }, CONFIG_FALSA);

  it('un escondido lleva su tamaño y un halo tenue, y se mueve', () => {
    const quieto = aspecto();
    expect(quieto.radio).toBe(60);
    expect(quieto.halo).toBeCloseTo(0.18);
    expect(Math.abs(quieto.giro) + Math.abs(quieto.dy)).toBeGreaterThan(0);
  });

  // Asi se sabe de cual habla la ficha: el objeto que se lee crece un poco, se
  // calma y se ilumina.
  it('el que se esta leyendo crece, se calma y se ilumina', () => {
    const quieto = aspecto({ leyendo: 0 });
    const leido = aspecto({ leyendo: 1 });
    expect(leido.radio).toBeCloseTo(60 * 1.14);
    expect(leido.halo).toBeCloseTo(0.45);
    expect(Math.abs(leido.giro)).toBeCloseTo(Math.abs(quieto.giro) * 0.3);
    expect(Math.abs(leido.dy)).toBeCloseTo(Math.abs(quieto.dy) * 0.3);
  });

  it('el que llego volando flota apenas y lleva el halo de su lugar', () => {
    const elegido = aspecto({ esElegido: true });
    expect(elegido.halo).toBeCloseTo(0.3);
    expect(Math.abs(elegido.dy)).toBeLessThanOrEqual(0.08 * 60 + 1e-9);
  });

  // EL ATERRIZAJE NO SALTA. El objeto llega volando sin halo y sin flotacion:
  // si al tocar su lugar aparecieran enteros, el halo se prenderia de golpe y
  // el objeto pegaria un salto, justo en el cuadro mas mirado de la experiencia.
  it('al aterrizar, el halo y la flotacion arrancan de cero y entran de a poco', () => {
    const recien = aspecto({ esElegido: true, desdeElAterrizaje: 0 });
    expect(recien.halo).toBeCloseTo(0);
    expect(recien.dy).toBeCloseTo(0);
    expect(recien.giro).toBeCloseTo(0);
    expect(recien.radio).toBe(60);

    const aMedias = aspecto({ esElegido: true, desdeElAterrizaje: 200 });
    expect(aMedias.halo).toBeGreaterThan(0);
    expect(aMedias.halo).toBeLessThan(0.3);

    expect(aspecto({ esElegido: true, desdeElAterrizaje: 400 }).halo).toBeCloseTo(0.3);
  });

  it('entre dos cuadros seguidos del aterrizaje no hay saltos', () => {
    for (let t = 0; t <= 800; t += 16) {
      const antes = aspecto({ esElegido: true, desdeElAterrizaje: t, ahora: 5000 + t });
      const despues = aspecto({ esElegido: true, desdeElAterrizaje: t + 16, ahora: 5016 + t });
      expect(Math.abs(despues.dy - antes.dy)).toBeLessThan(0.02 * 60);
      expect(Math.abs(despues.halo - antes.halo)).toBeLessThan(0.05);
    }
  });
});
