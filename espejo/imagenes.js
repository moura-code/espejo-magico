// Banco de imagenes con caida elegante.
//
// Si un PNG no esta, se guarda null y la escena dibuja su figura vectorial.
// Eso permite tener el sistema entero andando y probado antes de que
// diseño entregue el primer archivo, y evita que un nombre mal escrito deje la
// pantalla en negro con publico delante.
//
// Sabe ademas cuanto ocupa cada objeto adentro de su PNG (circuloDe): los PNG
// vienen recortados al ras de lo que se ve —asi calzan sobre la foto de su
// fondo— y, con el lado mas largo de diametro, el circulo del carrusel les
// cortaba las puntas. Con lo que ocupa de verdad, cada uno entra entero.

export function crearBanco({ cargar, raiz = '', leerAlfa = null }) {
  const cache = new Map();
  const circulos = new Map();

  return {
    async precargar(rutas) {
      const nuevas = [...new Set(rutas)].filter((ruta) => !cache.has(ruta));

      await Promise.all(
        nuevas.map(async (ruta) => {
          try {
            cache.set(ruta, await cargar(raiz + ruta));
          } catch {
            cache.set(ruta, null);
          }
        }),
      );

      const todas = [...new Set(rutas)];
      return { total: todas.length, faltantes: todas.filter((ruta) => !cache.get(ruta)) };
    },

    // La clave es la ruta tal como viene de carreras.json. La raiz solo se
    // antepone al pedirle el archivo al navegador.
    obtener: (ruta) => cache.get(ruta) ?? null,

    faltantes: () => [...cache.entries()].filter(([, imagen]) => !imagen).map(([ruta]) => ruta),

    // El circulo mas chico que contiene lo que se ve del objeto (circuloDeLoOpaco),
    // o null si todavia no hay con que medirlo. Se mide una sola vez por imagen:
    // leer pixeles cuesta, y el carrusel lo pide en cada cuadro. Una imagen que no
    // se deja leer tambien se anota, sin circulo, para no reintentarlo en cada
    // cuadro; una que todavia no cargo no, para medirla cuando llegue.
    circuloDe(ruta) {
      if (circulos.has(ruta)) return circulos.get(ruta);
      const imagen = cache.get(ruta);
      if (!imagen || !leerAlfa) return null;

      let circulo = null;
      try {
        circulo = circuloDeLoOpaco(leerAlfa(imagen));
      } catch {
        circulo = null;
      }
      circulos.set(ruta, circulo);
      return circulo;
    },
  };
}

/**
 * El circulo mas chico que contiene lo que se ve de una imagen.
 *
 * `alfa` es su canal alfa, un byte por pixel y fila por fila; `umbral`, desde
 * cuanto alfa un pixel se ve: el mismo con que se recortan los PNG de los
 * objetos (alfa > 8), porque contar lo que esta por debajo achicaria al objeto
 * por una sombra que nadie ve.
 *
 * Devuelve `{x, y, radio}` NORMALIZADO AL LADO MAS LARGO de la imagen, con el
 * centro medido desde el centro de la imagen, que es como la dibuja
 * dibujarObjeto: asi no importa a que tamaño se haya leido. Null si no se ve
 * nada.
 */
export function circuloDeLoOpaco({ alfa, ancho, alto }, umbral = 8) {
  // De cada fila alcanza con sus extremos, y de cada pixel extremo con sus
  // esquinas de afuera: el circulo tiene que contener al pixel entero, no a
  // su centro.
  const puntos = [];
  for (let y = 0; y < alto; y++) {
    let izquierda = -1;
    let derecha = -1;
    for (let x = 0; x < ancho; x++) {
      if (alfa[y * ancho + x] > umbral) {
        if (izquierda < 0) izquierda = x;
        derecha = x;
      }
    }
    if (izquierda < 0) continue;
    puntos.push(
      { x: izquierda, y },
      { x: izquierda, y: y + 1 },
      { x: derecha + 1, y },
      { x: derecha + 1, y: y + 1 },
    );
  }

  const circulo = circuloMinimo(puntos);
  if (!circulo) return null;
  const lado = Math.max(ancho, alto);
  return {
    x: (circulo.x - ancho / 2) / lado,
    y: (circulo.y - alto / 2) / lado,
    radio: circulo.radio / lado,
  };
}

/**
 * El circulo mas chico que contiene a todos los `puntos` ({x, y}), o null si
 * no hay ninguno.
 *
 * Es el algoritmo incremental de Welzl sobre el casco convexo: el circulo
 * minimo solo depende de los puntos del borde, y en una grilla de pixeles el
 * casco tiene pocos vertices aunque la imagen sea grande, asi que el peor caso
 * del incremental —cubico en la cantidad de puntos— no llega a pesar.
 */
export function circuloMinimo(puntos) {
  const borde = cascoConvexo(puntos);
  if (borde.length === 0) return null;

  let circulo = { x: borde[0].x, y: borde[0].y, radio: 0 };
  for (let i = 1; i < borde.length; i++) {
    if (contiene(circulo, borde[i])) continue;
    circulo = { x: borde[i].x, y: borde[i].y, radio: 0 };
    for (let j = 0; j < i; j++) {
      if (contiene(circulo, borde[j])) continue;
      circulo = porDos(borde[i], borde[j]);
      for (let k = 0; k < j; k++) {
        if (contiene(circulo, borde[k])) continue;
        circulo = porTres(borde[i], borde[j], borde[k]);
      }
    }
  }
  return circulo;
}

const contiene = (circulo, punto) =>
  Math.hypot(punto.x - circulo.x, punto.y - circulo.y) <= circulo.radio * (1 + 1e-12) + 1e-9;

const porDos = (a, b) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  radio: Math.hypot(a.x - b.x, a.y - b.y) / 2,
});

// El circulo que pasa por los tres. Si estan alineados no hay ninguno, y el
// que los contiene es el que tiene de diametro a los dos mas lejanos.
function porTres(a, b, c) {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-12) {
    return [porDos(a, b), porDos(a, c), porDos(b, c)].reduce((mayor, otro) =>
      otro.radio > mayor.radio ? otro : mayor,
    );
  }
  const [a2, b2, c2] = [a, b, c].map((p) => p.x * p.x + p.y * p.y);
  const x = (a2 * (b.y - c.y) + b2 * (c.y - a.y) + c2 * (a.y - b.y)) / d;
  const y = (a2 * (c.x - b.x) + b2 * (a.x - c.x) + c2 * (b.x - a.x)) / d;
  return { x, y, radio: Math.hypot(a.x - x, a.y - y) };
}

// Cadena monotona de Andrew: los vertices del casco, sin los alineados.
function cascoConvexo(puntos) {
  const ordenados = [...puntos].sort((a, b) => a.x - b.x || a.y - b.y);
  if (ordenados.length <= 2) return ordenados;

  const giro = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const mitad = (recorrido) => {
    const cadena = [];
    for (const punto of recorrido) {
      while (cadena.length >= 2 && giro(cadena.at(-2), cadena.at(-1), punto) <= 0) cadena.pop();
      cadena.push(punto);
    }
    return cadena.slice(0, -1);
  };
  return [...mitad(ordenados), ...mitad([...ordenados].reverse())];
}

export function cargarImagenDelNavegador(ruta) {
  return new Promise((ok, falla) => {
    const imagen = new Image();
    imagen.onload = () => ok(imagen);
    imagen.onerror = () => falla(new Error(`No se pudo cargar ${ruta}`));
    imagen.src = ruta;
  });
}

/**
 * El canal alfa de una imagen, A RESOLUCION COMPLETA. Achicarla abarataba la
 * lectura, pero el reescalado se saltea las lineas finas: a 160 px los tubos
 * Falcon salian un 1,3 % mas chicos de lo que son, y con poco aire se les
 * habria cortado una punta. Enteras, las 37 imagenes se miden en 64 ms, una
 * sola vez, al cargar. `lado` es solo el tope para una imagen gigante, que
 * ahi si se achica.
 */
export function leerAlfaDelNavegador(imagen, lado = 2048) {
  const escala = Math.min(1, lado / Math.max(imagen.width, imagen.height));
  const ancho = Math.max(1, Math.round(imagen.width * escala));
  const alto = Math.max(1, Math.round(imagen.height * escala));
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(imagen, 0, 0, ancho, alto);
  const { data } = ctx.getImageData(0, 0, ancho, alto);
  const alfa = new Uint8Array(ancho * alto);
  for (let i = 0; i < alfa.length; i++) alfa[i] = data[i * 4 + 3];
  return { alfa, ancho, alto };
}
