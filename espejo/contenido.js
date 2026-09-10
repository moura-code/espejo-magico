// Carga y validacion de carreras.json.
//
// Todo lo que distingue una carrera de otra es dato, no codigo: agregar una
// carrera es soltar un PNG, un fondo y pegar un bloque. Eso permite ampliar el
// catalogo sin tocar la logica de la experiencia.
//
// El validador junta TODOS los problemas y nombra la carrera en cada mensaje.
// A las ocho de la mañana del dia del evento, "carreras[3] (quimica): objetos[5]
// sin img" se arregla en veinte segundos; "contenido invalido" no se arregla.

const esTextoUtil = (valor) => typeof valor === 'string' && valor.trim().length > 0;

/**
 * `nombre` y `descripcion` son lo que se lee en la ficha del objeto al pasar la
 * mano por encima. Pueden faltar mientras se escribe el contenido —la ficha
 * muestra lo que haya, y `npm run listo` es el que exige que esten—, pero si
 * estan tienen que ser texto.
 */
function validarObjeto(objeto, donde, figurasValidas, errores) {
  if (!objeto.img) errores.push(`${donde} sin "img"`);
  if (typeof objeto.escala !== 'number' || objeto.escala <= 0) {
    errores.push(`${donde} "escala" tiene que ser un numero mayor que cero`);
  }
  if (figurasValidas && objeto.figura && !figurasValidas.includes(objeto.figura)) {
    errores.push(`${donde} usa la figura "${objeto.figura}", que no existe`);
  }
  for (const campo of ['nombre', 'descripcion']) {
    if (objeto[campo] !== undefined && typeof objeto[campo] !== 'string') {
      errores.push(`${donde} "${campo}" tiene que ser un texto`);
    }
  }
}

const entreCeroYUno = (valor) => typeof valor === 'number' && valor >= 0 && valor <= 1;

/** Un lugar de la imagen: `x` e `y` de 0 a 1 y un tamaño. Fuera de 0–1 el objeto cae fuera de la pantalla. */
function validarLugar(lugar, donde, errores) {
  const { x, y, escala } = lugar ?? {};
  if (!entreCeroYUno(x) || !entreCeroYUno(y)) {
    errores.push(`${donde} necesita "x" e "y" entre 0 y 1`);
  }
  if (typeof escala !== 'number' || escala <= 0) {
    errores.push(`${donde} "escala" tiene que ser un numero mayor que cero`);
  }
}

/**
 * `lugar` es donde se apoya el objeto agarrado, normalizado a la imagen, y
 * `escondites` donde esperan los otros objetos de la carrera, integrados al
 * fondo: el primero de los escondidos va al primer escondite, y asi.
 *
 * `video` es opcional y NO reemplaza a `img`: la acompaña. Un fondo con
 * movimiento se declara con las dos cosas, y la `img` es un cuadro del propio
 * video —lo que se ve mientras el video todavia no cargo, o si el archivo
 * falta—. Por eso `img` sigue siendo obligatoria: sin ella un video que no
 * llega deja la escena sin fondo.
 */
function validarFondo(fondo, donde, errores) {
  if (!fondo || !esTextoUtil(fondo.img)) errores.push(`${donde} sin "img"`);
  // `video: null` es "todavia no hay video para este fondo", la misma convencion
  // que `maite: null`. Rechazarlo haria que carreras.json no valide, y un
  // carreras.json invalido deja el espejo en "cargando..." con publico delante.
  if (fondo?.video !== undefined && fondo.video !== null && !esTextoUtil(fondo.video)) {
    errores.push(`${donde} "video" tiene que ser una ruta, o null`);
  }
  if (fondo?.lugar) validarLugar(fondo.lugar, `${donde} "lugar"`, errores);

  if (fondo?.escondites === undefined) return;
  if (!Array.isArray(fondo.escondites)) {
    errores.push(`${donde} "escondites" tiene que ser una lista de { x, y, escala }`);
    return;
  }
  fondo.escondites.forEach((escondite, k) =>
    validarLugar(escondite, `${donde} escondites[${k}]`, errores),
  );
}

/**
 * `figurasValidas` es opcional. Cuando se pasa, se verifica que cada nombre
 * declarado exista de verdad: asi un error de tipeo aparece al arrancar y no
 * como un objeto que no se dibuja nunca.
 */
export function validarContenido(datos, { figurasValidas = null } = {}) {
  if (!datos || !Array.isArray(datos.carreras) || datos.carreras.length === 0) {
    return ['carreras.json necesita un arreglo "carreras" con al menos una entrada'];
  }

  const errores = [];
  const vistos = new Set();
  const idsDeMaite = new Set();

  datos.carreras.forEach((carrera, i) => {
    const donde = `carreras[${i}]${carrera?.id ? ` (${carrera.id})` : ''}`;

    if (!carrera.id) errores.push(`${donde}: falta "id"`);
    else if (vistos.has(carrera.id)) errores.push(`${donde}: "id" repetido`);
    else vistos.add(carrera.id);

    if (!carrera.nombre) errores.push(`${donde}: falta "nombre"`);
    if (!/^#[0-9a-fA-F]{6}$/.test(carrera.color ?? '')) {
      errores.push(`${donde}: "color" tiene que ser #rrggbb`);
    }

    // `maite` es el id de esta carrera en el otro proyecto, y puede ser null:
    // significa "todavia no hay gente filmada para esta ingenieria". Lo que no
    // puede es estar repetido — dos carreras del espejo apuntando al mismo
    // video dejarian a una de las dos sin su gente y nadie lo notaria.
    if (carrera.maite !== null && carrera.maite !== undefined) {
      if (!esTextoUtil(carrera.maite)) {
        errores.push(`${donde}: "maite" tiene que ser un id de MAITE o null`);
      } else if (idsDeMaite.has(carrera.maite)) {
        errores.push(`${donde}: "maite" repetido ("${carrera.maite}")`);
      } else {
        idsDeMaite.add(carrera.maite);
      }
    }

    // `fondos` son los candidatos: el espejo usa el primero y elegir es
    // reordenar. El campo viejo, en singular, se rechaza con la receta: un JSON
    // sin migrar dejaria a la carrera sin fondo y nadie lo notaria hasta que
    // hay alguien sentado delante.
    if (carrera.fondo !== undefined) {
      errores.push(
        `${donde}: "fondo" ya no existe; es "fondos": [{ "img": "...", "lugar": {...} }]`,
      );
    }
    if (carrera.fondos !== undefined) {
      if (!Array.isArray(carrera.fondos)) {
        errores.push(`${donde}: "fondos" tiene que ser una lista de { img, lugar }`);
      } else {
        carrera.fondos.forEach((fondo, j) =>
          validarFondo(fondo, `${donde}: fondos[${j}]`, errores),
        );
      }
    }

    if (!Array.isArray(carrera.objetos) || carrera.objetos.length === 0) {
      errores.push(`${donde}: "objetos" vacio`);
    } else {
      carrera.objetos.forEach((objeto, j) => {
        validarObjeto(objeto, `${donde}: objetos[${j}]`, figurasValidas, errores);
      });
    }

    // El representante fijo de antes. Ahora es el primero de `objetos`, y un
    // JSON sin migrar dejaria de mostrar el que alguien eligio a mano sin que
    // nada fallara: se rechaza con la receta, igual que el viejo `fondo`.
    if (carrera.objeto !== undefined) {
      errores.push(`${donde}: "objeto" ya no existe: el del carrusel es el primero de "objetos"`);
    }
  });

  return errores;
}

/**
 * El objeto que representa a esta carrera en el carrusel, y el que vuela a su
 * lugar en el fondo cuando la persona lo agarra: el primero de `objetos`.
 *
 * Ya no se sortea. Los demas objetos de la carrera se esconden en el fondo, y
 * cual va al carrusel y cuales esperan escondidos es una decision de contenido,
 * no de la suerte. Elegirlo es reordenar la lista, igual que con los fondos.
 */
export function objetoDeCarrera(carrera) {
  return carrera?.objetos?.[0] ?? null;
}

/** Los objetos que no van al carrusel: los que se esconden en el fondo, en su orden. */
export function escondidosDeCarrera(carrera) {
  return carrera?.objetos?.slice(1) ?? [];
}

/**
 * El fondo que se muestra: el primero de los candidatos. Elegir entre los
 * candidatos es reordenar la lista en carreras.json.
 */
export function fondoActivo(carrera) {
  return carrera?.fondos?.[0] ?? null;
}

export async function cargarContenido({
  ruta = '/contenido/carreras.json',
  traer = fetch,
  ...comprobaciones
} = {}) {
  const respuesta = await traer(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta}: ${respuesta.status}`);

  const datos = await respuesta.json();
  const errores = validarContenido(datos, comprobaciones);
  if (errores.length > 0) {
    throw new Error(`carreras.json invalido:\n  - ${errores.join('\n  - ')}`);
  }

  const porId = new Map(datos.carreras.map((carrera) => [carrera.id, carrera]));

  return {
    carreras: datos.carreras,
    ids: datos.carreras.map((carrera) => carrera.id),

    // Las unicas que se pueden ofrecer: una carrera sin par en MAITE se elige y
    // las tablets se quedan en humo, que se lee como que el sistema se rompio.
    // Quedan escritas en el catalogo y en silencio hasta que tengan su video.
    idsJugables: () => datos.carreras.filter((c) => c.maite).map((c) => c.id),

    obtener: (id) => porId.get(id) ?? null,

    // Todos los objetos —el del carrusel y los que se esconden en el fondo— y
    // solo el fondo activo: los otros candidatos se miran en la herramienta,
    // no en el espejo.
    todasLasImagenes: () =>
      datos.carreras.flatMap((carrera) => [
        ...carrera.objetos.map((objeto) => objeto.img),
        ...(fondoActivo(carrera) ? [fondoActivo(carrera).img] : []),
      ]),

    // Los fondos que se mueven, y solo los activos: un video que no se va a ver
    // no se descarga. Puede estar vacio —hoy casi todas las carreras son foto
    // quieta— y el espejo funciona igual.
    todosLosVideos: () =>
      datos.carreras.map((carrera) => fondoActivo(carrera)?.video).filter(Boolean),
  };
}
