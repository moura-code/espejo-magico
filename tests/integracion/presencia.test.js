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
function correr({ hayRostroEn, hayPoseEn = hayRostroEn, hasta, paso = 50 }) {
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
    const salida = maquina.actualizar({
      puedeIniciar: histeresisDeRostro.actualizar(crudoRostro, ahora),
      hayPersona: histeresis.actualizar(crudoPersona, ahora),
      ahora,
    });
    for (const evento of salida.eventos) {
      if (evento.tipo === 'entra') entradas.push({ estado: evento.estado, ahora });
      if (evento.tipo === 'mira') miradas.push({ carrera: evento.carrera, ahora });
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
    });

    expect(cuantos(visitados, ESTADOS.ATRACCION)).toBe(0);
    expect(cuantos(visitados, ESTADOS.ENGANCHE)).toBe(1);
    expect(visitados).toContain(ESTADOS.EXPLORACION);
  });

  // El tope de sesion es una red de seguridad, no un temporizador de la
  // experiencia. Si le corta la escena a alguien que la esta disfrutando, esta
  // mal puesto.
  it('quien se queda sentado y bien detectado conserva su exploracion varios minutos', () => {
    const { visitados, maquina } = correr({ hayRostroEn: () => true, hasta: 150000 });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(maquina.estado()).toBe(ESTADOS.EXPLORACION);
  });

  // Pero la red de seguridad tiene que seguir existiendo: si la deteccion se
  // queda trabada en verdadero (un poster, un respaldo de silla), el espejo no
  // puede quedarse en escena para siempre.
  it('el tope de sesion sigue estando para una deteccion trabada', () => {
    const { visitados } = correr({ hayRostroEn: () => true, hasta: 600000, paso: 250 });
    expect(cuantos(visitados, ESTADOS.CIERRE)).toBeGreaterThan(0);
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

  // La otra red de seguridad de la fila: quien se sienta y no entiende el gesto
  // no puede dejar el espejo tomado hasta el tope de sesion, tres minutos
  // despues. La red le muestra una y como lo ofrecido viene barajado, la
  // ingenieria que recibe igual es un sorteo. Despues puede agarrar otras.
  it('quien no agarra nada igual recibe una ingenieria', () => {
    const { maquina, visitados, miradas } = correr({ hayRostroEn: () => true, hasta: 60000 });

    expect(visitados).toContain(ESTADOS.EXPLORACION);
    expect(miradas).toHaveLength(1);
    expect(maquina.carrera()).not.toBeNull();
    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
  });

  // LO QUE PIDIO EL STAND: cuando el espejo deja de reconocer una cara, vuelve a
  // su pantalla inicial. Antes los hombros sostenian la sesion con la cara
  // girada, y alguien que se iba de costado se llevaba el espejo con el.
  it('perder la cara devuelve el espejo a la pantalla inicial, aunque quede el cuerpo', () => {
    const SE_VA = 20000;
    const { entradas } = correr({
      hayRostroEn: (ahora) => ahora < SE_VA,
      // El cuerpo se sigue viendo todo el tiempo: no alcanza para sostenerla.
      hayPoseEn: () => true,
      hasta: 60000,
    });

    const vuelta = entradas.find((e) => e.estado === ESTADOS.ATRACCION);
    expect(vuelta).toBeDefined();
    expect(vuelta.ahora - SE_VA).toBeLessThanOrEqual(10000);
  });

  // Pero el colchon tiene que seguir: girar la cabeza un momento para hablar con
  // alguien no puede costarle a nadie la ingenieria que esta mirando.
  it('girar la cabeza un momento no corta nada', () => {
    const { visitados } = correr({
      // Cuatro segundos de cara y uno y medio girada, todo el tiempo.
      hayRostroEn: (ahora) => ahora % 5500 < 4000,
      hayPoseEn: () => true,
      hasta: 60000,
    });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(visitados).toContain(ESTADOS.EXPLORACION);
  });

  // La red de la fila tiene que ser comoda para leer cinco objetos y decidir,
  // pero no tanto como para que la fila se pare. Y por debajo del humo no
  // tendria sentido: la exploracion empezaria vencida.
  it('la red de la fila deja tiempo de decidir sin frenarla', () => {
    expect(CONFIG.tiempos.eleccionMaxima).toBeGreaterThan(CONFIG.tiempos.humo);
    expect(CONFIG.tiempos.eleccionMaxima).toBeGreaterThanOrEqual(15000);
    expect(CONFIG.tiempos.eleccionMaxima).toBeLessThan(CONFIG.tiempos.sesionMaxima / 2);
  });
});
