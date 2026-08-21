// Elegir un objeto no es de un modulo solo: es la cadena entera.
//
//   pose -> tablero (donde estan los blancos)
//        -> eleccion (cuanto lleva la mano encima)
//        -> maquina de estados (la carrera queda elegida)
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
 */
function correr({ manoEn, poseEn: dondeLaPose = () => poseEn(540, 1300), hasta }) {
  const tablero = crearTablero(CONFIG.tablero);
  const eleccion = crearEleccion(CONFIG.eleccion);
  const maquina = crearMaquina({
    tiempos: CONFIG.tiempos,
    sortearOpciones: () => [...OFRECIDAS],
  });

  // Se deja llegar hasta la eleccion con la persona sentada y quieta.
  let ahora = 0;
  while (maquina.estado() !== ESTADOS.ELECCION && ahora <= 20000) {
    maquina.actualizar({ hayRostro: true, ahora });
    ahora += PASO;
  }
  expect(maquina.estado()).toBe(ESTADOS.ELECCION);

  const empezo = ahora;
  let progreso = 0;
  let blancos = [];

  while (ahora <= empezo + hasta && maquina.estado() === ESTADOS.ELECCION) {
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
    if (paso.elegido) maquina.elegir(paso.elegido, ahora);

    maquina.actualizar({ hayRostro: true, ahora });
    ahora += PASO;
  }

  return { maquina, blancos, progreso, transcurrido: ahora - empezo };
}

describe('elegir un objeto', () => {
  it('sostener la mano sobre un objeto elige esa carrera', () => {
    const { maquina, transcurrido } = correr({
      manoEn: (_ahora, blancos) => ({ x: blancos[2].x, y: blancos[2].y }),
      hasta: 6000,
    });

    expect(maquina.estado()).toBe(ESTADOS.REVELACION);
    expect(maquina.carrera()).toBe(OFRECIDAS[2]);
    // Y no tarda un mundo: el plazo de config mas un cuadro o dos.
    expect(transcurrido).toBeLessThan(CONFIG.eleccion.msParaElegir + 200);
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

    expect(maquina.estado()).toBe(ESTADOS.REVELACION);
    expect(maquina.carrera()).toBe(OFRECIDAS[1]);
  });

  // La otra punta: pasar la mano por delante mirando los objetos no puede
  // elegir. Si eligiera, nadie llegaria a ver las cinco opciones.
  it('pasar la mano por encima de todos no elige ninguno', () => {
    const { maquina, progreso } = correr({
      // Recorre los cinco blancos, quedandose 400 ms en cada uno.
      manoEn: (ahora, blancos) => {
        const cual = Math.floor(ahora / 400) % blancos.length;
        return { x: blancos[cual].x, y: blancos[cual].y };
      },
      hasta: 8000,
    });

    expect(maquina.estado()).toBe(ESTADOS.ELECCION);
    expect(maquina.carrera()).toBeNull();
    expect(progreso).toBeLessThan(1);
  });

  it('con la mano lejos no pasa nada', () => {
    const { maquina, progreso } = correr({
      manoEn: () => ({ x: 40, y: 1900 }),
      hasta: 8000,
    });

    expect(maquina.estado()).toBe(ESTADOS.ELECCION);
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

    expect(maquina.estado()).toBe(ESTADOS.REVELACION);
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
  // superpuestos: ahi el de al lado se vuelve inelegible.
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
