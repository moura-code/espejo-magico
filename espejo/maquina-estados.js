// La maquina de estados de la experiencia. No dibuja nada, no sabe de camaras y
// no habla con la red: recibe "hay rostro si o no" mas un reloj, y devuelve el
// estado y los eventos que hay que atender. Por eso se prueba entera sin nada.
//
// Eventos:
//   { tipo: 'entra',   estado }        cambio de estado
//   { tipo: 'carrera', id, sesion }    anunciar la carrera a las tablets
//   { tipo: 'reposo' }                 apagar las tablets

export const ESTADOS = {
  ATRACCION: 'ATRACCION',
  ENGANCHE: 'ENGANCHE',
  SORTEO: 'SORTEO',
  REVELACION: 'REVELACION',
  ESCENA: 'ESCENA',
  CIERRE: 'CIERRE',
};

/** El ciclo, en orden. Lo usa avanzar() para saber cual sigue. */
const SIGUIENTE = {
  [ESTADOS.ATRACCION]: ESTADOS.ENGANCHE,
  [ESTADOS.ENGANCHE]: ESTADOS.SORTEO,
  [ESTADOS.SORTEO]: ESTADOS.REVELACION,
  [ESTADOS.REVELACION]: ESTADOS.ESCENA,
  [ESTADOS.ESCENA]: ESTADOS.CIERRE,
  [ESTADOS.CIERRE]: ESTADOS.ATRACCION,
};

export function crearMaquina({ tiempos, sortear, manual = false }) {
  let estado = ESTADOS.ATRACCION;
  let desde = 0;
  let ausenteDesde = null;
  let rostroAusenteDesde = null;
  let rostroContinuoDesde = null;
  let inicioDeSesion = null;
  let finDeCierre = null;
  let carrera = null;
  let sesion = 0;
  let enManual = manual;

  function ir(nuevo, ahora, eventos) {
    const anterior = estado;
    estado = nuevo;
    desde = ahora;
    // Solo el enganche lleva cuenta de rostro continuo, y arranca al entrar.
    rostroContinuoDesde = nuevo === ESTADOS.ENGANCHE ? ahora : null;
    eventos.push({ tipo: 'entra', estado: nuevo });

    if (nuevo === ESTADOS.REVELACION) {
      sesion += 1;
      eventos.push({ tipo: 'carrera', id: carrera, sesion });
    }
    if (nuevo === ESTADOS.ATRACCION) {
      // Las tablets acompañan el cierre visual y se apagan cuando las nubes ya
      // terminaron de cubrir el espejo, no cuatro segundos antes.
      if (anterior === ESTADOS.CIERRE) eventos.push({ tipo: 'reposo' });
      carrera = null;
      inicioDeSesion = null;
    }
  }

  const salida = (eventos) => ({ estado, carrera, sesion, eventos });

  return {
    estado: () => estado,
    carrera: () => carrera,
    sesion: () => sesion,
    desdeCuando: () => desde,
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
      if (proximo === ESTADOS.SORTEO) carrera = sortear();
      // En manual no hay enfriamiento: si apreto el boton, quiero que arranque.
      if (proximo === ESTADOS.ATRACCION) finDeCierre = null;

      ausenteDesde = null;
      rostroAusenteDesde = null;
      ir(proximo, ahora, eventos);
      return salida(eventos);
    },

    actualizar({ hayRostro, puedeIniciar = hayRostro, hayPersona = hayRostro, ahora }) {
      const eventos = [];

      if (hayPersona) ausenteDesde = null;
      else if (ausenteDesde === null) ausenteDesde = ahora;
      if (puedeIniciar) rostroAusenteDesde = null;
      else if (rostroAusenteDesde === null) rostroAusenteDesde = ahora;

      // En manual el reloj no decide nada: ni los tiempos de cada estado ni los
      // cortes por ausencia. Solo avanzar() mueve la maquina.
      if (enManual) return salida(eventos);

      const seFue =
        !hayPersona && ausenteDesde !== null && ahora - ausenteDesde >= tiempos.ausenciaParaCortar;
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
        // cuando la ausencia es real y sostenida; mientras tanto no se inicia
        // el sorteo frente a un lugar vacio.
        case ESTADOS.ENGANCHE:
          if (!puedeIniciar) {
            // El enganche exige rostro continuo. Una pose mantiene viva una
            // sesion ya iniciada, pero no acumula tiempo para comenzar otra.
            // El reloj propio deja intacto `desde`, que es lo que mide la
            // transicion visual del estado.
            rostroContinuoDesde = null;
            if (sePerdioElRostro) ir(ESTADOS.ATRACCION, ahora, eventos);
            break;
          }

          if (rostroContinuoDesde === null) rostroContinuoDesde = ahora;
          if (ahora - rostroContinuoDesde >= tiempos.enganche) {
            // La carrera se elige aca, tres segundos antes de anunciarla: ese
            // margen le sirve al espejo para tener listos los PNG cuando se
            // despeje la niebla. El mensaje a las tablets sale en REVELACION,
            // porque mandarlo antes seria contar el final.
            carrera = sortear();
            ir(ESTADOS.SORTEO, ahora, eventos);
          }
          break;

        case ESTADOS.SORTEO:
          if (seFue || pasoElTope) ir(ESTADOS.CIERRE, ahora, eventos);
          else if (transcurrido >= tiempos.sorteo) ir(ESTADOS.REVELACION, ahora, eventos);
          break;

        case ESTADOS.REVELACION:
          if (seFue || pasoElTope) ir(ESTADOS.CIERRE, ahora, eventos);
          else if (transcurrido >= tiempos.revelacion) ir(ESTADOS.ESCENA, ahora, eventos);
          break;

        // La escena es de la persona, no del reloj: dura mientras siga sentada.
        // Se corta cuando se va, o al tope de sesion, que queda como red de
        // seguridad del stand (y como rotacion de la fila en horas pico).
        case ESTADOS.ESCENA:
          if (seFue || pasoElTope) {
            ir(ESTADOS.CIERRE, ahora, eventos);
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
      carrera = id;
      inicioDeSesion = ahora;
      finDeCierre = null;
      ausenteDesde = null;
      rostroAusenteDesde = null;
      ir(ESTADOS.REVELACION, ahora, eventos);
      return salida(eventos);
    },

    reiniciar(ahora) {
      const eventos = [];
      finDeCierre = null;
      ausenteDesde = null;
      rostroAusenteDesde = null;
      ir(ESTADOS.ATRACCION, ahora, eventos);
      // Si ya estaba cerrando, ir() ya anuncio el reposo. Desde cualquier otro
      // estado la sesion se corta a mitad de camino y hay que anunciarlo igual,
      // siempre despues del `entra` para no dejar dos ordenes posibles.
      if (!eventos.some((evento) => evento.tipo === 'reposo')) {
        eventos.push({ tipo: 'reposo' });
      }
      return salida(eventos);
    },
  };
}
