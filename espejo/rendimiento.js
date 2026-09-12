// Decide cuanto trabajo de vision hace el espejo sin mezclar esa politica con
// el bucle de dibujo. Asi se prueba con relojes y fps concretos, sin camara.
export function crearGobernadorDeRendimiento({
  perfiles,
  fpsParaBajar,
  fpsParaSubir,
  msParaBajar,
  msParaSubir,
}) {
  let indice = 0;
  let lentoDesde = null;
  let rapidoDesde = null;

  const perfil = () => perfiles[indice];

  const reiniciarMedicion = () => {
    lentoDesde = null;
    rapidoDesde = null;
  };

  return {
    perfil,

    registrar({ ahora, fps, protegiendoEleccion = false }) {
      if (protegiendoEleccion) {
        reiniciarMedicion();
        return perfil();
      }

      if (fps < fpsParaBajar) {
        rapidoDesde = null;
        lentoDesde ??= ahora;
        if (ahora - lentoDesde >= msParaBajar && indice < perfiles.length - 1) {
          indice += 1;
          lentoDesde = ahora;
        }
        return perfil();
      }

      if (fps > fpsParaSubir) {
        lentoDesde = null;
        rapidoDesde ??= ahora;
        if (ahora - rapidoDesde >= msParaSubir && indice > 0) {
          indice -= 1;
          rapidoDesde = ahora;
        }
        return perfil();
      }

      reiniciarMedicion();
      return perfil();
    },
  };
}
