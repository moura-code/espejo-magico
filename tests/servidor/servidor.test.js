import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import {
  ACCIONES,
  mensajeAccion,
  mensajeCarrera,
  mensajeControles,
} from '../../comun/protocolo.js';
import {
  crearServidor,
  obtenerDireccionesLocales,
} from '../../servidor/servidor.js';

let servidor = null;

afterEach(async () => {
  if (servidor) await servidor.cerrar();
  servidor = null;
});

const abierto = (socket) => new Promise((ok) => socket.once('open', ok));
const primerMensaje = (socket) =>
  new Promise((ok) => socket.once('message', (m) => ok(JSON.parse(m.toString()))));
const mensajes = (socket, cantidad) =>
  new Promise((ok) => {
    const recibidos = [];
    socket.on('message', (crudo) => {
      recibidos.push(JSON.parse(crudo.toString()));
      if (recibidos.length === cantidad) ok(recibidos);
    });
  });

describe('servidor', () => {
  it('repite a los demas clientes el mensaje que recibe de uno', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    const receptor = new WebSocket(`ws://localhost:${puerto}`);
    await Promise.all([abierto(emisor), abierto(receptor)]);

    const llegada = primerMensaje(receptor);
    emisor.send(JSON.stringify({ tipo: 'carrera', id: 'civil', sesion: 1 }));

    expect(await llegada).toEqual({ tipo: 'carrera', id: 'civil', sesion: 1 });
    emisor.close();
    receptor.close();
  });

  it('le manda el ultimo mensaje a quien se conecta despues', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(emisor);
    emisor.send(JSON.stringify({ tipo: 'carrera', id: 'quimica', sesion: 7 }));

    await new Promise((ok) => setTimeout(ok, 50));
    const tardio = new WebSocket(`ws://localhost:${puerto}`);
    const llegada = primerMensaje(tardio);

    expect(await llegada).toEqual({ tipo: 'carrera', id: 'quimica', sesion: 7 });
    emisor.close();
    tardio.close();
  });

  it('recuerda por separado la experiencia y los controles dinamicos', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(emisor);
    emisor.send(JSON.stringify(mensajeCarrera('civil', 3)));
    emisor.send(
      JSON.stringify(
        mensajeControles('ESCENA', [
          { id: ACCIONES.TERMINAR, etiqueta: 'TERMINAR', color: '#FFD23F' },
        ]),
      ),
    );
    await new Promise((ok) => setTimeout(ok, 50));

    const tardio = new WebSocket(`ws://localhost:${puerto}`);
    const recibidos = mensajes(tardio, 2);

    expect(await recibidos).toEqual([
      mensajeCarrera('civil', 3),
      mensajeControles('ESCENA', [
        { id: ACCIONES.TERMINAR, etiqueta: 'TERMINAR', color: '#FFD23F' },
      ]),
    ]);
    emisor.close();
    tardio.close();
  });

  it('repite las acciones tactiles sin tratarlas como estado persistente', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const espejo = new WebSocket(`ws://localhost:${puerto}`);
    const tablet = new WebSocket(`ws://localhost:${puerto}`);
    await Promise.all([abierto(espejo), abierto(tablet)]);

    const recibida = primerMensaje(espejo);
    tablet.send(JSON.stringify(mensajeAccion(ACCIONES.TERMINAR)));
    expect(await recibida).toEqual(mensajeAccion(ACCIONES.TERMINAR));

    espejo.close();
    tablet.close();
  });

  it('no sirve archivos fuera de la raiz', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const respuesta = await fetch(`http://localhost:${puerto}/../../../etc/passwd`);
    expect([403, 404]).toContain(respuesta.status);
  });

  it('sirve la pagina del espejo en la raiz', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const respuesta = await fetch(`http://localhost:${puerto}/`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toContain('text/html');
    expect(await respuesta.text()).toContain('<base href="/espejo/">');
  });

  it('encuentra las direcciones IPv4 utilizables de la red local', () => {
    expect(
      obtenerDireccionesLocales({
        'Wi-Fi': [
          { address: '192.168.1.20', family: 'IPv4', internal: false },
          { address: 'fe80::1', family: 'IPv6', internal: false },
        ],
        Ethernet: [
          { address: '10.0.0.8', family: 'IPv4', internal: false },
          { address: '169.254.2.3', family: 'IPv4', internal: false },
        ],
        Loopback: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      }),
    ).toEqual(['192.168.1.20', '10.0.0.8']);
  });
});
