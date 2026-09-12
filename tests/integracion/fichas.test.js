// Las fichas de los objetos del fondo, con el catalogo y la CONFIG de verdad.
//
// La ficha va en un cartel ancho arriba de la cabeza (disponerFicha). Todas las
// del catalogo tienen que cumplir lo mismo: entrar enteras en esa franja sin
// bajar hasta la cara, con la letra que pide la config —achicarse es el
// seguro, no el plan—, con el nombre y cada renglon adentro del panel, y sin
// tapar a ninguno de los objetos del fondo, tampoco al que se esta leyendo, que
// crece. Al costado de su objeto, en la franja angosta de la periferia, "Lector
// de código de barras" se salia de la pantalla, una de cada seis fichas tapaba
// a un vecino y con la letra grande ya no entraban.
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
const APAISADA = { ancho: 1920, alto: 1080 };

// Una medida proporcional al tamaño de la letra, como la de verdad: Muffaroo es
// condensada —unos 0,4 del tamaño por letra, medido sobre el TTF— y la sans del
// sistema anda por 0,52.
const medir = (texto, fuente) => {
  const tamano = Number(fuente.match(/([\d.]+)px/)[1]);
  return texto.length * tamano * (fuente.includes('Muffaroo') ? 0.4 : 0.52);
};
const px = (fuente) => Number(fuente.match(/([\d.]+)px/)[1]);

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
        const { circulo, opciones } = fichaDelObjeto(objeto, pantalla, CONFIG);
        casos.push({
          nombre: `${fondo.img} · ${objeto.definicion.nombre}`,
          objeto: circulo,
          otros: delFondo.filter((otro) => otro.id !== objeto.id),
          hasta: opciones.hasta,
          ficha: disponerFicha(objeto.definicion, enPantalla, medir, opciones),
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

  // La franja de arriba de la cabeza es la unica que no le tapa la cara a
  // nadie. En un monitor apaisado —donde se desarrolla— la composicion entra
  // mas chica y el cartel con ella, y tiene que cumplir lo mismo.
  for (const [donde, pantalla] of [
    ['en el espejo', ESPEJO],
    ['en un monitor apaisado', APAISADA],
  ]) {
    it(`${donde}, entran enteras arriba sin bajar hasta la cara`, async () => {
      const afuera = (await fichasDelCatalogo(pantalla)).filter(({ hasta, ficha: { caja } }) => {
        return caja.x < 0 || caja.x + caja.ancho > pantalla.ancho || caja.y < 0 || caja.y + caja.alto > hasta;
      });
      expect(afuera.map((caso) => caso.nombre)).toEqual([]);
    });

    // Tapar al objeto que describe deja a la ficha hablando de algo que no se
    // ve; tapar a otro le esconde a la persona el objeto que iba a buscar.
    it(`${donde}, no tapan a ninguno de los objetos del fondo`, async () => {
      const tapan = [];
      for (const { nombre, objeto, otros, ficha } of await fichasDelCatalogo(pantalla)) {
        if (tocaCirculo(ficha.caja, objeto)) tapan.push(`${nombre} tapa su objeto`);
        for (const otro of otros) {
          if (tocaCirculo(ficha.caja, otro)) tapan.push(`${nombre} tapa a ${otro.definicion.nombre}`);
        }
      }
      expect(tapan).toEqual([]);
    });
  }

  // Achicar la letra es el seguro de disponerFicha para una descripcion que no
  // entra. Con el catalogo de verdad no puede hacer falta: si hiciera, la letra
  // de la config estaria prometiendo algo que el espejo no muestra.
  it('en el espejo van con la letra que pide la config, sin achicarse', async () => {
    const pedida = Math.round(calcularDisposicion(1080, 1920).texto.tamanoFrase * CONFIG.fichas.tipografia.texto);
    const achicadas = (await fichasDelCatalogo()).filter(({ ficha }) => px(ficha.fuenteTexto) !== pedida);
    expect(achicadas.map((caso) => caso.nombre)).toEqual([]);
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
});
