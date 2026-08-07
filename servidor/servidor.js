import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { interpretar, TIPOS as TIPOS_MENSAJE } from '../comun/protocolo.js';

const RAIZ_POR_DEFECTO = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TIPOS_MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
};

const EXTENSIONES_INMUTABLES = new Set(['.png', '.jpg', '.webp', '.mp4', '.wasm', '.task']);

export function interpretarRango(encabezado, tamano) {
  const coincidencia = /^bytes=(\d*)-(\d*)$/.exec(encabezado ?? '');
  if (!coincidencia || (!coincidencia[1] && !coincidencia[2])) return null;

  let inicio;
  let fin;
  if (!coincidencia[1]) {
    const cantidad = Number(coincidencia[2]);
    if (!Number.isInteger(cantidad) || cantidad <= 0) return null;
    inicio = Math.max(0, tamano - cantidad);
    fin = tamano - 1;
  } else {
    inicio = Number(coincidencia[1]);
    fin = coincidencia[2] ? Number(coincidencia[2]) : tamano - 1;
  }

  if (inicio < 0 || inicio >= tamano || fin < inicio) return null;
  return { inicio, fin: Math.min(fin, tamano - 1) };
}

export function crearServidor({ raiz = RAIZ_POR_DEFECTO } = {}) {
  const servidorHttp = createServer(async (pedido, respuesta) => {
    if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
      respuesta.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    const ruta = new URL(pedido.url, 'http://local').pathname;
    const absoluta = resolve(raiz, '.' + (ruta === '/' ? '/espejo/espejo.html' : ruta));

    if (absoluta !== raiz && !absoluta.startsWith(raiz + sep)) {
      respuesta.writeHead(403).end('Fuera de la raiz');
      return;
    }
    try {
      const datos = await stat(absoluta);
      if (!datos.isFile()) throw new Error('No es un archivo');

      const extension = extname(absoluta);
      const etag = `W/"${datos.size}-${Math.trunc(datos.mtimeMs)}"`;
      const encabezados = {
        'Content-Type': TIPOS_MIME[extension] ?? 'application/octet-stream',
        'Cache-Control': EXTENSIONES_INMUTABLES.has(extension)
          ? 'public, max-age=31536000, immutable'
          : 'no-cache',
        ETag: etag,
      };

      if (pedido.headers['if-none-match'] === etag) {
        respuesta.writeHead(304, encabezados).end();
        return;
      }

      const esVideo = extension === '.mp4';
      if (esVideo) encabezados['Accept-Ranges'] = 'bytes';
      const rango = esVideo ? interpretarRango(pedido.headers.range, datos.size) : null;
      if (esVideo && pedido.headers.range && !rango) {
        respuesta.writeHead(416, { ...encabezados, 'Content-Range': `bytes */${datos.size}` }).end();
        return;
      }

      const estado = rango ? 206 : 200;
      const inicio = rango?.inicio ?? 0;
      const fin = rango?.fin ?? datos.size - 1;
      respuesta.writeHead(estado, {
        ...encabezados,
        'Content-Length': Math.max(0, fin - inicio + 1),
        ...(rango ? { 'Content-Range': `bytes ${inicio}-${fin}/${datos.size}` } : {}),
      });
      if (pedido.method === 'HEAD') {
        respuesta.end();
        return;
      }

      createReadStream(absoluta, { start: inicio, end: fin })
        .on('error', () => respuesta.destroy())
        .pipe(respuesta);
    } catch {
      respuesta.writeHead(404).end('No encontrado');
    }
  });

  const sockets = new WebSocketServer({ server: servidorHttp });
  let ultimoMensaje = null;
  let instanciaActiva = null;
  const identidadPorCliente = new WeakMap();
  let espejoActivo = null;

  sockets.on('connection', (cliente) => {
    cliente.on('message', (crudo) => {
      const texto = crudo.toString();
      const mensaje = interpretar(texto);
      if (!mensaje) return;

      if (mensaje.tipo === TIPOS_MENSAJE.HOLA) {
        // La identidad se declara una sola vez. Una tablet no puede ascenderse
        // a espejo reutilizando el mismo socket.
        if (identidadPorCliente.has(cliente)) return;

        if (mensaje.rol === 'espejo') {
          if (espejoActivo && espejoActivo !== cliente) {
            cliente.close(1008, 'Ya existe un espejo activo');
            return;
          }
          espejoActivo = cliente;
          if (mensaje.instancia !== instanciaActiva) ultimoMensaje = null;
          instanciaActiva = mensaje.instancia;
        }

        identidadPorCliente.set(cliente, mensaje);
        if (mensaje.rol === 'tablet' && ultimoMensaje) {
          cliente.send(ultimoMensaje);
        }
        return;
      }

      const identidad = identidadPorCliente.get(cliente);
      if (
        identidad?.rol !== 'espejo' ||
        identidad.instancia !== instanciaActiva ||
        mensaje.instancia !== instanciaActiva
      ) {
        return;
      }

      ultimoMensaje = texto;
      for (const otro of sockets.clients) {
        if (
          otro !== cliente &&
          otro.readyState === otro.OPEN &&
          identidadPorCliente.get(otro)?.rol === 'tablet'
        ) {
          otro.send(ultimoMensaje);
        }
      }
    });

    cliente.on('close', () => {
      if (espejoActivo === cliente) espejoActivo = null;
    });
  });

  return {
    // Expuesto para que las pruebas puedan simular una caida de wifi.
    clientes: () => sockets.clients,

    escuchar: (puerto) =>
      new Promise((ok) => servidorHttp.listen(puerto, () => ok(servidorHttp.address().port))),
    cerrar: () =>
      new Promise((ok) => {
        for (const cliente of sockets.clients) cliente.terminate();
        sockets.close();
        servidorHttp.close(ok);
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const servidor = crearServidor();
  const puerto = await servidor.escuchar(Number(process.env.PUERTO) || 8080);
  console.log(`Espejo servido en http://localhost:${puerto}/espejo/espejo.html`);
}
