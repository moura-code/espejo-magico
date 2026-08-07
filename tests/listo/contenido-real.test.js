// EL SEMAFORO DEL PROYECTO.
//
// Estas pruebas NO corren con `npm test`. Corren con `npm run listo` y responden
// una sola pregunta: ¿se puede montar el stand?
//
// Van a estar en rojo hasta que lleguen los PNG de diseño y los videos de las
// referentes. Eso es lo esperado. El dia que pasan enteras, el contenido esta.

import { describe, it, expect } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarContenido } from '../../espejo/contenido.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = resolve(RAIZ, 'contenido');

const leer = async () => JSON.parse(await readFile(resolve(CONTENIDO, 'carreras.json'), 'utf8'));
const existe = (ruta) => access(resolve(CONTENIDO, ruta)).then(() => true, () => false);

const IDS_ESPERADOS = [
  'mecanica',
  'alimentos',
  'produccion',
  'electrica',
  'computacion',
  'agrimensura',
  'sistemas-comunicacion',
  'fisico-matematico',
  'civil',
  'quimica',
  'naval',
];

describe('contenido real', () => {
  it('pasa la validacion del sistema', async () => {
    expect(validarContenido(await leer())).toEqual([]);
  });

  it('tiene las once carreras acordadas', async () => {
    const datos = await leer();
    expect(datos.carreras.map((c) => c.id).sort()).toEqual([...IDS_ESPERADOS].sort());
  });

  it('no quedo ningun dato de relleno', async () => {
    const datos = await leer();
    for (const carrera of datos.carreras) {
      for (const referente of carrera.referentes) {
        expect(referente.nombre, `${carrera.id}: nombre de relleno`).not.toMatch(
          /Nombre Apellido|placeholder/i,
        );
        expect(referente.video, `${carrera.id}: video de prueba`).not.toMatch(/prueba/i);
      }
    }
  });

  it('cada carrera tiene al menos seis objetos', async () => {
    const datos = await leer();
    for (const carrera of datos.carreras) {
      expect(carrera.objetos.length, `${carrera.id} tiene pocos objetos`).toBeGreaterThanOrEqual(6);
    }
  });

  it('todos los colores son distintos entre si', async () => {
    const datos = await leer();
    const colores = datos.carreras.map((c) => c.color.toUpperCase());
    expect(new Set(colores).size).toBe(colores.length);
  });

  it('todos los PNG declarados existen en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      for (const ruta of [carrera.accesorio.img, ...carrera.objetos.map((o) => o.img)]) {
        if (!(await existe(ruta))) faltantes.push(ruta);
      }
    }
    expect(faltantes).toEqual([]);
  });

  it('todos los videos declarados existen en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      for (const referente of carrera.referentes) {
        if (!(await existe(referente.video))) faltantes.push(referente.video);
      }
    }
    expect(faltantes).toEqual([]);
  });

  it('MediaPipe esta copiado al proyecto', async () => {
    for (const archivo of [
      'vendor/mediapipe/vision_bundle.mjs',
      'vendor/mediapipe/face_landmarker.task',
      // Manos y pose son agregados opcionales: si faltan, el espejo arranca
      // igual y lo unico que queda es un console.warn que nadie mira el dia del
      // evento. Por eso el semaforo los pide explicitamente.
      'vendor/mediapipe/hand_landmarker.task',
      'vendor/mediapipe/pose_landmarker_full.task',
      'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
    ]) {
      const hay = await access(resolve(RAIZ, archivo)).then(() => true, () => false);
      expect(hay, `falta ${archivo} — corré npm run vendorizar`).toBe(true);
    }
  });
});
