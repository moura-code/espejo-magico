import { describe, it, expect } from 'vitest';
import { lugarEnPantalla, posicionEnVuelo, flotacion } from '../../espejo/vuelo.js';

describe('lugarEnPantalla', () => {
  // El fondo se dibuja cubriendo y recortado: un lugar normalizado a la IMAGEN
  // cae siempre en el mismo sitio de la escena, en cualquier resolucion.
  it('mapea el lugar sobre el rectangulo donde se dibujo el fondo', () => {
    const rectangulo = { x: -200, y: 0, ancho: 1480, alto: 1920 };
    const puesto = lugarEnPantalla({ x: 0.5, y: 0.25, escala: 0.2 }, rectangulo);
    expect(puesto.x).toBeCloseTo(-200 + 740);
    expect(puesto.y).toBeCloseTo(480);
    // La escala es el diametro como fraccion del ancho dibujado.
    expect(puesto.radio).toBeCloseTo(148);
  });
});

describe('posicionEnVuelo', () => {
  const origen = { x: 100, y: 900, radio: 80 };
  const destino = { x: 300, y: 500, radio: 60 };

  it('arranca en el origen y termina en el destino', () => {
    expect(posicionEnVuelo({ origen, destino, t: 0 })).toEqual(origen);
    expect(posicionEnVuelo({ origen, destino, t: 1 })).toEqual(destino);
  });

  it('a mitad de camino esta a mitad de camino, con easing simetrico', () => {
    const medio = posicionEnVuelo({ origen, destino, t: 0.5 });
    expect(medio.x).toBeCloseTo(200);
    expect(medio.y).toBeCloseTo(700);
    expect(medio.radio).toBeCloseTo(70);
  });

  it('avanza sin volver atras', () => {
    let anterior = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const { x } = posicionEnVuelo({ origen, destino, t });
      expect(x).toBeGreaterThanOrEqual(anterior);
      anterior = x;
    }
  });

  it('acota t fuera del rango', () => {
    expect(posicionEnVuelo({ origen, destino, t: -3 })).toEqual(origen);
    expect(posicionEnVuelo({ origen, destino, t: 7 })).toEqual(destino);
  });

  // La red de la fila y una carrera forzada por teclado no tienen ranura a la
  // vista: el objeto aparece en su lugar creciendo desde cero.
  it('sin origen crece en su lugar', () => {
    expect(posicionEnVuelo({ origen: null, destino, t: 0 })).toEqual({ ...destino, radio: 0 });
    expect(posicionEnVuelo({ origen: null, destino, t: 0.5 }).radio).toBeCloseTo(30);
    expect(posicionEnVuelo({ origen: null, destino, t: 1 })).toEqual(destino);
  });
});

describe('flotacion', () => {
  const ajuste = { amplitud: 0.1, periodoMs: 2000 };

  it('sube y baja dentro de la amplitud, en radios del objeto', () => {
    for (let ahora = 0; ahora < 4000; ahora += 37) {
      const { dy, giro } = flotacion(ahora, 50, ajuste);
      expect(Math.abs(dy)).toBeLessThanOrEqual(5 + 1e-9);
      expect(Math.abs(giro)).toBeLessThan(0.1);
    }
  });

  it('es periodica', () => {
    const a = flotacion(300, 50, ajuste);
    const b = flotacion(2300, 50, ajuste);
    expect(a.dy).toBeCloseTo(b.dy);
    expect(a.giro).toBeCloseTo(b.giro);
  });

  it('se mueve de verdad', () => {
    const valores = new Set();
    for (let ahora = 0; ahora < 2000; ahora += 100) {
      valores.add(flotacion(ahora, 50, ajuste).dy.toFixed(3));
    }
    expect(valores.size).toBeGreaterThan(5);
  });
});
