import { describe, it, expect } from 'vitest';
import {
  crearTablero,
  calcularAncla,
  angulosDelAnillo,
  angulosDeLaVentana,
  alfaEnVentana,
  radioQueEntra,
} from '../../espejo/tablero.js';

const AJUSTES = {
  radioFactor: 1.5,
  radioObjetoFactor: 0.22,
  desde: 200,
  hasta: 340,
  suavizado: 0.06,
  hombrosPorRostro: 3,
  caidaPorRostro: 1.5,
  margen: 1.1,
  gradosPorSegundo: 8,
  gradosDeFundido: 12,
  aireEntreObjetos: 0.2,
};

const PANTALLA = { ancho: 1080, alto: 1920 };
const DOCE = 12;

const conPose = (x, y, ancho) => ({
  centroHombros: { x, y },
  anchoHombros: ancho,
});
const conRostro = (x, y, radio) => ({ centro: { x, y }, radio });

/** Deja que el suavizado converja: es lento a proposito. Sin girar. */
function asentar(tablero, entrada, vueltas = 400) {
  let ultimo = null;
  for (let i = 0; i < vueltas; i++) ultimo = tablero.actualizar({ ...entrada, dt: 0 });
  return ultimo;
}

const visibles = (puesto) => puesto.ubicaciones.filter((u) => u.alfa > 0);
const enteras = (puesto) => puesto.ubicaciones.filter((u) => u.alfa === 1);

describe('calcularAncla', () => {
  it('los hombros mandan cuando hay pose', () => {
    const ancla = calcularAncla({
      pose: conPose(500, 1200, 400),
      rostro: conRostro(100, 100, 50),
      ...AJUSTES,
    });
    expect(ancla).toEqual({ x: 500, y: 1200, escala: 400 });
  });

  // Los hombros se pierden mucho antes que la cara cuando alguien se inclina o
  // gira. Sin este respaldo, el anillo desapareceria a mitad de la eleccion.
  it('sin pose deduce los hombros del rostro', () => {
    const ancla = calcularAncla({ pose: null, rostro: conRostro(400, 600, 80), ...AJUSTES });
    expect(ancla.x).toBe(400);
    expect(ancla.y).toBe(600 + 80 * 1.5);
    expect(ancla.escala).toBe(80 * 3);
  });

  it('devuelve null sin pose y sin rostro', () => {
    expect(calcularAncla({ pose: null, rostro: null, ...AJUSTES })).toBeNull();
  });

  it('ignora una pose degenerada, con hombros de ancho cero', () => {
    const ancla = calcularAncla({
      pose: conPose(500, 1200, 0),
      rostro: conRostro(400, 600, 80),
      ...AJUSTES,
    });
    expect(ancla.x).toBe(400);
  });
});

describe('angulosDelAnillo', () => {
  it('reparte la vuelta entera parejo, arrancando en la fase', () => {
    expect(angulosDelAnillo(4, 0)).toEqual([0, 90, 180, 270]);
    expect(angulosDelAnillo(4, 30)).toEqual([30, 120, 210, 300]);
  });

  it('da la vuelta: los angulos quedan siempre entre 0 y 360', () => {
    for (const grados of angulosDelAnillo(12, 350)) {
      expect(grados).toBeGreaterThanOrEqual(0);
      expect(grados).toBeLessThan(360);
    }
    expect(angulosDelAnillo(12, 350)[1]).toBeCloseTo(20);
  });

  it('sin objetos no devuelve nada', () => {
    expect(angulosDelAnillo(0, 0)).toEqual([]);
  });
});

describe('alfaEnVentana', () => {
  it('es cero fuera de la ventana y uno bien adentro', () => {
    expect(alfaEnVentana(100, 200, 340, 12)).toBe(0);
    expect(alfaEnVentana(199, 200, 340, 12)).toBe(0);
    expect(alfaEnVentana(270, 200, 340, 12)).toBe(1);
    expect(alfaEnVentana(341, 200, 340, 12)).toBe(0);
  });

  // Nada aparece ni desaparece de golpe: hay una rampa en cada borde.
  it('sube en rampa en los dos bordes', () => {
    expect(alfaEnVentana(206, 200, 340, 12)).toBeCloseTo(0.5);
    expect(alfaEnVentana(334, 200, 340, 12)).toBeCloseTo(0.5);
    expect(alfaEnVentana(212, 200, 340, 12)).toBe(1);
  });

  it('sin fundido es un escalon', () => {
    expect(alfaEnVentana(200, 200, 340, 0)).toBe(1);
    expect(alfaEnVentana(199.9, 200, 340, 0)).toBe(0);
  });
});

describe('angulosDeLaVentana', () => {
  it('muestrea la ventana de punta a punta', () => {
    const angulos = angulosDeLaVentana(200, 340, 35);
    expect(angulos[0]).toBe(200);
    expect(angulos.at(-1)).toBe(340);
    expect(angulos).toEqual([200, 235, 270, 305, 340]);
  });

  it('incluye el extremo aunque el paso no divida justo', () => {
    expect(angulosDeLaVentana(200, 340, 50)).toEqual([200, 250, 300, 340]);
  });
});

describe('radioQueEntra', () => {
  it('deja la ventana entera adentro del lienzo', () => {
    const angulos = angulosDeLaVentana(200, 340);
    const ancla = { x: 540, y: 1400 };
    const margen = 60;
    const radio = radioQueEntra(angulos, ancla, PANTALLA, margen);

    for (const grados of angulos) {
      const x = ancla.x + Math.cos((grados * Math.PI) / 180) * radio;
      const y = ancla.y + Math.sin((grados * Math.PI) / 180) * radio;
      expect(x).toBeGreaterThanOrEqual(margen - 0.001);
      expect(x).toBeLessThanOrEqual(PANTALLA.ancho - margen + 0.001);
      expect(y).toBeGreaterThanOrEqual(margen - 0.001);
      expect(y).toBeLessThanOrEqual(PANTALLA.alto - margen + 0.001);
    }
  });

  it('nunca devuelve un radio negativo', () => {
    const radio = radioQueEntra(angulosDeLaVentana(200, 340), { x: 5, y: 5 }, PANTALLA, 200);
    expect(radio).toBeGreaterThanOrEqual(0);
  });
});

describe('crearTablero', () => {
  const sentada = {
    pose: conPose(540, 1400, 380),
    rostro: null,
    disposicion: PANTALLA,
    cantidad: DOCE,
  };

  it('pone una ranura por objeto, en orden', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = tablero.actualizar({ ...sentada });
    expect(puesto.ubicaciones).toHaveLength(DOCE);
    for (let i = 1; i < DOCE; i++) {
      const salto = (puesto.ubicaciones[i].angulo - puesto.ubicaciones[i - 1].angulo + 360) % 360;
      expect(salto).toBeCloseTo(30);
    }
  });

  // Del anillo solo se ve la ventana: unos cinco objetos. Los demas estan
  // "detras del marco", como en el boceto de la catedra: existen, giran y no
  // se dibujan.
  it('solo una parte del anillo esta visible, por encima del ancla', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = asentar(tablero, sentada);

    expect(visibles(puesto).length).toBeGreaterThanOrEqual(4);
    expect(visibles(puesto).length).toBeLessThan(DOCE);
    for (const punto of visibles(puesto)) expect(punto.y).toBeLessThan(puesto.ancla.y);
  });

  it('gira con el tiempo, en el sentido de las flechas del boceto', () => {
    const tablero = crearTablero(AJUSTES);
    const antes = asentar(tablero, sentada);
    const despues = tablero.actualizar({ ...sentada, dt: 1 });

    // 8 grados por segundo. La fase crece: sube por la izquierda, pasa por
    // arriba, baja por la derecha.
    expect(despues.fase).toBeCloseTo(antes.fase + 8);
    expect(despues.ubicaciones[0].angulo).toBeCloseTo((antes.ubicaciones[0].angulo + 8) % 360);
  });

  it('da la vuelta completa sin acumular la fase', () => {
    const tablero = crearTablero(AJUSTES);
    let puesto = null;
    for (let i = 0; i < 100; i++) puesto = tablero.actualizar({ ...sentada, dt: 1 });
    expect(puesto.fase).toBeGreaterThanOrEqual(0);
    expect(puesto.fase).toBeLessThan(360);
  });

  // LA PRUEBA QUE PIDE LA CATEDRA. Con la mano sobre un objeto y el anillo de
  // progreso llenandose, el carrusel se detiene ahi mismo.
  it('congelar detiene la rotacion', () => {
    const tablero = crearTablero(AJUSTES);
    const antes = asentar(tablero, sentada);
    const despues = tablero.actualizar({ ...sentada, dt: 1, congelar: true });
    expect(despues.fase).toBe(antes.fase);
  });

  it('con dt cero no gira aunque no este congelado', () => {
    const tablero = crearTablero(AJUSTES);
    const antes = asentar(tablero, sentada);
    expect(tablero.actualizar({ ...sentada, dt: 0 }).fase).toBe(antes.fase);
  });

  // Si el radio dependiera de donde esta cada objeto, respiraria cuadro a
  // cuadro con el giro. Se mide contra la ventana, que es lo que tiene que
  // entrar en el lienzo.
  it('el radio no depende de la fase', () => {
    const tablero = crearTablero(AJUSTES);
    const radios = new Set();
    asentar(tablero, sentada);
    for (let i = 0; i < 60; i++) {
      const puesto = tablero.actualizar({ ...sentada, dt: 1 });
      const [a] = puesto.ubicaciones;
      radios.add(Math.hypot(a.x - puesto.ancla.x, a.y - puesto.ancla.y).toFixed(3));
    }
    expect(radios.size).toBe(1);
  });

  // Dos objetos encimados son una opcion que no se puede elegir: el sostenido
  // le da la mano al mas cercano al centro y el otro queda inalcanzable. Con
  // doce a 30 grados y el radio achicado por el borde, hay que acotar el
  // tamaño del objeto a la cuerda entre vecinos. Cerca de un borde el anillo
  // se achica hasta lo que entra y los objetos con el; en el borde mismo
  // colapsa a un punto, como el arco de antes: ahi ya no hay persona entera.
  it('los objetos no se superponen, ni con la persona muy cerca o corrida', () => {
    for (const pose of [conPose(540, 1400, 380), conPose(540, 1000, 1400), conPose(200, 400, 500)]) {
      const tablero = crearTablero(AJUSTES);
      const puesto = asentar(tablero, { ...sentada, pose });
      const u = puesto.ubicaciones;
      for (let i = 0; i < u.length; i++) {
        const a = u[i];
        const b = u[(i + 1) % u.length];
        expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(puesto.radioObjeto * 2);
      }
    }
  });

  it('con pocos objetos el tamaño lo fija el ancho de hombros, no la cuerda', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = asentar(tablero, { ...sentada, cantidad: 3 });
    expect(puesto.radioObjeto).toBeCloseTo(380 * AJUSTES.radioObjetoFactor);
  });

  it('todos los objetos visibles quedan dentro de la pantalla', () => {
    const tablero = crearTablero(AJUSTES);

    // Casos duros: pegado a un borde, pegado a otro, y muy cerca de la camara
    // (hombros anchisimos), que es donde el arco se iba de cuadro.
    for (const pose of [
      conPose(40, 300, 380),
      conPose(1040, 1800, 380),
      conPose(540, 1000, 1400),
      conPose(540, 100, 900),
    ]) {
      for (let vuelta = 0; vuelta < 50; vuelta++) {
        const puesto = tablero.actualizar({ ...sentada, pose, dt: 1 });
        for (const punto of visibles(puesto)) {
          expect(punto.x).toBeGreaterThanOrEqual(0);
          expect(punto.x).toBeLessThanOrEqual(PANTALLA.ancho);
          expect(punto.y).toBeGreaterThanOrEqual(0);
          expect(punto.y).toBeLessThanOrEqual(PANTALLA.alto);
        }
      }
      tablero.reiniciar();
    }
  });

  // Mas lejos de la camara = hombros mas angostos = todo mas chico y mas junto.
  // No hay ningun umbral por distancia: sale solo de la geometria.
  it('el tamaño acompaña la distancia de la persona', () => {
    const cerca = crearTablero(AJUSTES);
    const lejos = crearTablero(AJUSTES);
    const entrada = (ancho) => ({ ...sentada, pose: conPose(540, 1400, ancho) });

    expect(asentar(cerca, entrada(500)).radioObjeto).toBeGreaterThan(
      asentar(lejos, entrada(200)).radioObjeto,
    );
  });

  // Seguir los hombros cuadro a cuadro haria temblar los blancos y apuntarles
  // seria imposible.
  it('el ancla se mueve muy despacio', () => {
    const tablero = crearTablero(AJUSTES);
    const quieto = { ...sentada, pose: conPose(300, 1400, 380) };
    asentar(tablero, quieto);

    const saltado = tablero.actualizar({ ...quieto, pose: conPose(800, 1400, 380) });
    // Un salto de 500 px se traduce en 30: el suavizado es 0,06.
    expect(saltado.ancla.x - 300).toBeLessThan(60);
  });

  // Si el blanco siguiera a los hombros mientras sostenes la mano, el gesto de
  // estirar el brazo lo correria de abajo de la propia mano.
  it('congelar deja el anillo donde esta aunque la persona se mueva', () => {
    const tablero = crearTablero(AJUSTES);
    const base = { ...sentada, pose: conPose(300, 1400, 380) };
    const antes = asentar(tablero, base);

    let despues = null;
    for (let i = 0; i < 200; i++) {
      despues = tablero.actualizar({
        ...base,
        pose: conPose(900, 500, 700),
        congelar: true,
        dt: 1,
      });
    }

    expect(despues.ancla.x).toBeCloseTo(antes.ancla.x, 6);
    expect(despues.ancla.y).toBeCloseTo(antes.ancla.y, 6);
    expect(despues.radioObjeto).toBeCloseTo(antes.radioObjeto, 6);
    expect(despues.fase).toBe(antes.fase);
  });

  // El tablero tiene que existir desde el primer cuadro: si apareciera recien
  // cuando la pose engancha, los objetos saldrian de la nada a mitad del humo.
  it('sin pose ni rostro pone igual los objetos, centrados', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = tablero.actualizar({ ...sentada, pose: null });

    expect(puesto.ubicaciones).toHaveLength(DOCE);
    expect(puesto.radioObjeto).toBeGreaterThan(0);
    expect(puesto.ancla.x).toBeCloseTo(PANTALLA.ancho / 2, 6);
  });

  it('reiniciar olvida la posicion de la persona anterior y vuelve la fase a cero', () => {
    const tablero = crearTablero(AJUSTES);
    asentar(tablero, { ...sentada, pose: conPose(200, 1700, 300) });
    tablero.actualizar({ ...sentada, dt: 5 });

    tablero.reiniciar();
    const nuevo = tablero.actualizar({ ...sentada, pose: conPose(900, 400, 600) });
    // Sin reiniciar, el anillo se deslizaria despacio desde donde estaba la
    // persona anterior hasta la nueva, a la vista de todos.
    expect(nuevo.ancla.x).toBeCloseTo(900, 6);
    expect(nuevo.fase).toBe(0);
  });

  it('las ranuras enteras son las unicas con alfa uno', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = asentar(tablero, sentada);
    for (const u of enteras(puesto)) {
      expect(u.angulo).toBeGreaterThanOrEqual(AJUSTES.desde + AJUSTES.gradosDeFundido);
      expect(u.angulo).toBeLessThanOrEqual(AJUSTES.hasta - AJUSTES.gradosDeFundido);
    }
  });
});
