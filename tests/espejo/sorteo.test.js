import { describe, it, expect } from 'vitest';
import { barajar, crearSorteo } from '../../espejo/sorteo.js';

const IDS = ['mecanica', 'electrica', 'computacion', 'fisico-matematico', 'civil', 'quimica'];

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
  it('entrega las seis carreras antes de repetir ninguna', () => {
    const sorteo = crearSorteo({ ids: IDS });
    const salidas = IDS.map(() => sorteo.siguiente());
    expect(new Set(salidas).size).toBe(6);
  });

  it('sigue sin repetir en la segunda vuelta completa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    IDS.forEach(() => sorteo.siguiente());
    const segunda = IDS.map(() => sorteo.siguiente());
    expect(new Set(segunda).size).toBe(6);
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
    expect(sorteo.restantes()).toBe(5);
  });

  it('con una sola carrera la devuelve siempre', () => {
    const sorteo = crearSorteo({ ids: ['civil'] });
    expect([sorteo.siguiente(), sorteo.siguiente()]).toEqual(['civil', 'civil']);
  });

  it('protesta si no hay carreras', () => {
    expect(() => crearSorteo({ ids: [] })).toThrow(/al menos una carrera/);
  });
});
