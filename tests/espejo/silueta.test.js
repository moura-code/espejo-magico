import { describe, it, expect } from 'vitest';
import {
  crearSilueta,
  alfaDesdeConfianza,
  curvaDeRecorte,
  fraccionConfirmada,
  incertidumbre,
  tabularRecorte,
} from '../../espejo/silueta.js';
import { CONFIG } from '../../espejo/config.js';

/** Lo minimo de un canvas que necesita crearSilueta. */
function lienzoDeMentira() {
  const lienzo = {
    width: 0,
    height: 0,
    puestas: [],
    getContext: () => ({
      createImageData: (ancho, alto) => ({
        width: ancho,
        height: alto,
        data: new Uint8ClampedArray(ancho * alto * 4),
      }),
      putImageData: (imagen) => lienzo.puestas.push(imagen),
    }),
  };
  return lienzo;
}

// Como la entrega MediaPipe: una confianza de 0 a 1 por pixel.
const mascara = (ancho, alto, valores) => ({
  width: ancho,
  height: alto,
  getAsFloat32Array: () => Float32Array.from(valores),
});

// Numeros redondos para las pruebas de mecanica; las de comportamiento usan
// la CONFIG de verdad.
const RECORTE = { mezcla: 0.85, transparenteHasta: 0.4, opacaDesde: 0.8, confirmacionMinima: 0.5 };

/** Una mascara de `ancho` x `alto` con la confianza que diga `valor(i)`. */
const mascaraCon = (ancho, alto, valor) =>
  mascara(ancho, alto, Array.from({ length: ancho * alto }, (_, i) => valor(i)));

const alfas = (lienzo) => {
  const datos = lienzo.puestas.at(-1).data;
  return Array.from({ length: datos.length / 4 }, (_, i) => datos[i * 4 + 3]);
};

/** El alfa que sale para un pixel, mascara tras mascara. */
function alfasDe(valores, recorte = RECORTE) {
  const lienzo = lienzoDeMentira();
  const silueta = crearSilueta({ crearLienzo: () => lienzo, ...recorte });
  return valores.map((valor) => {
    silueta.actualizar(mascara(1, 1, [valor]));
    return alfas(lienzo)[0];
  });
}

const alternando = (a, b, veces) => Array.from({ length: veces }, (_, i) => (i % 2 ? b : a));

describe('incertidumbre', () => {
  // Es el polinomio del SegmentationSmoothingCalculator de MediaPipe: cuanto
  // duda el modelo de un pixel, y por eso cuanto se lo mezcla con la mascara
  // anterior.
  it('es total en 0,5 y nula en las puntas', () => {
    expect(incertidumbre(0.5)).toBeCloseTo(1, 5);
    expect(incertidumbre(0)).toBeLessThan(0.001);
    expect(incertidumbre(1)).toBeLessThan(0.001);
  });

  it('es simétrica y baja hacia las puntas', () => {
    expect(incertidumbre(0.3)).toBeCloseTo(incertidumbre(0.7), 5);
    expect(incertidumbre(0.4)).toBeGreaterThan(incertidumbre(0.2));
    expect(incertidumbre(0.2)).toBeGreaterThan(incertidumbre(0.05));
  });
});

describe('curvaDeRecorte', () => {
  it('transparente hasta el primer umbral, entera desde el segundo', () => {
    expect(curvaDeRecorte(0.2, 0.4, 0.8)).toBe(0);
    expect(curvaDeRecorte(0.4, 0.4, 0.8)).toBe(0);
    expect(curvaDeRecorte(0.6, 0.4, 0.8)).toBeCloseTo(0.5, 5);
    expect(curvaDeRecorte(0.8, 0.4, 0.8)).toBe(1);
    expect(curvaDeRecorte(0.95, 0.4, 0.8)).toBe(1);
  });

  // Un borde duro delata el truco; uno suave se lee como profundidad.
  it('sube sin escalones', () => {
    let anterior = 0;
    for (let paso = 0; paso <= 100; paso++) {
      const valor = curvaDeRecorte(paso / 100, 0.4, 0.8);
      expect(valor).toBeGreaterThanOrEqual(anterior);
      expect(valor - anterior).toBeLessThan(0.05);
      anterior = valor;
    }
  });
});

describe('alfaDesdeConfianza', () => {
  // La mascara viene sin alfa: dibujada tal cual, el lienzo la ve opaca en
  // todos lados y `destination-in` no recorta nada.
  it('escribe el alfa del recorte y no toca el color', () => {
    const confianza = Float32Array.from([0, 0.6, 1]);
    // Un color que no es blanco: si lo pisara, aunque fuera con blanco, se nota.
    const destino = Uint8ClampedArray.from([10, 20, 30, 99, 10, 20, 30, 99, 10, 20, 30, 99]);
    alfaDesdeConfianza(confianza, destino, Float32Array.from(confianza), tabularRecorte(RECORTE));

    expect([destino[0], destino[1], destino[2], destino[3]]).toEqual([10, 20, 30, 0]);
    expect([destino[4], destino[5], destino[6]]).toEqual([10, 20, 30]);
    expect(destino[7]).toBeGreaterThan(120);
    expect(destino[7]).toBeLessThan(136);
    expect([destino[8], destino[9], destino[10], destino[11]]).toEqual([10, 20, 30, 255]);
  });

  it('confianza cero deja el pixel transparente, no negro', () => {
    const destino = new Uint8ClampedArray(4).fill(255);
    alfaDesdeConfianza(Float32Array.from([0]), destino, new Float32Array(1), tabularRecorte(RECORTE));
    // Si el fondo saliera negro en vez de transparente, la persona quedaria
    // recortada sobre un rectangulo negro tapando el fondo de la carrera.
    expect(destino[3]).toBe(0);
  });

  it('se queda con la confianza suavizada para la mascara siguiente', () => {
    const suavizada = Float32Array.from([0.75]);
    alfaDesdeConfianza(Float32Array.from([0.5]), new Uint8ClampedArray(4), suavizada, tabularRecorte(RECORTE));
    // 0,5 es la duda entera: se queda casi todo de la anterior.
    expect(suavizada[0]).toBeGreaterThan(0.65);
    expect(suavizada[0]).toBeLessThan(0.75);
  });
});

describe('crearSilueta', () => {
  it('convierte la mascara y devuelve el lienzo', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...RECORTE });

    const salida = silueta.actualizar(mascara(2, 2, [0, 1, 1, 0]));

    expect(salida).toBe(lienzo);
    expect(lienzo.width).toBe(2);
    expect(lienzo.height).toBe(2);
    expect([...lienzo.puestas.at(-1).data]).toEqual([
      255, 255, 255, 0,
      255, 255, 255, 255,
      255, 255, 255, 255,
      255, 255, 255, 0,
    ]);
  });

  it('separa la lectura de confianza de la conversión a alfa', () => {
    const etapas = [];
    const silueta = crearSilueta({
      crearLienzo: lienzoDeMentira,
      medir: (nombre, fn) => {
        etapas.push(nombre);
        return fn();
      },
      ...RECORTE,
    });

    silueta.actualizar(mascara(2, 1, [0, 1]));

    expect(etapas).toEqual(['maskRead', 'maskConvert']);
  });

  it('devuelve null sin mascara', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira, ...RECORTE });
    expect(silueta.actualizar(null)).toBeNull();
    expect(silueta.actualizar(undefined)).toBeNull();
    expect(silueta.actualizar({})).toBeNull();
  });

  // Pasa cuando la pose se pierde justo entre dos cuadros y MediaPipe ya cerro
  // la mascara. Tiene que degradar a "no hay silueta", no tirar el bucle entero.
  it('una mascara ya cerrada no rompe el cuadro', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira, ...RECORTE });
    const rota = {
      width: 2,
      height: 2,
      getAsFloat32Array: () => {
        throw new Error('la mascara ya se cerro');
      },
    };
    expect(() => silueta.actualizar(rota)).not.toThrow();
    expect(silueta.actualizar(rota)).toBeNull();
  });

  it('rechaza una mascara que no mide lo que dice medir', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira, ...RECORTE });
    expect(silueta.actualizar(mascara(4, 4, [0.1, 0.2, 0.3]))).toBeNull();
    expect(silueta.actualizar(mascara(1, 1, [0.1, 0.2, 0.3]))).toBeNull();
  });

  it('rechaza una mascara de tamaño cero', () => {
    const silueta = crearSilueta({ crearLienzo: lienzoDeMentira, ...RECORTE });
    expect(silueta.actualizar(mascara(0, 0, []))).toBeNull();
  });

  // Crear un lienzo por cuadro es basura para el recolector cada 50 ms.
  it('reusa el mismo lienzo entre cuadros', () => {
    let creados = 0;
    const silueta = crearSilueta({
      crearLienzo: () => {
        creados++;
        return lienzoDeMentira();
      },
      ...RECORTE,
    });

    silueta.actualizar(mascara(2, 2, [0, 0, 0, 0]));
    silueta.actualizar(mascara(2, 2, [1, 1, 1, 1]));
    expect(creados).toBe(1);
  });

  it('se adapta si cambia el tamaño de la mascara', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...RECORTE });

    silueta.actualizar(mascara(2, 2, [0, 0, 0, 0]));
    silueta.actualizar(mascara(3, 1, [0.1, 0.2, 0.3]));

    expect(lienzo.width).toBe(3);
    expect(lienzo.height).toBe(1);
    expect(lienzo.puestas.at(-1).data).toHaveLength(12);
  });

  // EL PARPADEO DE LA SILLA. Lo que el modelo no sabe si es persona —el
  // respaldo de la silla, el marco de una ventana— le sale a medias y saltando
  // de una mascara a la otra. Usada tal cual de alfa, este pixel iba de 64 a
  // 166 veinte veces por segundo: la sala real titilando detras de la persona.
  it('lo que el modelo ve a medias no titila', () => {
    const salida = alfasDe(alternando(0.25, 0.65, 20), CONFIG.silueta);

    expect(Math.max(...salida)).toBeLessThanOrEqual(16);
    for (let i = 1; i < salida.length; i++) {
      expect(Math.abs(salida[i] - salida[i - 1])).toBeLessThanOrEqual(8);
    }
  });

  // La curva sola no alcanza: empinada, agranda el salto en vez de sacarlo.
  // Es la mezcla con la mascara anterior la que lo calma.
  it('sin la mezcla con la anterior, la curva sola lo empeora', () => {
    const salida = alfasDe(alternando(0.25, 0.65, 6), { ...CONFIG.silueta, mezcla: 0 });
    expect(Math.max(...salida) - Math.min(...salida)).toBeGreaterThan(102);
  });

  // La mezcla es solo donde el modelo duda: una mano que entra o sale es
  // confianza segura y pasa en la misma mascara, sin estela.
  it('lo seguro pasa de inmediato', () => {
    expect(alfasDe([0, 0, 1, 1, 0, 0], CONFIG.silueta)).toEqual([0, 0, 255, 255, 0, 0]);
  });

  // Con la confianza tal cual, la ropa oscura —donde el modelo esta seguro
  // pero no del todo— dejaba ver el fondo a traves de la persona.
  it('la persona es entera, sin el fondo transparentandose', () => {
    expect(alfasDe([0.85, 0.85, 0.85], CONFIG.silueta)).toEqual([255, 255, 255]);
  });

  it('lo que el modelo apenas ve no se dibuja', () => {
    expect(alfasDe([0.3, 0.3, 0.3], CONFIG.silueta)).toEqual([0, 0, 0]);
  });

  // Despues de un hueco, lo que se venia suavizando es de otro momento —quizas
  // de otra persona— y no se mezcla con lo nuevo.
  it('una mascara que no llega corta la mezcla', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...RECORTE });
    for (let i = 0; i < 10; i++) silueta.actualizar(mascara(1, 1, [0.75]));

    silueta.actualizar(null);
    silueta.actualizar(mascara(1, 1, [0.5]));

    expect(alfas(lienzo)[0]).toBe(alfasDe([0.5])[0]);
  });

  it('reiniciar corta la mezcla', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...RECORTE });
    for (let i = 0; i < 10; i++) silueta.actualizar(mascara(1, 1, [0.75]));

    silueta.reiniciar();
    silueta.actualizar(mascara(1, 1, [0.5]));

    expect(alfas(lienzo)[0]).toBe(alfasDe([0.5])[0]);
  });

  it('no mezcla mascaras de tamaños distintos', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...RECORTE });
    for (let i = 0; i < 10; i++) silueta.actualizar(mascara(1, 1, [0.75]));

    silueta.actualizar(mascara(2, 1, [0.5, 0.5]));

    expect(alfas(lienzo)).toEqual([alfasDe([0.5])[0], alfasDe([0.5])[0]]);
  });
});

describe('fraccionConfirmada', () => {
  it('es la parte de lo que la pose ve como persona que la otra tambien ve', () => {
    const pose = Float32Array.from({ length: 70 }, () => 1);
    const selfie = Float32Array.from({ length: 70 }, (_, i) => (i < 35 ? 1 : 0));
    expect(fraccionConfirmada(pose, selfie)).toBeCloseTo(0.5, 1);
  });

  it('sin persona en la pose no hay nada que desmentir', () => {
    expect(fraccionConfirmada(new Float32Array(70), new Float32Array(70))).toBe(1);
  });
});

// LA SEGUNDA OPINION. La pose se lleva lo que la persona tiene pegado —el
// marco de una ventana junto al pelo, los papeles de la mesa— con confianza
// alta, y eso ningun suavizado lo saca. El segmentador selfie lo deja afuera,
// pero solo recortaria a toda la fila de atras: la silueta se queda con lo que
// los dos dan por persona.
describe('crearSilueta con una segunda mascara', () => {
  const conSegunda = (pose, selfie, recorte = RECORTE) => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...recorte });
    const salida = silueta.actualizar(pose, selfie);
    return { salida, alfas: salida ? alfas(lienzo) : null };
  };

  it('se queda con lo que los dos dan por persona', () => {
    // 64 pixeles de persona segun la pose; el selfie desmiente los ultimos 8.
    const { alfas: salida } = conSegunda(
      mascaraCon(8, 8, () => 1),
      mascaraCon(8, 8, (i) => (i < 56 ? 1 : 0)),
    );
    expect(salida.slice(0, 56).every((a) => a === 255)).toBe(true);
    expect(salida.slice(56).every((a) => a === 0)).toBe(true);
  });

  // La pose sigue a una sola persona; el selfie ve a todas. Lo que la pose no
  // ve —el que espera en la fila— no entra aunque el selfie lo vea.
  it('lo que la pose no ve no lo agrega la segunda', () => {
    const { alfas: salida } = conSegunda(
      mascaraCon(8, 8, (i) => (i < 32 ? 1 : 0)),
      mascaraCon(8, 8, () => 1),
    );
    expect(salida.slice(32).every((a) => a === 0)).toBe(true);
  });

  it('sin segunda mascara, sale de la pose sola', () => {
    const { alfas: salida } = conSegunda(mascaraCon(8, 8, () => 1), null);
    expect(salida.every((a) => a === 255)).toBe(true);
  });

  it('una segunda mascara rota o de otro tamaño se ignora, no corta la silueta', () => {
    const rota = {
      width: 8,
      height: 8,
      getAsFloat32Array: () => {
        throw new Error('la mascara ya se cerro');
      },
    };
    for (const segunda of [rota, mascaraCon(4, 4, () => 0)]) {
      const { salida, alfas: salida2 } = conSegunda(mascaraCon(8, 8, () => 1), segunda);
      expect(salida).not.toBeNull();
      expect(salida2.every((a) => a === 255)).toBe(true);
    }
  });

  // Si el selfie no ve a la persona —un cuadro que falla, mala luz—, la
  // interseccion la borraria entera y quedaria el fondo sin nadie adelante.
  it('si la segunda no ve a la persona, manda la pose', () => {
    const { alfas: salida } = conSegunda(mascaraCon(8, 8, () => 1), mascaraCon(8, 8, () => 0));
    expect(salida.every((a) => a === 255)).toBe(true);
  });

  it('la mezcla arranca de lo que confirman los dos', () => {
    const lienzo = lienzoDeMentira();
    const silueta = crearSilueta({ crearLienzo: () => lienzo, ...RECORTE });
    // Primera mascara: la pose dice 0,9 en todos lados, el selfie 0,5 en uno.
    silueta.actualizar(mascaraCon(8, 8, () => 0.9), mascaraCon(8, 8, (i) => (i === 0 ? 0.5 : 0.9)));

    expect(alfas(lienzo)[0]).toBe(alfasDe([0.5])[0]);
  });

  it('mide la lectura de la segunda mascara aparte', () => {
    const etapas = [];
    const silueta = crearSilueta({
      crearLienzo: lienzoDeMentira,
      medir: (nombre, fn) => {
        etapas.push(nombre);
        return fn();
      },
      ...RECORTE,
    });

    silueta.actualizar(mascaraCon(8, 8, () => 1), mascaraCon(8, 8, () => 1));

    expect(etapas).toEqual(['maskRead', 'selfieRead', 'maskConvert']);
  });
});
