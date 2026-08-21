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

  // La I era el iman contra el manotazo, y con la fisica se fue tambien ella.
  // Queda libre a proposito: una tecla que no hace nada es mejor que una que
  // hace algo que ya no existe.
  it('la tecla I ya no hace nada', () => {
    expect(interpretarTecla('i', IDS)).toBeNull();
    expect(interpretarTecla('I', IDS)).toBeNull();
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
    const espejo = {
      contenido: { ids: IDS },
      alternarMalla: vi.fn(),
      estadoDeCamara: () => ({ lista: true }),
      maquina: {
        estado: () => 'ESCENA',
        opciones: () => ['mecanica', 'civil'],
        carrera: () => 'mecanica',
        sesion: () => 1,
        esManual: () => false,
      },
      modo: () => 'camara',
      detector: { cantidadDePuntos: () => 478 },
      manosCrudas: () => 1,
      manos: () => [],
      pose: () => null,
      poseCrudas: () => 1,
      progresoDeEleccion: () => 0.5,
      hayFondo: () => true,
      puente: {
        activo: () => true,
        ultimo: () => ({ estado: 'carrera', enviado: 'mecanica', ok: true }),
      },
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
    tecla('m');
    operacion.registrarCuadro(100);

    expect(espejo.alternarMalla).toHaveBeenCalledOnce();
    expect(panel.textContent).toContain('estado      ESCENA');
  });

  // Si las tablets no acompañan, el panel tiene que decir de un vistazo si el
  // espejo llego a avisarle a MAITE o si el problema esta del otro lado.
  it('el panel muestra el ultimo envio a MAITE', () => {
    const escuchas = new Map();
    const ventana = {
      addEventListener: (tipo, escuchar) => escuchas.set(tipo, escuchar),
      setInterval: vi.fn(),
    };
    const panel = { style: {}, textContent: '' };
    const espejo = {
      contenido: { ids: IDS },
      estadoDeCamara: () => ({ lista: true }),
      maquina: {
        estado: () => 'ESCENA',
        opciones: () => [],
        carrera: () => 'civil',
        sesion: () => 3,
        esManual: () => false,
      },
      modo: () => 'camara',
      detector: { cantidadDePuntos: () => 478 },
      manosCrudas: () => 0,
      manos: () => [],
      pose: () => null,
      poseCrudas: () => 0,
      progresoDeEleccion: () => 0,
      hayFondo: () => false,
      puente: {
        activo: () => true,
        ultimo: () => ({ estado: 'carrera', enviado: 'civil', ok: false }),
      },
      banco: { faltantes: () => [] },
    };

    const operacion = instalarOperacion({
      espejo,
      tiempos: { recargaCadaMs: 1000 },
      ventana,
      documento: { createElement: () => panel, body: { appendChild: vi.fn() } },
    });

    escuchas.get('keydown')({ key: 'p', preventDefault: vi.fn() });
    operacion.registrarCuadro(100);

    expect(panel.textContent).toContain('maite       carrera civil FALLO');
    expect(panel.textContent).toContain('humo        sin video');
  });
});
