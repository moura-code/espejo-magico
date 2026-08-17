import { describe, it, expect } from 'vitest';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

// La escena no tiene duracion propia: dura mientras la persona siga sentada,
// con sesionMaxima como unico tope.
const TIEMPOS = {
  enganche: 2000,
  sorteo: 3000,
  revelacion: 2000,
  cierre: 4000,
  enfriamiento: 3000,
  ausenciaParaCortar: 5000,
  sesionMaxima: 75000,
};

function nueva(carreras = ['civil', 'quimica']) {
  let i = 0;
  return crearMaquina({ tiempos: TIEMPOS, sortear: () => carreras[i++ % carreras.length] });
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

describe('crearMaquina', () => {
  it('arranca en atraccion sin carrera', () => {
    const maquina = nueva();
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();
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

  it('recorre el ciclo completo: la persona entra, vive su escena y se va', () => {
    const maquina = nueva();

    const conPersona = avanzar(maquina, 0, 10000, true);
    const sinPersona = avanzar(maquina, 10100, 20000, false);

    const vistos = [...conPersona.eventos, ...sinPersona.eventos]
      .filter((e) => e.tipo === 'entra')
      .map((e) => e.estado);

    expect(vistos).toEqual([
      ESTADOS.ENGANCHE,
      ESTADOS.SORTEO,
      ESTADOS.REVELACION,
      ESTADOS.ESCENA,
      ESTADOS.CIERRE,
      ESTADOS.ATRACCION,
    ]);
  });

  // La carrera se elige tres segundos antes de que se vea: en SORTEO la niebla
  // sigue cerrada y recien se abre en REVELACION. Ese margen le da tiempo al
  // espejo a tener listos los PNG.
  it('elige la carrera al entrar en sorteo y la conserva hasta la revelacion', () => {
    const maquina = nueva(['civil']);

    avanzar(maquina, 0, 2100, true);
    expect(maquina.estado()).toBe(ESTADOS.SORTEO);
    expect(maquina.carrera()).toBe('civil');

    const hastaRevelacion = avanzar(maquina, 2200, 5200, true);
    expect(hastaRevelacion.estado).toBe(ESTADOS.REVELACION);
    expect(hastaRevelacion.carrera).toBe('civil');
  });

  // La escena es de la persona, no del reloj: mientras siga sentada, sigue su
  // escena (feedback de la primera prueba). Los unicos cortes son que se vaya
  // o el tope de sesion, que queda como red de seguridad del stand.
  it('la escena no termina sola: sigue mientras la persona siga sentada', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    // No alcanza con mirar el estado final: el ciclo entero dura menos de un
    // minuto, asi que podria dar la vuelta y volver a caer en ESCENA. Lo que
    // se exige es que no haya habido ni un solo cambio de estado en el medio.
    const salida = avanzar(maquina, 8100, 60000, true);
    expect(salida.estado).toBe(ESTADOS.ESCENA);
    expect(tipos(salida.eventos, 'entra')).toHaveLength(0);
  });

  it('corta a cierre si el rostro falta mas de lo permitido durante la escena', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    const salida = avanzar(maquina, 8100, 13500, false);
    expect(salida.estado).toBe(ESTADOS.CIERRE);
  });

  it('aguanta una perdida breve de rostro sin cortar', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    avanzar(maquina, 8100, 9500, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    avanzar(maquina, 9600, 10000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('el enganche espera cinco segundos antes de volver al reposo', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });

    const breve = maquina.actualizar({ hayRostro: false, ahora: 100 });
    expect(breve.estado).toBe(ESTADOS.ENGANCHE);

    const salida = maquina.actualizar({ hayRostro: false, ahora: 5100 });

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.carrera).toBeNull();
  });

  // `desde` es el reloj del estado y ademas alimenta la transicion visual de la
  // escena via desdeCuando(). Medir el rostro continuo pisandolo hacia que el
  // efecto volviera a alfa cero de golpe en cada parpadeo del detector.
  it('el reloj del estado no se reinicia cuando parpadea la deteccion', () => {
    const maquina = nueva();
    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 0 });
    expect(maquina.desdeCuando()).toBe(0);

    maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 500 });
    expect(maquina.desdeCuando()).toBe(0);

    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 900 });
    expect(maquina.desdeCuando()).toBe(0);
  });

  it('exige dos segundos continuos de rostro durante el enganche', () => {
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
    ).toBe(ESTADOS.SORTEO);
  });

  it('una pose permite continuar una escena cuando se gira la cara', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    const salida = maquina.actualizar({ puedeIniciar: false, hayPersona: true, ahora: 20000 });
    expect(salida.estado).toBe(ESTADOS.ESCENA);
  });

  it('no arranca el sorteo si la persona se fue durante el enganche', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });
    const salida = avanzar(maquina, 100, 5500, false);

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.carrera).toBeNull();
    expect(maquina.sesion()).toBe(0);
  });

  it('no arranca otra sesion durante el enfriamiento', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    // Se va: cierre por ausencia (13100) y vuelta a atraccion (17100).
    const finDelCiclo = avanzar(maquina, 8100, 17500, false);
    expect(finDelCiclo.estado).toBe(ESTADOS.ATRACCION);

    // Vuelve enseguida: el enfriamiento todavia lo frena.
    const enFrio = avanzar(maquina, 17600, 19500, true);
    expect(enFrio.estado).toBe(ESTADOS.ATRACCION);

    const yaCaliente = maquina.actualizar({ hayRostro: true, ahora: 21100 });
    expect(yaCaliente.estado).toBe(ESTADOS.ENGANCHE);
  });

  it('numera las sesiones de forma creciente', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 42000, true);
    expect(maquina.sesion()).toBe(1);

    const segunda = avanzar(maquina, 48000, 90000, true);
    expect(segunda.sesion).toBe(2);
  });

  it('corta por tope de sesion aunque la persona siga ahi', () => {
    const tiemposCortos = { ...TIEMPOS, sesionMaxima: 20000 };
    const maquina = crearMaquina({ tiempos: tiemposCortos, sortear: () => 'civil' });

    const salida = avanzar(maquina, 0, 25000, true);
    expect([ESTADOS.CIERRE, ESTADOS.ATRACCION]).toContain(salida.estado);
    expect(salida.eventos.filter((e) => e.tipo === 'entra' && e.estado === ESTADOS.CIERRE))
      .toHaveLength(1);
  });

  // Un rostro que aparece y desaparece nunca junta los dos segundos continuos que
  // pide el enganche, y la presencia impide que la ausencia lo corte. Sin un tope
  // el espejo se queda destapado y quieto, fuera de la red de seguridad del stand.
  it('el enganche vuelve al reposo al llegar al tope de sesion', () => {
    const tiemposCortos = { ...TIEMPOS, sesionMaxima: 20000 };
    const maquina = crearMaquina({ tiempos: tiemposCortos, sortear: () => 'civil' });

    maquina.actualizar({ puedeIniciar: true, hayPersona: true, ahora: 0 });
    expect(maquina.estado()).toBe(ESTADOS.ENGANCHE);

    const eventos = [];
    for (let ahora = 100; ahora <= 25000; ahora += 100) {
      // Un segundo con rostro y uno sin: nunca dos seguidos, nunca cinco sin.
      const puedeIniciar = ahora % 2000 < 1000;
      eventos.push(...maquina.actualizar({ puedeIniciar, hayPersona: true, ahora }).eventos);
    }

    const vueltas = eventos.filter((e) => e.tipo === 'entra' && e.estado === ESTADOS.ATRACCION);
    expect(vueltas).toHaveLength(1);
    // Nunca llego a sortear: el enganche se corto antes.
    expect(maquina.sesion()).toBe(0);
  });

  it('forzarCarrera salta a la revelacion con la carrera pedida', () => {
    const maquina = nueva();
    const salida = maquina.forzarCarrera('quimica', 500);

    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(salida.carrera).toBe('quimica');
    expect(salida.sesion).toBe(1);
  });

  it('reiniciar vuelve a atraccion y deja lista otra sesion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);

    const salida = maquina.reiniciar(8100);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.carrera).toBeNull();

    expect(maquina.actualizar({ hayRostro: true, ahora: 8200 }).estado).toBe(ESTADOS.ENGANCHE);
  });

  it('reiniciar corta la sesion desde cualquier estado', () => {
    const desdeEscena = nueva();
    avanzar(desdeEscena, 0, 8000, true);
    expect(desdeEscena.estado()).toBe(ESTADOS.ESCENA);

    const desdeCierre = nueva();
    avanzar(desdeCierre, 0, 8000, true);
    avanzar(desdeCierre, 8100, 13500, false);
    expect(desdeCierre.estado()).toBe(ESTADOS.CIERRE);

    for (const [maquina, ahora] of [
      [desdeEscena, 8100],
      [desdeCierre, 13600],
    ]) {
      const salida = maquina.reiniciar(ahora);
      expect(salida.estado).toBe(ESTADOS.ATRACCION);
      expect(salida.eventos).toEqual([{ tipo: 'entra', estado: ESTADOS.ATRACCION }]);
    }
  });

  it('limpia la carrera al volver a atraccion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    avanzar(maquina, 8100, 17500, false);
    expect(maquina.carrera()).toBeNull();
  });

  it('avanzar saltea la espera y pasa al estado siguiente', () => {
    const maquina = nueva();
    expect(maquina.avanzar(0).estado).toBe(ESTADOS.ENGANCHE);
    expect(maquina.avanzar(100).estado).toBe(ESTADOS.SORTEO);
    expect(maquina.avanzar(200).estado).toBe(ESTADOS.REVELACION);
    expect(maquina.avanzar(300).estado).toBe(ESTADOS.ESCENA);
    expect(maquina.avanzar(400).estado).toBe(ESTADOS.CIERRE);
    expect(maquina.avanzar(500).estado).toBe(ESTADOS.ATRACCION);
  });

  it('avanzar elige la carrera y numera la sesion igual que el ciclo automatico', () => {
    const maquina = nueva(['civil']);
    maquina.avanzar(0);
    maquina.avanzar(100);
    expect(maquina.carrera()).toBe('civil');
    expect(maquina.sesion()).toBe(0);

    const revelacion = maquina.avanzar(200);
    expect(revelacion.carrera).toBe('civil');
    expect(revelacion.sesion).toBe(1);
  });

  it('avanzar no respeta el enfriamiento: si aprieto el boton, arranca', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    avanzar(maquina, 8100, 17500, false);
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);

    // 17600 esta en pleno enfriamiento (hasta 20100): el boton manda igual.
    expect(maquina.avanzar(17600).estado).toBe(ESTADOS.ENGANCHE);
  });
});

describe('modo manual', () => {
  it('el reloj no cambia el estado', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });

    const salida = avanzar(maquina, 0, 90000, true);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(salida.eventos).toEqual([]);
  });

  it('no corta por ausencia de rostro', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });
    maquina.avanzar(0);
    maquina.avanzar(100);
    maquina.avanzar(200);
    maquina.avanzar(300);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    // Se va, y pasa mucho mas que la tolerancia de cinco segundos.
    avanzar(maquina, 400, 60000, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('la escena no se termina sola, que es para lo que sirve', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });
    for (let i = 0; i < 4; i++) maquina.avanzar(i * 100);

    avanzar(maquina, 1000, 300000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('se puede volver a automatico y el reloj manda de nuevo', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });
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

  // El ciclo tiene que cerrar sobre si mismo indefinidamente: en una tarde de
  // feria da cientos de vueltas sin que nadie lo toque.
  it('cada revelacion numera una sesion nueva, vuelta tras vuelta', () => {
    const maquina = nueva();
    const todos = [];
    let ahora = 0;
    while (ahora <= 200000) {
      todos.push(...maquina.actualizar({ hayRostro: true, ahora }).eventos);
      ahora += 100;
    }

    const entra = (estado) => todos.filter((e) => e.tipo === 'entra' && e.estado === estado);
    const revelaciones = entra(ESTADOS.REVELACION);

    expect(revelaciones.length).toBeGreaterThan(2);
    expect(maquina.sesion()).toBe(revelaciones.length);

    // Nunca hay un cierre sin su revelacion. La ventana puede terminar a mitad
    // de ciclo, asi que la ultima revelacion todavia puede no tener el suyo.
    const cierres = entra(ESTADOS.CIERRE).length;
    expect(cierres).toBeLessThanOrEqual(revelaciones.length);
    expect(cierres).toBeGreaterThanOrEqual(revelaciones.length - 1);
  });
});
