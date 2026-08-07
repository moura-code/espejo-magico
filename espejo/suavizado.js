// Suavizado del rostro e histeresis de presencia.
//
// Los puntos de MediaPipe tiemblan cuadro a cuadro. Sin filtrar, el accesorio
// vibra sobre la cabeza y la instalacion se ve barata. Y sin histeresis, la
// experiencia parpadea cada vez que alguien gira la cara un instante.

export function crearFiltroExponencial(alfa) {
  let valor = null;

  return {
    filtrar(nuevo) {
      if (nuevo === null || nuevo === undefined) return valor;
      valor = valor === null ? nuevo : valor + alfa * (nuevo - valor);
      return valor;
    },
    reiniciar() {
      valor = null;
    },
    valor: () => valor,
  };
}

export function crearFiltroRostro({ posicion, radio, angulo }) {
  const filtros = {
    centroX: crearFiltroExponencial(posicion),
    centroY: crearFiltroExponencial(posicion),
    izqX: crearFiltroExponencial(posicion),
    izqY: crearFiltroExponencial(posicion),
    derX: crearFiltroExponencial(posicion),
    derY: crearFiltroExponencial(posicion),
    radio: crearFiltroExponencial(radio),
    angulo: crearFiltroExponencial(angulo),
  };

  return {
    filtrar(rostro) {
      if (!rostro) return null;

      // Objetos nuevos, no se toca el que entra: main.js conserva el crudo
      // para el diagnostico de la malla.
      return {
        ...rostro,
        centro: {
          x: filtros.centroX.filtrar(rostro.centro.x),
          y: filtros.centroY.filtrar(rostro.centro.y),
        },
        ojoIzq: {
          x: filtros.izqX.filtrar(rostro.ojoIzq.x),
          y: filtros.izqY.filtrar(rostro.ojoIzq.y),
        },
        ojoDer: {
          x: filtros.derX.filtrar(rostro.ojoDer.x),
          y: filtros.derY.filtrar(rostro.ojoDer.y),
        },
        radio: filtros.radio.filtrar(rostro.radio),
        angulo: filtros.angulo.filtrar(rostro.angulo),
      };
    },

    // Se llama al perder la presencia. Sin esto, el accesorio se desliza por la
    // pantalla desde donde estaba la persona anterior hasta la cara nueva.
    reiniciar() {
      for (const filtro of Object.values(filtros)) filtro.reiniciar();
    },
  };
}

/**
 * Suavizado de manos, SOLO para el iman. El atractor cuelga el racimo de la
 * palma en forma permanente, asi que el temblor de la deteccion se traslada
 * entero a los objetos; el filtro lo corta. El modo golpe usa la palma cruda a
 * proposito: el filtro mete retardo y el manotazo necesita reflejos.
 *
 * Cada mano lleva su propio filtro. Las manos del mismo lado se ordenan por la
 * posicion horizontal de la palma antes de asignarles clave, porque el orden
 * del arreglo de MediaPipe puede cambiar entre cuadros. El resultado conserva
 * el orden de entrada para no sorprender a los consumidores. Una mano que
 * desaparece pierde su historia: al reaparecer arranca donde esta.
 */
export function crearFiltroDeManos({ posicion, radio }) {
  const porClave = new Map();

  const nuevoJuego = () => ({
    x: crearFiltroExponencial(posicion),
    y: crearFiltroExponencial(posicion),
    radio: crearFiltroExponencial(radio),
  });

  return {
    filtrar(manos) {
      const vecesPorLado = new Map();
      const vistas = new Set();
      const ordenadas = manos
        .map((mano, indice) => ({ mano, indice }))
        .sort((a, b) => a.mano.palma.x - b.mano.palma.x);
      const filtradas = new Array(manos.length);

      for (const { mano, indice } of ordenadas) {
        const veces = vecesPorLado.get(mano.lado) ?? 0;
        vecesPorLado.set(mano.lado, veces + 1);
        const clave = `${mano.lado}#${veces}`;
        vistas.add(clave);

        if (!porClave.has(clave)) porClave.set(clave, nuevoJuego());
        const filtros = porClave.get(clave);

        filtradas[indice] = {
          ...mano,
          palma: {
            x: filtros.x.filtrar(mano.palma.x),
            y: filtros.y.filtrar(mano.palma.y),
          },
          radio: filtros.radio.filtrar(mano.radio),
        };
      }

      for (const clave of porClave.keys()) {
        if (!vistas.has(clave)) porClave.delete(clave);
      }

      return filtradas;
    },

    reiniciar() {
      porClave.clear();
    },
  };
}

/**
 * Entrar es rapido, salir es lento. La asimetria es deliberada: unos pocos
 * cuadros bastan para reconocer que alguien se sento, pero hace falta casi
 * medio segundo sin rostro para dar por hecho que se fue.
 *
 * El reloj de salida arranca en el PRIMER cuadro sin rostro, no en el ultimo.
 */
/**
 * Velocidad de un punto que se mueve, en pixeles por segundo.
 *
 * La usan la cabeza y las manos para poder golpear los objetos en vez de solo
 * hacerlos rebotar. El tope importa: si la deteccion parpadea y el punto salta
 * media pantalla en un cuadro, sin tope eso se traduce en un objeto disparado a
 * velocidad absurda.
 */
export function crearRastreadorDeVelocidad({ alfa = 0.4, maxima = 4000 } = {}) {
  let anterior = null;
  let vx = 0;
  let vy = 0;

  const acotar = (valor) => Math.max(-maxima, Math.min(maxima, valor));

  return {
    actualizar(x, y, ahora) {
      if (anterior && ahora > anterior.ahora) {
        const dt = (ahora - anterior.ahora) / 1000;
        vx += alfa * (acotar((x - anterior.x) / dt) - vx);
        vy += alfa * (acotar((y - anterior.y) / dt) - vy);
      }
      anterior = { x, y, ahora };
      return { vx, vy };
    },

    reiniciar() {
      anterior = null;
      vx = 0;
      vy = 0;
    },

    velocidad: () => ({ vx, vy }),
  };
}

export function crearHisteresis({ cuadrosParaEntrar, msParaSalir }) {
  let presente = false;
  let seguidos = 0;
  let desdeQueFalta = null;

  return {
    actualizar(hayRostro, ahora) {
      if (hayRostro) {
        desdeQueFalta = null;
        seguidos += 1;
        if (!presente && seguidos >= cuadrosParaEntrar) presente = true;
      } else {
        seguidos = 0;
        if (presente) {
          if (desdeQueFalta === null) desdeQueFalta = ahora;
          if (ahora - desdeQueFalta > msParaSalir) {
            presente = false;
            desdeQueFalta = null;
          }
        }
      }
      return presente;
    },

    presente: () => presente,
  };
}
