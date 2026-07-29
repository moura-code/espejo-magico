// Los dos unicos mensajes del sistema. Lo importan el espejo Y la tablet: es lo
// que impide que los dos lados se desincronicen sin que nadie se entere.

export const TIPOS = { CARRERA: 'carrera', REPOSO: 'reposo' };

export function mensajeCarrera(id, sesion) {
  return { tipo: TIPOS.CARRERA, id, sesion };
}

export function mensajeReposo() {
  return { tipo: TIPOS.REPOSO };
}

export function esValido(mensaje) {
  if (!mensaje || typeof mensaje !== 'object') return false;
  if (mensaje.tipo === TIPOS.REPOSO) return true;
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
