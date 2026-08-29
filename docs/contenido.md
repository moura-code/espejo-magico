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
    { "img": "assets/fondos/computacion.png" },
    { "img": "assets/fondos/computacion-2.jpg", "lugar": { "x": 0.2, "y": 0.28, "escala": 0.15 } }
  ],
  "objeto": { "img": "assets/computacion/laptop.png", "figura": "laptop", "escala": 0.2 },
  "objetos": [
    { "img": "assets/computacion/laptop.png", "figura": "laptop", "escala": 0.2 },
    { "img": "assets/computacion/procesador.png", "figura": "chip", "escala": 0.18 }
  ]
}
```

---

## 2. Definición de campos por carrera

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único sin acentos ni espacios (`mecanica`, `forestal`, `quimica`). |
| `nombre` | `string` | Nombre oficial completo. Se ve al pie, en una o dos líneas, mientras se muestra la carrera. |
| `color` | `string` | Color hexadecimal distintivo (`#rrggbb`). Se usa en el nombre, el anillo de progreso y como acento de la escena de respaldo. |
| `maite` | `string \| null` | El id que **esta misma carrera tiene en el proyecto MAITE**. Ver §7. |
| `fondos` | `array` | Los fondos candidatos: `{ img, lugar? }`. El espejo muestra **el primero**; elegir es reordenar. `lugar` es dónde se apoya el objeto, normalizado a la imagen. Ver §3. |
| `objeto` | `objeto` | **Opcional.** El objeto que representa a esta carrera en el carrusel. Si no está, se sortea uno de `objetos`. |
| `objetos` | `array` | Lista de 6 o más objetos característicos. De acá sale el representante cuando `objeto` no está declarado. |

No hay `persona`: las personas de cada ingeniería las muestran las tablets de
MAITE, y el espejo muestra la ingeniería.

### Los objetos

Cada carrera aporta **un solo objeto** al carrusel que gira alrededor de la
persona, y es el que vuela a su lugar en el fondo cuando lo agarra.

- **`img`**: ruta al PNG con fondo transparente (`assets/mecanica/engranaje.png`).
- **`figura`**: nombre de la figura vectorial de reserva en `espejo/figuras.js`.
- **`escala`**: se conserva del catálogo anterior; hoy el tamaño del objeto en la
  elección lo fija `CONFIG.tablero.radioObjetoFactor`, proporcional a la
  distancia a la que está sentada la persona.

Declarar `objeto` fija cuál se muestra siempre. Sirve para las carreras donde un
solo PNG se entiende de lejos y el resto no. Sin declararlo, se sortea uno de la
lista y dos visitantes seguidos no ven exactamente la misma pantalla.

---

## 3. Fondos (`assets/fondos/`)

El fondo aparece **detrás de la persona**: el espejo recorta su silueta con la
segmentación de MediaPipe y la vuelve a dibujar encima, así queda dentro de su
ingeniería en vez de tapada por ella. Y el objeto con el que agarró la carrera
**vuela a su lugar dentro del fondo** y se queda ahí, flotando apenas, detrás de
la persona.

Por eso conviene que sean imágenes **oscuras, con el centro y la mitad inferior
tranquilos** —ahí van la persona y el nombre en letra grande— y con una zona
libre a un costado para apoyar el objeto.

### Candidatos y `lugar`

Cada carrera declara `fondos`, una lista de candidatos. **El espejo muestra el
primero; elegir es reordenar.** Cada candidato puede declarar `lugar`, dónde se
apoya el objeto, **normalizado a la imagen** (`x` e `y` de 0 a 1, `escala` es el
diámetro como fracción del ancho de la imagen): como el fondo se dibuja cubriendo
la pantalla y recortado, un punto normalizado a la imagen cae siempre en el
mismo sitio de la escena. Sin `lugar` vale `CONFIG.fondo.lugarPorDefecto`.

```json
"fondos": [
  { "img": "assets/fondos/quimica.png" },
  { "img": "assets/fondos/quimica-2.jpg", "lugar": { "x": 0.2, "y": 0.28, "escala": 0.15 } },
  { "img": "assets/fondos/quimica-3.jpg", "lugar": { "x": 0.78, "y": 0.33, "escala": 0.16 } }
]
```

Para elegir mirando, y no imaginando:

```
http://localhost:8080/herramientas/fondos.html
```

muestra los candidatos de cada carrera **tal como se verían**: la imagen, una
silueta donde va la persona, el halo y el objeto apoyados en su lugar y el
nombre al pie, con las mismas funciones que usa el espejo.

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
  terreno en falso color compiten con el nombre de la carrera, que va en su
  color.

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

El orden de preferencia al dibujar es **PNG → figura → círculo del color**. Un
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

La consigna del sostenido va en la sans del sistema. No es una concesión: es la
única instrucción de la experiencia y tiene que entenderse de un vistazo. MAITE
hace la misma división.

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
candidatos declarados de cada carrera, el video de humo, las doce carreras con
sus colores distintos y al menos seis objetos cada una, la tipografía Muffaroo
con su nota de licencia, que cada `maite` declarado exista del otro lado, que
haya al menos cinco carreras jugables para que el carrusel sea un carrusel, y
que MediaPipe esté vendorizado.

El cotejo contra MAITE busca su `data/carreras.json` en `MAITE/` (dentro del
proyecto) y en `../maite/` (al lado, que es como suelen quedar los dos repos al
clonarlos juntos). Si no lo encuentra en ninguno de los dos, ese chequeo se
saltea en silencio — y ahí es donde un id equivocado pasa de largo.

- **En rojo:** falta algo que el stand necesita. El espejo igual funciona
  —los objetos sin PNG caen a la figura vectorial y de ahí al círculo del color,
  el fondo cae al color plano— pero no está listo para montarse.
- **En verde:** el contenido está completo.
