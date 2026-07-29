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
  let inicioDeSesion = null;
  let finDeCierre = null;
  let carrera = null;
  let sesion = 0;
  let enManual = manual;

  function ir(nuevo, ahora, eventos) {
    estado = nuevo;
    desde = ahora;
    eventos.push({ tipo: 'entra', estado: nuevo });

    if (nuevo === ESTADOS.REVELACION) {
      sesion += 1;
      eventos.push({ tipo: 'carrera', id: carrera, sesion });
    }
    if (nuevo === ESTADOS.CIERRE) {
      eventos.push({ tipo: 'reposo' });
    }
    if (nuevo === ESTADOS.ATRACCION) {
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
      ir(proximo, ahora, eventos);
      return salida(eventos);
    },

    actualizar({ hayRostro, ahora }) {
      const eventos = [];

      if (hayRostro) ausenteDesde = null;
      else if (ausenteDesde === null) ausenteDesde = ahora;

      // En manual el reloj no decide nada: ni los tiempos de cada estado ni los
      // cortes por ausencia. Solo avanzar() mueve la maquina.
      if (enManual) return salida(eventos);

      const seFue =
        !hayRostro && ausenteDesde !== null && ahora - ausenteDesde >= tiempos.ausenciaParaCortar;
      const pasoElTope =
        inicioDeSesion !== null && ahora - inicioDeSesion >= tiempos.sesionMaxima;
      const transcurrido = ahora - desde;

      switch (estado) {
        case ESTADOS.ATRACCION:
          if (finDeCierre !== null && ahora - finDeCierre < tiempos.enfriamiento) break;
          if (hayRostro) {
            inicioDeSesion = ahora;
            ir(ESTADOS.ENGANCHE, ahora, eventos);
          }
          break;

        // El enganche aborta apenas se pierde el rostro, sin esperar los tres
        // segundos de tolerancia. Esos tres segundos son para alguien que ya vio
        // su carrera y se movio; aca todavia no paso nada, y esperar significaria
        // arrancar un sorteo frente a un sillon vacio. Los parpadeos cortos ya
        // los absorbe la histeresis, asi que la señal llega limpia.
        case ESTADOS.ENGANCHE:
          if (!hayRostro) {
            ir(ESTADOS.ATRACCION, ahora, eventos);
          } else if (transcurrido >= tiempos.enganche) {
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

        case ESTADOS.ESCENA:
          if (seFue || pasoElTope || transcurrido >= tiempos.escena) {
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
      ir(ESTADOS.REVELACION, ahora, eventos);
      return salida(eventos);
    },

    reiniciar(ahora) {
      const eventos = [{ tipo: 'reposo' }];
      finDeCierre = null;
      ausenteDesde = null;
      ir(ESTADOS.ATRACCION, ahora, eventos);
      return salida(eventos);
    },
  };
}
