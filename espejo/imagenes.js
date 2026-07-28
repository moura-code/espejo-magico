// Banco de imagenes con caida elegante.
//
// Si un PNG no esta, se guarda null y la escena dibuja una figura del color de
// la carrera. Eso permite tener el sistema entero andando y probado antes de que
// diseño entregue el primer archivo, y evita que un nombre mal escrito deje la
// pantalla en negro con publico delante.

export function crearBanco({ cargar, raiz = '' }) {
  const cache = new Map();

  return {
    async precargar(rutas) {
      const nuevas = [...new Set(rutas)].filter((ruta) => !cache.has(ruta));

      await Promise.all(
        nuevas.map(async (ruta) => {
          try {
            cache.set(ruta, await cargar(raiz + ruta));
          } catch {
            cache.set(ruta, null);
          }
        }),
      );

      const todas = [...new Set(rutas)];
      return { total: todas.length, faltantes: todas.filter((ruta) => !cache.get(ruta)) };
    },

    // La clave es la ruta tal como viene de carreras.json. La raiz solo se
    // antepone al pedirle el archivo al navegador.
    obtener: (ruta) => cache.get(ruta) ?? null,

    faltantes: () => [...cache.entries()].filter(([, imagen]) => !imagen).map(([ruta]) => ruta),
  };
}

export function cargarImagenDelNavegador(ruta) {
  return new Promise((ok, falla) => {
    const imagen = new Image();
    imagen.onload = () => ok(imagen);
    imagen.onerror = () => falla(new Error(`No se pudo cargar ${ruta}`));
    imagen.src = ruta;
  });
}
