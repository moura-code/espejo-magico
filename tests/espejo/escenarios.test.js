import { describe, it, expect } from 'vitest';
import {
  dibujarEscenario,
  crearBancoDeEscenarios,
  ESCENARIOS,
} from '../../espejo/escenarios.js';
import { construirCatalogo } from '../../servidor/catalogo.js';

const { catalogo } = await construirCatalogo();
const CARRERAS = catalogo.carreras;

const ANCHO = 1080;
const ALTO = 1920;

// Lienzo falso: registra lo dibujado y vigila que nadie deje transformaciones
// ni estilos pegados al contexto.
function crearCtxFalso() {
  const llamadas = [];
  const ctx = {
    llamadas,
    canvas: { width: ANCHO, height: ALTO },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: '',
    lineJoin: '',
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    font: '',
    textAlign: '',
    shadowColor: '',
    shadowBlur: 0,
    filter: '',
    save: () => llamadas.push(['save']),
    restore: () => llamadas.push(['restore']),
    beginPath: () => llamadas.push(['beginPath']),
    closePath: () => llamadas.push(['closePath']),
    moveTo: (...a) => llamadas.push(['moveTo', ...a]),
    lineTo: (...a) => llamadas.push(['lineTo', ...a]),
    arc: (...a) => llamadas.push(['arc', ...a]),
    ellipse: (...a) => llamadas.push(['ellipse', ...a]),
    rect: (...a) => llamadas.push(['rect', ...a]),
    fillRect: (...a) => llamadas.push(['fillRect', ...a]),
    strokeRect: (...a) => llamadas.push(['strokeRect', ...a]),
    quadraticCurveTo: (...a) => llamadas.push(['quadraticCurveTo', ...a]),
    bezierCurveTo: (...a) => llamadas.push(['bezierCurveTo', ...a]),
    clearRect: (...a) => llamadas.push(['clearRect', ...a]),
    stroke: () => llamadas.push(['stroke']),
    fill: () => llamadas.push(['fill']),
    clip: (...a) => llamadas.push(['clip', ...a]),
    translate: (...a) => llamadas.push(['translate', ...a]),
    scale: (...a) => llamadas.push(['scale', ...a]),
    rotate: (a) => llamadas.push(['rotate', a]),
    setTransform: (...a) => llamadas.push(['setTransform', ...a]),
    createRadialGradient: () => ({ addColorStop: () => {} }),
    createLinearGradient: () => ({ addColorStop: () => {} }),
  };
  return ctx;
}

const soloDe = (ctx, nombre) => ctx.llamadas.filter(([que]) => que === nombre);

describe('dibujarEscenario', () => {
  it('no dibuja nada si no conoce el escenario', () => {
    const ctx = crearCtxFalso();
    expect(dibujarEscenario(ctx, 'no-existe', ANCHO, ALTO, '#FF8A3D')).toBe(false);
    expect(ctx.llamadas).toEqual([]);
  });

  // EL PUNTO DE TODO ESTO. Un degradado del color no le dice a nadie que es la
  // ingenieria quimica; un laboratorio si. Si una carrera se queda sin escena,
  // vuelve al degradado sin que nadie se entere.
  it('hay una escena para cada una de las doce ingenierias', () => {
    for (const carrera of CARRERAS) {
      expect(ESCENARIOS, carrera.id).toHaveProperty(carrera.id);
    }
  });

  it('dibuja la escena de cada ingenieria', () => {
    for (const carrera of CARRERAS) {
      const ctx = crearCtxFalso();
      expect(dibujarEscenario(ctx, carrera.id, ANCHO, ALTO, carrera.color), carrera.id).toBe(
        true,
      );
      expect(ctx.llamadas.length, carrera.id).toBeGreaterThan(10);
    }
  });

  // El fondo se dibuja a pantalla completa detras de una persona: si quedara un
  // borde sin pintar, ahi se veria el espejo crudo asomando.
  it('cada escena tapa el lienzo entero', () => {
    for (const carrera of CARRERAS) {
      const ctx = crearCtxFalso();
      dibujarEscenario(ctx, carrera.id, ANCHO, ALTO, carrera.color);

      const tapa = soloDe(ctx, 'fillRect').some(
        ([, x, y, ancho, alto]) => x <= 0 && y <= 0 && ancho >= ANCHO && alto >= ALTO,
      );
      expect(tapa, carrera.id).toBe(true);
    }
  });

  // Las escenas se dibujan una detras de otra sobre el mismo lienzo cuando se
  // generan los doce PNG: una transformacion olvidada corre la siguiente entera.
  it('ninguna escena deja transformaciones pegadas al contexto', () => {
    for (const carrera of CARRERAS) {
      const ctx = crearCtxFalso();
      dibujarEscenario(ctx, carrera.id, ANCHO, ALTO, carrera.color);

      let abiertos = 0;
      let minimo = 0;
      for (const [que] of ctx.llamadas) {
        if (que === 'save') abiertos += 1;
        if (que === 'restore') abiertos -= 1;
        minimo = Math.min(minimo, abiertos);
      }
      expect(abiertos, carrera.id).toBe(0);
      // Y ningun restore de mas, que se comeria el estado del llamador.
      expect(minimo, carrera.id).toBe(0);
    }
  });

  // La persona va recortada encima, y su nombre y su historia van sobre el
  // fondo en blanco. Una escena clara los borra.
  it('cada escena arranca de un fondo oscuro', () => {
    for (const carrera of CARRERAS) {
      const ctx = crearCtxFalso();
      const pintados = [];
      Object.defineProperty(ctx, 'fillStyle', {
        get: () => pintados[pintados.length - 1],
        set: (v) => pintados.push(v),
      });

      dibujarEscenario(ctx, carrera.id, ANCHO, ALTO, carrera.color);

      const solidos = pintados.filter((v) => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v));
      expect(solidos.length, carrera.id).toBeGreaterThan(0);
      // El primer color solido de la escena es su cielo o su pared del fondo.
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(solidos[0].slice(i, i + 2), 16));
      expect((r * 299 + g * 587 + b * 114) / 1000, `${carrera.id} ${solidos[0]}`).toBeLessThan(
        90,
      );
    }
  });
});

// Dibujar una escena entera cuesta cientos de trazos. A 60 cuadros por segundo
// eso es inaceptable, asi que se dibuja UNA vez sobre un lienzo aparte y despues
// se copia. El banco es lo que garantiza ese "una vez".
describe('crearBancoDeEscenarios', () => {
  function bancoDePrueba() {
    const creados = [];
    const banco = crearBancoDeEscenarios({
      crearLienzo: (ancho, alto) => {
        const lienzo = { width: ancho, height: alto, ctx: crearCtxFalso() };
        creados.push(lienzo);
        return { lienzo, ctx: lienzo.ctx };
      },
    });
    return { banco, creados };
  }

  it('devuelve null para una ingenieria sin escena', () => {
    const { banco, creados } = bancoDePrueba();
    expect(banco.obtener('no-existe', ANCHO, ALTO, '#FF8A3D')).toBeNull();
    expect(creados).toHaveLength(0);
  });

  it('dibuja la escena una sola vez y despues la reusa', () => {
    const { banco, creados } = bancoDePrueba();

    const primera = banco.obtener('quimica', ANCHO, ALTO, '#FF5D8F');
    const segunda = banco.obtener('quimica', ANCHO, ALTO, '#FF5D8F');

    expect(primera).not.toBeNull();
    expect(segunda).toBe(primera);
    expect(creados).toHaveLength(1);
    expect(creados[0].ctx.llamadas.length).toBeGreaterThan(10);
  });

  it('cada ingenieria tiene su propio lienzo', () => {
    const { banco, creados } = bancoDePrueba();

    banco.obtener('quimica', ANCHO, ALTO, '#FF5D8F');
    banco.obtener('naval', ANCHO, ALTO, '#5C6BC0');

    expect(creados).toHaveLength(2);
  });

  // La pantalla del stand no cambia de tamaño, pero la ventana de desarrollo si:
  // una escena guardada al tamaño viejo se estiraria.
  it('vuelve a dibujar si cambia el tamaño de la pantalla', () => {
    const { banco, creados } = bancoDePrueba();

    banco.obtener('quimica', ANCHO, ALTO, '#FF5D8F');
    banco.obtener('quimica', 800, 600, '#FF5D8F');

    expect(creados).toHaveLength(2);
    expect(creados[1].width).toBe(800);
  });
});
