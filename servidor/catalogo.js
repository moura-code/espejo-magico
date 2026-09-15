// Generador del catalogo normalizado derivado.
//
// Construye el catalogo desde la estructura fisica de carpetas y lo escribe en
// contenido/catalogo.json.

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { descubrirEstructura } from './descubrimiento.js';
import { validarEstructura } from './validador.js';
import { figurasDisponibles } from '../espejo/figuras.js';

const RAIZ_PROYECTO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RAIZ_CARRERAS_POR_DEFECTO = join(RAIZ_PROYECTO, 'contenido/carreras');
const RUTA_SALIDA_POR_DEFECTO = join(RAIZ_PROYECTO, 'contenido/catalogo.json');

export async function construirCatalogo({
  raizCarreras = RAIZ_CARRERAS_POR_DEFECTO,
  figurasValidas = figurasDisponibles(),
} = {}) {
  const carrerasCrudas = await descubrirEstructura({ raizCarreras });
  const errores = validarEstructura(carrerasCrudas, { figurasValidas });

  if (errores.length > 0) {
    return { catalogo: null, errores };
  }

  const carreras = carrerasCrudas.map((carrera) => {
    const json = carrera.carreraJson ?? {};
    const fondoActivo = json.fondo || carrera.fondos[0]?.id || null;

    return {
      id: carrera.id,
      nombre: json.nombre,
      color: json.color,
      maite: json.maite ?? null,
      fondoActivo,
      fondos: carrera.fondos.map((f) => ({
        id: f.id,
        img: f.rutaImagen,
        video: f.rutaVideo,
        lugar: f.metadata.lugar,
        escondites: f.metadata.escondites,
      })),
      objetos: carrera.objetos.map((o) => ({
        id: o.id,
        img: o.rutaImagen,
        nombre: o.metadata.nombre,
        descripcion: o.metadata.descripcion,
        figura: o.metadata.figura ?? null,
      })),
    };
  });

  return { catalogo: { carreras }, errores: [] };
}

export async function generarArchivoCatalogo({
  raiz = RAIZ_PROYECTO,
  raizCarreras = join(raiz, 'contenido/carreras'),
  rutaSalida = join(raiz, 'contenido/catalogo.json'),
  figurasValidas = figurasDisponibles(),
} = {}) {
  const { catalogo, errores } = await construirCatalogo({ raizCarreras, figurasValidas });

  if (errores.length > 0) {
    throw new Error(
      `No se pudo generar el catálogo por errores de contenido:\n  - ${errores.join('\n  - ')}`,
    );
  }

  await mkdir(dirname(rutaSalida), { recursive: true });
  const jsonFormateado = JSON.stringify(catalogo, null, 2) + '\n';
  await writeFile(rutaSalida, jsonFormateado, 'utf8');

  return {
    ruta: rutaSalida,
    carrerasCount: catalogo.carreras.length,
    catalogo,
  };
}
