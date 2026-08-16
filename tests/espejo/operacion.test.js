import { describe, it, expect, vi } from 'vitest';
import {
  crearContadorFps,
  instalarOperacion,
  interpretarTecla,
} from '../../espejo/operacion.js';

// El mismo orden que contenido/carreras.json. La prueba no lo lee del disco a
// proposito — operacion.js no sabe que existe el contenido — pero si el catalogo
// crece, tests/integracion/atajos.test.js avisa que faltan teclas.
const IDS = [
  'mecanica',
  'electrica',
  'computacion',
  'fisico-matematico',
  'civil',
  'quimica',
  'alimentos',
  'produccion',
  'agrimensura',
  'comunicacion',
  'forestal',
  'naval',
];

describe('interpretarTecla', () => {
  it('las doce teclas fuerzan la carrera de esa posicion', () => {
    expect(interpretarTecla('1', IDS)).toEqual({ accion: 'forzar', id: 'mecanica' });
    expect(interpretarTecla('0', IDS)).toEqual({ accion: 'forzar', id: 'comunicacion' });
    expect(interpretarTecla('-', IDS)).toEqual({ accion: 'forzar', id: 'forestal' });
    expect(interpretarTecla('=', IDS)).toEqual({ accion: 'forzar', id: 'naval' });
  });

  it('ignora teclas sin carrera detras', () => {
    expect(interpretarTecla('3', ['a', 'b'])).toBeNull();
    expect(interpretarTecla('=', IDS.slice(0, 11))).toBeNull();
  });

  it('reconoce las acciones sueltas sin importar mayusculas', () => {
    expect(interpretarTecla('r', IDS)).toEqual({ accion: 'reiniciar' });
    expect(interpretarTecla('R', IDS)).toEqual({ accion: 'reiniciar' });
    expect(interpretarTecla('d', IDS)).toEqual({ accion: 'demo' });
    expect(interpretarTecla('P', IDS)).toEqual({ accion: 'panel' });
    expect(interpretarTecla('m', IDS)).toEqual({ accion: 'malla' });
    expect(interpretarTecla('a', IDS)).toEqual({ accion: 'alternarManual' });
  });

  it('la tecla I alterna entre iman y manotazo', () => {
    expect(interpretarTecla('i', IDS)).toEqual({ accion: 'interaccion' });
    expect(interpretarTecla('I', IDS)).toEqual({ accion: 'interaccion' });
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

describe('instalarOperacion', () => {
  it('conecta la tecla I y refleja el modo actualizado en el panel', () => {
    const escuchas = new Map();
    const ventana = {
      addEventListener: (tipo, escuchar) => escuchas.set(tipo, escuchar),
      setInterval: vi.fn(),
    };
    const panel = { style: {}, textContent: '' };
    const documento = {
      createElement: () => panel,
      body: { appendChild: vi.fn() },
    };
    let interaccion = 'atraer';
    const espejo = {
      contenido: { ids: IDS },
      alternarInteraccion: vi.fn(() => {
        interaccion = 'golpear';
      }),
      interaccionDeManos: () => interaccion,
      estadoDeCamara: () => ({ lista: true }),
      maquina: {
        estado: () => 'ESCENA',
        carrera: () => 'mecanica',
        sesion: () => 1,
        esManual: () => false,
      },
      modo: () => 'camara',
      detector: { cantidadDePuntos: () => 478 },
      manosCrudas: () => 1,
      manos: () => [],
      bus: { conectado: () => true },
      pool: { vivos: () => [] },
      banco: { faltantes: () => [] },
    };
    const operacion = instalarOperacion({
      espejo,
      tiempos: { recargaCadaMs: 1000 },
      ventana,
      documento,
    });
    const tecla = (key) => escuchas.get('keydown')({ key, preventDefault: vi.fn() });

    tecla('p');
    tecla('i');
    operacion.registrarCuadro(100);

    expect(espejo.alternarInteraccion).toHaveBeenCalledOnce();
    expect(panel.textContent).toContain('interaccion golpear');
  });
});
