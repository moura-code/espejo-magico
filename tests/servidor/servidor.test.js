import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { crearServidor } from '../../servidor/servidor.js';

let servidor = null;

afterEach(async () => {
  if (servidor) await servidor.cerrar();
  servidor = null;
});

const abierto = (socket) => new Promise((ok) => socket.once('open', ok));
const primerMensaje = (socket) =>
  new Promise((ok) => socket.once('message', (m) => ok(JSON.parse(m.toString()))));
const identificar = async (socket, mensaje) => {
  socket.send(JSON.stringify(mensaje));
  await new Promise((ok) => setTimeout(ok, 10));
};

describe('servidor', () => {
  it('repite a los demas clientes el mensaje que recibe de uno', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    const receptor = new WebSocket(`ws://localhost:${puerto}`);
    await Promise.all([abierto(emisor), abierto(receptor)]);
    await identificar(emisor, { tipo: 'hola', rol: 'espejo', instancia: 'espejo-a' });
    await identificar(receptor, { tipo: 'hola', rol: 'tablet', slot: 0 });

    const llegada = primerMensaje(receptor);
    emisor.send(
      JSON.stringify({ tipo: 'carrera', id: 'civil', sesion: 1, instancia: 'espejo-a' }),
    );

    expect(await llegada).toEqual({
      tipo: 'carrera',
      id: 'civil',
      sesion: 1,
      instancia: 'espejo-a',
    });
    emisor.close();
    receptor.close();
  });

  it('le manda el ultimo mensaje a quien se conecta despues', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(emisor);
    await identificar(emisor, { tipo: 'hola', rol: 'espejo', instancia: 'espejo-a' });
    emisor.send(
      JSON.stringify({ tipo: 'carrera', id: 'quimica', sesion: 7, instancia: 'espejo-a' }),
    );

    await new Promise((ok) => setTimeout(ok, 50));
    const tardio = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(tardio);
    const llegada = primerMensaje(tardio);
    tardio.send(JSON.stringify({ tipo: 'hola', rol: 'tablet', slot: 1 }));

    expect(await llegada).toEqual({
      tipo: 'carrera',
      id: 'quimica',
      sesion: 7,
      instancia: 'espejo-a',
    });
    emisor.close();
    tardio.close();
  });

  it('una tablet no puede reemplazar el estado publicado por el espejo', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const espejo = new WebSocket(`ws://localhost:${puerto}`);
    const intrusa = new WebSocket(`ws://localhost:${puerto}`);
    await Promise.all([abierto(espejo), abierto(intrusa)]);
    await identificar(espejo, { tipo: 'hola', rol: 'espejo', instancia: 'espejo-a' });
    await identificar(intrusa, { tipo: 'hola', rol: 'tablet', slot: 0 });

    intrusa.send(
      JSON.stringify({ tipo: 'carrera', id: 'civil', sesion: 99, instancia: 'espejo-a' }),
    );
    await new Promise((ok) => setTimeout(ok, 20));

    const tardia = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(tardia);
    let recibio = false;
    tardia.once('message', () => (recibio = true));
    tardia.send(JSON.stringify({ tipo: 'hola', rol: 'tablet', slot: 1 }));
    await new Promise((ok) => setTimeout(ok, 30));

    expect(recibio).toBe(false);
    espejo.close();
    intrusa.close();
    tardia.close();
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
  });
});
