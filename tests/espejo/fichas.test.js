import { describe, it, expect } from 'vitest';
import { crearFichas } from '../../espejo/fichas.js';

const AJUSTE = {
  msParaMostrar: 300,
  msDeGracia: 900,
  msDeEntrada: 450,
  msDeSalida: 700,
  radioFactor: 1.5,
};

const OBJETOS = [
  { id: 'a', x: 200, y: 300, radio: 60 },
  { id: 'b', x: 880, y: 300, radio: 60 },
];
const [A, B] = OBJETOS;

// A 60 cuadros por segundo, como dibuja el espejo.
const PASO = 1000 / 60;
const sobre = (objeto) => [{ palma: { x: objeto.x, y: objeto.y } }];
const nada = () => [];

/** Corre de `desde` a `hasta` con la mano donde diga `manoEn(t)`; devuelve cada salida. */
function correr(fichas, desde, hasta, manoEn) {
  const salidas = [];
  for (let t = desde; t < hasta; t += PASO) {
    salidas.push(fichas.actualizar({ manos: manoEn(t), objetivos: OBJETOS, ahora: t }));
  }
  return salidas;
}

const alfa = (salida, id) => salida.alfas[id] ?? 0;

describe('crearFichas', () => {
  it('sin manos no se abre ninguna', () => {
    const fichas = crearFichas(AJUSTE);
    const salida = correr(fichas, 0, 2000, nada).at(-1);
    expect(salida.activa).toBeNull();
    expect(salida.alfas).toEqual({});
  });

  // Pasar la mano camino a otro lado no puede ir abriendo fichas en cadena: la
  // pantalla se llenaria de carteles que nadie pidio.
  it('pasar la mano por encima un instante no la abre', () => {
    const fichas = crearFichas(AJUSTE);
    const salidas = [...correr(fichas, 0, 200, () => sobre(A)), ...correr(fichas, 200, 2000, nada)];
    expect(salidas.every((salida) => salida.activa === null)).toBe(true);
    expect(Math.max(...salidas.map((salida) => alfa(salida, 'a')))).toBe(0);
  });

  it('dejar la mano encima un momento la abre, y se enciende de a poco', () => {
    const fichas = crearFichas(AJUSTE);
    const recien = correr(fichas, 0, 400, () => sobre(A)).at(-1);
    expect(recien.activa).toBe('a');
    // Se abrio a los 300 ms y lleva unos 100 de los 450 que tarda en entrar.
    expect(alfa(recien, 'a')).toBeGreaterThan(0.1);
    expect(alfa(recien, 'a')).toBeLessThan(0.4);

    const entera = correr(fichas, 400, 1000, () => sobre(A)).at(-1);
    expect(alfa(entera, 'a')).toBe(1);
  });

  // La deteccion de manos se pierde varios cuadros por segundo. Si cada hueco
  // cerrara la ficha, parpadearia justo mientras la persona la lee.
  it('una deteccion que parpadea no la cierra ni la atenua', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));
    const salidas = correr(fichas, 1000, 5000, (t) =>
      Math.floor(t / PASO) % 4 === 3 ? [] : sobre(A),
    );
    expect(Math.min(...salidas.map((salida) => alfa(salida, 'a')))).toBe(1);
  });

  // Y tampoco le impide abrirse: si cada hueco reiniciara la espera, con la
  // mano de costado o mal iluminada la ficha no se abriria nunca.
  it('una deteccion que parpadea igual la abre', () => {
    const fichas = crearFichas(AJUSTE);
    const salida = correr(fichas, 0, 700, (t) =>
      Math.floor(t / PASO) % 4 === 3 ? [] : sobre(A),
    ).at(-1);
    expect(salida.activa).toBe('a');
  });

  // Bajar la mano para leer no la puede cerrar en el acto: la ficha espera la
  // gracia y recien despues se apaga, despacio.
  it('al sacar la mano espera la gracia y se apaga de a poco', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));

    const enGracia = correr(fichas, 1000, 1850, nada).at(-1);
    expect(enGracia.activa).toBe('a');
    expect(alfa(enGracia, 'a')).toBe(1);

    const apagandose = correr(fichas, 1850, 2200, nada).at(-1);
    expect(alfa(apagandose, 'a')).toBeGreaterThan(0.2);
    expect(alfa(apagandose, 'a')).toBeLessThan(1);

    const apagada = correr(fichas, 2200, 4000, nada).at(-1);
    expect(apagada.activa).toBeNull();
    expect(apagada.alfas).toEqual({});
  });

  // Pasar de un objeto a otro es un fundido cruzado, no un corte: por un rato
  // se ven las dos, una entrando y otra saliendo.
  it('pasar de un objeto a otro funde una ficha en la otra', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));

    const cruce = correr(fichas, 1000, 1450, () => sobre(B)).at(-1);
    expect(cruce.activa).toBe('b');
    expect(alfa(cruce, 'a')).toBeGreaterThan(0);
    expect(alfa(cruce, 'a')).toBeLessThan(1);
    expect(alfa(cruce, 'b')).toBeGreaterThan(0);

    const despues = correr(fichas, 1450, 3000, () => sobre(B)).at(-1);
    expect(despues.alfas).toEqual({ b: 1 });
  });

  // Mientras la mano esta yendo a otro objeto, la ficha que se estaba leyendo
  // sigue puesta: el objeto nuevo tiene que ganarse el lugar igual que el primero.
  it('la ficha abierta no se va hasta que la otra se gana su lugar', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));
    const yendo = correr(fichas, 1000, 1250, () => sobre(B)).at(-1);
    expect(yendo.activa).toBe('a');
    expect(yendo.alfas).toEqual({ a: 1 });
  });

  // Nunca hay un salto de un cuadro al otro. Es la regla de "evitar cosas que
  // parpadean", y la que se rompe primero si alguien cambia un fundido por un
  // corte para simplificar.
  it('ningun alfa salta de un cuadro al siguiente', () => {
    const fichas = crearFichas(AJUSTE);
    const recorrido = (t) => {
      if (t < 1200) return sobre(A);
      if (t < 2400) return sobre(B);
      if (t < 2600) return [];
      if (t < 4000) return Math.floor(t / PASO) % 3 === 0 ? [] : sobre(A);
      return [];
    };
    const salidas = correr(fichas, 0, 7000, recorrido);
    const maximo = PASO / Math.min(AJUSTE.msDeEntrada, AJUSTE.msDeSalida) + 1e-9;
    for (let i = 1; i < salidas.length; i++) {
      for (const id of ['a', 'b']) {
        expect(Math.abs(alfa(salidas[i], id) - alfa(salidas[i - 1], id))).toBeLessThanOrEqual(maximo);
      }
    }
  });

  // Si el navegador se traba un instante, un salto grande de reloj no puede
  // encender una ficha de golpe.
  it('un salto de reloj no enciende una ficha de golpe', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 350, () => sobre(A));
    const salida = fichas.actualizar({ manos: sobre(A), objetivos: OBJETOS, ahora: 9000 });
    expect(alfa(salida, 'a')).toBeLessThan(0.7);
  });

  // Y un tiron tampoco la apaga de golpe mientras alguien la lee: un cuadro
  // cuenta, como mucho, lo que cuenta un cuadro de 20 por segundo. Con un tope
  // de 250 ms, un solo tiron se comia un tercio del fundido.
  it('un tiron del navegador no apaga una ficha de golpe', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));
    // Pasa la gracia y empieza a apagarse.
    const antes = alfa(correr(fichas, 1000, 2000, nada).at(-1), 'a');
    expect(antes).toBeGreaterThan(0.5);
    const despues = alfa(fichas.actualizar({ manos: [], objetivos: OBJETOS, ahora: 2250 }), 'a');
    expect(antes - despues).toBeLessThanOrEqual(50 / AJUSTE.msDeSalida + 1e-9);
  });

  // La consigna que enseña a pasar la mano se apaga la primera vez que alguien
  // abre una ficha: para eso tiene que saberse cuando fue.
  it('recuerda cuando se abrio la primera ficha', () => {
    const fichas = crearFichas(AJUSTE);
    expect(correr(fichas, 0, 200, nada).at(-1).primera).toBeNull();

    const abierta = correr(fichas, 200, 900, () => sobre(A)).at(-1);
    expect(abierta.primera).toBeGreaterThanOrEqual(500);
    expect(abierta.primera).toBeLessThan(520);

    const otra = correr(fichas, 900, 2000, () => sobre(B)).at(-1);
    expect(otra.primera).toBe(abierta.primera);
  });

  it('reiniciar la deja como nueva', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));
    fichas.reiniciar();
    const salida = fichas.actualizar({ manos: [], objetivos: OBJETOS, ahora: 1000 });
    expect(salida).toEqual({ activa: null, alfas: {}, primera: null });
  });

  // Un objeto que deja de estar —el fondo se fue en el cierre— no puede dejar su
  // ficha colgada en pantalla.
  it('la ficha de un objeto que ya no esta se apaga', () => {
    const fichas = crearFichas(AJUSTE);
    correr(fichas, 0, 1000, () => sobre(A));
    let salida;
    for (let t = 1000; t < 4000; t += PASO) {
      salida = fichas.actualizar({ manos: sobre(A), objetivos: [B], ahora: t });
    }
    expect(salida.activa).toBeNull();
    expect(salida.alfas).toEqual({});
  });
});
