// Agarrar un objeto no es de un modulo solo: es la cadena entera.
//
//   pose -> tablero (donde estan los blancos)
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
const OFRECIDAS = ['civil', 'quimica', 'naval', 'forestal', 'mecanica'];

// A 60 cuadros por segundo, que es el tope de dibujo del espejo.
const PASO = 1000 / 60;

const poseEn = (x, y, ancho = 380) => ({
  centroHombros: { x, y },
  anchoHombros: ancho,
});

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
  const mostradas = [];
  let primera = null;

  while (ahora <= empezo + hasta && maquina.estado() === ESTADOS.EXPLORACION) {
    const puesto = tablero.actualizar({
      pose: dondeLaPose(ahora),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: OFRECIDAS.length,
      // Igual que main.js: el arco se congela apenas empieza un sostenido.
      congelar: progreso > 0,
    });

    blancos = OFRECIDAS.map((id, i) => ({
      id,
      x: puesto.ubicaciones[i].x,
      y: puesto.ubicaciones[i].y,
      radio: puesto.radioObjeto,
    }));

    const palma = manoEn(ahora, blancos);
    const paso = eleccion.actualizar({
      manos: palma ? [{ palma, radio: 90 }] : [],
      objetivos: blancos,
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
    progreso,
    mostradas,
    transcurrido: (primera ?? ahora) - empezo,
  };
}

describe('agarrar un objeto', () => {
  it('sostener la mano sobre un objeto muestra esa ingenieria', () => {
    const { maquina, transcurrido } = correr({
      manoEn: (_ahora, blancos) => ({ x: blancos[2].x, y: blancos[2].y }),
      hasta: 6000,
    });

    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.carrera()).toBe(OFRECIDAS[2]);
    // Y no tarda un mundo: el plazo de config mas un cuadro o dos.
    expect(transcurrido).toBeLessThan(CONFIG.eleccion.msParaElegir + 200);
  });

  // ESTO ES LO QUE HACE LA EXPERIENCIA. Agarrar un objeto muestra su
  // ingenieria; soltarlo la deja puesta; agarrar otro la reemplaza. Sin esta
  // cadena andando, la persona ve una sola de las cinco y se termina ahi.
  it('soltar y agarrar otro objeto muestra la segunda ingenieria', () => {
    let base = null;

    const { maquina, mostradas } = correr({
      // Dos segundos y medio sobre el primero, uno con la mano baja —mas que la
      // gracia y el olvido juntos, o sea soltar de verdad— y el resto sobre otro.
      manoEn: (ahora, blancos) => {
        base ??= ahora;
        const t = ahora - base;
        if (t < 2500) return { x: blancos[0].x, y: blancos[0].y };
        if (t < 3500) return null;
        return { x: blancos[4].x, y: blancos[4].y };
      },
      hasta: 8000,
      pararAlMostrar: false,
    });

    expect(mostradas).toEqual([OFRECIDAS[0], OFRECIDAS[4]]);
    expect(maquina.carrera()).toBe(OFRECIDAS[4]);
    // Una sola persona, aunque haya mirado dos ingenierias.
    expect(maquina.sesion()).toBe(1);
  });

  // Con la mano quieta encima, el elegido se repite cuadro a cuadro. Si cada
  // repeticion contara, MAITE recibiria cien avisos por segundo y las tablets
  // no pararian de parpadear.
  it('la mano quieta no vuelve a avisar la misma ingenieria', () => {
    const { mostradas } = correr({
      manoEn: (_ahora, blancos) => ({ x: blancos[2].x, y: blancos[2].y }),
      hasta: 8000,
      pararAlMostrar: false,
    });

    expect(mostradas).toEqual([OFRECIDAS[2]]);
  });

  // Es el caso que decide si el sostenido es usable: la deteccion de manos se
  // pierde varios cuadros por segundo con la mano de costado o mal iluminada. Si
  // eso vaciara el progreso, en el stand no elegiria nadie.
  it('sobrevive a una deteccion de manos que parpadea', () => {
    const { maquina } = correr({
      // Tres cuadros con mano, uno sin. Es el peor caso realista.
      manoEn: (ahora, blancos) =>
        Math.floor(ahora / PASO) % 4 === 3 ? null : { x: blancos[1].x, y: blancos[1].y },
      hasta: 8000,
    });

    expect(maquina.carrera()).toBe(OFRECIDAS[1]);
  });

  // La otra punta: pasar la mano por delante mirando los objetos no puede
  // elegir. Si eligiera, nadie llegaria a ver las cinco opciones.
  it('pasar la mano por encima de todos no muestra ninguna', () => {
    const { maquina, progreso } = correr({
      // Recorre los cinco blancos, quedandose 400 ms en cada uno.
      manoEn: (ahora, blancos) => {
        const cual = Math.floor(ahora / 400) % blancos.length;
        return { x: blancos[cual].x, y: blancos[cual].y };
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
  // y si el arco los siguiera, el blanco se correria de abajo de la propia mano:
  // elegir seria perseguir un objeto que se escapa.
  it('inclinarse mientras sostenes no te mueve el blanco', () => {
    let palmaFija = null;

    const { maquina } = correr({
      // La persona se va corriendo hacia un lado mientras sostiene.
      poseEn: (ahora) => poseEn(540 + Math.min(300, ahora / 20), 1300),
      manoEn: (_ahora, blancos) => {
        // La mano se apoya una vez sobre el blanco y no se mueve mas.
        palmaFija ??= { x: blancos[3].x, y: blancos[3].y };
        return palmaFija;
      },
      hasta: 6000,
    });

    expect(maquina.carrera()).toBe(OFRECIDAS[3]);
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

  // Cinco objetos en el arco y un blanco generoso no pueden dar dos blancos
  // superpuestos: ahi el de al lado se vuelve inelegible. Con los objetos mas
  // chicos hay mas aire, pero el que se calibra es el alcance, no el dibujo.
  it('el blanco generoso no hace que dos objetos se pisen', () => {
    const tablero = crearTablero(CONFIG.tablero);
    let puesto = null;
    for (let i = 0; i < 400; i++) {
      puesto = tablero.actualizar({
        pose: poseEn(540, 1400),
        rostro: null,
        disposicion: PANTALLA,
        cantidad: CONFIG.eleccion.cantidad,
      });
    }

    const alcance = puesto.radioObjeto * CONFIG.eleccion.radioFactor;
    for (let i = 1; i < puesto.ubicaciones.length; i++) {
      const a = puesto.ubicaciones[i - 1];
      const b = puesto.ubicaciones[i];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(alcance);
    }
  });
});
