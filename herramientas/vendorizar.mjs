// Copia MediaPipe al proyecto y baja los modelos.
//
// El dia del evento no hay internet: todo lo que necesita el navegador tiene que
// estar servido desde esta maquina. Este script es la unica parte del proyecto
// que pide red, y se corre una sola vez.
//
//   npm run vendorizar

import { cp, mkdir, readdir, writeFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ORIGEN = resolve(RAIZ, 'node_modules/@mediapipe/tasks-vision');
const DESTINO = resolve(RAIZ, 'vendor/mediapipe');

const MODELOS = [
  {
    archivo: 'face_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    archivo: 'hand_landmarker.task',
    url: 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
  },
];

const enMb = (bytes) => (bytes / 1024 / 1024).toFixed(1) + ' MB';

await mkdir(DESTINO, { recursive: true });

console.log('Archivos que trae el paquete:');
for (const nombre of await readdir(ORIGEN)) console.log('  -', nombre);

// Solo lo que el navegador realmente pide: el bundle ES y los WASM.
await cp(resolve(ORIGEN, 'vision_bundle.mjs'), resolve(DESTINO, 'vision_bundle.mjs'));
await cp(resolve(ORIGEN, 'wasm'), resolve(DESTINO, 'wasm'), { recursive: true });
console.log('\nCopiados vision_bundle.mjs y wasm/ a vendor/mediapipe/');

for (const modelo of MODELOS) {
  const destino = resolve(DESTINO, modelo.archivo);
  const yaEsta = await stat(destino).catch(() => null);

  if (yaEsta) {
    console.log(`${modelo.archivo}: ya estaba (${enMb(yaEsta.size)}).`);
    continue;
  }

  console.log(`Bajando ${modelo.archivo}...`);
  const respuesta = await fetch(modelo.url);
  if (!respuesta.ok) {
    throw new Error(
      `No se pudo bajar ${modelo.archivo}: ${respuesta.status}.\n` +
        `Bajalo a mano desde ${modelo.url}\n` +
        `y dejalo en vendor/mediapipe/${modelo.archivo}`,
    );
  }
  const bytes = Buffer.from(await respuesta.arrayBuffer());
  await writeFile(destino, bytes);
  console.log(`  guardado (${enMb(bytes.length)})`);
}

console.log('\nListo. A partir de aca el proyecto no necesita internet.');
