// El lugar del objeto en cada fondo, contra el contenido real.
//
// Las fotos de fondo se preparan en 1080x1920, la medida del espejo vertical, y
// el `lugar` de cada una se eligio mirando a esa medida (herramientas/fondos.html).
// Esta prueba fija dos cosas. Una: en el espejo, lo elegido entra entero y el
// codigo no lo mueve — es la decision de la catedra. Y otra: en un monitor
// apaisado, donde el recorte se lleva el rincon de arriba de la foto, el objeto
// aparece igual en pantalla. Fue un bug de verdad: en desarrollo el objeto
// volaba a un punto arriba del borde y "desaparecia" en las doce ingenierias.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from '../../espejo/config.js';
import { calcularRectanguloVideo } from '../../espejo/escena.js';
import { lugarEnPantalla } from '../../espejo/vuelo.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// La medida en que se preparan los fondos (docs/contenido.md).
const FOTO = { ancho: 1080, alto: 1920 };
const ESPEJO = { ancho: 1080, alto: 1920 };
const APAISADA = { ancho: 1920, alto: 1080 };

const fondosConLugar = async () => {
  const crudo = await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8');
  return JSON.parse(crudo).carreras.flatMap((carrera) =>
    (carrera.fondos ?? []).filter((fondo) => fondo.lugar),
  );
};

const entraEntero = ({ x, y, radio }, pantalla) =>
  x - radio >= 0 && x + radio <= pantalla.ancho && y - radio >= 0 && y + radio <= pantalla.alto;

const puestoEn = (fondo, pantalla) => {
  const rectangulo = calcularRectanguloVideo(FOTO.ancho, FOTO.alto, pantalla.ancho, pantalla.alto);
  return lugarEnPantalla(fondo.lugar, rectangulo, pantalla, CONFIG.fondo.margenDelLugar);
};

describe('el lugar del objeto en los fondos reales', () => {
  it('en el espejo vertical, cada lugar elegido entra entero y no se mueve', async () => {
    const movidos = [];
    for (const fondo of await fondosConLugar()) {
      const puesto = puestoEn(fondo, ESPEJO);
      const crudo = { x: fondo.lugar.x * ESPEJO.ancho, y: fondo.lugar.y * ESPEJO.alto };
      if (Math.abs(puesto.x - crudo.x) > 1e-6 || Math.abs(puesto.y - crudo.y) > 1e-6) {
        movidos.push(fondo.img);
      }
    }
    expect(movidos, 'estos lugares quedan tan al borde que el codigo los corre').toEqual([]);
  });

  it('en un monitor apaisado, el objeto aparece igual en pantalla', async () => {
    const fuera = [];
    for (const fondo of await fondosConLugar()) {
      if (!entraEntero(puestoEn(fondo, APAISADA), APAISADA)) fuera.push(fondo.img);
    }
    expect(fuera, 'el objeto aterriza fuera de la pantalla apaisada').toEqual([]);
  });
});
