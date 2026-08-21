import { describe, it, expect } from 'vitest';
import { alfaDeHumo, cargarVideoDelNavegador } from '../../espejo/humo.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { enganche: 2000, humo: 3000, revelacion: 2500, cierre: 3000 };
const HUMO = { fraccionDeEntrada: 0.55, msDeSalida: 1400 };

const alfa = (estado, transcurrido) =>
  alfaDeHumo({ estado, transcurrido, tiempos: TIEMPOS, humo: HUMO });

describe('alfaDeHumo', () => {
  it('en reposo y en el enganche no hay humo', () => {
    expect(alfa(ESTADOS.ATRACCION, 0)).toBe(0);
    expect(alfa(ESTADOS.ATRACCION, 9000)).toBe(0);
    expect(alfa(ESTADOS.ENGANCHE, 1000)).toBe(0);
  });

  it('se espesa durante el humo hasta tapar todo', () => {
    expect(alfa(ESTADOS.HUMO, 0)).toBe(0);
    expect(alfa(ESTADOS.HUMO, 800)).toBeGreaterThan(0);
    expect(alfa(ESTADOS.HUMO, 800)).toBeLessThan(1);
    expect(alfa(ESTADOS.HUMO, 1650)).toBe(1);
  });

  it('crece siempre, sin volver atras', () => {
    let anterior = -1;
    for (let t = 0; t <= TIEMPOS.humo; t += 50) {
      const actual = alfa(ESTADOS.HUMO, t);
      expect(actual).toBeGreaterThanOrEqual(anterior);
      anterior = actual;
    }
  });

  // El humo tiene que estar espeso cuando cambia el estado: si bajara antes, se
  // veria a los objetos aparecer de la nada, que es justo lo que viene a tapar.
  it('llega tapando al final del estado', () => {
    expect(alfa(ESTADOS.HUMO, TIEMPOS.humo)).toBe(1);
  });

  it('arranca la eleccion tapando y se disipa dejando los objetos', () => {
    expect(alfa(ESTADOS.ELECCION, 0)).toBe(1);
    expect(alfa(ESTADOS.ELECCION, 700)).toBeLessThan(1);
    expect(alfa(ESTADOS.ELECCION, 700)).toBeGreaterThan(0);
    expect(alfa(ESTADOS.ELECCION, HUMO.msDeSalida)).toBe(0);
  });

  it('no vuelve a aparecer mientras dura la eleccion', () => {
    expect(alfa(ESTADOS.ELECCION, 20000)).toBe(0);
  });

  it('no hay humo en la revelacion, la escena ni el cierre', () => {
    expect(alfa(ESTADOS.REVELACION, 0)).toBe(0);
    expect(alfa(ESTADOS.REVELACION, 1200)).toBe(0);
    expect(alfa(ESTADOS.ESCENA, 5000)).toBe(0);
    expect(alfa(ESTADOS.CIERRE, 1000)).toBe(0);
  });

  it('nunca se sale del rango, ni con tiempos raros', () => {
    for (const estado of Object.values(ESTADOS)) {
      for (const t of [-5000, -1, 0, 1, 999999]) {
        const valor = alfa(estado, t);
        expect(valor).toBeGreaterThanOrEqual(0);
        expect(valor).toBeLessThanOrEqual(1);
      }
    }
  });
});

// --- carga del video ---------------------------------------------------------
//
// El humo es opcional y el modulo lo promete: si no se puede reproducir, el
// espejo arranca igual. Eso solo se cumple si la promesa SIEMPRE termina.

const crearVideoFalso = () => ({
  play: () => Promise.resolve(),
  load() {
    this.pedido = true;
  },
});

// Reloj de mentira: guarda lo agendado en vez de esperarlo de verdad.
const crearRelojFalso = () => {
  const agendado = [];
  return {
    programar: (fn, ms) => {
      agendado.push({ fn, ms });
      return agendado.length - 1;
    },
    cancelar: (id) => {
      if (agendado[id]) agendado[id].cancelado = true;
    },
    vencer: () => agendado.filter((a) => !a.cancelado).forEach((a) => a.fn()),
    pendientes: () => agendado.filter((a) => !a.cancelado).length,
    demora: () => agendado[0]?.ms,
  };
};

const cargar = (video, reloj, msMaximos = 8000) =>
  cargarVideoDelNavegador('/humo.mp4', {
    crearVideo: () => video,
    programar: reloj.programar,
    cancelar: reloj.cancelar,
    msMaximos,
  });

describe('cargarVideoDelNavegador', () => {
  it('entrega el video cuando el navegador dice que puede reproducirlo', async () => {
    const video = crearVideoFalso();
    const reloj = crearRelojFalso();
    const promesa = cargar(video, reloj);

    expect(video.pedido).toBe(true);
    video.oncanplaythrough();

    await expect(promesa).resolves.toBe(video);
  });

  it('falla cuando el video no se puede cargar', async () => {
    const video = crearVideoFalso();
    const reloj = crearRelojFalso();
    const promesa = cargar(video, reloj);

    video.onerror();

    await expect(promesa).rejects.toThrow(/No se pudo cargar/);
  });

  // La falla que dejaba el espejo en "cargando..." para siempre: con la ventana
  // tapada, Chrome posterga la descarga del video y no dispara ni
  // `canplaythrough` ni `error`. Sin tope, el await de main.js no vuelve nunca y
  // no se llega a crear ni la camara ni MediaPipe.
  it('se rinde cuando el navegador no contesta ni que si ni que no', async () => {
    const video = crearVideoFalso();
    const reloj = crearRelojFalso();
    const promesa = cargar(video, reloj, 8000);

    expect(reloj.demora()).toBe(8000);
    reloj.vencer();

    await expect(promesa).rejects.toThrow(/tardo demasiado/i);
  });

  it('no deja el tope andando cuando el video carga a tiempo', async () => {
    const video = crearVideoFalso();
    const reloj = crearRelojFalso();
    const promesa = cargar(video, reloj);

    video.oncanplaythrough();
    await promesa;

    expect(reloj.pendientes()).toBe(0);
  });

  // Un canplaythrough que llega despues del tope no puede revivir la promesa ya
  // rechazada: main.js siguio sin humo y nadie esta esperando este video.
  it('ignora al video que aparece tarde', async () => {
    const video = crearVideoFalso();
    const reloj = crearRelojFalso();
    const promesa = cargar(video, reloj, 8000);

    reloj.vencer();
    await expect(promesa).rejects.toThrow();

    expect(() => video.oncanplaythrough?.()).not.toThrow();
    await expect(promesa).rejects.toThrow(/tardo demasiado/i);
  });
});
