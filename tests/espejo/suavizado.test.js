import { describe, it, expect } from 'vitest';
import {
  crearFiltroExponencial,
  crearFiltroRostro,
  crearFiltroDeManos,
  crearHisteresis,
  crearRastreadorDeVelocidad,
} from '../../espejo/suavizado.js';

describe('crearRastreadorDeVelocidad', () => {
  it('empieza quieto', () => {
    const rastreador = crearRastreadorDeVelocidad();
    expect(rastreador.actualizar(100, 100, 0)).toEqual({ vx: 0, vy: 0 });
  });

  it('mide la velocidad en pixeles por segundo', () => {
    const rastreador = crearRastreadorDeVelocidad({ alfa: 1 });
    rastreador.actualizar(0, 0, 0);
    // 100 px en 100 ms son 1000 px/s.
    expect(rastreador.actualizar(100, 0, 100)).toEqual({ vx: 1000, vy: 0 });
  });

  it('suaviza en vez de saltar de golpe', () => {
    const rastreador = crearRastreadorDeVelocidad({ alfa: 0.5 });
    rastreador.actualizar(0, 0, 0);
    expect(rastreador.actualizar(100, 0, 100).vx).toBeCloseTo(500);
  });

  it('acota la velocidad para que un parpadeo no dispare un objeto', () => {
    const rastreador = crearRastreadorDeVelocidad({ alfa: 1, maxima: 4000 });
    rastreador.actualizar(0, 0, 0);
    // Un salto de media pantalla en un solo cuadro.
    const { vx } = rastreador.actualizar(900, 0, 16);
    expect(vx).toBeLessThanOrEqual(4000);
  });

  it('mide velocidad negativa al volver', () => {
    const rastreador = crearRastreadorDeVelocidad({ alfa: 1 });
    rastreador.actualizar(500, 500, 0);
    expect(rastreador.actualizar(400, 500, 100).vx).toBeCloseTo(-1000);
  });

  it('ignora dos lecturas con la misma marca de tiempo', () => {
    const rastreador = crearRastreadorDeVelocidad({ alfa: 1 });
    rastreador.actualizar(0, 0, 100);
    expect(() => rastreador.actualizar(500, 0, 100)).not.toThrow();
    expect(Number.isFinite(rastreador.velocidad().vx)).toBe(true);
  });

  it('vuelve a cero al reiniciar', () => {
    const rastreador = crearRastreadorDeVelocidad({ alfa: 1 });
    rastreador.actualizar(0, 0, 0);
    rastreador.actualizar(100, 0, 100);
    rastreador.reiniciar();
    expect(rastreador.velocidad()).toEqual({ vx: 0, vy: 0 });
  });
});

const rostroEn = (x) => ({
  presente: true,
  centro: { x, y: 100 },
  ojoIzq: { x: x - 50, y: 100 },
  ojoDer: { x: x + 50, y: 100 },
  radio: 160,
  angulo: 0,
  confianza: 1,
});

describe('crearFiltroExponencial', () => {
  it('toma el primer valor tal cual', () => {
    const filtro = crearFiltroExponencial(0.5);
    expect(filtro.filtrar(10)).toBe(10);
  });

  it('se acerca al nuevo valor segun alfa, sin llegar de golpe', () => {
    const filtro = crearFiltroExponencial(0.5);
    filtro.filtrar(0);
    expect(filtro.filtrar(100)).toBe(50);
    expect(filtro.filtrar(100)).toBe(75);
  });

  it('un alfa mas chico responde mas lento', () => {
    const lento = crearFiltroExponencial(0.1);
    const rapido = crearFiltroExponencial(0.9);
    lento.filtrar(0);
    rapido.filtrar(0);
    expect(lento.filtrar(100)).toBeLessThan(rapido.filtrar(100));
  });

  it('conserva el ultimo valor si le llega null', () => {
    const filtro = crearFiltroExponencial(0.5);
    filtro.filtrar(42);
    expect(filtro.filtrar(null)).toBe(42);
  });

  it('vuelve a arrancar de cero despues de reiniciar', () => {
    const filtro = crearFiltroExponencial(0.5);
    filtro.filtrar(0);
    filtro.reiniciar();
    expect(filtro.filtrar(100)).toBe(100);
  });
});

describe('crearFiltroRostro', () => {
  it('suaviza el desplazamiento en vez de saltar', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));
    const suavizado = filtro.filtrar(rostroEn(300));

    expect(suavizado.centro.x).toBe(200);
    expect(suavizado.ojoIzq.x).toBe(150);
    expect(suavizado.ojoDer.x).toBe(250);
  });

  it('devuelve null sin tocar el estado cuando no hay rostro', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));
    expect(filtro.filtrar(null)).toBeNull();
    expect(filtro.filtrar(rostroEn(300)).centro.x).toBe(200);
  });

  it('despues de reiniciar toma la posicion nueva sin arrastrar la anterior', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));
    filtro.reiniciar();
    expect(filtro.filtrar(rostroEn(900)).centro.x).toBe(900);
  });

  it('conserva los campos que no se filtran', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    const salida = filtro.filtrar({ ...rostroEn(100), confianza: 0.73 });
    expect(salida.presente).toBe(true);
    expect(salida.confianza).toBe(0.73);
  });

  it('suaviza tambien el radio y el angulo', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar({ ...rostroEn(100), radio: 100, angulo: 0 });
    const suavizado = filtro.filtrar({ ...rostroEn(100), radio: 200, angulo: 0.4 });

    expect(suavizado.radio).toBeCloseTo(150);
    expect(suavizado.angulo).toBeCloseTo(0.2);
  });

  it('no muta el rostro que le entra', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));

    const entrada = rostroEn(300);
    filtro.filtrar(entrada);
    expect(entrada.centro.x).toBe(300);
    expect(entrada.ojoIzq.x).toBe(250);
  });
});

const manoEn = (x, extras = {}) => ({
  palma: { x, y: 100 },
  radio: 80,
  apertura: 1.5,
  largoPalma: 60,
  lado: 'Right',
  ...extras,
});

// Suavizado SOLO para el iman: el atractor sigue una palma filtrada para que el
// ruido de deteccion no haga temblar el racimo colgado de la mano. El modo
// golpe usa la palma cruda a proposito — el filtro mete retardo y el manotazo
// necesita reflejos.
describe('crearFiltroDeManos', () => {
  const nuevo = () =>
    crearFiltroDeManos({
      posicion: 0.5,
      radio: 0.5,
      retencionMs: 250,
      distanciaMaximaEnRadios: 3,
    });

  it('suaviza el desplazamiento de la palma en vez de copiarlo', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100)]);
    const [mano] = filtro.filtrar([manoEn(300)]);
    expect(mano.palma.x).toBe(200);
  });

  it('una mano nueva arranca donde aparece, sin arrastre', () => {
    const [mano] = nuevo().filtrar([manoEn(700)]);
    expect(mano.palma.x).toBe(700);
  });

  it('el radio tambien se suaviza', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100, { radio: 100 })]);
    const [mano] = filtro.filtrar([manoEn(100, { radio: 200 })]);
    expect(mano.radio).toBeCloseTo(150);
  });

  it('cada mano tiene su propio filtro', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100, { lado: 'Left' }), manoEn(900, { lado: 'Right' })]);
    const [izq, der] = filtro.filtrar([
      manoEn(200, { lado: 'Left' }),
      manoEn(800, { lado: 'Right' }),
    ]);
    expect(izq.palma.x).toBe(150);
    expect(der.palma.x).toBe(850);
  });

  // MediaPipe puede reportar dos manos del mismo lado. Si compartieran filtro,
  // el suavizado rebotaria entre las dos posiciones y saldria peor que crudo.
  it('dos manos del mismo lado no comparten filtro', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100), manoEn(900)]);
    const [primera, segunda] = filtro.filtrar([manoEn(120), manoEn(920)]);
    expect(primera.palma.x).toBe(110);
    expect(segunda.palma.x).toBe(910);
  });

  it('no intercambia historias si MediaPipe invierte el orden del arreglo', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100), manoEn(900)]);

    const [derecha, izquierda] = filtro.filtrar([manoEn(920), manoEn(120)]);

    expect(derecha.palma.x).toBe(910);
    expect(izquierda.palma.x).toBe(110);
  });

  it('asocia por cercania aunque cambie la etiqueta de lado', () => {
    const filtro = nuevo();
    const [primera] = filtro.filtrar([manoEn(100, { lado: 'Left' })], 0);
    const [segunda] = filtro.filtrar([manoEn(120, { lado: 'Right' })], 30);

    expect(segunda.idSeguimiento).toBe(primera.idSeguimiento);
    expect(segunda.palma.x).toBe(110);
  });

  it('conserva la historia durante una perdida breve', () => {
    const filtro = nuevo();
    const [primera] = filtro.filtrar([manoEn(100)], 0);
    filtro.filtrar([], 100);
    const [segunda] = filtro.filtrar([manoEn(140)], 200);

    expect(segunda.idSeguimiento).toBe(primera.idSeguimiento);
    expect(segunda.palma.x).toBe(120);
  });

  it('descarta la historia despues de la retencion', () => {
    const filtro = nuevo();
    const [primera] = filtro.filtrar([manoEn(100)], 0);
    filtro.filtrar([], 300);
    const [segunda] = filtro.filtrar([manoEn(140)], 310);

    expect(segunda.idSeguimiento).not.toBe(primera.idSeguimiento);
    expect(segunda.palma.x).toBe(140);
  });

  // Al reaparecer arranca en la posicion real: retomar la historia vieja haria
  // que el atractor se deslice desde donde estaba la mano anterior.
  it('una mano que desaparece pierde su historia', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100)]);
    filtro.filtrar([]);
    const [mano] = filtro.filtrar([manoEn(900)]);
    expect(mano.palma.x).toBe(900);
  });

  it('conserva los campos que no se filtran', () => {
    const filtro = nuevo();
    const [mano] = filtro.filtrar([manoEn(100)]);
    expect(mano.apertura).toBe(1.5);
    expect(mano.largoPalma).toBe(60);
    expect(mano.lado).toBe('Right');
  });

  it('no muta la mano que le entra', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100)]);
    const entrada = manoEn(300);
    filtro.filtrar([entrada]);
    expect(entrada.palma.x).toBe(300);
  });

  it('reiniciar olvida todas las manos', () => {
    const filtro = nuevo();
    filtro.filtrar([manoEn(100)]);
    filtro.reiniciar();
    const [mano] = filtro.filtrar([manoEn(500)]);
    expect(mano.palma.x).toBe(500);
  });
});

describe('crearHisteresis', () => {
  const opciones = { cuadrosParaEntrar: 3, msParaSalir: 400 };

  it('arranca en ausente', () => {
    expect(crearHisteresis(opciones).presente()).toBe(false);
  });

  it('no declara presencia antes de acumular los cuadros pedidos', () => {
    const h = crearHisteresis(opciones);
    expect(h.actualizar(true, 0)).toBe(false);
    expect(h.actualizar(true, 30)).toBe(false);
    expect(h.actualizar(true, 60)).toBe(true);
  });

  it('un cuadro perdido no corta la presencia si el rostro vuelve enseguida', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);
    expect(h.actualizar(false, 90)).toBe(true);
    expect(h.actualizar(true, 120)).toBe(true);
  });

  it('declara ausencia recien pasado msParaSalir', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);
    expect(h.actualizar(false, 100)).toBe(true);
    expect(h.actualizar(false, 400)).toBe(true);
    expect(h.actualizar(false, 501)).toBe(false);
  });

  it('exige acumular los cuadros de nuevo despues de una ausencia', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);
    h.actualizar(false, 100);
    h.actualizar(false, 600);
    expect(h.presente()).toBe(false);

    expect(h.actualizar(true, 700)).toBe(false);
    expect(h.actualizar(true, 730)).toBe(false);
    expect(h.actualizar(true, 760)).toBe(true);
  });

  it('cuenta la ausencia desde el primer cuadro sin rostro, no desde el ultimo', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);

    // Cinco cuadros seguidos sin rostro. El reloj de salida arranca en el primero.
    for (const t of [100, 200, 300, 400]) expect(h.actualizar(false, t)).toBe(true);
    expect(h.actualizar(false, 505)).toBe(false);
  });
});
