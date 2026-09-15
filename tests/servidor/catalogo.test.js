import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { construirCatalogo, generarArchivoCatalogo } from '../../servidor/catalogo.js';

describe('catalogo', () => {
  let dir;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'catalogo-test-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function crearCarreraMinima(raiz, id, { fondoActivo = 'principal' } = {}) {
    const dirCarrera = join(raiz, id);
    await mkdir(join(dirCarrera, 'objetos', 'item1'), { recursive: true });
    await mkdir(join(dirCarrera, 'fondos', 'principal'), { recursive: true });

    await writeFile(
      join(dirCarrera, 'carrera.json'),
      JSON.stringify({ nombre: `Carrera ${id}`, color: '#112233', maite: id, fondo: fondoActivo }),
    );
    await writeFile(join(dirCarrera, 'objetos', 'item1', 'imagen.png'), 'png');
    await writeFile(
      join(dirCarrera, 'objetos', 'item1', 'metadata.json'),
      JSON.stringify({ nombre: 'Item 1', descripcion: 'Desc', figura: 'chip' }),
    );
    await writeFile(join(dirCarrera, 'fondos', 'principal', 'imagen.jpg'), 'jpg');
    await writeFile(
      join(dirCarrera, 'fondos', 'principal', 'metadata.json'),
      JSON.stringify({ lugar: { x: 0.5, y: 0.5, escala: 0.2 }, escondites: [] }),
    );
  }

  it('construye un catálogo normalizado determinista', async () => {
    await crearCarreraMinima(dir, 'civil');
    await crearCarreraMinima(dir, 'computacion');

    const { catalogo, errores } = await construirCatalogo({
      raizCarreras: dir,
      figurasValidas: ['chip'],
    });

    expect(errores).toEqual([]);
    expect(catalogo.carreras).toHaveLength(2);
    expect(catalogo.carreras[0].id).toBe('civil');
    expect(catalogo.carreras[1].id).toBe('computacion');

    const comp = catalogo.carreras[1];
    expect(comp.nombre).toBe('Carrera computacion');
    expect(comp.fondoActivo).toBe('principal');
    expect(comp.fondos[0].img).toBe('carreras/computacion/fondos/principal/imagen.jpg');
    expect(comp.objetos[0].id).toBe('item1');
    expect(comp.objetos[0].img).toBe('carreras/computacion/objetos/item1/imagen.png');
  });

  it('retorna errores y no genera catálogo si la estructura es inválida', async () => {
    const dirCarrera = join(dir, 'invalida');
    await mkdir(dirCarrera, { recursive: true });
    await writeFile(join(dirCarrera, 'carrera.json'), JSON.stringify({ nombre: '' }));

    const { catalogo, errores } = await construirCatalogo({ raizCarreras: dir });
    expect(catalogo).toBeNull();
    expect(errores.length).toBeGreaterThan(0);
  });

  it('generarArchivoCatalogo escribe el archivo en disco', async () => {
    const raiz = join(dir, 'proyecto');
    const raizCarreras = join(raiz, 'contenido', 'carreras');
    const rutaSalida = join(raiz, 'contenido', 'catalogo.json');
    await mkdir(raizCarreras, { recursive: true });
    await crearCarreraMinima(raizCarreras, 'mecanica');

    const resultado = await generarArchivoCatalogo({
      raiz,
      raizCarreras,
      rutaSalida,
      figurasValidas: ['chip'],
    });

    expect(resultado.carrerasCount).toBe(1);
    const contenido = JSON.parse(await readFile(rutaSalida, 'utf8'));
    expect(contenido.carreras[0].id).toBe('mecanica');
  });
});
