export function crearMedidorDeEtapas({ ventana = 60, ahora = () => performance.now() } = {}) {
  const muestras = new Map();

  const registrar = (nombre, ms) => {
    const lista = muestras.get(nombre) ?? [];
    lista.push(Number.isFinite(ms) && ms >= 0 ? ms : 0);
    while (lista.length > ventana) lista.shift();
    muestras.set(nombre, lista);
  };

  return {
    registrar,
    medir(nombre, fn) {
      const inicio = ahora();
      try {
        return fn();
      } finally {
        registrar(nombre, ahora() - inicio);
      }
    },
    instantanea: () => Object.fromEntries([...muestras].map(([nombre, lista]) => [nombre, {
      ms: lista.reduce((total, valor) => total + valor, 0) / lista.length,
      muestras: lista.length,
      maximoMs: Math.max(...lista),
    }])),
    reiniciar: () => muestras.clear(),
  };
}

/** Suma subpasos de dibujo y deja una muestra por etapa en cada cuadro. */
export function crearAcumuladorDeEtapas({ ahora = () => performance.now() } = {}) {
  const acumuladas = new Map();

  return {
    medir(nombre, fn) {
      const inicio = ahora();
      try {
        return fn();
      } finally {
        const ms = ahora() - inicio;
        acumuladas.set(nombre, (acumuladas.get(nombre) ?? 0) + (Number.isFinite(ms) && ms >= 0 ? ms : 0));
      }
    },
    registrarEn(medidor) {
      for (const [nombre, ms] of acumuladas) medidor.registrar(nombre, ms);
      acumuladas.clear();
    },
  };
}
