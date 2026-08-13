// Genera un PNG de respaldo para cada objeto que no tenga imagen, a partir de
// su figura vectorial.
//
// Los dibuja el propio Chrome de la maquina (el mismo que corre el espejo) en
// modo sin cabeza: las figuras usan la API de canvas y tipografias del sistema,
// que Node no tiene. El resultado queda en contenido/assets/ con fondo
// transparente, en las rutas que declara carreras.json. Un PNG que ya existe
// NUNCA se pisa: los objetos reales (ver contenido/assets/CREDITOS.md) y los
// definitivos de diseño tienen prioridad; para regenerar un respaldo, primero
// borra el archivo.
//
// No pide red: levanta el servidor del proyecto en un puerto libre y Chrome
// lee todo de localhost.
//
//   npm run generar-pngs

import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearServidor } from '../servidor/servidor.js';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTENIDO = resolve(RAIZ, 'contenido');
const PREFIJO_PNG = 'data:image/png;base64,';

// Las mismas rutas que prueba herramientas/arrancar.bat, mas la variable de
// entorno CHROME para las maquinas que lo tengan en otro lado.
const CANDIDATOS = [
  process.env.CHROME,
  process.env.ProgramFiles && join(process.env.ProgramFiles, 'Google/Chrome/Application/chrome.exe'),
  process.env['ProgramFiles(x86)'] &&
    join(process.env['ProgramFiles(x86)'], 'Google/Chrome/Application/chrome.exe'),
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'Google/Chrome/Application/chrome.exe'),
].filter(Boolean);

async function encontrarChrome() {
  for (const candidato of CANDIDATOS) {
    if (await access(candidato).then(() => true, () => false)) return candidato;
  }
  throw new Error('No se encontro Chrome. Instalalo o indica su ruta en la variable CHROME.');
}

// El perfil propio y descartable evita chocar con un Chrome ya abierto, que
// tiene tomado el perfil por defecto.
function correrChrome(chrome, perfil, url) {
  return new Promise((listo, falla) => {
    const proceso = spawn(
      chrome,
      [
        '--headless',
        '--disable-gpu',
        `--user-data-dir=${perfil}`,
        '--no-first-run',
        '--no-default-browser-check',
        '--virtual-time-budget=15000',
        '--dump-dom',
        url,
      ],
      { windowsHide: true },
    );

    let dom = '';
    proceso.stdout.on('data', (trozo) => {
      dom += trozo;
    });
    proceso.on('error', falla);
    proceso.on('close', (codigo) => {
      if (codigo === 0) listo(dom);
      else falla(new Error(`Chrome termino con codigo ${codigo}`));
    });
  });
}

// El <pre> llega serializado como HTML: alcanza con deshacer las entidades que
// la serializacion escapa dentro de un nodo de texto.
const desescapar = (texto) =>
  texto.replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

const enKb = (bytes) => (bytes / 1024).toFixed(1) + ' KB';

const chrome = await encontrarChrome();
const perfil = await mkdtemp(join(tmpdir(), 'espejo-pngs-'));
const servidor = crearServidor();
const puerto = await servidor.escuchar(0);

try {
  const dom = await correrChrome(
    chrome,
    perfil,
    `http://localhost:${puerto}/herramientas/generar-pngs.html`,
  );

  const coincidencia = /@@SALIDA@@(.*?)@@FIN@@/s.exec(dom);
  if (!coincidencia) {
    throw new Error(
      'La pagina no dejo su salida en el DOM. Abri herramientas/generar-pngs.html ' +
        'desde npm start y mira la consola para ver que fallo.',
    );
  }

  const { pngs, avisos } = JSON.parse(desescapar(coincidencia[1]));
  for (const aviso of avisos) console.warn('AVISO:', aviso);

  let total = 0;
  let omitidos = 0;
  for (const [ruta, dataUrl] of Object.entries(pngs)) {
    if (!dataUrl.startsWith(PREFIJO_PNG)) {
      throw new Error(`${ruta}: la pagina devolvio algo que no es un PNG`);
    }
    const destino = resolve(CONTENIDO, ruta);
    if (!destino.startsWith(CONTENIDO + sep)) {
      throw new Error(`${ruta}: la ruta se sale de contenido/`);
    }

    if (await access(destino).then(() => true, () => false)) {
      omitidos += 1;
      continue;
    }

    const bytes = Buffer.from(dataUrl.slice(PREFIJO_PNG.length), 'base64');
    await mkdir(dirname(destino), { recursive: true });
    await writeFile(destino, bytes);
    total += 1;
    console.log(`contenido/${ruta}  (${enKb(bytes.length)})`);
  }

  console.log(
    `\n${total} PNG de respaldo generados; ${omitidos} objetos ya tenian imagen y no se tocaron.`,
  );
} finally {
  await servidor.cerrar();
  await rm(perfil, { recursive: true, force: true }).catch(() => {});
}
