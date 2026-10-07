// Las fichas de los objetos del fondo, con el catalogo y la CONFIG de verdad.
//
// Hay dos clases de ficha, y cual le toca a cada objeto lo decide el fondo
// (fichaDelObjeto). Las dos tienen que cumplir lo mismo en lo que importa: la
// descripcion entera adentro del panel, con la letra que pide la config
// —achicarse es el seguro, no el plan—, y sin tapar a ninguno de los objetos
// del fondo, tampoco al que se esta leyendo.
//
//   - EN EL CARTEL DE ARRIBA DE LA CABEZA, cuando los objetos son PNGs sueltos
//     repartidos por la periferia. Es la unica franja que no le tapa la cara a
//     nadie: al costado de su objeto, "Lector de código de barras" se salia de
//     la pantalla, una de cada seis fichas tapaba a un vecino y con la letra
//     grande ya no entraban.
//   - DEBAJO DE SU OBJETO, cuando el objeto vive adentro de la foto (un fondo
//     generado). Ahi de cual habla ya no hay que adivinarlo —el objeto se
//     levanta de la escena— pero el texto tiene que estar pegado a el, y el
//     cartel se corre hacia el centro si abajo le tapa al vecino de la columna.
//
// Los objetos y lo que se le pasa a la ficha salen de las mismas funciones que
// usa el espejo (objetosDelFondo, fichaDelObjeto y disponerFichaDeObjeto):
// armados aca por separado, el espejo podia cambiar el margen o el radio de la
// ficha y esto seguia en verde.

import { describe, it, expect } from 'vitest';

import { CONFIG } from '../../espejo/config.js';
import {
  calcularDisposicion,
  calcularRectanguloDelFondo,
  disponerFichaDeObjeto,
} from '../../espejo/escena.js';
import { objetosDelFondo, fichaDelObjeto } from '../../espejo/escondites.js';
import { construirCatalogo } from '../../servidor/catalogo.js';
import { medidasDeLaFoto } from './medidas.js';

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
  const { catalogo, errores } = await construirCatalogo();
  if (errores.length > 0) throw new Error(`Errores en catálogo: ${errores.join(', ')}`);
  const { carreras } = catalogo;
  const enPantalla = calcularDisposicion(pantalla.ancho, pantalla.alto);

  const casos = [];
  for (const carrera of carreras) {
    for (const fondo of carrera.fondos ?? []) {
      // Cada foto con su medida: las generadas son verticales, y una foto real
      // puede ser apaisada.
      const foto = medidasDeLaFoto(fondo.img);
      const rectangulo = calcularRectanguloDelFondo(foto.ancho, foto.alto, pantalla.ancho, pantalla.alto);
      const delFondo = objetosDelFondo({
        objetos: carrera.objetos,
        fondo,
        rectangulo,
        pantalla,
        config: CONFIG,
      });
      for (const objeto of delFondo) {
        const otros = delFondo.filter((otro) => otro.id !== objeto.id);
        const { circulo, opciones } = fichaDelObjeto(objeto, pantalla, CONFIG, otros);
        casos.push({
          nombre: `${fondo.img} · ${objeto.definicion.nombre}`,
          debajo: Boolean(opciones.ancla),
          objeto: circulo,
          otros,
          hasta: opciones.hasta,
          ficha: disponerFichaDeObjeto(objeto.definicion, enPantalla, medir, opciones),
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

  // En un monitor apaisado —donde se desarrolla— la composicion entra mas chica
  // y el cartel con ella, y tiene que cumplir lo mismo.
  for (const [donde, pantalla] of [
    ['en el espejo', ESPEJO],
    ['en un monitor apaisado', APAISADA],
  ]) {
    it(`${donde}, entran enteras en la pantalla`, async () => {
      const afuera = (await fichasDelCatalogo(pantalla)).filter(({ ficha: { caja } }) => {
        return (
          caja.x < 0 ||
          caja.x + caja.ancho > pantalla.ancho ||
          caja.y < 0 ||
          caja.y + caja.alto > pantalla.alto
        );
      });
      expect(afuera.map((caso) => caso.nombre)).toEqual([]);
    });

    // La franja de arriba de la cabeza es la unica que no le tapa la cara a
    // nadie: la ficha del cartel no puede bajar de ahi.
    it(`${donde}, las del cartel no bajan hasta la cara`, async () => {
      const bajas = (await fichasDelCatalogo(pantalla))
        .filter((caso) => !caso.debajo)
        .filter(({ hasta, ficha: { caja } }) => caja.y + caja.alto > hasta);
      expect(bajas.map((caso) => caso.nombre)).toEqual([]);
    });

    // EL PIE ES DEL NOMBRE DE LA INGENIERIA, y se dibuja despues que las
    // fichas: una ficha que baje hasta ahi queda con medio texto tapado.
    it(`${donde}, ninguna baja hasta el nombre de la ingenieria`, async () => {
      const { pie } = calcularDisposicion(pantalla.ancho, pantalla.alto);
      const bajas = (await fichasDelCatalogo(pantalla)).filter(
        ({ ficha: { caja } }) => caja.y + caja.alto > pantalla.alto - pie.alto,
      );
      expect(bajas.map((caso) => caso.nombre)).toEqual([]);
    });

    // La ficha que va debajo tiene que quedar PEGADA a su objeto: si se fuera
    // al otro extremo de la pantalla seria el cartel de arriba, pero peor.
    it(`${donde}, las de debajo quedan al lado de su objeto`, async () => {
      const lejos = (await fichasDelCatalogo(pantalla))
        .filter((caso) => caso.debajo)
        .filter(({ objeto, ficha: { caja } }) => {
          const cercaX = Math.max(caja.x, Math.min(objeto.x, caja.x + caja.ancho));
          const cercaY = Math.max(caja.y, Math.min(objeto.y, caja.y + caja.alto));
          return Math.hypot(objeto.x - cercaX, objeto.y - cercaY) > objeto.radio * 2.2;
        });
      expect(lejos.map((caso) => caso.nombre)).toEqual([]);
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

  // Achicar la letra es el seguro para una descripcion que no entra. Con el
  // catalogo de verdad no puede hacer falta: si hiciera, la letra de la config
  // estaria prometiendo algo que el espejo no muestra.
  it('en el espejo van con la letra que pide la config, sin achicarse', async () => {
    const pedida = Math.round(
      calcularDisposicion(1080, 1920).texto.tamanoFrase * CONFIG.fichas.tipografia.texto,
    );
    const achicadas = (await fichasDelCatalogo()).filter(
      ({ ficha }) => px(ficha.fuenteTexto) !== pedida,
    );
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
