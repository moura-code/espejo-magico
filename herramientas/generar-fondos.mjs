// Genera un fondo de respaldo para cada carrera que no tenga imagen: un
// degradado del color de la ingenieria, en las rutas que declara carreras.json.
//
// Es un PLACEHOLDER, no arte final. Existe para que el sistema entero se pueda
// ver andando —eleccion, revelacion, persona recortada contra el fondo— antes de
// que haya una sola fotografia, y para que el dia que lleguen las de verdad
// alcance con dejarlas en su ruta. Un fondo que ya existe NUNCA se pisa.
//
// A diferencia de generar-pngs, esto no necesita Chrome ni red: escribe el PNG a
// mano con zlib, que es un modulo de Node. Un degradado no justifica levantar un
// navegador.
//
//   npm run generar-fondos

import { deflateSync } from 'node:zlib';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const CONTENIDO = resolve(RAIZ, 'contenido');

// Chico a proposito: es un degradado que se escala a pantalla completa, y a
// tamaño real serian doce archivos de varios megas para tirar a la basura en
// cuanto lleguen las fotos.
const ANCHO = 540;
const ALTO = 960;

// ---------- PNG a mano ----------

const TABLA_CRC = Uint32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(datos) {
  let c = 0xffffffff;
  for (const byte of datos) c = TABLA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function trozo(tipo, datos) {
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

/** `pixeles` es RGB sin alfa, ancho*alto*3. */
function armarPng(ancho, alto, pixeles) {
  const cabecera = Buffer.alloc(13);
  cabecera.writeUInt32BE(ancho, 0);
  cabecera.writeUInt32BE(alto, 4);
  cabecera[8] = 8; // bits por canal
  cabecera[9] = 2; // color verdadero, sin alfa
  cabecera[10] = 0; // compresion
  cabecera[11] = 0; // filtro
  cabecera[12] = 0; // sin entrelazado

  // Cada fila lleva adelante su byte de filtro. Con 0 ("ninguno") el degradado
  // igual comprime a nada: son gradientes suaves.
  const conFiltro = Buffer.alloc(alto * (1 + ancho * 3));
  for (let y = 0; y < alto; y++) {
    conFiltro[y * (1 + ancho * 3)] = 0;
    pixeles.copy(conFiltro, y * (1 + ancho * 3) + 1, y * ancho * 3, (y + 1) * ancho * 3);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', cabecera),
    trozo('IDAT', deflateSync(conFiltro, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ]);
}

// ---------- el degradado ----------

const aRgb = (hex) => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

const mezclar = (a, b, t) => a + (b - a) * t;

/**
 * Diagonal del color de la carrera (arriba a la izquierda) al casi negro
 * (abajo a la derecha), con un oscurecido hacia los bordes.
 *
 * El fondo termina detras de una persona y debajo de un texto blanco: por eso
 * nunca llega al color puro —quedaria mas brillante que la cara— y por eso la
 * parte de abajo es la mas oscura, que es donde va la ficha de la persona.
 */
function degradado(ancho, alto, color) {
  const [r, g, b] = aRgb(color);
  const pixeles = Buffer.alloc(ancho * alto * 3);

  for (let y = 0; y < alto; y++) {
    for (let x = 0; x < ancho; x++) {
      const diagonal = (x / ancho + y / alto) / 2;

      // Vignette suave: mas oscuro cuanto mas lejos del centro.
      const dx = (x / ancho - 0.5) * 2;
      const dy = (y / alto - 0.5) * 2;
      const borde = 1 - Math.min(1, Math.hypot(dx, dy) / 1.6) * 0.35;

      // Del 42% del color hasta el 6%: legible como "esto es electrica" sin
      // competir con la persona que se dibuja encima.
      const fuerza = mezclar(0.42, 0.06, diagonal) * borde;
      const base = mezclar(14, 6, diagonal);

      const i = (y * ancho + x) * 3;
      pixeles[i] = Math.round(Math.min(255, base + r * fuerza));
      pixeles[i + 1] = Math.round(Math.min(255, base + g * fuerza));
      pixeles[i + 2] = Math.round(Math.min(255, base + b * fuerza));
    }
  }

  return pixeles;
}

// ---------- ----------

const existe = (ruta) => access(ruta).then(() => true, () => false);

const datos = JSON.parse(await readFile(resolve(CONTENIDO, 'carreras.json'), 'utf8'));

let generados = 0;
let salteados = 0;

for (const carrera of datos.carreras) {
  if (!carrera.fondo) continue;

  const destino = resolve(CONTENIDO, carrera.fondo);
  if (await existe(destino)) {
    salteados++;
    continue;
  }

  // El respaldo solo sabe hacer PNG. Si carreras.json pide otro formato es
  // porque alguien puso una foto de verdad y todavia no la copio: avisar es
  // mucho mejor que escribir un PNG con nombre de jpg, que Chrome muestra igual
  // y nadie descubre hasta que lo abre en otro lado.
  if (!destino.toLowerCase().endsWith('.png')) {
    console.warn(`  ${carrera.id}: "${carrera.fondo}" no es .png — dejá ahí la imagen real.`);
    salteados++;
    continue;
  }

  await mkdir(dirname(destino), { recursive: true });
  await writeFile(destino, armarPng(ANCHO, ALTO, degradado(ANCHO, ALTO, carrera.color)));
  console.log(`  ${carrera.id} → ${carrera.fondo}`);
  generados++;
}

console.log(`\n${generados} fondos generados, ${salteados} ya estaban o no son .png.`);
if (generados > 0) {
  console.log('Son placeholders: reemplazalos por las imágenes reales cuando las tengas.');
}
