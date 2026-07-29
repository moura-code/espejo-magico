import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';
import { interpretar, TIPOS } from '../comun/protocolo.js';

const RAIZ_POR_DEFECTO = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TIPOS_ARCHIVO = {
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

export function obtenerDireccionesLocales(interfaces = networkInterfaces()) {
  return [
    ...new Set(
      Object.values(interfaces)
        .flatMap((direcciones) => direcciones ?? [])
        .filter(
          ({ address, family, internal }) =>
            family === 'IPv4' &&
            !internal &&
            address !== '0.0.0.0' &&
            !address.startsWith('169.254.'),
        )
        .map(({ address }) => address),
    ),
  ];
}

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
          'Content-Type': TIPOS_ARCHIVO[extname(absoluta)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        .end(cuerpo);
    } catch {
      respuesta.writeHead(404).end('No encontrado');
    }
  });

  const sockets = new WebSocketServer({ server: servidorHttp });
  const ultimosMensajes = new Map();

  sockets.on('connection', (cliente) => {
    for (const mensaje of ultimosMensajes.values()) cliente.send(mensaje);
    cliente.on('message', (crudo) => {
      const texto = crudo.toString();
      const mensaje = interpretar(texto);
      if (!mensaje) return;

      if (mensaje.tipo === TIPOS.CARRERA || mensaje.tipo === TIPOS.REPOSO) {
        ultimosMensajes.set('experiencia', texto);
      }
      if (mensaje.tipo === TIPOS.CONTROLES) {
        ultimosMensajes.set('controles', texto);
      }

      for (const otro of sockets.clients) {
        if (otro !== cliente && otro.readyState === otro.OPEN) otro.send(texto);
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
  const direcciones = obtenerDireccionesLocales();
  const direccionParaTablets = direcciones[0] ?? 'localhost';

  console.log('Espejo servido en:');
  console.log(`  Local:     http://localhost:${puerto}/`);
  if (direcciones.length === 0) {
    console.log('  Red local: no se encontró una dirección IPv4');
  } else {
    for (const direccion of direcciones) {
      console.log(`  Red local: http://${direccion}:${puerto}/`);
    }
  }
  console.log('Otras pantallas:');
  console.log(
    `  Videos:    http://${direccionParaTablets}:${puerto}/tablet/tablet.html?slot=0`,
  );
  console.log(
    `  Controles: http://${direccionParaTablets}:${puerto}/tablet/controles.html`,
  );
  console.log(`  Figuras:   http://localhost:${puerto}/herramientas/figuras.html`);
}
