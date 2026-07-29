// Mensajes compartidos por el espejo y las tablets. Centralizarlos aca impide
// que una pantalla acepte una accion que la otra ya no entiende.

export const TIPOS = {
  CARRERA: 'carrera',
  REPOSO: 'reposo',
  CONTROLES: 'controles',
  ACCION: 'accion',
};

export const ACCIONES = {
  EMPEZAR: 'empezar',
  AVANZAR: 'avanzar',
  REINICIAR: 'reiniciar',
  OTRA_CARRERA: 'otra-carrera',
  TERMINAR: 'terminar',
};

const ACCIONES_VALIDAS = new Set(Object.values(ACCIONES));

export function mensajeCarrera(id, sesion) {
  return { tipo: TIPOS.CARRERA, id, sesion };
}

export function mensajeReposo() {
  return { tipo: TIPOS.REPOSO };
}

export function mensajeControles(estado, botones) {
  return { tipo: TIPOS.CONTROLES, estado, botones };
}

export function mensajeAccion(id) {
  return { tipo: TIPOS.ACCION, id };
}

function esBotonValido(boton) {
  return (
    boton &&
    typeof boton === 'object' &&
    ACCIONES_VALIDAS.has(boton.id) &&
    typeof boton.etiqueta === 'string' &&
    boton.etiqueta.length > 0 &&
    typeof boton.color === 'string' &&
    boton.color.length > 0
  );
}

export function esValido(mensaje) {
  if (!mensaje || typeof mensaje !== 'object') return false;
  if (mensaje.tipo === TIPOS.REPOSO) return true;
  if (mensaje.tipo === TIPOS.ACCION) return ACCIONES_VALIDAS.has(mensaje.id);
  if (mensaje.tipo === TIPOS.CONTROLES) {
    return (
      typeof mensaje.estado === 'string' &&
      mensaje.estado.length > 0 &&
      Array.isArray(mensaje.botones) &&
      mensaje.botones.length <= 4 &&
      mensaje.botones.every(esBotonValido)
    );
  }
  return (
    mensaje.tipo === TIPOS.CARRERA &&
    typeof mensaje.id === 'string' &&
    mensaje.id.length > 0 &&
    Number.isInteger(mensaje.sesion) &&
    mensaje.sesion > 0
  );
}

export function interpretar(texto) {
  try {
    const mensaje = JSON.parse(texto);
    return esValido(mensaje) ? mensaje : null;
  } catch {
    return null;
  }
}
