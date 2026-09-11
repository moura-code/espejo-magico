// Las fichas de los objetos del fondo, con el catalogo y la CONFIG de verdad.
//
// Cada objeto de cada fondo tiene su ficha, y todas tienen que cumplir lo mismo:
// entrar enteras en la pantalla sin bajar al pie, quedarse en la franja del
// costado de su objeto —para no taparle la cara a la persona—, con el nombre y
// cada renglon adentro del panel, y sin tapar al objeto que describen ni a los
// otros objetos del fondo. Asi aparecio que "Lector de código de barras" se
// salia de la pantalla y que una de cada seis fichas tapaba a un vecino.
//
// Los objetos y lo que se le pasa a la ficha salen de las mismas funciones que
// usa el espejo (objetosDelFondo y fichaDelObjeto): armados aca por separado,
// el espejo podia cambiar el margen o el radio de la ficha y esto seguia en
// verde.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from '../../espejo/config.js';
import { calcularDisposicion, calcularRectanguloVideo, disponerFicha } from '../../espejo/escena.js';
import { objetosDelFondo, fichaDelObjeto } from '../../espejo/escondites.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ESPEJO = { ancho: 1080, alto: 1920 };
const disposicion = calcularDisposicion(ESPEJO.ancho, ESPEJO.alto);
const COLUMNA = ESPEJO.ancho * CONFIG.fichas.columna;

// Una medida proporcional al tamaño de la letra, como la de verdad: Muffaroo es
// condensada —unos 0,4 del tamaño por letra, medido sobre el TTF— y la sans del
// sistema anda por 0,52.
const medir = (texto, fuente) => {
  const tamano = Number(fuente.match(/([\d.]+)px/)[1]);
  return texto.length * tamano * (fuente.includes('Muffaroo') ? 0.4 : 0.52);
};

const tocaCirculo = (caja, { x, y, radio }) => {
  const cercaX = Math.max(caja.x, Math.min(x, caja.x + caja.ancho));
  const cercaY = Math.max(caja.y, Math.min(y, caja.y + caja.alto));
  return Math.hypot(x - cercaX, y - cercaY) < radio;
};

/**
 * Cada ficha de cada objeto de cada fondo del catalogo, dispuesta como en esa
 * pantalla: por defecto, la del espejo.
 */
async function fichasDelCatalogo(pantalla = ESPEJO) {
  const { carreras } = JSON.parse(
    await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8'),
  );
  const rectangulo = calcularRectanguloVideo(1080, 1920, pantalla.ancho, pantalla.alto);
  const enPantalla = calcularDisposicion(pantalla.ancho, pantalla.alto);

  const casos = [];
  for (const carrera of carreras) {
    for (const fondo of carrera.fondos ?? []) {
      const delFondo = objetosDelFondo({
        objetos: carrera.objetos,
        fondo,
        rectangulo,
        pantalla,
        config: CONFIG,
      });
      for (const objeto of delFondo) {
        const { circulo, opciones } = fichaDelObjeto(objeto, delFondo, pantalla.ancho, CONFIG);
        casos.push({
          nombre: `${fondo.img} · ${objeto.definicion.nombre}`,
          objeto: circulo,
          otros: opciones.evitar,
          ficha: disponerFicha(circulo, objeto.definicion, enPantalla, medir, opciones),
        });
      }
    }
  }
  return casos;
}

describe('las fichas del catalogo real', () => {
  it('cada objeto tiene su ficha', async () => {
    const sinFicha = (await fichasDelCatalogo()).filter((caso) => !caso.ficha);
    expect(sinFicha.map((caso) => caso.nombre)).toEqual([]);
  });

  it('entran enteras en la pantalla, sin bajar al pie', async () => {
    const piso = ESPEJO.alto - disposicion.pie.alto;
    const afuera = (await fichasDelCatalogo()).filter(({ ficha: { caja } }) => {
      return caja.x < 0 || caja.x + caja.ancho > ESPEJO.ancho || caja.y < 0 || caja.y + caja.alto > piso;
    });
    expect(afuera.map((caso) => caso.nombre)).toEqual([]);
  });

  // Hasta ahi no llega la persona: una ficha mas ancha le taparia la cara.
  it('se quedan en la franja del costado de su objeto', async () => {
    const adentro = (await fichasDelCatalogo()).filter(({ objeto, ficha: { caja } }) =>
      objeto.x < ESPEJO.ancho / 2
        ? caja.x + caja.ancho > COLUMNA
        : caja.x < ESPEJO.ancho - COLUMNA,
    );
    expect(adentro.map((caso) => caso.nombre)).toEqual([]);
  });

  it('el nombre y cada renglon entran en el panel', async () => {
    const salidos = [];
    for (const { nombre, ficha } of await fichasDelCatalogo()) {
      const util = ficha.caja.ancho - 2 * ficha.relleno;
      for (const linea of ficha.titulo?.lineas ?? []) {
        if (medir(linea.texto, ficha.titulo.fuente) > util) salidos.push(`${nombre}: «${linea.texto}»`);
      }
      for (const linea of ficha.lineas) {
        if (medir(linea.texto, ficha.fuenteTexto) > util) salidos.push(`${nombre}: «${linea.texto}»`);
      }
    }
    expect(salidos).toEqual([]);
  });

  // Tapar al objeto que describe deja a la ficha hablando de algo que no se ve;
  // tapar a un vecino le esconde a la persona el objeto que iba a buscar.
  it('no tapan el objeto que describen ni a los otros del fondo', async () => {
    const tapan = [];
    for (const { nombre, objeto, otros, ficha } of await fichasDelCatalogo()) {
      if (tocaCirculo(ficha.caja, objeto)) tapan.push(`${nombre} tapa su objeto`);
      for (const otro of otros) {
        if (tocaCirculo(ficha.caja, otro)) tapan.push(`${nombre} tapa a ${otro.definicion.nombre}`);
      }
    }
    expect(tapan).toEqual([]);
  });

  // En un monitor apaisado —donde se desarrolla— la composicion entra mas chica
  // y el pie es mas alto. La letra se achica con la composicion, pero alguna
  // ficha de un objeto de abajo todavia tapa al de arriba, y se acepta porque el
  // espejo del evento es vertical. Lo que no se acepta ni ahi: salirse de la
  // pantalla, bajar al pie, salir de la franja o tapar su propio objeto.
  it('en un monitor apaisado entran enteras, en su franja y sin tapar su objeto', async () => {
    const pantalla = { ancho: 1920, alto: 1080 };
    const piso = pantalla.alto - calcularDisposicion(pantalla.ancho, pantalla.alto).pie.alto;
    const columna = pantalla.ancho * CONFIG.fichas.columna;
    const problemas = [];
    for (const { nombre, objeto, ficha } of await fichasDelCatalogo(pantalla)) {
      const { caja } = ficha;
      if (caja.x < 0 || caja.x + caja.ancho > pantalla.ancho || caja.y < 0 || caja.y + caja.alto > piso) {
        problemas.push(`${nombre} afuera`);
      }
      if (objeto.x < pantalla.ancho / 2 ? caja.x + caja.ancho > columna : caja.x < pantalla.ancho - columna) {
        problemas.push(`${nombre} fuera de la franja`);
      }
      if (tocaCirculo(caja, objeto)) problemas.push(`${nombre} tapa su objeto`);
    }
    expect(problemas).toEqual([]);
  });
});
