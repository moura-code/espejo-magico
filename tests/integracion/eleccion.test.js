// Agarrar un objeto no es de un modulo solo: es la cadena entera.
//
//   pose -> tablero (donde estan los blancos, y como giran)
//        -> eleccion (cuanto lleva la mano encima)
//        -> maquina de estados (la ingenieria queda mostrada)
//
// Cada pieza por separado se ve razonable; mal calibradas juntas dan un espejo
// donde el objeto se escapa de abajo de la mano, o donde elegis sin querer al
// estirar el brazo. Por eso esta prueba usa la CONFIG de verdad y arma la misma
// cadena que main.js.

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../espejo/config.js';
import { crearTablero } from '../../espejo/tablero.js';
import { crearEleccion } from '../../espejo/eleccion.js';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

const PANTALLA = { ancho: 1080, alto: 1920 };
const OFRECIDAS = [
  'civil',
  'quimica',
  'naval',
  'forestal',
  'mecanica',
  'electrica',
  'computacion',
  'fisico-matematico',
  'alimentos',
  'produccion',
  'agrimensura',
  'comunicacion',
];

// A 60 cuadros por segundo, que es el tope de dibujo del espejo.
const PASO = 1000 / 60;

const poseEn = (x, y, ancho = 380) => ({
  centroHombros: { x, y },
  anchoHombros: ancho,
});

/** Los blancos que se pueden agarrar: las ranuras enteras dentro de la ventana. */
const enteros = (blancos) => blancos.filter((b) => b.alfa === 1);

/**
 * Corre la cadena como lo hace main.js. `manoEn` recibe el reloj y los blancos
 * de este cuadro y devuelve donde esta la palma, o null si no se ve la mano.
 *
 * `pararAlMostrar` corta apenas aparece la primera ingenieria, que es lo que
 * hace falta para medir cuanto tardo el sostenido. Puesto en false corre la
 * ventana entera, que es como se prueba recorrer varias.
 */
function correr({
  manoEn,
  poseEn: dondeLaPose = () => poseEn(540, 1300),
  hasta,
  pararAlMostrar = true,
}) {
  const tablero = crearTablero(CONFIG.tablero);
  const eleccion = crearEleccion(CONFIG.eleccion);
  const maquina = crearMaquina({
    tiempos: CONFIG.tiempos,
    sortearOpciones: () => [...OFRECIDAS],
  });

  // Se deja llegar hasta la exploracion con la persona sentada y quieta.
  let ahora = 0;
  while (maquina.estado() !== ESTADOS.EXPLORACION && ahora <= 20000) {
    maquina.actualizar({ hayRostro: true, ahora });
    ahora += PASO;
  }
  expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);

  const empezo = ahora;
  let progreso = 0;
  let blancos = [];
  const fases = [];
  const mostradas = [];
  let primera = null;

  while (ahora <= empezo + hasta && maquina.estado() === ESTADOS.EXPLORACION) {
    const puesto = tablero.actualizar({
      pose: dondeLaPose(ahora),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: OFRECIDAS.length,
      // Igual que main.js: el anillo se congela apenas empieza un sostenido, y
      // TAMBIEN para siempre en cuanto hay carrera. Si esta segunda mitad no
      // estuviera aca, borrarla de main.js dejaria el carrusel girando debajo
      // del objeto apoyado toda la sesion y la suite seguiria en verde.
      congelar: progreso > 0 || Boolean(maquina.carrera()),
      dt: PASO / 1000,
    });
    fases.push(puesto.fase);

    blancos = OFRECIDAS.map((id, i) => ({
      id,
      x: puesto.ubicaciones[i].x,
      y: puesto.ubicaciones[i].y,
      radio: puesto.radioObjeto,
      alfa: puesto.ubicaciones[i].alfa,
    }));

    const palma = manoEn(ahora, blancos);
    const paso = eleccion.actualizar({
      manos: palma ? [{ palma, radio: 90 }] : [],
      objetivos: enteros(blancos),
      ahora,
    });
    progreso = paso.progreso;

    if (paso.elegido) {
      // La maquina descarta el repetido: solo quedan los cambios de verdad.
      for (const evento of maquina.mirar(paso.elegido, ahora).eventos) {
        if (evento.tipo !== 'mira') continue;
        mostradas.push(evento.carrera);
        primera ??= ahora;
      }
    }

    maquina.actualizar({ hayRostro: true, ahora });
    ahora += PASO;
    if (pararAlMostrar && mostradas.length > 0) break;
  }

  return {
    maquina,
    blancos,
    fases,
    progreso,
    mostradas,
    transcurrido: (primera ?? ahora) - empezo,
  };
}

/** La mano se apoya sobre el `n`-esimo blanco entero y lo sigue. */
const sobreElEntero = (n) => (_ahora, blancos) => {
  const b = enteros(blancos)[n];
  return b ? { x: b.x, y: b.y } : null;
};

describe('agarrar un objeto', () => {
  it('sostener la mano sobre un objeto muestra esa ingenieria', () => {
    let agarrado = null;
    const { maquina, transcurrido } = correr({
      manoEn: (ahora, blancos) => {
        agarrado ??= enteros(blancos)[2].id;
        return sobreElEntero(2)(ahora, blancos);
      },
      hasta: 6000,
    });

    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.carrera()).toBe(agarrado);
    // Y no tarda un mundo: el plazo de config mas un cuadro o dos.
    expect(transcurrido).toBeLessThan(CONFIG.eleccion.msParaElegir + 200);
  });

  // SE ELIGE UNA SOLA VEZ, y esta es la punta a punta de esa regla. El sostenido
  // sobre el segundo objeto se completa igual —eleccion.js no sabe que es una
  // carrera y sigue haciendo su trabajo— y la maquina lo descarta. Se prueba con
  // la cadena entera y sin la guarda de main.js a proposito: si la regla
  // dependiera de que quien dibuja deje de ofrecer objetos, cualquier camino que
  // se saltee ese apagado —un atajo, un cuadro de mas— cambiaria la ingenieria
  // de alguien que ya la estaba mirando.
  it('soltar y agarrar otro objeto ya no cambia la ingenieria', () => {
    let base = null;
    const agarrados = [];
    const { msParaElegir, msDeGracia, msDeOlvido } = CONFIG.eleccion;
    // Mas que el sostenido sobre el primero; despues la mano baja mas que la
    // gracia y el olvido juntos —o sea que suelta de verdad— y el resto va
    // sobre otro, tanto como para completarlo.
    const primero = msParaElegir + 1000;
    const suelta = primero + msDeGracia + msDeOlvido + 500;

    const { maquina, mostradas } = correr({
      manoEn: (ahora, blancos) => {
        base ??= ahora;
        const t = ahora - base;
        const cual = t < primero ? 0 : t < suelta ? null : 2;
        if (cual === null) return null;
        const b = enteros(blancos)[cual];
        if (!agarrados.includes(b.id)) agarrados.push(b.id);
        return { x: b.x, y: b.y };
      },
      hasta: suelta + msParaElegir + 1500,
      pararAlMostrar: false,
    });

    // La mano paso por los dos objetos, pero solo el primero cuenta.
    expect(agarrados).toHaveLength(2);
    expect(mostradas).toEqual([agarrados[0]]);
    expect(maquina.carrera()).toBe(agarrados[0]);
    expect(maquina.sesion()).toBe(1);
  });

  // El carrusel se para al elegir y NO vuelve a girar: se elige una sola vez, y
  // un anillo que sigue girando detras del objeto apoyado dice lo contrario.
  it('el carrusel se detiene al elegir y no vuelve a girar', () => {
    const { fases, mostradas } = correr({
      manoEn: sobreElEntero(1),
      hasta: 8000,
      pararAlMostrar: false,
    });

    expect(mostradas).toHaveLength(1);
    // Antes de elegir gira; despues, la fase no se mueve mas.
    expect(Math.max(...fases) - Math.min(...fases)).toBeGreaterThan(0);
    const ultimas = fases.slice(-20);
    expect(Math.max(...ultimas) - Math.min(...ultimas)).toBe(0);
  });

  // Con la mano quieta encima, el elegido se repite cuadro a cuadro. Si cada
  // repeticion contara, MAITE recibiria cien avisos por segundo y las tablets
  // no pararian de parpadear.
  it('la mano quieta no vuelve a avisar la misma ingenieria', () => {
    const { mostradas } = correr({
      manoEn: sobreElEntero(2),
      hasta: 8000,
      pararAlMostrar: false,
    });

    expect(mostradas).toHaveLength(1);
  });

  // Es el caso que decide si el sostenido es usable: la deteccion de manos se
  // pierde varios cuadros por segundo con la mano de costado o mal iluminada. Si
  // eso vaciara el progreso, en el stand no elegiria nadie.
  it('sobrevive a una deteccion de manos que parpadea', () => {
    const { maquina } = correr({
      // Tres cuadros con mano, uno sin. Es el peor caso realista.
      manoEn: (ahora, blancos) =>
        Math.floor(ahora / PASO) % 4 === 3 ? null : sobreElEntero(1)(ahora, blancos),
      hasta: 8000,
    });

    expect(maquina.carrera()).not.toBeNull();
  });

  // La otra punta: pasar la mano por delante mirando los objetos no puede
  // elegir. Si eligiera, nadie llegaria a ver las opciones.
  it('pasar la mano por encima de todos no muestra ninguna', () => {
    const { maquina, progreso } = correr({
      // Recorre los blancos enteros, quedandose 400 ms en cada uno.
      manoEn: (ahora, blancos) => {
        const lista = enteros(blancos);
        const b = lista[Math.floor(ahora / 400) % lista.length];
        return { x: b.x, y: b.y };
      },
      hasta: 8000,
    });

    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.carrera()).toBeNull();
    expect(progreso).toBeLessThan(1);
  });

  it('con la mano lejos no pasa nada', () => {
    const { maquina, progreso } = correr({
      manoEn: () => ({ x: 40, y: 1900 }),
      hasta: 8000,
    });

    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.carrera()).toBeNull();
    expect(progreso).toBe(0);
  });

  // EL MOTIVO DE QUE EL TABLERO SE CONGELE. Estirar el brazo mueve los hombros,
  // y si el anillo los siguiera, el blanco se correria de abajo de la propia
  // mano: elegir seria perseguir un objeto que se escapa.
  it('inclinarse mientras sostenes no te mueve el blanco', () => {
    let palmaFija = null;
    let agarrado = null;

    const { maquina } = correr({
      // La persona se va corriendo hacia un lado mientras sostiene.
      poseEn: (ahora) => poseEn(540 + Math.min(300, ahora / 20), 1300),
      manoEn: (_ahora, blancos) => {
        // La mano se apoya una vez sobre el blanco y no se mueve mas.
        if (!palmaFija) {
          const b = enteros(blancos)[1];
          palmaFija = { x: b.x, y: b.y };
          agarrado = b.id;
        }
        return palmaFija;
      },
      hasta: 6000,
    });

    expect(maquina.carrera()).toBe(agarrado);
  });
});

describe('el carrusel', () => {
  // LA PRUEBA QUE PIDE LA CATEDRA, DE PUNTA A PUNTA. Con la mano sobre un
  // objeto y el anillo llenandose, el carrusel se detiene; si la mano se va
  // antes de completar, sigue girando.
  it('se detiene mientras se sostiene y sigue girando si la mano se va antes', () => {
    let base = null;
    let palmaFija = null;

    const { fases, maquina } = correr({
      manoEn: (ahora, blancos) => {
        base ??= ahora;
        const t = ahora - base;
        // Un segundo libre, medio segundo apoyada (menos que msParaElegir), y
        // el resto libre.
        if (t < 1000 || t >= 1500) return null;
        if (!palmaFija) {
          const b = enteros(blancos)[2];
          palmaFija = { x: b.x, y: b.y };
        }
        return palmaFija;
      },
      hasta: 4000,
      pararAlMostrar: false,
    });

    const cuadro = (ms) => Math.round(ms / PASO);
    const giro = (desde, hasta) => (fases[cuadro(hasta)] - fases[cuadro(desde)] + 360) % 360;

    // Libre: gira. Apoyada: quieto. Suelta y vaciado el anillo: gira de nuevo.
    expect(giro(0, 900)).toBeGreaterThan(5);
    expect(giro(1100, 1450)).toBe(0);
    expect(giro(2600, 3900)).toBeGreaterThan(5);
    expect(maquina.carrera()).toBeNull();
  });

  // Una ranura a medio entrar o a medio salir no es un blanco: la mano encima
  // no llena nada y el carrusel no se para.
  it('una ranura que esta entrando no se puede agarrar', () => {
    const { fases, maquina } = correr({
      manoEn: (_ahora, blancos) => {
        const aMedias = blancos.find((b) => b.alfa > 0 && b.alfa < 1);
        return aMedias ? { x: aMedias.x, y: aMedias.y } : null;
      },
      hasta: 1000,
      pararAlMostrar: false,
    });

    expect(maquina.carrera()).toBeNull();
    expect((fases.at(-1) - fases[0] + 360) % 360).toBeGreaterThan(5);
  });

  // Con la carga larga, un objeto que gira cruza el blanco de una mano quieta
  // bastante antes de que el anillo se llene. No importa, y es a proposito:
  // apenas la mano esta encima el carrusel se detiene, asi que sostener mas
  // tiempo nunca obliga a perseguir nada.
  it('con la mano quieta, el sostenido largo se completa porque el carrusel se detiene', () => {
    let palmaFija = null;
    let agarrado = null;

    const { maquina } = correr({
      manoEn: (_ahora, blancos) => {
        if (!palmaFija) {
          const b = enteros(blancos)[2];
          palmaFija = { x: b.x, y: b.y };
          agarrado = b.id;
        }
        return palmaFija;
      },
      hasta: CONFIG.eleccion.msParaElegir + 2000,
    });

    expect(maquina.carrera()).toBe(agarrado);
  });
});

describe('la calibracion del sostenido', () => {
  // Con la mano a 34 cuadros por segundo, el plazo tiene que valer muchos
  // cuadros: si fuera de dos o tres, una deteccion suelta elegiria sola.
  it('el plazo dura muchos cuadros de deteccion de manos', () => {
    const msPorCuadro = 1000 / CONFIG.manos.fps;
    expect(CONFIG.eleccion.msParaElegir / msPorCuadro).toBeGreaterThan(20);
  });

  // Vaciarse mas lento que llenarse convertiria un roce en una eleccion: te
  // alcanzaria con tocar el blanco de a ratos. Y vaciarse instantaneo haria que
  // el temblor de la deteccion no dejara llenar nunca.
  it('se vacia mas rapido de lo que se llena, pero no de golpe', () => {
    expect(CONFIG.eleccion.msDeOlvido).toBeLessThan(CONFIG.eleccion.msParaElegir);
    expect(CONFIG.eleccion.msDeOlvido).toBeGreaterThan(200);
  });

  // LO QUE PIDIO LA CATEDRA: mas "tiempo de carga". Una eleccion que se cierra
  // en un segundo y medio se siente apurada, y como se elige una sola vez, un
  // gesto apurado es una ingenieria que no se eligio del todo.
  it('la carga es pausada: con la mano quieta, el anillo tarda al menos dos segundos y medio', () => {
    const { mostradas, transcurrido } = correr({ manoEn: sobreElEntero(1), hasta: 8000 });
    expect(mostradas).toHaveLength(1);
    expect(transcurrido).toBeGreaterThanOrEqual(2500);
  });

  // Doce objetos en el anillo y un blanco generoso no pueden dar dos blancos
  // superpuestos: ahi el de al lado se vuelve inelegible.
  it('el blanco generoso no hace que dos objetos se pisen', () => {
    const tablero = crearTablero(CONFIG.tablero);
    let puesto = null;
    for (let i = 0; i < 400; i++) {
      puesto = tablero.actualizar({
        pose: poseEn(540, 1400),
        rostro: null,
        disposicion: PANTALLA,
        cantidad: OFRECIDAS.length,
      });
    }

    const alcance = puesto.radioObjeto * CONFIG.eleccion.radioFactor;
    const u = puesto.ubicaciones;
    for (let i = 0; i < u.length; i++) {
      const a = u[i];
      const b = u[(i + 1) % u.length];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(alcance);
    }
  });
});
