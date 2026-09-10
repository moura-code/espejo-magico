import { describe, it, expect } from 'vitest';
import { lugarEnPantalla, posicionEnVuelo, flotacion } from '../../espejo/vuelo.js';
import { calcularRectanguloVideo } from '../../espejo/escena.js';

describe('lugarEnPantalla', () => {
  const ESPEJO = { ancho: 1080, alto: 1920 };
  const APAISADA = { ancho: 1920, alto: 1080 };

  // En la pantalla para la que se preparo la foto, el lugar es el que se eligio
  // mirando en herramientas/fondos.html: no se toca.
  it('en la pantalla de la foto el lugar es exactamente el elegido', () => {
    const rectangulo = { x: 0, y: 0, ancho: 1080, alto: 1920 };
    const puesto = lugarEnPantalla({ x: 0.25, y: 0.297, escala: 0.15 }, rectangulo, ESPEJO, 1.25);
    expect(puesto.x).toBeCloseTo(270);
    expect(puesto.y).toBeCloseTo(570.24);
    // La escala es el diametro como fraccion del ancho de la foto.
    expect(puesto.radio).toBeCloseTo(81);
  });

  // Los fondos se preparan en 1080x1920, para el espejo vertical. En un monitor
  // apaisado la foto entra al ancho y solo se ve su franja del medio: medido
  // contra la foto entera, un lugar de arriba caia por encima del borde, donde
  // nadie lo ve. Se mide contra lo que se ve de la foto.
  it('en un monitor apaisado ubica el lugar sobre lo que se ve de la foto', () => {
    const rectangulo = calcularRectanguloVideo(1080, 1920, APAISADA.ancho, APAISADA.alto);
    const puesto = lugarEnPantalla({ x: 0.25, y: 0.297, escala: 0.15 }, rectangulo, APAISADA, 1.25);
    expect(puesto.x).toBeCloseTo(480); // 0.25 × 1920
    expect(puesto.y).toBeCloseTo(320.76); // 0.297 × 1080
    // 0.15 × (1080 × 9/16) / 2: la composicion vertical, a la altura de la pantalla.
    expect(puesto.radio).toBeCloseTo(45.5625);
  });

  // El video de la camara se dibuja cubriendo: en el espejo lo agranda 1920/720
  // y en un monitor apaisado 1920/1280, o sea que ahi la persona se ve 0,5625
  // veces mas chica. El objeto tiene que achicarse igual: si no, en apaisado
  // un objeto del fondo seria del tamaño de una cabeza.
  it('el objeto guarda la misma proporcion con la persona en cualquier pantalla', () => {
    const lugar = { x: 0.2, y: 0.2, escala: 0.15 };
    const radioEn = (pantalla) =>
      lugarEnPantalla(lugar, calcularRectanguloVideo(1080, 1920, pantalla.ancho, pantalla.alto), pantalla)
        .radio;
    expect(radioEn(APAISADA) / radioEn(ESPEJO)).toBeCloseTo(0.5625);
  });

  // EL BUG DE LOS CUATRO OBJETOS. Recortar cada lugar contra el borde, de a uno,
  // amontonaba contra el borde de arriba todos los que en la foto estaban
  // arriba: dos objetos de un mismo costado quedaban uno encima del otro. La
  // composicion se achica entera y dos que no se pisan en el espejo tampoco se
  // pisan en apaisado.
  it('dos objetos que no se pisan en el espejo tampoco se pisan en apaisado', () => {
    const arriba = { x: 0.17, y: 0.16, escala: 0.15 };
    const abajo = { x: 0.16, y: 0.42, escala: 0.11 };
    for (const pantalla of [ESPEJO, APAISADA]) {
      const rectangulo = calcularRectanguloVideo(1080, 1920, pantalla.ancho, pantalla.alto);
      const a = lugarEnPantalla(arriba, rectangulo, pantalla, 1.25);
      const b = lugarEnPantalla(abajo, rectangulo, pantalla, 1.25);
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(a.radio + b.radio);
    }
  });

  // `margen` es en radios, medido desde el centro: 1 es tocar el borde, y un
  // poco mas deja aire para que no se lea como que se cae de la pantalla.
  it('un lugar pegado al borde se corre lo justo para que el objeto entre entero', () => {
    const rectangulo = { x: 0, y: 0, ancho: 1080, alto: 1920 };
    const puesto = lugarEnPantalla({ x: 0.02, y: 0.5, escala: 0.15 }, rectangulo, ESPEJO, 1.25);
    expect(puesto.x).toBeCloseTo(101.25); // 81 × 1.25
    expect(puesto.y).toBeCloseTo(960);
  });

  it('tambien de costado: una foto apaisada en el espejo vertical', () => {
    const rectangulo = calcularRectanguloVideo(1920, 1080, ESPEJO.ancho, ESPEJO.alto);
    const puesto = lugarEnPantalla({ x: 0.1, y: 0.5, escala: 0.05 }, rectangulo, ESPEJO);
    expect(puesto.x).toBeCloseTo(108);
    expect(puesto.y).toBeCloseTo(960);
    expect(puesto.radio).toBeCloseTo(27);
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
