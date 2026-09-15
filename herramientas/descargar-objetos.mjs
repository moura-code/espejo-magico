#!/usr/bin/env node
// herramientas/descargar-objetos.mjs
//
// Herramienta automatizada para buscar, descargar e incorporar los 60 objetos
// concretos (5 por ingeniería) para el Espejo Mágico desde Wikimedia Commons.
//
// Uso:
//   node herramientas/descargar-objetos.mjs info
//   node herramientas/descargar-objetos.mjs buscar
//   node herramientas/descargar-objetos.mjs descargar [--carrera=civil]
//   node herramientas/descargar-objetos.mjs aplicar [--carrera=civil]

import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_CANDIDATOS = resolve(RAIZ, 'contenido/comun/objetos-candidatos.json');
const RUTA_MANIFEST = resolve(RAIZ, 'contenido/comun/objetos-manifest.json');
const DIR_DESCARGAS = resolve(RAIZ, 'contenido/comun/banco/descargas');
const RUTA_CREDITOS = resolve(RAIZ, 'contenido/comun/CREDITOS.md');

const USER_AGENT = 'EspejoMagicoBot/1.0 (contact@fing.edu.uy)';

function leerCandidatos() {
  if (!existsSync(RUTA_CANDIDATOS)) {
    throw new Error(`No se encontró el archivo de candidatos en ${RUTA_CANDIDATOS}`);
  }
  return JSON.parse(readFileSync(RUTA_CANDIDATOS, 'utf8'));
}

function limpiarTexto(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Busca candidatos de imágenes en Wikimedia Commons para un término dado.
 */
async function buscarEnCommons(query) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query + ' filetype:bitmap',
  )}&srnamespace=6&srlimit=5&format=json`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json();
    const hits = data.query?.search ?? [];
    return hits.map((h) => h.title);
  } catch (e) {
    console.error(`Error buscando "${query}":`, e.message);
    return [];
  }
}

/**
 * Obtiene metadata y URLs de descarga para un archivo específico de Commons.
 */
async function obtenerInfoArchivo(tituloArchivo, ancho = 768) {
  const url = `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(
    tituloArchivo,
  )}&prop=imageinfo&iiprop=url|size|mime|extmetadata&iiurlwidth=${ancho}&format=json`;

  try {
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    const data = await res.json();
    const pages = data.query?.pages ?? {};
    const page = Object.values(pages)[0];
    const info = page?.imageinfo?.[0];
    if (!info) return null;

    const meta = info.extmetadata ?? {};
    const autor = limpiarTexto(meta.Artist?.value) || 'Desconocido';
    const licencia = meta.LicenseShortName?.value || 'Commons libre';
    const descripcion = limpiarTexto(meta.ImageDescription?.value) || '';
    const paginaUrl = info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(tituloArchivo)}`;

    return {
      titulo: tituloArchivo,
      urlDescarga: info.thumburl || info.url,
      urlOriginal: info.url,
      paginaUrl,
      ancho: info.thumbwidth || info.width,
      alto: info.thumbheight || info.height,
      mime: info.mime,
      autor,
      licencia,
      descripcion,
    };
  } catch (e) {
    console.error(`Error obteniendo info de ${tituloArchivo}:`, e.message);
    return null;
  }
}

/**
 * Comando: info
 */
function cmdInfo() {
  const carreras = leerCandidatos();
  console.log(`\n=== Espejo Mágico: Catálogo de Objetos Candidatos ===`);
  let totalObjetos = 0;
  for (const c of carreras) {
    console.log(`\n[${c.carrera}] ${c.carreraNombre} (${c.objetos.length} objetos):`);
    for (const o of c.objetos) {
      totalObjetos++;
      const tag = o.activo ? '✓ ACTIVO ' : '○ BANCO  ';
      const len = o.descripcion.length;
      console.log(`  ${tag} ${o.id.padEnd(24)} | ${o.nombre.padEnd(30)} | (${len}/130 ch) [fig:${o.figura}]`);
    }
  }
  console.log(`\nTotal: ${carreras.length} carreras, ${totalObjetos} objetos definidos.`);
}

/**
 * Comando: buscar
 */
async function cmdBuscar(filtroCarrera = null) {
  const carreras = leerCandidatos();
  let manifest = [];
  if (existsSync(RUTA_MANIFEST)) {
    try {
      manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8'));
    } catch {
      manifest = [];
    }
  }

  console.log(`Buscando archivos candidatos en Wikimedia Commons con User-Agent: ${USER_AGENT}...\n`);

  for (const c of carreras) {
    if (filtroCarrera && c.carrera !== filtroCarrera) continue;
    console.log(`--- Buscando para ${c.carreraNombre} ---`);
    const objetosConInfo = [];

    for (const o of c.objetos) {
      process.stdout.write(`  Buscando "${o.nombre}" (${o.busqueda})... `);
      const titulos = await buscarEnCommons(o.busqueda);
      let candidato = null;

      for (const titulo of titulos) {
        // Filtrar archivos no deseados (PDFs, djvu, etc.)
        if (/\.(pdf|djvu|ogg|ogv|webm)$/i.test(titulo)) continue;
        const info = await obtenerInfoArchivo(titulo, 768);
        if (info) {
          candidato = info;
          break;
        }
      }

      if (candidato) {
        console.log(`✓ ${candidato.titulo} (${candidato.licencia})`);
        objetosConInfo.push({ ...o, commons: candidato });
      } else {
        console.log(`✗ Sin resultados válidos`);
        objetosConInfo.push({ ...o, commons: null });
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    const idx = manifest.findIndex((m) => m.carrera === c.carrera);
    if (idx >= 0) {
      manifest[idx] = { ...c, objetos: objetosConInfo };
    } else {
      manifest.push({ ...c, objetos: objetosConInfo });
    }
  }

  writeFileSync(RUTA_MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`\nManifest guardado en: ${RUTA_MANIFEST}`);
}

/**
 * Comando: descargar
 */
async function cmdDescargar(filtroCarrera = null) {
  if (!existsSync(RUTA_MANIFEST)) {
    console.log('Manifest no encontrado. Ejecutando búsqueda primero...');
    await cmdBuscar();
  }

  const manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8'));
  mkdirSync(DIR_DESCARGAS, { recursive: true });

  console.log(`\nDescargando imágenes a ${DIR_DESCARGAS}...`);
  for (const c of manifest) {
    if (filtroCarrera && c.carrera !== filtroCarrera) continue;
    const dirCarreraDescargas = join(DIR_DESCARGAS, c.carrera);
    mkdirSync(dirCarreraDescargas, { recursive: true });

    for (const o of c.objetos) {
      if (!o.commons?.urlDescarga) {
        console.warn(`  [${c.carrera}] ${o.id}: sin URL de descarga`);
        continue;
      }
      const ext = o.commons.titulo.split('.').pop().toLowerCase();
      const rutaDestino = join(dirCarreraDescargas, `${o.id}.${ext}`);
      process.stdout.write(`  Descargando ${c.carrera}/${o.id}.${ext}... `);

      try {
        const res = await fetch(o.commons.urlDescarga, {
          headers: { 'User-Agent': USER_AGENT },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        writeFileSync(rutaDestino, buffer);
        console.log(`✓ OK (${(buffer.length / 1024).toFixed(1)} KB)`);
      } catch (e) {
        console.log(`✗ Error: ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  }
  console.log(`\nDescargas completadas.`);
}

/**
 * Comando: aplicar
 * Aplica los metadatos y crea las carpetas en contenido/carreras y contenido/comun/banco
 */
function cmdAplicar(filtroCarrera = null) {
  const candidatos = leerCandidatos();
  console.log('\nAplicando estructura de metadatos en contenido/...\n');

  for (const c of candidatos) {
    if (filtroCarrera && c.carrera !== filtroCarrera) continue;

    for (const o of c.objetos) {
      const meta = {
        nombre: o.nombre,
        descripcion: o.descripcion,
        figura: o.figura,
      };

      if (o.activo) {
        // Objeto activo en contenido/carreras/<carrera>/objetos/<id>/
        const dirObj = resolve(RAIZ, `contenido/carreras/${c.carrera}/objetos/${o.id}`);
        mkdirSync(dirObj, { recursive: true });
        const rutaMeta = join(dirObj, 'metadata.json');
        writeFileSync(rutaMeta, JSON.stringify(meta, null, 2) + '\n', 'utf8');
        console.log(`  [ACTIVO] Escrito: ${rutaMeta}`);
      } else {
        // Objeto de banco en contenido/comun/banco/<carrera>/<id>.json
        const dirBanco = resolve(RAIZ, `contenido/comun/banco/${c.carrera}`);
        mkdirSync(dirBanco, { recursive: true });
        const rutaMeta = join(dirBanco, `${o.id}.json`);
        writeFileSync(rutaMeta, JSON.stringify(meta, null, 2) + '\n', 'utf8');
        console.log(`  [BANCO]  Escrito: ${rutaMeta}`);
      }
    }
  }
  console.log('\nMetadatos aplicados correctamente.');
}

/**
 * Comando: incorporar
 * Procesa las imágenes descargadas, genera imagen.png, archiva objetos viejos a banco/,
 * coloca los nuevos en las carpetas de carreras y actualiza CREDITOS.md y catalogo.json.
 */
function cmdIncorporar(filtroCarrera = null) {
  const candidatos = leerCandidatos();
  console.log('\n=== Incorporando objetos candidatos al proyecto ===\n');

  for (const c of candidatos) {
    if (filtroCarrera && c.carrera !== filtroCarrera) continue;
    console.log(`\n--- [${c.carrera}] ${c.carreraNombre} ---`);

    const dirObjetosCarrera = resolve(RAIZ, `contenido/carreras/${c.carrera}/objetos`);
    const dirBancoCarrera = resolve(RAIZ, `contenido/comun/banco/${c.carrera}`);
    mkdirSync(dirBancoCarrera, { recursive: true });

    // Archivar objetos existentes no activos
    const nuevosActivosIds = c.objetos.filter((o) => o.activo).map((o) => o.id);
    if (existsSync(dirObjetosCarrera)) {
      const carpetasExistentes = readdirSync(dirObjetosCarrera, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => d.name);

      for (const viejoId of carpetasExistentes) {
        if (!nuevosActivosIds.includes(viejoId)) {
          const rutaViejaImg = join(dirObjetosCarrera, viejoId, 'imagen.png');
          const rutaViejaMeta = join(dirObjetosCarrera, viejoId, 'metadata.json');
          if (existsSync(rutaViejaImg)) {
            copyFileSync(rutaViejaImg, join(dirBancoCarrera, `${viejoId}.png`));
          }
          if (existsSync(rutaViejaMeta)) {
            copyFileSync(rutaViejaMeta, join(dirBancoCarrera, `${viejoId}.json`));
          }
          rmSync(join(dirObjetosCarrera, viejoId), { recursive: true, force: true });
          console.log(`  Archivado a banco: ${c.carrera}/${viejoId}`);
        }
      }
    }

    // Incorporar los 5 objetos
    for (const o of c.objetos) {
      const dirDescargas = join(DIR_DESCARGAS, c.carrera);
      let archivoDescargado = null;
      for (const ext of ['jpg', 'jpeg', 'png', 'gif']) {
        const p = join(dirDescargas, `${o.id}.${ext}`);
        if (existsSync(p)) {
          archivoDescargado = p;
          break;
        }
      }

      if (!archivoDescargado) {
        console.warn(`  [ALERTA] Archivo descargado no encontrado para ${c.carrera}/${o.id}`);
        continue;
      }

      const meta = {
        nombre: o.nombre,
        descripcion: o.descripcion,
        figura: o.figura,
      };

      if (o.activo) {
        const dirObj = join(dirObjetosCarrera, o.id);
        mkdirSync(dirObj, { recursive: true });
        const rutaMeta = join(dirObj, 'metadata.json');
        const rutaImg = join(dirObj, 'imagen.png');

        writeFileSync(rutaMeta, JSON.stringify(meta, null, 2) + '\n', 'utf8');

        execFileSync('python3', [
          resolve(RAIZ, 'herramientas/procesar-imagenes.py'),
          archivoDescargado,
          rutaImg,
        ]);
        console.log(`  [ACTIVO] ${o.id} -> ${rutaImg}`);
      } else {
        const rutaMeta = join(dirBancoCarrera, `${o.id}.json`);
        const rutaImg = join(dirBancoCarrera, `${o.id}.png`);

        writeFileSync(rutaMeta, JSON.stringify(meta, null, 2) + '\n', 'utf8');

        execFileSync('python3', [
          resolve(RAIZ, 'herramientas/procesar-imagenes.py'),
          archivoDescargado,
          rutaImg,
        ]);
        console.log(`  [BANCO]  ${o.id} -> ${rutaImg}`);
      }
    }
  }

  // Actualizar CREDITOS.md
  if (existsSync(RUTA_MANIFEST) && !filtroCarrera) {
    const manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8'));
    let tablaCreditos = '| Archivo | Obra de origen | Autoría | Licencia |\n|---|---|---|---|\n';
    for (const c of manifest) {
      for (const o of c.objetos) {
        if (!o.commons) continue;
        const archivoDestino = o.activo
          ? `${c.carrera}/${o.id}.png`
          : `banco/${c.carrera}/${o.id}.png`;
        const tituloLimpio = o.commons.titulo.replace(/^File:/, '');
        const obra = `[${tituloLimpio}](${o.commons.paginaUrl})`;
        const autor = o.commons.autor.replace(/\|/g, '/');
        const licencia = o.commons.licencia;
        tablaCreditos += `| \`${archivoDestino}\` | ${obra} | ${autor} | ${licencia} |\n`;
      }
    }

    let creditosContenido = readFileSync(RUTA_CREDITOS, 'utf8');
    const regexObjetos = /(## Objetos[\s\S]*?\| Archivo \|[\s\S]*?\n)(## Fondos)/;
    if (regexObjetos.test(creditosContenido)) {
      creditosContenido = creditosContenido.replace(
        regexObjetos,
        `## Objetos\n\nSon **60 fotografías** (48 activas en las 12 ingenierías y 12 en el banco de reserva). A cada una se le recortó el fondo y la transparencia sobrante y se limitó el lado mayor a 768 px.\n\n${tablaCreditos}\n$2`,
      );
      writeFileSync(RUTA_CREDITOS, creditosContenido, 'utf8');
      console.log('\nCREDITOS.md actualizado con las obras de origen.');
    }
  }

  // Actualizar catálogo generado
  try {
    execFileSync('node', [
      '-e',
      "import('./servidor/catalogo.js').then(m => m.generarArchivoCatalogo())",
    ]);
    console.log('\nCatálogo generado actualizado con éxito.');
  } catch (e) {
    console.error('Error actualizando catálogo:', e.message);
  }
}

/**
 * Comando: creditos
 * Genera la tabla en formato Markdown para CREDITOS.md a partir del manifest.
 */
function cmdCreditos() {
  if (!existsSync(RUTA_MANIFEST)) {
    console.error('No se encontró objetos-manifest.json. Ejecutá primero: node herramientas/descargar-objetos.mjs buscar');
    return;
  }
  const manifest = JSON.parse(readFileSync(RUTA_MANIFEST, 'utf8'));
  console.log('\n| Archivo | Obra de origen | Autoría | Licencia |');
  console.log('|---|---|---|---|');
  for (const c of manifest) {
    for (const o of c.objetos) {
      if (!o.commons) continue;
      const archivoDestino = o.activo
        ? `${c.carrera}/${o.id}.png`
        : `banco/${c.carrera}/${o.id}.png`;
      const tituloLimpio = o.commons.titulo.replace(/^File:/, '');
      const obra = `[${tituloLimpio}](${o.commons.paginaUrl})`;
      const autor = o.commons.autor.replace(/\|/g, '/');
      const licencia = o.commons.licencia;
      console.log(`| \`${archivoDestino}\` | ${obra} | ${autor} | ${licencia} |`);
    }
  }
}

// Punto de entrada CLI
const comando = process.argv[2] || 'info';
const argCarrera = process.argv.find((a) => a.startsWith('--carrera='))?.split('=')[1];

switch (comando) {
  case 'info':
    cmdInfo();
    break;
  case 'buscar':
    await cmdBuscar(argCarrera);
    break;
  case 'descargar':
    await cmdDescargar(argCarrera);
    break;
  case 'aplicar':
    cmdAplicar(argCarrera);
    break;
  case 'incorporar':
    cmdIncorporar(argCarrera);
    break;
  case 'creditos':
    cmdCreditos();
    break;
  default:
    console.log(`Comando desconocido: "${comando}". Opciones: info, buscar, descargar, aplicar, incorporar, creditos`);
}

