import { describe, it, expect } from 'vitest';
import {
  calcularDisposicion,
  calcularRectanguloVideo,
  dibujarManos,
  recortarFueraDeCara,
  tamanoQueEntra,
} from '../../espejo/escena.js';

// Lienzo falso: registra las llamadas para poder afirmar sobre lo dibujado.
function crearCtxFalso() {
  const llamadas = [];
  return {
    llamadas,
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    save: () => llamadas.push(['save']),
    restore: () => llamadas.push(['restore']),
    beginPath: () => llamadas.push(['beginPath']),
    arc: (x, y, radio) => llamadas.push(['arc', x, y, radio]),
    stroke: () => llamadas.push(['stroke']),
  };
}

describe('dibujarManos', () => {
  const mano = { palma: { x: 300, y: 400 }, radio: 100 };

  it('dibuja dos aros por mano: el circulo de colision y uno chico adentro', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [mano], '#ffffff');

    const arcos = ctx.llamadas.filter(([nombre]) => nombre === 'arc');
    expect(arcos).toEqual([
      ['arc', 300, 400, 100],
      ['arc', 300, 400, 35],
    ]);
    expect(ctx.strokeStyle).toBe('#ffffff');
  });

  it('no toca el lienzo sin manos', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [], '#ffffff');
    dibujarManos(ctx, null, '#ffffff');
    expect(ctx.llamadas).toEqual([]);
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [mano, { palma: { x: 700, y: 200 }, radio: 80 }], '#ffffff');
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

describe('recortarFueraDeCara', () => {
  it('no aplica recorte si no hay rostro', () => {
    const llamadas = [];
    const ctx = { clip: () => llamadas.push('clip') };
    expect(recortarFueraDeCara(ctx, null, { ancho: 1000, alto: 800 })).toBe(false);
    expect(llamadas).toEqual([]);
  });

  it('recorta una zona amplia alrededor de la cara', () => {
    const llamadas = [];
    const ctx = {
      beginPath: () => llamadas.push(['beginPath']),
      rect: (...args) => llamadas.push(['rect', ...args]),
      ellipse: (...args) => llamadas.push(['ellipse', ...args]),
      clip: (...args) => llamadas.push(['clip', ...args]),
    };
    const rostro = { centro: { x: 500, y: 300 }, radio: 100, angulo: 0.2 };

    expect(recortarFueraDeCara(ctx, rostro, { ancho: 1000, alto: 800 })).toBe(true);
    expect(llamadas[1]).toEqual(['rect', 0, 0, 1000, 800]);
    expect(llamadas.at(-1)).toEqual(['clip', 'evenodd']);
  });
});

describe('tamanoQueEntra', () => {
  // Medida falsa: cada caracter ocupa la mitad del tamaño de letra.
  const medir = (texto, tamano) => texto.length * tamano * 0.5;

  it('deja el tamaño pedido si el texto ya entra', () => {
    expect(tamanoQueEntra('corto', 40, 1000, medir)).toBe(40);
  });

  it('achica lo justo para que entre', () => {
    const frase = 'Procesos de transformación de la materia y la energía';
    const elegido = tamanoQueEntra(frase, 60, 500, medir);

    expect(elegido).toBeLessThan(60);
    expect(medir(frase, elegido)).toBeLessThanOrEqual(500);
  });

  it('nunca baja de un tamaño legible', () => {
    const kilometrico = 'x'.repeat(2000);
    expect(tamanoQueEntra(kilometrico, 60, 100, medir)).toBeGreaterThanOrEqual(8);
  });

  it('no divide por cero con un texto vacio', () => {
    expect(tamanoQueEntra('', 40, 500, () => 0)).toBe(40);
  });
});

describe('calcularDisposicion', () => {
  it('reconoce una pantalla vertical', () => {
    expect(calcularDisposicion(1080, 1920).vertical).toBe(true);
  });

  it('reconoce una pantalla apaisada', () => {
    expect(calcularDisposicion(1920, 1080).vertical).toBe(false);
  });

  // Los objetos tienen que llegar hasta el borde de abajo: un piso mas arriba se
  // percibe como una repisa invisible flotando en el aire (feedback de la primera
  // prueba). El texto no se defiende con un piso sino con el orden de dibujo.
  it('la caja de fisica llega hasta el borde inferior de la pantalla', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.caja).toEqual({ x: 0, y: 0, ancho: 1080, alto: 1920 });
  });

  it('la caja llega al borde tambien en pantalla apaisada', () => {
    const d = calcularDisposicion(1920, 1080);
    expect(d.caja.alto).toBe(1080);
  });

  it('la caja nunca se sale de la pantalla', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
      [2160, 3840],
    ]) {
      const d = calcularDisposicion(ancho, alto);
      expect(d.caja.ancho).toBeLessThanOrEqual(ancho);
      expect(d.caja.alto).toBeLessThanOrEqual(alto);
    }
  });

  it('escala la tipografia con el lado corto de la pantalla', () => {
    const chica = calcularDisposicion(540, 960);
    const grande = calcularDisposicion(1080, 1920);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(chica.texto.tamanoNombre * 1.9);
    expect(grande.texto.tamanoNombre).toBeLessThan(chica.texto.tamanoNombre * 2.1);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(grande.texto.tamanoFrase);
  });

  it('pone el nombre arriba de la frase', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.texto.nombreY).toBeLessThan(d.texto.fraseY);
    expect(d.texto.fraseY).toBeLessThan(1920);
  });

  it('da una unidad de referencia positiva en cualquier pantalla', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
    ]) {
      expect(calcularDisposicion(ancho, alto).unidad).toBeGreaterThan(0);
    }
  });
});

describe('calcularRectanguloVideo', () => {
  // Este rectangulo lo usan DOS cosas: donde se dibuja el video y donde se
  // mapean los puntos del rostro. Si se separan, los puntos se van de la cara.
  const casos = [
    ['camara apaisada en pantalla vertical', 1280, 720, 1080, 1920],
    ['camara apaisada en pantalla apaisada', 1280, 720, 1920, 1080],
    ['misma relacion exacta', 1280, 720, 2560, 1440],
    ['pantalla cuadrada', 1280, 720, 1000, 1000],
    ['camara vertical en pantalla apaisada', 720, 1280, 1920, 1080],
  ];

  it.each(casos)('cubre toda la pantalla: %s', (_, vAncho, vAlto, ancho, alto) => {
    const r = calcularRectanguloVideo(vAncho, vAlto, ancho, alto);

    expect(r.x).toBeLessThanOrEqual(0.001);
    expect(r.y).toBeLessThanOrEqual(0.001);
    expect(r.x + r.ancho).toBeGreaterThanOrEqual(ancho - 0.001);
    expect(r.y + r.alto).toBeGreaterThanOrEqual(alto - 0.001);
  });

  it.each(casos)('conserva la relacion de aspecto del video: %s', (_, vAncho, vAlto, ancho, alto) => {
    const r = calcularRectanguloVideo(vAncho, vAlto, ancho, alto);
    expect(r.ancho / r.alto).toBeCloseTo(vAncho / vAlto, 3);
  });

  it.each(casos)('queda centrado: %s', (_, vAncho, vAlto, ancho, alto) => {
    const r = calcularRectanguloVideo(vAncho, vAlto, ancho, alto);
    expect(r.x + r.ancho / 2).toBeCloseTo(ancho / 2);
    expect(r.y + r.alto / 2).toBeCloseTo(alto / 2);
  });

  it('con la misma relacion llena la pantalla sin recortar nada', () => {
    const r = calcularRectanguloVideo(1280, 720, 2560, 1440);
    expect(r).toEqual({ x: 0, y: 0, ancho: 2560, alto: 1440 });
  });

  it('recorta a los costados cuando la camara es mas ancha que la pantalla', () => {
    const r = calcularRectanguloVideo(1280, 720, 1080, 1920);
    expect(r.alto).toBeCloseTo(1920);
    expect(r.ancho).toBeGreaterThan(1080);
    expect(r.x).toBeLessThan(0);
  });

  it('cae a llenar la pantalla si el video todavia no reporta tamaño', () => {
    expect(calcularRectanguloVideo(0, 0, 1080, 1920)).toEqual({
      x: 0,
      y: 0,
      ancho: 1080,
      alto: 1920,
    });
  });
});
