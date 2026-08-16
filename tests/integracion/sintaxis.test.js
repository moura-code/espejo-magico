// La unica red que tiene main.js.
//
// main.js no lo importa ninguna prueba y no se puede cargar en Node: es cableado
// del DOM. Eso lo deja fuera de toda la suite, y un error de sintaxis ahi no se
// ve en npm test — se ve el dia del evento, con la pantalla en negro y sin
// mensaje. Ya paso: una variable declarada dos veces en el mismo alcance, que el
// navegador rechaza al cargar el modulo entero.
//
// Parsear cada archivo con el propio Node es barato y cierra ese agujero.

import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const correr = promisify(execFile);
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CARPETAS = ['espejo', 'servidor', 'comun', 'tablet', 'herramientas'];

async function modulosDe(carpeta) {
  const entradas = await readdir(resolve(RAIZ, carpeta)).catch(() => []);
  return entradas
    .filter((nombre) => nombre.endsWith('.js') || nombre.endsWith('.mjs'))
    .map((nombre) => `${carpeta}/${nombre}`);
}

describe('sintaxis de los modulos', () => {
  it('todos los modulos parsean, incluidos los que ninguna prueba importa', async () => {
    const archivos = (await Promise.all(CARPETAS.map(modulosDe))).flat();

    // Si esto se rompe, alguien movio las carpetas y la red dejo de cubrir nada.
    expect(archivos.length).toBeGreaterThan(10);
    expect(archivos).toContain('espejo/main.js');

    const resultados = await Promise.all(
      archivos.map((archivo) =>
        correr(process.execPath, ['--check', resolve(RAIZ, archivo)]).then(
          () => null,
          (error) => `${archivo}\n${error.stderr}`,
        ),
      ),
    );

    expect(resultados.filter(Boolean)).toEqual([]);
  }, 30000);
});
