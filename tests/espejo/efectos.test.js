import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearEfecto, efectosDisponibles, hayEfecto } from '../../espejo/efectos.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const TIPOS = efectosDisponibles();

/** Azar determinista, para que un fallo se pueda reproducir. */
function azarFijo(semilla = 1) {
  let n = semilla;
  return () => ((n = (n * 9301 + 49297) % 233280), n / 233280);
}

/** Contexto de dibujo falso que anota hasta donde llegaron las coordenadas. */
function contextoFalso() {
  let extremo = 0;
  let huboNaN = false;

  const anotar = (...valores) => {
    for (const v of valores) {
      if (typeof v !== 'number') continue;
      if (!Number.isFinite(v)) huboNaN = true;
      else extremo = Math.max(extremo, Math.abs(v));
    }
  };

  const nada = () => {};
  const ctx = {
    fillStyle: '', strokeStyle: '', lineWidth: 0, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', shadowColor: '', shadowBlur: 0,
    save: nada, restore: nada, beginPath: nada, closePath: nada,
    fill: nada, stroke: nada,
    translate: anotar, rotate: nada, scale: nada,
    moveTo: anotar, lineTo: anotar, quadraticCurveTo: anotar,
    arc: (x, y, r) => anotar(x + r, x - r, y + r, y - r),
    ellipse: (x, y, rx, ry) => anotar(x + rx, x - rx, y + ry, y - ry),
    fillRect: (x, y, w, h) => anotar(x, y, x + w, y + h),
    strokeRect: (x, y, w, h) => anotar(x, y, x + w, y + h),
    fillText: (_, x, y) => anotar(x, y),
    strokeText: (_, x, y) => anotar(x, y),
  };

  return { ctx, extremo: () => extremo, huboNaN: () => huboNaN };
}

const CONTEXTO = {
  ancho: 1080,
  alto: 1920,
  color: '#00E5A0',
  rostro: { centro: { x: 540, y: 700 }, radio: 160 },
  ahora: 0,
};

describe('efectos', () => {
  it('hay un efecto por cada carrera', () => {
    expect(TIPOS).toHaveLength(6);
  });

  it.each(TIPOS)('"%s" se crea, se actualiza y dibuja sin romperse', (tipo) => {
    const efecto = crearEfecto(tipo, { azar: azarFijo() });
    const { ctx } = contextoFalso();

    expect(() => {
      for (let i = 0; i < 120; i++) {
        efecto.actualizar(1 / 60, CONTEXTO);
        efecto.dibujar(ctx, CONTEXTO);
      }
    }).not.toThrow();
  });

  it.each(TIPOS)('"%s" no produce coordenadas invalidas en una corrida larga', (tipo) => {
    const efecto = crearEfecto(tipo, { azar: azarFijo(7) });
    const { ctx, huboNaN } = contextoFalso();

    // Diez minutos simulados: el turno de un visitante por veinte.
    for (let i = 0; i < 36000; i++) {
      efecto.actualizar(1 / 60, CONTEXTO);
      if (i % 60 === 0) efecto.dibujar(ctx, CONTEXTO);
    }
    expect(huboNaN(), `${tipo} genero NaN o infinito`).toBe(false);
  });

  it.each(TIPOS)('"%s" se mantiene cerca de la pantalla despues de mucho rato', (tipo) => {
    const efecto = crearEfecto(tipo, { azar: azarFijo(3) });
    const { ctx, extremo } = contextoFalso();

    for (let i = 0; i < 18000; i++) {
      efecto.actualizar(1 / 60, CONTEXTO);
      if (i % 120 === 0) efecto.dibujar(ctx, CONTEXTO);
    }

    // Margen generoso: lo que se busca atrapar es una particula que se escapa al
    // infinito y deja el efecto vacio a la media hora de feria.
    expect(extremo(), `${tipo} se fue lejos de la pantalla`).toBeLessThan(1920 * 4);
  });

  it.each(TIPOS)('"%s" funciona sin rostro detectado', (tipo) => {
    const efecto = crearEfecto(tipo, { azar: azarFijo() });
    const { ctx, huboNaN } = contextoFalso();

    expect(() => {
      efecto.actualizar(1 / 60, { ...CONTEXTO, rostro: null });
      efecto.dibujar(ctx, { ...CONTEXTO, rostro: null });
    }).not.toThrow();
    expect(huboNaN()).toBe(false);
  });

  it('respeta el presupuesto de particulas que se le pide', () => {
    const grande = crearEfecto('burbujas', { azar: azarFijo(), presupuesto: 200 });
    const chico = crearEfecto('burbujas', { azar: azarFijo(), presupuesto: 5 });

    const contarDibujos = (efecto) => {
      let arcos = 0;
      const { ctx } = contextoFalso();
      const original = ctx.arc;
      ctx.arc = (...args) => { arcos++; original(...args); };
      efecto.dibujar(ctx, CONTEXTO);
      return arcos;
    };

    expect(contarDibujos(chico)).toBeLessThan(contarDibujos(grande));
  });

  it('crearEfecto devuelve null para un tipo que no existe', () => {
    expect(crearEfecto('inventado')).toBeNull();
    expect(hayEfecto('inventado')).toBe(false);
    expect(hayEfecto('burbujas')).toBe(true);
  });

  it('es determinista con un azar determinista', () => {
    const a = crearEfecto('chispas', { azar: azarFijo(42) });
    const b = crearEfecto('chispas', { azar: azarFijo(42) });
    const ca = contextoFalso();
    const cb = contextoFalso();

    for (let i = 0; i < 30; i++) {
      a.actualizar(1 / 60, CONTEXTO);
      b.actualizar(1 / 60, CONTEXTO);
    }
    a.dibujar(ca.ctx, CONTEXTO);
    b.dibujar(cb.ctx, CONTEXTO);

    expect(ca.extremo()).toBe(cb.extremo());
  });
});

describe('carreras.json contra el registro de efectos', () => {
  it('cada carrera declara un efecto que existe', async () => {
    const datos = JSON.parse(await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8'));

    const problemas = [];
    for (const carrera of datos.carreras) {
      if (!carrera.efecto) problemas.push(`${carrera.id}: sin "efecto"`);
      else if (!hayEfecto(carrera.efecto)) {
        problemas.push(`${carrera.id}: efecto "${carrera.efecto}" no existe`);
      }
    }
    expect(problemas).toEqual([]);
  });

  // Con doce carreras y seis efectos la unicidad ya no es posible: lo que se
  // sostiene es que el registro entero se use, para que ningun efecto quede
  // muerto y las carreras repartan textura.
  it('todos los efectos del registro los usa alguna carrera', async () => {
    const datos = JSON.parse(await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8'));
    const usados = new Set(datos.carreras.map((c) => c.efecto));
    expect([...usados].sort()).toEqual([...TIPOS].sort());
  });
});
