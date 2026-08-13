import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FIGURAS,
  FIGURAS_ACCESORIO,
  dibujarFigura,
  dibujarFiguraAccesorio,
  figurasAccesorioDisponibles,
  figurasDisponibles,
  hayFigura,
  hayFiguraAccesorio,
} from '../../espejo/figuras.js';

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

const ACCESORIOS = figurasAccesorioDisponibles();

describe('figuras de accesorio', () => {
  it('hay una figura de accesorio por carrera', () => {
    expect(ACCESORIOS.length).toBeGreaterThanOrEqual(12);
  });

  it.each(ACCESORIOS)('"%s" dibuja algo sin romperse', (nombre) => {
    const { ctx, llamadas } = contextoFalso();
    expect(() => FIGURAS_ACCESORIO[nombre](ctx, 100, '#00E5A0')).not.toThrow();

    const pinto = llamadas.some((l) => ['fill', 'stroke', 'fillText'].includes(l));
    expect(pinto, `${nombre} no pinto nada`).toBe(true);
  });

  // El accesorio se mide en distancias entre ojos: una cabeza entera ocupa poco
  // mas de dos. Una figura que se pase de ahi le tapa media cara al visitante.
  it.each(ACCESORIOS)('"%s" se queda a la medida de una cabeza', (nombre) => {
    const { ctx, extremo } = contextoFalso();
    FIGURAS_ACCESORIO[nombre](ctx, 100, '#00E5A0');

    expect(extremo(), `${nombre} es mas grande que una cabeza`).toBeLessThanOrEqual(200);
  });

  it.each(ACCESORIOS)('"%s" escala con la distancia entre ojos', (nombre) => {
    const cerca = contextoFalso();
    const lejos = contextoFalso();
    FIGURAS_ACCESORIO[nombre](cerca.ctx, 200, '#fff');
    FIGURAS_ACCESORIO[nombre](lejos.ctx, 50, '#fff');

    expect(cerca.extremo()).toBeGreaterThan(lejos.extremo());
  });

  // Toda la instalacion es que el visitante se vea a si mismo con la carrera
  // puesta. Un accesorio puede apoyarse sobre los ojos —unos anteojos, un
  // visor—, pero con vidrio: si lo rellena opaco, le borra la mirada.
  it.each(ACCESORIOS)('"%s" deja ver los ojos', (nombre) => {
    const OJOS = [
      [-50, 0],
      [50, 0],
    ];
    const translucido = (estilo) => {
      if (estilo === 'transparent') return true;
      const alfa = /rgba\([^)]*,\s*([\d.]+)\s*\)/.exec(String(estilo));
      return alfa ? Number(alfa[1]) <= 0.35 : false;
    };

    const opacosSobreLosOjos = [];
    let caja = null;
    const punto = (x, y) => {
      caja ??= { x0: x, x1: x, y0: y, y1: y };
      caja.x0 = Math.min(caja.x0, x);
      caja.x1 = Math.max(caja.x1, x);
      caja.y0 = Math.min(caja.y0, y);
      caja.y1 = Math.max(caja.y1, y);
    };
    const arco = (x, y, rx, ry, giro = 0, inicio = 0, fin = Math.PI * 2) => {
      const pasos = 48;
      for (let i = 0; i <= pasos; i++) {
        const a = inicio + ((fin - inicio) * i) / pasos;
        const px = Math.cos(a) * rx;
        const py = Math.sin(a) * ry;
        punto(
          x + px * Math.cos(giro) - py * Math.sin(giro),
          y + px * Math.sin(giro) + py * Math.cos(giro),
        );
      }
    };

    const ctx = {
      fillStyle: '', strokeStyle: '', lineWidth: 0, lineJoin: '', lineCap: '',
      font: '', textAlign: '', textBaseline: '', globalAlpha: 1,
      save() {}, restore() {}, closePath() {}, stroke() {}, fillText() {}, strokeText() {},
      beginPath() {
        caja = null;
      },
      moveTo: punto,
      lineTo: punto,
      quadraticCurveTo: (cx, cy, x, y) => (punto(cx, cy), punto(x, y)),
      bezierCurveTo: (ax, ay, bx, by, x, y) => (punto(ax, ay), punto(bx, by), punto(x, y)),
      // Se recorre el arco de verdad: una media elipse (la copa de un casco) no
      // ocupa la caja de la elipse entera, y aproximarla asi daba por tapados
      // ojos que estan a la vista.
      arc: (x, y, r, inicio, fin) => arco(x, y, r, r, 0, inicio, fin),
      ellipse: (x, y, rx, ry, giro, inicio, fin) => arco(x, y, rx, ry, giro, inicio, fin),
      fillRect: (x, y, ancho, alto) => (punto(x, y), punto(x + ancho, y + alto)),
      fill() {
        if (!caja || translucido(this.fillStyle)) return;
        const tapa = OJOS.some(
          ([x, y]) => x >= caja.x0 && x <= caja.x1 && y >= caja.y0 && y <= caja.y1,
        );
        if (tapa) opacosSobreLosOjos.push(this.fillStyle);
      },
    };

    FIGURAS_ACCESORIO[nombre](ctx, 100, '#00E5A0');

    expect(opacosSobreLosOjos, `${nombre} le tapa los ojos con relleno opaco`).toEqual([]);
  });

  // La gracia del espejo es la cara del visitante: un accesorio que baje hasta
  // la boca la tapa. Los ojos estan en y=0 y la boca una distancia entre ojos
  // mas abajo; unos anteojos llegan al pomulo y ahi tienen que frenar.
  it.each(ACCESORIOS)('"%s" no baja hasta la boca', (nombre) => {
    const { ctx } = contextoFalso();
    let masAbajo = -Infinity;

    const espiar = (metodo, leerY) => {
      const previo = ctx[metodo];
      ctx[metodo] = (...args) => {
        masAbajo = Math.max(masAbajo, leerY(...args));
        previo(...args);
      };
    };
    espiar('moveTo', (x, y) => y);
    espiar('lineTo', (x, y) => y);
    espiar('quadraticCurveTo', (cx, cy, x, y) => Math.max(cy, y));
    espiar('arc', (x, y, r) => y + r);
    espiar('ellipse', (x, y, rx, ry) => y + ry);
    espiar('fillRect', (x, y, ancho, alto) => y + alto);

    FIGURAS_ACCESORIO[nombre](ctx, 100, '#fff');

    expect(masAbajo, `${nombre} no dibujo nada`).toBeGreaterThan(-Infinity);
    expect(masAbajo, `${nombre} le tapa la boca`).toBeLessThanOrEqual(70);
  });
});

describe('dibujarFiguraAccesorio', () => {
  it('devuelve true y equilibra save/restore', () => {
    const { ctx, llamadas } = contextoFalso();
    expect(dibujarFiguraAccesorio(ctx, 'casco', 100, '#fff')).toBe(true);
    expect(llamadas.filter((l) => l === 'save').length).toBe(
      llamadas.filter((l) => l === 'restore').length,
    );
  });

  it('devuelve false para un nombre que no existe, sin tocar el contexto', () => {
    const { ctx, llamadas } = contextoFalso();
    expect(dibujarFiguraAccesorio(ctx, 'inventada', 100, '#fff')).toBe(false);
    expect(llamadas).toEqual([]);
  });

  it('hayFiguraAccesorio responde sin dibujar', () => {
    expect(hayFiguraAccesorio('casco')).toBe(true);
    expect(hayFiguraAccesorio('inventada')).toBe(false);
  });
});

describe('carreras.json contra el registro de figuras', () => {
  it('cada accesorio declara una figura que existe', async () => {
    const datos = JSON.parse(
      await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8'),
    );

    const desconocidas = [];
    for (const carrera of datos.carreras) {
      const nombre = carrera.accesorio.figura;
      if (!nombre) desconocidas.push(`${carrera.id}: accesorio sin "figura"`);
      else if (!hayFiguraAccesorio(nombre)) {
        desconocidas.push(`${carrera.id}: figura de accesorio "${nombre}" no existe`);
      }
    }
    expect(desconocidas).toEqual([]);
  });

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
