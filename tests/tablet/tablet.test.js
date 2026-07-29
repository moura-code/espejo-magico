import { describe, it, expect, vi } from 'vitest';
import { elegirReferente, crearTablet } from '../../tablet/tablet.js';

const CIVIL = {
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  referentes: [
    { video: 'videos/civil/ana.mp4', nombre: 'Ana Pérez', detalle: 'Egresada' },
    { video: 'videos/civil/sol.mp4', nombre: 'Sol Díaz', detalle: 'Docente' },
  ],
};

const contenido = { obtener: (id) => (id === 'civil' ? CIVIL : null) };
const pantallaFalsa = () => ({ mostrar: vi.fn(), ocultar: vi.fn() });

describe('elegirReferente', () => {
  it('elige por slot', () => {
    expect(elegirReferente(CIVIL, 0).nombre).toBe('Ana Pérez');
    expect(elegirReferente(CIVIL, 1).nombre).toBe('Sol Díaz');
  });

  it('da la vuelta cuando hay mas tablets que referentes', () => {
    expect(elegirReferente(CIVIL, 2).nombre).toBe('Ana Pérez');
    expect(elegirReferente(CIVIL, 5).nombre).toBe('Sol Díaz');
  });

  it('devuelve null si no hay carrera o no hay referentes', () => {
    expect(elegirReferente(null, 0)).toBeNull();
    expect(elegirReferente({ referentes: [] }, 0)).toBeNull();
    expect(elegirReferente({}, 0)).toBeNull();
  });
});

describe('crearTablet', () => {
  it('muestra la referente que le toca al recibir una carrera', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 1, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
    expect(pantalla.mostrar.mock.calls[0][0].nombre).toBe('Sol Díaz');
    expect(pantalla.mostrar.mock.calls[0][1]).toBe(CIVIL);
  });

  it('ignora el latido repetido de la misma sesion', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
  });

  it('reacciona a una sesion nueva', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 5 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(2);
  });

  it('se apaga con reposo', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });
    tablet.recibir({ tipo: 'reposo' });

    expect(pantalla.ocultar).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a encenderse con un latido viejo despues del reposo', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });
    tablet.recibir({ tipo: 'reposo' });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
  });

  it('aguanta una carrera que no existe sin romperse', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    expect(() => tablet.recibir({ tipo: 'carrera', id: 'inventada', sesion: 1 })).not.toThrow();
    expect(pantalla.mostrar).not.toHaveBeenCalled();
  });

  it('una carrera sin referentes no rompe ni marca la sesion como vista', () => {
    const vacia = { obtener: () => ({ id: 'x', referentes: [] }) };
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido: vacia, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'x', sesion: 1 });
    expect(pantalla.mostrar).not.toHaveBeenCalled();
  });

  it('repetir reposo no molesta', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'reposo' });
    tablet.recibir({ tipo: 'reposo' });

    expect(pantalla.ocultar).toHaveBeenCalledTimes(2);
  });

  it('ignora mensajes de la tablet de controles', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'controles', estado: 'ESCENA', botones: [] });
    tablet.recibir({ tipo: 'accion', id: 'terminar' });

    expect(pantalla.mostrar).not.toHaveBeenCalled();
    expect(pantalla.ocultar).not.toHaveBeenCalled();
  });

  it('dos tablets con slots distintos muestran referentes distintas', () => {
    const a = pantallaFalsa();
    const b = pantallaFalsa();
    crearTablet({ slot: 0, contenido, pantalla: a }).recibir({
      tipo: 'carrera', id: 'civil', sesion: 1,
    });
    crearTablet({ slot: 1, contenido, pantalla: b }).recibir({
      tipo: 'carrera', id: 'civil', sesion: 1,
    });

    expect(a.mostrar.mock.calls[0][0].nombre).not.toBe(b.mostrar.mock.calls[0][0].nombre);
  });
});
