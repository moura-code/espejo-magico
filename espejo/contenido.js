// Carga y validacion de carreras.json.
//
// Todo lo que distingue una propuesta de otra es dato, no codigo: agregar una
// carrera es soltar PNG y pegar un bloque.
//
// El validador junta TODOS los problemas y nombra la carrera en cada mensaje.
// A las ocho de la mañana del dia del evento, "carreras[3] (quimica): objetos[5]
// sin img" se arregla en veinte segundos; "contenido invalido" no se arregla.

const esPunto = (p) =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && v >= 0 && v <= 1);

export const DIMENSIONES_REFERENTES = Object.freeze([
  'Yo estudio.',
  'Yo investigo.',
  'Yo enseño.',
  'Yo diseño.',
  'Yo trabajo.',
]);

const dimensionesValidas = new Set(DIMENSIONES_REFERENTES);
export const CATEGORIAS_CARRERAS = Object.freeze(['Carrera de grado', 'Tecnólogo']);
const categoriasValidas = new Set(CATEGORIAS_CARRERAS);

function esUrlOficialFing(valor) {
  try {
    const url = new URL(valor);
    return url.protocol === 'https:' && url.hostname === 'www.fing.edu.uy';
  } catch {
    return false;
  }
}

/**
 * `figurasValidas` y `efectosValidos` son opcionales. Cuando se pasan, se
 * verifica que cada nombre declarado exista de verdad: asi un error de tipeo
 * aparece al arrancar y no como un objeto que no se dibuja nunca.
 */
export function validarContenido(datos, { figurasValidas = null, efectosValidos = null } = {}) {
  if (!datos || !Array.isArray(datos.carreras) || datos.carreras.length === 0) {
    return ['carreras.json necesita un arreglo "carreras" con al menos una entrada'];
  }

  const errores = [];
  const vistos = new Set();

  datos.carreras.forEach((carrera, i) => {
    const donde = `carreras[${i}]${carrera?.id ? ` (${carrera.id})` : ''}`;

    if (!carrera.id) errores.push(`${donde}: falta "id"`);
    else if (vistos.has(carrera.id)) errores.push(`${donde}: "id" repetido`);
    else vistos.add(carrera.id);

    if (!carrera.nombre) errores.push(`${donde}: falta "nombre"`);
    if (!categoriasValidas.has(carrera.categoria)) {
      errores.push(`${donde}: "categoria" tiene que ser Carrera de grado o Tecnólogo`);
    }
    if (!esUrlOficialFing(carrera.url)) {
      errores.push(`${donde}: "url" tiene que ser un enlace HTTPS oficial de FING`);
    }
    if (!carrera.finalidad) errores.push(`${donde}: falta "finalidad"`);
    if (!/^#[0-9a-fA-F]{6}$/.test(carrera.color ?? '')) {
      errores.push(`${donde}: "color" tiene que ser #rrggbb`);
    }

    const accesorio = carrera.accesorio;
    if (!accesorio?.img) errores.push(`${donde}: falta "accesorio.img"`);
    for (const clave of ['anclaOjoIzq', 'anclaOjoDer']) {
      if (!esPunto(accesorio?.[clave])) {
        errores.push(`${donde}: "accesorio.${clave}" tiene que ser [x, y] con valores entre 0 y 1`);
      }
    }
    if (
      esPunto(accesorio?.anclaOjoIzq) &&
      esPunto(accesorio?.anclaOjoDer) &&
      accesorio.anclaOjoIzq[0] === accesorio.anclaOjoDer[0] &&
      accesorio.anclaOjoIzq[1] === accesorio.anclaOjoDer[1]
    ) {
      errores.push(`${donde}: los dos anclajes del accesorio caen en el mismo punto`);
    }

    if (!Array.isArray(carrera.objetos) || carrera.objetos.length === 0) {
      errores.push(`${donde}: "objetos" vacio`);
    } else {
      carrera.objetos.forEach((objeto, j) => {
        if (!objeto.img) errores.push(`${donde}: objetos[${j}] sin "img"`);
        if (typeof objeto.escala !== 'number' || objeto.escala <= 0) {
          errores.push(`${donde}: objetos[${j}] "escala" tiene que ser un numero mayor que cero`);
        }
        if (figurasValidas && objeto.figura && !figurasValidas.includes(objeto.figura)) {
          errores.push(`${donde}: objetos[${j}] usa la figura "${objeto.figura}", que no existe`);
        }
      });
    }

    if (efectosValidos && carrera.efecto && !efectosValidos.includes(carrera.efecto)) {
      errores.push(`${donde}: usa el efecto "${carrera.efecto}", que no existe`);
    }

    if (!Array.isArray(carrera.referentes) || carrera.referentes.length === 0) {
      errores.push(`${donde}: "referentes" vacio`);
    } else {
      carrera.referentes.forEach((referente, j) => {
        if (!referente.video) errores.push(`${donde}: referentes[${j}] sin "video"`);
        if (!dimensionesValidas.has(referente.dimension)) {
          errores.push(`${donde}: referentes[${j}] tiene una "dimension" invalida`);
        }
        if (!referente.nombre) errores.push(`${donde}: referentes[${j}] sin "nombre"`);
        if (!referente.detalle) errores.push(`${donde}: referentes[${j}] sin "detalle"`);
        if (!referente.frase) errores.push(`${donde}: referentes[${j}] sin "frase"`);
      });
    }
  });

  return errores;
}

export async function cargarContenido({
  ruta = '/assets/carreras.json',
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
    obtener: (id) => porId.get(id) ?? null,
    todasLasImagenes: () =>
      datos.carreras.flatMap((carrera) => [
        carrera.accesorio.img,
        ...carrera.objetos.map((objeto) => objeto.img),
      ]),
  };
}
