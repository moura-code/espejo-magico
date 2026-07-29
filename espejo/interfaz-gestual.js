const limitar = (valor, minimo, maximo) => Math.max(minimo, Math.min(maximo, valor));

export function calcularBotonesVirtuales(disposicion) {
  const margen = Math.max(24, disposicion.ancho * 0.055);
  const separacion = Math.max(18, disposicion.ancho * 0.025);
  const anchoBoton = (disposicion.ancho - margen * 2 - separacion) / 2;
  const altoBoton = limitar(disposicion.unidad * 0.115, 72, 130);
  const margenInferior = Math.max(24, disposicion.alto * 0.025);
  const y = disposicion.piso - altoBoton - margenInferior;

  return [
    {
      id: 'otra-carrera',
      etiqueta: 'OTRA CARRERA',
      ayuda: 'Mantené la mano',
      color: '#62D8FF',
      x: margen,
      y,
      ancho: anchoBoton,
      alto: altoBoton,
    },
    {
      id: 'terminar',
      etiqueta: 'TERMINAR',
      ayuda: 'Mantené la mano',
      color: '#FFD23F',
      x: margen + anchoBoton + separacion,
      y,
      ancho: anchoBoton,
      alto: altoBoton,
    },
  ];
}

export function manoTocaBoton(mano, boton) {
  if (!mano?.palma) return false;
  const radio = Math.max(12, (mano.radio ?? 0) * 0.25);
  const cercanoX = limitar(mano.palma.x, boton.x, boton.x + boton.ancho);
  const cercanoY = limitar(mano.palma.y, boton.y, boton.y + boton.alto);
  return Math.hypot(mano.palma.x - cercanoX, mano.palma.y - cercanoY) <= radio;
}

export function crearControlBotonesVirtuales({ permanenciaMs }) {
  let activo = null;
  let desde = 0;
  let bloqueado = false;

  function reiniciar() {
    activo = null;
    desde = 0;
    bloqueado = false;
  }

  return {
    actualizar({ botones, manos, ahora, habilitado }) {
      if (!habilitado) {
        reiniciar();
        return { activo: null, progreso: 0, accion: null };
      }

      const botonActivo = botones.find((boton) => boton.id === activo);
      const tocado =
        (botonActivo && manos.some((mano) => manoTocaBoton(mano, botonActivo))
          ? botonActivo
          : null) ??
        botones.find((boton) => manos.some((mano) => manoTocaBoton(mano, boton))) ??
        null;

      if (!tocado) {
        reiniciar();
        return { activo: null, progreso: 0, accion: null };
      }

      if (tocado.id !== activo) {
        activo = tocado.id;
        desde = ahora;
        bloqueado = false;
      }

      const progreso = limitar((ahora - desde) / permanenciaMs, 0, 1);
      const accion = progreso >= 1 && !bloqueado ? activo : null;
      if (accion) bloqueado = true;

      return { activo, progreso, accion };
    },

    reiniciar,
  };
}

const suavizar = (valor) => valor * valor * (3 - 2 * valor);

export function calcularCierreDeAusencia({
  ahora,
  ausenciaDesde,
  esperaInicialMs,
  intervaloMs,
  cierreMs,
  cerradoMs,
  aperturaMs,
}) {
  if (ausenciaDesde === null) return 0;
  const transcurrido = ahora - ausenciaDesde - esperaInicialMs;
  if (transcurrido < 0) return 0;

  const duracionAnimacion = cierreMs + cerradoMs + aperturaMs;
  const fase = transcurrido % (duracionAnimacion + intervaloMs);
  if (fase < cierreMs) return suavizar(fase / cierreMs);
  if (fase < cierreMs + cerradoMs) return 1;
  if (fase < duracionAnimacion) {
    return 1 - suavizar((fase - cierreMs - cerradoMs) / aperturaMs);
  }
  return 0;
}
