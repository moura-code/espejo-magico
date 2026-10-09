# Espejo Mágico — Guía de Contenido y Diseño

Esta guía explica cómo agregar, editar o reemplazar carreras, personas, objetos,
fondos y figuras vectoriales en el **Espejo Mágico**.

Toda la definición de contenido se gestiona desde **`contenido/carreras.json`**.
Agregar o cambiar una carrera no requiere modificar código JavaScript.

---

## 1. Estructura física del contenido

El contenido no se mantiene en un archivo manual global. La **estructura física de carpetas** en `contenido/` es la única fuente de verdad:

```
contenido/
  carreras/
    computacion/
      carrera.json
      objetos/
        computadora/
          imagen.png
          metadata.json
        procesador/
          imagen.png
          metadata.json
        placa/
          imagen.png
          metadata.json
        mouse/
          imagen.png
          metadata.json
      fondos/
        aula/
          imagen.jpg
          imagen-apaisada.jpg (opcional)
          video.mp4 (opcional)
          metadata.json
  comun/
    humo.mp4
    tipografias/
      Muffaroo-Regular.ttf
      Muffaroo-LEEME.txt
    CREDITOS.md
    banco/
  catalogo.json (generado automáticamente; versionado)
```

El archivo `contenido/catalogo.json` es derivado y normalizado. Se genera con `npm run catalogo`, o automáticamente al arrancar el servidor con `npm start` o `npm run dev`.

---

## 2. Archivos y metadatos por carrera

### `carrera.json`
Ubicado en `contenido/carreras/<id>/carrera.json`:

```json
{
  "nombre": "Ingeniería en Computación",
  "color": "#00E5A0",
  "maite": "sistemas",
  "fondo": "aula"
}
```

| Campo | Tipo | Descripción |
|---|---|---|
| `nombre` | `string` | Nombre oficial completo. Se ve al pie mientras se muestra la carrera. |
| `color` | `string` | Color hexadecimal (`#rrggbb`). Queda para la escena vectorial de respaldo. |
| `maite` | `string \| null` | El id que **esta misma carrera tiene en el proyecto MAITE**. Ver §7. |
| `fondo` | `string` (opcional) | ID del fondo en `fondos/` que se desea activar. Si se omite, se usa el primero por orden alfabético. |

### Los objetos (`objetos/<id>/`)

Cada carrera tiene **cuatro objetos** en subcarpetas de `objetos/`. Cada carpeta contiene su `imagen.png` y su `metadata.json`:

```json
{
  "nombre": "Procesador",
  "descripcion": "Ejecuta miles de millones de instrucciones por segundo con transistores más chicos que un virus.",
  "figura": "chip"
}
```

- **`imagen.png`**: imagen del objeto con fondo transparente.
- **`nombre`**: título de la ficha.
- **`descripcion`**: una o dos oraciones, **hasta 130 caracteres**, sobre el objeto y su relación con la carrera.
- **`figura`**: nombre de la figura vectorial de reserva en `espejo/figuras.js`.

**Selección por sesión:**
En cada sesión, el espejo selecciona **un objeto al azar para el carrusel** de entre los cuatro disponibles, y distribuye los tres restantes al azar en los escondites del fondo activo. No hay objeto principal fijo ni orden manual.

> **Objetos en el banco:** Los PNG que no se usan activamente se conservan en `contenido/comun/banco/` para reemplazos futuros. Para cambiar o agregar un objeto basta con crear o modificar su carpeta en `objetos/`.
>
> **Catálogo de candidatos automatizado:** En `contenido/comun/objetos-candidatos.json` se definen 60 objetos específicos (5 por ingeniería) con nombres, figuras de reserva, descripciones $\le 130$ caracteres y consultas de búsqueda para Wikimedia Commons. La herramienta `npm run objetos` (`herramientas/descargar-objetos.mjs`) permite consultar (`info`), buscar (`buscar`), descargar (`descargar`) y aplicar la estructura de metadatos (`aplicar`).

---

## 3. Fondos (`fondos/<id>/`)

El fondo aparece **detrás de la persona**: el espejo recorta su silueta con la
segmentación de MediaPipe y la vuelve a dibujar encima, así queda dentro de su
ingeniería en vez de tapada por ella. Y el objeto con el que agarró la carrera
**vuela a su lugar dentro del fondo** y se queda ahí, flotando apenas, detrás de
la persona.

### Los fondos se generan (`npm run escenas`)

**Los cinco instrumentos de cada ingeniería no se dibujan encima del fondo:
están pintados adentro de él.** El fondo de cada carrera lo genera
`herramientas/escenas.py`, local, en la GPU de la máquina de desarrollo. Son dos
pasos:

1. **La escena.** El lugar donde se trabaja esa ingeniería, vertical 9:16 y con
   el centro vacío. Se generan varias candidatas y se queda la mejor, **medida y
   no a ojo**: cuánto suman sus cinco sitios y cuán despejado está el centro.
2. **Los objetos, adentro.** Uno por uno, se le pide al modelo que *pinte* el
   instrumento dentro de un recorte de la propia foto. Ahí está la integración
   de verdad: el objeto sale con la luz, la sombra de contacto y el reflejo de
   esa mesada, porque el modelo la está mirando mientras lo dibuja. Comparando
   la ventana antes y después sale la **silueta** del objeto, y esa máscara es
   la que el espejo usa para recortarlo del fondo cuando la mano pasa encima.

Dos cosas que se aprendieron perdiendo objetos, y que la herramienta ahora
vigila sola:

- **La escena tiene que estar vacía donde van los objetos.** En un estante con
  doscientos frascos, un instrumento más es invisible. Los prompts piden mesadas
  y estantes limpios a propósito.
- **Cada sitio necesita superficie debajo, aire arriba y tono medio.** Un matraz
  de vidrio pintado sobre una alacena blanca no lo encuentra nadie. La
  herramienta puntúa cada punto candidato por esas tres cosas y elige el mejor
  de cada zona; si un objeto sale con una silueta demasiado chica, lo vuelve a
  intentar con otra semilla y lo avisa en la consola (`<-- revisar`).

**Dónde puede ir cada objeto no lo decide el gusto**: son las cinco `ZONAS` de
la herramienta, que son la intersección de todo lo que exige el espejo —fuera de
la zona de la persona, arriba del pie con el nombre, al alcance del brazo y sin
que dos blancos de la mano se toquen— ya resuelta. Los cinco se eligen juntos,
porque dos zonas vecinas pueden tener su mejor punto pegado.

`npm run escenas` es un paso de **autoría**, no del evento: baja modelos la
primera vez y necesita un entorno con `torch`/`diffusers`/`transformers`
(índice `cu128` para GPU Blackwell; el VAE `madebyollin/sdxl-vae-fp16-fix` no es
opcional, sin él cada imagen tarda minutos). Lo que se versiona y va al stand
son los archivos que deja: `imagen.jpg`, `recortes/<n>.png` y `metadata.json`.

**Que el objeto esté pintado se comprueba mirando, no midiendo cuánto cambió.**
La primera tanda de escenas salió con unos 25 de los 60 objetos sin pintar: el
modelo rehacía la pared o el estante y nada más, y el control de entonces —el
área de lo que cambió— lo daba por bueno, porque una pared repintada también
cambia. Ahora cada intento pasa además por un juez (`herramientas/presencia.py`,
CLIP en CPU) que pregunta si lo pintado se parece al objeto o a un sitio vacío,
y se reintenta con otra semilla hasta seis veces. Para las fotos que ya están:

```bash
python herramientas/escenas.py --revisar          # qué objetos no están; arma
                                                  # contenido/objetos-contacto.jpg
python herramientas/escenas.py --repintar --solo electrica:motor-trifasico,...
python herramientas/escenas.py --repintar --semilla 1 --solo ...   # otra tanda
```

`--repintar` pinta sólo esos objetos en la foto actual, en su mismo sitio, y
reescribe sólo su recorte y su caja: los que ya están no se tocan. Pide la lista
explícita a propósito —la de `--revisar`, mirada a ojo en la hoja—, porque un
objeto presente que el juez diera por ausente se arruinaría al repintarlo. Cada
carrera se escribe entera al terminarla: si la corrida se corta, la que estaba
en curso queda como estaba, y las que ya terminaron no se vuelven a correr,
porque pintaría encima.

**Cada objeto pintado pasa además por la armonía.** Pintado de a uno, cada
objeto salía con su propia luz y su propio grano —limpio, saturado, como foto de
producto— y se leía pegado encima de la escena. Al terminar de pintar, el
generador de la foto repasa la imagen a poca fuerza y se queda sólo con lo que
rodea a cada objeto: le da la luz y la textura del lugar sin tocar el resto, que
sigue calzando con su versión apaisada. Lo hacen solos `--fase objetos` y
`--repintar` (este último, sólo alrededor de lo que repintó), y
`--armonizar <carreras>` la pasa sobre las fotos que ya están, sin repintar.

**Lo que se aprendió de los objetos que no salían:**

- **Sobre una superficie lisa y pareja el relleno no pinta nada.** Mirando lo
  que devolvía el modelo, y no sólo el puntaje del juez: con un estante gris
  oscuro o una pared blanca debajo del óvalo, copiaba la superficie, el texto
  no importaba y daba lo mismo con cualquier semilla. Ni borrando lo de abajo
  ni pintando desde cero cambió. Por eso la segunda mitad de los intentos
  arranca del **PNG del objeto plantado en el óvalo** (`plantar_objeto`): el
  modelo lo repinta con la luz del lugar, y el panel solar y la base de datos,
  que habían fallado tres vueltas seguidas, salieron al primer intento. La
  primera mitad va sin PNG, porque cuando puede el modelo integra mejor el
  objeto inventándolo. `--repintar --con-png` hace que todos los intentos
  arranquen del PNG: hace falta cuando el juez da por bueno lo que no es (un
  gancho oxidado pasó por la viga oxidada que pedía el texto).
- **Lo que sale del PNG se repasa.** Plantado, el objeto conserva el aspecto de
  su PNG —una foto de producto, o un ícono como el de la base de datos— y se lee
  pegado encima. El repaso local (`repaso_del_objeto`, el generador de la foto a
  0,5 con el texto del objeto) lo vuelve parte de la escena sin cambiarle la
  forma, que es lo que el espejo recorta. Lo hacen solos `--repintar` y
  `--fase objetos` con lo que salió del PNG, y `--repasar --solo ...` lo pasa
  sobre objetos ya pintados. Desenfocar el PNG antes de plantarlo no sirve: el
  modelo copia el borrón.
- **El PNG va al tamaño del sitio, y se repinta sobre la escena vacía.**
  Plantado a todo el óvalo, el objeto salía más grande que su sitio (la base de
  datos y el servidor pasaban el área máxima del control): va al 75 %, salvo lo
  fino —cables, celosía: menos del 30 % de su caja lleno—, que al tamaño del
  sitio quedaba con líneas de un par de píxeles y el modelo las borraba; eso va
  entero (`COBERTURA_FINA`). Y como el modelo copia lo que encuentra en
  el óvalo, repintando encima de un objeto ya pintado lo repetía: `--repintar`
  devuelve primero el sitio a la escena vacía (`restaurar_sitio`), que existe
  sólo en la PC donde se generaron las escenas.
- **Rearmar una escena cambia sus sitios, y con ellos las fichas.** Las fichas
  se ubican según el sitio de cada objeto, no según su silueta, y
  `tests/integracion/fichas.test.js` exige que todas entren con la letra de la
  config. Con la Química rearmada, el matraz quedó tan arriba que su ficha
  rozaba al intercambiador; y esa escena, además, salió con un ventanal a la
  izquierda donde no había nada que apoyar. Volvió a su escena de antes. Si la
  prueba falla después de rearmar, se prueba otra escena, o se mueve el sitio
  dentro de su zona —en `metadata.json`, devolviendo antes el sitio viejo a la
  escena vacía— y se lo repinta.
- **La armonía no puede borrar un objeto.** El repaso disolvió la maqueta del
  puente —fina, clara sobre una mesada gris— en el concreto: 0,93 al pintarla,
  0,17 después. Ahora, cuando pinta con el juez, una pasada que deja a un objeto
  por debajo del umbral se descarta para ese objeto, y la consola lo avisa.

- **Arriba al centro no puede haber una luz.** Ahí va lo que cuelga del techo, y
  sobre una luz el modelo la continúa en vez de pintar el objeto: así fallaron
  la cinta, el puente, la torre y el intercambiador, una y otra vez. La elección
  de escena castiga a las que tienen una luz justo en ese sitio, y los guiones
  piden techo oscuro con las luces a los costados.
- **Cada sitio necesita algo donde apoyarse, y el guion lo nombra.** Una sala
  baja deja los sitios de arriba de los costados en el techo; una pared desnuda
  no sostiene nada. Las escenas que funcionaron tienen estanterías a los dos
  costados y mesadas abajo, y el texto de cada objeto dice dónde está apoyado o
  de qué cuelga (de un gancho de grúa, de dos cadenas).
- **El objeto contrasta con su superficie.** Acero sobre acero, vidrio sobre
  blanco y blanco sobre blanco no se pintaban. Se cambia la superficie (estantes
  de madera, mesadas oscuras) o el color del objeto, salvo el del carrusel, que
  va como su PNG.
- **El texto describe el PNG, y sólo el objeto.** La mira no era «a rayas rojas
  y blancas» sino blanca con marcas en E; la base de datos no era una caja negra
  sino tres discos azules: con el texto equivocado, el modelo pintaba otra cosa y
  el juez no la reconocía. Y lo de antes de la coma no puede nombrar algo que ya
  está en la escena: con «with steel pipes», el juez daba por presente el
  intercambiador porque veía los caños del techo; con «storage», confundía la
  base de datos con «empty storage racks».
- **Lo que cuelga, a veces es otro objeto.** Si el de arriba al centro no sale
  colgado, se intercambia su sitio con uno que cuelgue con naturalidad —la viga
  de un gancho, el satélite como en un museo— editando `lugar` y `escondites` en
  su `metadata.json`, y se repintan los dos. El orden de `GUIONES` se cambia
  igual, para que una carrera rearmada lo respete.

Tres cosas más, antes de reintentar:

- **Las semillas son fijas por objeto.** La misma foto con el mismo texto da el
  mismo resultado: es lo que deja rearmar una carrera sin perder lo que ya
  estaba bien, y también por qué repetir no sirve. Para otro intento, otro
  texto o `--semilla N` (1, 2, …), una tanda que no repite ninguna semilla de
  las anteriores.
- **Cada texto de `GUIONES` es «el objeto, el sitio».** El juez lee sólo lo de
  antes de la primera coma: si la pregunta nombra el sitio, una pared vacía ya
  se parece un poco al objeto.
- **El objeto del carrusel se describe como su PNG**, porque al aterrizar el
  PNG se funde con el pintado.

**Para una pantalla apaisada**, `python herramientas/escenas.py --apaisar`
extiende cada foto a 16:9 (`imagen-apaisada.jpg`). Lo que extiende es la escena
vacía, sin los objetos: viéndolos, el modelo los repetía en los costados (un
segundo brazo robótico, cajas alrededor del pallet). Pinta de a ventanas con el
modelo de relleno, arrancando del reflejo de la escena en el borde; repasa los
costados con el generador de la foto, para que tengan su textura; y en la
costura iguala la luz y funde lo pintado con el reflejo, para que el borde
continúe la foto. La foto, con sus objetos, se pega al final.
La foto vertical no se toca, y de la apaisada el espejo usa sólo los costados:
repintar un objeto después no la invalida. Se miran en
`contenido/apaisadas-contacto.jpg`: que no aparezca en un costado algo que
parezca uno de los cinco objetos, y que no se vea la costura. Si una no sirve,
`--apaisar <id> --semilla 1`. La escena vacía (`contenido/escenas-base/<id>.jpg`)
existe sólo en la PC donde se generaron las escenas: sin ella se extiende la
foto, y el modelo puede repetir sus objetos en los costados.

Las partes que no necesitan la GPU tienen pruebas:
`python -m unittest discover -s tests/herramientas`.

### O se fotografían (`npm run ubicar`)

Una ingeniería puede traer, en vez de una escena generada, **una foto real** con
sus objetos adentro, y el PNG de cada objeto recortado aparte. Ahí el espejo no
saca el objeto de la foto: cuando la mano pasa por encima, **levanta el PNG del
propio objeto**, puesto exactamente sobre el que se ve, iluminado y con un
resplandor dorado que sigue su silueta. No crece, como los pintados: la foto
sigue debajo con el mismo objeto, y un grupo de cosas agrandado se vería doble.
Hoy son cinco:

| Carrera | Fondo | Objetos (el primero va al carrusel) |
|---|---|---|
| Química | `laboratorio`: la cristalería y las placas de Petri sobre la mesada, el secador túnel al fondo | derivados de la madera, orujo y pectina, secador tipo túnel |
| Alimentos | `laboratorio`: el baño de ultrasonido y el espectrofotómetro en la mesada de la izquierda, los tubos Falcon, la probeta y el matraz en la de la derecha | baño de ultrasonido, espectrofotómetro, probeta y matraz, tubos Falcon |
| Computación | `laboratorio`: Jacky y Pipe en el piso, Robotito y la computadora en la mesada de la derecha, el dispositivo edge y el libro en la de la izquierda | computadora, dispositivo edge computing, Jacky, libro de base de datos, Pipe, Robotito |
| Mecánica | `taller`: el torno adelante a la izquierda, el brazo robot y la celda electroquímica en las mesadas de la derecha | brazo robot, celda electroquímica, torno paralelo |
| Naval | `taller`: el microscopio óptico en la mesa de adelante | microscopio óptico |

**Traen los objetos que se fotografiaron, no cinco.** Naval tiene uno solo: después
de elegirlo no queda nada escondido, sólo su propia ficha. Cuando lleguen más
PNG de esa foto se suman como carpetas y se vuelve a correr `ubicar`.

Lo que hace falta, por carrera:

```
contenido/carreras/quimica/
  carrera.json                 ← "fondo": "laboratorio"
  objetos/
    derivados-de-la-madera/    ← el primero en orden alfabético va al carrusel
      imagen.png               ← el objeto tal como está en la foto, fondo transparente
      metadata.json            ← nombre y descripción, como cualquier objeto
    orujo-y-pectina/ …
    secador-tipo-tunel/ …
  fondos/
    laboratorio/
      imagen.jpg               ← la foto, con los objetos adentro
      metadata.json            ← lo escribe `npm run ubicar`
```

1. **La foto**, en JPEG, a 1920 de ancho: más no se ve. Las cinco vinieron de
   2752×1536 y quedaron en 1920×1072, calidad 92.
2. **Cada PNG es el objeto como aparece en esa foto** —recortado de ella, o el
   que se pegó para armarla—, con fondo transparente y recortado a lo que se ve.
   Puede estar a otro tamaño que en la foto; lo que no puede es ser otra foto
   del mismo objeto, porque entonces no calza.
3. **`npm run ubicar -- quimica`** busca cada PNG adentro de la foto y escribe
   en el `metadata.json` del fondo dónde calza (`cajas`, una por objeto, en su
   orden) y, a partir de eso, `lugar` y `escondites`. Dice cuánto se parece cada
   uno (1 es idéntico; por debajo de 0,85 lo marca para revisar), y con
   `--hoja calce.jpg` deja la foto con el contorno de cada PNG encima: si el
   calce está bien, el contorno sigue el borde del objeto.
4. **`npm run catalogo`** (o `npm start`) para que el espejo lo vea.

**El orden de las carpetas es el de los objetos**: el primero alfabético va al
carrusel y vuela a su lugar en la foto, así que conviene que sea el que mejor
representa a la carrera en chiquito. En Química es la cristalería
(`derivados-de-la-madera`), no el secador; en Computación, la computadora. Para
cambiarlo se renombran las carpetas y se vuelve a correr `ubicar`.

**Los textos van a la ficha**: el `nombre` es el título —corto, en una o dos
líneas— y la `descripcion` no pasa de 130 caracteres. Salen de la planilla
(`fotos-fondos/Objetos.xlsx`, con los textos de todas las carreras), y de ahí se
acortaron los títulos que eran la lista de lo que hay (los dos grupos de
Química), las descripciones que pasaban el límite (el baño de ultrasonido, la
probeta y el matraz —que eran dos descripciones—, el torno, la celda), y se
corrigió lo mal tipeado (espectrofotómetro, matraz, microscopio). El material
original de cada carrera —la foto y los PNG con los nombres de la planilla,
`al_id1.png`…— queda en `fotos-fondos/<carrera>/`.

**Lo que le pasa por delante.** El PNG es el objeto entero: lo que en la foto lo
tapa en parte —la mesa delante del torno, la probeta delante de los tubos
Falcon— queda debajo mientras se lo lee, y se lee como que el objeto se
adelanta. Por eso esos dos calzan con un parecido más bajo (0,85 y 0,78: la
parte tapada no se parece); la hoja de `--hoja` muestra que el contorno sigue al
objeto.

**Lo que la foto decide y el código no.** Los objetos están donde los dejó la
foto, así que las reglas de la composición de los fondos generados —la
periferia, el alcance del brazo, el aire entre blancos— no se le aplican; lo que
sí se prueba es que el blanco de la mano y el aterrizaje caigan exactamente
sobre cada objeto, en cualquier pantalla. Y **la orientación de la foto
importa**: las cinco son apaisadas, perfectas para una pantalla horizontal; en
el espejo vertical se ven como una franja en el medio, con la misma foto
desenfocada arriba y abajo, y los objetos chicos. Para un espejo vertical hace
falta una foto vertical.

**Las fichas, en una foto apretada.** La ficha va pegada debajo de su objeto; si
ahí no entra prueba arriba y al costado, después el lugar limpio más cercano si
queda pegado, y si no, achica la letra para quedarse a su lado (ver «Dónde va la
ficha» en `docs/arquitectura.md`). Dos
objetos no tienen lugar pegado con la letra pedida: **Robotito** y la **celda
electroquímica**, chicos, en un rincón de abajo de su foto y con un vecino grande
justo encima (la computadora, el brazo robot). Abajo está el nombre de la
ingeniería —y en apaisado su franja ocupa el 38 % de la pantalla—, así que en el
espejo su ficha se achica para quedar a su lado, y en apaisado se va arriba del
vecino. `tests/integracion/fichas.test.js` los tiene nombrados como excepción
(`SIN_LUGAR_EN_LA_FOTO`); lo que los arreglaría es que la zona prohibida del pie
sea el nombre y no una franja a lo ancho.

Un fondo es generado o fotografiado, no las dos cosas: con `recortes` y `cajas`
a la vez el catálogo no se arma. Y `escenas.py` no genera las carreras de foto
real (no están en sus guiones), para no ponerles otra escena encima.

### Qué hace que un fondo sirva


El fondo no es una ilustración: es un **escenario** que tiene que aguantar dos
cosas encima, una persona recortada y un objeto apoyado. De ahí salen los cinco
criterios, y se descubrieron mirando los que no funcionaban:

1. **Un lugar, no un primer plano.** Una sala, un pasillo, un valle: algo con
   profundidad y con piso u horizonte, donde se entienda que la persona *está
   parada ahí*. Un primer plano —un láser, una máquina, un mapa desplegado— no
   tiene dónde pararse: la persona recortada encima se lee como un collage.
2. **Centro y mitad inferior tranquilos.** Ahí van la cara y el nombre en letra
   grande.
3. **Sin gente.** Otra persona en el fondo compite con la que está sentada, y
   desde la fila no se entiende cuál es cuál.
4. **Un rincón oscuro arriba, a un costado**, para el objeto. No alcanza con que
   la foto entera sea oscura: si el rincón donde aterriza es un cielo blanco, el
   objeto y su halo se pierden. Se mide igual que el brillo general (abajo), y
   conviene que ese rincón quede por debajo de ~58.
5. **Oscura**, entre 25 y 70 de brillo medio sobre 255.

Si en el futuro se incorpora un fondo de video, debe tener **poco movimiento**:
la persona y el objeto encima no pueden competir con el escenario.

### Carpetas, `lugar` y `escondites`

Cada carrera contiene una o más subcarpetas dentro de `fondos/`. Cada carpeta representa un candidato de fondo y contiene:
- `imagen.jpg` (o `.png`): la imagen de la escena.
- `imagen-apaisada.jpg` (opcional): la misma escena extendida a 16:9, con la
  foto centrada a todo el alto, para una pantalla apaisada. El espejo usa sólo
  sus costados: la foto va siempre encima. Sin ella, los costados son la foto
  desenfocada. La genera `escenas.py --apaisar`.
- `video.mp4` (opcional): video en loop para fondos con movimiento.
- `recortes/<n>.png` (fondo generado): la silueta de cada objeto, recortada a su
  caja, en el orden de `objetos`. Es lo que deja levantar el objeto de la foto;
  sin ella la escena se ve igual y la mano pasa por encima sin que pase nada.
- `cajas` en el `metadata.json` (fondo fotografiado): dónde calza el PNG de cada
  objeto adentro de la foto, `[x0, y0, x1, y1]` normalizado a ella, en el orden
  de `objetos`. Lo escribe `npm run ubicar`; ver arriba.
- `metadata.json`: coordenadas de ubicación:

```json
{
  "lugar": { "x": 0.834, "y": 0.22, "escala": 0.24 },
  "escondites": [
    { "x": 0.166, "y": 0.22, "escala": 0.24 },
    { "x": 0.834, "y": 0.43, "escala": 0.24 },
    { "x": 0.166, "y": 0.43, "escala": 0.24 }
  ]
}
```

Cada fondo ubica los cuatro objetos de su ingeniería:

- **`lugar`**: dónde se apoya el objeto del carrusel, el que llega volando.
- **`escondites`**: dónde esperan los otros tres objetos no seleccionados para el carrusel. En cada sesión, estos tres objetos se distribuyen al azar entre los escondites disponibles.

Todos van **normalizados a la imagen** (`x` e `y` de 0 a 1, `escala` es el
diámetro como fracción del ancho de la imagen). El set actual es 1920×1080 y el
espejo calcula el encuadre para cada orientación de pantalla; por eso los puntos
se guardan en proporciones y no en píxeles. Sin declararlos valen
`CONFIG.fondo.lugarPorDefecto` y `CONFIG.fondo.esconditesPorDefecto`, que son un
seguro del código y no una decisión — por eso `npm run listo` pide que **cada
candidato declare los suyos**.

**Todos en la periferia.** La cátedra pidió que los objetos no coincidan con la
zona central, donde está la imagen de la persona: un objeto ahí le taparía la
cara o quedaría tapado por ella. La zona prohibida es
`CONFIG.fondo.zonaDeLaPersona` —la cabeza, del 30 % al 70 % del ancho entre el
14 % y el 50 % de la altura, y los hombros, del 18 % al 82 % desde la mitad para
abajo— más el pie, donde va el nombre (el 30 % de abajo).
`tests/integracion/fondos.test.js` lo verifica para cada fondo del catálogo, y
también que los cuatro objetos de un fondo no se pisen. En
`herramientas/fondos.html` hay una casilla para ver la zona dibujada encima.

**Al alcance de la mano, y sin chocar.** La periferia no puede quedar tan
arriba que haya que pararse para llegar: `tests/integracion/fondos.test.js`
supone la misma persona que la zona —hombros donde empieza el cuerpo, 380 px de
ancho: alguien sentado a unos 2 m o más— y el brazo del carrusel, y exige que la
mano llegue a los cuatro objetos con un 10 % de brazo de sobra. También exige
que **los blancos de la mano de dos objetos no se toquen** (`fichas.radioFactor`
radios de cada uno): si se tocan, yendo a buscar el de abajo se abre el de
arriba. Y que ninguno suba a la franja de arriba de la cabeza, que es del
cartel de las fichas. Es un modelo, no una medición: en el stand se prueba con
gente de verdad, y si la persona queda más abajo en el cuadro, se bajan juntos
los lugares y la zona.

**Todos los fondos usan la misma grilla**: dos columnas pegadas a la zona de la
cabeza (`x` 0.166 y 0.834) y dos filas —`y` 0.22, justo debajo del cartel de
las fichas, y 0.43, a la altura de los hombros—, con `escala` 0.24 para los
cuatro. Es el equilibrio entre tamaño y aire: a los costados está la cabeza,
arriba el cartel y abajo los hombros, así que un objeto más grande sólo entra
acercándose a su vecino. A 0.24 los dos de cada costado quedan bien separados y
se nota cuál tiene la mano encima. Lo que cambia de un fondo a otro es qué objeto va en cada rincón: el del
carrusel en el rincón alto más oscuro de la foto —el "rincón oscuro arriba" de
los criterios— y los otros tres en los que quedan. Si una foto pide otra cosa,
se mueve mirando en `herramientas/fondos.html`, y las pruebas dicen si todavía
entra.

Si el espejo corre en una pantalla de otra proporción —un monitor apaisado
mientras se desarrolla—, la foto entra entera, a lo alto, y a los costados va la
misma foto desenfocada y oscurecida. Los objetos pintados se ven donde cae la
foto y el espejo pone el blanco de la mano exactamente ahí: en la notebook se
prueban los cinco, como en el espejo vertical. Los objetos sueltos (un fondo sin
objetos pintados) se miden contra lo que se ve del fondo, a la escala de la
persona, y crecen un poco más (`fondo.agrandarEnApaisado`): a la escala de la
composición se veían chiquitos.

```json
"fondos": [
  {
    "img": "assets/fondos/quimica-laboratorio.jpg",
    "lugar": { "x": 0.166, "y": 0.22, "escala": 0.24 },
    "escondites": [
      { "x": 0.834, "y": 0.22, "escala": 0.24 },
      { "x": 0.166, "y": 0.43, "escala": 0.24 },
      { "x": 0.834, "y": 0.43, "escala": 0.24 }
    ]
  },
  { "img": "assets/fondos/quimica.png" }
]
```

Para elegir mirando, y no imaginando:

```
http://localhost:8080/herramientas/fondos.html
```

muestra los candidatos de cada carrera **tal como se verían**: la imagen, una
silueta donde va la persona, el objeto del carrusel apoyado en su lugar con su
halo, los otros tres meciéndose en sus escondites, la ficha de cada uno
abriéndose por turno y el nombre al pie, con las mismas funciones que usa el
espejo.

Los fondos vigentes son un set propio entregado al proyecto, versionado como
JPEG 1920×1080. Si se agregan fotos de terceros como candidatos, su obra de
origen, autoría y licencia deben incorporarse a `assets/CREDITOS.md` antes de
usarlas en el stand.

Para preparar una foto nueva, con el ffmpeg de la máquina de desarrollo (no hace
falta en la PC del evento):

```bash
ffmpeg -i original.jpg -vf "crop=ih*9/16:ih:(iw-ih*9/16)/2:0,\
scale=1080:1920:flags=lanczos,colorlevels=romax=0.55:gomax=0.55:bomax=0.55,\
eq=saturation=0.85" -q:v 4 contenido/assets/fondos/<id>-2.jpg
```

Tres cosas que se descubren rompiéndose:

- **`romax`, no `rimax`.** `rimax` baja el máximo de *entrada*, o sea recorta las
  luces a blanco: deja la foto más clara, que es justo lo contrario. `romax` baja
  el máximo de *salida*, y eso sí oscurece.
- **Cuánto oscurecer se mide, no se estima.** Un fondo servible queda entre 25 y
  70 de brillo medio sobre 255; con `0.55` suele caer ahí, pero un cielo grande
  necesita `0.42`. Para medirlo:
  `ffprobe -f lavfi -i "movie=fondo.jpg,signalstats" -show_entries frame_tags=lavfi.signalstats.YAVG -of csv=p=0`
- **Bajarle la saturación** (`eq=saturation`): un cielo azul o un modelo de
  terreno en falso color compiten con el nombre de la carrera y con los objetos
  del fondo.

### Fondos con movimiento

Un fondo puede moverse. Se declara agregando `video` al candidato, **sin sacarle
la `img`**:

```json
"fondos": [
  {
    "img": "assets/fondos/naval-canal.jpg",
    "video": "assets/fondos/naval-canal.mp4",
    "lugar": { "x": 0.166, "y": 0.22, "escala": 0.24 },
    "escondites": [
      { "x": 0.834, "y": 0.22, "escala": 0.24 },
      { "x": 0.166, "y": 0.43, "escala": 0.24 },
      { "x": 0.834, "y": 0.43, "escala": 0.24 }
    ]
  }
]
```

**El video no reemplaza a la foto: la acompaña.** La `img` de un fondo con
movimiento es **un cuadro del propio video**, y es lo que se ve mientras el video
carga —los videos se cargan después de que el espejo arrancó, de a uno— o si el
archivo falta. Como es el mismo encuadre, el cambio no se nota. Sin `img` no hay
a qué caer, y por eso sigue siendo obligatoria.

El espejo reproduce **uno solo a la vez**, el de la ingeniería que está
mostrando; agarrar otro objeto pausa el anterior. Volver a una ingeniería ya
vista arranca su video desde el principio.

Para preparar uno, con el ffmpeg de la máquina de desarrollo. Es la receta de la
foto —recorte 9:16 a 1080×1920, oscurecido y con menos saturación— más un
**cierre en fundido con el principio**, que es lo que vuelve invisible el corte
del loop; un fondo que salta cada diez segundos detrás de una persona se nota
enseguida. Cambiá `10` y `9.5` por la duración de tu original y esa duración
menos medio segundo:

```bash
ffmpeg -i original.mp4 -filter_complex "[0:v]crop=ih*9/16:ih:(iw-ih*9/16)/2:0,scale=1080:1920:flags=lanczos,colorlevels=romax=0.45:gomax=0.45:bomax=0.45,eq=saturation=0.85,fps=24,format=yuv420p,setsar=1,split=3[h][b][t];[h]trim=0:0.5,setpts=PTS-STARTPTS,fps=24[head];[b]trim=0.5:9.5,setpts=PTS-STARTPTS,fps=24[body];[t]trim=9.5:10,setpts=PTS-STARTPTS,fps=24[tail];[tail][head]xfade=transition=fade:duration=0.5:offset=0,fps=24[cierre];[body][cierre]concat=n=2:v=1:a=0[final]" -map "[final]" -an -c:v libx264 -preset slow -crf 24 -pix_fmt yuv420p -movflags +faststart contenido/assets/fondos/<id>-<nombre>.mp4
```

Y el cuadro que hace de foto, **del video ya procesado**, para que sean el mismo
encuadre exacto:

```bash
ffmpeg -i contenido/assets/fondos/<id>-<nombre>.mp4 -frames:v 1 -q:v 4 contenido/assets/fondos/<id>-<nombre>.jpg
```

Cuatro cosas que se descubren rompiéndose:

- **`-an`, siempre.** El espejo lo reproduce mudo igual; la pista de audio es
  peso muerto en una PC sin conexión.
- **El brillo se mide igual que en una foto**, y con los mismos números (25 a 70
  sobre 255). `xfade` necesita `fps=24` en cada rama: sin eso falla con
  "the inputs needs to be a constant frame rate".
- **Diez segundos alcanzan.** Nadie mira un fondo más que unos segundos, y cada
  video vive en memoria mientras el espejo esté abierto.
- **Mirarlo andando antes de decidir**, en `herramientas/fondos.html`: los
  candidatos con `video` se reproducen ahí, con la silueta y el objeto encima.
  Si un fondo se lee bien detrás de una persona no se decide mirando un cuadro
  quieto.

### El respaldo vectorial

```bash
npm run generar-fondos
```

dibuja, con el Chrome de la máquina y sin red, el lugar donde se trabaja cada
ingeniería: el laboratorio de química, el puente de civil, la sala de servidores
de computación. Salen de `espejo/escenarios.js` y van al candidato `.png` de
cada carrera —el respaldo, no el activo—, y sólo si falta.
Es un **placeholder**, no arte final: existe para poder ver el sistema entero
funcionando antes de que haya una sola fotografía. Nunca pisa un archivo
existente, así que para reemplazarlo alcanza con dejar la imagen real en su ruta.

Si el PNG falta, el espejo dibuja la escena vectorial en vivo; si tampoco hay
escena, cae al color plano de la carrera. Se ve, y el nombre sigue entrando: una
carrera sin fondo no rompe la escena.

---

## 4. Fallback vectorial de los objetos (`espejo/figuras.js`)

Si el PNG de un objeto todavía no existe, el espejo dibuja una **figura
vectorial por código Canvas 2D**. Y:

```bash
npm run generar-pngs
```

rasteriza esas figuras a PNG sin sobreescribir las fotos reales.

Existen 36 figuras registradas en `espejo/figuras.js`:

- `engranaje`, `llave`, `piston`, `resorte`, `rodamiento`, `motor`
- `matraz`, `gota`, `molecula`, `tubo`, `lampara`, `bateria`
- `rayo`, `resistencia`, `panel-solar`, `onda`, `laptop`, `robot`
- `chip`, `llaves`, `servidor`, `dron`, `teodolito`, `plano`
- `prisma`, `sumatoria`, `pi`, `integral`, `atomo`, `curva`
- `grua`, `puente`, `ladrillo`, `viga`, `mechero`, `pipeta`

Para previsualizarlas todas:

```
http://localhost:8080/herramientas/figuras.html
```

El orden de preferencia al dibujar es **PNG → figura → círculo dorado**. Un
objeto que no se dibuja es una opción que no se puede agarrar: la persona ve un
hueco en el carrusel y no entiende por qué ahí no pasa nada.

---

## 5. El humo (`contenido/comun/humo.mp4`)

El video que entra al sentarse. Es **blanco sobre negro** y se compone en modo
`screen`, así que el negro desaparece solo y no hace falta canal alfa (el mp4 no
lo tiene). Para reemplazarlo, respetar eso: un video con fondo claro va a lavar
la pantalla entera.

Es un agregado opcional en código —si falta, el espejo arranca igual y lo único
que se pierde es la transición— pero `npm run listo` lo exige, porque una falla
silenciosa el día del evento no la mira nadie.

---

## 6. La tipografía (`contenido/comun/tipografias/`)

El nombre de la ingeniería se dibuja en **Muffaroo**, la tipografía que muestran
de verdad las tablets de MAITE: su `style.css` base declara Germania One, pero
los cuatro temas de tablet (`temas/tablet-*.css`) la pisan con Muffaroo. El
espejo y los retratos están a dos metros uno del otro en el stand: comparten la
letra para que se lean como una sola instalación.

Las consignas y la descripción de cada ficha van en la sans del sistema. No es
una concesión: tienen que entenderse de un vistazo, y a tamaño de párrafo la
display cuesta leerla. MAITE hace la misma división.

### Los colores

La cátedra pidió que **el color no distinga a las ingenierías**. Los nombres, la
carga del sostenido, los halos y las fichas van en los colores de las tablets de
MAITE (`public/style.css`), iguales para las doce, y viven en `CONFIG.paleta`:

| Uso | Color | En MAITE |
|---|---|---|
| El nombre de la ingeniería, el título de la ficha, la carga y los halos | `#f0dca0` | `--color-accent-strong`, el de los nombres en las cuatro tablets |
| La descripción de la ficha | `#cdbfa0` | `--color-text-muted`, el de los textos de las tablets |
| El panel de la ficha | `rgba(5, 5, 10, 0.8)` | `--color-bg` |

Las opciones que se miraron —los cinco colores de la paleta de MAITE que podían
ir en el nombre y cinco maneras de dibujar la carga con transparencia— están
lado a lado, andando, en `http://localhost:8080/herramientas/colores.html`. Para
cambiar la elegida se cambia `CONFIG.paleta` o `CONFIG.carga`.

Para reemplazarla hay que tocar tres lugares: el archivo en
`contenido/comun/tipografias/`, el `@font-face` de `espejo/espejo.html` y las
constantes `TITULO_SOLO` / `FAMILIA_TITULO` de `espejo/escena.js`. Si la nueva
tiene negrita de verdad, ahí se puede subir `PESO_TITULO`.

**La licencia.** El TTF de Muffaroo declara "Copyright Imagex © 2010 — Free for
personal use ONLY". Un stand de facultad no es uso personal: la nota viaja al
lado del archivo (`Muffaroo-LEEME.txt`), `npm run listo` la exige, y la decisión
de comprar la licencia comercial o cambiar la letra es de la cátedra.

---

## 7. El puente con MAITE

El campo `maite` es el id que **esa misma carrera tiene del otro lado**. Los dos
catálogos crecieron por separado, así que no coinciden:

| Espejo | MAITE |
|---|---|
| `mecanica` (Ing. Industrial Mecánica) | `industrial_mecanica` |
| `electrica` | `electronica` |
| `computacion` | `sistemas` |
| `fisico-matematico` | `fisico_matematica` |
| `civil` | `civil` |
| `quimica` | `quimica` |
| `alimentos` | `alimentos` |
| `produccion` | `produccion` |
| `agrimensura` | `agrimensura` |
| `comunicacion` | `comunicacion` |
| `forestal` | `forestal` |
| `naval` | `naval` |

**Están las doce mapeadas.** MAITE tiene un catálogo de 14 desde el 26 de agosto
de 2026 (antes eran cinco), y las doce del espejo tienen su par ahí.

> **Cuidado con los dos que parecen sinónimos.** MAITE tiene `mecanica`
> (*Ingeniería Mecánica*) **y** `industrial_mecanica` (*Ingeniería Industrial
> Mecánica*), e `industrial` (*Ingeniería Industrial*) **y** `produccion`
> (*Ingeniería de Producción*). El espejo ofrece las segundas de cada par. Cuando
> MAITE tenía cinco carreras, estas dos apuntaban a las primeras y las tablets
> mostraban gente de otra ingeniería sin que nada fallara.

**`maite: null` significa "todavía no hay gente filmada para esta ingeniería"**:
la carrera queda escrita en el catálogo pero **no se ofrece** en el carrusel. Es
deliberado — si se ofreciera, alguien la agarraría y las tablets se quedarían en
humo, que se lee como que el sistema se rompió. Hoy no lo usa ninguna.

> **Que MAITE conozca un id no quiere decir que tenga el video.** Hoy sólo
> `sistemas` tiene archivos de verdad en `public/videos/`; las otras trece
> apuntan a `<carrera>/persona-1..4.mp4`, que todavía no están. El espejo no se
> entera ni le importa: muestra la ingeniería igual —fondo, objeto y nombre— y
> lo único que no pasa es que las tablets acompañen.

Para sumar una carrera nueva: filmar a su gente, darla de alta en
`data/carreras.json` de MAITE, y poner ese id acá. Ni una línea de código.

---

## 8. Verificación de contenido real (`npm run listo`)

```bash
npm run listo
```

Verifica que estén los PNG de objetos declarados, el fondo activo y todos los
candidatos declarados de cada carrera —cada uno con su `lugar` y los escondites
de los otros tres objetos—, el video de humo, las doce carreras con sus colores
distintos y **cuatro objetos cada una, con su nombre y una descripción de hasta
130 caracteres**, la tipografía Muffaroo con su nota de licencia, que cada
`maite` declarado exista del otro lado, que haya al menos cinco carreras
jugables para que el carrusel sea un carrusel, y que MediaPipe esté vendorizado.
Que los objetos caigan en la periferia lo verifica `npm test`
(`tests/integracion/fondos.test.js`).

El cotejo contra MAITE busca su `data/carreras.json` en `MAITE/` (dentro del
proyecto) y en `../maite/` (al lado, que es como suelen quedar los dos repos al
clonarlos juntos). Si no lo encuentra en ninguno de los dos, ese chequeo se
saltea en silencio — y ahí es donde un id equivocado pasa de largo.

- **En rojo:** falta algo que el stand necesita. El espejo igual funciona
  —los objetos sin PNG caen a la figura vectorial y de ahí al círculo dorado,
  el fondo cae al color plano— pero no está listo para montarse.
- **En verde:** el contenido está completo.
