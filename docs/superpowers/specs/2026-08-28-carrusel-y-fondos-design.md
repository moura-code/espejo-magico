# Carrusel de doce, el objeto en su lugar y los fondos candidatos

Diseño del 28 de agosto de 2026, a partir de la devolución de la cátedra sobre
la rama `feature/explorar-ingenierias`. Reemplaza la pantalla de elección de
cinco objetos en arco por un carrusel con las doce ingenierías, y la pantalla
de la ingeniería mostrada pasa a llevar el nombre abajo y el objeto elegido
dentro del fondo. También cambia la tipografía a la que las tablets de MAITE
muestran de verdad.

## 1. Lo que pidió la cátedra, y lo que se verificó

> **Pantalla 1**: carrusel de elección de ingeniería. Que sea como lo tienen
> ahora, pero que vaya rotando entre las 12 (lento). Al seleccionar un objeto
> con la mano se completa un círculo; mientras se completa, se detiene la
> rotación; si sacan la mano antes de completar, sigue girando.
>
> **Pantalla 2**: el nombre de la ingeniería donde ahora están el nombre y el
> apellido. El objeto que se mueva a un lugar específico del fondo. Un fondo
> para cada ingeniería (tres opciones por ingeniería), que permita agregar una
> persona delante y poner objetos que se puedan animar integrados al fondo.
>
> **Arreglar**: que cuando te deje de ver vuelva al humo. Cambiar la letra a
> Muffaroo (está dentro de las fuentes de MAITE).

Contra el código:

- **"Que vuelva al humo" ya está resuelto en esta rama, no en `main`.** En
  `main` la escena sólo cortaba cuando no había *ni cara ni pose*, y la pose
  engancha a cualquiera en cuadro (la fila de atrás); en reposo no había humo.
  `b325ea2` (el rostro sostiene la sesión) y `2cd50b2` (el espejo descansa
  cubierto de humo) lo resuelven. Con la CONFIG actual el humo vuelve ~9 s
  después de que la cara desaparece. No hay nada que codificar: hay que
  mergear y volver a probar. Límite conocido: otra cara en cuadro sostiene la
  sesión.
- **Muffaroo es la letra que las tablets muestran.** `style.css` de MAITE
  declara Germania One como `--font-display`, pero los cuatro temas
  (`temas/tablet-1..4.css`) la pisan con `'Muffaroo'`. El espejo copió la base
  que ninguna tablet usa. El TTF (`MAITE/public/fonts/Muffaroo-Regular.ttf`)
  trae una sola variante, Regular 400, y dice por dentro *"Copyright Imagex ©
  2010. Free for personal use ONLY"*. Un stand de facultad no es uso personal;
  MAITE ya la usa, así que la decisión es de la cátedra. Se implementa igual y
  la nota viaja al lado del archivo.
- **El video de ejemplo** es un laboratorio de hidráulica con cámara fija; lo
  único que se mueve es el agua, y la cátedra lo marca como demasiado. Lectura:
  fondos de lugares reales, quietos o casi.
- **Pantalla 1 y 2 son trabajo nuevo** y cambian el modelo actual.

Estado de partida: 548 pruebas en verde; `npm run listo` en rojo sólo por los
nombres de fábrica de `persona`, que este diseño elimina.

## 2. Pantalla 1: el carrusel

### Geometría

Un **anillo con todas las carreras jugables** (hoy doce), una ranura por
carrera separadas `360° / n`, **anclado a los hombros exactamente como el arco
de hoy**: el centro sale de `calcularAncla`, el radio del ancho de hombros, y
sigue sin haber posiciones fijas de pantalla. Del anillo sólo se ve la
**ventana** que ya existe, `tablero.desde` → `tablero.hasta` (200° → 340°, por
encima de la cabeza): unos cinco objetos a la vez. Los demás están "detrás del
marco", como los 7–12 del boceto de la cátedra: existen, giran, y no se
dibujan.

```
        ┌──────────────┐
        │   4    5     │   ventana visible 200°→340°
        │ 3  ·      6  │   (~5 objetos, anillo anclado a los hombros)
        │       o      │
        │ 2    /|\   7 │
        └──────────────┘
          1  12 11 10 9 8   detrás del marco, siguen girando
```

Cada ranura tiene un **alfa** que sale de su ángulo: 0 fuera de la ventana, 1
adentro, y una rampa de `tablero.gradosDeFundido` (12°) en cada borde para que
nada aparezca ni desaparezca de golpe.

Dos detalles de geometría que no son decorativos:

- **El radio no depende de la fase.** Hoy `radioQueEntra` mide los ángulos de
  los cinco objetos; con el anillo girando eso haría respirar el radio cuadro a
  cuadro. Se mide contra la ventana fija (ángulos muestreados de `desde` a
  `hasta`), que es lo que tiene que entrar en el lienzo.
- **El tamaño del objeto se acota a la cuerda entre vecinos.** Con doce ranuras
  a 30° y el radio achicado por el borde del lienzo, dos objetos podrían
  encimarse. `radioObjeto ≤ radio · sin(π/n) / (1 + tablero.aireEntreObjetos)`.

### Rotación y pausa

La fase avanza `tablero.gradosPorSegundo` (8°/s: vuelta entera en 45 s, entra
un objeto nuevo cada ~4 s) en el sentido de las flechas del boceto — sube por la
izquierda, pasa por arriba, baja por la derecha; en ángulos del lienzo, la fase
**crece**. El reloj entra como `dt` en segundos, nunca `Date.now()`.

**La pausa es la misma señal que hoy congela el arco**: `congelar`, que
`main.js` pone en `progreso > 0`. Mano sobre un objeto → el anillo de progreso
empieza a llenarse en el primer cuadro y el carrusel se detiene ahí mismo. Sacar
la mano antes de completar → gracia (250 ms) y olvido (600 ms como máximo) hasta
que el progreso llega a cero, y el carrusel sigue girando. Es exactamente la
prueba que pide la cátedra, y `tests/integracion/eleccion.test.js` la fija.

Sólo son blancos las ranuras **completamente visibles** (`alfa === 1`). Una
que entra o sale de la ventana no se puede agarrar hasta estar entera.

### Qué se ofrece

`opciones` pasa de cinco sorteadas a **todas las jugables**, en orden barajado
por sesión (`sorteo.siguientes(n)` con `n` = todas: la bolsa ya entrega una
permutación fresca cada vez, y la primera de una sesión nunca repite la última
de la anterior). `CONFIG.eleccion.cantidad` desaparece. Cada carrera sigue
aportando un solo objeto (`objeto` fijo o uno sorteado de `objetos`).

### Lo que no cambia

La máquina de estados no se toca: `mirar(id)`, el evento `mira`, la red de la
fila (`eleccionMaxima` muestra `opciones[0]`, que ahora es una al azar entre
doce), el tope de sesión, el corte por rostro. `eleccion.js` tampoco: sigue
recibiendo blancos `{id, x, y, radio}` por cuadro, y que se muevan lento no le
importa. MAITE recibe el mismo aviso por cambio.

## 3. Pantalla 2: la ingeniería mostrada

### El nombre abajo

El nombre de la ingeniería se dibuja **donde hoy está el nombre de la persona**:
en el pie, sobre el degradado que lo despega del fondo, en Muffaroo y en el color
de la carrera, en una o dos líneas y achicándose si no entra. El título de arriba
(`disposicion.titulo`) desaparece.

**`persona` sale de `carreras.json` y del validador.** Las personas las muestran
las tablets de MAITE; el espejo muestra la ingeniería. `dibujarFichaDePersona`
se elimina; `dibujarNombreDeCarrera` pasa a dibujar el pie entero. Con eso el
único rojo de `npm run listo` (los "Nombre y Apellido" de fábrica) deja de
existir.

### El objeto en su lugar

Cada fondo declara **dónde se apoya el objeto**: `lugar: { x, y, escala }`,
normalizado a la imagen (`x`, `y` en 0–1; `escala` es el diámetro como fracción
del ancho dibujado). Como el fondo se dibuja cubriendo la pantalla y recortado,
un punto normalizado a la imagen cae siempre en el mismo sitio de la escena,
en cualquier resolución. `lugar` es opcional: sin él vale
`CONFIG.fondo.lugarPorDefecto` (arriba a la izquierda, lejos de la cara y del
nombre).

Al completarse el sostenido, el objeto **vuela de su ranura a su lugar**: línea
recta con easing, `tiempos.vuelo` (1000 ms), interpolando también el tamaño.
El origen se captura en el evento `mira` (la posición de la ranura en ese
cuadro); si la ranura no está visible —la red de la fila o una carrera forzada
por teclado— el objeto aparece en su lugar creciendo desde cero.

**Capas.** Mientras vuela va por delante de todo; al aterrizar pasa **detrás de
la persona recortada**, entre el fondo y ella: integrado a la escena, y si la
persona se inclina sobre ese punto lo tapa, que es lo correcto. Debajo lleva un
halo suave del color de la carrera (`CONFIG.fondo.haloDelLugar`) que lo presenta
sobre cualquier fondo, foto o escena vectorial. Sin máscara de silueta el objeto
queda sobre el fondo tenue, como todo lo demás en ese caso.

Una vez apoyado, **flota**: sube y baja unos píxeles y se inclina apenas, con
`CONFIG.fondo.flotar` (`amplitud` en radios del objeto, `periodoMs`). Es la
animación integrada al fondo que pide la cátedra, sin video.

Todo esto vive en un módulo nuevo, `espejo/vuelo.js`, puro y probado en Node:

```js
lugarEnPantalla(lugar, rectanguloDelFondo)      // → { x, y, radio }
posicionEnVuelo({ origen, destino, t })         // → { x, y, radio }; origen null = crece en su lugar
flotacion(ahora, radio, { amplitud, periodoMs }) // → { dy, giro }
```

y `calcularTransicionEscena` suma la capa `vuelo` (0→1 en `tiempos.vuelo`
desde `desdeLaMirada`; 1 en el cierre) para que "qué se ve cuándo" siga
estando en un solo lugar.

### La ranura vacía

La ranura del objeto mostrado queda **vacía con su anillo lleno**: es la marca
de "esta es la que estás viendo", y sigue siendo blanco. Mantener la mano quieta
encima sostiene la pausa del carrusel y no dispara nada (la máquina descarta el
repetido). Sacarla deja que siga girando.

### Cambiar de objeto y cerrar

**La exploración se conserva.** El carrusel sigue girando en la pantalla 2.
Agarrar otro objeto: el anterior vuelve a su ranura, el fondo nuevo entra desde
cero con su reloj (`miraDesdeCuando`, como hoy) y el nuevo objeto vuela. Quien
agarra uno solo ve exactamente la pantalla 2 de la cátedra. En el cierre todas
las capas se desvanecen juntas, como hoy.

## 4. Los fondos: candidatos y lugar

### Esquema

`fondo` (una ruta) pasa a **`fondos`, una lista de candidatos**:

```json
"fondos": [
  { "img": "assets/fondos/quimica.png" },
  { "img": "assets/fondos/quimica-2.jpg", "lugar": { "x": 0.2, "y": 0.28, "escala": 0.15 } },
  { "img": "assets/fondos/quimica-3.jpg", "lugar": { "x": 0.78, "y": 0.33, "escala": 0.16 } }
]
```

El espejo usa **el primero**; elegir es reordenar. El validador exige `img` en
cada uno, `lugar` con `x` e `y` en 0–1 y `escala` mayor que cero cuando está, y
**rechaza el viejo `fondo`** con un mensaje que dice cómo migrarlo, para que un
JSON viejo no deje a una carrera sin fondo en silencio. `fondos` sigue siendo
opcional (sin él: escena vectorial, y si no, color plano). Sólo se precarga el
activo de cada carrera: 36 imágenes de 1080×1920 en memoria de video no tienen
sentido para mostrar doce.

`contenido.js` exporta `fondoActivo(carrera)`. `todasLasImagenes` incluye sólo
el activo. `generar-fondos` genera el activo si falta, como hoy.

### La página para elegir

`herramientas/fondos.html` deja de dibujar sólo las escenas vectoriales: por
cada carrera muestra **sus candidatos en fila, tal como se verían**: la imagen
(o la escena vectorial si el archivo no está), una silueta gris donde va la
persona, el halo y el objeto representante apoyados en su `lugar`, y el nombre
al pie dibujado con las mismas funciones de `escena.js` y la misma tipografía.
Cada tarjeta dice el archivo, el `lugar` y si es el activo. La cátedra elige
mirando, no imaginando.

### De dónde salen

- **Candidato 1: la escena vectorial de hoy**, ya generada a PNG. Se queda como
  activa hasta que la cátedra elija.
- **Candidatos 2 y 3: fotografías de Wikimedia Commons**, con el mismo
  tratamiento que los objetos: obra de origen, autoría y licencia por archivo en
  `contenido/assets/CREDITOS.md`, licencias CC0 / dominio público / CC BY /
  CC BY-SA. Criterios de selección: el lugar donde se trabaja esa ingeniería
  (laboratorio, obra, planta, campo), sin personas identificables, con el centro
  y la mitad de abajo tranquilos para la persona y el nombre, y una zona libre a
  un costado para el objeto.
- **Preparación**, una sola vez y en la máquina de desarrollo (no en el
  evento): recorte a 9:16 alrededor de la zona elegida, escalado a 1080×1920,
  oscurecido (la persona recortada y el nombre en blanco necesitan un fondo
  oscuro, y un fondo claro delata el borde de la silueta), guardado como JPEG en
  `assets/fondos/<id>-2.jpg` y `<id>-3.jpg`. Las derivadas conservan la
  licencia de origen y quedan versionadas: el stand no necesita red. El `lugar`
  de cada foto se elige sobre la imagen final.

`npm run listo` exige que **todo candidato declarado exista en el disco** y que
cada carrera tenga al menos uno.

## 5. Tipografía: Muffaroo

- `contenido/assets/tipografias/Muffaroo-Regular.ttf` (copiado de MAITE) y
  `Muffaroo-LEEME.txt` con la licencia que el archivo declara, la advertencia
  de uso y de dónde salió. Germania One y su OFL se van: ya no se usan.
- `espejo/espejo.html`: el `@font-face` pasa a `'Muffaroo'`.
- `escena.js`: `TITULO_SOLO = "'Muffaroo'"`; `PESO_TITULO` sigue en 400 (una
  sola variante, igual que Germania One). El respaldo se elige mirando la
  letra: si Muffaroo no tiene serifas, el respaldo tampoco.
- `tests/listo` exige el TTF y el LEEME. Los docs que nombran Germania One
  pasan a Muffaroo.

## 6. CONFIG

Nuevo:

```js
tiempos.vuelo: 1000,                 // el viaje del objeto de la ranura a su lugar
tablero.gradosPorSegundo: 8,         // vuelta entera en 45 s
tablero.gradosDeFundido: 12,         // rampa de alfa en cada borde de la ventana
tablero.aireEntreObjetos: 0.2,       // aire mínimo entre vecinos, en radios de objeto
fondo.lugarPorDefecto: { x: 0.22, y: 0.3, escala: 0.16 },
fondo.haloDelLugar: 0.35,            // alfa del halo debajo del objeto apoyado
fondo.flotar: { amplitud: 0.08, periodoMs: 3200 },
```

Se va: `eleccion.cantidad`.

## 7. Módulos y pruebas

| Módulo | Cambio | Pruebas |
|---|---|---|
| `tablero.js` | anillo de `n` ranuras, fase, ventana con alfa, radio estable, cuerda mínima; `actualizar` recibe `dt` y devuelve `ubicaciones[{x, y, angulo, alfa}]` | ranuras y espaciado; ventana y fundido; gira con `dt` y no con `congelar`; da la vuelta; radio igual con cualquier fase; sin superposición con doce; visibles dentro de pantalla; `reiniciar` vuelve la fase a cero |
| `vuelo.js` (nuevo) | lugar en pantalla, interpolación, flotación | extremos y monotonía del vuelo; origen nulo crece en su lugar; flotación acotada y periódica; lugar respeta el recorte "cover" |
| `niebla.js` | capa `vuelo` en `calcularTransicionEscena` | 0 sin mirada, 1 pasado `tiempos.vuelo`, 1 en cierre |
| `escena.js` | nombre al pie con degradado, en una o dos líneas; sin ficha ni título; `dibujarObjetoApoyado` (halo + objeto); Muffaroo | pie, líneas, degradado, tipografía; halo debajo del objeto |
| `contenido.js` | `fondos[{img, lugar}]`, `fondoActivo`, sin `persona`, rechaza `fondo` | validación de cada campo y del mensaje de migración; precarga sólo el activo |
| `main.js` | cableado: `dt` al tablero, blancos visibles, origen del vuelo en `mira`, orden de capas | `tests/integracion/sintaxis.test.js` |
| `tests/integracion/eleccion.test.js` | doce ofrecidas; la pausa y la reanudación del carrusel; una ranura a medio entrar no se agarra | — |
| `tests/listo` | candidatos en disco; Muffaroo; sin placeholders de persona | — |
| `herramientas/fondos.html`, `generar-fondos.*` | candidatos, `fondoActivo` | a mano desde `npm start` |

Convenciones de siempre: castellano, identificadores y comentarios sin tildes,
el porqué en el comentario, todo lo externo inyectado, ningún número mágico
fuera de `config.js`.

## 8. Documentación

`CLAUDE.md`, `README.md`, `docs/arquitectura.md` (§4 y §5.2) y
`docs/contenido.md` (§2, §3, §6) describen hoy cinco objetos en arco, la ficha
de la persona, `fondo` y Germania One. Se actualizan en el mismo cambio. Los
documentos de `docs/superpowers/` de julio no se tocan.

## 9. Fuera de alcance

- Fondos en video. El ejemplo tiene demasiado movimiento y no hay tomas
  quietas; la flotación del objeto es la animación por ahora. Si aparecen tomas
  propias, `img` en `.mp4` es el siguiente paso natural.
- Distinguir dos personas. Sigue el límite documentado: otra cara en cuadro
  sostiene la sesión.
- Rotar los candidatos entre sesiones. Elegir es reordenar.
