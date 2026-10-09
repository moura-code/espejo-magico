// La estabilidad de una sesion no vive en un modulo: vive en la relacion entre
// CONFIG.presencia (cuanto aguanta la histeresis antes de dar a alguien por ido)
// y CONFIG.tiempos (cuanto aguanta la maquina sin presencia antes de cortar).
// Cada uno por separado se ve razonable; juntos y mal calibrados hacen que el
// espejo se reinicie con la persona sentada delante.
//
// Por eso esta prueba usa la CONFIG de verdad y arma la misma cadena que main.js:
//
//   deteccion cruda -> histeresis -> maquina de estados
//
// Si alguien vuelve a bajar los margenes, esto se pone en rojo.

import { describe, it, expect } from 'vitest';
import { CONFIG } from '../../espejo/config.js';
import { crearHisteresis } from '../../espejo/suavizado.js';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

/**
 * Corre el ciclo del espejo con una señal de deteccion cruda dada. `hayPoseEn`
 * es la otra señal: por defecto acompaña al rostro, y se separa para probar el
 * caso de la cara girada con los hombros todavia a la vista.
 */
function correr({ hayRostroEn, hayPoseEn = hayRostroEn, hasta, paso = 50, elegir = false }) {
  const histeresis = crearHisteresis(CONFIG.presencia);
  const histeresisDeRostro = crearHisteresis(CONFIG.presencia);
  const maquina = crearMaquina({
    tiempos: CONFIG.tiempos,
    sortearOpciones: () => ['civil', 'quimica', 'naval', 'forestal', 'mecanica'],
  });
  const entradas = [];
  const miradas = [];

  for (let ahora = 0; ahora <= hasta; ahora += paso) {
    const crudoRostro = Boolean(hayRostroEn(ahora));
    const crudoPersona = Boolean(hayPoseEn(ahora)) || crudoRostro;
    const registrar = (salida) => {
      for (const evento of salida.eventos) {
        if (evento.tipo === 'entra') entradas.push({ estado: evento.estado, ahora });
        if (evento.tipo === 'mira') miradas.push({ carrera: evento.carrera, ahora });
      }
    };
    const salida = maquina.actualizar({
      puedeIniciar: histeresisDeRostro.actualizar(crudoRostro, ahora),
      hayPersona: histeresis.actualizar(crudoPersona, ahora),
      ahora,
    });
    registrar(salida);

    // Una visita completada simula la elección normal apenas aparece el
    // carrusel: estas pruebas buscan tolerancia de presencia, y con una
    // carrera elegida la sesion es la de cualquier persona que se sienta.
    if (elegir && maquina.estado() === ESTADOS.EXPLORACION && maquina.carrera() === null) {
      registrar(maquina.mirar('civil', ahora));
    }
  }

  return { maquina, entradas, miradas, visitados: entradas.map((e) => e.estado) };
}

const cuantos = (visitados, estado) => visitados.filter((e) => e === estado).length;

describe('estabilidad de la sesion', () => {
  // El caso que se ve en el stand: alguien sentado al limite del alcance, donde
  // la deteccion entra y sale. Mientras no se levante, la experiencia tiene que
  // seguir siendo suya.
  it('un rostro intermitente no corta la sesion de alguien que sigue sentado', () => {
    const CICLO = 6500; // 1,5 s detectado, 5 s perdido
    const { maquina, visitados } = correr({
      hayRostroEn: (ahora) => ahora % CICLO < 1500,
      hasta: 60000,
      elegir: true,
    });

    expect(visitados).toContain(ESTADOS.EXPLORACION);
    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(maquina.sesion()).toBe(1);
  });

  // Un parpadeo del detector no puede hacer que las nubes se abran y se cierren
  // una y otra vez sin llegar nunca al sorteo.
  it('un parpadeo corto no hace ir y venir entre el reposo y el enganche', () => {
    const { visitados } = correr({
      hayRostroEn: (ahora) => ahora % 3000 < 2000, // 2 s si, 1 s no
      hasta: 40000,
      elegir: true,
    });

    expect(cuantos(visitados, ESTADOS.ATRACCION)).toBe(0);
    expect(cuantos(visitados, ESTADOS.ENGANCHE)).toBe(1);
    expect(visitados).toContain(ESTADOS.EXPLORACION);
  });

  // SIN PLAZOS: la persona se queda lo que quiera. Lo que cierra la sesion es
  // que se vaya, no un reloj.
  it('quien se queda sentado y bien detectado conserva su exploracion todo lo que quiera', () => {
    const { visitados, maquina } = correr({
      hayRostroEn: () => true,
      hasta: 30 * 60 * 1000,
      paso: 250,
      elegir: true,
    });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
  });

  // Y para elegir, tampoco hay apuro: quien se sienta y no agarra nada sigue
  // con el carrusel delante. El espejo no le adjudica una ingenieria ni lo
  // echa. La contracara, a proposito: si la deteccion se queda trabada en
  // verdadero (un poster, un respaldo de silla), el espejo queda en escena
  // hasta que el equipo del stand la cierre con ESPACIO.
  it('quien no agarra nada sigue con el carrusel, sin recibir una ingenieria', () => {
    const { maquina, visitados, miradas } = correr({
      hayRostroEn: () => true,
      hasta: 30 * 60 * 1000,
      paso: 250,
    });

    expect(visitados).toContain(ESTADOS.EXPLORACION);
    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(miradas).toHaveLength(0);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
  });

  // La otra punta, y es la que hace que la fila avance: cuando alguien se va, el
  // espejo tiene que soltarlo rapido. Quien esta esperando su turno no puede
  // quedarse mirando la escena de otro.
  it('quien se va libera el espejo en menos de diez segundos', () => {
    const SALE = 20000;
    const { entradas } = correr({ hayRostroEn: (ahora) => ahora < SALE, hasta: 60000 });

    const vuelta = entradas.find((e) => e.estado === ESTADOS.ATRACCION);
    expect(vuelta).toBeDefined();
    expect(vuelta.ahora - SALE).toBeLessThanOrEqual(10000);
  });

  // Y quien llega despues tiene que recibir SU sorteo. Sin el corte, la persona
  // nueva hereda las opciones y el reloj de la anterior: se sienta en el medio
  // de una eleccion ajena y elige entre cinco objetos que no son suyos.
  it('la persona que sigue recibe su propio sorteo, no el de la anterior', () => {
    const SALE = 20000;
    const LLEGA = 32000;
    const { visitados } = correr({
      hayRostroEn: (ahora) => ahora < SALE || ahora >= LLEGA,
      hasta: 60000,
    });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(1);
    // Dos entradas al humo son dos sorteos: uno por persona.
    expect(cuantos(visitados, ESTADOS.HUMO)).toBe(2);
  });

  // LA SESION NO SE CORTA CON LA PERSONA AHI. Mientras se vea su cuerpo, que
  // no se reconozca la cara —la cabeza girada hacia las tablets, la mano
  // delante de la cara al elegir, mala luz— no le termina la experiencia.
  // Antes la cara era lo unico que la sostenia, y se cortaba a los seis
  // segundos con la persona sentada delante.
  it('con el cuerpo a la vista, perder la cara no corta la sesion', () => {
    const SIN_CARA = 20000;
    const { visitados, maquina } = correr({
      hayRostroEn: (ahora) => ahora < SIN_CARA,
      hayPoseEn: () => true,
      hasta: 10 * 60 * 1000,
      paso: 100,
      elegir: true,
    });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.carrera()).toBe('civil');
  });

  // Y cuando no se ve ni la cara ni el cuerpo, se fue: el espejo lo suelta
  // rapido, igual que siempre.
  it('quien se va del todo libera el espejo aunque hubiera perdido la cara antes', () => {
    const SIN_CARA = 20000;
    const SE_VA = 40000;
    const { entradas } = correr({
      hayRostroEn: (ahora) => ahora < SIN_CARA,
      hayPoseEn: (ahora) => ahora < SE_VA,
      hasta: 70000,
      elegir: true,
    });

    const vuelta = entradas.find((e) => e.estado === ESTADOS.ATRACCION);
    expect(vuelta).toBeDefined();
    expect(vuelta.ahora).toBeGreaterThan(SE_VA);
    expect(vuelta.ahora - SE_VA).toBeLessThanOrEqual(10000);
  });

  // EL RELEVO DE LA FILA: volver a la pantalla inicial no sirve de nada si
  // despues no arranca con el que sigue. Cuando el que se fue dejo de verse del
  // todo, el que se sienta recibe su propio sorteo sin esperar otra ausencia.
  //
  // EL LIMITE, a proposito: el cuerpo tambien sostiene la sesion, asi que si el
  // que sigue se sienta mientras al que se levanta todavia se lo ve, hereda su
  // sesion. Se prefirio eso a cortarle la experiencia a quien sigue sentado con
  // la cara girada; el equipo del stand lo resuelve con R (docs/operacion.md).
  it('el que sigue en la fila arranca su sesion cuando el anterior dejo de verse', () => {
    const SE_VA = 20000;
    const LLEGA = 34000; // ya volvio al reposo y paso el enfriamiento
    const { visitados, maquina } = correr({
      hayRostroEn: (ahora) => ahora < SE_VA || ahora >= LLEGA,
      hayPoseEn: (ahora) => ahora < SE_VA || ahora >= LLEGA,
      hasta: 60000,
      elegir: true,
    });

    // Dos entradas al humo son dos sorteos: uno por persona.
    expect(cuantos(visitados, ESTADOS.HUMO)).toBe(2);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
    expect(maquina.sesion()).toBe(2);
  });

  // Pero el colchon tiene que seguir: girar la cabeza un momento para hablar con
  // alguien no puede costarle a nadie la ingenieria que esta mirando.
  it('girar la cabeza un momento no corta nada', () => {
    const { visitados } = correr({
      // Cuatro segundos de cara y uno y medio girada, todo el tiempo.
      hayRostroEn: (ahora) => ahora % 5500 < 4000,
      hayPoseEn: () => true,
      hasta: 60000,
      elegir: true,
    });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(visitados).toContain(ESTADOS.EXPLORACION);
  });

  // El tope del enganche no es un plazo para la persona —la experiencia todavia
  // no empezo—, y tiene que quedar muy por encima de lo que tarda engancharse
  // de verdad, para no cortarle el arranque a nadie.
  it('el tope del enganche deja engancharse con holgura', () => {
    expect(CONFIG.tiempos.engancheMaximo).toBeGreaterThanOrEqual(10 * CONFIG.tiempos.enganche);
  });
});
