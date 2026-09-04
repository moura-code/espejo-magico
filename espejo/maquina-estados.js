// La maquina de estados de la experiencia. No dibuja nada y no sabe de camaras:
// recibe "hay rostro si o no" mas un reloj, y devuelve el estado, las carreras
// que se ofrecen, la que se esta mostrando y los cambios que hay que atender.
// Por eso se prueba entera sin nada.
//
// Dos eventos: { tipo: 'entra', estado } cuando cambia el estado, y
// { tipo: 'mira', carrera } cuando cambia la ingenieria que se esta mostrando.
// El resto de lo que hace falta saber (opciones, carrera, sesion) viaja en la
// salida, que se lee cuando se quiera.
//
// SE ELIGE UNA SOLA VEZ. Agarrar un objeto muestra su ingenieria y cierra la
// eleccion: a partir de ahi la carrera no cambia mas hasta que se vaya la
// persona. No hace falta un estado "ya elegiste" para eso —lo dice `carrera`,
// que deja de ser null— pero el efecto es el mismo: `mirar` no vuelve a mover
// nada, y quien dibuja apaga el carrusel.

export const ESTADOS = {
  ATRACCION: 'ATRACCION',
  ENGANCHE: 'ENGANCHE',
  HUMO: 'HUMO',
  EXPLORACION: 'EXPLORACION',
  CIERRE: 'CIERRE',
};

/** El ciclo, en orden. Lo usa avanzar() para saber cual sigue. */
const SIGUIENTE = {
  [ESTADOS.ATRACCION]: ESTADOS.ENGANCHE,
  [ESTADOS.ENGANCHE]: ESTADOS.HUMO,
  [ESTADOS.HUMO]: ESTADOS.EXPLORACION,
  [ESTADOS.EXPLORACION]: ESTADOS.CIERRE,
  [ESTADOS.CIERRE]: ESTADOS.ATRACCION,
};

/**
 * `sortearOpciones` devuelve las carreras que se le van a ofrecer a la persona,
 * una por objeto. Se llama al entrar al HUMO: mientras el humo tapa la pantalla
 * el espejo tiene tiempo de tener listos los PNG, y como todavia no se ve nada
 * no se cuenta el final.
 */
export function crearMaquina({ tiempos, sortearOpciones, manual = false }) {
  let estado = ESTADOS.ATRACCION;
  let desde = 0;
  let ausenteDesde = null;
  let rostroAusenteDesde = null;
  let rostroContinuoDesde = null;
  let inicioDeSesion = null;
  let finDeCierre = null;
  let opciones = [];
  let carrera = null;
  let miraDesde = null;
  let sesion = 0;
  let contada = false;
  let enManual = manual;

  function ir(nuevo, ahora, eventos) {
    estado = nuevo;
    desde = ahora;
    // Solo el enganche lleva cuenta de rostro continuo, y arranca al entrar.
    rostroContinuoDesde = nuevo === ESTADOS.ENGANCHE ? ahora : null;
    eventos.push({ tipo: 'entra', estado: nuevo });

    if (nuevo === ESTADOS.ATRACCION) {
      opciones = [];
      carrera = null;
      miraDesde = null;
      inicioDeSesion = null;
      contada = false;
    }
  }

  const salida = (eventos) => ({ estado, opciones, carrera, sesion, eventos });

  /**
   * Muestra una ingenieria. Devuelve true si de verdad cambio algo: volver a
   * agarrar el mismo objeto no reenvia nada, que es lo que evita que las
   * tablets de MAITE parpadeen mientras la mano tiembla sobre un blanco.
   */
  function mostrar(id, ahora, eventos) {
    if (!id || id === carrera) return false;

    carrera = id;
    miraDesde = ahora;
    // La sesion es la persona, no cada objeto que toca: se cuenta la primera
    // vez que mira algo y no vuelve a contarse hasta que el espejo se libera.
    if (!contada) {
      sesion += 1;
      contada = true;
    }
    eventos.push({ tipo: 'mira', carrera: id });
    return true;
  }

  return {
    estado: () => estado,
    opciones: () => opciones,
    carrera: () => carrera,
    sesion: () => sesion,
    desdeCuando: () => desde,
    /** Desde cuando se muestra la carrera actual. Es el reloj de su aparicion. */
    miraDesdeCuando: () => miraDesde,
    esManual: () => enManual,

    /** Alterna entre avanzar solo y avanzar a pedido. */
    alternarManual() {
      enManual = !enManual;
      return enManual;
    },

    /**
     * Pasa al estado siguiente del ciclo. Es lo que usa el modo manual, y en
     * automatico sirve para que el equipo del stand se saltee una espera.
     */
    avanzar(ahora) {
      const eventos = [];
      const proximo = SIGUIENTE[estado];

      if (proximo === ESTADOS.ENGANCHE) inicioDeSesion = ahora;
      if (proximo === ESTADOS.HUMO) opciones = sortearOpciones();
      // En manual no hay enfriamiento: si apreto el boton, quiero que arranque.
      if (proximo === ESTADOS.ATRACCION) finDeCierre = null;

      ausenteDesde = null;
      rostroAusenteDesde = null;

      ir(proximo, ahora, eventos);
      return salida(eventos);
    },

    /**
     * La persona sostuvo la mano sobre un objeto: se muestra su ingenieria.
     *
     * Solo vale durante la exploracion —en cualquier otro estado no hay nada
     * ofrecido y un llamado tardio, con la mano todavia puesta, no puede
     * revivir una sesion que ya termino— y SOLO LA PRIMERA VEZ. Una vez que la
     * persona tiene su ingenieria, la eleccion esta cerrada: los objetos
     * desaparecen de la pantalla y cualquier llamado posterior no mueve nada.
     *
     * La guarda vive aca y no en quien dibuja porque es una regla de la
     * experiencia, no del dibujo: sin ella, un `mirar` que llegara igual
     * reiniciaria el reloj del fondo y le mandaria otro aviso a MAITE.
     */
    mirar(id, ahora) {
      const eventos = [];
      if (estado !== ESTADOS.EXPLORACION || carrera !== null) return salida(eventos);

      ausenteDesde = null;
      rostroAusenteDesde = null;
      mostrar(id, ahora, eventos);
      return salida(eventos);
    },

    /**
     * `eligiendo` es "hay un sostenido en curso": la maquina no sabe que es una
     * mano, pero si necesita saber que alguien esta en la mitad de un gesto para
     * no cortarselo. Solo lo usa la red de la fila.
     */
    actualizar({
      hayRostro,
      puedeIniciar = hayRostro,
      hayPersona = hayRostro,
      eligiendo = false,
      ahora,
    }) {
      const eventos = [];

      if (hayPersona) ausenteDesde = null;
      else if (ausenteDesde === null) ausenteDesde = ahora;
      if (puedeIniciar) rostroAusenteDesde = null;
      else if (rostroAusenteDesde === null) rostroAusenteDesde = ahora;

      // En manual el reloj no decide nada: ni los tiempos de cada estado ni los
      // cortes por ausencia. Solo avanzar() y mirar() mueven la maquina.
      if (enManual) return salida(eventos);

      const seFue =
        !hayPersona && ausenteDesde !== null && ahora - ausenteDesde >= tiempos.ausenciaParaCortar;
      // EL ROSTRO ES LO QUE SOSTIENE LA SESION. Los hombros ya no alcanzan: en
      // cuanto la cara deja de reconocerse, y pasado el colchon que perdona un
      // giro de cabeza, el espejo vuelve a su pantalla inicial y queda libre
      // para el que sigue en la fila.
      const sePerdioElRostro =
        !puedeIniciar &&
        rostroAusenteDesde !== null &&
        ahora - rostroAusenteDesde >= tiempos.ausenciaParaCortar;
      const pasoElTope =
        inicioDeSesion !== null && ahora - inicioDeSesion >= tiempos.sesionMaxima;
      const transcurrido = ahora - desde;

      switch (estado) {
        case ESTADOS.ATRACCION:
          if (finDeCierre !== null && ahora - finDeCierre < tiempos.enfriamiento) break;
          if (puedeIniciar) {
            inicioDeSesion = ahora;
            ir(ESTADOS.ENGANCHE, ahora, eventos);
          }
          break;

        // Si se pierde el rostro durante el enganche, se espera la misma
        // tolerancia que en el resto de la experiencia. Las nubes solo vuelven
        // cuando la ausencia es real y sostenida; mientras tanto no se levanta
        // el humo frente a un lugar vacio.
        case ESTADOS.ENGANCHE:
          // El tope de sesion tambien vigila el enganche. Un rostro que aparece
          // y desaparece nunca junta los dos segundos continuos que hacen falta
          // para arrancar, y como la persona esta ahi tampoco acumula la ausencia
          // que corta: sin esto el espejo se queda destapado y quieto, que es
          // justo lo que la red de seguridad del stand existe para evitar.
          if (pasoElTope) {
            ir(ESTADOS.ATRACCION, ahora, eventos);
            break;
          }

          if (!puedeIniciar) {
            // El enganche exige rostro continuo. El reloj propio deja intacto
            // `desde`, que es lo que mide la transicion visual del estado.
            rostroContinuoDesde = null;
            if (sePerdioElRostro) ir(ESTADOS.ATRACCION, ahora, eventos);
            break;
          }

          if (rostroContinuoDesde === null) rostroContinuoDesde = ahora;
          if (ahora - rostroContinuoDesde >= tiempos.enganche) {
            // Las carreras se eligen aca, mientras el humo tapa la pantalla: ese
            // margen le sirve al espejo para tener listos los PNG y los fondos
            // cuando el humo se disipe.
            opciones = sortearOpciones();
            ir(ESTADOS.HUMO, ahora, eventos);
          }
          break;

        case ESTADOS.HUMO:
          if (seFue || sePerdioElRostro || pasoElTope) ir(ESTADOS.CIERRE, ahora, eventos);
          else if (transcurrido >= tiempos.humo) ir(ESTADOS.EXPLORACION, ahora, eventos);
          break;

        // La exploracion no tiene duracion propia: dura mientras la persona
        // siga sentada, mirando la ingenieria que le toco. El tope es la red de
        // seguridad de la fila — quien no entiende el gesto no puede dejar el
        // espejo tomado sin ver nada, asi que se le muestra una por sorteo. Y
        // como cierra la eleccion igual que agarrar un objeto, nadie se va sin
        // ingenieria ni se queda esperando delante de un carrusel que no
        // entiende.
        case ESTADOS.EXPLORACION:
          if (seFue || sePerdioElRostro || pasoElTope) {
            ir(ESTADOS.CIERRE, ahora, eventos);
            break;
          }
          // LA RED NO SE LE CAE ENCIMA A QUIEN YA ESTA ELIGIENDO. Como ahora
          // cerrar la eleccion es definitivo, vencer el plazo con la mano
          // sostenida sobre un objeto le robaria el gesto: se llevaria una
          // ingenieria sorteada que no eligio y sin poder corregirlo. Se espera
          // a que el sostenido termine o se suelte; el tope de sesion sigue
          // vigilando por detras, y un sostenido no puede durar para siempre
          // porque el anillo se vacia solo en cuanto la mano se va.
          if (carrera === null && !eligiendo && transcurrido >= tiempos.eleccionMaxima) {
            mostrar(opciones[0] ?? null, ahora, eventos);
          }
          break;

        case ESTADOS.CIERRE:
          if (transcurrido >= tiempos.cierre) {
            finDeCierre = ahora;
            ir(ESTADOS.ATRACCION, ahora, eventos);
          }
          break;
      }

      return salida(eventos);
    },

    forzarCarrera(id, ahora) {
      const eventos = [];
      inicioDeSesion = ahora;
      finDeCierre = null;
      ausenteDesde = null;
      rostroAusenteDesde = null;
      contada = false;
      carrera = null;
      // Sin opciones detras, la carrera forzada tiene que ser la que se pidio.
      opciones = [id];
      ir(ESTADOS.EXPLORACION, ahora, eventos);
      mostrar(id, ahora, eventos);
      return salida(eventos);
    },

    reiniciar(ahora) {
      const eventos = [];
      finDeCierre = null;
      ausenteDesde = null;
      rostroAusenteDesde = null;
      ir(ESTADOS.ATRACCION, ahora, eventos);
      return salida(eventos);
    },
  };
}
