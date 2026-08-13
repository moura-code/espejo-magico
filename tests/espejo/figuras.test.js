import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIGURAS, dibujarFigura, figurasDisponibles, hayFigura } from '../../espejo/figuras.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Contexto de dibujo falso. Anota que se llamo y hasta donde llegaron las
 * coordenadas, para poder verificar que una figura no se sale de su radio.
 */
function contextoFalso() {
  const llamadas = [];
  const fuentes = [];
  let extremo = 0;

  const anotar = (...valores) => {
    for (const v of valores) {
      if (typeof v === 'number' && Number.isFinite(v)) extremo = Math.max(extremo, Math.abs(v));
    }
  };

  const registrar = (nombre, extension) => (...args) => {
    llamadas.push(nombre);
    if (extension) extension(...args);
  };

  const ctx = {
    // Propiedades de estilo: se aceptan y se ignoran.
    fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: '', lineCap: '',
    textAlign: '', textBaseline: '', globalAlpha: 1,

    // El tamaño de un glifo viaja en `font`, no en coordenadas. Se anota aparte.
    set font(valor) {
      fuentes.push(valor);
    },
    get font() {
      return fuentes.at(-1) ?? '';
    },

    save: registrar('save'),
    restore: registrar('restore'),
    beginPath: registrar('beginPath'),
    closePath: registrar('closePath'),

    moveTo: registrar('moveTo', anotar),
    lineTo: registrar('lineTo', anotar),
    quadraticCurveTo: registrar('quadraticCurveTo', anotar),
    bezierCurveTo: registrar('bezierCurveTo', anotar),

    arc: registrar('arc', (x, y, radio) => anotar(x + radio, x - radio, y + radio, y - radio)),
    ellipse: registrar('ellipse', (x, y, rx, ry) =>
      anotar(x + rx, x - rx, y + ry, y - ry),
    ),
    fillRect: registrar('fillRect', (x, y, w, h) => anotar(x, y, x + w, y + h)),
    strokeRect: registrar('strokeRect', (x, y, w, h) => anotar(x, y, x + w, y + h)),

    fill: registrar('fill'),
    stroke: registrar('stroke'),
    fillText: registrar('fillText', (_, x, y) => anotar(x, y)),
    strokeText: registrar('strokeText', (_, x, y) => anotar(x, y)),
    translate: registrar('translate', anotar),
    rotate: registrar('rotate'),
    scale: registrar('scale'),
  };

  return {
    ctx,
    llamadas,
    extremo: () => extremo,
    // Mayor tamaño de letra pedido, en px.
    tipografia: () =>
      fuentes.reduce((maximo, fuente) => Math.max(maximo, parseFloat(/(\d+(?:\.\d+)?)px/.exec(fuente)?.[1] ?? 0)), 0),
  };
}

const NOMBRES = figurasDisponibles();
const GLIFOS = ['pi', 'sumatoria', 'integral', 'llaves'];

describe('figuras', () => {
  it('hay una figura por cada objeto que necesitan las seis carreras', () => {
    expect(NOMBRES.length).toBeGreaterThanOrEqual(36);
  });

  it.each(NOMBRES)('"%s" dibuja algo sin romperse', (nombre) => {
    const { ctx, llamadas } = contextoFalso();
    expect(() => FIGURAS[nombre](ctx, 100, '#00E5A0')).not.toThrow();

    const pinto = llamadas.some((l) => ['fill', 'stroke', 'fillText', 'fillRect', 'strokeRect'].includes(l));
    expect(pinto, `${nombre} no pinto nada`).toBe(true);
  });

  it.each(NOMBRES.filter((n) => !GLIFOS.includes(n)))(
    '"%s" se queda dentro de su radio',
    (nombre) => {
      const { ctx, extremo } = contextoFalso();
      FIGURAS[nombre](ctx, 100, '#00E5A0');

      // 120 y no 100: los puntos de control de las curvas pueden quedar por
      // fuera del trazo real. Lo que se busca atrapar es una figura que se
      // dibuje al doble de su tamaño y tape a las vecinas.
      expect(extremo(), `${nombre} se sale del radio`).toBeLessThanOrEqual(120);
    },
  );

  it.each(NOMBRES.filter((n) => !GLIFOS.includes(n)))('"%s" escala con el radio', (nombre) => {
    const chica = contextoFalso();
    const grande = contextoFalso();
    FIGURAS[nombre](chica.ctx, 50, '#fff');
    FIGURAS[nombre](grande.ctx, 200, '#fff');

    expect(grande.extremo()).toBeGreaterThan(chica.extremo());
  });

  it.each(GLIFOS)('el glifo "%s" dibuja texto que escala con el radio', (nombre) => {
    const chica = contextoFalso();
    const grande = contextoFalso();
    FIGURAS[nombre](chica.ctx, 50, '#fff');
    FIGURAS[nombre](grande.ctx, 200, '#fff');

    expect(chica.llamadas, `${nombre} deberia usar fillText`).toContain('fillText');
    expect(grande.tipografia()).toBeGreaterThan(chica.tipografia());
    // Un glifo que ocupara mas que su radio taparia a los objetos vecinos.
    expect(grande.tipografia()).toBeLessThanOrEqual(200 * 2.2);
  });
});

describe('dibujarFigura', () => {
  it('devuelve true y equilibra save/restore', () => {
    const { ctx, llamadas } = contextoFalso();
    expect(dibujarFigura(ctx, 'engranaje', 100, '#fff')).toBe(true);
    expect(llamadas.filter((l) => l === 'save').length).toBe(
      llamadas.filter((l) => l === 'restore').length,
    );
  });

  it('devuelve false para un nombre que no existe, sin tocar el contexto', () => {
    const { ctx, llamadas } = contextoFalso();
    expect(dibujarFigura(ctx, 'inventada', 100, '#fff')).toBe(false);
    expect(llamadas).toEqual([]);
  });

  it('hayFigura responde sin dibujar', () => {
    expect(hayFigura('matraz')).toBe(true);
    expect(hayFigura('inventada')).toBe(false);
  });
});

describe('carreras.json contra el registro de figuras', () => {
  it('cada objeto declara una figura que existe', async () => {
    const datos = JSON.parse(
      await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8'),
    );

    const desconocidas = [];
    for (const carrera of datos.carreras) {
      for (const objeto of carrera.objetos) {
        if (!objeto.figura) desconocidas.push(`${carrera.id}: ${objeto.img} sin "figura"`);
        else if (!hayFigura(objeto.figura)) {
          desconocidas.push(`${carrera.id}: figura "${objeto.figura}" no existe`);
        }
      }
    }
    expect(desconocidas).toEqual([]);
  });
});
