import { describe, it, expect } from 'vitest';
import { crearEleccion, blancoBajoLaMano } from '../../espejo/eleccion.js';

const AJUSTES = { msParaElegir: 1500, msDeOlvido: 600, radioFactor: 1.4 };

const mano = (x, y) => ({ palma: { x, y } });
const blanco = (id, x, y, radio = 50) => ({ id, x, y, radio });

/** Sostiene la mano sobre un blanco desde `desde` hasta `hasta`, de a 50 ms. */
function sostener(eleccion, objetivos, manos, desde, hasta, paso = 50) {
  let ultimo = null;
  for (let ahora = desde; ahora <= hasta; ahora += paso) {
    ultimo = eleccion.actualizar({ manos, objetivos, ahora });
  }
  return ultimo;
}

describe('blancoBajoLaMano', () => {
  const objetivos = [blanco('a', 100, 100), blanco('b', 300, 100)];

  it('devuelve null con la mano lejos de todo', () => {
    expect(blancoBajoLaMano([mano(500, 500)], objetivos)).toBeNull();
  });

  it('devuelve null sin manos', () => {
    expect(blancoBajoLaMano([], objetivos)).toBeNull();
  });

  it('encuentra el blanco que contiene la palma', () => {
    expect(blancoBajoLaMano([mano(110, 105)], objetivos)).toBe('a');
    expect(blancoBajoLaMano([mano(300, 100)], objetivos)).toBe('b');
  });

  // Un blanco generoso es mas facil de disfrutar que uno exacto. El factor es
  // lo que decide cuanto perdona, y tiene que aplicarse de verdad.
  it('el radioFactor agranda el blanco', () => {
    expect(blancoBajoLaMano([mano(160, 100)], objetivos, 1)).toBeNull();
    expect(blancoBajoLaMano([mano(160, 100)], objetivos, 1.4)).toBe('a');
  });

  // Dos blancos que se superponen tienen que repartirse la mano por cercania al
  // centro, no por orden de lista: si no, el primero del arreglo gana siempre y
  // el de al lado es inelegible.
  it('con blancos superpuestos gana el mas cercano al centro', () => {
    const pegados = [blanco('izq', 100, 100), blanco('der', 180, 100)];
    expect(blancoBajoLaMano([mano(170, 100)], pegados)).toBe('der');
    expect(blancoBajoLaMano([mano(110, 100)], pegados)).toBe('izq');
  });

  it('cualquiera de las dos manos sirve', () => {
    expect(blancoBajoLaMano([mano(900, 900), mano(300, 100)], objetivos)).toBe('b');
  });
});

describe('crearEleccion', () => {
  const objetivos = [blanco('a', 100, 100), blanco('b', 400, 100)];

  it('no elige nada sin manos', () => {
    const eleccion = crearEleccion(AJUSTES);
    const salida = sostener(eleccion, objetivos, [], 0, 5000);
    expect(salida.elegido).toBeNull();
    expect(salida.progreso).toBe(0);
  });

  it('el primer cuadro no acumula tiempo', () => {
    const eleccion = crearEleccion(AJUSTES);
    // Sin reloj anterior no se sabe cuanto paso: dar por bueno el valor crudo
    // de performance.now() completaria el sostenido en el primer cuadro.
    const salida = eleccion.actualizar({ manos: [mano(100, 100)], objetivos, ahora: 900000 });
    expect(salida.progreso).toBe(0);
  });

  it('elige al sostener la mano el tiempo pedido', () => {
    const eleccion = crearEleccion(AJUSTES);
    const antes = sostener(eleccion, objetivos, [mano(100, 100)], 0, 1400);
    expect(antes.elegido).toBeNull();
    expect(antes.sobre).toBe('a');
    expect(antes.progreso).toBeGreaterThan(0.8);

    const despues = sostener(eleccion, objetivos, [mano(100, 100)], 1450, 1600);
    expect(despues.elegido).toBe('a');
    expect(despues.progreso).toBe(1);
  });

  // Con reset de golpe, el temblor de la deteccion —que saca la palma del blanco
  // un cuadro suelto— dejaba el anillo en cero una y otra vez y no se llenaba
  // nunca. Es la diferencia entre "elegible" e "imposible".
  it('al sacar la mano el progreso se vacia de a poco, no de golpe', () => {
    const eleccion = crearEleccion(AJUSTES);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);
    const lleno = eleccion.progreso();
    expect(lleno).toBeGreaterThan(0.6);

    const apenasSalio = eleccion.actualizar({ manos: [], objetivos, ahora: 1050 });
    expect(apenasSalio.progreso).toBeGreaterThan(0);
    expect(apenasSalio.progreso).toBeLessThan(lleno);
  });

  it('un parpadeo de un cuadro casi no cuesta progreso', () => {
    const eleccion = crearEleccion(AJUSTES);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);

    // El parpadeo cuesta 125 ms de los 1000 acumulados (50 ms de ausencia por
    // el ritmo de olvido, 2,5x). Volviendo la mano, se completa igual.
    eleccion.actualizar({ manos: [], objetivos, ahora: 1050 });
    const recuperado = sostener(eleccion, objetivos, [mano(100, 100)], 1100, 1750);
    expect(recuperado.elegido).toBe('a');
  });

  it('el progreso llega a cero despues de msDeOlvido y suelta el blanco', () => {
    const eleccion = crearEleccion(AJUSTES);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1400);

    const olvidado = sostener(eleccion, objetivos, [], 1450, 2300);
    expect(olvidado.progreso).toBe(0);
    expect(olvidado.sobre).toBeNull();
    expect(olvidado.elegido).toBeNull();
  });

  // Mover el brazo a otro objeto es deliberado: heredar lo acumulado haria que
  // el segundo se eligiera casi al instante, sin que la persona lo pida.
  it('cambiar de blanco empieza de cero', () => {
    const eleccion = crearEleccion(AJUSTES);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1400);

    const cambio = eleccion.actualizar({ manos: [mano(400, 100)], objetivos, ahora: 1450 });
    expect(cambio.sobre).toBe('b');
    expect(cambio.progreso).toBeLessThan(0.1);

    const siguiendo = sostener(eleccion, objetivos, [mano(400, 100)], 1500, 2000);
    expect(siguiendo.elegido).toBeNull();
  });

  // El cuadro siguiente a elegir todavia tiene la mano puesta. Sin traba, el
  // progreso seguiria corriendo sobre un blanco que ya no se ofrece.
  it('una vez elegido queda trabado hasta reiniciar', () => {
    const eleccion = crearEleccion(AJUSTES);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1600);
    expect(eleccion.elegido()).toBe('a');

    sostener(eleccion, objetivos, [mano(400, 100)], 1650, 4000);
    expect(eleccion.elegido()).toBe('a');

    eleccion.reiniciar();
    expect(eleccion.elegido()).toBeNull();
    expect(eleccion.progreso()).toBe(0);
    expect(eleccion.sobre()).toBeNull();
  });

  // Si el navegador se traba un instante, un salto de reloj grande completaria
  // un sostenido que nadie hizo.
  it('un salto de reloj no completa un sostenido solo', () => {
    const eleccion = crearEleccion(AJUSTES);
    eleccion.actualizar({ manos: [mano(100, 100)], objetivos, ahora: 0 });
    const salto = eleccion.actualizar({ manos: [mano(100, 100)], objetivos, ahora: 30000 });

    expect(salto.elegido).toBeNull();
    expect(salto.progreso).toBeLessThan(0.3);
  });

  it('sin objetivos no pasa nada', () => {
    const eleccion = crearEleccion(AJUSTES);
    const salida = sostener(eleccion, [], [mano(100, 100)], 0, 5000);
    expect(salida.elegido).toBeNull();
    expect(salida.sobre).toBeNull();
  });
});

describe('la gracia de la deteccion', () => {
  const CON_GRACIA = { msParaElegir: 1500, msDeOlvido: 600, msDeGracia: 250, radioFactor: 1.4 };
  const objetivos = [blanco('a', 100, 100), blanco('b', 400, 100)];

  it('una perdida corta no cuesta nada de progreso', () => {
    const eleccion = crearEleccion(CON_GRACIA);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);
    const antes = eleccion.progreso();

    // 200 ms sin mano: dentro de la gracia.
    sostener(eleccion, objetivos, [], 1050, 1200);
    expect(eleccion.progreso()).toBeCloseTo(antes, 10);
  });

  // Que no baje no puede significar que suba: si no, bastaria con apoyar la
  // mano y sacarla para que el anillo siguiera llenandose solo.
  it('dentro de la gracia el progreso tampoco crece', () => {
    const eleccion = crearEleccion(CON_GRACIA);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);
    const antes = eleccion.progreso();

    const quieto = sostener(eleccion, objetivos, [], 1050, 1200);
    expect(quieto.progreso).toBeLessThanOrEqual(antes);
    expect(quieto.elegido).toBeNull();
  });

  it('pasada la gracia el progreso baja igual', () => {
    const eleccion = crearEleccion(CON_GRACIA);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);
    const antes = eleccion.progreso();

    sostener(eleccion, objetivos, [], 1050, 1600);
    expect(eleccion.progreso()).toBeLessThan(antes);
  });

  it('la gracia se reinicia cada vez que vuelve la mano', () => {
    const eleccion = crearEleccion(CON_GRACIA);
    let ahora = 0;
    // Alterna 200 ms sin mano y 50 ms con mano: cada hueco entra en la gracia.
    while (ahora < 3000) {
      sostener(eleccion, objetivos, [mano(100, 100)], ahora, ahora + 50, 50);
      ahora += 100;
      sostener(eleccion, objetivos, [], ahora, ahora + 200, 50);
      ahora += 250;
    }
    // Nunca llega a vaciarse: el progreso solo sube, aunque despacio.
    expect(eleccion.progreso()).toBeGreaterThan(0);
  });

  // EL CASO QUE OBLIGO A QUE EXISTIERA LA GRACIA. Sin ella, un 25% de cuadros
  // perdidos —normal con la mano de costado o mal iluminada— hacia que cada
  // cuadro sin mano costara dos y medio: 1,5 s de sostenido pasaban a doce, y en
  // el stand se leia como que el espejo no responde.
  it('con una de cada cuatro detecciones perdida el sostenido igual se completa', () => {
    const PASO = 1000 / 60;
    const eleccion = crearEleccion(CON_GRACIA);

    let ahora = 0;
    let cuadro = 0;
    while (ahora < 4000 && !eleccion.elegido()) {
      const hayMano = cuadro % 4 !== 3;
      eleccion.actualizar({ manos: hayMano ? [mano(100, 100)] : [], objetivos, ahora });
      ahora += PASO;
      cuadro++;
    }

    expect(eleccion.elegido()).toBe('a');
    // Tarda mas que con deteccion perfecta —solo cuentan los cuadros con
    // mano— pero sigue siendo un gesto, no una espera.
    expect(ahora).toBeLessThan(2600);
  });

  // Gracia cero tiene que significar cero, sin perdonar ni un cuadro: es lo que
  // hace que el numero se pueda bajar a mano hasta apagar la gracia del todo.
  it('sin gracia declarada el progreso empieza a bajar en el primer cuadro', () => {
    const eleccion = crearEleccion({ msParaElegir: 1500, msDeOlvido: 600, radioFactor: 1.4 });
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);
    const antes = eleccion.progreso();

    eleccion.actualizar({ manos: [], objetivos, ahora: 1050 });
    expect(eleccion.progreso()).toBeLessThan(antes);
  });

  it('reiniciar tambien olvida la gracia en curso', () => {
    const eleccion = crearEleccion(CON_GRACIA);
    sostener(eleccion, objetivos, [mano(100, 100)], 0, 1000);
    eleccion.actualizar({ manos: [], objetivos, ahora: 1050 });

    eleccion.reiniciar();
    expect(eleccion.progreso()).toBe(0);
    expect(eleccion.sobre()).toBeNull();
  });
});
