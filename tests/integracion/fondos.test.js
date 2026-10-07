// Donde caen los objetos de cada fondo, contra el contenido real.
//
// Cada fondo tiene cinco objetos: el que llega volando del carrusel a su
// `lugar` y los otros cuatro en sus `escondites`. Las fotos se preparan en
// 1080x1920, la medida del espejo vertical, y los lugares se eligen mirando a
// esa medida (herramientas/fondos.html). Esta prueba fija lo que tiene que valer
// para todos, con el catalogo y la CONFIG de verdad, y con la misma cuenta con
// la que el espejo los pone en pantalla (objetosDelFondo):
//
//   - en el espejo, lo elegido entra entero y el codigo no lo mueve;
//   - ningun objeto cae en la zona de la persona ni baja hasta el nombre: la
//     catedra pidio la periferia, para que no coincidan con su imagen;
//   - ninguno sube a la franja de arriba de la cabeza, que es del cartel de las
//     fichas;
//   - los blancos de la mano de dos objetos no se tocan: yendo a buscar uno no
//     se abre el de al lado;
//   - la mano de la persona llega a los cinco, con margen;
//   - el blanco de la mano de un objeto pintado adentro de la foto esta donde
//     se ve el objeto, en cualquier pantalla;
//   - en un monitor apaisado —desarrollo— todos aparecen en pantalla y siguen
//     sin pisarse. Fue un bug de verdad, dos veces: el objeto volaba a un punto
//     arriba del borde y "desaparecia" en las doce ingenierias, y despues los
//     pintados en la foto quedaban afuera porque la foto cubria la pantalla.
//
// UN FONDO FOTOGRAFIADO NO ENTRA EN LAS REGLAS DE LA COMPOSICION. Es una foto
// real con los objetos adentro: estan donde los dejo la foto, no donde los puso
// el codigo o el generador, y moverlos es tomar otra foto. Lo que se vigila de
// el es que la mano los encuentre ahi y que el que llega volando caiga justo
// encima del suyo (abajo, al final).

import { describe, it, expect } from 'vitest';

import { CONFIG } from '../../espejo/config.js';
import {
  calcularDisposicion,
  calcularRectanguloDelFondo,
  cajaEnPantalla,
} from '../../espejo/escena.js';
import { lugaresDelFondo, objetosDelFondo } from '../../espejo/escondites.js';
import { objetosEnLaFoto } from '../../espejo/contenido.js';
import { construirCatalogo } from '../../servidor/catalogo.js';
import { medidasDeLaFoto } from './medidas.js';

const ESPEJO = { ancho: 1080, alto: 1920 };
const APAISADA = { ancho: 1920, alto: 1080 };
// La ventana de una notebook, donde se prueba: otra proporcion que la del monitor.
const NOTEBOOK = { ancho: 1512, alto: 982 };
const POR_DEFECTO = {
  lugar: CONFIG.fondo.lugarPorDefecto,
  escondites: CONFIG.fondo.esconditesPorDefecto,
};

/**
 * Todos los fondos del catalogo —el respaldo vectorial incluido, que usa los
 * lugares de config— y el caso de una carrera sin fondos, cada uno con los
 * objetos de su carrera y la medida de su foto.
 */
const todosLosFondos = async () => {
  const { catalogo, errores } = await construirCatalogo();
  if (errores.length > 0) throw new Error(`Errores en catálogo: ${errores.join(', ')}`);
  const { carreras } = catalogo;
  return [
    ...carreras.flatMap((carrera) =>
      (carrera.fondos ?? []).map((fondo) => ({
        nombre: fondo.img,
        fondo,
        foto: medidasDeLaFoto(fondo.img),
        objetos: carrera.objetos,
      })),
    ),
    { nombre: 'sin fondo: los lugares de config', fondo: null, foto: null, objetos: carreras[0].objetos },
  ];
};

/** Si los objetos de ese fondo estan fotografiados en una foto real. */
const esFotografiado = ({ fondo }) => Boolean(fondo?.cajas?.length);

/**
 * Los fondos cuyos lugares eligio el codigo o el generador: los que tienen que
 * cumplir la composicion (la periferia, el alcance, el aire entre blancos).
 */
const fondosCompuestos = async () => (await todosLosFondos()).filter((caso) => !esFotografiado(caso));

/**
 * Donde queda dibujada la foto de ese fondo, con la misma cuenta que
 * dibujarFondo y la medida de esa foto. Sin fondo, el espejo dibuja la escena
 * vectorial, que se hace a la medida de la pantalla y la llena.
 */
const fotoEn = ({ fondo, foto }, pantalla) =>
  fondo
    ? calcularRectanguloDelFondo(foto.ancho, foto.alto, pantalla.ancho, pantalla.alto)
    : { x: 0, y: 0, ancho: pantalla.ancho, alto: pantalla.alto };

/** Los objetos de un fondo en esa pantalla, puestos como los pone el espejo. */
const puestosEn = (caso, pantalla) =>
  objetosDelFondo({
    objetos: caso.objetos,
    fondo: caso.fondo,
    rectangulo: fotoEn(caso, pantalla),
    pantalla,
    config: CONFIG,
  });

const entraEntero = ({ x, y, radio }, pantalla) =>
  x - radio >= 0 && x + radio <= pantalla.ancho && y - radio >= 0 && y + radio <= pantalla.alto;

const sePisan = (a, b, aire = 1) => Math.hypot(a.x - b.x, a.y - b.y) < (a.radio + b.radio) * aire;

/** Si el circulo toca el rectangulo de la zona, pasado a pixeles de la pantalla. */
const tocaLaZona = ({ x, y, radio }, zona, pantalla) => {
  const dx = Math.max(zona.x0 * pantalla.ancho - x, 0, x - zona.x1 * pantalla.ancho);
  const dy = Math.max(zona.y0 * pantalla.alto - y, 0, y - zona.y1 * pantalla.alto);
  return Math.hypot(dx, dy) < radio;
};

describe('los objetos de los fondos reales', () => {
  it('en el espejo vertical, cada lugar elegido entra entero y no se mueve', async () => {
    const movidos = [];
    for (const caso of await fondosCompuestos()) {
      const lugares = lugaresDelFondo(caso.fondo, POR_DEFECTO);
      puestosEn(caso, ESPEJO).forEach((puesto, i) => {
        const crudo = { x: lugares[i].x * ESPEJO.ancho, y: lugares[i].y * ESPEJO.alto };
        const quieto = Math.abs(puesto.x - crudo.x) < 1e-6 && Math.abs(puesto.y - crudo.y) < 1e-6;
        if (!quieto || !entraEntero(puesto, ESPEJO)) movidos.push(`${caso.nombre} [${i}]`);
      });
    }
    expect(movidos, 'estos lugares quedan tan al borde que el codigo los corre').toEqual([]);
  });

  // LA PERIFERIA. En el medio esta la persona: un objeto ahi le taparia la cara
  // o quedaria tapado por ella, que es justo lo que la catedra pidio evitar.
  it('ninguno cae en la zona de la persona', async () => {
    const adentro = [];
    for (const caso of await fondosCompuestos()) {
      puestosEn(caso, ESPEJO).forEach((puesto, i) => {
        if (CONFIG.fondo.zonaDeLaPersona.some((zona) => tocaLaZona(puesto, zona, ESPEJO))) {
          adentro.push(`${caso.nombre} [${i}]`);
        }
      });
    }
    expect(adentro, 'estos objetos caen donde va la persona').toEqual([]);
  });

  // El pie es del nombre de la ingenieria, sobre su degradado.
  it('ninguno baja hasta el nombre', async () => {
    const { pie } = calcularDisposicion(ESPEJO.ancho, ESPEJO.alto);
    const bajos = [];
    for (const caso of await fondosCompuestos()) {
      puestosEn(caso, ESPEJO).forEach((puesto, i) => {
        if (puesto.y + puesto.radio > ESPEJO.alto - pie.alto) bajos.push(`${caso.nombre} [${i}]`);
      });
    }
    expect(bajos, 'estos objetos quedan encima del nombre').toEqual([]);
  });

  // La franja de arriba de la cabeza es del cartel de las fichas: un objeto ahi
  // quedaria debajo del cartel justo mientras se lee.
  it('ninguno sube a la franja del cartel de las fichas', async () => {
    const [cabeza] = CONFIG.fondo.zonaDeLaPersona;
    const franja = CONFIG.fondo.franjaCartel ?? cabeza.y0;
    const altos = [];
    for (const caso of await fondosCompuestos()) {
      puestosEn(caso, ESPEJO).forEach((puesto, i) => {
        if (puesto.y - puesto.radio < franja * ESPEJO.alto) altos.push(`${caso.nombre} [${i}]`);
      });
    }
    expect(altos, 'estos objetos quedan debajo del cartel').toEqual([]);
  });

  // SIN CHOCAR CON EL DE ARRIBA. La mano abre la ficha del objeto cuyo blanco
  // —`fichas.radioFactor` radios— la contiene. Si los blancos de dos objetos se
  // tocan, yendo a buscar uno se abre el otro: pasaba con los dos de cada
  // costado, uno arriba del otro. Y dos objetos que se tocan se leen como uno.
  it('los blancos de la mano de un mismo fondo no se tocan', async () => {
    const pisados = [];
    for (const caso of await fondosCompuestos()) {
      const puestos = puestosEn(caso, ESPEJO);
      for (let i = 0; i < puestos.length; i++) {
        for (let j = i + 1; j < puestos.length; j++) {
          if (sePisan(puestos[i], puestos[j], CONFIG.fichas.radioFactor)) {
            pisados.push(`${caso.nombre} [${i}] y [${j}]`);
          }
        }
      }
    }
    expect(pisados).toEqual([]);
  });

  // En apaisado los objetos sueltos crecen (`fondo.agrandarEnApaisado`), y el
  // tope es el mismo que en el espejo: que yendo a buscar uno no se abra el de
  // al lado. Los pintados adentro de la foto aparecen porque la foto entra
  // entera: cubriendo la pantalla, solo se veia su franja del medio y los de
  // arriba de todo quedaban afuera con esa parte de la foto.
  it('en un monitor apaisado, todos aparecen en pantalla y sus blancos no se tocan', async () => {
    const problemas = [];
    for (const caso of await fondosCompuestos()) {
      const puestos = puestosEn(caso, APAISADA);
      puestos.forEach((puesto, i) => {
        if (!entraEntero(puesto, APAISADA)) problemas.push(`${caso.nombre} [${i}] fuera de la pantalla`);
      });
      for (let i = 0; i < puestos.length; i++) {
        for (let j = i + 1; j < puestos.length; j++) {
          if (sePisan(puestos[i], puestos[j], CONFIG.fichas.radioFactor)) {
            problemas.push(`${caso.nombre} [${i}] y [${j}] se tocan`);
          }
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  // LA MANO VA A BUSCAR LO QUE VE. Con un fondo generado el objeto esta pintado
  // adentro de la foto, y en una foto real esta fotografiado: se ve donde cae la
  // foto, y el blanco de la mano —y con el su latido y su ficha— tiene que estar
  // ahi. Fue un bug de verdad: en la notebook el blanco se recomponia sobre lo
  // que se ve, como el de un PNG suelto, y la mano apoyada sobre el reactor de
  // quimica no abria su ficha. En el espejo vertical las dos cuentas coinciden
  // y no se notaba.
  it('en cualquier pantalla, el blanco de la mano cae sobre el objeto que se ve', async () => {
    const corridos = [];
    for (const caso of await todosLosFondos()) {
      if (!objetosEnLaFoto(caso.fondo)) continue;
      for (const pantalla of [ESPEJO, APAISADA, NOTEBOOK]) {
        const rectangulo = fotoEn(caso, pantalla);
        puestosEn(caso, pantalla).forEach((puesto, i) => {
          const caja = cajaEnPantalla(puesto.enLaFoto.caja, rectangulo);
          const centro = { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto / 2 };
          const distancia = Math.hypot(centro.x - puesto.x, centro.y - puesto.y);
          if (distancia > puesto.radio * CONFIG.fichas.radioFactor) {
            corridos.push(`${caso.nombre} [${i}] en ${pantalla.ancho}x${pantalla.alto}: a ${Math.round(distancia)} px`);
          }
        });
      }
    }
    expect(corridos, 'el blanco de estos objetos no esta sobre el objeto que se ve').toEqual([]);
  });

  // AL ALCANCE DE LA MANO. La periferia tira para arriba y para los costados, y
  // el brazo no: la ficha de un objeto que nadie alcanza no se lee nunca.
  //
  // La persona es UNA SOLA para esta prueba y para la de la periferia: la de
  // zonaDeLaPersona, con los hombros donde empieza el cuerpo, en el medio. El
  // ancho de hombros es el de la persona de la prueba del sostenido, 380 px
  // —alguien sentado a unos dos metros o mas—, y el brazo es el del carrusel:
  // `tablero.radioFactor` anchos de hombros desde el centro de los hombros. La
  // ficha se abre a `fichas.radioFactor` radios del objeto, y se pide que sobre
  // un 10 % del brazo, para que no dependa de un pixel.
  //
  // Es un modelo, no una medicion. La prueba del sostenido pone los hombros mas
  // abajo (y = 1300); con esa persona, a la mitad de los objetos de arriba no
  // se llega, pero entonces tampoco valdria la zona. Si en el stand la gente
  // queda mas abajo en el cuadro, se recalibran juntas la zona y los lugares
  // (docs/operacion.md).
  it('la mano de la persona llega a los cinco, con margen', async () => {
    const [, cuerpo] = CONFIG.fondo.zonaDeLaPersona;
    const hombros = { x: ESPEJO.ancho / 2, y: cuerpo.y0 * ESPEJO.alto, ancho: 380 };
    const brazo = CONFIG.tablero.radioFactor * hombros.ancho;
    const lejos = [];
    for (const caso of await fondosCompuestos()) {
      puestosEn(caso, ESPEJO).forEach((puesto, i) => {
        const hastaLaPalma =
          Math.hypot(puesto.x - hombros.x, puesto.y - hombros.y) -
          CONFIG.fichas.radioFactor * puesto.radio;
        const sobra = brazo - hastaLaPalma;
        if (sobra < 0.1 * brazo) {
          lejos.push(`${caso.nombre} [${i}]: sobran ${Math.round(sobra)} de ${Math.round(brazo)} px`);
        }
      });
    }
    expect(lejos, 'a estos objetos la mano no llega con margen').toEqual([]);
  });
});

// UNA FOTO REAL CON LOS OBJETOS FOTOGRAFIADOS ADENTRO. El PNG de cada uno calza
// sobre el que se ve (herramientas/ubicar.py escribio su caja), y es lo que se
// levanta cuando la mano pasa por encima. Lo que tiene que valer:
describe('los objetos fotografiados en una foto real', () => {
  // EL QUE LLEGA VOLANDO CAE JUSTO ENCIMA DEL SUYO. El PNG del carrusel aterriza
  // en su `lugar` con su lado mas largo de diametro, y ahi se funde con el que
  // ya esta en la foto: un lugar corrido de su caja se ve como un objeto que
  // aterriza al lado de si mismo. Los escondidos, igual: su blanco, su latido y
  // su ficha salen de su lugar. Lo escribe ubicar.py a partir de las cajas, y
  // esto avisa si alguien toca una a mano y no la otra.
  it('cada lugar es su caja: el mismo centro y su lado mas largo, en cualquier pantalla', async () => {
    const corridos = [];
    for (const caso of (await todosLosFondos()).filter(esFotografiado)) {
      for (const pantalla of [ESPEJO, APAISADA, NOTEBOOK]) {
        const rectangulo = fotoEn(caso, pantalla);
        puestosEn(caso, pantalla).forEach((puesto, i) => {
          const caja = cajaEnPantalla(puesto.enLaFoto.caja, rectangulo);
          const centro = { x: caja.x + caja.ancho / 2, y: caja.y + caja.alto / 2 };
          const lado = Math.max(caja.ancho, caja.alto);
          if (
            Math.hypot(centro.x - puesto.x, centro.y - puesto.y) > 1 ||
            Math.abs(2 * puesto.radio - lado) > 1
          ) {
            corridos.push(`${caso.nombre} [${i}] en ${pantalla.ancho}x${pantalla.alto}`);
          }
        });
      }
    }
    expect(corridos, 'el lugar de estos objetos no coincide con su caja').toEqual([]);
  });

  // Ninguno se queda sin caja: sin ella no hay nada que levantar.
  it('todos los objetos de la carrera tienen su caja', async () => {
    const sinCaja = [];
    for (const caso of (await todosLosFondos()).filter(esFotografiado)) {
      puestosEn(caso, ESPEJO).forEach((puesto, i) => {
        if (!puesto.enLaFoto) sinCaja.push(`${caso.nombre} [${i}]`);
      });
    }
    expect(sinCaja).toEqual([]);
  });
});
