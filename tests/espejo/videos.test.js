import { describe, it, expect, vi } from 'vitest';
import { cargarVideoDelNavegador, crearBancoDeVideos } from '../../espejo/videos.js';

// --- carga del video ---------------------------------------------------------
//
// Los videos son opcionales y el modulo lo promete: si no se pueden reproducir,
// el espejo arranca igual. Eso solo se cumple si la promesa SIEMPRE termina.

const crearVideoFalso = () => ({
  cargas: 0,
  play: () => Promise.resolve(),
  load() {
    this.pedido = true;
    this.cargas += 1;
  },
  removeAttribute(nombre) {
    this.quitado = nombre;
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

  // Soltar la promesa no alcanza: un elemento abandonado con `src` puesto y
  // `preload='auto'` sigue bajando, y el navegador no lo recolecta mientras
  // tenga una carga de medios activa. Con varios videos, las descargas dadas
  // por perdidas competirian todas juntas contra la camara y MediaPipe.
  it('le corta la descarga al video que se dio por perdido', async () => {
    const video = crearVideoFalso();
    const reloj = crearRelojFalso();
    const promesa = cargar(video, reloj, 8000);

    reloj.vencer();
    await expect(promesa).rejects.toThrow();

    expect(video.quitado).toBe('src');
    expect(video.cargas).toBe(2); // la que lo pidio, y la que lo suelta
  });

  it('tambien le corta la descarga al que no se pudo cargar', async () => {
    const video = crearVideoFalso();
    const promesa = cargar(video, crearRelojFalso());

    video.onerror();
    await expect(promesa).rejects.toThrow();

    expect(video.quitado).toBe('src');
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
  // rechazada: main.js siguio sin ese video y nadie esta esperando este.
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

// --- el banco de fondos con movimiento ---------------------------------------

// Un <video> de mentira que lleva la cuenta de lo que le pidieron. `readyState`
// arranca en 4 (HAVE_ENOUGH_DATA), que es como vuelve del cargador.
const videoDe = (ruta, readyState = 4) => ({
  ruta,
  readyState,
  currentTime: 7,
  sonando: false,
  play() {
    this.sonando = true;
    return Promise.resolve();
  },
  pause() {
    this.sonando = false;
  },
});

const bancoCon = (videos, opciones = {}) =>
  crearBancoDeVideos({
    cargar: async (ruta) => {
      const video = videos[ruta];
      if (!video) throw new Error(`404 ${ruta}`);
      return video;
    },
    ...opciones,
  });

describe('crearBancoDeVideos', () => {
  it('carga y devuelve lo que pidieron', async () => {
    const uno = videoDe('uno');
    const banco = bancoCon({ 'a.mp4': uno });
    await banco.precargar(['a.mp4']);

    expect(banco.obtener('a.mp4')).toBe(uno);
  });

  it('devuelve null en vez de romperse cuando un archivo no esta', async () => {
    const banco = bancoCon({ 'hay.mp4': videoDe('hay') });
    const informe = await banco.precargar(['hay.mp4', 'falta.mp4']);

    expect(banco.obtener('falta.mp4')).toBeNull();
    expect(informe).toEqual({ total: 2, faltantes: ['falta.mp4'] });
    expect(banco.faltantes()).toEqual(['falta.mp4']);
  });

  it('devuelve null para algo que nunca se pidio', () => {
    expect(bancoCon({}).obtener('nada.mp4')).toBeNull();
  });

  it('no carga dos veces la misma ruta', async () => {
    const cargar = vi.fn(async (ruta) => videoDe(ruta));
    const banco = crearBancoDeVideos({ cargar });
    await banco.precargar(['a.mp4', 'a.mp4']);
    await banco.precargar(['a.mp4']);

    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('antepone la raiz al pedir el archivo pero guarda la ruta original como clave', async () => {
    const pedidas = [];
    const banco = crearBancoDeVideos({
      cargar: async (ruta) => {
        pedidas.push(ruta);
        return videoDe(ruta);
      },
      raiz: '/contenido/',
    });
    await banco.precargar(['assets/fondos/naval-canal.mp4']);

    expect(pedidas).toEqual(['/contenido/assets/fondos/naval-canal.mp4']);
    expect(banco.obtener('assets/fondos/naval-canal.mp4')).not.toBeNull();
  });

  // De a uno, no todos juntos: doce descargas simultaneas compiten con la camara
  // y con MediaPipe justo mientras el espejo esta arrancando.
  it('los carga de a uno', async () => {
    let simultaneas = 0;
    let pico = 0;
    const banco = crearBancoDeVideos({
      cargar: async (ruta) => {
        simultaneas += 1;
        pico = Math.max(pico, simultaneas);
        await Promise.resolve();
        simultaneas -= 1;
        return videoDe(ruta);
      },
    });
    await banco.precargar(['a.mp4', 'b.mp4', 'c.mp4']);

    expect(pico).toBe(1);
  });

  // Un video a medio decodificar se dibuja como nada: drawImage no falla, no
  // avisa y deja el fondo vacio. Devolviendo null, el espejo cae a la foto.
  it('no entrega un video que todavia no tiene un cuadro', async () => {
    const banco = bancoCon({ 'a.mp4': videoDe('a', 0) });
    await banco.precargar(['a.mp4']);

    expect(banco.obtener('a.mp4')).toBeNull();
  });

  it('cargado no es lo mismo que sonando: los deja en pausa', async () => {
    const a = videoDe('a');
    const b = videoDe('b');
    await bancoCon({ 'a.mp4': a, 'b.mp4': b }).precargar(['a.mp4', 'b.mp4']);

    expect(a.sonando).toBe(false);
    expect(b.sonando).toBe(false);
  });

  it('precargar sin rutas no se rompe', async () => {
    expect(await bancoCon({}).precargar([])).toEqual({ total: 0, faltantes: [] });
  });
});

describe('crearBancoDeVideos: cual suena', () => {
  const armar = async () => {
    const a = videoDe('a');
    const b = videoDe('b');
    const banco = bancoCon({ 'a.mp4': a, 'b.mp4': b });
    await banco.precargar(['a.mp4', 'b.mp4']);
    return { banco, a, b };
  };

  it('suena el que se muestra', async () => {
    const { banco, a } = await armar();
    banco.mostrar('a.mp4');

    expect(a.sonando).toBe(true);
    expect(banco.sonando()).toBe('a.mp4');
  });

  // DOCE VIDEOS DECODIFICANDO A LA VEZ NO LOS AGUANTA NINGUNA PLACA, y once de
  // ellos no se ven. Agarrar otro objeto tiene que apagar el anterior.
  it('solo suena uno: mostrar otro pausa al que estaba', async () => {
    const { banco, a, b } = await armar();
    banco.mostrar('a.mp4');
    banco.mostrar('b.mp4');

    expect(a.sonando).toBe(false);
    expect(b.sonando).toBe(true);
  });

  // Se llama en CADA CUADRO con la misma ruta mientras la mano no se mueve. Sin
  // esta guarda, el video volveria al principio sesenta veces por segundo.
  it('repetir el que ya suena no lo reinicia', async () => {
    const { banco, a } = await armar();
    banco.mostrar('a.mp4');
    a.currentTime = 3.5;
    banco.mostrar('a.mp4');

    expect(a.currentTime).toBe(3.5);
  });

  // Volver a una ingenieria ya vista la muestra desde el principio: el fondo
  // entra de nuevo, y el video con el.
  it('volver a un fondo lo arranca desde el principio', async () => {
    const { banco, a } = await armar();
    banco.mostrar('a.mp4');
    a.currentTime = 3.5;
    banco.mostrar('b.mp4');
    banco.mostrar('a.mp4');

    expect(a.currentTime).toBe(0);
    expect(a.sonando).toBe(true);
  });

  it('sin fondo a la vista no suena ninguno', async () => {
    const { banco, a } = await armar();
    banco.mostrar('a.mp4');
    banco.mostrar(null);

    expect(a.sonando).toBe(false);
    expect(banco.sonando()).toBeNull();
  });

  // Una carrera cuyo video no cargo no puede dejar sonando el de la anterior
  // detras de su propia foto.
  it('mostrar un video que no cargo apaga al que estaba', async () => {
    const { banco, a } = await armar();
    banco.mostrar('a.mp4');
    banco.mostrar('nunca-cargo.mp4');

    expect(a.sonando).toBe(false);
    expect(banco.sonando()).toBeNull();
  });

  // Sin fondo a la vista, main.js llama mostrar(null) en CADA cuadro, que es la
  // mayor parte de la sesion. La guarda tiene que valer tambien para ese caso.
  it('repetir "ninguno" tampoco hace nada', async () => {
    const { banco, a } = await armar();
    banco.mostrar(null);
    banco.mostrar('a.mp4');
    a.pause = () => {
      throw new Error('no deberia volver a pausar');
    };
    banco.mostrar('a.mp4');

    expect(banco.sonando()).toBe('a.mp4');
  });

  it('detener apaga el que suena', async () => {
    const { banco, a } = await armar();
    banco.mostrar('a.mp4');
    banco.detener();

    expect(a.sonando).toBe(false);
  });
});
