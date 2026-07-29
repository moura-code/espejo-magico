import { describe, it, expect } from 'vitest';
import { crearContadorFps, interpretarTecla } from '../../espejo/operacion.js';

const IDS = [
  'civil',
  'alimentos',
  'produccion',
  'electrica',
  'agrimensura',
  'computacion',
  'sistemas-comunicacion',
  'fisico-matematico',
  'mecanica',
];

describe('interpretarTecla', () => {
  it('las teclas 1 a 9 fuerzan la propuesta de esa posicion', () => {
    expect(interpretarTecla('1', IDS)).toEqual({ accion: 'forzar', id: 'civil' });
    expect(interpretarTecla('9', IDS)).toEqual({ accion: 'forzar', id: 'mecanica' });
  });

  it('ignora numeros sin carrera detras', () => {
    expect(interpretarTecla('0', IDS)).toBeNull();
    expect(interpretarTecla('3', ['a', 'b'])).toBeNull();
  });

  it('reconoce las acciones sueltas sin importar mayusculas', () => {
    expect(interpretarTecla('r', IDS)).toEqual({ accion: 'reiniciar' });
    expect(interpretarTecla('R', IDS)).toEqual({ accion: 'reiniciar' });
    expect(interpretarTecla('d', IDS)).toEqual({ accion: 'demo' });
    expect(interpretarTecla('c', IDS)).toEqual({ accion: 'camara' });
    expect(interpretarTecla('C', IDS)).toEqual({ accion: 'camara' });
    expect(interpretarTecla('P', IDS)).toEqual({ accion: 'panel' });
    expect(interpretarTecla('m', IDS)).toEqual({ accion: 'malla' });
    expect(interpretarTecla('a', IDS)).toEqual({ accion: 'alternarManual' });
  });

  it('la barra espaciadora avanza al estado siguiente', () => {
    expect(interpretarTecla(' ', IDS)).toEqual({ accion: 'avanzar' });
  });

  it('Enter y la flecha derecha tambien avanzan', () => {
    expect(interpretarTecla('Enter', IDS)).toEqual({ accion: 'avanzar' });
    expect(interpretarTecla('ArrowRight', IDS)).toEqual({ accion: 'avanzar' });
  });

  it('no hace nada con cualquier otra tecla', () => {
    for (const tecla of ['b', 'Escape', 'F5', 'ArrowUp', 'Tab', 'Shift']) {
      expect(interpretarTecla(tecla, IDS)).toBeNull();
    }
  });
});

describe('crearContadorFps', () => {
  it('calcula los cuadros por segundo de la ventana reciente', () => {
    const contador = crearContadorFps({ ventana: 4 });
    for (let i = 0; i <= 4; i++) contador.registrar(i * 20);
    expect(contador.valor()).toBeCloseTo(50, 0);
  });

  it('vale cero hasta tener dos muestras', () => {
    const contador = crearContadorFps({ ventana: 4 });
    expect(contador.valor()).toBe(0);
    contador.registrar(0);
    expect(contador.valor()).toBe(0);
  });

  it('olvida lo viejo al pasar la ventana', () => {
    const contador = crearContadorFps({ ventana: 3 });
    contador.registrar(0);
    contador.registrar(1000);
    contador.registrar(1016);
    contador.registrar(1032);
    contador.registrar(1048);
    expect(contador.valor()).toBeGreaterThan(50);
  });

  it('no explota si dos cuadros llegan con la misma marca de tiempo', () => {
    const contador = crearContadorFps({ ventana: 4 });
    contador.registrar(100);
    contador.registrar(100);
    expect(Number.isFinite(contador.valor())).toBe(true);
  });
});
