import { describe, it, expect } from 'vitest';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

// La escena no tiene duracion propia: dura mientras la persona siga sentada,
// con sesionMaxima como unico tope. La eleccion tampoco: termina cuando la
// persona elige, y eleccionMaxima es solo la red de seguridad de la fila.
const TIEMPOS = {
  enganche: 2000,
  humo: 3000,
  eleccionMaxima: 10000,
  revelacion: 2000,
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
function avanzar(maquina, desde, hasta, hayRostro) {
  const eventos = [];
  let ahora = desde;
  let ultimo = null;
  while (ahora <= hasta) {
    ultimo = maquina.actualizar({ hayRostro, ahora });
    eventos.push(...ultimo.eventos);
    ahora += 100;
  }
  return { ...ultimo, eventos, ahora: ahora - 100 };
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

  it('recorre el ciclo completo: la persona entra, elige, vive su escena y se va', () => {
    const maquina = nueva();

    // 0 enganche, 2000 humo, 5000 eleccion, 15000 revelacion (tope), 17000 escena.
    const conPersona = avanzar(maquina, 0, 20000, true);
    const sinPersona = avanzar(maquina, 20100, 32000, false);

    const vistos = [...conPersona.eventos, ...sinPersona.eventos]
      .filter((e) => e.tipo === 'entra')
      .map((e) => e.estado);

    expect(vistos).toEqual([
      ESTADOS.ENGANCHE,
      ESTADOS.HUMO,
      ESTADOS.ELECCION,
      ESTADOS.REVELACION,
      ESTADOS.ESCENA,
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

  it('conserva lo ofrecido durante la eleccion', () => {
    const maquina = nueva();
    const hastaEleccion = avanzar(maquina, 0, 6000, true);
    expect(hastaEleccion.estado).toBe(ESTADOS.ELECCION);
    expect(hastaEleccion.opciones).toEqual(OFRECIDAS);
    expect(hastaEleccion.carrera).toBeNull();
  });
});

describe('elegir', () => {
  it('la carrera elegida pasa a la revelacion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);

    const salida = maquina.elegir('naval', 6100);
    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(salida.carrera).toBe('naval');
    expect(salida.sesion).toBe(1);
    expect(entra(salida.eventos, ESTADOS.REVELACION)).toHaveLength(1);
  });

  // Al elegir, la mano sigue puesta un rato: el cuadro siguiente vuelve a
  // llamar. Sin esta guarda, un llamado tardio reiniciaria la revelacion y
  // contaria una sesion de mas.
  it('no hace nada fuera de la eleccion', () => {
    const maquina = nueva();

    expect(maquina.elegir('naval', 0).estado).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();

    avanzar(maquina, 0, 6000, true);
    maquina.elegir('naval', 6100);
    expect(maquina.sesion()).toBe(1);

    const tardio = maquina.elegir('civil', 6200);
    expect(tardio.carrera).toBe('naval');
    expect(tardio.sesion).toBe(1);
    expect(tardio.eventos).toEqual([]);
  });

  // Quien no entiende el gesto no puede dejar el espejo tomado hasta el tope de
  // sesion, tres minutos, con la fila esperando. Y como lo ofrecido viene
  // barajado del sorteo, tomar el primero ya es un sorteo: nadie se va sin
  // ingenieria.
  it('al vencerse el tope de la eleccion se revela una igual', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);
    expect(maquina.estado()).toBe(ESTADOS.ELECCION);

    const casi = avanzar(maquina, 6100, 14900, true);
    expect(casi.estado).toBe(ESTADOS.ELECCION);
    expect(casi.carrera).toBeNull();

    const vencido = avanzar(maquina, 15000, 15100, true);
    expect(vencido.estado).toBe(ESTADOS.REVELACION);
    expect(vencido.carrera).toBe(OFRECIDAS[0]);
  });

  it('la eleccion no se termina sola antes del tope', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);

    const salida = avanzar(maquina, 6100, 14000, true);
    expect(salida.estado).toBe(ESTADOS.ELECCION);
    expect(tipos(salida.eventos, 'entra')).toHaveLength(0);
  });

  it('corta a cierre si la persona se va durante la eleccion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);

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
});

describe('la escena y la ausencia', () => {
  /** Deja la maquina en escena, con la carrera elegida a mano. */
  function enEscena(maquina, id = 'naval') {
    avanzar(maquina, 0, 6000, true);
    maquina.elegir(id, 6100);
    avanzar(maquina, 6200, 8200, true);
    return maquina;
  }

  // La escena es de la persona, no del reloj: mientras siga sentada, sigue su
  // escena. Los unicos cortes son que se vaya o el tope de sesion.
  it('la escena no termina sola: sigue mientras la persona siga sentada', () => {
    const maquina = enEscena(nueva());
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    // No alcanza con mirar el estado final: el ciclo entero dura menos de un
    // minuto, asi que podria dar la vuelta y volver a caer en ESCENA. Lo que
    // se exige es que no haya habido ni un solo cambio de estado en el medio.
    const salida = avanzar(maquina, 8300, 60000, true);
    expect(salida.estado).toBe(ESTADOS.ESCENA);
    expect(tipos(salida.eventos, 'entra')).toHaveLength(0);
  });

  it('corta a cierre si el rostro falta mas de lo permitido durante la escena', () => {
    const maquina = enEscena(nueva());
    const salida = avanzar(maquina, 8300, 13700, false);
    expect(salida.estado).toBe(ESTADOS.CIERRE);
  });

  it('aguanta una perdida breve de rostro sin cortar', () => {
    const maquina = enEscena(nueva());
    avanzar(maquina, 8300, 9500, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    avanzar(maquina, 9600, 10000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('una pose permite continuar una escena cuando se gira la cara', () => {
    const maquina = enEscena(nueva());
    const salida = maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 20000 });
    expect(salida.estado).toBe(ESTADOS.ESCENA);
  });

  it('limpia carrera y opciones al volver a atraccion', () => {
    const maquina = enEscena(nueva());
    avanzar(maquina, 8300, 20000, false);
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();
    expect(maquina.opciones()).toEqual([]);
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
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);
    maquina.elegir('naval', 6100);

    // Se va: escena a los 8100, cierre por ausencia a los 11200 y vuelta a
    // atraccion a los 15200, que es donde arranca el enfriamiento.
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

    const salida = avanzar(maquina, 0, 25000, true);
    expect([ESTADOS.CIERRE, ESTADOS.ATRACCION]).toContain(salida.estado);
    expect(entra(salida.eventos, ESTADOS.CIERRE)).toHaveLength(1);
  });

  it('numera las sesiones de forma creciente', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 20000, true);
    expect(maquina.sesion()).toBe(1);

    // La segunda sesion recien se numera cuando vuelve a revelar: el tope de
    // sesion corta a los 75 s, el cierre y el enfriamiento se llevan otros
    // siete, y el ciclo nuevo tarda quince mas en llegar a la revelacion.
    const segunda = avanzar(maquina, 20100, 110000, true);
    expect(segunda.sesion).toBeGreaterThan(1);
  });

  // El ciclo tiene que cerrar sobre si mismo indefinidamente: en una tarde de
  // feria da cientos de vueltas sin que nadie lo toque.
  it('cada revelacion numera una sesion nueva, vuelta tras vuelta', () => {
    const maquina = nueva();
    const todos = [];
    for (let ahora = 0; ahora <= 200000; ahora += 100) {
      todos.push(...maquina.actualizar({ hayRostro: true, ahora }).eventos);
    }

    const revelaciones = entra(todos, ESTADOS.REVELACION);
    expect(revelaciones.length).toBeGreaterThan(2);
    expect(maquina.sesion()).toBe(revelaciones.length);

    // Nunca hay un cierre sin su revelacion. La ventana puede terminar a mitad
    // de ciclo, asi que la ultima revelacion todavia puede no tener el suyo.
    const cierres = entra(todos, ESTADOS.CIERRE).length;
    expect(cierres).toBeLessThanOrEqual(revelaciones.length);
    expect(cierres).toBeGreaterThanOrEqual(revelaciones.length - 1);
  });
});

describe('atajos del stand', () => {
  it('forzarCarrera salta a la revelacion con la carrera pedida', () => {
    const maquina = nueva();
    const salida = maquina.forzarCarrera('quimica', 500);

    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(salida.carrera).toBe('quimica');
    expect(salida.sesion).toBe(1);
  });

  // Sin pisar las opciones, forzar una carrera desde una eleccion en curso
  // revelaria la primera de la lista anterior y no la que se pidio.
  it('forzarCarrera manda incluso desde una eleccion en curso', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);
    expect(maquina.estado()).toBe(ESTADOS.ELECCION);

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
    for (const estado of [ESTADOS.HUMO, ESTADOS.ELECCION, ESTADOS.ESCENA]) {
      const maquina = nueva();
      avanzar(maquina, 0, 2100, true);
      if (estado !== ESTADOS.HUMO) avanzar(maquina, 2200, 6000, true);
      if (estado === ESTADOS.ESCENA) {
        maquina.elegir('naval', 6100);
        avanzar(maquina, 6200, 8200, true);
      }
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
    expect(maquina.avanzar(200).estado).toBe(ESTADOS.ELECCION);
    expect(maquina.avanzar(300).estado).toBe(ESTADOS.REVELACION);
    expect(maquina.avanzar(400).estado).toBe(ESTADOS.ESCENA);
    expect(maquina.avanzar(500).estado).toBe(ESTADOS.CIERRE);
    expect(maquina.avanzar(600).estado).toBe(ESTADOS.ATRACCION);
  });

  it('avanzar sortea y numera la sesion igual que el ciclo automatico', () => {
    const maquina = nueva();
    maquina.avanzar(0);
    maquina.avanzar(100);
    expect(maquina.opciones()).toEqual(OFRECIDAS);
    expect(maquina.sesion()).toBe(0);

    maquina.avanzar(200);
    const revelacion = maquina.avanzar(300);
    expect(revelacion.carrera).toBe(OFRECIDAS[0]);
    expect(revelacion.sesion).toBe(1);
  });

  it('avanzar no respeta el enfriamiento: si aprieto el boton, arranca', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 6000, true);
    maquina.elegir('naval', 6100);
    avanzar(maquina, 6200, 25000, false);
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);

    expect(maquina.avanzar(25100).estado).toBe(ESTADOS.ENGANCHE);
  });
});

describe('modo manual', () => {
  const manual = () =>
    crearMaquina({ tiempos: TIEMPOS, sortearOpciones: () => [...OFRECIDAS], manual: true });

  it('el reloj no cambia el estado', () => {
    const maquina = manual();
    const salida = avanzar(maquina, 0, 90000, true);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.eventos).toEqual([]);
  });

  it('no corta por ausencia de rostro', () => {
    const maquina = manual();
    for (let i = 0; i < 5; i++) maquina.avanzar(i * 100);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    // Se va, y pasa mucho mas que la tolerancia de cinco segundos.
    avanzar(maquina, 600, 60000, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  // En manual la eleccion tampoco se vence sola: es lo que permite dejarla
  // abierta y probar el sostenido con la mano todo el tiempo que haga falta.
  it('la eleccion no se vence sola', () => {
    const maquina = manual();
    maquina.avanzar(0);
    maquina.avanzar(100);
    maquina.avanzar(200);
    expect(maquina.estado()).toBe(ESTADOS.ELECCION);

    avanzar(maquina, 300, 90000, true);
    expect(maquina.estado()).toBe(ESTADOS.ELECCION);
  });

  // Pero elegir con la mano tiene que seguir funcionando: es justamente el gesto
  // que se esta probando.
  it('elegir con la mano sigue andando', () => {
    const maquina = manual();
    maquina.avanzar(0);
    maquina.avanzar(100);
    maquina.avanzar(200);

    const salida = maquina.elegir('forestal', 300);
    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(salida.carrera).toBe('forestal');
  });

  it('la escena no se termina sola, que es para lo que sirve', () => {
    const maquina = manual();
    for (let i = 0; i < 5; i++) maquina.avanzar(i * 100);

    avanzar(maquina, 1000, 300000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
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

describe('crearMaquina (continuacion)', () => {
  it('informa desde cuando esta en el estado actual', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 1500 });
    expect(maquina.desdeCuando()).toBe(1500);
  });
});
