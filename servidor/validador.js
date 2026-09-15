// Validador de estructura física y metadata de carreras.
//
// Identifica todos los problemas con la ruta física exacta para que el diagnóstico
// sea inmediato.

const esTextoUtil = (valor) => typeof valor === 'string' && valor.trim().length > 0;
const entreCeroYUno = (valor) => typeof valor === 'number' && valor >= 0 && valor <= 1;

function validarLugar(lugar, donde, errores) {
  if (!lugar || typeof lugar !== 'object') {
    errores.push(`${donde}: falta definir las coordenadas del lugar`);
    return;
  }
  const { x, y, escala } = lugar;
  if (!entreCeroYUno(x)) {
    errores.push(`${donde}: "lugar.x" tiene que estar entre 0 y 1`);
  }
  if (!entreCeroYUno(y)) {
    errores.push(`${donde}: "lugar.y" tiene que estar entre 0 y 1`);
  }
  if (typeof escala !== 'number' || escala <= 0) {
    errores.push(`${donde}: "lugar.escala" tiene que ser un número mayor que cero`);
  }
}

export function validarEstructura(carrerasCrudas, { figurasValidas = null } = {}) {
  const errores = [];
  if (!Array.isArray(carrerasCrudas) || carrerasCrudas.length === 0) {
    return ['No se encontraron carpetas de carreras en el directorio de contenido'];
  }

  const idsCarreras = new Set();
  const idsMaite = new Set();

  for (const carrera of carrerasCrudas) {
    const rutaCarrera = carrera.rutaRelativa || `carreras/${carrera.id}`;

    if (!carrera.id || !esTextoUtil(carrera.id)) {
      errores.push(`${rutaCarrera}: ID de carrera inválido`);
    } else if (idsCarreras.has(carrera.id)) {
      errores.push(`${rutaCarrera}: ID de carrera repetido ("${carrera.id}")`);
    } else {
      idsCarreras.add(carrera.id);
    }

    if (carrera.errorCarreraJson) {
      errores.push(`${rutaCarrera}/carrera.json: JSON inválido (${carrera.errorCarreraJson})`);
    } else if (!carrera.carreraJson) {
      errores.push(`${rutaCarrera}: falta carrera.json`);
    } else {
      const json = carrera.carreraJson;
      if (!esTextoUtil(json.nombre)) {
        errores.push(`${rutaCarrera}/carrera.json: falta "nombre" de la carrera`);
      }
      if (!/^#[0-9a-fA-F]{6}$/.test(json.color ?? '')) {
        errores.push(`${rutaCarrera}/carrera.json: "color" tiene que ser #rrggbb`);
      }

      if (json.maite !== null && json.maite !== undefined) {
        if (!esTextoUtil(json.maite)) {
          errores.push(`${rutaCarrera}/carrera.json: "maite" tiene que ser un texto o null`);
        } else if (idsMaite.has(json.maite)) {
          errores.push(`${rutaCarrera}/carrera.json: "maite" repetido ("${json.maite}")`);
        } else {
          idsMaite.add(json.maite);
        }
      }

      if (json.fondo !== undefined && json.fondo !== null) {
        if (!esTextoUtil(json.fondo)) {
          errores.push(`${rutaCarrera}/carrera.json: "fondo" tiene que ser el ID de un fondo`);
        } else {
          const fondoExiste = (carrera.fondos ?? []).some((f) => f.id === json.fondo);
          if (!fondoExiste) {
            errores.push(
              `${rutaCarrera}/carrera.json: el fondo activo "${json.fondo}" no existe en fondos/`,
            );
          }
        }
      }
    }

    // Validación de objetos
    const objetos = carrera.objetos ?? [];
    if (objetos.length === 0) {
      errores.push(`${rutaCarrera}: la carpeta "objetos" está vacía o no existe`);
    }

    const idsObjetos = new Set();
    for (const objeto of objetos) {
      const rutaObjeto = `${rutaCarrera}/objetos/${objeto.id}`;

      if (idsObjetos.has(objeto.id)) {
        errores.push(`${rutaObjeto}: ID de objeto repetido ("${objeto.id}")`);
      } else {
        idsObjetos.add(objeto.id);
      }

      if (!objeto.rutaImagen) {
        errores.push(`${rutaObjeto}: falta imagen.png`);
      }

      if (objeto.errorMetadata) {
        errores.push(`${rutaObjeto}/metadata.json: JSON inválido (${objeto.errorMetadata})`);
      } else if (!objeto.metadata) {
        errores.push(`${rutaObjeto}: falta metadata.json`);
      } else {
        const meta = objeto.metadata;
        if (!esTextoUtil(meta.nombre)) {
          errores.push(`${rutaObjeto}/metadata.json: falta "nombre"`);
        }
        if (!esTextoUtil(meta.descripcion)) {
          errores.push(`${rutaObjeto}/metadata.json: falta "descripcion"`);
        } else if (meta.descripcion.length > 130) {
          errores.push(
            `${rutaObjeto}/metadata.json: "descripcion" tiene ${meta.descripcion.length} caracteres (máximo 130)`,
          );
        }

        if (meta.figura !== undefined && meta.figura !== null) {
          if (!esTextoUtil(meta.figura)) {
            errores.push(`${rutaObjeto}/metadata.json: "figura" tiene que ser un texto`);
          } else if (figurasValidas && !figurasValidas.includes(meta.figura)) {
            errores.push(
              `${rutaObjeto}/metadata.json: usa la figura "${meta.figura}", que no existe`,
            );
          }
        }
      }
    }

    // Validación de fondos
    const fondos = carrera.fondos ?? [];
    if (fondos.length === 0) {
      errores.push(`${rutaCarrera}: la carpeta "fondos" está vacía o no existe`);
    }

    const idsFondos = new Set();
    const necesariosEscondites = Math.max(0, objetos.length - 1);

    for (const fondo of fondos) {
      const rutaFondo = `${rutaCarrera}/fondos/${fondo.id}`;

      if (idsFondos.has(fondo.id)) {
        errores.push(`${rutaFondo}: ID de fondo repetido ("${fondo.id}")`);
      } else {
        idsFondos.add(fondo.id);
      }

      if (!fondo.rutaImagen) {
        errores.push(`${rutaFondo}: falta imagen estática (imagen.jpg o imagen.png)`);
      }

      if (fondo.errorMetadata) {
        errores.push(`${rutaFondo}/metadata.json: JSON inválido (${fondo.errorMetadata})`);
      } else if (!fondo.metadata) {
        errores.push(`${rutaFondo}: falta metadata.json`);
      } else {
        const meta = fondo.metadata;
        validarLugar(meta.lugar, `${rutaFondo}/metadata.json`, errores);

        if (meta.escondites === undefined || meta.escondites === null) {
          errores.push(`${rutaFondo}/metadata.json: falta lista de "escondites"`);
        } else if (!Array.isArray(meta.escondites)) {
          errores.push(`${rutaFondo}/metadata.json: "escondites" tiene que ser una lista`);
        } else {
          meta.escondites.forEach((escondite, k) => {
            validarLugar(escondite, `${rutaFondo}/metadata.json escondites[${k}]`, errores);
          });

          if (meta.escondites.length < necesariosEscondites) {
            errores.push(
              `${rutaFondo}/metadata.json: insuficientes escondites: declara ${meta.escondites.length} pero la carrera tiene ${objetos.length} objetos (se necesitan al menos ${necesariosEscondites})`,
            );
          }
        }
      }
    }
  }

  return errores;
}
