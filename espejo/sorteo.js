// Sorteo de carreras con bolsa barajada, no azar puro.
//
// Con azar puro sale Computacion cuatro veces seguidas y la fila entera se
// vuelve con las mismas opciones. Con bolsa, todas salen una vez antes de que se
// repita ninguna.

export function barajar(lista, azar) {
  const mezclada = [...lista];
  for (let i = mezclada.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [mezclada[i], mezclada[j]] = [mezclada[j], mezclada[i]];
  }
  return mezclada;
}

export function crearSorteo({ ids, mezclar = (lista) => barajar(lista, Math.random) }) {
  if (!ids || ids.length === 0) throw new Error('El sorteo necesita al menos una carrera');

  let bolsa = [];
  let ultima = null;

  function llenar() {
    const nueva = mezclar(ids);
    // Sin esto, la ultima de una bolsa y la primera de la siguiente pueden ser
    // la misma carrera, y a dos visitantes seguidos les tocaria lo mismo.
    if (nueva.length > 1 && nueva[0] === ultima) {
      [nueva[0], nueva[nueva.length - 1]] = [nueva[nueva.length - 1], nueva[0]];
    }
    bolsa = nueva;
  }

  return {
    /**
     * Las carreras que se le ofrecen a una persona, sin repetir entre si: dos
     * objetos de la misma ingenieria en la misma pantalla se leen como un error
     * del sistema, no como una opcion.
     *
     * Si se piden mas de las que hay, se devuelven todas. Las que salieron
     * repetidas al recargar la bolsa vuelven al frente en vez de perderse, para
     * que sigan teniendo su turno con la persona siguiente.
     */
    siguientes(cantidad) {
      const pedidas = Math.min(Math.max(0, cantidad), ids.length);
      const sacadas = [];
      const apartadas = [];

      while (sacadas.length < pedidas) {
        if (bolsa.length === 0) llenar();
        const id = bolsa.shift();
        if (sacadas.includes(id)) apartadas.push(id);
        else sacadas.push(id);
      }

      bolsa.unshift(...apartadas);
      if (sacadas.length > 0) ultima = sacadas.at(-1);
      return sacadas;
    },

    siguiente() {
      return this.siguientes(1)[0] ?? null;
    },

    restantes: () => bolsa.length,
  };
}
