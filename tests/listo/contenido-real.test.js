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


// MAITE puede estar adentro del proyecto o al lado, que es como suele quedar al
// clonar los dos repos juntos. Se prueban las dos: buscando en una sola, el
// cotejo se salteaba en silencio y este semaforo daba verde con ids que del
// otro lado no existian — que es justo lo que vino a evitar.
const carrerasDeMaite = async () => {
  for (const donde of ['MAITE/data/carreras.json', '../maite/data/carreras.json']) {
    const ruta = resolve(RAIZ, donde);
    if (await access(ruta).then(() => true, () => false)) {
      return JSON.parse(await readFile(ruta, 'utf8'));
    }
  }
  return null; // MAITE no esta clonado: no hay nada que cotejar.
};

describe('contenido real', () => {
  it('pasa la validacion del sistema', async () => {
    expect(validarContenido(await leer())).toEqual([]);
  });

  it('tiene las doce carreras acordadas', async () => {
    const datos = await leer();
    expect(datos.carreras.map((c) => c.id).sort()).toEqual([...IDS_ESPERADOS].sort());
  });

  // CUATRO OBJETOS POR INGENIERIA, CADA UNO CON SU FICHA: uno para el carrusel
  // y tres escondidos en el fondo, como pidio la catedra. Sin nombre o sin
  // descripcion, pasar la mano por encima no dice nada; y una descripcion larga
  // no entra en la ficha sin taparle media pantalla a la persona.
  it('cada carrera tiene cuatro objetos, cada uno con su nombre y una descripcion corta', async () => {
    const flojos = [];
    for (const carrera of (await leer()).carreras) {
      if (carrera.objetos.length !== 4) {
        flojos.push(`${carrera.id} tiene ${carrera.objetos.length} objetos, no cuatro`);
      }
      for (const objeto of carrera.objetos) {
        if (!objeto.nombre?.trim()) flojos.push(`${objeto.img} sin "nombre"`);
        if (!objeto.descripcion?.trim()) flojos.push(`${objeto.img} sin "descripcion"`);
        else if (objeto.descripcion.length > 130) {
          flojos.push(`${objeto.img}: ${objeto.descripcion.length} caracteres (130 como mucho)`);
        }
      }
    }
    expect(flojos).toEqual([]);
  });

  it('todos los PNG declarados existen en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      for (const ruta of carrera.objetos.map((o) => o.img)) {
        if (!(await existe(ruta))) faltantes.push(ruta);
      }
    }
    expect(faltantes).toEqual([]);
  });

  // El respaldo vectorial se llama exactamente como la carrera y lo genera
  // `npm run generar-fondos`: es un placeholder, no una opcion para elegir.
  const esRespaldoVectorial = (carrera, fondo) =>
    fondo.img === `assets/fondos/${carrera.id}.png`;

  // Sin fondo, la escena cae al color plano de la carrera. Se ve, pero es lo
  // que se supone que reemplaza la foto de la ingenieria. Y todo candidato
  // declarado tiene que estar: la herramienta de eleccion los muestra todos.
  it('cada carrera tiene su fondo activo, y todos los candidatos estan en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      if (!carrera.fondos?.length) faltantes.push(`${carrera.id} (sin declarar)`);
      for (const fondo of carrera.fondos ?? []) {
        if (!(await existe(fondo.img))) faltantes.push(fondo.img);
      }
    }
    expect(faltantes, 'corré npm run generar-fondos o dejá las imágenes reales').toEqual([]);
  });

  // Por ahora cada carrera tiene UNA escena definitiva. Conservamos `fondos`
  // como lista para poder sumar candidatas despues, pero el stand no conserva
  // las fotografias anteriores ni sus respaldos vectoriales.
  it('cada carrera tiene una sola imagen de fondo activa', async () => {
    const repetidas = [];
    for (const carrera of (await leer()).carreras) {
      const declaradas = carrera.fondos ?? [];
      if (declaradas.length !== 1) repetidas.push(`${carrera.id} (${declaradas.length})`);
    }
    expect(repetidas, 'cada carrera debe tener una sola imagen de fondo por ahora').toEqual([]);
  });

  // El objeto agarrado vuela a `lugar` y se queda ahi, integrado a la escena.
  // Sin declararlo cae en CONFIG.fondo.lugarPorDefecto, que es un seguro del
  // codigo y no una decision: en una foto cualquiera termina sobre el cielo
  // blanco o encima de la cara. Se elige mirando, en herramientas/fondos.html.
  it('cada fondo dice donde se apoya el objeto', async () => {
    const sinLugar = [];
    for (const carrera of (await leer()).carreras) {
      for (const fondo of carrera.fondos ?? []) {
        if (!esRespaldoVectorial(carrera, fondo) && !fondo.lugar) sinLugar.push(fondo.img);
      }
    }
    expect(sinLugar, 'estos fondos no declaran "lugar"').toEqual([]);
  });

  // Y donde esconde a los otros tres. Sin escondites caen en los de config,
  // que son un seguro del codigo y no una decision: en una foto cualquiera
  // terminan sobre algo que no corresponde. Que caigan en la periferia lo
  // vigila tests/integracion/fondos.test.js.
  it('cada fondo declara donde esconde los otros objetos de la carrera', async () => {
    const faltan = [];
    for (const carrera of (await leer()).carreras) {
      const necesarios = carrera.objetos.length - 1;
      for (const fondo of carrera.fondos ?? []) {
        if (esRespaldoVectorial(carrera, fondo)) continue;
        const declarados = (fondo.escondites ?? []).length;
        if (declarados < necesarios) faltan.push(`${fondo.img} (${declarados} de ${necesarios})`);
      }
    }
    expect(faltan, 'estos fondos no tienen donde esconder todos los objetos').toEqual([]);
  });

  // Un fondo con movimiento declara `video` ademas de su foto. Si el archivo no
  // esta, el espejo muestra la foto y no se rompe nada —pero el fondo quedo
  // quieto y nadie se entera hasta que alguien lo mira de cerca en el stand.
  it('los videos de fondo declarados estan en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      for (const fondo of carrera.fondos ?? []) {
        if (fondo.video && !(await existe(fondo.video))) faltantes.push(fondo.video);
      }
    }
    expect(faltantes, 'un fondo declara un video que no esta: se va a ver la foto').toEqual([]);
  });

  // La transicion entera depende de este archivo. Es un agregado opcional en
  // codigo —el espejo arranca sin el— pero el dia del evento tiene que estar.
  it('el video de humo esta copiado al contenido', async () => {
    expect(await existe('assets/humo.mp4'), 'falta contenido/assets/humo.mp4').toBe(true);
  });

  // Si falta, el espejo cae a la sans del sistema sin decir nada y deja de
  // leerse como una misma instalacion con las tablets — que es exactamente
  // para lo que se copio la tipografia. La nota de licencia viaja con el
  // archivo: Muffaroo se declara "free for personal use only" y la facultad
  // tiene que saberlo.
  it('la tipografia de las tablets de MAITE esta copiada, con su nota de licencia', async () => {
    for (const archivo of [
      'assets/tipografias/Muffaroo-Regular.ttf',
      'assets/tipografias/Muffaroo-LEEME.txt',
    ]) {
      expect(await existe(archivo), `falta contenido/${archivo}`).toBe(true);
    }
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

  // Con muy pocas, el carrusel es un anillo casi vacio y girar no tiene sentido.
  it('hay carreras jugables suficientes para que el carrusel sea un carrusel', async () => {
    const jugables = (await leer()).carreras.filter((c) => c.maite);
    expect(jugables.length, 'faltan videos en MAITE para llenar el carrusel')
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
