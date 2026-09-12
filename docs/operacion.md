# Espejo Mágico — Operación del stand

Guía para el equipo que atiende el stand. No hace falta saber programar.

---

## Prender todo

1. **Encender la PC del espejo.**
2. **Levantar las tablets primero** (el proyecto MAITE). Si no están, el espejo
   funciona igual pero los retratos del stand se quedan quietos.
3. **Doble clic en `herramientas\arrancar.bat`.** Aparecen una ventana negra chica
   (el servidor) y Chrome a pantalla completa. **No cerrar la ventana negra.**
4. **Hacer una prueba completa** antes de que entre el público: sentarse, esperar
   el humo, sostener la mano sobre un objeto hasta que la carga se complete (son
   unos tres segundos), ver que **los demás objetos se apaguen** y quede la
   ingeniería con su fondo, esperar a que aparezcan **los otros tres objetos
   escondidos** a los costados y pasar la mano sobre cada uno para ver su ficha,
   ver que las tablets cambien, levantarse y ver que las nubes vuelvan. Sentarse
   **donde se va a sentar la gente**: desde ahí la mano tiene que llegar a los
   cuatro objetos del fondo sin pararse, y la cara tiene que quedar en la mitad
   de arriba del espejo. Si no llega a los de arriba, o la cara queda más abajo,
   avisar al equipo técnico: se sube la cámara o se bajan los objetos.

El espejo no necesita internet. Sí necesita que las tablets estén en la misma
máquina o en la red del stand, pero eso lo maneja el otro proyecto.

Antes del evento, hacer además una pasada con al menos ocho personas ajenas al
equipo. Registrar sólo totales: cuántas completan una elección, cuánto tarda y
cuántas necesitan la segunda consigna. Si varias no llegan a los objetos sin
estirar el brazo, corregir la altura de cámara o la disposición antes de abrir.

## Apagar

Cerrar Chrome con `Alt` + `F4` y después la ventana negra del servidor.

---

## Atajos, en la PC del espejo

| Tecla | Qué hace |
|---|---|
| `1` a `9`, `0`, `-` y `=` | Fuerza una carrera y la muestra directo |
| `ESPACIO` / `Enter` / `➔` | Avanza manualmente al siguiente estado |
| `A` | Alterna entre avance automático (reloj) y avance manual |
| `D` | Modo demo: funciona sin cámara, con un rostro simulado, y el mouse hace de mano |
| `M` | Muestra los puntos que el sistema detecta en la cara |
| `P` | Muestra u oculta el panel de estado |
| `R` | Corta la sesión y vuelve a la invitación |
| `Ctrl` + `R` | Recarga todo |

Es la fila de números entera, de izquierda a derecha: doce teclas para las doce
carreras, en el mismo orden en que están escritas en `contenido/carreras.json`.


---

## Si algo anda mal

**La pantalla dice "Sentate frente al espejo" y no reacciona a nadie.**
Apretar `P` y mirar la línea `camara`. Si dice algo distinto de `ok`, revisar el
cable de la cámara. El sistema reintenta solo cada cinco segundos: al reconectarla
se recupera sin tocar nada.

**Detecta mal, o detecta sólo a algunas personas.**
Casi siempre es luz. Si hay una ventana o un foco detrás del visitante, la cara
queda a contraluz y el sistema no la encuentra. Tapar esa fuente o girar el sillón.
La luz frontal difusa del stand tiene que estar encendida. Para confirmar que es
eso: apretar `M` y ver si aparecen los puntos sobre la cara.

**Al siguiente le tocó la escena del anterior, o entró en el medio de una que ya
estaba.**
Se sentó demasiado rápido. El espejo espera unos nueve segundos sin ver a nadie
antes de cerrar la sesión. La regla para la fila es simple: **que el siguiente se
siente recién cuando las nubes hayan vuelto a tapar la pantalla.** Si hay apuro,
apretar `R` en la PC corta la sesión al instante.

**Los objetos desaparecieron y la persona quiere probar otra.**
Es como funciona: **se elige una sola vez**. La ingeniería que le tocó se queda
puesta hasta que se levanta, y el que sigue en la fila arranca de cero con los
objetos barajados de nuevo. Si alguien insiste, que se vuelva a sentar cuando
las nubes hayan tapado la pantalla. Desde la PC, las teclas de números fuerzan
cualquier ingeniería en cualquier momento. Mientras tanto hay algo para hacer:
en el fondo de su ingeniería esperan cuatro objetos, y pasando la mano sobre
cada uno se abre su ficha.

**No pasa nada al poner la mano sobre un objeto.**
Si el carrusel ya se había apagado, la persona ya eligió y la mano ahora abre las
fichas de los objetos del fondo (ver abajo). Si el carrusel está a la vista, apretar `P` y mirar la línea `manos`. Si dice `0 vistas`, la mano no se ve: casi
siempre está fuera del cuadro (muy abajo o muy al costado) o hay contraluz.
Apretar `M` para ver si aparecen los puntos sobre los dedos. La mano tiene que
estar **abierta y de frente**, no de canto.
Si la pantalla pide *"Usá el puntero sobre un objeto"*, el detector no cargó:
usar el mouse o el táctil como alternativa y avisar al equipo técnico.

**El anillo se llena y se vacía sin llegar a mostrar nada.**
La detección de la mano está entrecortada. Suele ser luz o distancia. Si pasa
seguido con mucha gente, avisar al equipo técnico: se sube
`eleccion.msDeGracia` en `espejo/config.js`.

**Las fichas de los objetos del fondo no se abren.**
Los objetos del fondo van en los costados de la pantalla, a propósito, para no
taparle la cara a nadie: a veces hay que estirar un poco el brazo. Apretar `P`:
la línea `manos` tiene que mostrar la mano y la línea `ficha`, el objeto que se
está describiendo. Si la mano se ve y la ficha no se abre, avisar al equipo
técnico: se agranda el blanco con `fichas.radioFactor` en `espejo/config.js`.
Si la mano no llega —pasa con gente sentada lejos y los objetos de arriba—, el
equipo técnico los baja: son los lugares de cada fondo en
`contenido/carreras.json`, y se eligen mirando `herramientas/fondos.html`.

**Las tablets no cambian cuando alguien elige.**
Apretar `P` y mirar la línea `maite`. Si dice `ok`, el espejo avisó bien y el
problema está en las tablets. Si dice `FALLO`, el proyecto de las tablets no está
levantado o se cayó. Si dice `sin-par-en-maite`, esa ingeniería todavía no tiene
gente filmada — no es una falla.

**Falta alguna ingeniería en el carrusel.**
Sólo se ofrecen las que tienen su par en las tablets (`maite` en
`carreras.json`). Hoy son las doce; una carrera con `maite: null` queda escrita
pero en silencio hasta que tenga su video.

**La pantalla quedó en negro o dice "cargando…".**
Se cerró la ventana negra del servidor. Cerrar Chrome y volver a correr
`arrancar.bat`.

**Todo va lento.**
Apretar `P` y mirar `fps` y `perfil`. Por debajo de 30 FPS hay que investigarlo:
el espejo baja solo a `equilibrado` tras 5 s lentos y a `seguro` si persiste; no
lo hace mientras alguien completa una elección y, durante ese sostenido, mantiene
las manos en la frecuencia del perfil completo. Una pestaña oculta no cambia el
perfil. Cerrar cualquier otro programa.
Si permanece en `seguro`, avisar al equipo técnico antes de cambiar la
configuración de detección.

**Aparecen íconos o círculos dorados en vez de las fotos de los objetos.**
Falta ese PNG. Apretar `P` y mirar `png faltan`. No rompe nada: es el
comportamiento previsto para que el sistema nunca quede en negro.

**La persona se ve lavada, como debajo del fondo, en vez de adelante.**
El recorte de la silueta no está funcionando. Apretar `P` y mirar la línea
`silueta`. No rompe nada —es el respaldo previsto— pero avisar al equipo técnico.

---

## Privacidad

El sistema **no saca fotos, no graba video, no guarda ninguna imagen y no manda
nada a internet.** La cámara se procesa dentro de la PC y nada sale de ahí. Lo
único que el espejo le manda a las tablets es el nombre de una ingeniería.

El cartel del stand lo dice y es literal. Si alguien pregunta, se puede afirmar sin
matices.

---

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| Dibujos de cada carrera | `contenido/assets/<carrera>/` |
| Fondos de cada ingeniería | `contenido/assets/fondos/` |
| Nombres, objetos con sus descripciones y fondos | `contenido/carreras.json` |
| Duraciones, colores y ajustes finos | `espejo/config.js` |

Para corregir el nombre de una carrera, la descripción de un objeto, cuál de sus
objetos va al carrusel (el primero de `objetos`) o cuál de sus fondos se muestra
(el primero de `fondos`), se edita `contenido/carreras.json` y listo: no hay que
tocar una línea de código.

---

## Para el equipo técnico

**Preparar una máquina nueva.** Necesita Node.js y Chrome. Después:

```
npm install
npm run vendorizar    # baja MediaPipe y el modelo de rostro. Unica vez que necesita internet.
npm test              # suite automática
```

`npm run vendorizar` deja los archivos en `vendor/mediapipe/`, que no está en el
repositorio por su tamaño.

**Verificar que no depende de internet.** Desenchufar el cable, apagar el wifi de
la PC y correr `arrancar.bat`. Tiene que funcionar el ciclo entero. En la pestaña
*Red* de las herramientas de desarrollo (F12) sólo puede aparecer `localhost`.

El servidor no tiene dependencias: sólo usa módulos de Node. `npm install` hace
falta para correr las pruebas, no para que el stand funcione.

---

## Documentación complementaria

- `docs/arquitectura.md` — especificación técnica de la arquitectura, módulos, máquina de estados y el puente con las tablets.
- `docs/contenido.md` — guía para creadores de contenido: PNG de objetos, fondos, personas y figuras vectoriales.
- `docs/despliegue.md` — guía completa de puesta en marcha del stand y contingencias.
