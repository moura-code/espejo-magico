import { describe, it, expect } from 'vitest';
import { calcularAnclaje } from '../../espejo/anclaje.js';

const IMAGEN = { ancho: 400, alto: 200 };
const ACCESORIO = { anclaOjoIzq: [0.25, 0.5], anclaOjoDer: [0.75, 0.5], offsetY: 0 };

const rostro = (izq, der) => ({
  presente: true,
  ojoIzq: { x: izq[0], y: izq[1] },
  ojoDer: { x: der[0], y: der[1] },
  centro: { x: (izq[0] + der[0]) / 2, y: (izq[1] + der[1]) / 2 },
  radio: 100,
  angulo: 0,
  confianza: 1,
});

describe('calcularAnclaje', () => {
  it('centra el accesorio entre los ojos', () => {
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, IMAGEN);
    expect(a.x).toBeCloseTo(500);
    expect(a.y).toBeCloseTo(500);
  });

  it('escala 1 cuando la separacion de ojos coincide con la de los anclajes', () => {
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, IMAGEN);
    expect(a.escala).toBeCloseTo(1);
  });

  it('achica el accesorio cuando la cara esta mas lejos', () => {
    const a = calcularAnclaje(rostro([450, 500], [550, 500]), ACCESORIO, IMAGEN);
    expect(a.escala).toBeCloseTo(0.5);
  });

  it('devuelve el punto medio de los anclajes en pixeles del dibujo', () => {
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, IMAGEN);
    expect(a.anclaX).toBeCloseTo(200);
    expect(a.anclaY).toBeCloseTo(100);
  });

  it('rota y escala segun la inclinacion de la cabeza', () => {
    const a = calcularAnclaje(rostro([400, 500], [500, 600]), ACCESORIO, IMAGEN);
    expect(a.angulo).toBeCloseTo(Math.PI / 4);
    expect(a.escala).toBeCloseTo(Math.hypot(100, 100) / 200);
    expect(a.x).toBeCloseTo(450);
    expect(a.y).toBeCloseTo(550);
  });

  it('un offsetY positivo baja el accesorio en proporcion a la separacion de ojos', () => {
    const casco = { ...ACCESORIO, offsetY: 0.5 };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), casco, IMAGEN);
    expect(a.x).toBeCloseTo(500);
    expect(a.y).toBeCloseTo(600);
  });

  it('un offsetY negativo lo sube, que es el caso del casco', () => {
    const casco = { ...ACCESORIO, offsetY: -0.5 };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), casco, IMAGEN);
    expect(a.y).toBeCloseTo(400);
  });

  it('el offset acompaña la inclinacion de la cabeza, no la vertical de la pantalla', () => {
    const casco = { ...ACCESORIO, offsetY: 0.5 };
    const a = calcularAnclaje(rostro([400, 500], [500, 600]), casco, IMAGEN);
    expect(a.x).toBeCloseTo(400);
    expect(a.y).toBeCloseTo(600);
  });

  it('devuelve null si no hay rostro, accesorio o imagen', () => {
    expect(calcularAnclaje(null, ACCESORIO, IMAGEN)).toBeNull();
    expect(calcularAnclaje(rostro([400, 500], [600, 500]), null, IMAGEN)).toBeNull();
    expect(calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, null)).toBeNull();
  });

  it('devuelve null si los ojos coinciden o los anclajes coinciden', () => {
    expect(calcularAnclaje(rostro([500, 500], [500, 500]), ACCESORIO, IMAGEN)).toBeNull();
    const pegados = { anclaOjoIzq: [0.5, 0.5], anclaOjoDer: [0.5, 0.5] };
    expect(calcularAnclaje(rostro([400, 500], [600, 500]), pegados, IMAGEN)).toBeNull();
  });

  it('trata offsetY ausente como cero', () => {
    const sinOffset = { anclaOjoIzq: [0.25, 0.5], anclaOjoDer: [0.75, 0.5] };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), sinOffset, IMAGEN);
    expect(a.y).toBeCloseTo(500);
  });

  it('funciona con anclajes que no estan centrados en el dibujo', () => {
    // Un casco: los ojos van abajo del PNG, no en el medio.
    const casco = { anclaOjoIzq: [0.3, 0.8], anclaOjoDer: [0.7, 0.8], offsetY: 0 };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), casco, IMAGEN);

    expect(a.anclaX).toBeCloseTo(200);
    expect(a.anclaY).toBeCloseTo(160);
    expect(a.escala).toBeCloseTo(200 / 160);
  });
});
