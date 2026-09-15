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
          video.mp4 (opcional)
          metadata.json
  comun/
    humo.mp4
    tipografias/
      Muffaroo-Regular.ttf
      Muffaroo-LEEME.txt
    CREDITOS.md
    banco/
  catalogo.json (generado automáticamente, ignorado en git)
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

---

## 3. Fondos (`fondos/<id>/`)

El fondo aparece **detrás de la persona**: el espejo recorta su silueta con la
segmentación de MediaPipe y la vuelve a dibujar encima, así queda dentro de su
ingeniería en vez de tapada por ella. Y el objeto con el que agarró la carrera
**vuela a su lugar dentro del fondo** y se queda ahí, flotando apenas, detrás de
la persona.

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
- `video.mp4` (opcional): video en loop para fondos con movimiento.
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
mientras se desarrolla—, la foto se ve recortada a su franja del medio. Ahí el
espejo mide los lugares contra lo que se ve de la foto: la composición entera se
conserva, a la escala de la persona, y nada se pisa que no se pisara en el
espejo vertical. Los objetos, eso sí, crecen un poco más
(`fondo.agrandarEnApaisado`): a la escala de la composición se veían chiquitos,
con lugar de sobra a los costados de la persona.

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
