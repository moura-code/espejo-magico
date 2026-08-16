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

/** Corre el ciclo del espejo con una señal de deteccion cruda dada. */
function correr({ hayRostroEn, hasta, paso = 50 }) {
  const histeresis = crearHisteresis(CONFIG.presencia);
  const histeresisDeRostro = crearHisteresis(CONFIG.presencia);
  const maquina = crearMaquina({ tiempos: CONFIG.tiempos, sortear: () => 'civil' });
  const visitados = [];

  for (let ahora = 0; ahora <= hasta; ahora += paso) {
    const crudo = Boolean(hayRostroEn(ahora));
    const salida = maquina.actualizar({
      puedeIniciar: histeresisDeRostro.actualizar(crudo, ahora),
      hayPersona: histeresis.actualizar(crudo, ahora),
      ahora,
    });
    for (const evento of salida.eventos) {
      if (evento.tipo === 'entra') visitados.push(evento.estado);
    }
  }

  return { maquina, visitados };
}

const cuantos = (visitados, estado) => visitados.filter((e) => e === estado).length;

describe('estabilidad de la sesion', () => {
  // El caso que se ve en el stand: alguien sentado al limite del alcance, donde
  // la deteccion entra y sale. Mientras no se levante, la experiencia tiene que
  // seguir siendo suya.
  it('un rostro intermitente no corta la sesion de alguien que sigue sentado', () => {
    const CICLO = 7500; // 1,5 s detectado, 6 s perdido
    const { maquina, visitados } = correr({
      hayRostroEn: (ahora) => ahora % CICLO < 1500,
      hasta: 60000,
    });

    expect(visitados).toContain(ESTADOS.ESCENA);
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
    expect(visitados).toContain(ESTADOS.ESCENA);
  });

  // El tope de sesion es una red de seguridad, no un temporizador de la
  // experiencia. Si le corta la escena a alguien que la esta disfrutando, esta
  // mal puesto.
  it('quien se queda sentado y bien detectado conserva su escena varios minutos', () => {
    const { visitados, maquina } = correr({ hayRostroEn: () => true, hasta: 150000 });

    expect(cuantos(visitados, ESTADOS.CIERRE)).toBe(0);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  // Pero la red de seguridad tiene que seguir existiendo: si la deteccion se
  // queda trabada en verdadero (un poster, un respaldo de silla), el espejo no
  // puede quedarse en escena para siempre.
  it('el tope de sesion sigue estando para una deteccion trabada', () => {
    const { visitados } = correr({ hayRostroEn: () => true, hasta: 600000, paso: 250 });
    expect(cuantos(visitados, ESTADOS.CIERRE)).toBeGreaterThan(0);
  });

  // Y quien se va de verdad tiene que liberar el espejo en un tiempo razonable:
  // la fila no puede esperar medio minuto a que vuelva la invitacion.
  it('quien se va de verdad libera el espejo en menos de veinte segundos', () => {
    const SALE = 20000;
    const { visitados } = correr({
      hayRostroEn: (ahora) => ahora < SALE,
      hasta: SALE + 20000,
    });

    expect(visitados).toContain(ESTADOS.CIERRE);
    expect(visitados.at(-1)).toBe(ESTADOS.ATRACCION);
  });
});
