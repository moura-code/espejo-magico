import { describe, it, expect } from 'vitest';
import {
  calcularDisposicion,
  calcularRectanguloVideo,
  dibujarManos,
  faseDeAnillo,
  radioDeAnillo,
  recortarFueraDeCara,
  tamanoQueEntra,
} from '../../espejo/escena.js';

// Lienzo falso: registra las llamadas para poder afirmar sobre lo dibujado.
function crearCtxFalso() {
  const llamadas = [];
  return {
    llamadas,
    strokeStyle: '',
    fillStyle: '',
    lineWidth: 0,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    save: () => llamadas.push(['save']),
    restore: () => llamadas.push(['restore']),
    beginPath: () => llamadas.push(['beginPath']),
    closePath: () => llamadas.push(['closePath']),
    moveTo: (x, y) => llamadas.push(['moveTo', x, y]),
    lineTo: (x, y) => llamadas.push(['lineTo', x, y]),
    arc: (x, y, radio) => llamadas.push(['arc', x, y, radio]),
    stroke: () => llamadas.push(['stroke']),
    fill: () => llamadas.push(['fill']),
    createRadialGradient: () => ({ addColorStop: () => {} }),
  };
}

describe('faseDeAnillo', () => {
  it('reparte el ciclo entre los anillos para que la señal no tenga huecos', () => {
    expect(faseDeAnillo(0, 1000, 0, 2)).toBeCloseTo(0);
    expect(faseDeAnillo(0, 1000, 1, 2)).toBeCloseTo(0.5);
    expect(faseDeAnillo(500, 1000, 0, 2)).toBeCloseTo(0.5);
  });

  it('siempre cae dentro del ciclo, incluso con relojes raros', () => {
    for (const ahora of [-3000, -1, 0, 1, 12345, 9e9]) {
      const fase = faseDeAnillo(ahora, 1400, 1, 3);
      expect(fase).toBeGreaterThanOrEqual(0);
      expect(fase).toBeLessThan(1);
    }
  });
});

describe('radioDeAnillo', () => {
  const ALCANCE = 320;
  const NUCLEO = 20;

  // El corazon del efecto: el anillo va HACIA la palma, que es el camino que
  // hacen los objetos capturados. Hacia afuera diria lo contrario — que el
  // espejo emite algo — y es justo lo que no hay que enseñar.
  it('se cierra sobre la palma en vez de expandirse', () => {
    const radios = [0, 0.25, 0.5, 0.75, 1].map((f) => radioDeAnillo(ALCANCE, NUCLEO, f));
    const ordenado = [...radios].sort((a, b) => b - a);
    expect(radios).toEqual(ordenado);
  });

  it('nace en el alcance real del campo y termina en el nucleo', () => {
    expect(radioDeAnillo(ALCANCE, NUCLEO, 0)).toBeCloseTo(ALCANCE);
    expect(radioDeAnillo(ALCANCE, NUCLEO, 1)).toBeCloseTo(NUCLEO);
  });

  it('nunca se sale del campo ni se da vuelta', () => {
    for (let f = 0; f <= 1; f += 0.01) {
      const r = radioDeAnillo(ALCANCE, NUCLEO, f);
      expect(r).toBeGreaterThanOrEqual(NUCLEO);
      expect(r).toBeLessThanOrEqual(ALCANCE);
    }
  });
});

describe('dibujarManos', () => {
  const mano = { palma: { x: 300, y: 400 }, radio: 100 };
  const ALCANCE_FACTOR = 3.2;
  const ANILLOS = 2;

  const dibujarEn = (ahora, extra = {}) => {
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [mano], '#00E5A0', {
      ahora,
      alcanceFactor: ALCANCE_FACTOR,
      senal: { anillos: ANILLOS },
      ...extra,
    });
    return ctx;
  };

  const arcos = (ctx) => ctx.llamadas.filter(([nombre]) => nombre === 'arc');

  it('en modo golpe no dibuja anillos: no hay campo que mostrar', () => {
    const conCampo = arcos(dibujarEn(500, { atrae: true })).length;
    const sinCampo = arcos(dibujarEn(500, { atrae: false })).length;
    expect(conCampo - sinCampo).toBe(ANILLOS);
  });

  it('todo lo que dibuja esta centrado en la palma', () => {
    const centrados = arcos(dibujarEn(500)).every(
      ([, x, y]) => x === mano.palma.x && y === mano.palma.y,
    );
    expect(centrados).toBe(true);
  });

  it('marca la palma aunque el reloj este quieto', () => {
    expect(arcos(dibujarEn(0)).length).toBeGreaterThan(0);
  });

  // Antes se dibujaban la palma, los dedos y los nudillos: eso pintaba un
  // segundo par de manos encima de las que ya se ven en el espejo.
  it('no depende de los 21 puntos de la mano', () => {
    const puntosPantalla = Array.from({ length: 21 }, (_, i) => ({ x: 100 + i * 5, y: 200 + i * 5 }));
    const conPuntos = dibujarEn(500, {}).llamadas;
    const ctx = crearCtxFalso();
    dibujarManos(ctx, [{ ...mano, puntosPantalla, largoPalma: 60 }], '#00E5A0', {
      ahora: 500,
      alcanceFactor: ALCANCE_FACTOR,
    });
    expect(ctx.llamadas).toEqual(conPuntos);
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
