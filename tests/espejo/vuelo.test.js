import { describe, it, expect } from 'vitest';
import { lugarEnPantalla, posicionEnVuelo, flotacion } from '../../espejo/vuelo.js';
import { calcularRectanguloVideo } from '../../espejo/escena.js';

describe('lugarEnPantalla', () => {
  const ESPEJO = { ancho: 1080, alto: 1920 };

  // El fondo se dibuja cubriendo y recortado: un lugar normalizado a la IMAGEN
  // cae siempre en el mismo sitio de la escena, en cualquier resolucion.
  it('mapea el lugar sobre el rectangulo donde se dibujo el fondo', () => {
    const rectangulo = { x: -200, y: 0, ancho: 1480, alto: 1920 };
    const puesto = lugarEnPantalla({ x: 0.5, y: 0.25, escala: 0.2 }, rectangulo, ESPEJO);
    expect(puesto.x).toBeCloseTo(-200 + 740);
    expect(puesto.y).toBeCloseTo(480);
    // La escala es el diametro como fraccion del ancho dibujado.
    expect(puesto.radio).toBeCloseTo(148);
  });

  // Los fondos se preparan en 1080x1920, para el espejo vertical. En un monitor
  // apaisado —desarrollo— la foto se dibuja al ancho de la pantalla y solo se
  // ve su franja del medio: el rincon de arriba elegido para el objeto queda
  // recortado, y el objeto aterrizaba arriba del borde, donde nadie lo ve.
  it('si el recorte deja el lugar fuera de la pantalla, lo corre lo justo para que entre entero', () => {
    const apaisada = { ancho: 1920, alto: 1080 };
    const rectangulo = calcularRectanguloVideo(1080, 1920, apaisada.ancho, apaisada.alto);
    const lugar = { x: 0.25, y: 0.297, escala: 0.15 };
    const crudo = {
      x: rectangulo.x + lugar.x * rectangulo.ancho,
      y: rectangulo.y + lugar.y * rectangulo.alto,
    };
    expect(crudo.y).toBeLessThan(0); // el bug: el lugar cae arriba del borde

    const puesto = lugarEnPantalla(lugar, rectangulo, apaisada);
    expect(puesto.y - puesto.radio).toBeGreaterThanOrEqual(0);
    expect(puesto.y + puesto.radio).toBeLessThanOrEqual(apaisada.alto);
    // Se mueve solo lo que hace falta: el lado que eligio la catedra y el
    // tamaño quedan como estaban.
    expect(puesto.x).toBeCloseTo(crudo.x);
    expect(puesto.radio).toBeCloseTo(144);
  });

  // `margen` es en radios, medido desde el centro: 1 es tocar el borde, y un
  // poco mas deja aire para que no se lea como que se cae de la pantalla.
  it('con margen, deja aire entre el objeto y el borde', () => {
    const apaisada = { ancho: 1920, alto: 1080 };
    const rectangulo = calcularRectanguloVideo(1080, 1920, apaisada.ancho, apaisada.alto);
    const puesto = lugarEnPantalla({ x: 0.25, y: 0.297, escala: 0.15 }, rectangulo, apaisada, 1.25);
    expect(puesto.y).toBeCloseTo(puesto.radio * 1.25);
  });

  it('tambien de costado: una foto apaisada en el espejo vertical', () => {
    const rectangulo = calcularRectanguloVideo(1920, 1080, ESPEJO.ancho, ESPEJO.alto);
    const puesto = lugarEnPantalla({ x: 0.1, y: 0.5, escala: 0.05 }, rectangulo, ESPEJO);
    expect(puesto.x - puesto.radio).toBeGreaterThanOrEqual(0);
    expect(puesto.y).toBeCloseTo(960);
  });

  // En la pantalla para la que se preparo la foto, el lugar es el que se eligio
  // mirando en herramientas/fondos.html: no se toca.
  it('en la pantalla de la foto no mueve nada', () => {
    const rectangulo = { x: 0, y: 0, ancho: 1080, alto: 1920 };
    const puesto = lugarEnPantalla({ x: 0.25, y: 0.297, escala: 0.15 }, rectangulo, ESPEJO, 1.25);
    expect(puesto.x).toBeCloseTo(270);
    expect(puesto.y).toBeCloseTo(570.24);
    expect(puesto.radio).toBeCloseTo(81);
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
