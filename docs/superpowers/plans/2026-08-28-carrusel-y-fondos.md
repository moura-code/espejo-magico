# Carrusel de doce, el objeto en su lugar y los fondos candidatos — plan

> **Para quien ejecuta:** SUB-SKILL REQUERIDA: `superpowers:executing-plans` (en esta sesión) o `superpowers:subagent-driven-development`, tarea por tarea. Los pasos usan casillas (`- [ ]`).

**Objetivo:** reemplazar los cinco objetos en arco por un carrusel con las doce ingenierías que gira lento y se detiene mientras se sostiene un objeto; al completarse, el nombre de la ingeniería va al pie y el objeto vuela a su lugar dentro del fondo; cada carrera declara hasta tres fondos candidatos; la letra pasa a Muffaroo.

**Arquitectura:** `tablero.js` pasa de arco a anillo con fase y ventana visible (la máquina de estados y `eleccion.js` no cambian). Un módulo nuevo `vuelo.js` calcula el viaje del objeto a su lugar y su flotación. `contenido.js` valida `fondos[{img, lugar}]` y deja de exigir `persona`. `main.js` sólo cablea: `dt` al tablero, blancos visibles, origen del vuelo, orden de capas.

**Tecnología:** módulos ES nativos sin bundler, vitest en Node, canvas 2D. Sin dependencias nuevas.

**Spec:** `docs/superpowers/specs/2026-08-28-carrusel-y-fondos-design.md`

## Restricciones globales

- Castellano en identificadores, comentarios, pruebas, docs y commits. Identificadores y comentarios **sin tildes** (la ñ sí); strings visibles y markdown con ortografía completa.
- Todo número ajustable vive en `espejo/config.js`. Ninguna constante mágica en otro archivo.
- Todo lo externo se inyecta: el reloj entra como `ahora` o `dt`; nunca `Date.now()` en la lógica.
- `main.js` es cableado: nada probable vive ahí. `tests/integracion/sintaxis.test.js` verifica sus imports.
- Sin red en tiempo de ejecución. Sin dependencias de producción.
- `npm test` en verde después de cada tarea. Commits chicos, con el porqué en el mensaje.
- Los comentarios explican **por qué**, como el resto del código.

---

### Tarea 1: Muffaroo

**Archivos:**
- Crear: `contenido/assets/tipografias/Muffaroo-Regular.ttf` (copia de `C:/Development/MAITE/public/fonts/Muffaroo-Regular.ttf`), `contenido/assets/tipografias/Muffaroo-LEEME.txt`
- Borrar: `contenido/assets/tipografias/GermaniaOne-Regular.ttf`, `contenido/assets/tipografias/GermaniaOne-OFL.txt`
- Modificar: `espejo/escena.js` (constantes `TITULO_SOLO`, `FAMILIA_TITULO`, comentario), `espejo/espejo.html` (`@font-face`), `tests/espejo/escena.test.js` (prueba del respaldo), `tests/listo/contenido-real.test.js` (prueba de la tipografía)

**Interfaces:**
- Produce: `TITULO_SOLO === "'Muffaroo'"`, `FAMILIA_TITULO === "'Muffaroo', 'Arial Narrow', sans-serif"`, `PESO_TITULO === 400` (sin cambio).

- [ ] **Paso 1: la prueba del respaldo**

En `tests/espejo/escena.test.js`, reemplazar la prueba `'la tipografia de titulo declara un respaldo con serifas'` por:

```js
  // Muffaroo es una display condensada, en versales y sin serifas. Si el
  // archivo faltara, el cambio no puede pasar de un cambio de fuente: el
  // respaldo tiene que ser una sans condensada, no una serif ni la sans por
  // defecto del navegador.
  it('la tipografia de titulo es Muffaroo con un respaldo sans', () => {
    expect(TITULO_SOLO).toBe("'Muffaroo'");
    expect(FAMILIA_TITULO).toContain(TITULO_SOLO);
    expect(FAMILIA_TITULO).toMatch(/sans-serif\s*$/);
    expect(FAMILIA_TEXTO).not.toContain(TITULO_SOLO);
  });
```

En `tests/listo/contenido-real.test.js`, reemplazar la prueba `'la tipografia de MAITE esta copiada, con su licencia'` por:

```js
  // Si falta, el espejo cae a la sans del sistema sin decir nada y deja de
  // leerse como una misma instalacion con las tablets — que es exactamente
  // para lo que se copio la tipografia. La nota de licencia viaja con el
  // archivo: Muffaroo se declara "free for personal use only" y la facultad
  // tiene que saberlo.
  it('la tipografia de las tablets de MAITE esta copiada, con su nota de licencia', async () => {
    for (const archivo of [
      'assets/tipografias/Muffaroo-Regular.ttf',
      'assets/tipografias/Muffaroo-LEEME.txt',
    ]) {
      expect(await existe(archivo), `falta contenido/${archivo}`).toBe(true);
    }
  });
```

- [ ] **Paso 2: correr y ver fallar**

`npx vitest run tests/espejo/escena.test.js` → falla `'la tipografia de titulo es Muffaroo con un respaldo sans'` (TITULO_SOLO es Germania One).

- [ ] **Paso 3: archivos y constantes**

```bash
cp /c/Development/MAITE/public/fonts/Muffaroo-Regular.ttf contenido/assets/tipografias/Muffaroo-Regular.ttf
git rm -q contenido/assets/tipografias/GermaniaOne-Regular.ttf contenido/assets/tipografias/GermaniaOne-OFL.txt
```

`contenido/assets/tipografias/Muffaroo-LEEME.txt`:

```
Muffaroo — Regular (única variante)

Origen: copiada de MAITE (public/fonts/Muffaroo-Regular.ttf), el proyecto de
las tablets del stand. Sus cuatro temas (public/temas/tablet-*.css) la usan como
--font-display: es la letra que las tablets muestran de verdad, y el espejo la
comparte para que las dos piezas se lean como una sola instalación.

Licencia que declara el archivo (tabla "name" del TTF):
  Copyright Imagex © 2010. All Rights Reserved.
  Diseño: IMAGEX — imagex-fonts.com
  "Free for personal use ONLY"

Un stand de facultad no es uso personal. La cátedra pidió esta letra sabiendo
que está en MAITE; si la instalación se muestra en público, corresponde que la
facultad tenga la licencia comercial de Imagex o cambie la letra. Es su
decisión, no del código: cambiarla es tocar espejo/espejo.html (@font-face) y
TITULO_SOLO / FAMILIA_TITULO en espejo/escena.js.
```

En `espejo/escena.js` reemplazar el bloque de comentario y constantes de la tipografía por:

```js
/**
 * Las dos tipografias, y la division es la MISMA que hacen las tablets de MAITE
 * (`--font-display` y `--font-body` en sus temas): espejo y retratos estan a
 * dos metros uno del otro en el stand y tienen que leerse como una sola
 * instalacion.
 *
 * `titulo` es Muffaroo, la que los cuatro temas de tablet ponen en
 * `--font-display` (el style.css base dice Germania One, pero ninguna tablet
 * la muestra). Trae UNA sola variante (Regular, 400): pedirle 700 le da un
 * falso-bold que le arruina las formas, asi que todo lo que la use va en 400.
 * Es una display condensada, en versales y sin serifas: el respaldo es una sans
 * condensada, para que si el archivo faltara el cambio no pase de un cambio de
 * fuente.
 *
 * `texto` es la sans del sistema, y no es una concesion: a tamaño de parrafo la
 * display cuesta leerla, y la consigna hay que entenderla de un vistazo. MAITE
 * llego a la misma conclusion.
 *
 * `TITULO_SOLO` es el nombre de la familia sin respaldo, que es lo que hay que
 * pasarle a document.fonts.load(): el canvas NO dispara la carga de una fuente.
 */
export const TITULO_SOLO = "'Muffaroo'";
export const FAMILIA_TITULO = `${TITULO_SOLO}, 'Arial Narrow', sans-serif`;
export const FAMILIA_TEXTO = 'system-ui, sans-serif';

/** Muffaroo no tiene negrita: se dibuja siempre en 400. */
export const PESO_TITULO = 400;
```

En `espejo/espejo.html` reemplazar el comentario CSS y el `@font-face` por:

```html
    /*
      La tipografía de los títulos es la que muestran las tablets de MAITE
      (`--font-display` en sus temas `tablet-*.css`). No es decoración: espejo y
      retratos están a dos metros uno del otro en el stand y tienen que leerse
      como una sola instalación, no como dos proyectos que se juntaron.

      Muffaroo trae una sola variante (Regular, 400): pedirle negrita da un
      falso-bold que le arruina las formas. Es condensada, en versales y sin
      serifas, así que el respaldo es una sans condensada: si el archivo faltara
      el cambio no pasa de un cambio de fuente. La nota de licencia está en
      contenido/assets/tipografias/Muffaroo-LEEME.txt.
    */
    @font-face {
      font-family: 'Muffaroo';
      src: url('/contenido/assets/tipografias/Muffaroo-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
      font-display: swap;
    }
```

- [ ] **Paso 4: correr todo**

`npm test` → verde. `npm run listo` → la prueba de tipografía en verde (sigue el rojo de `persona`, que se va en la tarea 6).

- [ ] **Paso 5: commit**

```bash
git add -A contenido/assets/tipografias espejo/escena.js espejo/espejo.html tests/espejo/escena.test.js tests/listo/contenido-real.test.js
git commit -m "feat: la letra que las tablets muestran de verdad es Muffaroo, no Germania One"
```

(Cuerpo del mensaje: los temas de tablet pisan `--font-display`; el TTF se declara para uso personal; el respaldo cambia a sans condensada.)

---

### Tarea 2: el anillo del tablero

**Archivos:**
- Modificar: `espejo/tablero.js`, `espejo/config.js` (sección `tablero`), `tests/espejo/tablero.test.js`

**Interfaces:**
- Produce: `angulosDelAnillo(cantidad, fase)` → grados en `[0, 360)`; `alfaEnVentana(angulo, desde, hasta, fundido)` → 0..1; `angulosDeLaVentana(desde, hasta, paso = 5)`; `crearTablero({ radioFactor, radioObjetoFactor, desde, hasta, suavizado, hombrosPorRostro, caidaPorRostro, margen, gradosPorSegundo, gradosDeFundido, aireEntreObjetos })` con `actualizar({ pose, rostro, disposicion, cantidad, congelar = false, dt = 0 })` → `{ ancla, escala, radioObjeto, fase, ubicaciones: [{ x, y, angulo, alfa }] }` (una por ranura, en el mismo orden que lo ofrecido) y `reiniciar()` (ancla y fase).
- Se va: `angulosDelArco`. `radioQueEntra` queda igual.

- [ ] **Paso 1: reescribir la prueba del tablero**

Reemplazar `tests/espejo/tablero.test.js` entero por:

```js
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
  const sentada = { pose: conPose(540, 1400, 380), rostro: null, disposicion: PANTALLA, cantidad: DOCE };

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
  // tamaño del objeto a la cuerda entre vecinos.
  it('los objetos no se superponen, ni con la persona muy cerca', () => {
    for (const pose of [conPose(540, 1400, 380), conPose(540, 1000, 1400), conPose(80, 400, 500)]) {
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
      despues = tablero.actualizar({ ...base, pose: conPose(900, 500, 700), congelar: true, dt: 1 });
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
```

- [ ] **Paso 2: correr y ver fallar**

`npx vitest run tests/espejo/tablero.test.js` → falla al importar (`angulosDelAnillo` no existe).

- [ ] **Paso 3: CONFIG**

En `espejo/config.js`, dentro de `tablero`, reemplazar el comentario de cabecera y agregar tres números. El bloque `tablero` queda:

```js
  // Donde se ponen los objetos que se ofrecen: un anillo con todas las
  // carreras, del que solo se ve una ventana.
  //
  // NO van en posiciones fijas de la pantalla: a dos metros de la camara el
  // brazo de la persona alcanza apenas el tercio central del espejo, y doce
  // objetos repartidos por el lienzo serian inalcanzables. Van en un anillo
  // alrededor de los hombros, con el radio proporcional al ancho de hombros —
  // que es el mejor indicador de a que distancia esta sentada. Del anillo se
  // dibuja solo la ventana de arriba; el resto esta "detras del marco" y sigue
  // girando.
  tablero: {
    radioFactor: 1.5, // alcance del anillo, en anchos de hombros
    radioObjetoFactor: 0.22, // tamaño de cada objeto, en anchos de hombros

    // La ventana visible, en grados, medidos como en el lienzo: 180 es a la
    // izquierda, 270 es arriba, 0 es a la derecha. Pasa por encima de la
    // cabeza. Lo que queda fuera no se dibuja ni se puede agarrar.
    desde: 200,
    hasta: 340,

    // Cuanto gira el carrusel. Lento a proposito: a 8 grados por segundo la
    // vuelta entera lleva 45 s y entra un objeto nuevo cada cuatro. La mano
    // lo sigue sin esfuerzo, y se detiene en cuanto empieza un sostenido.
    gradosPorSegundo: 8,

    // La rampa de alfa en cada borde de la ventana, para que nada aparezca ni
    // desaparezca de golpe. Un objeto a medio entrar no se puede agarrar.
    gradosDeFundido: 12,

    // Aire minimo entre dos objetos vecinos, en radios de objeto. Con doce a
    // 30 grados y el radio achicado por el borde del lienzo, sin esto dos
    // objetos se encimarian y el de atras seria inelegible.
    aireEntreObjetos: 0.2,

    // El ancla va muy suavizada: si los objetos siguieran a los hombros cuadro a
    // cuadro, apuntarles seria imposible. Ademas se CONGELA apenas empieza un
    // sostenido —y con ella la rotacion—, para que el blanco no se escape de
    // abajo de la mano.
    suavizado: 0.06,

    // Respaldo cuando no hay pose y solo hay cara: un ancho de hombros son unos
    // tres radios de rostro, y el centro esta un radio y medio mas abajo.
    hombrosPorRostro: 3,
    caidaPorRostro: 1.5,

    // Margen minimo al borde del lienzo, en radios de objeto. Con la persona
    // muy cerca el anillo se sale de la pantalla; esto lo mete de vuelta.
    margen: 1.1,
  },
```

- [ ] **Paso 4: el anillo**

Reemplazar `espejo/tablero.js` entero por:

```js
// Donde se paran los objetos que se ofrecen. Solo geometria: no sabe que es una
// carrera ni quien los va a elegir.
//
// LOS OBJETOS NO VAN EN POSICIONES FIJAS DE LA PANTALLA. A dos metros de la
// camara el brazo de la persona alcanza apenas el tercio central del espejo:
// doce objetos repartidos por el lienzo serian imposibles de tocar para quien
// esta lejos y quedarian encima de la cara de quien esta cerca. Van en un anillo
// alrededor de los hombros, y el radio sale del ancho de hombros, que es el
// mejor indicador de a que distancia esta sentada: mas lejos, todo mas chico y
// mas junto; mas cerca, todo mas grande y mas abierto. No hay ningun umbral que
// calibrar por distancia.
//
// EL ANILLO ES UN CARRUSEL. Tiene una ranura por carrera y gira despacio; de el
// solo se ve la ventana de arriba (`desde` → `hasta`), unos cinco objetos. Los
// demas estan "detras del marco": existen, giran y no se dibujan, como en el
// boceto de la catedra. `congelar` detiene el giro ademas del ancla: es lo que
// hace que el carrusel se pare mientras se sostiene la mano sobre un objeto.

const GRADOS = Math.PI / 180;
const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));
const normalizar = (grados) => ((grados % 360) + 360) % 360;

/**
 * De donde cuelga el anillo. Los hombros mandan; si no hay pose se deducen del
 * rostro, que es lo unico seguro que hay (un ancho de hombros son unos tres
 * radios de cara, y el centro cae un radio y medio mas abajo).
 *
 * Devuelve `{ x, y, escala }` en pixeles de pantalla, o null si no hay nada.
 */
export function calcularAncla({ pose, rostro, hombrosPorRostro = 3, caidaPorRostro = 1.5 }) {
  if (pose?.centroHombros && pose.anchoHombros > 0) {
    return { x: pose.centroHombros.x, y: pose.centroHombros.y, escala: pose.anchoHombros };
  }

  if (rostro?.centro && rostro.radio > 0) {
    return {
      x: rostro.centro.x,
      y: rostro.centro.y + rostro.radio * caidaPorRostro,
      escala: rostro.radio * hombrosPorRostro,
    };
  }

  return null;
}

/**
 * Los angulos de las ranuras, la vuelta entera repartida parejo a partir de
 * la fase. Siempre en [0, 360): la fase crece sin tope y aca se pliega.
 */
export function angulosDelAnillo(cantidad, fase) {
  if (cantidad <= 0) return [];
  const paso = 360 / cantidad;
  return Array.from({ length: cantidad }, (_, i) => normalizar(fase + paso * i));
}

/**
 * Cuanto se ve una ranura segun su angulo: 0 fuera de la ventana, 1 adentro y
 * una rampa de `fundido` grados en cada borde. Sin rampa nada se funde, los
 * objetos aparecen y desaparecen de golpe.
 */
export function alfaEnVentana(angulo, desde, hasta, fundido) {
  if (angulo < desde || angulo > hasta) return 0;
  if (fundido <= 0) return 1;
  return acotar(Math.min(angulo - desde, hasta - angulo) / fundido, 0, 1);
}

/**
 * La ventana muestreada de punta a punta. Es contra esto que se mide el radio
 * que entra en el lienzo: si se midiera contra las ranuras, el radio
 * respiraria cuadro a cuadro con el giro.
 */
export function angulosDeLaVentana(desde, hasta, paso = 5) {
  const angulos = [];
  for (let grados = desde; grados < hasta; grados += paso) angulos.push(grados);
  angulos.push(hasta);
  return angulos;
}

/**
 * El radio mas grande que deja los angulos dados dentro del lienzo, con
 * `margen` de aire hasta el borde.
 *
 * Se achica el anillo en vez de empujar los puntos de a uno: recortar cada
 * punto contra su borde deforma el anillo y amontona dos objetos en la misma
 * esquina, que es justo lo que hace imposible elegir.
 */
export function radioQueEntra(angulos, ancla, disposicion, margen) {
  let maximo = Infinity;

  for (const grados of angulos) {
    const dx = Math.cos(grados * GRADOS);
    const dy = Math.sin(grados * GRADOS);

    if (dx < 0) maximo = Math.min(maximo, (ancla.x - margen) / -dx);
    else if (dx > 0) maximo = Math.min(maximo, (disposicion.ancho - margen - ancla.x) / dx);

    if (dy < 0) maximo = Math.min(maximo, (ancla.y - margen) / -dy);
    else if (dy > 0) maximo = Math.min(maximo, (disposicion.alto - margen - ancla.y) / dy);
  }

  return Math.max(0, maximo);
}

export function crearTablero({
  radioFactor,
  radioObjetoFactor,
  desde,
  hasta,
  suavizado,
  hombrosPorRostro,
  caidaPorRostro,
  margen,
  gradosPorSegundo = 0,
  gradosDeFundido = 0,
  aireEntreObjetos = 0,
}) {
  let suave = null;
  let fase = 0;
  const ventana = angulosDeLaVentana(desde, hasta);

  const mezclar = (actual, objetivo) => actual + suavizado * (objetivo - actual);

  return {
    /**
     * `dt` son los segundos desde el cuadro anterior: es lo que hace girar el
     * carrusel. `congelar` deja el anillo donde esta —ancla y fase— aunque la
     * persona se mueva. Se pone en true apenas empieza un sostenido: si el
     * blanco siguiera a los hombros, el gesto de estirar el brazo lo correria de
     * abajo de la propia mano, y si siguiera girando, elegir seria perseguir un
     * objeto que se escapa.
     */
    actualizar({ pose, rostro, disposicion, cantidad, congelar = false, dt = 0 }) {
      const medido = calcularAncla({ pose, rostro, hombrosPorRostro, caidaPorRostro });

      if (!suave) {
        // Sin lectura todavia: el centro de la pantalla, con una escala derivada
        // del lienzo. Asi el tablero existe desde el primer cuadro y no aparece
        // de golpe cuando la pose engancha.
        suave = medido
          ? { ...medido }
          : { x: disposicion.ancho / 2, y: disposicion.alto * 0.62, escala: disposicion.ancho * 0.4 };
      } else if (medido && !congelar) {
        // Muy suavizado a proposito: seguir los hombros cuadro a cuadro haria
        // temblar los blancos y apuntarles seria imposible.
        suave = {
          x: mezclar(suave.x, medido.x),
          y: mezclar(suave.y, medido.y),
          escala: mezclar(suave.escala, medido.escala),
        };
      }

      if (!congelar) fase = normalizar(fase + gradosPorSegundo * dt);

      const radioPedido = suave.escala * radioObjetoFactor;
      const ancla = {
        // El ancla tambien se acota: con la persona pegada al borde del cuadro,
        // un centro fuera del lienzo dejaba radioQueEntra en cero y todos los
        // objetos apilados en un punto.
        x: acotar(suave.x, radioPedido, Math.max(radioPedido, disposicion.ancho - radioPedido)),
        y: acotar(suave.y, radioPedido, Math.max(radioPedido, disposicion.alto - radioPedido)),
      };

      const radio = Math.min(
        suave.escala * radioFactor,
        radioQueEntra(ventana, ancla, disposicion, radioPedido * margen),
      );

      // La cuerda entre dos ranuras vecinas es lo maximo que puede medir un
      // objeto sin pisar al de al lado. Con pocos objetos no manda; con doce
      // y el radio achicado por el borde, si.
      const cuerda = cantidad > 1 ? radio * Math.sin(Math.PI / cantidad) : Infinity;
      const radioObjeto = Math.min(radioPedido, cuerda / (1 + aireEntreObjetos));

      return {
        ancla,
        escala: suave.escala,
        radioObjeto,
        fase,
        ubicaciones: angulosDelAnillo(cantidad, fase).map((angulo) => ({
          x: ancla.x + Math.cos(angulo * GRADOS) * radio,
          y: ancla.y + Math.sin(angulo * GRADOS) * radio,
          angulo,
          alfa: alfaEnVentana(angulo, desde, hasta, gradosDeFundido),
        })),
      };
    },

    reiniciar() {
      suave = null;
      fase = 0;
    },
  };
}
```

- [ ] **Paso 5: correr**

`npx vitest run tests/espejo/tablero.test.js` → verde. `npm test` → fallan `tests/integracion/eleccion.test.js` (usa `angulosDelArco`? no: usa `CONFIG.eleccion.cantidad`, sigue verde por ahora) y nada más; verificar que el resto siga verde. Si `tests/integracion/eleccion.test.js` falla por `radioObjetoFactor`, se arregla en la tarea 3.

- [ ] **Paso 6: commit**

```bash
git add espejo/tablero.js espejo/config.js tests/espejo/tablero.test.js
git commit -m "feat: el tablero es un anillo que gira y del que solo se ve la ventana de arriba"
```

---

### Tarea 3: todas las carreras en el carrusel, y la pausa del sostenido probada de punta a punta

**Archivos:**
- Modificar: `espejo/config.js` (borrar `eleccion.cantidad`), `espejo/main.js` (sorteo, `dt` al tablero, blancos visibles, comentario), `tests/integracion/eleccion.test.js`, `tests/listo/contenido-real.test.js` (prueba "suficientes para llenar")

**Interfaces:**
- Consume: `crearTablero(...).actualizar({ ..., dt })` → `ubicaciones[{x, y, angulo, alfa}]` (tarea 2).
- Produce en `main.js`: `blancos` = una entrada por ofrecido con `{ id, carrera, definicion, x, y, radio, alfa }`; `objetivos` de la elección = `blancos.filter((b) => b.alfa === 1)`.

- [ ] **Paso 1: la prueba de integración**

Reemplazar `tests/integracion/eleccion.test.js` entero por:

```js
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
      // Igual que main.js: el anillo se congela apenas empieza un sostenido.
      congelar: progreso > 0,
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

  // ESTO ES LO QUE HACE LA EXPERIENCIA. Agarrar un objeto muestra su
  // ingenieria; soltarlo la deja puesta; agarrar otro la reemplaza. Sin esta
  // cadena andando, la persona ve una sola de las doce y se termina ahi.
  it('soltar y agarrar otro objeto muestra la segunda ingenieria', () => {
    let base = null;
    const agarrados = [];

    const { maquina, mostradas } = correr({
      // Dos segundos y medio sobre el primero, uno con la mano baja —mas que la
      // gracia y el olvido juntos, o sea soltar de verdad— y el resto sobre otro.
      manoEn: (ahora, blancos) => {
        base ??= ahora;
        const t = ahora - base;
        const cual = t < 2500 ? 0 : t < 3500 ? null : 3;
        if (cual === null) return null;
        const b = enteros(blancos)[cual];
        if (!agarrados.includes(b.id)) agarrados.push(b.id);
        return { x: b.x, y: b.y };
      },
      hasta: 8000,
      pararAlMostrar: false,
    });

    expect(mostradas).toEqual(agarrados);
    expect(mostradas).toHaveLength(2);
    expect(maquina.carrera()).toBe(agarrados[1]);
    // Una sola persona, aunque haya mirado dos ingenierias.
    expect(maquina.sesion()).toBe(1);
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
          const b = enteros(blancos)[3];
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

  // Con doce objetos a 30 grados, un objeto que gira despacio se sigue con la
  // mano quieta: cruza el radio del blanco en mas de un segundo.
  it('un objeto tarda mas que el sostenido en salirse de abajo de una mano quieta', () => {
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
    const [a] = puesto.ubicaciones;
    const radio = Math.hypot(a.x - puesto.ancla.x, a.y - puesto.ancla.y);
    const pixelesPorSegundo = radio * (CONFIG.tablero.gradosPorSegundo * Math.PI) / 180;
    const alcance = puesto.radioObjeto * CONFIG.eleccion.radioFactor;

    expect((alcance / pixelesPorSegundo) * 1000).toBeGreaterThan(CONFIG.eleccion.msParaElegir);
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
```

- [ ] **Paso 2: correr y ver fallar**

`npx vitest run tests/integracion/eleccion.test.js` → fallan las de `'el carrusel'` si `CONFIG.tablero` todavía no tiene `gradosPorSegundo` (no debería: tarea 2). Si todo pasa ya, seguir: el paso 3 es cableado que la prueba no puede ver.

- [ ] **Paso 3: CONFIG y main.js**

En `espejo/config.js`, borrar de `eleccion`:

```js
    // Cuantos objetos se ofrecen. Tambien cuantas carreras se sortean.
    cantidad: 5,
```

En `espejo/main.js`:

(a) el sorteo — reemplazar

```js
const sorteo = crearSorteo({ ids: jugables.length > 0 ? jugables : contenido.ids });
const maquina = crearMaquina({
  tiempos: CONFIG.tiempos,
  sortearOpciones: () => sorteo.siguientes(CONFIG.eleccion.cantidad),
  manual: CONFIG.avance.manual,
});
```

por

```js
// Se ofrecen TODAS las carreras jugables, en el carrusel. El sorteo sigue
// existiendo por el orden: la bolsa entrega una permutacion fresca por sesion,
// asi dos visitantes seguidos no ven el anillo igual, y la primera de una
// sesion nunca repite la ultima de la anterior (que es la que muestra la red
// de la fila si nadie agarra nada).
const ofrecibles = jugables.length > 0 ? jugables : contenido.ids;
const sorteo = crearSorteo({ ids: ofrecibles });
const maquina = crearMaquina({
  tiempos: CONFIG.tiempos,
  sortearOpciones: () => sorteo.siguientes(ofrecibles.length),
  manual: CONFIG.avance.manual,
});
```

(b) el comentario de `ofrecidos` — reemplazar `// Los cinco que se ofrecen, con el objeto que representa a cada carrera ya` por `// Las que se ofrecen, con el objeto que representa a cada carrera ya`.

(c) el tablero — reemplazar el bloque `// --- tablero y eleccion ---` hasta el cierre del `if (estado === ESTADOS.EXPLORACION) {...} else if (!enEleccion) {...}` por:

```js
  // --- tablero y eleccion ---
  // El anillo se congela apenas empieza un sostenido —ancla y giro—: si
  // siguiera a los hombros, el gesto de estirar el brazo correria el blanco de
  // abajo de la propia mano; y si siguiera girando, elegir seria perseguir un
  // objeto que se escapa. Es la pausa del carrusel que pide la catedra.
  const enEleccion = estado === ESTADOS.HUMO || estado === ESTADOS.EXPLORACION;
  if (enEleccion && ofrecidos.length > 0) {
    const puesto = tablero.actualizar({
      pose,
      rostro,
      disposicion,
      cantidad: ofrecidos.length,
      congelar: progresoDeEleccion > 0,
      dt,
    });

    blancos = ofrecidos.map((ofrecido, i) => ({
      ...ofrecido,
      x: puesto.ubicaciones[i].x,
      y: puesto.ubicaciones[i].y,
      radio: puesto.radioObjeto,
      alfa: puesto.ubicaciones[i].alfa,
    }));
  }

  if (estado === ESTADOS.EXPLORACION) {
    // Solo se puede agarrar lo que esta entero dentro de la ventana: una
    // ranura a medio entrar todavia no es una opcion.
    const paso = eleccion.actualizar({
      manos: manosSuaves,
      objetivos: blancos.filter((blanco) => blanco.alfa === 1),
      ahora,
    });
    progresoDeEleccion = paso.progreso;
    sobreQueBlanco = paso.sobre;
    // `elegido` se repite cuadro a cuadro mientras la mano no se mueva: la
    // maquina descarta el repetido, asi que aca no hace falta recordarlo.
    if (paso.elegido) atender(maquina.mirar(paso.elegido, ahora), ahora);
  } else if (!enEleccion) {
    progresoDeEleccion = 0;
    sobreQueBlanco = null;
  }
```

(d) el dibujo de los objetos — reemplazar el bloque que empieza en `// --- los cinco que se ofrecen ---` hasta el cierre de su `if (transicion.objetos > 0) {...}` por:

```js
  // --- el carrusel ---
  // VA POR DELANTE DEL FONDO Y NO SE APAGA. Es la unica pista de que se puede
  // soltar un objeto y agarrar otro; si se desvaneciera al aparecer la
  // ingenieria, la pantalla diria "ya elegiste" y la exploracion se terminaria
  // ahi. Cada ranura se dibuja con su alfa de ventana: las que estan detras
  // del marco no se ven. El que se esta mostrando se queda con su anillo
  // lleno: es la confirmacion de que lo que se ve atras salio de ese objeto.
  if (transicion.objetos > 0) {
    for (const blanco of blancos) {
      if (blanco.alfa <= 0) continue;
      const esElMostrado = blanco.id === salida.carrera;

      dibujarObjeto(
        ctx,
        {
          definicion: blanco.definicion,
          x: blanco.x,
          y: blanco.y,
          radio: blanco.radio,
          alfa: transicion.objetos * blanco.alfa,
        },
        banco,
        blanco.carrera.color,
      );

      const progresoDelAnillo = esElMostrado
        ? 1
        : blanco.id === sobreQueBlanco
          ? progresoDeEleccion
          : 0;

      if (progresoDelAnillo > 0) {
        ctx.save();
        ctx.globalAlpha = transicion.objetos * blanco.alfa;
        dibujarAnilloDeProgreso(ctx, {
          x: blanco.x,
          y: blanco.y,
          radio: blanco.radio,
          progreso: progresoDelAnillo,
          color: blanco.carrera.color,
        });
        ctx.restore();
      }
    }
  }
```

En `tests/listo/contenido-real.test.js`, reemplazar la prueba `'hay carreras jugables suficientes para llenar la eleccion'` por:

```js
  // Con muy pocas, el carrusel es un anillo casi vacio y girar no tiene sentido.
  it('hay carreras jugables suficientes para que el carrusel sea un carrusel', async () => {
    const jugables = (await leer()).carreras.filter((c) => c.maite);
    expect(jugables.length, 'faltan videos en MAITE para llenar el carrusel')
      .toBeGreaterThanOrEqual(5);
  });
```

- [ ] **Paso 4: correr todo**

`npm test` → verde (incluida `tests/integracion/sintaxis.test.js`, que parsea `main.js`). `grep -rn "eleccion.cantidad" espejo tests herramientas` → sin resultados.

- [ ] **Paso 5: verificación en vivo**

`npm start`, abrir `http://localhost:8080/espejo/espejo.html` con la ventana visible, tecla `A` (manual) y ESPACIO hasta EXPLORACION: el anillo gira lento, sube por la izquierda; con la mano sobre un objeto se detiene y el anillo se llena; al sacarla sigue girando. Si no hay cámara, `--use-fake-device-for-media-stream` y forzar con `window.espejo.avanzar(performance.now())` desde la consola.

- [ ] **Paso 6: commit**

```bash
git add espejo/config.js espejo/main.js tests/integracion/eleccion.test.js tests/listo/contenido-real.test.js
git commit -m "feat: el carrusel ofrece las doce ingenierias y se detiene mientras se sostiene un objeto"
```

---

### Tarea 4: `vuelo.js`, el viaje del objeto a su lugar

**Archivos:**
- Crear: `espejo/vuelo.js`, `tests/espejo/vuelo.test.js`
- Modificar: `espejo/config.js` (`tiempos.vuelo`, sección `fondo`), `espejo/niebla.js` (`calcularTransicionEscena`), `tests/espejo/niebla.test.js`

**Interfaces:**
- Produce: `lugarEnPantalla(lugar, rectangulo)` → `{ x, y, radio }`; `posicionEnVuelo({ origen, destino, t })` → `{ x, y, radio }`; `flotacion(ahora, radio, { amplitud, periodoMs })` → `{ dy, giro }`; `calcularTransicionEscena` devuelve además `vuelo` (0..1).

- [ ] **Paso 1: la prueba de vuelo**

Crear `tests/espejo/vuelo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { lugarEnPantalla, posicionEnVuelo, flotacion } from '../../espejo/vuelo.js';

describe('lugarEnPantalla', () => {
  // El fondo se dibuja cubriendo y recortado: un lugar normalizado a la IMAGEN
  // cae siempre en el mismo sitio de la escena, en cualquier resolucion.
  it('mapea el lugar sobre el rectangulo donde se dibujo el fondo', () => {
    const rectangulo = { x: -200, y: 0, ancho: 1480, alto: 1920 };
    const puesto = lugarEnPantalla({ x: 0.5, y: 0.25, escala: 0.2 }, rectangulo);
    expect(puesto.x).toBeCloseTo(-200 + 740);
    expect(puesto.y).toBeCloseTo(480);
    // La escala es el diametro como fraccion del ancho dibujado.
    expect(puesto.radio).toBeCloseTo(148);
  });
});

describe('posicionEnVuelo', () => {
  const origen = { x: 100, y: 900, radio: 80 };
  const destino = { x: 300, y: 500, radio: 60 };

  it('arranca en el origen y termina en el destino', () => {
    expect(posicionEnVuelo({ origen, destino, t: 0 })).toEqual(origen);
    expect(posicionEnVuelo({ origen, destino, t: 1 })).toEqual(destino);
  });

  it('a mitad de camino esta a mitad de camino, con easing simetrico', () => {
    const medio = posicionEnVuelo({ origen, destino, t: 0.5 });
    expect(medio.x).toBeCloseTo(200);
    expect(medio.y).toBeCloseTo(700);
    expect(medio.radio).toBeCloseTo(70);
  });

  it('avanza sin volver atras', () => {
    let anterior = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const { x } = posicionEnVuelo({ origen, destino, t });
      expect(x).toBeGreaterThanOrEqual(anterior);
      anterior = x;
    }
  });

  it('acota t fuera del rango', () => {
    expect(posicionEnVuelo({ origen, destino, t: -3 })).toEqual(origen);
    expect(posicionEnVuelo({ origen, destino, t: 7 })).toEqual(destino);
  });

  // La red de la fila y una carrera forzada por teclado no tienen ranura a la
  // vista: el objeto aparece en su lugar creciendo desde cero.
  it('sin origen crece en su lugar', () => {
    expect(posicionEnVuelo({ origen: null, destino, t: 0 })).toEqual({ ...destino, radio: 0 });
    expect(posicionEnVuelo({ origen: null, destino, t: 0.5 }).radio).toBeCloseTo(30);
    expect(posicionEnVuelo({ origen: null, destino, t: 1 })).toEqual(destino);
  });
});

describe('flotacion', () => {
  const ajuste = { amplitud: 0.1, periodoMs: 2000 };

  it('sube y baja dentro de la amplitud, en radios del objeto', () => {
    for (let ahora = 0; ahora < 4000; ahora += 37) {
      const { dy, giro } = flotacion(ahora, 50, ajuste);
      expect(Math.abs(dy)).toBeLessThanOrEqual(5 + 1e-9);
      expect(Math.abs(giro)).toBeLessThan(0.1);
    }
  });

  it('es periodica', () => {
    const a = flotacion(300, 50, ajuste);
    const b = flotacion(2300, 50, ajuste);
    expect(a.dy).toBeCloseTo(b.dy);
    expect(a.giro).toBeCloseTo(b.giro);
  });

  it('se mueve de verdad', () => {
    const valores = new Set();
    for (let ahora = 0; ahora < 2000; ahora += 100) valores.add(flotacion(ahora, 50, ajuste).dy.toFixed(3));
    expect(valores.size).toBeGreaterThan(5);
  });
});
```

- [ ] **Paso 2: correr y ver fallar**

`npx vitest run tests/espejo/vuelo.test.js` → falla: no existe `espejo/vuelo.js`.

- [ ] **Paso 3: el módulo**

Crear `espejo/vuelo.js`:

```js
// El viaje del objeto desde su ranura del carrusel hasta su lugar en el fondo,
// y como flota una vez apoyado. Solo numeros: no dibuja, no sabe que es una
// carrera ni que existe un lienzo. Por eso se prueba entero en Node.
//
// El lugar viene normalizado a la IMAGEN del fondo (`x`, `y` en 0–1; `escala`
// es el diametro como fraccion del ancho dibujado). Como el fondo se dibuja
// cubriendo la pantalla y recortado, un punto normalizado a la imagen cae
// siempre en el mismo sitio de la escena —la mesa, la repisa— en cualquier
// resolucion. Normalizarlo a la pantalla lo haria caer en otro lado cada vez
// que cambia el recorte.

const acotar = (valor, minimo, maximo) => Math.min(maximo, Math.max(minimo, valor));

/** Easing simetrico: arranca y frena suave, sin rebote. */
const suavizar = (valor) => {
  const t = acotar(valor, 0, 1);
  return t * t * (3 - 2 * t);
};

/**
 * Donde cae el lugar en pantalla. `rectangulo` es donde se dibujo el fondo
 * (el de calcularRectanguloVideo, que puede sobresalir del lienzo).
 */
export function lugarEnPantalla(lugar, rectangulo) {
  return {
    x: rectangulo.x + lugar.x * rectangulo.ancho,
    y: rectangulo.y + lugar.y * rectangulo.alto,
    radio: (lugar.escala * rectangulo.ancho) / 2,
  };
}

/**
 * Donde esta el objeto a mitad del viaje. `t` va de 0 (en la ranura) a 1 (en
 * su lugar); el tamaño se interpola a la vez, para que el objeto parezca
 * alejarse hacia la escena en vez de deslizarse por encima.
 *
 * Sin origen —la red de la fila, una carrera forzada por teclado— no hay
 * ranura de donde salir: el objeto crece en su lugar desde cero.
 */
export function posicionEnVuelo({ origen, destino, t }) {
  const avance = suavizar(t);
  const desde = origen ?? { x: destino.x, y: destino.y, radio: 0 };
  return {
    x: desde.x + (destino.x - desde.x) * avance,
    y: desde.y + (destino.y - desde.y) * avance,
    radio: desde.radio + (destino.radio - desde.radio) * avance,
  };
}

/**
 * La flotacion del objeto apoyado: sube y baja `amplitud` radios y se inclina
 * apenas, con el mismo periodo. Es la animacion integrada al fondo: suficiente
 * para que se lea vivo, poca para no competir con la persona.
 */
export function flotacion(ahora, radio, { amplitud, periodoMs }) {
  const fase = (ahora / Math.max(1, periodoMs)) * Math.PI * 2;
  return {
    dy: Math.sin(fase) * amplitud * radio,
    giro: Math.sin(fase + Math.PI / 3) * amplitud * 0.6,
  };
}
```

- [ ] **Paso 4: la capa `vuelo` en la transición**

En `tests/espejo/niebla.test.js`, dentro de `describe('calcularTransicionEscena')`: cambiar `tiempos` a `{ enganche: 2000, humo: 3000, aparicion: 2000, vuelo: 1000, cierre: 4000 }`, y reemplazar cada `toEqual({ objetos: X, fondo: Y, contenido: Z })` por el mismo objeto con `vuelo` agregado según esta tabla: ATRACCION y ENGANCHE `vuelo: 0`; HUMO no se compara entero (queda igual); EXPLORACION sin mirada `vuelo: 0`; EXPLORACION con `desdeLaMirada` 0 → `vuelo: 0`; 1000 → los `toBeCloseTo` de fondo y contenido siguen y se agrega `expect(medio.vuelo).toBe(1)`; 2000 → `vuelo: 1`; 88000 → `vuelo: 1`; recién cambiado (mirada 0) `expect(reciencambiado.vuelo).toBe(0)`; CIERRE en 0 → `{ objetos: 1, fondo: 1, contenido: 1, vuelo: 1 }`, en 2000 → `{ objetos: 0.5, fondo: 0.5, contenido: 0.5, vuelo: 1 }`, en 4000 → `{ objetos: 0, fondo: 0, contenido: 0, vuelo: 1 }`. Y agregar:

```js
  // El vuelo tiene su propio plazo, mas corto que la aparicion del fondo: el
  // objeto llega a su lugar mientras el fondo todavia esta entrando.
  it('el objeto vuela a su lugar en tiempos.vuelo', () => {
    expect(en(ESTADOS.EXPLORACION, 5000, 0).vuelo).toBe(0);
    expect(en(ESTADOS.EXPLORACION, 5500, 500).vuelo).toBeCloseTo(0.5);
    expect(en(ESTADOS.EXPLORACION, 6000, 1000).vuelo).toBe(1);
    expect(en(ESTADOS.EXPLORACION, 9000, 4000).vuelo).toBe(1);
  });
```

En `espejo/niebla.js`, en el comentario de `calcularTransicionEscena` agregar la línea `*   vuelo     el objeto agarrado, de su ranura (0) a su lugar en el fondo (1).` después de la de `contenido`, y cambiar el cuerpo:

```js
    case ESTADOS.ATRACCION:
    case ESTADOS.ENGANCHE:
      return { objetos: 0, fondo: 0, contenido: 0, vuelo: 0 };

    // Los objetos se encienden en la segunda mitad del humo. Estan puestos
    // desde el principio del estado, pero encenderlos antes de que el humo
    // este espeso los deja verse a traves y arruina la aparicion.
    case ESTADOS.HUMO:
      return {
        objetos: progreso(transcurrido - tiempos.humo / 2, tiempos.humo / 2),
        fondo: 0,
        contenido: 0,
        vuelo: 0,
      };

    // LOS OBJETOS NO SE APAGAN AL APARECER EL FONDO: quedan enteros y por
    // delante. Soltar uno y agarrar otro es justamente lo que se puede hacer, y
    // si se desvanecieran la unica lectura posible seria "ya elegiste, se
    // termino". El fondo y el nombre se quedan puestos hasta que se agarre
    // otro: con el brazo en alto no se lee. El objeto agarrado vuela a su
    // lugar con su propio plazo, mas corto: llega mientras el fondo entra.
    case ESTADOS.EXPLORACION: {
      const t = desdeLaMirada === null ? 0 : progreso(desdeLaMirada, tiempos.aparicion);
      const vuelo = desdeLaMirada === null ? 0 : progreso(desdeLaMirada, tiempos.vuelo);
      return { objetos: 1, fondo: t, contenido: t, vuelo };
    }

    // En el cierre el objeto ya esta apoyado: se desvanece con todo lo demas.
    case ESTADOS.CIERRE: {
      const salida = 1 - progreso(transcurrido, tiempos.cierre);
      return { objetos: salida, fondo: salida, contenido: salida, vuelo: 1 };
    }

    default:
      return { objetos: 0, fondo: 0, contenido: 0, vuelo: 0 };
```

En `espejo/config.js`, en `tiempos`, después de `aparicion: 2500,`:

```js
    // Cuanto tarda el objeto agarrado en volar de su ranura a su lugar en el
    // fondo. Mas corto que la aparicion: llega mientras el fondo todavia entra,
    // y se lee como que el fondo se arma alrededor de lo que la persona eligio.
    vuelo: 1000,
```

y reemplazar la sección `fondo` por:

```js
  // El fondo de la carrera, detras de la persona, y el objeto apoyado en el.
  fondo: {
    // Cuando la mascara de segmentacion no esta —pose perdida, GPU lenta, modelo
    // sin cargar— el fondo se dibuja igual encima del espejo con esta opacidad,
    // en vez de dejar la pantalla en negro con publico delante.
    opacidadSinMascara: 0.75,
    oscurecerVideo: 0.55, // cuanto se apaga el espejo debajo del fondo sin mascara

    // Donde se apoya el objeto cuando el fondo no declara su `lugar`:
    // normalizado a la imagen, arriba a la izquierda, lejos de la cara y del
    // nombre. `escala` es el diametro como fraccion del ancho de la imagen.
    lugarPorDefecto: { x: 0.22, y: 0.3, escala: 0.16 },

    // El halo del color de la carrera debajo del objeto apoyado. Lo presenta
    // sobre cualquier fondo, foto o escena vectorial, sin pedirle a cada imagen
    // que tenga una mesa justo ahi.
    haloDelLugar: 0.35,

    // La flotacion del objeto apoyado: `amplitud` en radios del objeto. Poca a
    // proposito: tiene que leerse vivo, no competir con la persona.
    flotar: { amplitud: 0.08, periodoMs: 3200 },
  },
```

- [ ] **Paso 5: correr**

`npx vitest run tests/espejo/vuelo.test.js tests/espejo/niebla.test.js` → verde. `npm test` → verde.

- [ ] **Paso 6: commit**

```bash
git add espejo/vuelo.js tests/espejo/vuelo.test.js espejo/niebla.js tests/espejo/niebla.test.js espejo/config.js
git commit -m "feat: el objeto agarrado vuela a su lugar en el fondo y flota ahi"
```

---

### Tarea 5: el nombre al pie y el objeto apoyado (escena.js)

**Archivos:**
- Modificar: `espejo/escena.js` (`calcularDisposicion`, `dibujarNombreDeCarrera`, nueva `dibujarObjetoApoyado`, borrar `dibujarFichaDePersona`), `tests/espejo/escena.test.js`

**Interfaces:**
- Produce: `calcularDisposicion(ancho, alto).pie = { alto, margen, base, tamano, interlinea }` (se van `titulo` y `ficha`); `dibujarNombreDeCarrera(ctx, carrera, disposicion, alfa = 1)` dibuja degradado + nombre en una o dos líneas al pie; `dibujarObjetoApoyado(ctx, { definicion, x, y, radio, alfa, giro, halo }, banco, color)` dibuja el halo y encima el objeto.

- [ ] **Paso 1: las pruebas**

En `tests/espejo/escena.test.js`:

(a) en el import, quitar `dibujarFichaDePersona` y agregar `dibujarObjetoApoyado`.

(b) reemplazar las pruebas `'el ancla del titulo queda arriba y dentro de la pantalla'`, `'el nombre de la carrera se apoya en el ancla del titulo'`, `'la ficha de la persona ocupa el pie de la pantalla'` y `'la ficha deja margen a los costados'` por:

```js
  // El nombre de la ingenieria va donde iba el de la persona: al pie, que es
  // el mismo lugar donde las tablets de MAITE ponen su texto. No puede quedar
  // al medio, que es donde esta la cara.
  it('el pie queda abajo, dentro de la pantalla y con margen a los costados', () => {
    for (const [ancho, alto] of [
      [1080, 1920],
      [1920, 1080],
      [800, 600],
    ]) {
      const d = calcularDisposicion(ancho, alto);
      expect(d.pie.base).toBeGreaterThan(alto * 0.6);
      expect(d.pie.base).toBeLessThan(alto);
      expect(d.pie.base).toBeGreaterThan(alto - d.pie.alto);
      expect(d.pie.margen).toBeGreaterThan(0);
      expect(d.pie.margen * 2).toBeLessThan(ancho);
    }
  });
```

(c) reemplazar el `describe('dibujarFichaDePersona', ...)` entero por:

```js
describe('dibujarNombreDeCarrera', () => {
  const disposicion = calcularDisposicion(1080, 1920);
  const carrera = { nombre: 'Ingeniería Civil', color: '#FF8A3D' };

  it('escribe el nombre de la ingenieria al pie', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);

    const textos = soloDe(ctx, 'fillText');
    expect(textos.map(([, texto]) => texto).join(' ')).toBe('Ingeniería Civil');
    for (const [, , , y] of textos) {
      expect(y).toBeGreaterThan(1920 - disposicion.pie.alto);
      expect(y).toBeLessThanOrEqual(disposicion.pie.base);
    }
  });

  // "Ingenieria en Sistemas de Comunicacion" no entra en un renglon a tamaño
  // de titulo: se parte en dos antes que achicarse hasta lo ilegible.
  it('un nombre largo va en dos lineas, y la ultima queda en la base', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(
      ctx,
      { nombre: 'Ingeniería en Sistemas de Comunicación', color: '#E040FB' },
      disposicion,
      1,
    );

    const textos = soloDe(ctx, 'fillText');
    expect(textos).toHaveLength(2);
    expect(textos.map(([, texto]) => texto).join(' ')).toBe(
      'Ingeniería en Sistemas de Comunicación',
    );
    expect(textos[1][3]).toBeCloseTo(disposicion.pie.base);
    expect(textos[0][3]).toBeLessThan(textos[1][3]);
  });

  // El texto blanco o de color sobre un fondo con una zona clara es ilegible.
  // El degradado de abajo es lo unico que lo sostiene.
  it('pone el degradado que despega el nombre del fondo', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(soloDe(ctx, 'fillRect')).toHaveLength(1);
  });

  it('usa el color de la carrera', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(ctx.fillStyle).toBe('#FF8A3D');
  });

  it('no dibuja nada sin carrera o sin alfa', () => {
    for (const [c, alfa] of [
      [carrera, 0],
      [null, 1],
    ]) {
      const ctx = crearCtxFalso();
      dibujarNombreDeCarrera(ctx, c, disposicion, alfa);
      expect(ctx.llamadas).toEqual([]);
    }
  });

  it('deja el lienzo como estaba', () => {
    const ctx = crearCtxFalso();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    expect(ctx.llamadas[0]).toEqual(['save']);
    expect(ctx.llamadas.at(-1)).toEqual(['restore']);
  });
});

describe('dibujarObjetoApoyado', () => {
  const definicion = { img: 'assets/civil/grua.png', figura: 'grua', escala: 0.2 };
  const apoyado = { definicion, x: 240, y: 580, radio: 70, alfa: 1, giro: 0.02, halo: 0.35 };

  // El halo presenta el objeto sobre cualquier fondo, foto o escena vectorial,
  // sin pedirle a cada imagen que tenga una mesa justo ahi. Va debajo.
  it('dibuja el halo antes que el objeto', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, apoyado, bancoCon({ 'assets/civil/grua.png': imagen() }), '#FF8A3D');

    const orden = ctx.llamadas.map(([que]) => que);
    expect(orden.indexOf('fill')).toBeGreaterThanOrEqual(0);
    expect(orden.indexOf('fill')).toBeLessThan(orden.indexOf('drawImage'));
  });

  it('inclina el objeto con el giro pedido', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, apoyado, bancoCon({ 'assets/civil/grua.png': imagen() }), '#FF8A3D');
    expect(soloDe(ctx, 'rotate')).toEqual([['rotate', 0.02]]);
  });

  it('sin halo dibuja solo el objeto', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(
      ctx,
      { ...apoyado, halo: 0 },
      bancoCon({ 'assets/civil/grua.png': imagen() }),
      '#FF8A3D',
    );
    expect(soloDe(ctx, 'fill')).toHaveLength(0);
    expect(soloDe(ctx, 'drawImage')).toHaveLength(1);
  });

  it('no dibuja nada invisible', () => {
    const ctx = crearCtxFalso();
    dibujarObjetoApoyado(ctx, { ...apoyado, alfa: 0 }, bancoCon(), '#FF8A3D');
    expect(ctx.llamadas).toEqual([]);
  });
});
```

(d) en el `describe` de la tipografía: en `carrera` quitar la línea `persona: {...}`; reemplazar la prueba `'en la ficha, el nombre va en titulo y el texto en la sans'` por:

```js
  it('el pie usa solo la tipografia de titulo', () => {
    const ctx = ctxQueAnotaFuentes();
    dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
    for (const fuente of fuentesDe(ctx)) expect(fuente).toContain(TITULO_SOLO);
  });
```

y en `'nunca se le pide negrita a la tipografia de titulo'` quitar la línea `dibujarFichaDePersona(ctx, carrera, disposicion, 1);` y cambiar el comentario `// Germania One trae UNA sola variante.` por `// Muffaroo trae UNA sola variante.`.

- [ ] **Paso 2: correr y ver fallar**

`npx vitest run tests/espejo/escena.test.js` → falla al importar `dibujarObjetoApoyado`.

- [ ] **Paso 3: escena.js**

(a) `calcularDisposicion` — reemplazar desde `// El ancla del nombre de la ingenieria` hasta el cierre de `ficha: {...},` por:

```js
    // El pie: el nombre de la ingenieria, sobre un degradado que lo despega del
    // fondo. Es el mismo lugar donde las tablets de MAITE ponen su texto, para
    // que espejo y tablets se lean como una sola cosa, y no puede ir al medio,
    // que es donde esta la cara. `base` es la linea de base del ultimo renglon.
    pie: {
      alto: alto * (vertical ? 0.3 : 0.38),
      margen: ancho * 0.08,
      base: alto * (vertical ? 0.84 : 0.8),
      tamano: Math.round(corto * 0.075),
      interlinea: 1.1,
    },
```

(b) borrar `dibujarFichaDePersona` entera (función y comentario) y reemplazar `dibujarNombreDeCarrera` por:

```js
/**
 * El nombre de la ingenieria, al pie, donde antes iba el de la persona.
 *
 * Va sobre un degradado que sube desde el borde de abajo. Sin el, el nombre cae
 * encima del fondo de la carrera y se vuelve ilegible en cuanto el fondo tiene
 * una zona clara. Un nombre largo va en dos renglones antes que achicarse hasta
 * lo ilegible; y si aun asi no entra, se achica.
 */
export function dibujarNombreDeCarrera(ctx, carrera, disposicion, alfa = 1) {
  if (!carrera || alfa <= 0) return;

  const { pie, ancho, alto } = disposicion;
  const disponible = ancho - pie.margen * 2;

  ctx.save();
  ctx.globalAlpha = Math.min(1, alfa);

  const degradado = ctx.createLinearGradient(0, alto - pie.alto, 0, alto);
  degradado.addColorStop(0, 'rgba(5, 8, 14, 0)');
  degradado.addColorStop(0.55, 'rgba(5, 8, 14, 0.88)');
  degradado.addColorStop(1, 'rgba(5, 8, 14, 0.96)');
  ctx.fillStyle = degradado;
  ctx.fillRect(0, alto - pie.alto, ancho, pie.alto);

  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.85)';
  ctx.shadowBlur = 16;

  const medir = (contenido, tamano) => {
    ctx.font = `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
    return ctx.measureText(contenido).width;
  };

  // Primero se intenta entero; si no entra, en dos renglones; y cada renglon
  // se achica lo justo si sigue sin entrar (una sola palabra kilometrica).
  let lineas = [carrera.nombre];
  if (medir(carrera.nombre, pie.tamano) > disponible) {
    lineas = partirEnLineas(carrera.nombre, disponible, (t) => medir(t, pie.tamano)).slice(0, 2);
  }
  const tamano = Math.min(
    ...lineas.map((linea) => tamanoQueEntra(linea, pie.tamano, disponible, medir)),
  );

  ctx.fillStyle = carrera.color;
  ctx.font = `${PESO_TITULO} ${tamano}px ${FAMILIA_TITULO}`;
  const paso = tamano * pie.interlinea;
  lineas.forEach((linea, i) => {
    ctx.fillText(linea, ancho / 2, pie.base - (lineas.length - 1 - i) * paso);
  });

  ctx.restore();
}

/**
 * El objeto agarrado, apoyado en su lugar del fondo.
 *
 * Debajo lleva un halo del color de la carrera: lo presenta sobre cualquier
 * fondo, foto o escena vectorial, sin pedirle a cada imagen que tenga una mesa
 * justo ahi. `giro` es la inclinacion de la flotacion.
 */
export function dibujarObjetoApoyado(ctx, { definicion, x, y, radio, alfa = 1, giro = 0, halo = 0 }, banco, color) {
  if (!definicion || alfa <= 0 || radio <= 0) return;

  if (halo > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, alfa) * halo;
    resplandor(ctx, x, y, radio * 2.2, color);
    ctx.restore();
  }

  dibujarObjeto(ctx, { definicion, x, y, radio, alfa, giro }, banco, color);
}
```

Nota: `resplandor` ya existe más abajo en el archivo (lo usa `dibujarManos`); las declaraciones de función se izan, así que se puede usar antes de su definición. `partirEnLineas` y `tamanoQueEntra` también existen ya.

- [ ] **Paso 4: correr**

`npx vitest run tests/espejo/escena.test.js` → verde. `npm test` → falla `tests/integracion/sintaxis.test.js` porque `main.js` importa `dibujarFichaDePersona`: se arregla en la tarea 7. Todo lo demás verde.

- [ ] **Paso 5: commit**

```bash
git add espejo/escena.js tests/espejo/escena.test.js
git commit -m "feat: el nombre de la ingenieria va al pie y el objeto apoyado lleva su halo"
```

---

### Tarea 6: `fondos` con `lugar`, y adiós a `persona` (contenido.js)

**Archivos:**
- Modificar: `espejo/contenido.js`, `tests/espejo/contenido.test.js`, `contenido/carreras.json`, `tests/listo/contenido-real.test.js`

**Interfaces:**
- Produce: `fondoActivo(carrera)` → `{ img, lugar? } | null`; `validarContenido` acepta `fondos: [{ img, lugar? }]`, rechaza `fondo` y ya no exige `persona`; `cargarContenido(...).todasLasImagenes()` incluye sólo `fondoActivo(c).img`.

- [ ] **Paso 1: las pruebas**

En `tests/espejo/contenido.test.js`:

(a) `carreraValida` pasa a:

```js
const carreraValida = () => ({
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  maite: 'civil',
  fondos: [{ img: 'assets/fondos/civil.png', lugar: { x: 0.2, y: 0.3, escala: 0.16 } }],
  objetos: [{ img: 'assets/civil/grua.png', escala: 0.2 }],
});
```

(b) importar `fondoActivo` junto a los otros.

(c) reemplazar la prueba `'exige la persona con nombre y texto'` y la prueba `'el fondo es opcional pero tiene que ser una ruta'` por:

```js
  // Las personas las muestran las tablets de MAITE; el espejo muestra la
  // ingenieria. Un JSON viejo con `persona` no molesta y no se valida.
  it('no exige ni valida la persona', () => {
    sinErrores({ carreras: [{ ...carreraValida(), persona: undefined }] });
    sinErrores({ carreras: [{ ...carreraValida(), persona: { nombre: '' } }] });
  });

  it('los fondos son opcionales, pero cada uno necesita su ruta', () => {
    sinErrores({ carreras: [{ ...carreraValida(), fondos: undefined }] });
    sinErrores({ carreras: [{ ...carreraValida(), fondos: [{ img: 'a.png' }] }] });
    conError({ carreras: [{ ...carreraValida(), fondos: 'a.png' }] }, '"fondos" tiene que ser una lista');
    conError({ carreras: [{ ...carreraValida(), fondos: [{ lugar: {} }] }] }, 'fondos[0] sin "img"');
  });

  // Un lugar fuera de la imagen deja el objeto fuera de la pantalla, y nadie
  // lo nota hasta que hay alguien sentado delante.
  it('el lugar, si esta, cae dentro de la imagen y tiene tamaño', () => {
    const con = (lugar) => ({ carreras: [{ ...carreraValida(), fondos: [{ img: 'a.png', lugar }] }] });
    sinErrores(con({ x: 0, y: 1, escala: 0.1 }));
    conError(con({ x: 1.2, y: 0.5, escala: 0.1 }), 'entre 0 y 1');
    conError(con({ x: 0.5, y: -0.1, escala: 0.1 }), 'entre 0 y 1');
    conError(con({ x: 0.5, y: 0.5, escala: 0 }), 'mayor que cero');
    conError(con({ x: 0.5 }), 'entre 0 y 1');
  });

  // El campo viejo, en singular, dejaria a la carrera sin fondo en silencio.
  it('rechaza el viejo "fondo" y dice como migrarlo', () => {
    conError(
      { carreras: [{ ...carreraValida(), fondo: 'assets/fondos/civil.png' }] },
      '"fondo" ya no existe',
    );
    conError({ carreras: [{ ...carreraValida(), fondo: 'x' }] }, 'fondos');
  });
```

(d) agregar antes de `describe('cargarContenido')`:

```js
describe('fondoActivo', () => {
  it('es el primero de la lista: elegir es reordenar', () => {
    const carrera = { fondos: [{ img: 'uno.png' }, { img: 'dos.png' }] };
    expect(fondoActivo(carrera)).toEqual({ img: 'uno.png' });
  });

  it('es null sin fondos', () => {
    expect(fondoActivo({})).toBeNull();
    expect(fondoActivo({ fondos: [] })).toBeNull();
    expect(fondoActivo(null)).toBeNull();
  });
});
```

(e) reemplazar la prueba `'junta objetos, representante y fondo para precargarlos'` por:

```js
  // Solo se precarga el fondo activo de cada carrera: 36 candidatos de
  // 1080x1920 en memoria de video no tienen sentido para mostrar doce.
  it('junta objetos, representante y el fondo activo para precargarlos', async () => {
    const contenido = await cargarContenido({
      traer: traerCon({
        carreras: [
          {
            ...carreraValida(),
            objeto: { img: 'assets/civil/casco.png', escala: 0.2 },
            fondos: [{ img: 'assets/fondos/civil.png' }, { img: 'assets/fondos/civil-2.jpg' }],
          },
        ],
      }),
    });
    expect(contenido.todasLasImagenes()).toEqual([
      'assets/civil/grua.png',
      'assets/civil/casco.png',
      'assets/fondos/civil.png',
    ]);
  });
```

- [ ] **Paso 2: correr y ver fallar**

`npx vitest run tests/espejo/contenido.test.js` → fallan las nuevas.

- [ ] **Paso 3: contenido.js**

Reemplazar en `validarContenido` el bloque desde `if (carrera.fondo !== undefined && !esTextoUtil(carrera.fondo)) {` hasta el cierre del bloque de `persona` (inclusive) por:

```js
    // `fondos` son los candidatos: el espejo usa el primero y elegir es
    // reordenar. El campo viejo, en singular, se rechaza con la receta: un JSON
    // sin migrar dejaria a la carrera sin fondo y nadie lo notaria hasta que
    // hay alguien sentado delante.
    if (carrera.fondo !== undefined) {
      errores.push(`${donde}: "fondo" ya no existe; es "fondos": [{ "img": "...", "lugar": {...} }]`);
    }
    if (carrera.fondos !== undefined) {
      if (!Array.isArray(carrera.fondos)) {
        errores.push(`${donde}: "fondos" tiene que ser una lista de { img, lugar }`);
      } else {
        carrera.fondos.forEach((fondo, j) => validarFondo(fondo, `${donde}: fondos[${j}]`, errores));
      }
    }
```

y agregar, después de `validarObjeto`:

```js
const entreCeroYUno = (valor) => typeof valor === 'number' && valor >= 0 && valor <= 1;

/**
 * `lugar` es donde se apoya el objeto agarrado, normalizado a la imagen. Fuera
 * de 0–1 el objeto cae fuera de la pantalla.
 */
function validarFondo(fondo, donde, errores) {
  if (!fondo || !esTextoUtil(fondo.img)) errores.push(`${donde} sin "img"`);
  if (!fondo?.lugar) return;

  const { x, y, escala } = fondo.lugar;
  if (!entreCeroYUno(x) || !entreCeroYUno(y)) {
    errores.push(`${donde} "lugar" necesita "x" e "y" entre 0 y 1`);
  }
  if (typeof escala !== 'number' || escala <= 0) {
    errores.push(`${donde} "lugar.escala" tiene que ser un numero mayor que cero`);
  }
}
```

Agregar después de `objetoDeCarrera`:

```js
/**
 * El fondo que se muestra: el primero de los candidatos. Elegir entre los
 * candidatos es reordenar la lista en carreras.json.
 */
export function fondoActivo(carrera) {
  return carrera?.fondos?.[0] ?? null;
}
```

En `cargarContenido`, `todasLasImagenes` pasa a:

```js
    // Solo el fondo activo: los otros candidatos se miran en la herramienta,
    // no en el espejo.
    todasLasImagenes: () =>
      datos.carreras.flatMap((carrera) => [
        ...carrera.objetos.map((objeto) => objeto.img),
        ...(carrera.objeto ? [carrera.objeto.img] : []),
        ...(fondoActivo(carrera) ? [fondoActivo(carrera).img] : []),
      ]),
```

Actualizar el comentario de cabecera del validador donde dice `// La persona es lo que la pantalla muestra al elegir esta carrera` (se borra con el bloque) y la `_nota` de `carreras.json`.

- [ ] **Paso 4: carreras.json**

Con un script de una vez (no se versiona), migrar las doce carreras: quitar `persona`, reemplazar `"fondo": "assets/fondos/<id>.png"` por `"fondos": [{ "img": "assets/fondos/<id>.png" }]`, y la `_nota` pasa a:

```
"_nota": "Cada carrera aporta UN objeto al carrusel: 'objeto' si esta declarado, si no uno sorteado de 'objetos'. Los PNG son fotografias reales con el fondo recortado; las que salieron de Wikimedia Commons llevan autor y licencia en contenido/assets/CREDITOS.md. 'figura' es el respaldo vectorial por si un PNG falta (espejo/figuras.js) y 'npm run generar-pngs' lo rasteriza sin pisar los PNG existentes. 'maite' es el id de esta carrera en el proyecto de las tablets: en null, la carrera no se ofrece. 'fondos' son los candidatos de fondo, el espejo muestra el primero: elegir es reordenar. Cada uno puede declarar 'lugar' {x, y, escala}, normalizado a la imagen, donde se apoya el objeto agarrado; sin lugar vale CONFIG.fondo.lugarPorDefecto. Se los mira todos juntos en herramientas/fondos.html.",
```

```bash
node -e '
const fs=require("fs");const r="contenido/carreras.json";const d=JSON.parse(fs.readFileSync(r,"utf8"));
d._nota="<la nota de arriba>";
for(const c of d.carreras){delete c.persona;if(c.fondo){c.fondos=[{img:c.fondo}];delete c.fondo;}
  const o={};for(const k of ["id","nombre","color","maite","fondos","objeto","objetos"]) if(k in c)o[k]=c[k];Object.assign(c,o);}
fs.writeFileSync(r,JSON.stringify(d,null,2)+"\n");'
```

(Pegar la nota completa en lugar de `<la nota de arriba>`; revisar el orden de claves de cada carrera: `id, nombre, color, maite, fondos, objetos`.)

En `tests/listo/contenido-real.test.js`: borrar la constante `NOMBRE_PLACEHOLDER` con su comentario y la prueba `'ninguna persona quedo con el texto de fabrica'`; reemplazar la prueba `'cada carrera tiene su fondo en el disco'` por:

```js
  // Sin fondo, la escena cae al color plano de la carrera. Se ve, pero es lo
  // que se supone que reemplaza la foto de la ingenieria. Y todo candidato
  // declarado tiene que estar: la herramienta de eleccion los muestra todos.
  it('cada carrera tiene su fondo activo, y todos los candidatos estan en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      if (!carrera.fondos?.length) faltantes.push(`${carrera.id} (sin declarar)`);
      for (const fondo of carrera.fondos ?? []) {
        if (!(await existe(fondo.img))) faltantes.push(fondo.img);
      }
    }
    expect(faltantes, 'corré npm run generar-fondos o dejá las imágenes reales').toEqual([]);
  });
```

- [ ] **Paso 5: correr**

`npx vitest run tests/espejo/contenido.test.js` → verde. `npm run listo` → verde salvo lo que dependa de `main.js` (nada). `npm test` → sigue fallando sólo `sintaxis.test.js` por `main.js` (tarea 7).

- [ ] **Paso 6: commit**

```bash
git add espejo/contenido.js tests/espejo/contenido.test.js contenido/carreras.json tests/listo/contenido-real.test.js
git commit -m "feat: cada carrera declara sus fondos candidatos con el lugar del objeto, y ya no lleva persona"
```

---

### Tarea 7: el cableado de la pantalla 2 (main.js)

**Archivos:**
- Modificar: `espejo/main.js`

**Interfaces:**
- Consume: `fondoActivo` (tarea 6), `lugarEnPantalla`, `posicionEnVuelo`, `flotacion` (tarea 4), `dibujarObjetoApoyado`, `dibujarNombreDeCarrera` con `pie` (tarea 5), `transicion.vuelo` (tarea 4).

- [ ] **Paso 1: imports**

En `main.js`: en el import de `./contenido.js` agregar `fondoActivo`; agregar `import { lugarEnPantalla, posicionEnVuelo, flotacion } from './vuelo.js';`; en el import de `./escena.js` quitar `dibujarFichaDePersona` y agregar `dibujarObjetoApoyado`.

- [ ] **Paso 2: el origen del vuelo**

Después de `let mostrada = null;` agregar:

```js
// De donde salio el objeto que se esta mostrando: la posicion de su ranura en
// el cuadro en que se agarro. Se captura una vez, porque el carrusel sigue
// girando mientras el objeto vuela y el origen no puede irse con el. Null
// cuando no habia ranura a la vista: la red de la fila, o una carrera forzada
// por teclado.
let origenDelVuelo = null;
```

En `atender`, dentro de `if (evento.tipo === 'mira') {`, antes de `puente.carrera(...)`:

```js
      const ranura = blancos.find((blanco) => blanco.id === evento.carrera);
      origenDelVuelo =
        ranura && ranura.alfa > 0 ? { x: ranura.x, y: ranura.y, radio: ranura.radio } : null;
```

En el bloque `if (evento.estado === ESTADOS.ATRACCION) {` agregar `origenDelVuelo = null;` después de `mostrada = null;`. Lo mismo en el bloque `if (evento.estado === ESTADOS.HUMO) {`.

- [ ] **Paso 3: el fondo activo y el objeto apoyado**

Reemplazar el bloque `if (transicion.fondo > 0 && carrera) { ... }` entero por:

```js
  // Donde aterriza el objeto agarrado. Se calcula por cuadro y se usa en dos
  // capas: detras de la persona una vez apoyado, y por delante mientras vuela.
  let apoyado = null;

  if (transicion.fondo > 0 && carrera) {
    const fondo = fondoActivo(carrera);
    const imagenDeFondo = fondo ? banco.obtener(fondo.img) : null;
    const hayRecorte = Boolean(video && lienzoDeSilueta);

    // Orden de preferencia, el mismo que el de los objetos: la foto si esta, la
    // escena vectorial si no, y el color plano como ultimo recurso. Un
    // degradado del color no le dice a nadie que es Ingenieria Quimica; un
    // laboratorio si.
    const escena =
      imagenDeFondo ??
      escenarios.obtener(carrera.id, disposicion.ancho, disposicion.alto, carrera.color);
    const alfaDelFondo = transicion.fondo * (hayRecorte ? 1 : CONFIG.fondo.opacidadSinMascara);

    if (escena) {
      dibujarFondo(ctx, escena, disposicion, alfaDelFondo);
    } else {
      // Ni foto ni escena: el color de la carrera. Es feo pero es legible, y el
      // nombre sigue entrando: una carrera sin fondo no rompe nada.
      ctx.save();
      ctx.globalAlpha = transicion.fondo * 0.8;
      ctx.fillStyle = carrera.color;
      ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
      ctx.restore();
    }

    // El lugar del objeto, normalizado a la imagen que se dibujo (o al lienzo
    // entero si no hay imagen), asi cae siempre en el mismo sitio de la
    // escena sin importar el recorte.
    const rectanguloDelFondo = escena
      ? calcularRectanguloVideo(escena.width, escena.height, disposicion.ancho, disposicion.alto)
      : { x: 0, y: 0, ancho: disposicion.ancho, alto: disposicion.alto };
    const destino = lugarEnPantalla(fondo?.lugar ?? CONFIG.fondo.lugarPorDefecto, rectanguloDelFondo);
    const enVuelo = posicionEnVuelo({ origen: origenDelVuelo, destino, t: transicion.vuelo });
    const flota = transicion.vuelo >= 1 ? flotacion(ahora, enVuelo.radio, CONFIG.fondo.flotar) : { dy: 0, giro: 0 };
    apoyado = {
      definicion: mostrada ? objetoMostrado : null,
      x: enVuelo.x,
      y: enVuelo.y + flota.dy,
      radio: enVuelo.radio,
      giro: flota.giro,
      aterrizo: transicion.vuelo >= 1,
    };

    // Apoyado, va DETRAS de la persona: integrado a la escena. Si la persona se
    // inclina sobre ese punto lo tapa, que es lo correcto.
    if (apoyado.aterrizo && apoyado.definicion) {
      dibujarObjetoApoyado(
        ctx,
        { ...apoyado, alfa: transicion.objetos, halo: CONFIG.fondo.haloDelLugar },
        banco,
        carrera.color,
      );
    }

    if (hayRecorte) {
      ctx.save();
      ctx.globalAlpha = transicion.fondo;
      dibujarPersonaRecortada(ctx, {
        capa: persona,
        video,
        rectangulo,
        silueta: lienzoDeSilueta,
        disposicion,
      });
      ctx.restore();
    }
  }
```

El objeto que se muestra es el del ofrecido (el sorteado por sesión, no uno nuevo por cuadro). Agregar junto a `let mostrada = null;`:

```js
// El objeto con el que se agarro la carrera mostrada. Sale de `ofrecidos`, que
// ya sorteo uno por sesion: resolverlo por cuadro haria parpadear el PNG.
let objetoMostrado = null;
```

y en `atender`, dentro del `mira`, después de `mostrada = carrera ?? null;`:

```js
      objetoMostrado =
        ofrecidos.find((ofrecido) => ofrecido.id === evento.carrera)?.definicion ??
        objetoDeCarrera(carrera);
```

(`objetoDeCarrera` ya está importado.) Ponerlo en `null` donde se pone `mostrada = null`.

- [ ] **Paso 4: el carrusel sin el mostrado, y el objeto en vuelo por delante**

En el bloque `// --- el carrusel ---` (tarea 3), la ranura del mostrado queda vacía con su anillo: reemplazar la llamada a `dibujarObjeto(...)` de ese bloque por:

```js
      // La ranura del objeto mostrado queda vacia con su anillo lleno: el
      // objeto se fue a vivir al fondo, y la marca dice cual fue.
      if (!esElMostrado) {
        dibujarObjeto(
          ctx,
          {
            definicion: blanco.definicion,
            x: blanco.x,
            y: blanco.y,
            radio: blanco.radio,
            alfa: transicion.objetos * blanco.alfa,
          },
          banco,
          blanco.carrera.color,
        );
      }
```

Después del bloque del carrusel y antes de `if (estado === ESTADOS.EXPLORACION) { dibujarManos(...)`, agregar:

```js
  // Mientras vuela, el objeto va por delante de todo: sale de su ranura, cruza
  // la pantalla y recien al aterrizar pasa detras de la persona.
  if (apoyado && !apoyado.aterrizo && apoyado.definicion) {
    dibujarObjeto(
      ctx,
      { definicion: apoyado.definicion, x: apoyado.x, y: apoyado.y, radio: apoyado.radio, alfa: transicion.objetos },
      banco,
      carrera.color,
    );
  }
```

- [ ] **Paso 5: el nombre al pie**

Reemplazar las dos líneas

```js
  dibujarNombreDeCarrera(ctx, carrera, disposicion, transicion.contenido);
  dibujarFichaDePersona(ctx, carrera, disposicion, transicion.contenido);
```

por

```js
  dibujarNombreDeCarrera(ctx, carrera, disposicion, transicion.contenido);
```

En `window.espejo` agregar `apoyado: () => apoyado` no es posible (es local del cuadro): agregar en su lugar `origenDelVuelo: () => origenDelVuelo`.

- [ ] **Paso 6: correr y verificar en vivo**

`npm test` → verde, incluida `sintaxis.test.js`. Luego `npm start`, abrir el espejo con la ventana visible, forzar una carrera con la tecla `1`: el objeto aparece creciendo arriba a la izquierda (sin ranura a la vista), con halo, flotando; el nombre abajo en Muffaroo; el carrusel sigue girando. En EXPLORACION con la mano: el objeto vuela de la ranura al lugar y la ranura queda con el anillo lleno. Tecla `M` para ver la malla y confirmar que el objeto apoyado queda detrás de la silueta.

- [ ] **Paso 7: commit**

```bash
git add espejo/main.js
git commit -m "feat: el objeto agarrado vuela a su lugar en el fondo y el nombre de la ingenieria va al pie"
```

---

### Tarea 8: la página para elegir fondos y el generador

**Archivos:**
- Modificar: `herramientas/fondos.html`, `herramientas/generar-fondos.html`, `herramientas/generar-fondos.mjs` (sólo comentarios si hace falta)

**Interfaces:**
- Consume: `fondoActivo`, `cargarContenido`, `objetoDeCarrera`, `dibujarEscenario`, `dibujarFondo`, `dibujarNombreDeCarrera`, `dibujarObjetoApoyado`, `calcularDisposicion`, `calcularRectanguloVideo`, `lugarEnPantalla`, `crearBanco`, `cargarImagenDelNavegador`, `CONFIG`.

- [ ] **Paso 1: generar-fondos.html usa el activo**

En `herramientas/generar-fondos.html`, importar `fondoActivo` desde `../espejo/contenido.js` y reemplazar el cuerpo del `for` por:

```js
    for (const carrera of contenido.carreras) {
      const fondo = fondoActivo(carrera);
      if (!fondo) {
        salida.avisos.push(`${carrera.id}: no declara fondos en carreras.json`);
        continue;
      }
      if (!ESCENARIOS[carrera.id]) {
        salida.avisos.push(`${carrera.id}: no tiene escena en espejo/escenarios.js`);
        continue;
      }

      const lienzo = document.createElement('canvas');
      lienzo.width = ANCHO;
      lienzo.height = ALTO;
      const ctx = lienzo.getContext('2d');

      dibujarEscenario(ctx, carrera.id, ANCHO, ALTO, carrera.color);
      salida.pngs[fondo.img] = lienzo.toDataURL('image/png');
    }
```

- [ ] **Paso 2: fondos.html muestra los candidatos como se verían**

Reemplazar `herramientas/fondos.html` entero por:

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Los fondos de cada ingeniería</title>
  <style>
    @font-face {
      font-family: 'Muffaroo';
      src: url('/contenido/assets/tipografias/Muffaroo-Regular.ttf') format('truetype');
      font-weight: 400;
      font-style: normal;
    }
    body {
      margin: 0;
      padding: 24px;
      background: #0b0e13;
      color: #e8eaf0;
      font: 14px/1.4 system-ui, sans-serif;
    }
    h1 { font-size: 18px; font-weight: 600; margin: 0 0 4px; }
    h2 { font-size: 15px; font-weight: 600; margin: 28px 0 8px; }
    p { margin: 0 0 8px; color: #97a0b5; }
    .fila { display: flex; gap: 18px; flex-wrap: wrap; }
    figure { margin: 0; width: 270px; }
    canvas { width: 270px; height: 480px; display: block; border-radius: 6px; background: #000; }
    figcaption { margin-top: 6px; font-size: 12px; color: #97a0b5; }
    b { color: #e8eaf0; font-weight: 600; }
    .activo { color: #00E5A0; }
    .muestra { display: inline-block; width: 12px; height: 12px; border-radius: 3px; vertical-align: -1px; margin-right: 6px; }
  </style>
</head>
<body>
  <!-- Hermana de figuras.html: se abre desde `npm start`. Muestra los fondos
       candidatos de cada carrera TAL COMO SE VERIAN en el espejo: la imagen (o
       la escena vectorial si el archivo no esta), una silueta donde va la
       persona, el halo y el objeto apoyados en su lugar, y el nombre al pie con
       las mismas funciones de escena.js. La catedra elige mirando. -->
  <h1>Los fondos de cada ingeniería</h1>
  <p>El primero de cada fila es el <b class="activo">activo</b>: el espejo muestra ese. Para elegir otro, reordená <b>fondos</b> en <b>contenido/carreras.json</b>. El objeto se apoya en <b>lugar</b>; sin declararlo vale <b>CONFIG.fondo.lugarPorDefecto</b>.</p>
  <div id="carreras"></div>

  <script type="module">
    import { CONFIG } from '../espejo/config.js';
    import { dibujarEscenario } from '../espejo/escenarios.js';
    import { figurasDisponibles } from '../espejo/figuras.js';
    import { cargarContenido, fondoActivo, objetoDeCarrera } from '../espejo/contenido.js';
    import { crearBanco, cargarImagenDelNavegador } from '../espejo/imagenes.js';
    import { lugarEnPantalla } from '../espejo/vuelo.js';
    import {
      calcularDisposicion,
      calcularRectanguloVideo,
      dibujarFondo,
      dibujarNombreDeCarrera,
      dibujarObjetoApoyado,
      TITULO_SOLO,
      PESO_TITULO,
    } from '../espejo/escena.js';

    // A escala: el espejo es 1080x1920 y aca se dibuja a la mitad.
    const ANCHO = 540;
    const ALTO = 960;
    const disposicion = calcularDisposicion(ANCHO, ALTO);

    // El canvas no dispara la carga de la fuente: se espera antes de dibujar.
    await document.fonts.load(`${PESO_TITULO} 32px ${TITULO_SOLO}`).catch(() => {});

    const contenido = await cargarContenido({ figurasValidas: figurasDisponibles() });
    const banco = crearBanco({ cargar: cargarImagenDelNavegador, raiz: '/contenido/' });
    await banco.precargar(
      contenido.carreras.flatMap((c) => [
        ...(c.fondos ?? []).map((f) => f.img),
        ...c.objetos.map((o) => o.img),
        ...(c.objeto ? [c.objeto.img] : []),
      ]),
    );

    /** Una silueta gris, cabeza y hombros, donde se para la persona. */
    function dibujarSilueta(ctx) {
      ctx.save();
      ctx.fillStyle = 'rgba(180, 190, 205, 0.55)';
      ctx.beginPath();
      ctx.ellipse(ANCHO / 2, ALTO * 0.42, ANCHO * 0.11, ANCHO * 0.14, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ANCHO * 0.22, ALTO);
      ctx.quadraticCurveTo(ANCHO * 0.24, ALTO * 0.56, ANCHO / 2, ALTO * 0.55);
      ctx.quadraticCurveTo(ANCHO * 0.76, ALTO * 0.56, ANCHO * 0.78, ALTO);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    function dibujarCandidato(lienzo, carrera, fondo, definicion) {
      const ctx = lienzo.getContext('2d');
      const imagen = fondo ? banco.obtener(fondo.img) : null;
      let rectangulo = { x: 0, y: 0, ancho: ANCHO, alto: ALTO };

      if (imagen) {
        dibujarFondo(ctx, imagen, disposicion, 1);
        rectangulo = calcularRectanguloVideo(imagen.width, imagen.height, ANCHO, ALTO);
      } else if (!dibujarEscenario(ctx, carrera.id, ANCHO, ALTO, carrera.color)) {
        ctx.fillStyle = carrera.color;
        ctx.fillRect(0, 0, ANCHO, ALTO);
      }

      const puesto = lugarEnPantalla(fondo?.lugar ?? CONFIG.fondo.lugarPorDefecto, rectangulo);
      dibujarObjetoApoyado(
        ctx,
        { definicion, ...puesto, alfa: 1, halo: CONFIG.fondo.haloDelLugar },
        banco,
        carrera.color,
      );
      dibujarSilueta(ctx);
      dibujarNombreDeCarrera(ctx, carrera, disposicion, 1);
      return Boolean(imagen);
    }

    const raiz = document.getElementById('carreras');

    for (const carrera of contenido.carreras) {
      const titulo = document.createElement('h2');
      titulo.innerHTML = `<span class="muestra" style="background:${carrera.color}"></span>${carrera.nombre} <span style="color:#97a0b5">(${carrera.id})</span>`;
      const fila = document.createElement('div');
      fila.className = 'fila';

      const candidatos = carrera.fondos?.length ? carrera.fondos : [null];
      const definicion = objetoDeCarrera(carrera);

      candidatos.forEach((fondo, i) => {
        const figura = document.createElement('figure');
        const lienzo = document.createElement('canvas');
        lienzo.width = ANCHO;
        lienzo.height = ALTO;
        const hayImagen = dibujarCandidato(lienzo, carrera, fondo, definicion);

        const pie = document.createElement('figcaption');
        const lugar = fondo?.lugar ?? CONFIG.fondo.lugarPorDefecto;
        pie.innerHTML =
          `${i === 0 ? '<b class="activo">activo</b>' : `candidato ${i + 1}`} · ` +
          `<b>${fondo?.img ?? 'sin fondos declarados'}</b>` +
          `${fondo && !hayImagen ? ' — ARCHIVO NO ENCONTRADO, se muestra la escena vectorial' : ''}` +
          `<br>lugar: x ${lugar.x}, y ${lugar.y}, escala ${lugar.escala}${fondo?.lugar ? '' : ' (por defecto)'}`;

        figura.append(lienzo, pie);
        fila.append(figura);
      });

      raiz.append(titulo, fila);
    }

    document.title = `${contenido.carreras.length} ingenierías, sus fondos`;
  </script>
</body>
</html>
```

- [ ] **Paso 3: verificar**

`npm start`, abrir `http://localhost:8080/herramientas/fondos.html`: doce filas, una tarjeta por candidato (hoy una por carrera), con la silueta, el objeto con su halo arriba a la izquierda y el nombre al pie en Muffaroo. `npm run generar-fondos` → "0 fondos de respaldo generados; 12 carreras ya tenían imagen".

- [ ] **Paso 4: commit**

```bash
git add herramientas/fondos.html herramientas/generar-fondos.html
git commit -m "feat: la herramienta de fondos muestra cada candidato como se veria en el espejo"
```

---

### Tarea 9: los fondos candidatos 2 y 3, de Wikimedia Commons

**Archivos:**
- Crear: `contenido/assets/fondos/<id>-2.jpg` y `<id>-3.jpg` para las doce carreras (24 archivos)
- Modificar: `contenido/carreras.json` (`fondos` de cada carrera con `lugar`), `contenido/assets/CREDITOS.md` (tabla nueva)

Herramientas de desarrollo (no del evento): `curl`, `ffmpeg` (ya instalado en esta máquina), la API de Commons.

- [ ] **Paso 1: buscar candidatos**

Por carrera, consultar la API de Commons (sin clave; fija un `User-Agent`):

```bash
curl -s -A "espejo-magico (info@sketchframer.com)" \
  "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=<busqueda>&gsrnamespace=6&gsrlimit=30&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=640&format=json"
```

Búsquedas por carrera (una o dos por carrera; ajustar si no rinde):

| carrera | búsqueda |
|---|---|
| mecanica | `machine shop lathe workshop interior` |
| electrica | `electrical substation` / `power plant control room` |
| computacion | `server room datacenter` |
| fisico-matematico | `optics laboratory laser bench` / `blackboard equations lecture hall` |
| civil | `bridge construction site` / `concrete formwork construction` |
| quimica | `chemistry laboratory fume hood` |
| alimentos | `food processing plant stainless steel` / `dairy plant` |
| produccion | `factory assembly line` / `warehouse pallets racks` |
| agrimensura | `surveying total station field` / `topographic survey landscape` |
| comunicacion | `radio telescope antenna` / `telecommunications tower` |
| forestal | `pine forest plantation` / `tree nursery forestry` |
| naval | `shipyard dry dock` / `ship hull construction` |

Filtrar en la respuesta: `extmetadata.LicenseShortName` en {`CC0`, `Public domain`, `CC BY 2.0/2.5/3.0/4.0`, `CC BY-SA 2.0/2.5/3.0/4.0`}, `width ≥ 1600`, sin personas identificables (mirar la miniatura `thumburl` con el visor de imágenes), con el centro y la mitad de abajo tranquilos y una zona libre a un costado. Guardar por candidato: nombre de archivo en Commons, URL de la página (`descriptionurl`), autor (`extmetadata.Artist.value`, sin HTML), licencia, URL del original (`url`).

- [ ] **Paso 2: preparar cada imagen**

Descargar el original y recortar a 9:16 alrededor de la zona elegida, escalar a 1080×1920, oscurecer y guardar JPEG. Con ffmpeg (`iw`/`ih` son el tamaño de origen; `crop=w:h:x:y` se ajusta por foto para conservar la zona buena):

```bash
curl -sL -A "espejo-magico (info@sketchframer.com)" -o /tmp/origen.jpg "<url del original>"
ffmpeg -v error -y -i /tmp/origen.jpg \
  -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920,eq=brightness=-0.12:saturation=0.9,colorlevels=rimax=0.72:gimax=0.72:bimax=0.72" \
  -q:v 4 contenido/assets/fondos/<id>-2.jpg
```

(`colorlevels ... 0.72` apaga los blancos: la persona recortada y el nombre necesitan un fondo oscuro y un fondo claro delata el borde de la silueta. Mover el `x` del `crop` para elegir qué tercio de una foto apaisada queda.) Mirar el resultado con el visor de imágenes: si el centro o el pie quedan cargados, cambiar el recorte; si sigue clara, bajar `rimax/gimax/bimax` a 0.6.

- [ ] **Paso 3: el lugar de cada foto**

Elegir sobre la imagen final una zona libre para el objeto (una mesa, una repisa, un tramo de pared) y escribirla en `carreras.json`:

```json
"fondos": [
  { "img": "assets/fondos/quimica.png" },
  { "img": "assets/fondos/quimica-2.jpg", "lugar": { "x": 0.2, "y": 0.28, "escala": 0.15 } },
  { "img": "assets/fondos/quimica-3.jpg", "lugar": { "x": 0.78, "y": 0.33, "escala": 0.16 } }
]
```

Verificar en `herramientas/fondos.html` que el objeto cae donde se pensó y no sobre la silueta ni sobre el nombre.

- [ ] **Paso 4: los créditos**

En `contenido/assets/CREDITOS.md`, cambiar el título a `# Créditos de las imágenes tomadas de Wikimedia Commons`, y agregar al final:

```markdown
## Fondos

Los fondos `-2` y `-3` de cada ingeniería son fotografías de Wikimedia Commons
con licencias libres, **recortadas a 9:16, escaladas a 1080×1920 y
oscurecidas** para que la persona recortada y el nombre se lean encima; esas
versiones son obras derivadas y conservan la licencia de origen. El fondo sin
sufijo de cada ingeniería es la escena vectorial propia del proyecto
(`espejo/escenarios.js`) y no lleva atribución.

| Archivo | Obra de origen | Autoría | Licencia |
|---|---|---|---|
| `fondos/mecanica-2.jpg` | [<nombre en Commons>](<url de la pagina>) | <autor> | <licencia> |
| ... (una fila por archivo, 24 filas) | | | |
```

- [ ] **Paso 5: verificar y commitear**

`npm run listo` → verde (todos los candidatos en disco). `npm test` → verde. Revisar las 24 tarjetas en `herramientas/fondos.html`.

```bash
git add contenido/assets/fondos contenido/carreras.json contenido/assets/CREDITOS.md
git commit -m "feat: dos fondos candidatos mas por ingenieria, fotografias de Wikimedia Commons"
```

(Si el trabajo se parte en varias sesiones, un commit por tanda de carreras está bien.)

---

### Tarea 10: documentación

**Archivos:**
- Modificar: `CLAUDE.md`, `README.md`, `docs/arquitectura.md`, `docs/contenido.md`, `docs/operacion.md` (si nombra a la persona o a los cinco objetos)

- [ ] **Paso 1: buscar lo que quedó viejo**

```bash
grep -rn -i "cinco\|Germania\|persona\b\|\"fondo\"\|ficha\|arco\|eleccion.cantidad\|nombre y apellido" CLAUDE.md README.md docs/*.md | grep -v superpowers
```

- [ ] **Paso 2: CLAUDE.md**

Reescribir estos pasajes (mantener el tono, explicar el porqué):

- "Qué es": *cinco objetos, uno por ingeniería* → *un carrusel con las doce ingenierías, un objeto por cada una, que gira lento alrededor de la persona; sostener la mano sobre uno detiene el carrusel y llena un anillo, y al completarse aparece esa ingeniería detrás suyo: su fondo recortado contra su silueta, con el nombre al pie y el objeto apoyado en su lugar dentro del fondo.*
- Comando `npm run listo`: quitar la frase "Hoy está en rojo a propósito … Nombre y Apellido" y poner: *Hoy está en verde. Exige, además, que todo fondo candidato declarado exista y la tipografía Muffaroo con su nota de licencia.*
- Comando `generar-fondos`: "el fondo de cada carrera que no tenga imagen" → "el fondo **activo** (`fondos[0]`) de cada carrera cuya imagen falte".
- Máquina de estados: "Las cinco carreras que se ofrecen (`opciones`) se sortean al entrar a HUMO" → "Todas las carreras jugables se ofrecen (`opciones`), en orden barajado por sesión, al entrar a HUMO"; "puede recorrer las cinco" → "puede recorrer las doce".
- Sección "El sostenido": renombrar a "El carrusel y el sostenido"; el bullet del arco pasa a describir el anillo con ventana visible, la fase que crece a `tablero.gradosPorSegundo`, y que **`congelar` detiene también la rotación: es la pausa del carrusel que pidió la cátedra**, con la reanudación al vaciarse el anillo. Agregar: *sólo son blancos las ranuras completamente visibles (`alfa === 1`)*; y en el bullet de "Los objetos NO se apagan": *el mostrado deja su ranura vacía con el anillo lleno y se va a vivir al fondo.*
- Nueva subsección "El objeto en su lugar (`vuelo.js`)": `lugar` normalizado a la imagen, `lugarPorDefecto`, el vuelo en `tiempos.vuelo`, por delante mientras vuela y detrás de la persona al aterrizar, halo y flotación; el origen se captura en `mira`; sin ranura a la vista crece en su lugar.
- "La tipografía": Germania One → Muffaroo, la razón (los temas de tablet), la licencia "personal use only" y el respaldo sans condensada.
- Reglas: `contenido/carreras.json` lleva `fondos` (candidatos, el primero activo, cada uno con `lugar` opcional) y **ya no lleva `persona`**: las personas las muestran las tablets. Quitar `CONFIG.eleccion.cantidad` de cualquier mención.

- [ ] **Paso 3: README, arquitectura, contenido**

- `README.md`: "Cómo está armado" → `tablero.js` "sólo conoce anillos y ventanas"; el párrafo de `carreras.json` sin "la persona que se muestra" y con `fondos`; "Lo mismo para los fondos" → activo. Agregar `herramientas/fondos.html` como la página para elegir.
- `docs/arquitectura.md` §4: "se sortean las cinco" → "se barajan todas"; "puede recorrer las cinco" → "las doce". §5.2: reescribir como el anillo (ventana, fase, pausa, cuerda mínima, radio contra la ventana). Nueva §5.6 "El objeto en su lugar (`vuelo.js`)" con lo mismo que CLAUDE.md, más breve.
- `docs/contenido.md` §2: tabla sin `fondo` ni `persona`; agregar `fondos` (`array` de `{ img, lugar? }`) y describir `lugar`. Borrar "### La persona". §3: candidatos, `herramientas/fondos.html`, el sufijo `-2`/`-3`, la preparación (9:16, 1080×1920, oscurecida) y los créditos. §6: Muffaroo, los temas de tablet, la nota de licencia, el respaldo. "Los objetos": "esos son los cinco que la persona ve flotando en arco" → "y ese es el que gira en el carrusel".
- `docs/operacion.md`: si nombra nombres de personas o "cinco objetos", corregir.

- [ ] **Paso 4: verificar y commitear**

`npm test` y `npm run listo` → verde. `grep` del paso 1 sin restos.

```bash
git add CLAUDE.md README.md docs/arquitectura.md docs/contenido.md docs/operacion.md
git commit -m "docs: el carrusel de doce, el objeto en su lugar, los fondos candidatos y Muffaroo"
```

---

## Auto-revisión

- **Cobertura de la spec:** §2 geometría, rotación, pausa, blancos enteros → tareas 2 y 3; qué se ofrece → 3; §3 nombre al pie y sin persona → 5, 6, 7; lugar, vuelo, capas, halo, flotación → 4, 5, 7; ranura vacía → 7; §4 esquema y validación → 6; precarga del activo → 6; página → 8; generador → 8; contenido de Commons y créditos → 9; §5 Muffaroo → 1; §6 CONFIG → 2, 3, 4; §8 docs → 10.
- **Placeholders:** la tarea 9 deja `<...>` sólo en los datos que salen de la búsqueda real (nombres, URLs, autores), que no se pueden escribir de antemano.
- **Consistencia de nombres:** `angulosDelAnillo`, `alfaEnVentana`, `angulosDeLaVentana`, `radioQueEntra` (tarea 2) se usan igual en las pruebas de 2 y 3; `ubicaciones[{x, y, angulo, alfa}]` en 2, 3 y 7; `lugarEnPantalla`, `posicionEnVuelo`, `flotacion` en 4, 7 y 8; `dibujarObjetoApoyado` y `pie` en 5, 7 y 8; `fondoActivo` en 6, 7 y 8; `transicion.vuelo` en 4 y 7; `CONFIG.fondo.lugarPorDefecto`, `haloDelLugar`, `flotar` y `tiempos.vuelo` en 4, 7 y 8.
