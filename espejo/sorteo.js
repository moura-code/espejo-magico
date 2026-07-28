// Sorteo de carrera con bolsa barajada, no azar puro.
//
// Con azar puro sale Computacion cuatro veces seguidas y las tablets muestran a
// las mismas mujeres toda la tarde. Con bolsa, las seis carreras salen una vez
// antes de que se repita ninguna.

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
    siguiente() {
      if (bolsa.length === 0) llenar();
      ultima = bolsa.shift();
      return ultima;
    },
    restantes: () => bolsa.length,
  };
}
