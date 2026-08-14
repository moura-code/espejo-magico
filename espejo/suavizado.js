// Suavizado del rostro e histeresis de presencia.
//
// Los puntos de MediaPipe tiemblan cuadro a cuadro. Sin filtrar, el recorte y
// los trazos que siguen a la cara vibran y la instalacion se ve barata. Y sin
// histeresis, la experiencia parpadea cada vez que alguien gira la cara un
// instante.

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

    // Se llama al perder la presencia. Sin esto, el recorte de la cara se
    // desliza por la pantalla desde donde estaba la persona anterior hasta la
    // cara nueva.
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
 * Cada mano lleva su propio filtro y se asocia por cercania con el cuadro
 * anterior. No se confia en el orden ni en la etiqueta izquierda/derecha de
 * MediaPipe, que pueden cambiar al cruzar las manos. Una pista ausente se
 * conserva brevemente para absorber detecciones perdidas.
 */
export function crearFiltroDeManos({
  posicion,
  radio,
  retencionMs = 250,
  distanciaMaximaEnRadios = 3,
}) {
  const pistas = new Map();
  let siguienteId = 1;

  const nuevaPista = (mano, ahora) => ({
    id: siguienteId++,
    x: crearFiltroExponencial(posicion),
    y: crearFiltroExponencial(posicion),
    filtroRadio: crearFiltroExponencial(radio),
    palma: { ...mano.palma },
    radio: mano.radio,
    ultimaVez: ahora,
  });

  return {
    filtrar(manos, ahora) {
      if (!Number.isFinite(ahora)) {
        throw new TypeError('crearFiltroDeManos.filtrar necesita el reloj `ahora`');
      }

      for (const [id, pista] of pistas) {
        if (ahora - pista.ultimaVez > retencionMs) pistas.delete(id);
      }

      const candidatas = [];
      manos.forEach((mano, indice) => {
        for (const pista of pistas.values()) {
          const distancia = Math.hypot(mano.palma.x - pista.palma.x, mano.palma.y - pista.palma.y);
          const maxima = Math.max(mano.radio, pista.radio) * distanciaMaximaEnRadios;
          if (distancia <= maxima) candidatas.push({ indice, pista, distancia });
        }
      });
      candidatas.sort((a, b) => a.distancia - b.distancia);

      const pistaPorIndice = new Map();
      const pistasUsadas = new Set();
      for (const candidata of candidatas) {
        if (pistaPorIndice.has(candidata.indice) || pistasUsadas.has(candidata.pista.id)) continue;
        pistaPorIndice.set(candidata.indice, candidata.pista);
        pistasUsadas.add(candidata.pista.id);
      }

      const filtradas = new Array(manos.length);

      manos.forEach((mano, indice) => {
        let pista = pistaPorIndice.get(indice);
        if (!pista) {
          pista = nuevaPista(mano, ahora);
          pistas.set(pista.id, pista);
        }

        filtradas[indice] = {
          ...mano,
          idSeguimiento: pista.id,
          palma: {
            x: pista.x.filtrar(mano.palma.x),
            y: pista.y.filtrar(mano.palma.y),
          },
          radio: pista.filtroRadio.filtrar(mano.radio),
        };
        pista.palma = { ...mano.palma };
        pista.radio = mano.radio;
        pista.ultimaVez = ahora;
      });

      return filtradas;
    },

    reiniciar() {
      pistas.clear();
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

// Entrar y salir se miden los dos en tiempo, nunca en cuadros: quien pregunta
// lo hace una vez por cuadro de dibujo, pero los detectores corren mas lento y
// entre uno y otro devuelven la misma lectura repetida. Si esto contara cuadros,
// consultar mas seguido adelantaria la presencia y una deteccion suelta valdria
// por varias — justo lo que la histeresis existe para evitar.
export function crearHisteresis({ msParaEntrar, msParaSalir }) {
  let presente = false;
  let desdeQueLlega = null;
  let desdeQueFalta = null;

  return {
    actualizar(hayRostro, ahora) {
      if (hayRostro) {
        desdeQueFalta = null;
        if (desdeQueLlega === null) desdeQueLlega = ahora;
        if (!presente && ahora - desdeQueLlega >= msParaEntrar) presente = true;
      } else {
        desdeQueLlega = null;
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
