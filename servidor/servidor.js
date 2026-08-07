import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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

export function crearServidor({ raiz = RAIZ_POR_DEFECTO } = {}) {
  const servidorHttp = createServer(async (pedido, respuesta) => {
    const ruta = new URL(pedido.url, 'http://local').pathname;
    const absoluta = resolve(raiz, '.' + (ruta === '/' ? '/espejo/espejo.html' : ruta));

    if (absoluta !== raiz && !absoluta.startsWith(raiz + sep)) {
      respuesta.writeHead(403).end('Fuera de la raiz');
      return;
    }
    try {
      const cuerpo = await readFile(absoluta);
      respuesta
        .writeHead(200, {
          'Content-Type': TIPOS_MIME[extname(absoluta)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        .end(cuerpo);
    } catch {
      respuesta.writeHead(404).end('No encontrado');
    }
  });

  const sockets = new WebSocketServer({ server: servidorHttp });
  let ultimoMensaje = null;
  let instanciaActiva = null;
  const identidadPorCliente = new WeakMap();

  sockets.on('connection', (cliente) => {
    cliente.on('message', (crudo) => {
      const texto = crudo.toString();
      const mensaje = interpretar(texto);
      if (!mensaje) return;

      if (mensaje.tipo === TIPOS_MENSAJE.HOLA) {
        identidadPorCliente.set(cliente, mensaje);
        if (mensaje.rol === 'espejo') {
          if (mensaje.instancia !== instanciaActiva) ultimoMensaje = null;
          instanciaActiva = mensaje.instancia;
        } else if (ultimoMensaje) {
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
