import { describe, it, expect } from 'vitest';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

// La exploracion no tiene duracion propia: dura mientras la persona siga
// sentada, con sesionMaxima como unico tope. `eleccionMaxima` ya no termina
// nada — es la red de seguridad de la fila, que le muestra una ingenieria a
// quien no entendio el gesto.
const TIEMPOS = {
  enganche: 2000,
  humo: 3000,
  ayudaEleccion: 4000,
  eleccionMaxima: 10000,
  cierre: 4000,
  enfriamiento: 3000,
  ausenciaParaCortar: 5000,
  sesionMaxima: 75000,
};

const OFRECIDAS = ['civil', 'quimica', 'naval', 'forestal', 'mecanica'];

function nueva(opciones = OFRECIDAS) {
  return crearMaquina({ tiempos: TIEMPOS, sortearOpciones: () => [...opciones] });
}

/** Avanza el reloj de a 100 ms hasta `hasta`, juntando todos los eventos. */
function avanzar(maquina, desde, hasta, hayRostro, extra = {}) {
  const eventos = [];
  let ahora = desde;
  let ultimo = null;
  while (ahora <= hasta) {
    ultimo = maquina.actualizar({ hayRostro, ...extra, ahora });
    eventos.push(...ultimo.eventos);
    ahora += 100;
  }
  return { ...ultimo, eventos, ahora: ahora - 100 };
}

/** Deja la maquina en EXPLORACION, con la persona sentada. */
function hastaExplorar(maquina = nueva()) {
  avanzar(maquina, 0, 6000, true);
  return maquina;
}

const tipos = (eventos, tipo) => eventos.filter((e) => e.tipo === tipo);
const entra = (eventos, estado) =>
  eventos.filter((e) => e.tipo === 'entra' && e.estado === estado);

describe('crearMaquina', () => {
  it('arranca en atraccion sin nada ofrecido', () => {
    const maquina = nueva();
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();
    expect(maquina.opciones()).toEqual([]);
    expect(maquina.sesion()).toBe(0);
  });

  it('pasa a enganche apenas hay rostro', () => {
    const maquina = nueva();
    const salida = maquina.actualizar({ hayRostro: true, ahora: 0 });
    expect(salida.estado).toBe(ESTADOS.ENGANCHE);
    expect(tipos(salida.eventos, 'entra')).toHaveLength(1);
  });

  it('una pose sin rostro no inicia la experiencia', () => {
    const maquina = nueva();
    const salida = maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 0 });
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
  });

  it('recorre el ciclo completo: la persona entra, explora y se va', () => {
    const maquina = nueva();

    // 0 enganche, 2000 humo, 5000 exploracion. Se va a los 20100, el cierre
    // llega a los 25100 y la atraccion a los 29100.
    const conPersona = avanzar(maquina, 0, 20000, true);
    const sinPersona = avanzar(maquina, 20100, 32000, false);

    const vistos = [...conPersona.eventos, ...sinPersona.eventos]
      .filter((e) => e.tipo === 'entra')
      .map((e) => e.estado);

    expect(vistos).toEqual([
      ESTADOS.ENGANCHE,
      ESTADOS.HUMO,
      ESTADOS.EXPLORACION,
      ESTADOS.CIERRE,
      ESTADOS.ATRACCION,
    ]);
  });

  // Las carreras se sortean mientras el humo tapa la pantalla: ese margen le
  // sirve al espejo para tener listos los PNG y los fondos, y como todavia no se
  // ve nada tampoco se cuenta el final.
  it('sortea lo que se ofrece al entrar en humo, no antes', () => {
    const maquina = nueva();

    avanzar(maquina, 0, 1900, true);
    expect(maquina.estado()).toBe(ESTADOS.ENGANCHE);
    expect(maquina.opciones()).toEqual([]);

    avanzar(maquina, 2000, 2100, true);
    expect(maquina.estado()).toBe(ESTADOS.HUMO);
    expect(maquina.opciones()).toEqual(OFRECIDAS);
    // Todavia no hay carrera: eso lo decide la persona.
    expect(maquina.carrera()).toBeNull();
  });

  it('conserva lo ofrecido durante la exploracion', () => {
    const maquina = nueva();
    const hastaExploracion = avanzar(maquina, 0, 6000, true);
    expect(hastaExploracion.estado).toBe(ESTADOS.EXPLORACION);
    expect(hastaExploracion.opciones).toEqual(OFRECIDAS);
    expect(hastaExploracion.carrera).toBeNull();
  });

  it('informa desde cuando esta en el estado actual', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 1500 });
    expect(maquina.desdeCuando()).toBe(1500);
  });
});

// ---------------------------------------------------------------------------
// La exploracion: agarrar un objeto muestra su ingenieria y CIERRA LA ELECCION.
// Se elige una sola vez; a partir de ahi la carrera no se mueve hasta que se
// vaya la persona, y quien dibuja apaga el carrusel.
// ---------------------------------------------------------------------------

describe('mirar', () => {
  it('muestra la carrera sin salir de la exploracion', () => {
    const maquina = hastaExplorar();

    const salida = maquina.mirar('naval', 6100);

    expect(salida.estado).toBe(ESTADOS.EXPLORACION);
    expect(salida.carrera).toBe('naval');
  });

  // SE ELIGE UNA SOLA VEZ. La guarda vive aca y no en quien dibuja: aunque en
  // la pantalla ya no queden objetos, un `mirar` que llegara igual reiniciaria
  // el reloj del fondo y le mandaria otro aviso a MAITE.
  it('agarrar otro objeto ya no cambia la carrera mostrada', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    const segunda = maquina.mirar('civil', 8000);

    expect(segunda.estado).toBe(ESTADOS.EXPLORACION);
    expect(segunda.carrera).toBe('naval');
    expect(segunda.eventos).toEqual([]);
  });

  // La sesion es la persona, no cada objeto que toca. Si contara por objeto,
  // el numero de la jornada diria cuantas veces se estiro un brazo.
  it('cuenta una sola sesion por persona', () => {
    const maquina = hastaExplorar();

    maquina.mirar('naval', 6100);
    maquina.mirar('civil', 8000);
    maquina.mirar('quimica', 9000);

    expect(maquina.sesion()).toBe(1);
  });

  // Un solo aviso por persona: MAITE se entera una vez de que ese visitante es
  // de naval y las tablets se quedan ahi mientras dure la sesion.
  it('avisa una sola vez, y nunca mas', () => {
    const maquina = hastaExplorar();

    const primera = maquina.mirar('naval', 6100);
    // Volver a agarrar el mismo objeto no reenvia nada: es lo que evita que
    // las tablets de MAITE parpadeen mientras la mano tiembla sobre un blanco.
    const repetida = maquina.mirar('naval', 7000);
    const otra = maquina.mirar('civil', 8000);

    expect(tipos(primera.eventos, 'mira')).toHaveLength(1);
    expect(primera.eventos[0].carrera).toBe('naval');
    expect(repetida.eventos).toEqual([]);
    expect(otra.eventos).toEqual([]);
  });

  // Es el reloj de la aparicion, y no se puede reiniciar: si un `mirar` tardio
  // lo moviera, el fondo volveria a entrar desde cero delante de alguien que ya
  // lo estaba mirando.
  it('lleva el reloj de cuando empezo a mostrarse la carrera, y no se mueve', () => {
    const maquina = hastaExplorar();

    maquina.mirar('naval', 6100);
    expect(maquina.miraDesdeCuando()).toBe(6100);

    maquina.mirar('civil', 9000);
    expect(maquina.miraDesdeCuando()).toBe(6100);
  });

  it('no hace nada fuera de la exploracion', () => {
    const maquina = nueva();

    expect(maquina.mirar('naval', 0).estado).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();
  });
});

describe('exploracion sin eleccion', () => {
  // Protege contra volver a asignar la primera carrera cuando alguien no
  // entendio el gesto: la experiencia debe pedir ayuda y liberarse, no decidir
  // una identidad en su nombre.
  it('pide ayuda una sola vez antes de cerrar sin elegir', () => {
    const maquina = hastaExplorar();
    const salida = avanzar(maquina, 6100, 16100, true);

    expect(tipos(salida.eventos, 'ayuda-eleccion')).toHaveLength(1);
    expect(salida.carrera).toBeNull();
    expect(salida.estado).toBe(ESTADOS.CIERRE);
  });

  it('no emite mira al vencer el plazo de eleccion', () => {
    const maquina = hastaExplorar();
    const salida = avanzar(maquina, 6100, 16100, true);

    expect(tipos(salida.eventos, 'mira')).toEqual([]);
  });
});

describe('el rostro sostiene la sesion', () => {
  // Antes los hombros mantenian viva la sesion con la cara girada. Ahora el
  // rostro es lo que manda: cuando deja de reconocerse, el espejo vuelve a su
  // pantalla inicial y queda libre para el que sigue en la fila.
  it('vuelve al cierre cuando se pierde el rostro, aunque siga habiendo pose', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    let salida = null;
    for (let ahora = 6200; ahora <= 6200 + TIEMPOS.ausenciaParaCortar + 200; ahora += 100) {
      salida = maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora });
    }

    expect(salida.estado).toBe(ESTADOS.CIERRE);
  });

  // El colchon existe para que girar la cabeza un instante no corte la escena.
  it('aguanta una perdida corta del rostro sin cortar', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    let salida = null;
    for (let ahora = 6200; ahora <= 6200 + TIEMPOS.ausenciaParaCortar - 500; ahora += 100) {
      salida = maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora });
    }

    expect(salida.estado).toBe(ESTADOS.EXPLORACION);
  });

  it('vuelve a la pantalla inicial despues del cierre', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    const salida = avanzar(maquina, 6200, 20000, false);

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();
    expect(maquina.opciones()).toEqual([]);
  });

  it('corta a cierre si la persona se va durante la exploracion', () => {
    const maquina = hastaExplorar();

    const salida = avanzar(maquina, 6100, 11500, false);
    expect(salida.estado).toBe(ESTADOS.CIERRE);
    expect(salida.carrera).toBeNull();
  });

  it('corta a cierre si la persona se va durante el humo', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 2100, true);
    expect(maquina.estado()).toBe(ESTADOS.HUMO);

    const salida = avanzar(maquina, 2200, 7500, false);
    expect(salida.estado).toBe(ESTADOS.CIERRE);
  });

  it('la exploracion no termina sola: sigue mientras la persona siga sentada', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    // No alcanza con mirar el estado final: el ciclo entero dura menos de un
    // minuto, asi que podria dar la vuelta y volver a caer en EXPLORACION. Lo
    // que se exige es que no haya habido ni un solo cambio de estado.
    const salida = avanzar(maquina, 6200, 60000, true);
    expect(salida.estado).toBe(ESTADOS.EXPLORACION);
    expect(tipos(salida.eventos, 'entra')).toHaveLength(0);
  });
});

describe('la red de seguridad de la fila', () => {
  it('libera el espejo si nadie eligio', () => {
    const maquina = hastaExplorar();

    const vencido = avanzar(maquina, 6100, 6100 + TIEMPOS.eleccionMaxima + 200, true);

    expect(vencido.estado).toBe(ESTADOS.CIERRE);
    expect(vencido.carrera).toBeNull();
    expect(maquina.sesion()).toBe(0);
  });

  // LA RED NO PUEDE ROBARLE EL GESTO A QUIEN YA ESTA ELIGIENDO. Desde que la
  // eleccion es definitiva, vencer el plazo con la mano sostenida sobre un
  // objeto significaria irse con una ingenieria sorteada, sin poder corregirla.
  it('espera a que termine el sostenido en curso antes de sortear', () => {
    const maquina = hastaExplorar();
    const vencido = avanzar(maquina, 6100, 6100 + TIEMPOS.eleccionMaxima + 5000, true, {
      eligiendo: true,
    });

    expect(vencido.estado).toBe(ESTADOS.EXPLORACION);
    expect(vencido.carrera).toBeNull();
  });

  // Al soltar el sostenido vencido, se libera el espejo sin adjudicar una carrera.
  it('cierra apenas se suelta el sostenido, si el plazo ya vencio', () => {
    const maquina = hastaExplorar();
    avanzar(maquina, 6100, 6100 + TIEMPOS.eleccionMaxima + 5000, true, { eligiendo: true });

    const suelto = maquina.actualizar({
      hayRostro: true,
      eligiendo: false,
      ahora: 6100 + TIEMPOS.eleccionMaxima + 5100,
    });

    expect(suelto.estado).toBe(ESTADOS.CIERRE);
    expect(suelto.carrera).toBeNull();
  });

  it('no acepta una carrera despues de haber cerrado sin eleccion', () => {
    const maquina = hastaExplorar();
    const vencido = avanzar(maquina, 6100, 6100 + TIEMPOS.eleccionMaxima + 200, true);

    const despues = maquina.mirar('civil', vencido.ahora + 100);

    expect(despues.carrera).toBeNull();
    expect(despues.eventos).toEqual([]);
  });

  it('no pisa la carrera que la persona ya estaba mirando', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    const vencido = avanzar(maquina, 6200, 6200 + TIEMPOS.eleccionMaxima + 200, true);

    expect(vencido.carrera).toBe('naval');
  });

  it('no emite una mirada despues de cerrar sin eleccion', () => {
    const maquina = hastaExplorar();

    const primera = avanzar(maquina, 6100, 6100 + TIEMPOS.eleccionMaxima + 200, true);
    const despues = avanzar(maquina, primera.ahora + 100, primera.ahora + 30000, true);

    expect(tipos(despues.eventos, 'mira')).toHaveLength(0);
  });
});

describe('el enganche', () => {
  it('espera cinco segundos antes de volver al reposo', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });

    const breve = maquina.actualizar({ hayRostro: false, ahora: 100 });
    expect(breve.estado).toBe(ESTADOS.ENGANCHE);

    const salida = maquina.actualizar({ hayRostro: false, ahora: 5100 });
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.carrera).toBeNull();
  });

  // `desde` es el reloj del estado y ademas alimenta la transicion visual via
  // desdeCuando(). Medir el rostro continuo pisandolo hacia que el humo volviera
  // a alfa cero de golpe en cada parpadeo del detector.
  it('el reloj del estado no se reinicia cuando parpadea la deteccion', () => {
    const maquina = nueva();
    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 0 });
    expect(maquina.desdeCuando()).toBe(0);

    maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 500 });
    expect(maquina.desdeCuando()).toBe(0);

    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 900 });
    expect(maquina.desdeCuando()).toBe(0);
  });

  it('exige dos segundos continuos de rostro', () => {
    const maquina = nueva();
    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 0 });
    maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 200 });
    maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 4000 });

    // Los dos segundos se cuentan desde que el rostro vuelve (4100), no desde
    // el ultimo cuadro sin rostro: es lo que significa "continuo".
    expect(
      maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 4100 }).estado,
    ).toBe(ESTADOS.ENGANCHE);
    expect(
      maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 6099 }).estado,
    ).toBe(ESTADOS.ENGANCHE);
    expect(
      maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 6100 }).estado,
    ).toBe(ESTADOS.HUMO);
  });

  it('no levanta el humo si la persona se fue durante el enganche', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });
    const salida = avanzar(maquina, 100, 5500, false);

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.opciones).toEqual([]);
    expect(maquina.sesion()).toBe(0);
  });

  // Un rostro que aparece y desaparece nunca junta los dos segundos continuos, y
  // como la persona esta ahi tampoco acumula la ausencia que corta. Sin un tope
  // el espejo se queda destapado y quieto, fuera de la red de seguridad.
  it('vuelve al reposo al llegar al tope de sesion', () => {
    const maquina = crearMaquina({
      tiempos: { ...TIEMPOS, sesionMaxima: 20000 },
      sortearOpciones: () => [...OFRECIDAS],
    });

    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 0 });
    expect(maquina.estado()).toBe(ESTADOS.ENGANCHE);

    const eventos = [];
    for (let ahora = 100; ahora <= 25000; ahora += 100) {
      // Un segundo con rostro y uno sin: nunca dos seguidos, nunca cinco sin.
      const puedeIniciar = ahora % 2000 < 1000;
      eventos.push(...maquina.actualizar({ puedeIniciar, hayPersona: true, ahora }).eventos);
    }

    expect(entra(eventos, ESTADOS.ATRACCION)).toHaveLength(1);
    expect(maquina.sesion()).toBe(0);
  });
});

describe('el enfriamiento y el tope de sesion', () => {
  it('no arranca otra sesion durante el enfriamiento', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);

    // Se va: cierre por ausencia a los 11200 y vuelta a atraccion a los 15200,
    // que es donde arranca el enfriamiento.
    const finDelCiclo = avanzar(maquina, 6200, 15500, false);
    expect(finDelCiclo.estado).toBe(ESTADOS.ATRACCION);
    expect(entra(finDelCiclo.eventos, ESTADOS.ATRACCION)).toHaveLength(1);

    // Vuelve enseguida: el enfriamiento todavia lo frena.
    const enFrio = maquina.actualizar({ hayRostro: true, ahora: 15600 });
    expect(enFrio.estado).toBe(ESTADOS.ATRACCION);

    const yaCaliente = maquina.actualizar({ hayRostro: true, ahora: 18300 });
    expect(yaCaliente.estado).toBe(ESTADOS.ENGANCHE);
  });

  it('corta por tope de sesion aunque la persona siga ahi', () => {
    const maquina = crearMaquina({
      tiempos: { ...TIEMPOS, sesionMaxima: 20000 },
      sortearOpciones: () => [...OFRECIDAS],
    });

    avanzar(maquina, 0, 6000, true);
    maquina.mirar('civil', 6100);
    const salida = avanzar(maquina, 6200, 25000, true);
    expect([ESTADOS.CIERRE, ESTADOS.ATRACCION]).toContain(salida.estado);
    expect(entra(salida.eventos, ESTADOS.CIERRE)).toHaveLength(1);
  });

  it('numera las sesiones de forma creciente', () => {
    const maquina = nueva();
    maquina.forzarCarrera('civil', 0);
    expect(maquina.sesion()).toBe(1);

    maquina.reiniciar(100);
    const segunda = maquina.forzarCarrera('naval', 200);
    expect(segunda.sesion).toBe(2);
  });

  // El ciclo tiene que cerrar sobre si mismo indefinidamente: en una tarde de
  // feria da cientos de vueltas sin que nadie lo toque.
  it('cada vuelta numera una sesion nueva, vuelta tras vuelta', () => {
    const maquina = nueva();
    const todos = [];
    for (let ahora = 0; ahora <= 2000; ahora += 200) {
      todos.push(...maquina.forzarCarrera('civil', ahora).eventos);
      todos.push(...maquina.reiniciar(ahora + 100).eventos);
    }

    // Cada sesion se cuenta cuando una persona efectivamente ve una carrera.
    const miradas = tipos(todos, 'mira');
    expect(miradas.length).toBeGreaterThan(1);
    expect(maquina.sesion()).toBe(miradas.length);

  });
});

describe('atajos del stand', () => {
  it('forzarCarrera salta a la exploracion con la carrera pedida', () => {
    const maquina = nueva();
    const salida = maquina.forzarCarrera('quimica', 500);

    expect(salida.estado).toBe(ESTADOS.EXPLORACION);
    expect(salida.carrera).toBe('quimica');
    expect(salida.sesion).toBe(1);
  });

  // Sin pisar las opciones, forzar una carrera desde una exploracion en curso
  // mostraria la primera de la lista anterior y no la que se pidio.
  it('forzarCarrera manda incluso desde una exploracion en curso', () => {
    const maquina = hastaExplorar();
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);

    const salida = maquina.forzarCarrera('quimica', 6100);
    expect(salida.carrera).toBe('quimica');
  });

  it('reiniciar vuelve a atraccion y deja lista otra sesion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);

    const salida = maquina.reiniciar(8100);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.carrera).toBeNull();
    expect(salida.opciones).toEqual([]);

    expect(maquina.actualizar({ hayRostro: true, ahora: 8200 }).estado).toBe(ESTADOS.ENGANCHE);
  });

  it('reiniciar corta la sesion desde cualquier estado', () => {
    for (const estado of [ESTADOS.HUMO, ESTADOS.EXPLORACION]) {
      const maquina = nueva();
      avanzar(maquina, 0, 2100, true);
      if (estado !== ESTADOS.HUMO) avanzar(maquina, 2200, 6000, true);
      expect(maquina.estado()).toBe(estado);

      const salida = maquina.reiniciar(9000);
      expect(salida.estado).toBe(ESTADOS.ATRACCION);
      expect(salida.eventos).toEqual([{ tipo: 'entra', estado: ESTADOS.ATRACCION }]);
    }
  });

  it('avanzar saltea la espera y pasa al estado siguiente', () => {
    const maquina = nueva();
    expect(maquina.avanzar(0).estado).toBe(ESTADOS.ENGANCHE);
    expect(maquina.avanzar(100).estado).toBe(ESTADOS.HUMO);
    expect(maquina.avanzar(200).estado).toBe(ESTADOS.EXPLORACION);
    expect(maquina.avanzar(300).estado).toBe(ESTADOS.CIERRE);
    expect(maquina.avanzar(400).estado).toBe(ESTADOS.ATRACCION);
  });

  it('avanzar sortea al llegar al humo, y la sesion la cuenta la mano', () => {
    const maquina = nueva();
    maquina.avanzar(0);
    maquina.avanzar(100);
    expect(maquina.opciones()).toEqual(OFRECIDAS);
    expect(maquina.sesion()).toBe(0);

    maquina.avanzar(200);
    const mirada = maquina.mirar(OFRECIDAS[0], 300);
    expect(mirada.carrera).toBe(OFRECIDAS[0]);
    expect(mirada.sesion).toBe(1);
  });

  it('avanzar no respeta el enfriamiento: si aprieto el boton, arranca', () => {
    const maquina = hastaExplorar();
    maquina.mirar('naval', 6100);
    avanzar(maquina, 6200, 25000, false);
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);

    expect(maquina.avanzar(25100).estado).toBe(ESTADOS.ENGANCHE);
  });
});

describe('modo manual', () => {
  const manual = () =>
    crearMaquina({ tiempos: TIEMPOS, sortearOpciones: () => [...OFRECIDAS], manual: true });

  /** Deja una maquina manual en EXPLORACION. */
  function manualExplorando() {
    const maquina = manual();
    maquina.avanzar(0);
    maquina.avanzar(100);
    maquina.avanzar(200);
    return maquina;
  }

  it('el reloj no cambia el estado', () => {
    const maquina = manual();
    const salida = avanzar(maquina, 0, 90000, true);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.eventos).toEqual([]);
  });

  it('no corta por ausencia de rostro', () => {
    const maquina = manualExplorando();
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);

    // Se va, y pasa mucho mas que la tolerancia de cinco segundos.
    avanzar(maquina, 600, 60000, false);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
  });

  // En manual la red de la fila tampoco se dispara sola: es lo que permite
  // dejar la exploracion abierta y probar el sostenido todo lo que haga falta.
  it('la red de la fila no se dispara sola', () => {
    const maquina = manualExplorando();

    avanzar(maquina, 300, 90000, true);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.carrera()).toBeNull();
  });

  // Pero agarrar con la mano tiene que seguir funcionando: es justamente el
  // gesto que se esta probando.
  it('mirar con la mano sigue andando', () => {
    const maquina = manualExplorando();

    const salida = maquina.mirar('forestal', 300);
    expect(salida.estado).toBe(ESTADOS.EXPLORACION);
    expect(salida.carrera).toBe('forestal');
  });

  it('se puede volver a automatico y el reloj manda de nuevo', () => {
    const maquina = manual();
    expect(maquina.esManual()).toBe(true);

    expect(maquina.alternarManual()).toBe(false);
    expect(maquina.actualizar({ hayRostro: true, ahora: 0 }).estado).toBe(ESTADOS.ENGANCHE);
  });

  it('arranca en automatico si no se pide lo contrario', () => {
    expect(nueva().esManual()).toBe(false);
  });
});
