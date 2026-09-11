# Espejo Mágico — Guía de Contenido y Diseño

Esta guía explica cómo agregar, editar o reemplazar carreras, personas, objetos,
fondos y figuras vectoriales en el **Espejo Mágico**.

Toda la definición de contenido se gestiona desde **`contenido/carreras.json`**.
Agregar o cambiar una carrera no requiere modificar código JavaScript.

---

## 1. Estructura de `contenido/carreras.json`

El catálogo contiene doce carreras. Cada una dentro de la lista `"carreras"`:

```json
{
  "id": "computacion",
  "nombre": "Ingeniería en Computación",
  "color": "#00E5A0",
  "maite": "sistemas",
  "fondos": [
    {
      "img": "assets/fondos/computacion-2.jpg",
      "lugar": { "x": 0.79, "y": 0.358, "escala": 0.16 },
      "escondites": [
        { "x": 0.13, "y": 0.317, "escala": 0.14 },
        { "x": 0.885, "y": 0.475, "escala": 0.14 },
        { "x": 0.22, "y": 0.435, "escala": 0.14 }
      ]
    },
    { "img": "assets/fondos/computacion.png" }
  ],
  "objetos": [
    {
      "img": "assets/computacion/laptop.png", "figura": "laptop", "escala": 0.2,
      "nombre": "Computadora",
      "descripcion": "Hardware y software trabajando juntos. En Computación se aprende a programarla para resolver problemas reales."
    },
    {
      "img": "assets/computacion/procesador.png", "figura": "chip", "escala": 0.16,
      "nombre": "Procesador",
      "descripcion": "Ejecuta miles de millones de instrucciones por segundo con transistores más chicos que un virus."
    },
    { "img": "assets/computacion/placa.png", "figura": "servidor", "escala": 0.2, "nombre": "Placa madre", "descripcion": "…" },
    { "img": "assets/computacion/mouse.png", "figura": "chip", "escala": 0.14, "nombre": "Mouse", "descripcion": "…" }
  ]
}
```

La computadora es la que gira en el carrusel y vuela a `lugar`; el procesador,
la placa y el mouse esperan escondidos en los tres `escondites`, en ese orden.

---

## 2. Definición de campos por carrera

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único sin acentos ni espacios (`mecanica`, `forestal`, `quimica`). |
| `nombre` | `string` | Nombre oficial completo. Se ve al pie, en una o dos líneas, mientras se muestra la carrera. |
| `color` | `string` | Color hexadecimal (`#rrggbb`), distinto para cada carrera. **Ya no tiñe el nombre ni la carga**: la cátedra pidió que el color no distinga a las ingenierías, y los dos van en el dorado de MAITE (`CONFIG.paleta`, ver §6). Queda para la escena vectorial de respaldo. |
| `maite` | `string \| null` | El id que **esta misma carrera tiene en el proyecto MAITE**. Ver §7. |
| `fondos` | `array` | Los fondos candidatos: `{ img, video?, lugar, escondites }`. El espejo muestra **el primero**; elegir es reordenar. `lugar` es dónde se apoya el objeto del carrusel y `escondites` dónde esperan los otros tres, normalizados a la imagen. `video` es opcional y hace que el fondo se mueva. Ver §3. |
| `objetos` | `array` | Los **cuatro** objetos que identifican a la carrera, cada uno con su `nombre` y su `descripcion`. El primero va al carrusel; los otros tres se esconden en el fondo. |

No hay `persona`: las personas de cada ingeniería las muestran las tablets de
MAITE, y el espejo muestra la ingeniería. Tampoco hay `objeto` —el representante
fijo de antes—: el espejo lo rechaza con la receta, porque ahora el representante
es el primero de `objetos`.

### Los objetos

Cada carrera tiene **cuatro objetos** que la identifican. **El primero** es el que
la representa en el carrusel que gira alrededor de la persona, y el que vuela a
su lugar en el fondo cuando lo agarra; **los otros tres** ya están en el fondo,
escondidos en sus `escondites`, meciéndose apenas para que se los pueda
encontrar. Elegir cuál va al carrusel es reordenar la lista, igual que con los
fondos.

- **`img`**: ruta al PNG con fondo transparente (`assets/mecanica/engranaje.png`).
- **`nombre`**: cómo se llama el objeto. Es el título de su ficha.
- **`descripcion`**: una o dos oraciones, **hasta 130 caracteres**, que dicen qué
  es y qué tiene que ver con la ingeniería. Es lo que se lee al pasar la mano por
  encima, de pie o sentado a un metro y medio: corta, concreta y para alguien
  que todavía está en el liceo. `npm run listo` exige el nombre y la descripción
  de los cuatro.
- **`figura`**: nombre de la figura vectorial de reserva en `espejo/figuras.js`.
- **`escala`**: se conserva del catálogo anterior; el tamaño del objeto en el
  carrusel lo fija `CONFIG.tablero.radioObjetoFactor` —proporcional a la
  distancia a la que está sentada la persona— y en el fondo, la `escala` del
  lugar o del escondite.

Los objetos que se eligieron salen de los 73 PNG del proyecto, mirando cuáles se
entienden de lejos y cuáles identifican de verdad a cada carrera (un casco de
obra dice Civil; un martillo no dice nada). Los PNG que no se usan quedan en su
carpeta como banco para reemplazar: cambiar un objeto es cambiar su `img`, su
`nombre` y su `descripcion`.

> **Ojo con los objetos finos o alargados** —una probeta, un compás, una
> maqueta de barco—: se dibujan dentro del círculo de su escala, así que se ven
> más chicos que uno redondo. Si alguno no se encuentra, se agranda la `escala`
> de su escondite.

---

## 3. Fondos (`assets/fondos/`)

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

Y si el fondo es un video, **poco movimiento**. `naval-canal.mp4` quedó en el
repositorio como el ejemplo de lo contrario: el agua del canal de ensayos se
mueve tanto que la persona y el objeto encima quedan compitiendo con el fondo en
vez de integrados. Está declarado como cuarto candidato de Naval, no como el
activo, para poder mirarlo al lado de los otros.

### Candidatos, `lugar` y `escondites`

Cada carrera declara `fondos`, una lista de candidatos. **El espejo muestra el
primero; elegir es reordenar.** Son **tres opciones reales por carrera** como
mínimo, y `npm run listo` lo verifica; el `.png` que genera
`npm run generar-fondos` no cuenta, porque es el respaldo que dibuja el código,
no una opción para elegir.

Cada candidato **esconde los cuatro objetos** de su ingeniería:

- **`lugar`**: dónde se apoya el objeto del carrusel, el que llega volando.
- **`escondites`**: dónde esperan los otros tres, **en el mismo orden que
  `objetos`**: el segundo objeto va al primer escondite, y así.

Todos van **normalizados a la imagen** (`x` e `y` de 0 a 1, `escala` es el
diámetro como fracción del ancho de la imagen): las fotos se preparan en
1080×1920, la medida del espejo, y ahí un punto normalizado a la imagen cae
exactamente en el sitio de la escena que se eligió. Sin declararlos valen
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

**Al alcance de la mano, y sin que una ficha tape a otro objeto.** La periferia
no puede quedar tan arriba que haya que pararse para llegar:
`tests/integracion/fondos.test.js` supone la misma persona que la zona —hombros
donde empieza el cuerpo, 380 px de ancho: alguien sentado a unos 2 m o más— y
el brazo del carrusel, y exige que la mano llegue a los cuatro objetos con un
10 % de brazo de sobra. Y `tests/integracion/fichas.test.js` dispone la ficha de
cada objeto de cada fondo como lo hace el espejo y exige que entre entera, en su
franja, sin tapar a su objeto ni a los otros. Es un modelo, no una medición: en
el stand se prueba con gente de verdad, y si la persona queda más abajo en el
cuadro, se bajan juntos los lugares y la zona.

El punto de partida se mide sobre la foto, no se estima: de cada imagen se saca
un mapa de brillo de 108×192 celdas y se buscan **cuatro rincones, dos por
costado** —uno alto, al lado de la cabeza, con su ficha por encima, y uno a la
altura de la cara, con su ficha por debajo—, fuera de la zona de la persona, al
alcance de la mano, con margen al borde de la pantalla y tan separados que la
ficha de uno no tapa al otro. En cada rincón gana la ventana más oscura y más
pareja (el objeto más su halo) cerca de una composición de referencia, para que
no terminen todos pegados a los bordes. El objeto del carrusel va al rincón alto más oscuro
—el "rincón oscuro arriba" de los criterios— con `escala` 0.16, y los otros tres
a los tres rincones que quedan con 0.14. Después se afina mirando, que es para
lo que está `herramientas/fondos.html`.

Si el espejo corre en una pantalla de otra proporción —un monitor apaisado
mientras se desarrolla—, la foto se ve recortada a su franja del medio. Ahí el
espejo mide los lugares contra lo que se ve de la foto: la composición entera se
conserva, a la escala de la persona, y nada se pisa que no se pisara en el
espejo vertical.

```json
"fondos": [
  {
    "img": "assets/fondos/quimica-laboratorio.jpg",
    "lugar": { "x": 0.18, "y": 0.295, "escala": 0.16 },
    "escondites": [
      { "x": 0.905, "y": 0.312, "escala": 0.14 },
      { "x": 0.215, "y": 0.42, "escala": 0.14 },
      { "x": 0.82, "y": 0.42, "escala": 0.14 }
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

Los candidatos `-2` y `-3` son fotografías de Wikimedia Commons con licencia
libre, **recortadas a 9:16, escaladas a 1080×1920 y oscurecidas** para que la
persona recortada y el nombre se lean encima; cada una lleva su obra de origen,
autoría y licencia en `assets/CREDITOS.md`. Las derivadas conservan la licencia
de origen y quedan versionadas: el stand no necesita red.

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
    "lugar": { "x": 0.16, "y": 0.321, "escala": 0.16 },
    "escondites": [
      { "x": 0.795, "y": 0.349, "escala": 0.14 },
      { "x": 0.12, "y": 0.445, "escala": 0.14 },
      { "x": 0.905, "y": 0.45, "escala": 0.14 }
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

## 5. El humo (`assets/humo.mp4`)

El video que entra al sentarse. Es **blanco sobre negro** y se compone en modo
`screen`, así que el negro desaparece solo y no hace falta canal alfa (el mp4 no
lo tiene). Para reemplazarlo, respetar eso: un video con fondo claro va a lavar
la pantalla entera.

Es un agregado opcional en código —si falta, el espejo arranca igual y lo único
que se pierde es la transición— pero `npm run listo` lo exige, porque una falla
silenciosa el día del evento no la mira nadie.

---

## 6. La tipografía (`assets/tipografias/`)

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
`contenido/assets/tipografias/`, el `@font-face` de `espejo/espejo.html` y las
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
