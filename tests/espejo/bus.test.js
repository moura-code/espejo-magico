import { describe, it, expect } from 'vitest';
import { crearBus } from '../../espejo/bus.js';

class SocketFalso {
  static creados = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.enviados = [];
    SocketFalso.creados.push(this);
  }
  send(texto) {
    this.enviados.push(texto);
  }
  close() {
    this.readyState = 3;
    this.onclose?.();
  }
  abrir() {
    this.readyState = 1;
    this.onopen?.();
  }
  recibir(texto) {
    this.onmessage?.({ data: texto });
  }
}

function preparar(opciones = {}) {
  SocketFalso.creados = [];
  const recibidos = [];
  const estados = [];
  const programados = [];
  const cancelados = [];

  const bus = crearBus({
    url: 'ws://prueba',
    reconexionMs: 2000,
    alMensaje: (m) => recibidos.push(m),
    alEstado: (e) => estados.push(e),
    CrearSocket: SocketFalso,
    programar: (fn) => {
      programados.push(fn);
      return programados.length;
    },
    cancelar: (id) => cancelados.push(id),
    ...opciones,
  });

  return { bus, recibidos, estados, programados, cancelados, socket: () => SocketFalso.creados.at(-1) };
}

describe('crearBus', () => {
  it('se conecta a la url apenas se crea', () => {
    const { socket } = preparar();
    expect(socket().url).toBe('ws://prueba');
  });

  it('manda el mensaje como JSON cuando esta abierto', () => {
    const { bus, socket } = preparar();
    socket().abrir();
    expect(bus.enviar({ tipo: 'reposo' })).toBe(true);
    expect(socket().enviados).toEqual(['{"tipo":"reposo"}']);
  });

  it('se identifica antes de avisar que esta conectado', () => {
    const identidad = { tipo: 'hola', rol: 'tablet', slot: 2 };
    const { socket } = preparar({ identidad });
    socket().abrir();
    expect(socket().enviados).toEqual([JSON.stringify(identidad)]);
  });

  it('no manda nada y avisa que no pudo si esta cerrado', () => {
    const { bus, socket } = preparar();
    expect(bus.enviar({ tipo: 'reposo' })).toBe(false);
    expect(socket().enviados).toEqual([]);
  });

  it('entrega los mensajes validos que le llegan', () => {
    const { recibidos, socket } = preparar();
    socket().abrir();
    socket().recibir('{"tipo":"carrera","id":"civil","sesion":3}');
    expect(recibidos).toEqual([{ tipo: 'carrera', id: 'civil', sesion: 3 }]);
  });

  it('descarta la basura sin romperse', () => {
    const { recibidos, socket } = preparar();
    socket().abrir();
    socket().recibir('esto no es json');
    socket().recibir('{"tipo":"desconocido"}');
    expect(recibidos).toEqual([]);
  });

  it('avisa cuando se conecta y cuando se cae', () => {
    const { estados, socket } = preparar();
    socket().abrir();
    socket().close();
    expect(estados).toEqual([{ conectado: true }, { conectado: false }]);
  });

  it('programa una reconexion cuando se corta', () => {
    const { programados, socket } = preparar();
    socket().abrir();
    socket().close();
    expect(programados).toHaveLength(1);

    programados[0]();
    expect(SocketFalso.creados).toHaveLength(2);
  });

  it('deja de reconectar despues de cerrar', () => {
    const { bus, programados, socket } = preparar();
    socket().abrir();
    bus.cerrar();
    expect(programados).toHaveLength(0);
    expect(SocketFalso.creados).toHaveLength(1);
  });

  it('cancela una reconexion ya programada al cerrar', () => {
    const { bus, socket, programados, cancelados } = preparar();
    socket().abrir();
    socket().close();
    expect(programados).toHaveLength(1);

    bus.cerrar();
    expect(cancelados).toHaveLength(1);
  });

  it('informa si esta conectado', () => {
    const { bus, socket } = preparar();
    expect(bus.conectado()).toBe(false);
    socket().abrir();
    expect(bus.conectado()).toBe(true);
    socket().close();
    expect(bus.conectado()).toBe(false);
  });

  it('sigue reconectando mientras la caida se repita', () => {
    const { programados, socket } = preparar();
    socket().abrir();
    socket().close();
    programados[0]();

    socket().abrir();
    socket().close();
    expect(programados).toHaveLength(2);
  });
});
