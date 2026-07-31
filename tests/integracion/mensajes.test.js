// Integracion de la cadena completa de mensajes:
//
//   espejo (bus) -> servidor (rele) -> tablet (bus) -> logica de tablet
//
// Usa el servidor de verdad, WebSockets de verdad y los modulos de verdad. Lo
// unico simulado es la pantalla de la tablet.

import { describe, it, expect, afterEach, vi } from 'vitest';
import WebSocket from 'ws';

import { crearServidor } from '../../servidor/servidor.js';
import { crearBus } from '../../espejo/bus.js';
import { crearTablet } from '../../tablet/tablet.js';
import { crearTabletDeControles } from '../../tablet/controles.js';
import {
  ACCIONES,
  mensajeCarrera,
  mensajeControles,
  mensajeReposo,
} from '../../comun/protocolo.js';

const CIVIL = {
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  referentes: [
    {
      video: 'videos/civil/ana.mp4',
      dimension: 'Yo diseño.',
      nombre: 'Ana Pérez',
      detalle: 'Egresada de Ingeniería Civil',
      frase: 'Diseño los espacios que habitamos.',
    },
    {
      video: 'videos/civil/sol.mp4',
      dimension: 'Yo enseño.',
      nombre: 'Sol Díaz',
      detalle: 'Docente de Ingeniería Civil',
      frase: 'Enseño a construir infraestructura.',
    },
  ],
};
const contenido = { obtener: (id) => (id === 'civil' ? CIVIL : null) };

let servidor = null;
const buses = [];

afterEach(async () => {
  for (const bus of buses.splice(0)) bus.cerrar();
  if (servidor) await servidor.cerrar();
  servidor = null;
});

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));

function conectar(puerto, alMensaje) {
  const bus = crearBus({
    url: `ws://localhost:${puerto}`,
    reconexionMs: 50,
    alMensaje,
    CrearSocket: WebSocket,
  });
  buses.push(bus);
  return bus;
}

async function levantar() {
  servidor = crearServidor();
  return servidor.escuchar(0);
}

/** Espera hasta que `condicion()` sea cierta, o falla al agotarse el tiempo. */
async function hasta(condicion, limite = 2000) {
  const fin = Date.now() + limite;
  while (Date.now() < fin) {
    if (condicion()) return;
    await esperar(20);
  }
  throw new Error('la condicion no se cumplio a tiempo');
}

describe('cadena de mensajes espejo -> servidor -> tablets', () => {
  it('cinco tablets reciben el sorteo y cada una muestra su referente', async () => {
    const puerto = await levantar();

    const pantallas = Array.from({ length: 5 }, () => ({ mostrar: vi.fn(), ocultar: vi.fn() }));
    const tablets = pantallas.map((pantalla, slot) => crearTablet({ slot, contenido, pantalla }));
    for (const [i, tablet] of tablets.entries()) {
      conectar(puerto, (mensaje) => tablet.recibir(mensaje));
      void i;
    }

    const espejo = conectar(puerto, () => {});
    await hasta(() => espejo.conectado());
    await esperar(100);

    espejo.enviar(mensajeCarrera('civil', 1));
    await hasta(() => pantallas.every((p) => p.mostrar.mock.calls.length === 1));

    const mostradas = pantallas.map((p) => p.mostrar.mock.calls[0][0].nombre);
    expect(mostradas).toEqual([
      'Ana Pérez',
      'Sol Díaz',
      'Ana Pérez',
      'Sol Díaz',
      'Ana Pérez',
    ]);
  });

  it('el reposo apaga todas las tablets', async () => {
    const puerto = await levantar();

    const pantalla = { mostrar: vi.fn(), ocultar: vi.fn() };
    const tablet = crearTablet({ slot: 0, contenido, pantalla });
    conectar(puerto, (m) => tablet.recibir(m));

    const espejo = conectar(puerto, () => {});
    await hasta(() => espejo.conectado());
    await esperar(100);

    espejo.enviar(mensajeCarrera('civil', 1));
    await hasta(() => pantalla.mostrar.mock.calls.length === 1);

    espejo.enviar(mensajeReposo());
    await hasta(() => pantalla.ocultar.mock.calls.length === 1);
  });

  it('el latido repetido no reinicia el video', async () => {
    const puerto = await levantar();

    const pantalla = { mostrar: vi.fn(), ocultar: vi.fn() };
    const tablet = crearTablet({ slot: 0, contenido, pantalla });
    conectar(puerto, (m) => tablet.recibir(m));

    const espejo = conectar(puerto, () => {});
    await hasta(() => espejo.conectado());
    await esperar(100);

    for (let i = 0; i < 6; i++) {
      espejo.enviar(mensajeCarrera('civil', 1));
      await esperar(30);
    }

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
  });

  it('una tablet que llega tarde se pone al dia con el ultimo mensaje', async () => {
    const puerto = await levantar();

    const espejo = conectar(puerto, () => {});
    await hasta(() => espejo.conectado());
    espejo.enviar(mensajeCarrera('civil', 7));
    await esperar(100);

    // Recien ahora se enciende la tablet, con la sesion ya en curso.
    const pantalla = { mostrar: vi.fn(), ocultar: vi.fn() };
    const tablet = crearTablet({ slot: 1, contenido, pantalla });
    conectar(puerto, (m) => tablet.recibir(m));

    await hasta(() => pantalla.mostrar.mock.calls.length === 1);
    expect(pantalla.mostrar.mock.calls[0][0].nombre).toBe('Sol Díaz');
  });

  it('una tablet se reconecta sola despues de una caida', async () => {
    const puerto = await levantar();

    const pantalla = { mostrar: vi.fn(), ocultar: vi.fn() };
    const tablet = crearTablet({ slot: 0, contenido, pantalla });
    const busTablet = conectar(puerto, (m) => tablet.recibir(m));
    await hasta(() => busTablet.conectado());

    // Se le corta la conexion a esa tablet, como si se cayera el wifi.
    for (const cliente of servidor.clientes()) cliente.terminate();
    await hasta(() => !busTablet.conectado());
    await hasta(() => busTablet.conectado(), 4000);

    const espejo = conectar(puerto, () => {});
    await hasta(() => espejo.conectado());
    await esperar(100);

    espejo.enviar(mensajeCarrera('civil', 2));
    await hasta(() => pantalla.mostrar.mock.calls.length === 1);
  });

  it('sincroniza botones y devuelve pulsaciones al espejo', async () => {
    const puerto = await levantar();
    let pulsar = null;
    const pantalla = {
      mostrar: vi.fn((_estado, alPulsar) => {
        pulsar = alPulsar;
      }),
    };
    let busControl = null;
    const tablet = crearTabletDeControles({
      pantalla,
      enviar: (mensaje) => busControl.enviar(mensaje),
    });
    busControl = conectar(puerto, (mensaje) => tablet.recibir(mensaje));
    const recibidosPorEspejo = [];
    const espejo = conectar(puerto, (mensaje) => recibidosPorEspejo.push(mensaje));
    await hasta(() => busControl.conectado() && espejo.conectado());

    espejo.enviar(
      mensajeControles('ESCENA', [
        { id: ACCIONES.TERMINAR, etiqueta: 'TERMINAR', color: '#FFD23F' },
      ]),
    );
    await hasta(() => pantalla.mostrar.mock.calls.length === 1);
    pulsar(ACCIONES.TERMINAR);
    await hasta(() => recibidosPorEspejo.some((mensaje) => mensaje.tipo === 'accion'));

    expect(recibidosPorEspejo.at(-1)).toEqual({
      tipo: 'accion',
      id: ACCIONES.TERMINAR,
    });
  });
});
