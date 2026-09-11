// Las fichas de los objetos del fondo, con el catalogo y la CONFIG de verdad.
//
// Cada objeto de cada fondo tiene su ficha, y todas tienen que cumplir lo mismo:
// entrar enteras en la pantalla sin bajar al pie, quedarse en la franja del
// costado de su objeto —para no taparle la cara a la persona—, con el nombre y
// cada renglon adentro del panel, y sin tapar al objeto que describen ni a los
// otros objetos del fondo. Asi aparecio que "Lector de código de barras" se
// salia de la pantalla y que una de cada seis fichas tapaba a un vecino.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from '../../espejo/config.js';
import { calcularDisposicion, calcularRectanguloVideo, disponerFicha } from '../../espejo/escena.js';
import { lugarEnPantalla } from '../../espejo/vuelo.js';
import { lugaresDelFondo, esconder } from '../../espejo/escondites.js';
import { objetoDeCarrera, escondidosDeCarrera } from '../../espejo/contenido.js';

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

/** Cada ficha de cada objeto de cada fondo del catalogo, dispuesta como en el espejo. */
async function fichasDelCatalogo() {
  const { carreras } = JSON.parse(
    await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8'),
  );
  const rectangulo = calcularRectanguloVideo(1080, 1920, ESPEJO.ancho, ESPEJO.alto);
  const porDefecto = {
    lugar: CONFIG.fondo.lugarPorDefecto,
    escondites: CONFIG.fondo.esconditesPorDefecto,
  };

  const casos = [];
  for (const carrera of carreras) {
    for (const fondo of carrera.fondos ?? []) {
      const [lugar, ...escondites] = lugaresDelFondo(fondo, porDefecto);
      const objetos = [
        { definicion: objetoDeCarrera(carrera), lugar },
        ...esconder(escondidosDeCarrera(carrera), escondites),
      ].map(({ definicion, lugar: donde }) => ({
        definicion,
        ...lugarEnPantalla(donde, rectangulo, ESPEJO, CONFIG.fondo.margenDelLugar),
      }));

      objetos.forEach((objeto, i) => {
        const otros = objetos.filter((_, j) => j !== i);
        // Se dispone contra el objeto ya crecido, como en el espejo.
        const leido = { x: objeto.x, y: objeto.y, radio: objeto.radio * (1 + CONFIG.escondidos.resalte) };
        casos.push({
          nombre: `${fondo.img} · ${objeto.definicion.nombre}`,
          objeto: leido,
          otros,
          ficha: disponerFicha(leido, objeto.definicion, disposicion, medir, {
            columna: COLUMNA,
            evitar: otros,
            tipografia: CONFIG.fichas.tipografia,
          }),
        });
      });
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
});
