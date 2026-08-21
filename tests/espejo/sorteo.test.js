import { describe, it, expect } from 'vitest';
import { barajar, crearSorteo } from '../../espejo/sorteo.js';

const IDS = [
  'mecanica',
  'alimentos',
  'produccion',
  'electrica',
  'computacion',
  'agrimensura',
  'sistemas-comunicacion',
  'fisico-matematico',
  'civil',
  'quimica',
  'naval',
];

describe('barajar', () => {
  it('devuelve los mismos elementos sin repetir ni perder ninguno', () => {
    const salida = barajar(IDS, Math.random);
    expect(salida).toHaveLength(IDS.length);
    expect([...salida].sort()).toEqual([...IDS].sort());
  });

  it('no toca el arreglo original', () => {
    const original = [...IDS];
    barajar(IDS, Math.random);
    expect(IDS).toEqual(original);
  });

  it('es determinista con un azar determinista', () => {
    expect(barajar(IDS, () => 0.5)).toEqual(barajar(IDS, () => 0.5));
  });
});

describe('crearSorteo', () => {
  it('entrega todas las carreras antes de repetir ninguna', () => {
    const sorteo = crearSorteo({ ids: IDS });
    const salidas = IDS.map(() => sorteo.siguiente());
    expect(new Set(salidas).size).toBe(IDS.length);
  });

  it('sigue sin repetir en la segunda vuelta completa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    IDS.forEach(() => sorteo.siguiente());
    const segunda = IDS.map(() => sorteo.siguiente());
    expect(new Set(segunda).size).toBe(IDS.length);
  });

  it('evita que la primera de una bolsa repita la ultima de la anterior', () => {
    const bolsas = [
      ['a', 'b', 'c'],
      ['c', 'a', 'b'],
    ];
    let i = 0;
    const sorteo = crearSorteo({ ids: ['a', 'b', 'c'], mezclar: () => bolsas[i++] });

    expect(sorteo.siguiente()).toBe('a');
    expect(sorteo.siguiente()).toBe('b');
    expect(sorteo.siguiente()).toBe('c');
    expect(sorteo.siguiente()).not.toBe('c');
  });

  it('nunca repite dos seguidas en una tirada larga', () => {
    const sorteo = crearSorteo({ ids: IDS });
    let anterior = null;
    for (let i = 0; i < 300; i++) {
      const actual = sorteo.siguiente();
      expect(actual).not.toBe(anterior);
      anterior = actual;
    }
  });

  it('cuenta cuantas quedan en la bolsa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    expect(sorteo.restantes()).toBe(0);
    sorteo.siguiente();
    expect(sorteo.restantes()).toBe(IDS.length - 1);
  });

  it('con una sola carrera la devuelve siempre', () => {
    const sorteo = crearSorteo({ ids: ['civil'] });
    expect([sorteo.siguiente(), sorteo.siguiente()]).toEqual(['civil', 'civil']);
  });

  it('protesta si no hay carreras', () => {
    expect(() => crearSorteo({ ids: [] })).toThrow(/al menos una carrera/);
  });
});

describe('crearSorteo.siguientes', () => {
  // Dos objetos de la misma ingenieria en la misma pantalla se leen como un
  // error del sistema, no como una opcion.
  it('lo que se ofrece nunca repite carrera', () => {
    const sorteo = crearSorteo({ ids: IDS });
    for (let vuelta = 0; vuelta < 200; vuelta++) {
      const ofrecidas = sorteo.siguientes(5);
      expect(ofrecidas).toHaveLength(5);
      expect(new Set(ofrecidas).size).toBe(5);
    }
  });

  it('devuelve exactamente las que se piden', () => {
    const sorteo = crearSorteo({ ids: IDS });
    expect(sorteo.siguientes(3)).toHaveLength(3);
    expect(sorteo.siguientes(1)).toHaveLength(1);
  });

  // El dia que MAITE tenga solo tres carreras con video, pedir cinco no puede
  // devolver repetidas ni romperse: devuelve las tres que hay.
  it('si se piden mas de las que hay devuelve todas, sin repetir', () => {
    const sorteo = crearSorteo({ ids: ['civil', 'naval', 'quimica'] });
    const ofrecidas = sorteo.siguientes(5);
    expect([...ofrecidas].sort()).toEqual(['civil', 'naval', 'quimica']);
  });

  it('con una sola carrera la devuelve sola', () => {
    const sorteo = crearSorteo({ ids: ['civil'] });
    expect(sorteo.siguientes(5)).toEqual(['civil']);
    expect(sorteo.siguientes(1)).toEqual(['civil']);
  });

  it('pedir cero o menos no devuelve nada y no vacia la bolsa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    expect(sorteo.siguientes(0)).toEqual([]);
    expect(sorteo.siguientes(-3)).toEqual([]);
    expect(sorteo.siguientes(5)).toHaveLength(5);
  });

  // La bolsa existe para que ninguna carrera quede sistematicamente sin
  // ofrecerse: en pocas vueltas tienen que haber salido todas.
  it('en pocas vueltas se ofrecen todas las carreras', () => {
    const sorteo = crearSorteo({ ids: IDS });
    const vistas = new Set();
    for (let vuelta = 0; vuelta < 5; vuelta++) {
      for (const id of sorteo.siguientes(5)) vistas.add(id);
    }
    expect(vistas.size).toBe(IDS.length);
  });

  // Las repetidas que aparecen al recargar la bolsa vuelven al frente en vez de
  // perderse: si se descartaran, la carrera que cae en ese borde saldria menos
  // que las demas, vuelta tras vuelta.
  it('reparte parejo a lo largo de muchas vueltas', () => {
    const sorteo = crearSorteo({ ids: IDS });
    const cuenta = new Map(IDS.map((id) => [id, 0]));
    const VUELTAS = 1100;

    for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
      for (const id of sorteo.siguientes(5)) cuenta.set(id, cuenta.get(id) + 1);
    }

    const esperado = (VUELTAS * 5) / IDS.length;
    for (const [id, veces] of cuenta) {
      expect(veces, `${id} salio ${veces} veces, se esperaban ~${esperado}`).toBeGreaterThan(
        esperado * 0.75,
      );
      expect(veces).toBeLessThan(esperado * 1.25);
    }
  });

  it('siguiente sigue andando y toma una sola de la bolsa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    const antes = sorteo.restantes();
    const una = sorteo.siguiente();
    expect(IDS).toContain(una);
    expect(sorteo.restantes()).toBe((antes === 0 ? IDS.length : antes) - 1);
  });
});
