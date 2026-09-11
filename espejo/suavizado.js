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
 * Suavizado de manos. La palma que elige tiene que estar quieta: el sostenido
 * mide que la mano se quede sobre un objeto, y el temblor crudo de la deteccion
 * la hace entrar y salir del blanco varias veces por segundo — el anillo de
 * progreso se llenaria a los saltos y elegir seria cuestion de suerte.
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

// Tope del salto de reloj entre dos llamadas de los desvanecedores. Si el
// navegador se traba un instante, un salto grande prenderia o apagaria de golpe
// lo que existe para no hacerlo nunca.
const DT_MAXIMO = 250;

/**
 * Cuanto se ve la señal de cada mano.
 *
 * El filtro retiene una mano perdida un rato y despues la suelta de golpe, y la
 * deteccion la vuelve a encontrar de golpe: la señal que la seguia aparecia y
 * desaparecia con ella, que con la mano de costado es un parpadeo. Aca cada mano
 * (por su `idSeguimiento`) tiene su alfa: entra en `msDeEntrada`, sale en
 * `msDeSalida`, y la que se fue se sigue devolviendo donde estaba hasta
 * apagarse. Solo decide cuanto se ve: la eleccion y las fichas miran las manos
 * del filtro, sin esto.
 */
export function crearDesvanecedorDeManos({ msDeEntrada, msDeSalida }) {
  const pistas = new Map();
  let ultimoReloj = null;

  return {
    actualizar(manos, ahora) {
      const dt = ultimoReloj === null ? 0 : Math.min(DT_MAXIMO, Math.max(0, ahora - ultimoReloj));
      ultimoReloj = ahora;

      const vistas = new Set();
      for (const mano of manos) {
        const id = mano.idSeguimiento ?? 'sin-seguimiento';
        vistas.add(id);
        const alfa = Math.min(1, (pistas.get(id)?.alfa ?? 0) + dt / Math.max(1, msDeEntrada));
        pistas.set(id, { mano, alfa });
      }

      for (const [id, pista] of pistas) {
        if (vistas.has(id)) continue;
        pista.alfa = Math.max(0, pista.alfa - dt / Math.max(1, msDeSalida));
        if (pista.alfa === 0) pistas.delete(id);
      }

      return [...pistas.values()].map(({ mano, alfa }) => ({ ...mano, alfa }));
    },

    reiniciar() {
      pistas.clear();
      ultimoReloj = null;
    },
  };
}

/**
 * Un alfa que se enciende en `msDeEntrada` y se apaga en `msDeSalida`, siempre
 * desde donde esta. Es el de la invitacion del reposo: calculada por estado,
 * arrancaba entera en el enganche aunque el reposo hubiera durado menos que su
 * entrada, y se prendia de golpe justo para irse. Aca, si la señal se da vuelta
 * a mitad de camino, sigue desde ahi —como las nubes—, y rebotar entre el
 * reposo y el enganche no la hace parpadear.
 *
 * Avanza en linea recta y devuelve la curva suave: entra y sale sin tirones.
 */
export function crearDesvanecedor({ msDeEntrada, msDeSalida }) {
  let lineal = 0;
  let ultimoReloj = null;

  return {
    actualizar(encendido, ahora) {
      const dt = ultimoReloj === null ? 0 : Math.min(DT_MAXIMO, Math.max(0, ahora - ultimoReloj));
      ultimoReloj = ahora;
      lineal = encendido
        ? Math.min(1, lineal + dt / Math.max(1, msDeEntrada))
        : Math.max(0, lineal - dt / Math.max(1, msDeSalida));
      return lineal * lineal * (3 - 2 * lineal);
    },

    reiniciar() {
      lineal = 0;
      ultimoReloj = null;
    },
  };
}

/**
 * Entrar es rapido, salir es lento. La asimetria es deliberada: unos pocos
 * cuadros bastan para reconocer que alguien se sento, pero hace falta bastante
 * mas rato sin rostro para dar por hecho que se fue (los dos plazos salen de
 * CONFIG.presencia). El reloj de salida arranca en el PRIMER cuadro sin rostro,
 * no en el ultimo.
 *
 * Entrar y salir se miden los dos en tiempo, nunca en cuadros: quien pregunta lo
 * hace una vez por cuadro de dibujo, pero los detectores corren mas lento y
 * entre uno y otro devuelven la misma lectura repetida. Si esto contara cuadros,
 * consultar mas seguido adelantaria la presencia y una deteccion suelta valdria
 * por varias — justo lo que la histeresis existe para evitar.
 */
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
