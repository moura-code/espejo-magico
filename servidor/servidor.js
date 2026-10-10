// Servidor de archivos estaticos y, ademas, el tablon donde el espejo anota que
// ingenieria esta mostrando (/estado.json) para que MAITE lo lea. Nada mas: la
// logica de la experiencia vive entera en el navegador.

import { createServer as createHttpServer } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generarArchivoCatalogo } from './catalogo.js';

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

export function resolverRutasCertificados(entorno = process.env, raiz = process.cwd()) {
  if (Boolean(entorno.HTTPS_CERT) !== Boolean(entorno.HTTPS_KEY)) {
    throw new Error('HTTPS_CERT y HTTPS_KEY deben definirse juntas');
  }
  return {
    certificado: resolve(raiz, entorno.HTTPS_CERT || '.certificados/espejo.pem'),
    clave: resolve(raiz, entorno.HTTPS_KEY || '.certificados/espejo-key.pem'),
  };
}

export async function cargarCertificadosHttps({ certificado, clave }) {
  try {
    const [cert, key] = await Promise.all([readFile(certificado), readFile(clave)]);
    return { cert, key };
  } catch (error) {
    throw new Error(
      `No se pudieron leer el certificado (${certificado}) y la clave (${clave}). ` +
        'Ejecutá npm run preparar:https.',
      { cause: error },
    );
  }
}

export function obtenerUrlsDeAcceso(
  puerto,
  interfaces = networkInterfaces(),
  host = '0.0.0.0',
  protocolo = 'http',
) {
  const ruta = '/espejo/espejo.html';
  if (host !== '0.0.0.0') {
    const nombre = host === '127.0.0.1' ? 'localhost' : host;
    return [`${protocolo}://${nombre}:${puerto}${ruta}`];
  }

  const direccionesLan = Object.values(interfaces)
    .flatMap((direcciones) => direcciones ?? [])
    .filter(
      ({ address, family, internal }) =>
        !internal && (family === 'IPv4' || family === 4) && address,
    )
    .map(({ address }) => address);

  return [
    `${protocolo}://localhost:${puerto}${ruta}`,
    ...new Set(
      direccionesLan.map((direccion) => `${protocolo}://${direccion}:${puerto}${ruta}`),
    ),
  ];
}

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

// Lo que el espejo esta mostrando, para que MAITE lo lea (GET /estado.json).
// El espejo lo escribe con POST /estado.json: { mode: 'carrera', carreraId } o
// { mode: 'humo' }. `version` sube con cada aviso y `arranque` cambia si el
// servidor se reinicia, asi MAITE reconoce un aviso nuevo aunque repita carrera.
export function validarEstado(cuerpo) {
  if (cuerpo?.mode === 'humo') return { mode: 'humo', carreraId: null };
  if (
    cuerpo?.mode === 'carrera' &&
    typeof cuerpo.carreraId === 'string' &&
    /^[\w-]{1,64}$/.test(cuerpo.carreraId)
  ) {
    return { mode: 'carrera', carreraId: cuerpo.carreraId };
  }
  return null;
}

const LIMITE_DEL_AVISO = 1024;

function leerCuerpo(pedido) {
  return new Promise((ok, falla) => {
    let texto = '';
    pedido.setEncoding('utf8');
    pedido.on('data', (pedazo) => {
      texto += pedazo;
      if (texto.length > LIMITE_DEL_AVISO) falla(new Error('Aviso demasiado largo'));
    });
    pedido.on('end', () => ok(texto));
    pedido.on('error', falla);
  });
}

export function crearServidor({ raiz = RAIZ_POR_DEFECTO, tls, ahora = () => new Date() } = {}) {
  let estado = {
    mode: 'humo',
    carreraId: null,
    version: 0,
    arranque: ahora().toISOString(),
    actualizado: ahora().toISOString(),
  };

  const atenderEstado = async (pedido, respuesta) => {
    const encabezados = {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    };
    if (pedido.method === 'POST') {
      let nuevo = null;
      try {
        nuevo = validarEstado(JSON.parse(await leerCuerpo(pedido)));
      } catch {
        nuevo = null;
      }
      if (!nuevo) {
        respuesta.writeHead(400, encabezados).end(JSON.stringify({ error: 'Aviso inválido' }));
        return;
      }
      estado = {
        ...estado,
        ...nuevo,
        version: estado.version + 1,
        actualizado: ahora().toISOString(),
      };
    } else if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
      respuesta.writeHead(405, { Allow: 'GET, HEAD, POST' }).end();
      return;
    }
    const cuerpo = JSON.stringify(estado);
    respuesta.writeHead(200, { ...encabezados, 'Content-Length': Buffer.byteLength(cuerpo) });
    respuesta.end(pedido.method === 'HEAD' ? undefined : cuerpo);
  };

  const atender = async (pedido, respuesta) => {
    const ruta = new URL(pedido.url, 'http://local').pathname;
    if (ruta === '/estado.json') {
      await atenderEstado(pedido, respuesta);
      return;
    }

    if (pedido.method !== 'GET' && pedido.method !== 'HEAD') {
      respuesta.writeHead(405, { Allow: 'GET, HEAD' }).end();
      return;
    }

    const absoluta = resolve(raiz, '.' + (ruta === '/' ? '/espejo/espejo.html' : ruta));

    if (absoluta !== raiz && !absoluta.startsWith(raiz + sep)) {
      respuesta.writeHead(403).end('Fuera de la raiz');
      return;
    }
    try {
      if (ruta === '/contenido/catalogo.json') {
        try {
          await stat(absoluta);
        } catch {
          await generarArchivoCatalogo({ raiz });
        }
      }
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
  };
  const servidorHttp = tls ? createHttpsServer(tls, atender) : createHttpServer(atender);

  return {
    escuchar: (puerto, host = '0.0.0.0') =>
      new Promise((ok) =>
        servidorHttp.listen(puerto, host, () => ok(servidorHttp.address().port)),
      ),
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
  try {
    try {
      await generarArchivoCatalogo();
    } catch (error) {
      console.error('Aviso: No se pudo generar catalogo.json al iniciar:', error.message);
    }
    // HTTP plano: Chrome trata a http://localhost como contexto seguro y
    // entrega la camara igual, sin pelear con certificados. Por IP no anda.
    const servidor = crearServidor();
    const host = process.env.HOST || '0.0.0.0';
    const puerto = await servidor.escuchar(Number(process.env.PUERTO) || 8080, host);
    console.log(`Espejo HTTP escuchando en ${host}:${puerto}`);
    console.log('Abrir en (sólo por localhost, por IP Chrome no entrega la cámara):');
    console.log(`  ${obtenerUrlsDeAcceso(puerto, networkInterfaces(), host, 'http')[0]}`);
    console.log(`MAITE lee la carrera de http://localhost:${puerto}/estado.json`);
  } catch (error) {
    console.error(`No se pudo iniciar el Espejo: ${error.message}`);
    process.exitCode = 1;
  }
}
