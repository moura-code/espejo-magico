import { describe, it, expect } from 'vitest';
import {
  calcularDisposicion,
  calcularRectanguloVideo,
  calcularAspasCaracol,
  calcularFasesDeCierre,
  calcularPosicionTemporizador,
  dibujarPuntosRostro,
  dibujarTemporizadorEstado,
  tamanoQueEntra,
} from '../../espejo/escena.js';

describe('calcularFasesDeCierre', () => {
  it('pasa de la posibilidad al concepto general', () => {
    expect(calcularFasesDeCierre(0)).toEqual({ prediccion: 1, concepto: 0 });
    expect(calcularFasesDeCierre(0.5).prediccion).toBeLessThan(1);
    expect(calcularFasesDeCierre(0.5).concepto).toBeGreaterThan(0);
    expect(calcularFasesDeCierre(1)).toEqual({ prediccion: 0, concepto: 1 });
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

  it('deja el piso arriba del borde para que el texto no quede tapado', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.piso).toBeLessThan(1920);
    expect(d.piso).toBeGreaterThan(1920 * 0.7);
  });

  it('la caja de fisica termina en el piso', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.caja).toEqual({ x: 0, y: 0, ancho: 1080, alto: d.piso });
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

describe('dibujarPuntosRostro', () => {
  it('dibuja un circulo por cada landmark sintetico', () => {
    let arcos = 0;
    let rellenos = 0;
    const contexto = {
      save() {},
      restore() {},
      beginPath() {},
      moveTo() {},
      arc() {
        arcos += 1;
      },
      fill() {
        rellenos += 1;
      },
    };
    const puntos = [
      { x: 10, y: 20 },
      { x: 30, y: 40 },
      { x: 50, y: 60 },
    ];

    dibujarPuntosRostro(contexto, puntos, { radio: 4 });

    expect(arcos).toBe(3);
    expect(rellenos).toBe(1);
    expect(contexto.shadowBlur).toBe(12);
  });

  it('no toca el lienzo si no hay puntos', () => {
    let guardados = 0;
    dibujarPuntosRostro({ save: () => { guardados += 1; } }, []);
    expect(guardados).toBe(0);
  });
});

describe('dibujarTemporizadorEstado', () => {
  it('ubica el contador abajo a la izquierda y dentro de la pantalla', () => {
    const posicion = calcularPosicionTemporizador({
      ancho: 1080,
      alto: 1920,
      unidad: 1080,
    });

    expect(posicion.centroX).toBeLessThan(1080 / 2);
    expect(posicion.centroY).toBeGreaterThan(1920 / 2);
    expect(posicion.centroX - posicion.radio).toBeGreaterThanOrEqual(0);
    expect(posicion.centroY + posicion.radio).toBeLessThan(1920);
  });

  it('dibuja un aro de progreso y los segundos restantes', () => {
    let arcos = 0;
    let trazos = 0;
    const textos = [];
    const contexto = {
      save() {},
      restore() {},
      beginPath() {},
      arc() {
        arcos += 1;
      },
      fill() {},
      stroke() {
        trazos += 1;
      },
      fillText(texto) {
        textos.push(texto);
      },
    };

    dibujarTemporizadorEstado(
      contexto,
      { ancho: 1080, alto: 1920, unidad: 1080 },
      { segundosRestantes: 3, proporcionRestante: 0.75 },
      '#62D8FF',
    );

    expect(arcos).toBe(3);
    expect(trazos).toBe(2);
    expect(textos).toEqual(['3', 's']);
  });

  it('no dibuja nada cuando el estado no tiene cuenta regresiva', () => {
    let guardados = 0;
    dibujarTemporizadorEstado({ save: () => { guardados += 1; } }, {}, null);
    expect(guardados).toBe(0);
  });
});

describe('calcularAspasCaracol', () => {
  const DISPOSICION = { ancho: 1280, alto: 720, unidad: 405 };

  it('genera seis aspas curvas alrededor del centro', () => {
    const caracol = calcularAspasCaracol(DISPOSICION, 0.5);

    expect(caracol.centro).toEqual({ x: 640, y: 360 });
    expect(caracol.aspas).toHaveLength(6);
    expect(caracol.aspas[0].bordeInicial).toHaveLength(49);
    expect(caracol.aspas[0].bordeFinal).toHaveLength(49);
  });

  it('mantiene finitos todos los puntos de la espiral', () => {
    const { aspas } = calcularAspasCaracol(DISPOSICION, 0.65);
    const puntos = aspas.flatMap((aspa) => [...aspa.bordeInicial, ...aspa.bordeFinal]);

    expect(puntos.every((punto) => Number.isFinite(punto.x) && Number.isFinite(punto.y))).toBe(true);
  });

  it('al cerrar por completo una aspa toca la siguiente sin dejar huecos', () => {
    const { aspas } = calcularAspasCaracol(DISPOSICION, 1);
    const finalPrimera = aspas[0].bordeFinal[0];
    const inicioSiguiente = aspas[1].bordeInicial[0];

    expect(finalPrimera.x).toBeCloseTo(inicioSiguiente.x);
    expect(finalPrimera.y).toBeCloseTo(inicioSiguiente.y);
  });

  it('a mitad del cierre deja canales visibles entre las aspas', () => {
    const { aspas } = calcularAspasCaracol(DISPOSICION, 0.5);
    const finalPrimera = aspas[0].bordeFinal[0];
    const inicioSiguiente = aspas[1].bordeInicial[0];

    expect(Math.hypot(finalPrimera.x - inicioSiguiente.x, finalPrimera.y - inicioSiguiente.y)).toBeGreaterThan(100);
  });
});
