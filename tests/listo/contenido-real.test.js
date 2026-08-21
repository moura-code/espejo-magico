// EL SEMAFORO DEL PROYECTO.
//
// Estas pruebas NO corren con `npm test`. Corren con `npm run listo` y responden
// una sola pregunta: ¿se puede montar el stand?
//
// Van a estar en rojo mientras falte contenido real (los PNG definitivos de
// diseño, MediaPipe sin vendorizar). El dia que pasan enteras, el stand se monta.

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
  'electrica',
  'computacion',
  'fisico-matematico',
  'civil',
  'quimica',
  'alimentos',
  'produccion',
  'agrimensura',
  'comunicacion',
  'forestal',
  'naval',
];

// El texto que deja npm run generar-fondos y el que trae carreras.json de
// fabrica. Mientras alguno siga puesto, el contenido no esta hecho.
const NOMBRE_PLACEHOLDER = 'Nombre y Apellido';

const carrerasDeMaite = async () => {
  const ruta = resolve(RAIZ, 'MAITE/data/carreras.json');
  const hay = await access(ruta).then(() => true, () => false);
  return hay ? JSON.parse(await readFile(ruta, 'utf8')) : null;
};

describe('contenido real', () => {
  it('pasa la validacion del sistema', async () => {
    expect(validarContenido(await leer())).toEqual([]);
  });

  it('tiene las doce carreras acordadas', async () => {
    const datos = await leer();
    expect(datos.carreras.map((c) => c.id).sort()).toEqual([...IDS_ESPERADOS].sort());
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
      const rutas = [
        ...carrera.objetos.map((o) => o.img),
        ...(carrera.objeto ? [carrera.objeto.img] : []),
      ];
      for (const ruta of rutas) {
        if (!(await existe(ruta))) faltantes.push(ruta);
      }
    }
    expect(faltantes).toEqual([]);
  });

  // Sin fondo, la revelacion cae al color plano de la carrera. Se ve, pero es
  // lo que se supone que reemplaza la foto de la ingenieria.
  it('cada carrera tiene su fondo en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      if (!carrera.fondo) faltantes.push(`${carrera.id} (sin declarar)`);
      else if (!(await existe(carrera.fondo))) faltantes.push(carrera.fondo);
    }
    expect(faltantes, 'corré npm run generar-fondos o dejá las imágenes reales').toEqual([]);
  });

  // La transicion entera depende de este archivo. Es un agregado opcional en
  // codigo —el espejo arranca sin el— pero el dia del evento tiene que estar.
  it('el video de humo esta copiado al contenido', async () => {
    expect(await existe('assets/humo.mp4'), 'falta contenido/assets/humo.mp4').toBe(true);
  });

  // EL QUE MAS IMPORTA DE TODO EL SEMAFORO. Los nombres y textos de fabrica se
  // ven perfectos en pantalla: si nadie los reemplaza, el espejo del evento le
  // muestra a cada visitante "Nombre y Apellido" y nadie lo descubre hasta que
  // hay publico delante.
  it('ninguna persona quedo con el texto de fabrica', async () => {
    const datos = await leer();
    const sinEscribir = datos.carreras
      .filter((c) => c.persona?.nombre === NOMBRE_PLACEHOLDER || /^Escribí acá/.test(c.persona?.texto ?? ''))
      .map((c) => c.id);
    expect(sinEscribir, 'faltan los nombres y textos reales en contenido/carreras.json').toEqual([]);
  });

  // Una carrera con `maite` apuntando a un id que del otro lado no existe se
  // elige, el POST vuelve 400 y las tablets se quedan en humo. Es exactamente
  // el sintoma mas dificil de diagnosticar el dia del evento.
  it('cada "maite" declarado existe del otro lado', async () => {
    const deMaite = await carrerasDeMaite();
    if (!deMaite) return; // MAITE no esta clonado: no hay nada que cotejar.

    const idsDeMaite = new Set(deMaite.map((c) => c.id));
    const huerfanas = (await leer()).carreras
      .filter((c) => c.maite && !idsDeMaite.has(c.maite))
      .map((c) => `${c.id} -> ${c.maite}`);
    expect(huerfanas).toEqual([]);
  });

  it('hay al menos una carrera jugable', async () => {
    const jugables = (await leer()).carreras.filter((c) => c.maite).map((c) => c.id);
    expect(jugables.length, 'ninguna carrera tiene "maite": las tablets no se van a mover')
      .toBeGreaterThanOrEqual(1);
  });

  // Con menos de cinco, la eleccion ofrece menos objetos de los que dice
  // CONFIG.eleccion.cantidad y el arco queda a medio llenar.
  it('hay carreras jugables suficientes para llenar la eleccion', async () => {
    const jugables = (await leer()).carreras.filter((c) => c.maite);
    expect(jugables.length, 'faltan videos en MAITE para llenar los cinco objetos')
      .toBeGreaterThanOrEqual(5);
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
