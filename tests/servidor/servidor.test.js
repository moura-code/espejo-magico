import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir, readFile, rm } from 'node:fs/promises';
import { execFile, spawnSync } from 'node:child_process';
import { get } from 'node:https';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import {
  crearServidor,
  cargarCertificadosHttps,
  interpretarRango,
  obtenerUrlsDeAcceso,
  resolverRutasCertificados,
} from '../../servidor/servidor.js';

let servidor = null;
const directoriosTemporales = [];
const ejecutar = promisify(execFile);
const hayOpenSsl = spawnSync('openssl', ['version']).status === 0;

afterEach(async () => {
  if (servidor) await servidor.cerrar();
  servidor = null;
  await Promise.all(directoriosTemporales.splice(0).map((ruta) => rm(ruta, { recursive: true })));
});

describe('servidor', () => {
  it('usa las rutas HTTPS predeterminadas dentro del proyecto', () => {
    expect(resolverRutasCertificados({}, '/proyecto')).toEqual({
      certificado: '/proyecto/.certificados/espejo.pem',
      clave: '/proyecto/.certificados/espejo-key.pem',
    });
  });

  it('rechaza una configuración que define solo una ruta TLS', () => {
    expect(() =>
      resolverRutasCertificados({ HTTPS_CERT: '/certificado.pem' }, '/proyecto'),
    ).toThrow('HTTPS_CERT y HTTPS_KEY deben definirse juntas');
  });

  it('carga el certificado y la clave indicados por el operador', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-certificados-'));
    directoriosTemporales.push(raiz);
    const certificado = join(raiz, 'cert.pem');
    const clave = join(raiz, 'key.pem');
    await writeFile(certificado, 'certificado de prueba');
    await writeFile(clave, 'clave de prueba');

    await expect(cargarCertificadosHttps({ certificado, clave })).resolves.toEqual({
      cert: Buffer.from('certificado de prueba'),
      key: Buffer.from('clave de prueba'),
    });
  });

  it('indica cómo preparar HTTPS cuando falta un archivo TLS', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-certificados-'));
    directoriosTemporales.push(raiz);

    await expect(
      cargarCertificadosHttps({
        certificado: join(raiz, 'inexistente.pem'),
        clave: join(raiz, 'inexistente-key.pem'),
      }),
    ).rejects.toThrow('npm run preparar:https');
  });

  it('muestra las IPv4 LAN en las que expone el servicio y excluye loopback', () => {
    const interfaces = {
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      ethernet: [{ address: '192.168.1.35', family: 'IPv4', internal: false }],
      wifi: [
        { address: '10.0.0.22', family: 4, internal: false },
        { address: 'fe80::1234', family: 'IPv6', internal: false },
      ],
    };

    expect(obtenerUrlsDeAcceso(8080, interfaces)).toEqual([
      'http://localhost:8080/espejo/espejo.html',
      'http://192.168.1.35:8080/espejo/espejo.html',
      'http://10.0.0.22:8080/espejo/espejo.html',
    ]);
  });

  it('anuncia URLs https cuando el servidor usa TLS', () => {
    expect(
      obtenerUrlsDeAcceso(
        8080,
        { ethernet: [{ address: '192.168.1.35', family: 'IPv4', internal: false }] },
        '0.0.0.0',
        'https',
      ),
    ).toEqual([
      'https://localhost:8080/espejo/espejo.html',
      'https://192.168.1.35:8080/espejo/espejo.html',
    ]);
  });

  it.runIf(hayOpenSsl)('sirve la experiencia mediante una conexión TLS real', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-https-'));
    directoriosTemporales.push(raiz);
    const certificado = join(raiz, 'cert.pem');
    const clave = join(raiz, 'key.pem');
    await ejecutar('openssl', [
      'req',
      '-x509',
      '-newkey',
      'rsa:2048',
      '-nodes',
      '-keyout',
      clave,
      '-out',
      certificado,
      '-days',
      '1',
      '-subj',
      '/CN=localhost',
    ]);

    servidor = crearServidor({
      tls: {
        cert: await readFile(certificado),
        key: await readFile(clave),
      },
    });
    const puerto = await servidor.escuchar(0, '127.0.0.1');

    const estado = await new Promise((resolve, reject) => {
      get(
        { hostname: '127.0.0.1', port: puerto, path: '/', rejectUnauthorized: false },
        (respuesta) => {
          respuesta.resume();
          respuesta.on('end', () => resolve(respuesta.statusCode));
        },
      ).on('error', reject);
    });

    expect(estado).toBe(200);
  });

  it('escucha explícitamente en el host solicitado', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0, '127.0.0.2');

    const respuesta = await fetch(`http://127.0.0.2:${puerto}/`);

    expect(respuesta.status).toBe(200);
    await expect(fetch(`http://127.0.0.1:${puerto}/`)).rejects.toThrow();
  });

  it('interpreta rangos completos, abiertos y de sufijo', () => {
    expect(interpretarRango('bytes=10-19', 100)).toEqual({ inicio: 10, fin: 19 });
    expect(interpretarRango('bytes=90-', 100)).toEqual({ inicio: 90, fin: 99 });
    expect(interpretarRango('bytes=-10', 100)).toEqual({ inicio: 90, fin: 99 });
    expect(interpretarRango('bytes=100-120', 100)).toBeNull();
    expect(interpretarRango('bytes=0-a', 100)).toBeNull();
    expect(interpretarRango(`bytes=0-${'9'.repeat(400)}`, 100)).toBeNull();
    expect(interpretarRango(`bytes=-${'9'.repeat(400)}`, 100)).toBeNull();
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
  // proceso y con el la sesion del espejo.
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

  it('genera catalogo.json bajo demanda si no existe en disco', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'espejo-servidor-'));
    const baseCarrera = join(raiz, 'contenido', 'carreras', 'computacion');
    const baseObjeto = join(baseCarrera, 'objetos', 'chip');
    const baseFondo = join(baseCarrera, 'fondos', 'aula');
    await mkdir(baseObjeto, { recursive: true });
    await mkdir(baseFondo, { recursive: true });

    await writeFile(
      join(baseCarrera, 'carrera.json'),
      JSON.stringify({
        nombre: 'Computación',
        color: '#00E5A0',
        maite: 'computacion',
      }),
    );
    await writeFile(join(baseObjeto, 'imagen.png'), Buffer.from('png'));
    await writeFile(
      join(baseObjeto, 'metadata.json'),
      JSON.stringify({
        nombre: 'Microprocesador',
        descripcion: 'Cerebro de silicio',
        figura: 'chip',
      }),
    );
    await writeFile(join(baseFondo, 'imagen.jpg'), Buffer.from('jpg'));
    await writeFile(
      join(baseFondo, 'metadata.json'),
      JSON.stringify({
        lugar: { x: 0.5, y: 0.5, escala: 1 },
        escondites: [],
      }),
    );

    servidor = crearServidor({ raiz });
    const puerto = await servidor.escuchar(0);

    const respuesta = await fetch(`http://localhost:${puerto}/contenido/catalogo.json`);
    expect(respuesta.status).toBe(200);
    const catalogo = await respuesta.json();
    expect(catalogo.carreras).toHaveLength(1);
    expect(catalogo.carreras[0].id).toBe('computacion');
  });
});
