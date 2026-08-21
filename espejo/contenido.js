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

function validarObjeto(objeto, donde, figurasValidas, errores) {
  if (!objeto.img) errores.push(`${donde} sin "img"`);
  if (typeof objeto.escala !== 'number' || objeto.escala <= 0) {
    errores.push(`${donde} "escala" tiene que ser un numero mayor que cero`);
  }
  if (figurasValidas && objeto.figura && !figurasValidas.includes(objeto.figura)) {
    errores.push(`${donde} usa la figura "${objeto.figura}", que no existe`);
  }
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

    if (carrera.fondo !== undefined && !esTextoUtil(carrera.fondo)) {
      errores.push(`${donde}: "fondo" tiene que ser la ruta de una imagen`);
    }

    // La persona es lo que la pantalla muestra al elegir esta carrera: sin
    // nombre y sin texto, la revelacion queda vacia.
    if (!carrera.persona) {
      errores.push(`${donde}: falta "persona"`);
    } else {
      if (!esTextoUtil(carrera.persona.nombre)) {
        errores.push(`${donde}: "persona" sin "nombre"`);
      }
      if (!esTextoUtil(carrera.persona.texto)) {
        errores.push(`${donde}: "persona" sin "texto"`);
      }
    }

    if (!Array.isArray(carrera.objetos) || carrera.objetos.length === 0) {
      errores.push(`${donde}: "objetos" vacio`);
    } else {
      carrera.objetos.forEach((objeto, j) => {
        validarObjeto(objeto, `${donde}: objetos[${j}]`, figurasValidas, errores);
      });
    }

    // `objeto` es opcional y manda sobre `objetos`: es el representante fijo de
    // la carrera cuando importa cual se ve. Sin el, se sortea de la lista.
    if (carrera.objeto) validarObjeto(carrera.objeto, `${donde}: objeto`, figurasValidas, errores);
  });

  return errores;
}

/**
 * Que objeto representa a esta carrera entre los cinco que se ofrecen.
 *
 * Con `objeto` declarado, siempre ese: hay carreras donde un solo PNG se
 * entiende de lejos y el resto no. Sin el, uno al azar de la lista, para que dos
 * visitantes seguidos no vean exactamente la misma pantalla.
 */
export function objetoDeCarrera(carrera, azar = Math.random) {
  if (!carrera) return null;
  if (carrera.objeto) return carrera.objeto;

  const lista = carrera.objetos ?? [];
  if (lista.length === 0) return null;
  return lista[Math.floor(azar() * lista.length)] ?? lista[0];
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

    todasLasImagenes: () =>
      datos.carreras.flatMap((carrera) => [
        ...carrera.objetos.map((objeto) => objeto.img),
        ...(carrera.objeto ? [carrera.objeto.img] : []),
        ...(carrera.fondo ? [carrera.fondo] : []),
      ]),
  };
}
