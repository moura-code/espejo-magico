// Donde caen los objetos de cada fondo, contra el contenido real.
//
// Cada fondo tiene cuatro objetos: el que llega volando del carrusel a su
// `lugar` y los otros tres en sus `escondites`. Las fotos se preparan en
// 1080x1920, la medida del espejo vertical, y los lugares se eligen mirando a
// esa medida (herramientas/fondos.html). Esta prueba fija lo que tiene que valer
// para todos, con el catalogo y la CONFIG de verdad:
//
//   - en el espejo, lo elegido entra entero y el codigo no lo mueve;
//   - ningun objeto cae en la zona de la persona ni baja hasta el nombre: la
//     catedra pidio la periferia, para que no coincidan con su imagen;
//   - los objetos de un mismo fondo no se pisan;
//   - en un monitor apaisado —desarrollo— todos aparecen en pantalla y siguen
//     sin pisarse. Fue un bug de verdad: el objeto volaba a un punto arriba del
//     borde y "desaparecia" en las doce ingenierias.

import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { CONFIG } from '../../espejo/config.js';
import { calcularDisposicion, calcularRectanguloVideo } from '../../espejo/escena.js';
import { lugarEnPantalla } from '../../espejo/vuelo.js';
import { lugaresDelFondo } from '../../espejo/escondites.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

// La medida en que se preparan los fondos (docs/contenido.md).
const FOTO = { ancho: 1080, alto: 1920 };
const ESPEJO = { ancho: 1080, alto: 1920 };
const APAISADA = { ancho: 1920, alto: 1080 };
const POR_DEFECTO = {
  lugar: CONFIG.fondo.lugarPorDefecto,
  escondites: CONFIG.fondo.esconditesPorDefecto,
};

/**
 * Todos los fondos del catalogo —el respaldo vectorial incluido, que usa los
 * lugares de config— y el caso de una carrera sin fondos.
 */
const todosLosFondos = async () => {
  const crudo = await readFile(resolve(RAIZ, 'contenido/carreras.json'), 'utf8');
  return [
    ...JSON.parse(crudo).carreras.flatMap((carrera) =>
      (carrera.fondos ?? []).map((fondo) => ({ nombre: fondo.img, fondo })),
    ),
    { nombre: 'sin fondo: los lugares de config', fondo: null },
  ];
};

const puestosEn = (fondo, pantalla) => {
  const rectangulo = calcularRectanguloVideo(FOTO.ancho, FOTO.alto, pantalla.ancho, pantalla.alto);
  return lugaresDelFondo(fondo, POR_DEFECTO).map((lugar) =>
    lugarEnPantalla(lugar, rectangulo, pantalla, CONFIG.fondo.margenDelLugar),
  );
};

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
    for (const { nombre, fondo } of await todosLosFondos()) {
      const lugares = lugaresDelFondo(fondo, POR_DEFECTO);
      puestosEn(fondo, ESPEJO).forEach((puesto, i) => {
        const crudo = { x: lugares[i].x * ESPEJO.ancho, y: lugares[i].y * ESPEJO.alto };
        const quieto = Math.abs(puesto.x - crudo.x) < 1e-6 && Math.abs(puesto.y - crudo.y) < 1e-6;
        if (!quieto || !entraEntero(puesto, ESPEJO)) movidos.push(`${nombre} [${i}]`);
      });
    }
    expect(movidos, 'estos lugares quedan tan al borde que el codigo los corre').toEqual([]);
  });

  // LA PERIFERIA. En el medio esta la persona: un objeto ahi le taparia la cara
  // o quedaria tapado por ella, que es justo lo que la catedra pidio evitar.
  it('ninguno cae en la zona de la persona', async () => {
    const adentro = [];
    for (const { nombre, fondo } of await todosLosFondos()) {
      puestosEn(fondo, ESPEJO).forEach((puesto, i) => {
        if (CONFIG.fondo.zonaDeLaPersona.some((zona) => tocaLaZona(puesto, zona, ESPEJO))) {
          adentro.push(`${nombre} [${i}]`);
        }
      });
    }
    expect(adentro, 'estos objetos caen donde va la persona').toEqual([]);
  });

  // El pie es del nombre de la ingenieria, sobre su degradado.
  it('ninguno baja hasta el nombre', async () => {
    const { pie } = calcularDisposicion(ESPEJO.ancho, ESPEJO.alto);
    const bajos = [];
    for (const { nombre, fondo } of await todosLosFondos()) {
      puestosEn(fondo, ESPEJO).forEach((puesto, i) => {
        if (puesto.y + puesto.radio > ESPEJO.alto - pie.alto) bajos.push(`${nombre} [${i}]`);
      });
    }
    expect(bajos, 'estos objetos quedan encima del nombre').toEqual([]);
  });

  // Con aire: dos objetos que se tocan se leen como uno solo, y el blanco de la
  // ficha de uno se come al del otro.
  it('los objetos de un mismo fondo no se pisan', async () => {
    const pisados = [];
    for (const { nombre, fondo } of await todosLosFondos()) {
      const puestos = puestosEn(fondo, ESPEJO);
      for (let i = 0; i < puestos.length; i++) {
        for (let j = i + 1; j < puestos.length; j++) {
          if (sePisan(puestos[i], puestos[j], 1.2)) pisados.push(`${nombre} [${i}] y [${j}]`);
        }
      }
    }
    expect(pisados).toEqual([]);
  });

  it('en un monitor apaisado, todos aparecen en pantalla y siguen sin pisarse', async () => {
    const problemas = [];
    for (const { nombre, fondo } of await todosLosFondos()) {
      const puestos = puestosEn(fondo, APAISADA);
      puestos.forEach((puesto, i) => {
        if (!entraEntero(puesto, APAISADA)) problemas.push(`${nombre} [${i}] fuera de la pantalla`);
      });
      for (let i = 0; i < puestos.length; i++) {
        for (let j = i + 1; j < puestos.length; j++) {
          if (sePisan(puestos[i], puestos[j])) problemas.push(`${nombre} [${i}] y [${j}] se pisan`);
        }
      }
    }
    expect(problemas).toEqual([]);
  });

  // AL ALCANCE DE LA MANO. La periferia no puede quedar tan arriba que haya que
  // pararse para llegar: la ficha de un objeto que nadie alcanza no se lee
  // nunca. El modelo es el del carrusel —la mano llega a `tablero.radioFactor`
  // anchos de hombros, aca desde cada hombro, y la ficha se abre a
  // `fichas.radioFactor` radios del objeto— con la persona sentada de la
  // integracion del sostenido (hombros en y = 1300) a 2 m. A esa distancia, una
  // camara de 1280x720 y 78 grados recortada al espejo vertical ve un metro de
  // ancho: 40 cm de hombros son unos 420 px. Mas lejos alcanza a los de la
  // altura de la cara, no a los de arriba. En el stand se mide con gente de
  // verdad (docs/operacion.md): si la persona queda mas abajo, se bajan los
  // lugares en herramientas/fondos.html.
  it('todos quedan al alcance de la mano de alguien sentado a 2 m', async () => {
    const hombros = { x: ESPEJO.ancho / 2, y: 1300, ancho: 420 };
    const brazo = CONFIG.tablero.radioFactor * hombros.ancho;
    const lejos = [];
    for (const { nombre, fondo } of await todosLosFondos()) {
      puestosEn(fondo, ESPEJO).forEach((puesto, i) => {
        const hastaLaPalma = Math.min(
          ...[-1, 1].map((lado) =>
            Math.hypot(puesto.x - (hombros.x + (lado * hombros.ancho) / 2), puesto.y - hombros.y),
          ),
        );
        const falta = hastaLaPalma - CONFIG.fichas.radioFactor * puesto.radio - brazo;
        if (falta > 0) lejos.push(`${nombre} [${i}]: faltan ${Math.round(falta)} px`);
      });
    }
    expect(lejos, 'estos objetos quedan fuera del alcance del brazo').toEqual([]);
  });

  // La ficha va en la franja del costado de su objeto. Si esa franja entrara en
  // la zona de la cabeza, la ficha le taparia la cara a la persona.
  it('la franja de las fichas no se mete en la zona de la cabeza', () => {
    const [cabeza] = CONFIG.fondo.zonaDeLaPersona;
    expect(CONFIG.fichas.columna).toBeLessThanOrEqual(cabeza.x0);
    expect(1 - CONFIG.fichas.columna).toBeGreaterThanOrEqual(cabeza.x1);
  });
});
