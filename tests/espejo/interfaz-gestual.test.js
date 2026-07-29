import { describe, it, expect } from 'vitest';
import {
  calcularBotonesVirtuales,
  calcularCierreDeAusencia,
  crearControlBotonesVirtuales,
  manoTocaBoton,
} from '../../espejo/interfaz-gestual.js';

describe('calcularBotonesVirtuales', () => {
  it('ubica dos botones separados dentro de la pantalla', () => {
    const disposicion = {
      ancho: 1080,
      alto: 1920,
      piso: 1612,
      unidad: 1080,
    };
    const [otra, terminar] = calcularBotonesVirtuales(disposicion);

    expect(otra.x).toBeGreaterThan(0);
    expect(otra.y).toBeGreaterThan(0);
    expect(otra.x + otra.ancho).toBeLessThan(terminar.x);
    expect(terminar.x + terminar.ancho).toBeLessThan(1080);
    expect(terminar.y + terminar.alto).toBeLessThan(disposicion.piso);
  });
});

describe('manoTocaBoton', () => {
  const BOTON = { x: 100, y: 200, ancho: 300, alto: 100 };

  it('detecta la palma dentro del boton', () => {
    expect(manoTocaBoton({ palma: { x: 250, y: 250 }, radio: 50 }, BOTON)).toBe(true);
  });

  it('perdona un contacto cercano usando parte del radio de la mano', () => {
    expect(manoTocaBoton({ palma: { x: 90, y: 250 }, radio: 80 }, BOTON)).toBe(true);
  });

  it('rechaza una mano alejada', () => {
    expect(manoTocaBoton({ palma: { x: 20, y: 20 }, radio: 50 }, BOTON)).toBe(false);
  });
});

describe('crearControlBotonesVirtuales', () => {
  const BOTONES = [
    { id: 'otra-carrera', x: 0, y: 0, ancho: 100, alto: 100 },
    { id: 'terminar', x: 200, y: 0, ancho: 100, alto: 100 },
  ];
  const manoEn = (x) => [{ palma: { x, y: 50 }, radio: 20 }];

  it('activa solo despues de mantener la mano', () => {
    const control = crearControlBotonesVirtuales({ permanenciaMs: 800 });

    expect(
      control.actualizar({
        botones: BOTONES, manos: manoEn(50), ahora: 0, habilitado: true,
      }),
    ).toEqual({ activo: 'otra-carrera', progreso: 0, accion: null });

    const mitad = control.actualizar({
      botones: BOTONES, manos: manoEn(50), ahora: 400, habilitado: true,
    });
    expect(mitad.progreso).toBeCloseTo(0.5);
    expect(mitad.accion).toBeNull();

    expect(
      control.actualizar({
        botones: BOTONES, manos: manoEn(50), ahora: 800, habilitado: true,
      }).accion,
    ).toBe('otra-carrera');
  });

  it('no repite la accion mientras la mano siga apoyada', () => {
    const control = crearControlBotonesVirtuales({ permanenciaMs: 100 });
    control.actualizar({ botones: BOTONES, manos: manoEn(250), ahora: 0, habilitado: true });
    expect(
      control.actualizar({
        botones: BOTONES, manos: manoEn(250), ahora: 100, habilitado: true,
      }).accion,
    ).toBe('terminar');
    expect(
      control.actualizar({
        botones: BOTONES, manos: manoEn(250), ahora: 200, habilitado: true,
      }).accion,
    ).toBeNull();
  });

  it('reinicia el progreso al retirar la mano', () => {
    const control = crearControlBotonesVirtuales({ permanenciaMs: 800 });
    control.actualizar({ botones: BOTONES, manos: manoEn(50), ahora: 0, habilitado: true });
    control.actualizar({ botones: BOTONES, manos: [], ahora: 500, habilitado: true });
    expect(
      control.actualizar({
        botones: BOTONES, manos: manoEn(50), ahora: 600, habilitado: true,
      }).progreso,
    ).toBe(0);
  });
});

describe('calcularCierreDeAusencia', () => {
  const OPCIONES = {
    ausenciaDesde: 0,
    esperaInicialMs: 3000,
    intervaloMs: 5000,
    cierreMs: 1000,
    cerradoMs: 300,
    aperturaMs: 1000,
  };

  it('espera antes del primer cierre', () => {
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 2999 })).toBe(0);
  });

  it('cierra, permanece cerrado y vuelve a abrir', () => {
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 3500 })).toBeCloseTo(0.5);
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 4100 })).toBe(1);
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 4800 })).toBeCloseTo(0.5);
    expect(calcularCierreDeAusencia({ ...OPCIONES, ahora: 5300 })).toBe(0);
  });

  it('no anima cuando la ausencia se cancelo', () => {
    expect(
      calcularCierreDeAusencia({ ...OPCIONES, ahora: 4000, ausenciaDesde: null }),
    ).toBe(0);
  });
});
