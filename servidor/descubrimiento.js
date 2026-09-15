// Descubrimiento del contenido desde el sistema de archivos.
//
// Recorre contenido/carreras/ y devuelve una representacion cruda de carreras,
// objetos y fondos. Garantiza un orden determinista independientemente de como
// el sistema operativo enumere los directorios.

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

async function leerJsonSeguro(ruta) {
  try {
    const texto = await readFile(ruta, 'utf8');
    return { datos: JSON.parse(texto), error: null };
  } catch (error) {
    return { datos: null, error: error.message };
  }
}

async function listarCarpetasOrdenadas(directorio) {
  try {
    const entradas = await readdir(directorio, { withFileTypes: true });
    return entradas
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name)
      .sort((a, b) => a.localeCompare(b, 'es'));
  } catch {
    return [];
  }
}

async function encontrarArchivo(directorio, nombres) {
  try {
    const entradas = await readdir(directorio, { withFileTypes: true });
    for (const nombre of nombres) {
      const encontrada = entradas.find(
        (e) => e.isFile() && e.name.toLowerCase() === nombre.toLowerCase(),
      );
      if (encontrada) return encontrada.name;
    }
    return null;
  } catch {
    return null;
  }
}

export async function descubrirEstructura({ raizCarreras }) {
  const carrerasIds = await listarCarpetasOrdenadas(raizCarreras);
  const resultado = [];

  for (const carreraId of carrerasIds) {
    const dirCarrera = join(raizCarreras, carreraId);
    const rutaRelativaCarrera = `carreras/${carreraId}`;

    // carrera.json
    const rutaCarreraJson = join(dirCarrera, 'carrera.json');
    let carreraJson = null;
    let errorCarreraJson = undefined;
    const leidoCarrera = await leerJsonSeguro(rutaCarreraJson);
    if (leidoCarrera.error) {
      errorCarreraJson = leidoCarrera.error;
    } else {
      carreraJson = leidoCarrera.datos;
    }

    // objetos
    const dirObjetos = join(dirCarrera, 'objetos');
    const objetosIds = await listarCarpetasOrdenadas(dirObjetos);
    const objetos = [];

    for (const objetoId of objetosIds) {
      const dirObjeto = join(dirObjetos, objetoId);
      const nombreImg = await encontrarArchivo(dirObjeto, ['imagen.png']);
      const rutaImg = nombreImg
        ? `${rutaRelativaCarrera}/objetos/${objetoId}/${nombreImg}`
        : null;

      const rutaMeta = join(dirObjeto, 'metadata.json');
      const leidoMeta = await leerJsonSeguro(rutaMeta);

      objetos.push({
        id: objetoId,
        rutaImagen: rutaImg,
        metadata: leidoMeta.datos,
        errorMetadata: leidoMeta.error ?? undefined,
      });
    }

    // fondos
    const dirFondos = join(dirCarrera, 'fondos');
    const fondosIds = await listarCarpetasOrdenadas(dirFondos);
    const fondos = [];

    for (const fondoId of fondosIds) {
      const dirFondo = join(dirFondos, fondoId);
      const nombreImg = await encontrarArchivo(dirFondo, [
        'imagen.jpg',
        'imagen.jpeg',
        'imagen.png',
      ]);
      const rutaImg = nombreImg
        ? `${rutaRelativaCarrera}/fondos/${fondoId}/${nombreImg}`
        : null;

      const nombreVideo = await encontrarArchivo(dirFondo, ['video.mp4']);
      const rutaVideo = nombreVideo
        ? `${rutaRelativaCarrera}/fondos/${fondoId}/${nombreVideo}`
        : null;

      const rutaMeta = join(dirFondo, 'metadata.json');
      const leidoMeta = await leerJsonSeguro(rutaMeta);

      fondos.push({
        id: fondoId,
        rutaImagen: rutaImg,
        rutaVideo: rutaVideo,
        metadata: leidoMeta.datos,
        errorMetadata: leidoMeta.error ?? undefined,
      });
    }

    resultado.push({
      id: carreraId,
      rutaRelativa: rutaRelativaCarrera,
      carreraJson,
      errorCarreraJson,
      objetos,
      fondos,
    });
  }

  return resultado;
}
