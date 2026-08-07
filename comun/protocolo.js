// Los unicos mensajes del sistema. Lo importan el espejo Y la tablet: es lo que
// impide que los dos lados se desincronicen sin que nadie se entere.
//
// `hola` declara quien esta del otro lado del socket y se manda una sola vez al
// conectar; `carrera` y `reposo` son la experiencia. La `instancia` identifica
// el arranque del espejo: si se recarga, las tablets saben que el numero de
// sesion volvio a empezar y no lo confunden con un latido repetido.

export const TIPOS = { HOLA: 'hola', CARRERA: 'carrera', REPOSO: 'reposo' };

export function mensajeHolaEspejo(instancia) {
  return { tipo: TIPOS.HOLA, rol: 'espejo', instancia };
}

export function mensajeHolaTablet(slot) {
  return { tipo: TIPOS.HOLA, rol: 'tablet', slot };
}

export function mensajeCarrera(id, sesion, instancia) {
  return { tipo: TIPOS.CARRERA, id, sesion, ...(instancia ? { instancia } : {}) };
}

export function mensajeReposo(instancia) {
  return { tipo: TIPOS.REPOSO, ...(instancia ? { instancia } : {}) };
}

export function esValido(mensaje) {
  if (!mensaje || typeof mensaje !== 'object') return false;
  if (mensaje.tipo === TIPOS.HOLA) {
    if (mensaje.rol === 'espejo') {
      return typeof mensaje.instancia === 'string' && mensaje.instancia.length > 0;
    }
    return mensaje.rol === 'tablet' && Number.isInteger(mensaje.slot) && mensaje.slot >= 0;
  }
  const instanciaValida =
    mensaje.instancia === undefined ||
    (typeof mensaje.instancia === 'string' && mensaje.instancia.length > 0);
  if (!instanciaValida) return false;
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
