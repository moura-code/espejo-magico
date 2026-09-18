import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  crearArgumentosMkcert,
  mensajeInstalacionMkcert,
  obtenerNombresCertificado,
  prepararHttps,
} from '../../scripts/preparar-https.mjs';

const directoriosTemporales = [];

afterEach(async () => {
  await Promise.all(directoriosTemporales.splice(0).map((ruta) => rm(ruta, { recursive: true })));
});

describe('preparación HTTPS', () => {
  it('incluye localhost y cada IPv4 LAN una sola vez en el certificado', () => {
    const interfaces = {
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
      ethernet: [
        { address: '192.168.1.50', family: 'IPv4', internal: false },
        { address: 'fe80::1234', family: 'IPv6', internal: false },
      ],
      virtual: [{ address: '192.168.1.50', family: 4, internal: false }],
    };

    expect(obtenerNombresCertificado(interfaces)).toEqual([
      'localhost',
      '127.0.0.1',
      '192.168.1.50',
    ]);
  });

  it('ubica las opciones de salida antes de los nombres para mkcert', () => {
    expect(
      crearArgumentosMkcert({
        certificado: '/proyecto/.certificados/espejo.pem',
        clave: '/proyecto/.certificados/espejo-key.pem',
        nombres: ['localhost', '127.0.0.1', '192.168.1.50'],
      }),
    ).toEqual([
      '-cert-file',
      '/proyecto/.certificados/espejo.pem',
      '-key-file',
      '/proyecto/.certificados/espejo-key.pem',
      'localhost',
      '127.0.0.1',
      '192.168.1.50',
    ]);
  });

  it('indica cómo instalar mkcert según el sistema operativo', () => {
    expect(mensajeInstalacionMkcert('win32')).toContain('choco install mkcert');
    expect(mensajeInstalacionMkcert('linux')).toContain('mkcert');
  });

  it('instala la autoridad y genera el certificado para las IP detectadas', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'preparar-https-'));
    directoriosTemporales.push(raiz);
    const ejecuciones = [];

    const resultado = await prepararHttps({
      raiz,
      interfaces: {
        ethernet: [{ address: '192.168.1.50', family: 'IPv4', internal: false }],
      },
      ejecutar: (argumentos) => ejecuciones.push(argumentos),
    });

    expect((await stat(join(raiz, '.certificados'))).isDirectory()).toBe(true);
    expect(ejecuciones).toEqual([
      ['-install'],
      [
        '-cert-file',
        join(raiz, '.certificados', 'espejo.pem'),
        '-key-file',
        join(raiz, '.certificados', 'espejo-key.pem'),
        'localhost',
        '127.0.0.1',
        '192.168.1.50',
      ],
    ]);
    expect(resultado).toEqual({
      certificado: join(raiz, '.certificados', 'espejo.pem'),
      clave: join(raiz, '.certificados', 'espejo-key.pem'),
      nombres: ['localhost', '127.0.0.1', '192.168.1.50'],
    });
  });

  it('explica cómo instalar mkcert cuando no encuentra el ejecutable', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'preparar-https-'));
    directoriosTemporales.push(raiz);
    const error = Object.assign(new Error('no encontrado'), { code: 'ENOENT' });

    await expect(
      prepararHttps({
        raiz,
        interfaces: {},
        plataforma: 'win32',
        ejecutar: () => {
          throw error;
        },
      }),
    ).rejects.toThrow('choco install mkcert');
  });

  it('pide una terminal con permisos cuando no puede instalar la autoridad', async () => {
    const raiz = await mkdtemp(join(tmpdir(), 'preparar-https-'));
    directoriosTemporales.push(raiz);

    await expect(
      prepararHttps({
        raiz,
        interfaces: {},
        ejecutar: () => {
          throw new Error('sudo requiere una terminal');
        },
      }),
    ).rejects.toThrow('mkcert -install en una terminal interactiva con permisos');
  });
});
