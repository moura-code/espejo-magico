// Decide cuanto trabajo de vision hace el espejo sin mezclar esa politica con
// el bucle de dibujo. Asi se prueba con relojes y fps concretos, sin camara.
export function fpsDeManos({ perfil, perfilCompleto, protegiendoEleccion, conFondo }) {
  const elegido = protegiendoEleccion ? perfilCompleto : perfil;
  return conFondo ? elegido.manosConFondo : elegido.manos;
}

export function crearGobernadorDeRendimiento({
  perfiles,
  fpsParaBajar,
  fpsParaSubir,
  msParaBajar,
  msParaSubir,
  ventanaMs = 2000,
}) {
  let indice = 0;
  let lentoDesde = null;
  let rapidoDesde = null;
  const muestras = [];

  const perfil = () => perfiles[indice];

  const reiniciarMedicion = () => {
    lentoDesde = null;
    rapidoDesde = null;
  };

  const limpiarMuestras = () => {
    muestras.length = 0;
  };

  const promediarFps = (ahora, fps) => {
    if (Number.isFinite(fps) && fps > 0) {
      muestras.push({ ahora, duracion: 1000 / fps });
    }
    while (muestras.length > 1 && muestras[0].ahora <= ahora - ventanaMs) {
      muestras.shift();
    }
    if (muestras.length === 0) return 0;
    const duracionMedia =
      muestras.reduce((total, muestra) => total + muestra.duracion, 0) / muestras.length;
    return 1000 / duracionMedia;
  };

  return {
    perfil,

    registrar({ ahora, fps, protegiendoEleccion = false, visible = true }) {
      if (!visible) {
        reiniciarMedicion();
        limpiarMuestras();
        return perfil();
      }

      const fpsPromedio = promediarFps(ahora, fps);
      if (protegiendoEleccion) {
        reiniciarMedicion();
        return perfil();
      }

      if (fpsPromedio < fpsParaBajar) {
        rapidoDesde = null;
        lentoDesde ??= ahora;
        if (ahora - lentoDesde >= msParaBajar && indice < perfiles.length - 1) {
          indice += 1;
          lentoDesde = ahora;
          limpiarMuestras();
        }
        return perfil();
      }

      if (fpsPromedio > fpsParaSubir) {
        lentoDesde = null;
        rapidoDesde ??= ahora;
        if (ahora - rapidoDesde >= msParaSubir && indice > 0) {
          indice -= 1;
          rapidoDesde = ahora;
          limpiarMuestras();
        }
        return perfil();
      }

      reiniciarMedicion();
      return perfil();
    },
  };
}
