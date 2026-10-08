import { describe, it, expect, vi, afterEach } from 'vitest';
import { crearSegmentador } from '../../espejo/segmentador.js';

const LIENZO = { width: 405, height: 720 };

/** Un resultado de ImageSegmenter: sus mascaras y su close. */
function resultado(mascaras) {
  const r = { confidenceMasks: mascaras, cerrado: false, close: () => (r.cerrado = true) };
  return r;
}

function segmentadorQueDevuelve(...resultados) {
  const pedidos = [];
  return {
    pedidos,
    segmentForVideo: (fuente, ahora) => {
      pedidos.push({ fuente, ahora });
      return resultados.shift();
    },
    close: vi.fn(),
  };
}

describe('crearSegmentador', () => {
  afterEach(() => vi.restoreAllMocks());

  it('devuelve la mascara de persona del cuadro', () => {
    const persona = { width: 405, height: 720 };
    const crudo = segmentadorQueDevuelve(resultado([persona]));
    const segmentador = crearSegmentador({ segmentadorCrudo: crudo });

    expect(segmentador.detectar(LIENZO, 1000)).toBe(persona);
    expect(crudo.pedidos).toEqual([{ fuente: LIENZO, ahora: 1000 }]);
  });

  // El modelo selfie trae un solo canal, la persona. Uno que trajera fondo y
  // persona la pone ultima.
  it('con fondo y persona, se queda con la persona', () => {
    const fondo = { nombre: 'fondo' };
    const persona = { nombre: 'persona' };
    const segmentador = crearSegmentador({
      segmentadorCrudo: segmentadorQueDevuelve(resultado([fondo, persona])),
    });

    expect(segmentador.detectar(LIENZO, 0)).toBe(persona);
  });

  // La mascara tiene que seguir viva hasta que la silueta la lea, en el mismo
  // cuadro; cerrarla antes la deja vacia, y no cerrarla nunca pierde memoria de
  // la GPU veinte veces por segundo.
  it('cierra el cuadro anterior recien cuando llega el siguiente', () => {
    const primero = resultado([{}]);
    const segundo = resultado([{}]);
    const segmentador = crearSegmentador({
      segmentadorCrudo: segmentadorQueDevuelve(primero, segundo),
    });

    segmentador.detectar(LIENZO, 0);
    expect(primero.cerrado).toBe(false);

    segmentador.detectar(LIENZO, 50);
    expect(primero.cerrado).toBe(true);
    expect(segundo.cerrado).toBe(false);
  });

  // Es un agregado: si falla en un cuadro, la silueta sale de la pose sola. No
  // puede tirar el bucle de dibujo.
  it('un cuadro que falla devuelve null sin lanzar', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const segmentador = crearSegmentador({
      segmentadorCrudo: {
        segmentForVideo: () => {
          throw new Error('se perdio el contexto WebGL');
        },
        close: () => {},
      },
    });

    expect(() => segmentador.detectar(LIENZO, 0)).not.toThrow();
    expect(segmentador.detectar(LIENZO, 50)).toBeNull();
  });

  it('avisa una sola vez, no veinte por segundo', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const segmentador = crearSegmentador({
      segmentadorCrudo: {
        segmentForVideo: () => {
          throw new Error('falla');
        },
        close: () => {},
      },
    });

    for (let i = 0; i < 5; i++) segmentador.detectar(LIENZO, i * 50);
    expect(aviso).toHaveBeenCalledTimes(1);
  });

  it('devuelve null si la fuente todavia no tiene tamaño', () => {
    const crudo = segmentadorQueDevuelve(resultado([{}]));
    const segmentador = crearSegmentador({ segmentadorCrudo: crudo });

    expect(segmentador.detectar({ width: 0, height: 0 }, 0)).toBeNull();
    expect(crudo.pedidos).toHaveLength(0);
  });

  it('devuelve null si el cuadro no trae mascaras', () => {
    const segmentador = crearSegmentador({
      segmentadorCrudo: segmentadorQueDevuelve(resultado([]), undefined),
    });

    expect(segmentador.detectar(LIENZO, 0)).toBeNull();
    expect(segmentador.detectar(LIENZO, 50)).toBeNull();
  });

  // Cuando la silueta deja de armarse —se apaga el fondo, se pierde la pose—
  // el ultimo cuadro no tiene por que quedar ocupando la GPU hasta la sesion
  // siguiente.
  it('soltar libera el ultimo cuadro y deja el modelo andando', () => {
    const primero = resultado([{}]);
    const persona = { nombre: 'persona' };
    const crudo = segmentadorQueDevuelve(primero, resultado([persona]));
    const segmentador = crearSegmentador({ segmentadorCrudo: crudo });

    segmentador.detectar(LIENZO, 0);
    segmentador.soltar();

    expect(primero.cerrado).toBe(true);
    expect(crudo.close).not.toHaveBeenCalled();
    expect(segmentador.detectar(LIENZO, 50)).toBe(persona);
  });

  it('cerrar libera el ultimo cuadro y el modelo', () => {
    const ultimo = resultado([{}]);
    const crudo = segmentadorQueDevuelve(ultimo);
    const segmentador = crearSegmentador({ segmentadorCrudo: crudo });

    segmentador.detectar(LIENZO, 0);
    segmentador.cerrar();

    expect(ultimo.cerrado).toBe(true);
    expect(crudo.close).toHaveBeenCalled();
  });
});
