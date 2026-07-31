import { describe, it, expect } from 'vitest';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = {
  enganche: 2000,
  sorteo: 3000,
  revelacion: 2000,
  escena: 20000,
  reflexion: 10000,
  cierre: 4000,
  enfriamiento: 3000,
  ausenciaParaCortar: 3000,
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

  it('recorre el ciclo completo con alguien sentado', () => {
    const maquina = nueva();
    const vistos = [];

    let ahora = 0;
    while (ahora <= 45000) {
      const salida = maquina.actualizar({ hayRostro: true, ahora });
      for (const evento of salida.eventos) {
        if (evento.tipo === 'entra') vistos.push(evento.estado);
      }
      ahora += 100;
    }

    expect(vistos.slice(0, 7)).toEqual([
      ESTADOS.ENGANCHE,
      ESTADOS.SORTEO,
      ESTADOS.REVELACION,
      ESTADOS.ESCENA,
      ESTADOS.REFLEXION,
      ESTADOS.CIERRE,
      ESTADOS.ATRACCION,
    ]);
  });

  it('elige la carrera al entrar en sorteo, antes de anunciarla', () => {
    const maquina = nueva(['civil']);
    avanzar(maquina, 0, 2100, true);
    expect(maquina.estado()).toBe(ESTADOS.SORTEO);
    expect(maquina.carrera()).toBe('civil');
  });

  it('recien emite el mensaje de carrera al entrar en revelacion', () => {
    const maquina = nueva(['civil']);

    const hastaSorteo = avanzar(maquina, 0, 2100, true);
    expect(tipos(hastaSorteo.eventos, 'carrera')).toHaveLength(0);

    const hastaRevelacion = avanzar(maquina, 2200, 5200, true);
    expect(tipos(hastaRevelacion.eventos, 'carrera')).toEqual([
      { tipo: 'carrera', id: 'civil', sesion: 1 },
    ]);
  });

  it('emite reposo al entrar en cierre', () => {
    const maquina = nueva();
    const salida = avanzar(maquina, 0, 40000, true);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);
  });

  it('corta a cierre si el rostro falta mas de lo permitido durante la escena', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    const salida = avanzar(maquina, 8100, 11500, false);
    expect(salida.estado).toBe(ESTADOS.CIERRE);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);
  });

  it('aguanta una perdida breve de rostro sin cortar', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    avanzar(maquina, 8100, 9500, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    avanzar(maquina, 9600, 10000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('abre una reflexion de diez segundos despues de la escena', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 26900, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    avanzar(maquina, 27000, 27000, true);
    expect(maquina.estado()).toBe(ESTADOS.REFLEXION);

    avanzar(maquina, 27100, 36900, true);
    expect(maquina.estado()).toBe(ESTADOS.REFLEXION);
    expect(maquina.actualizar({ hayRostro: true, ahora: 37000 }).estado).toBe(ESTADOS.CIERRE);
  });

  it('el enganche aborta apenas se pierde el rostro, sin esperar la tolerancia', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });

    const salida = maquina.actualizar({ hayRostro: false, ahora: 100 });

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(0);
    expect(tipos(salida.eventos, 'carrera')).toHaveLength(0);
  });

  it('no arranca el sorteo si la persona se fue durante el enganche', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });
    const salida = avanzar(maquina, 100, 3500, false);

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(tipos(salida.eventos, 'carrera')).toHaveLength(0);
  });

  it('no arranca otra sesion durante el enfriamiento', () => {
    const maquina = nueva();
    const finDelCiclo = avanzar(maquina, 0, 42000, true);
    expect(finDelCiclo.estado).toBe(ESTADOS.ATRACCION);

    const enFrio = avanzar(maquina, finDelCiclo.ahora + 100, finDelCiclo.ahora + 1000, true);
    expect(enFrio.estado).toBe(ESTADOS.ATRACCION);

    const yaCaliente = maquina.actualizar({ hayRostro: true, ahora: finDelCiclo.ahora + 5000 });
    expect(yaCaliente.estado).toBe(ESTADOS.ENGANCHE);
  });

  it('numera las sesiones de forma creciente', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 42000, true);
    const segunda = avanzar(maquina, 48000, 90000, true);
    const anuncios = tipos(segunda.eventos, 'carrera');

    expect(anuncios).toHaveLength(1);
    expect(anuncios[0].sesion).toBe(2);
  });

  it('corta por tope de sesion aunque la persona siga ahi', () => {
    const tiemposLargos = { ...TIEMPOS, escena: 600000, sesionMaxima: 20000 };
    const maquina = crearMaquina({ tiempos: tiemposLargos, sortear: () => 'civil' });

    const salida = avanzar(maquina, 0, 25000, true);
    expect([ESTADOS.CIERRE, ESTADOS.ATRACCION]).toContain(salida.estado);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);
  });

  it('forzarCarrera salta a la revelacion con la carrera pedida', () => {
    const maquina = nueva();
    const salida = maquina.forzarCarrera('quimica', 500);

    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(salida.carrera).toBe('quimica');
    expect(tipos(salida.eventos, 'carrera')).toEqual([
      { tipo: 'carrera', id: 'quimica', sesion: 1 },
    ]);
  });

  it('reiniciar vuelve a atraccion, emite reposo y deja lista otra sesion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);

    const salida = maquina.reiniciar(8100);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);

    expect(maquina.actualizar({ hayRostro: true, ahora: 8200 }).estado).toBe(ESTADOS.ENGANCHE);
  });

  it('limpia la carrera al volver a atraccion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 42000, true);
    expect(maquina.carrera()).toBeNull();
  });

  it('avanzar saltea la espera y pasa al estado siguiente', () => {
    const maquina = nueva();
    expect(maquina.avanzar(0).estado).toBe(ESTADOS.ENGANCHE);
    expect(maquina.avanzar(100).estado).toBe(ESTADOS.SORTEO);
    expect(maquina.avanzar(200).estado).toBe(ESTADOS.REVELACION);
    expect(maquina.avanzar(300).estado).toBe(ESTADOS.ESCENA);
    expect(maquina.avanzar(400).estado).toBe(ESTADOS.REFLEXION);
    expect(maquina.avanzar(500).estado).toBe(ESTADOS.CIERRE);
    expect(maquina.avanzar(600).estado).toBe(ESTADOS.ATRACCION);
  });

  it('avanzar elige la carrera y emite los mismos eventos que el ciclo automatico', () => {
    const maquina = nueva(['civil']);
    maquina.avanzar(0);
    maquina.avanzar(100);
    expect(maquina.carrera()).toBe('civil');

    const revelacion = maquina.avanzar(200);
    expect(tipos(revelacion.eventos, 'carrera')).toEqual([
      { tipo: 'carrera', id: 'civil', sesion: 1 },
    ]);

    maquina.avanzar(300);
    maquina.avanzar(400);
    expect(tipos(maquina.avanzar(500).eventos, 'reposo')).toHaveLength(1);
  });

  it('avanzar no respeta el enfriamiento: si aprieto el boton, arranca', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 42000, true);
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);

    expect(maquina.avanzar(42100).estado).toBe(ESTADOS.ENGANCHE);
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

    // Se va, y pasa mucho mas que la tolerancia de tres segundos.
    avanzar(maquina, 400, 60000, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('el sorteo avanza solo al cumplirse su duracion', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });
    maquina.avanzar(0);
    maquina.avanzar(100);

    expect(maquina.actualizar({ hayRostro: true, ahora: 3099 }).estado).toBe(ESTADOS.SORTEO);
    const salida = maquina.actualizar({ hayRostro: true, ahora: 3100 });

    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(tipos(salida.eventos, 'carrera')).toEqual([
      { tipo: 'carrera', id: 'civil', sesion: 1 },
    ]);
  });

  it('la escena no se termina sola, que es para lo que sirve', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });
    for (let indice = 0; indice < 4; indice++) maquina.avanzar(indice * 100);

    avanzar(maquina, 1000, 300000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('se puede volver a automatico y el reloj manda de nuevo', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });
    expect(maquina.esManual()).toBe(true);

    expect(maquina.alternarManual()).toBe(false);
    expect(maquina.actualizar({ hayRostro: true, ahora: 0 }).estado).toBe(ESTADOS.ENGANCHE);
  });

  it('permite fijar el modo de avance sin depender de su valor anterior', () => {
    const maquina = crearMaquina({ tiempos: TIEMPOS, sortear: () => 'civil', manual: true });

    expect(maquina.establecerManual(false)).toBe(false);
    expect(maquina.establecerManual(false)).toBe(false);
    expect(maquina.esManual()).toBe(false);
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

  it('cada revelacion emite exactamente un anuncio y cada cierre un reposo', () => {
    const maquina = nueva();
    const todos = [];
    let ahora = 0;
    while (ahora <= 200000) {
      todos.push(...maquina.actualizar({ hayRostro: true, ahora }).eventos);
      ahora += 100;
    }

    const revelaciones = todos.filter((e) => e.tipo === 'entra' && e.estado === ESTADOS.REVELACION);
    const cierres = todos.filter((e) => e.tipo === 'entra' && e.estado === ESTADOS.CIERRE);

    expect(tipos(todos, 'carrera')).toHaveLength(revelaciones.length);
    expect(tipos(todos, 'reposo')).toHaveLength(cierres.length);
    expect(revelaciones.length).toBeGreaterThan(2);
  });
});
