import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { descubrirEstructura } from '../../servidor/descubrimiento.js';

describe('descubrirEstructura', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'descubrimiento-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('descubre carreras, objetos y fondos ordenados alfabéticamente', async () => {
    const computacion = join(dir, 'computacion');
    await mkdir(join(computacion, 'objetos', 'laptop'), { recursive: true });
    await mkdir(join(computacion, 'fondos', 'principal'), { recursive: true });

    await writeFile(
      join(computacion, 'carrera.json'),
      JSON.stringify({ nombre: 'Computación', color: '#00E5A0', maite: 'sistemas', fondo: 'principal' }),
    );
    await writeFile(join(computacion, 'objetos', 'laptop', 'imagen.png'), 'fake-png');
    await writeFile(
      join(computacion, 'objetos', 'laptop', 'metadata.json'),
      JSON.stringify({ nombre: 'Laptop', descripcion: 'Desc', figura: 'laptop' }),
    );
    await writeFile(join(computacion, 'fondos', 'principal', 'imagen.jpg'), 'fake-jpg');
    await writeFile(join(computacion, 'fondos', 'principal', 'video.mp4'), 'fake-mp4');
    await writeFile(
      join(computacion, 'fondos', 'principal', 'metadata.json'),
      JSON.stringify({ lugar: { x: 0.5, y: 0.5, escala: 0.2 }, escondites: [] }),
    );

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado).toHaveLength(1);
    expect(resultado[0].id).toBe('computacion');
    expect(resultado[0].carreraJson.nombre).toBe('Computación');
    expect(resultado[0].objetos).toHaveLength(1);
    expect(resultado[0].objetos[0].id).toBe('laptop');
    expect(resultado[0].objetos[0].rutaImagen).toBe('carreras/computacion/objetos/laptop/imagen.png');
    expect(resultado[0].objetos[0].metadata.nombre).toBe('Laptop');
    expect(resultado[0].fondos).toHaveLength(1);
    expect(resultado[0].fondos[0].id).toBe('principal');
    expect(resultado[0].fondos[0].rutaImagen).toBe('carreras/computacion/fondos/principal/imagen.jpg');
    expect(resultado[0].fondos[0].rutaVideo).toBe('carreras/computacion/fondos/principal/video.mp4');
  });

  // En una pantalla apaisada los costados de la foto vertical son la misma
  // escena extendida a 16:9. Es opcional, y no puede confundirse con la foto.
  it('descubre la version apaisada de un fondo solo cuando esta', async () => {
    const fondos = join(dir, 'civil', 'fondos');
    await mkdir(join(fondos, 'con'), { recursive: true });
    await mkdir(join(fondos, 'sin'), { recursive: true });
    await writeFile(join(fondos, 'con', 'imagen.jpg'), 'jpg');
    await writeFile(join(fondos, 'con', 'imagen-apaisada.jpg'), 'jpg');
    await writeFile(join(fondos, 'sin', 'imagen.jpg'), 'jpg');

    const [civil] = await descubrirEstructura({ raizCarreras: dir });
    expect(civil.fondos.map((f) => [f.id, f.rutaImagen, f.rutaApaisada])).toEqual([
      ['con', 'carreras/civil/fondos/con/imagen.jpg', 'carreras/civil/fondos/con/imagen-apaisada.jpg'],
      ['sin', 'carreras/civil/fondos/sin/imagen.jpg', null],
    ]);
  });

  it('ignora archivos ocultos y entradas que no son carpetas', async () => {
    await mkdir(join(dir, '.git'), { recursive: true });
    await writeFile(join(dir, '.DS_Store'), 'test');
    await writeFile(join(dir, 'README.txt'), 'test');

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado).toEqual([]);
  });

  it('ordena de forma determinista carreras y recursos independientemente del filesystem', async () => {
    // Creamos z-carrera y a-carrera, y adentro varios objetos en desorden
    const cZ = join(dir, 'z-carrera');
    const cA = join(dir, 'a-carrera');
    await mkdir(join(cZ, 'objetos', 'mouse'), { recursive: true });
    await mkdir(join(cZ, 'objetos', 'auricular'), { recursive: true });
    await mkdir(join(cA, 'objetos', 'teclado'), { recursive: true });

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado.map((c) => c.id)).toEqual(['a-carrera', 'z-carrera']);
    expect(resultado[1].objetos.map((o) => o.id)).toEqual(['auricular', 'mouse']);
  });

  it('captura errores si un JSON tiene formato inválido', async () => {
    const civil = join(dir, 'civil');
    await mkdir(join(civil, 'objetos', 'casco'), { recursive: true });
    await writeFile(join(civil, 'carrera.json'), '{ invalido json ');
    await writeFile(join(civil, 'objetos', 'casco', 'metadata.json'), '{ otro roto ');

    const resultado = await descubrirEstructura({ raizCarreras: dir });
    expect(resultado[0].errorCarreraJson).toBeDefined();
    expect(resultado[0].objetos[0].errorMetadata).toBeDefined();
  });
});
