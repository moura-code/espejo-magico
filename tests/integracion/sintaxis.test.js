// La unica red que tiene main.js.
//
// main.js no lo importa ninguna prueba y no se puede cargar en Node: es cableado
// del DOM. Eso lo deja fuera de toda la suite, y un error de sintaxis ahi no se
// ve en npm test — se ve el dia del evento, con la pantalla en negro y sin
// mensaje. Ya paso: una variable declarada dos veces en el mismo alcance, que el
// navegador rechaza al cargar el modulo entero.
//
// Parsear cada archivo con el propio Node es barato y cierra ese agujero.
//
// Pero `node --check` solo mira la sintaxis: un import que apunta a un export
// que ya no existe pasa el parseo y revienta recien al cargar el modulo en el
// navegador, con el mismo sintoma —pantalla en negro, sin mensaje— y despues de
// una refactorizacion es el error mas facil de cometer. Por eso ademas se
// verifica que cada nombre importado exista del otro lado.

import { describe, it, expect } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readdir, readFile } from 'node:fs/promises';
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

// --- que cada import apunte a algo que existe ---

const IMPORTS = /import\s+([^'"]+?)\s+from\s+['"](\.[^'"]+)['"]/g;

/** Los nombres que un modulo exporta. Cubre las formas que usa el proyecto. */
function exportaciones(codigo) {
  const nombres = new Set();

  for (const [, nombre] of codigo.matchAll(
    /export\s+(?:async\s+)?(?:function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g,
  )) {
    nombres.add(nombre);
  }

  // export { a, b as c }
  for (const [, lista] of codigo.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const parte of lista.split(',')) {
      const trozos = parte.trim().split(/\s+as\s+/);
      const nombre = (trozos[1] ?? trozos[0]).trim();
      if (nombre) nombres.add(nombre);
    }
  }

  if (/export\s+default\b/.test(codigo)) nombres.add('default');
  return nombres;
}

/** Los nombres que una clausula de import pide. `import * as x` no pide ninguno. */
function importados(clausula) {
  const limpia = clausula.trim();
  if (limpia.startsWith('*')) return [];

  const llaves = limpia.match(/\{([^}]*)\}/);
  const nombres = [];

  const porDefecto = limpia.split('{')[0].replace(',', '').trim();
  if (porDefecto) nombres.push('default');

  if (llaves) {
    for (const parte of llaves[1].split(',')) {
      const nombre = parte.trim().split(/\s+as\s+/)[0].trim();
      if (nombre) nombres.push(nombre);
    }
  }
  return nombres;
}

describe('los imports apuntan a algo que existe', () => {
  it('ningun modulo importa un nombre que el otro lado no exporta', async () => {
    const archivos = (await Promise.all(CARPETAS.map(modulosDe))).flat();
    const cache = new Map();

    const exportsDe = async (ruta) => {
      if (!cache.has(ruta)) cache.set(ruta, exportaciones(await readFile(ruta, 'utf8')));
      return cache.get(ruta);
    };

    const rotos = [];

    for (const archivo of archivos) {
      const completa = resolve(RAIZ, archivo);
      const codigo = await readFile(completa, 'utf8');

      for (const [, clausula, destinoRelativo] of codigo.matchAll(IMPORTS)) {
        const destino = resolve(dirname(completa), destinoRelativo);
        const hay = await readFile(destino, 'utf8').then(() => true, () => false);
        if (!hay) {
          rotos.push(`${archivo} importa ${destinoRelativo}, que no existe`);
          continue;
        }

        const disponibles = await exportsDe(destino);
        for (const nombre of importados(clausula)) {
          if (!disponibles.has(nombre)) {
            rotos.push(`${archivo} importa "${nombre}" de ${destinoRelativo}, que no lo exporta`);
          }
        }
      }
    }

    expect(rotos).toEqual([]);
  }, 30000);
});
