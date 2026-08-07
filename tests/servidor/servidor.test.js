import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearServidor, interpretarRango } from '../../servidor/servidor.js';

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
  it('interpreta rangos completos, abiertos y de sufijo', () => {
    expect(interpretarRango('bytes=10-19', 100)).toEqual({ inicio: 10, fin: 19 });
    expect(interpretarRango('bytes=90-', 100)).toEqual({ inicio: 90, fin: 99 });
    expect(interpretarRango('bytes=-10', 100)).toEqual({ inicio: 90, fin: 99 });
    expect(interpretarRango('bytes=100-120', 100)).toBeNull();
    expect(interpretarRango('bytes=0-a', 100)).toBeNull();
    expect(interpretarRango(`bytes=0-${'9'.repeat(400)}`, 100)).toBeNull();
    expect(interpretarRango(`bytes=-${'9'.repeat(400)}`, 100)).toBeNull();
  });
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

  it('rechaza un segundo espejo mientras el primero siga conectado', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const primero = new WebSocket(`ws://localhost:${puerto}`);
    const segundo = new WebSocket(`ws://localhost:${puerto}`);
    await Promise.all([abierto(primero), abierto(segundo)]);
    await identificar(primero, { tipo: 'hola', rol: 'espejo', instancia: 'espejo-a' });

    const cierre = new Promise((ok) => segundo.once('close', (codigo) => ok(codigo)));
    segundo.send(JSON.stringify({ tipo: 'hola', rol: 'espejo', instancia: 'espejo-b' }));

    expect(await cierre).toBe(1008);
    primero.close();
  });

  it('no permite que una tablet cambie de rol en el mismo socket', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const cliente = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(cliente);
    await identificar(cliente, { tipo: 'hola', rol: 'tablet', slot: 0 });

    cliente.send(JSON.stringify({ tipo: 'hola', rol: 'espejo', instancia: 'intrusa' }));
    cliente.send(
      JSON.stringify({ tipo: 'carrera', id: 'civil', sesion: 1, instancia: 'intrusa' }),
    );
    await new Promise((ok) => setTimeout(ok, 20));

    const tardia = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(tardia);
    let recibio = false;
    tardia.once('message', () => (recibio = true));
    tardia.send(JSON.stringify({ tipo: 'hola', rol: 'tablet', slot: 1 }));
    await new Promise((ok) => setTimeout(ok, 30));

    expect(recibio).toBe(false);
    cliente.close();
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

  it('entrega videos por rangos sin cargar el archivo completo', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-servidor-'));
    await mkdir(join(raiz, 'contenido'));
    await writeFile(join(raiz, 'contenido', 'video.mp4'), Buffer.from('0123456789'));
    servidor = crearServidor({ raiz });
    const puerto = await servidor.escuchar(0);

    const respuesta = await fetch(`http://localhost:${puerto}/contenido/video.mp4`, {
      headers: { Range: 'bytes=2-5' },
    });

    expect(respuesta.status).toBe(206);
    expect(respuesta.headers.get('accept-ranges')).toBe('bytes');
    expect(respuesta.headers.get('content-range')).toBe('bytes 2-5/10');
    expect(await respuesta.text()).toBe('2345');
  });

  it('revalida el contenido aunque sea una imagen o un video', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-servidor-'));
    await mkdir(join(raiz, 'contenido'));
    await writeFile(join(raiz, 'contenido', 'imagen.png'), Buffer.from('imagen'));
    servidor = crearServidor({ raiz });
    const puerto = await servidor.escuchar(0);

    const respuesta = await fetch(`http://localhost:${puerto}/contenido/imagen.png`, {
      method: 'HEAD',
    });

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-length')).toBe('6');
    expect(respuesta.headers.get('cache-control')).toBe('no-cache');
    expect(await respuesta.text()).toBe('');
  });

  // Un marcador de posicion de 0 bytes es lo normal mientras diseño no entrega:
  // el servidor tiene que servirlo vacio y seguir en pie, no llevarse puesto el
  // proceso y con el la sesion del espejo y las tablets.
  it('sirve un archivo vacio y sigue atendiendo', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-servidor-'));
    await mkdir(join(raiz, 'contenido'));
    await writeFile(join(raiz, 'contenido', 'vacio.mp4'), Buffer.alloc(0));
    servidor = crearServidor({ raiz });
    const puerto = await servidor.escuchar(0);

    const respuesta = await fetch(`http://localhost:${puerto}/contenido/vacio.mp4`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-length')).toBe('0');
    expect(await respuesta.text()).toBe('');

    const siguiente = await fetch(`http://localhost:${puerto}/contenido/vacio.mp4`);
    expect(siguiente.status).toBe(200);
  });

  it('responde 416 a un rango pedido sobre un archivo vacio', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-servidor-'));
    await mkdir(join(raiz, 'contenido'));
    await writeFile(join(raiz, 'contenido', 'vacio.mp4'), Buffer.alloc(0));
    servidor = crearServidor({ raiz });
    const puerto = await servidor.escuchar(0);

    const respuesta = await fetch(`http://localhost:${puerto}/contenido/vacio.mp4`, {
      headers: { Range: 'bytes=0-10' },
    });

    expect(respuesta.status).toBe(416);
    expect(respuesta.headers.get('content-range')).toBe('bytes */0');
  });

  it('usa cache inmutable solamente para dependencias versionadas de vendor', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-servidor-'));
    await mkdir(join(raiz, 'vendor'));
    await writeFile(join(raiz, 'vendor', 'modelo.task'), Buffer.from('modelo'));
    servidor = crearServidor({ raiz });
    const puerto = await servidor.escuchar(0);

    const respuesta = await fetch(`http://localhost:${puerto}/vendor/modelo.task`);

    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('cache-control')).toContain('immutable');
  });
});
