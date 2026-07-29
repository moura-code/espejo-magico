import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';

const NOMBRES_ESPERADOS = [
  'Ingeniería Civil',
  'Ingeniería de Alimentos',
  'Ingeniería de Producción',
  'Ingeniería Eléctrica',
  'Ingeniería en Agrimensura',
  'Ingeniería en Computación',
  'Ingeniería en Sistemas de Comunicación',
  'Ingeniería Físico-Matemática',
  'Ingeniería Industrial Mecánica',
  'Ingeniería Naval',
  'Ingeniería Química',
  'Lic. en Ciencias de la Atmósfera',
  'Lic. en Computación',
  'Lic. en Ingeniería Biológica',
  'Tecnólogo Cárnico',
  'Tecnólogo en Cartografía',
  'Tecnólogo Industrial Mecánico',
  'Tecnólogo Informático',
];

const leerCatalogo = async () =>
  JSON.parse(await readFile(new URL('../../assets/carreras.json', import.meta.url), 'utf8'));

describe('catalogo de FING', () => {
  it('incluye las catorce carreras de grado y los cuatro tecnologos', async () => {
    const { carreras } = await leerCatalogo();

    expect(carreras.map((carrera) => carrera.nombre)).toEqual(NOMBRES_ESPERADOS);
    expect(carreras.filter((carrera) => carrera.categoria === 'Carrera de grado')).toHaveLength(14);
    expect(carreras.filter((carrera) => carrera.categoria === 'Tecnólogo')).toHaveLength(4);
  });

  it('guarda un enlace oficial y unico para cada propuesta', async () => {
    const { carreras } = await leerCatalogo();
    const urls = carreras.map((carrera) => new URL(carrera.url));

    expect(urls.every((url) => url.protocol === 'https:')).toBe(true);
    expect(urls.every((url) => url.hostname === 'www.fing.edu.uy')).toBe(true);
    expect(new Set(urls.map(String)).size).toBe(carreras.length);
  });
});
