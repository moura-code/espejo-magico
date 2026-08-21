import { describe, it, expect } from 'vitest';
import {
  crearTablero,
  calcularAncla,
  angulosDelArco,
  radioQueEntra,
} from '../../espejo/tablero.js';

const AJUSTES = {
  radioFactor: 1.5,
  radioObjetoFactor: 0.28,
  desde: 200,
  hasta: 340,
  suavizado: 0.06,
  hombrosPorRostro: 3,
  caidaPorRostro: 1.5,
  margen: 1.1,
};

const PANTALLA = { ancho: 1080, alto: 1920 };

const conPose = (x, y, ancho) => ({
  centroHombros: { x, y },
  anchoHombros: ancho,
});
const conRostro = (x, y, radio) => ({ centro: { x, y }, radio });

/** Deja que el suavizado converja: es lento a proposito. */
function asentar(tablero, entrada, vueltas = 400) {
  let ultimo = null;
  for (let i = 0; i < vueltas; i++) ultimo = tablero.actualizar(entrada);
  return ultimo;
}

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
  // gira. Sin este respaldo, el arco desapareceria a mitad de la eleccion.
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

describe('angulosDelArco', () => {
  it('reparte parejo entre los dos extremos', () => {
    expect(angulosDelArco(5, 200, 340)).toEqual([200, 235, 270, 305, 340]);
  });

  it('con uno solo lo pone en el medio', () => {
    expect(angulosDelArco(1, 200, 340)).toEqual([270]);
  });

  it('sin objetos no devuelve nada', () => {
    expect(angulosDelArco(0, 200, 340)).toEqual([]);
  });
});

describe('radioQueEntra', () => {
  it('deja el arco entero adentro del lienzo', () => {
    const angulos = angulosDelArco(5, 200, 340);
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
    const radio = radioQueEntra(angulosDelArco(5, 200, 340), { x: 5, y: 5 }, PANTALLA, 200);
    expect(radio).toBeGreaterThanOrEqual(0);
  });
});

describe('crearTablero', () => {
  it('pone tantos objetos como se le piden', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = tablero.actualizar({
      pose: conPose(540, 1300, 380),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });
    expect(puesto.ubicaciones).toHaveLength(5);
  });

  it('el arco pasa por arriba del ancla, no por abajo', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = asentar(tablero, {
      pose: conPose(540, 1400, 380),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });
    for (const punto of puesto.ubicaciones) {
      expect(punto.y).toBeLessThan(puesto.ancla.y);
    }
  });

  // Dos objetos encimados son una opcion que no se puede elegir: el sostenido
  // le da la mano al mas cercano al centro y el otro queda inalcanzable.
  it('los objetos no se superponen entre si', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = asentar(tablero, {
      pose: conPose(540, 1400, 380),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });

    for (let i = 1; i < puesto.ubicaciones.length; i++) {
      const a = puesto.ubicaciones[i - 1];
      const b = puesto.ubicaciones[i];
      expect(Math.hypot(b.x - a.x, b.y - a.y)).toBeGreaterThan(puesto.radioObjeto * 2);
    }
  });

  it('todos los objetos quedan dentro de la pantalla', () => {
    const tablero = crearTablero(AJUSTES);

    // Casos duros: pegado a un borde, pegado a otro, y muy cerca de la camara
    // (hombros anchisimos), que es donde el arco se iba de cuadro.
    for (const pose of [
      conPose(40, 300, 380),
      conPose(1040, 1800, 380),
      conPose(540, 1000, 1400),
      conPose(540, 100, 900),
    ]) {
      const puesto = asentar(tablero, { pose, rostro: null, disposicion: PANTALLA, cantidad: 5 });
      for (const punto of puesto.ubicaciones) {
        expect(punto.x).toBeGreaterThanOrEqual(0);
        expect(punto.x).toBeLessThanOrEqual(PANTALLA.ancho);
        expect(punto.y).toBeGreaterThanOrEqual(0);
        expect(punto.y).toBeLessThanOrEqual(PANTALLA.alto);
      }
      tablero.reiniciar();
    }
  });

  // Mas lejos de la camara = hombros mas angostos = todo mas chico y mas junto.
  // No hay ningun umbral por distancia: sale solo de la geometria.
  it('el tamaño acompaña la distancia de la persona', () => {
    const cerca = crearTablero(AJUSTES);
    const lejos = crearTablero(AJUSTES);
    const entrada = (ancho) => ({
      pose: conPose(540, 1400, ancho),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });

    expect(asentar(cerca, entrada(500)).radioObjeto).toBeGreaterThan(
      asentar(lejos, entrada(200)).radioObjeto,
    );
  });

  // Seguir los hombros cuadro a cuadro haria temblar los cinco blancos y
  // apuntarles seria imposible.
  it('el ancla se mueve muy despacio', () => {
    const tablero = crearTablero(AJUSTES);
    const quieto = { pose: conPose(300, 1400, 380), rostro: null, disposicion: PANTALLA, cantidad: 5 };
    asentar(tablero, quieto);

    const saltado = tablero.actualizar({
      ...quieto,
      pose: conPose(800, 1400, 380),
    });
    // Un salto de 500 px se traduce en 30: el suavizado es 0,06.
    expect(saltado.ancla.x - 300).toBeLessThan(60);
  });

  // Si el blanco siguiera a los hombros mientras sostenes la mano, el gesto de
  // estirar el brazo lo correria de abajo de la propia mano.
  it('congelar deja el arco donde esta aunque la persona se mueva', () => {
    const tablero = crearTablero(AJUSTES);
    const base = { pose: conPose(300, 1400, 380), rostro: null, disposicion: PANTALLA, cantidad: 5 };
    const antes = asentar(tablero, base);

    let despues = null;
    for (let i = 0; i < 200; i++) {
      despues = tablero.actualizar({ ...base, pose: conPose(900, 500, 700), congelar: true });
    }

    expect(despues.ancla.x).toBeCloseTo(antes.ancla.x, 6);
    expect(despues.ancla.y).toBeCloseTo(antes.ancla.y, 6);
    expect(despues.radioObjeto).toBeCloseTo(antes.radioObjeto, 6);
  });

  // El tablero tiene que existir desde el primer cuadro: si apareciera recien
  // cuando la pose engancha, los objetos saldrian de la nada a mitad del humo.
  it('sin pose ni rostro pone igual los objetos, centrados', () => {
    const tablero = crearTablero(AJUSTES);
    const puesto = tablero.actualizar({
      pose: null,
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });

    expect(puesto.ubicaciones).toHaveLength(5);
    expect(puesto.radioObjeto).toBeGreaterThan(0);
    expect(puesto.ancla.x).toBeCloseTo(PANTALLA.ancho / 2, 6);
  });

  it('reiniciar olvida la posicion de la persona anterior', () => {
    const tablero = crearTablero(AJUSTES);
    asentar(tablero, {
      pose: conPose(200, 1700, 300),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });

    tablero.reiniciar();
    const nuevo = tablero.actualizar({
      pose: conPose(900, 400, 600),
      rostro: null,
      disposicion: PANTALLA,
      cantidad: 5,
    });
    // Sin reiniciar, el arco se deslizaria despacio desde donde estaba la
    // persona anterior hasta la nueva, a la vista de todos.
    expect(nuevo.ancla.x).toBeCloseTo(900, 6);
  });
});
