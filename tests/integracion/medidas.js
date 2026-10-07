// Cuanto mide de verdad cada foto del catalogo, leido de su encabezado. Sin
// dependencias: un JPEG y un PNG dicen su medida en los primeros bytes.
//
// Las pruebas de integracion necesitan saberlo porque las fotos ya no son todas
// de la misma medida: las generadas son verticales (1080x1920), y una foto real
// de un laboratorio puede ser apaisada. Donde cae cada objeto en la pantalla
// sale del rectangulo donde se dibuja SU foto, y una cuenta con la medida de
// otra pone los blancos en cualquier lado.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const CONTENIDO = resolve(dirname(fileURLToPath(import.meta.url)), '../../contenido');

function medidasDeUnPng(bytes) {
  return { ancho: bytes.readUInt32BE(16), alto: bytes.readUInt32BE(20) };
}

function medidasDeUnJpeg(bytes) {
  let i = 2;
  while (i < bytes.length) {
    if (bytes[i] !== 0xff) throw new Error('JPEG mal formado');
    const marcador = bytes[i + 1];
    // Los SOF (comienzo del cuadro) traen la medida; C4, C8 y CC son otra cosa.
    if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
      return { ancho: bytes.readUInt16BE(i + 7), alto: bytes.readUInt16BE(i + 5) };
    }
    i += 2 + bytes.readUInt16BE(i + 2);
  }
  throw new Error('JPEG sin medida');
}

/** `{ ancho, alto }` de una imagen del contenido, por su ruta del catalogo. */
export function medidasDeLaFoto(ruta) {
  const bytes = readFileSync(resolve(CONTENIDO, ruta));
  const esPng = bytes.readUInt32BE(0) === 0x89504e47;
  return esPng ? medidasDeUnPng(bytes) : medidasDeUnJpeg(bytes);
}
