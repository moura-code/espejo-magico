// Servidor de archivos estaticos, y nada mas. El espejo corre entero en el
// navegador de una sola PC: no hay estado que compartir con nadie, asi que aca
// no vive ni una linea de logica de la experiencia.

import { createServer } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function interpretarRango(encabezado, tamano) {
  const coincidencia = /^bytes=(\d*)-(\d*)$/.exec(encabezado ?? '');
  if (!coincidencia || (!coincidencia[1] && !coincidencia[2])) return null;

  let inicio;
  let fin;
  if (!coincidencia[1]) {
    const cantidad = Number(coincidencia[2]);
    if (!Number.isSafeInteger(cantidad) || cantidad <= 0) return null;
    inicio = Math.max(0, tamano - cantidad);
    fin = tamano - 1;
  } else {
    inicio = Number(coincidencia[1]);
    if (!Number.isSafeInteger(inicio) || inicio < 0) return null;

    if (coincidencia[2]) {
      fin = Number(coincidencia[2]);
      if (!Number.isSafeInteger(fin)) return null;
    } else {
      fin = tamano - 1;
    }
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
        'Cache-Control': ruta.startsWith('/vendor/')
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
      // Un archivo de 0 bytes deja `fin` en -1 y no hay nada que leer. El flujo
      // se abre ANTES de mandar los encabezados: createReadStream valida el
      // rango de forma sincronica, y si tira con los encabezados ya enviados el
      // catch no puede responder y el proceso entero se cae.
      const cuerpo =
        fin < inicio || pedido.method === 'HEAD'
          ? null
          : createReadStream(absoluta, { start: inicio, end: fin });

      respuesta.writeHead(estado, {
        ...encabezados,
        'Content-Length': Math.max(0, fin - inicio + 1),
        ...(rango ? { 'Content-Range': `bytes ${inicio}-${fin}/${datos.size}` } : {}),
      });

      if (!cuerpo) {
        respuesta.end();
        return;
      }
      cuerpo.on('error', () => respuesta.destroy()).pipe(respuesta);
    } catch {
      // Segunda linea de defensa: si algo falla despues de mandar encabezados,
      // el 404 seria un error nuevo. Cortar la conexion y dejar vivo el proceso.
      if (respuesta.headersSent) respuesta.destroy();
      else respuesta.writeHead(404).end('No encontrado');
    }
  });

  return {
    escuchar: (puerto) =>
      new Promise((ok) => servidorHttp.listen(puerto, () => ok(servidorHttp.address().port))),
    cerrar: () =>
      new Promise((ok) => {
        // Sin esto una conexion keep-alive de un pedido anterior deja el cierre
        // colgado: close() espera a que se vacien las que sigan abiertas.
        servidorHttp.closeAllConnections();
        servidorHttp.close(ok);
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const servidor = crearServidor();
  const puerto = await servidor.escuchar(Number(process.env.PUERTO) || 8080);
  console.log(`Espejo servido en http://localhost:${puerto}/espejo/espejo.html`);
}
