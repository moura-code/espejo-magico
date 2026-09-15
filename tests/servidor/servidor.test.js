import { describe, it, expect, afterEach } from 'vitest';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearServidor, interpretarRango } from '../../servidor/servidor.js';

let servidor = null;

afterEach(async () => {
  if (servidor) await servidor.cerrar();
  servidor = null;
});

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

