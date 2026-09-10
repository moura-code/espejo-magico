# Objetos escondidos, un solo color y una carga más lenta

Diseño del 10 de septiembre de 2026, a partir de la segunda devolución de la
cátedra, implementado en la rama `feature/devolucion-de-la-catedra`. Cuenta qué
se hizo con cada punto, por qué, y qué queda para decidir en la reunión.

## 1. Lo que pidió la cátedra

> 1. Los nombres de cada ingeniería deberían ir en un solo color (no distinguir
>    con colores las ingenierías). Exploren colores y vean los que usa Maite.
> 2. La elección de ingeniería debería ser más lenta: queremos darle más
>    "tiempo de carga".
> 3. El color de carga debería ser el mismo para todas las ingenierías
>    (explorar opciones con transparencia).
> 4. Preparen 3 opciones de fondo para cada ingeniería (las evaluaremos en la
>    reunión).
> 5. Los fondos deberían permitir "esconder" 4 objetos relacionados con la
>    ingeniería. Uno va a ser el objeto que representa la ingeniería en el
>    carrousel y va a haber 3 más que estarán integrados al fondo y tendrán un
>    pequeño movimiento para que la persona los pueda identificar. Al pasar la
>    mano sobre el objeto se muestra una descripción corta del objeto.
> 6. Para cada ingeniería buscar 4 objetos que la podrían identificar y preparar
>    una pequeña descripción sobre cada objeto. Integrar a cada fondo e
>    implementar la interacción detallada en el punto anterior (desplegar info
>    al pasar la mano). Los objetos deben ubicarse en "la periferia" del fondo
>    para que no coincidan con la zona central en la cual estará la imagen de la
>    persona que interactúa.
> 7. Ponerle tiempo y cariño a los diseños. Evitar cosas que parpadean, se ven
>    mal, no permiten una interacción fluida y pausada.
> 8. Preparar la planilla con tareas realizadas por cada uno y las horas
>    dedicadas a cada tarea.

## 2. Qué se hizo con cada punto

| # | Pedido | Qué se hizo | Dónde mirarlo |
|---|---|---|---|
| 1 | Nombres en un solo color | El nombre de las doce va en `#f0dca0`, el color con el que las cuatro tablets de MAITE escriben los nombres. Se miraron los cinco colores de su paleta. | `herramientas/colores.html`, `CONFIG.paleta` |
| 2 | Elección más lenta | El sostenido pasa de 1,5 a **3 segundos**. Si se saca la mano antes, la carga se vacía en 1 s (antes 0,6). | `CONFIG.eleccion` |
| 3 | Mismo color de carga, con transparencia | Un anillo que avanza y un disco translúcido que se llena detrás del objeto, en el mismo dorado para las doce. Cinco opciones con transparencia, andando, para comparar. | `herramientas/colores.html`, `CONFIG.carga` |
| 4 | Tres fondos por ingeniería | Ya estaban: tres fotografías por carrera (Wikimedia Commons), más el respaldo vectorial. Ahora cada una esconde los cuatro objetos de su ingeniería. | `herramientas/fondos.html` |
| 5 | Esconder cuatro objetos, con movimiento y descripción | El objeto del carrusel vuela a su lugar; los otros tres ya están en el fondo, meciéndose apenas, cada uno a su ritmo. Pasar la mano sobre cualquiera de los cuatro abre su ficha. | `espejo/escondites.js`, `espejo/fichas.js` |
| 6 | Cuatro objetos con descripción, en la periferia | 48 objetos, cada uno con su nombre y una descripción de hasta 130 caracteres. Sus lugares se midieron en cada foto fuera de la zona de la persona, y una prueba lo vigila. | `contenido/carreras.json`, `tests/integracion/fondos.test.js` |
| 7 | Diseño cuidado, sin parpadeos | Todo lo que aparece o desaparece lo hace con un fundido; la ficha nunca tapa la cara; se revisó la experiencia cuadro a cuadro. | `docs/arquitectura.md` §5.9 |
| 8 | Planilla de tareas y horas | Un borrador por integrante, con las tareas sacadas del historial de git y las horas estimadas; cada uno tiene que completar las reales. | `docs/planilla-de-tareas.md` y `.csv` |

## 3. Las decisiones

### El color (puntos 1 y 3)

MAITE declara su paleta en `public/style.css`. Los nombres de las personas en
las tablets usan `--color-accent-strong`, `#f0dca0`, y ninguno de los cuatro
temas lo pisa (los temas 1 y 3 cambian `--color-accent` a un azul, pero ese no
se usa en los nombres). Así que las cuatro tablets escriben los nombres en ese
dorado claro, y el espejo lo toma para el nombre de la ingeniería: las dos piezas
están a dos metros en el stand y tienen que leerse como una sola instalación,
igual que con la tipografía Muffaroo.

La carga va en el mismo color, para las doce. De las opciones con transparencia
quedó un anillo (la pista de atrás al 22 %, el trazo al 90 %) con un disco al
26 % que se llena detrás del objeto como un reloj: se entiende de lejos y no le
tiñe la foto al objeto, porque va debajo. El `color` de cada carrera en
`carreras.json` queda sólo para la escena vectorial de respaldo.

### El tiempo de carga (punto 2)

Tres segundos. Se elige una sola vez, así que un gesto apurado es una ingeniería
que no se eligió del todo; y el brazo aguanta los tres segundos porque el
carrusel se detiene apenas empieza el sostenido. Una prueba de integración fija
que con la mano quieta la carga tarde al menos dos segundos y medio. El vaciado
también se hizo más lento (1 s): con la carga más larga, vaciarse en 0,6 s se
leía como un corte.

### Los cuatro objetos (puntos 5 y 6)

Salieron de los 73 PNG del proyecto —fotos reales con el fondo recortado—,
mirando cuáles se entienden de lejos y cuáles dicen la carrera sin explicación.
El primero de cada fila es el del carrusel:

| Ingeniería | Carrusel | Escondidos en el fondo |
|---|---|---|
| Industrial Mecánica | Engranajes | Rodamiento, Llave combinada, Resortes |
| Eléctrica | Lámpara | Multímetro, Resistencias, Batería |
| Computación | Computadora | Procesador, Placa madre, Mouse |
| Físico-Matemática | Imán | Prisma, Osciloscopio, Compás |
| Civil | Casco de obra | Ladrillo, Nivel, Cono vial |
| Química | Vaso de precipitados | Probeta, Frasco de reactivo, Pipetas |
| Alimentos | Queso | Lata de conserva, Pan, Manzana |
| Producción | Cronómetro | Pallet, Lector de código de barras, Balanza |
| Agrimensura | Teodolito | Receptor GPS, Brújula, Cinta métrica |
| Sistemas de Comunicación | Router | Celular, Radio, Micrófono |
| Forestal | Piñas | Hojas, Serrucho, Hacha |
| Naval | Salvavidas | Sextante, Campana de barco, Maqueta de barco |

Las descripciones son para quien visita el stand todavía en el liceo: una o dos
oraciones que dicen qué es el objeto y qué tiene que ver con la carrera. El PNG
que se llamaba `timon.png` resultó ser la maqueta de un velero y pasó a llamarse
`maqueta-barco.png`: en naval se ensayan maquetas en canales de prueba, que es lo
que cuenta su ficha. Los 25 PNG que no se usan quedan como banco para
reemplazar.

El representante ya no se sortea: es el primero de `objetos`, y elegirlo es
reordenar, igual que con los fondos. Los otros tres van a los `escondites` del
fondo en el mismo orden.

### La periferia (punto 6)

La zona de la persona está en `CONFIG.fondo.zonaDeLaPersona`: la cabeza (del 30 %
al 70 % del ancho, entre el 14 % y el 50 % de la altura) y los hombros (del 18 %
al 82 %, de la mitad para abajo), más el pie del nombre. En cada una de las 36
fotos se midió un mapa de brillo y se buscaron **cuatro rincones, dos por
costado** —uno alto y uno a la altura de la cara— fuera de esa zona, separados
entre sí y con margen al borde; en cada uno ganó la zona más oscura y pareja
cerca de una composición de referencia, para que no quedaran todos pegados a los
bordes. El objeto del carrusel va al rincón alto más oscuro, con escala 0,16, y
los escondidos a los otros tres, con 0,14. `tests/integracion/fondos.test.js`
verifica con el catálogo real que ningún objeto toque la zona ni el nombre, que
los cuatro de un fondo no se pisen, y que en el espejo nada se mueva de donde se
eligió.

### El pequeño movimiento (punto 5)

Cada escondido se mece hasta 6° a cada lado y sube y baja un 5 % de su tamaño,
con un período de 4,4 s que se alarga un 17 % de un objeto al siguiente y una
fase distinta para cada uno: tres objetos meciéndose al unísono se leen como una
animación pegada encima del fondo; cada uno a su ritmo, como cosas que están
ahí. Es un movimiento continuo y lento, que llama la atención sin parpadear. El
objeto que se está leyendo crece un poco, se calma y se ilumina.

### La ficha (puntos 5 y 6)

**Dónde.** La primera idea fue un cartel al lado del objeto, hacia el centro. No
sirve: los objetos están en los costados y un cartel de medio ancho de pantalla
cae encima de la cara. La ficha va **en la franja del costado de su objeto** —el
30 % de cada lado, el mismo borde que la zona de la cabeza—, angosta y alta,
debajo del objeto si está arriba y arriba si está abajo, nunca encima del que
describe ni de los otros objetos del fondo, y nunca en el pie.

**Cuándo.** Abrir pide 300 ms con la mano encima: si no, cada mano que pasa
camino a otro lado abre fichas en cadena. Cerrar pide 900 ms sin la mano: absorbe
los huecos de la detección y deja terminar de leer después de bajar el brazo.
Entra en 450 ms y sale en 700; pasar de un objeto a otro es un fundido cruzado.

**Cómo se ve.** El panel es el negro de MAITE, casi opaco, con un borde dorado
apenas marcado y un pico que apunta al objeto. El nombre va en Muffaroo y en el
dorado de los nombres; la descripción, en la letra de sistema y en el color de
los textos de las tablets.

Una consigna nueva, *"Pasá la mano sobre los objetos del fondo"*, aparece cuando
la escena ya está entera y se va para siempre la primera vez que alguien abre
una ficha. Para esto la detección de manos sigue andando después de elegir, a 20
cuadros por segundo en vez de 34.

### Sin parpadeos (punto 7)

Mirando la experiencia cuadro a cuadro aparecieron cuatro cortes, y los cuatro se
volvieron fundidos: la consigna de la elección se encendía de golpe encima del
humo espeso; la invitación del reposo aparecía y desaparecía de golpe; la señal
de la mano se prendía y se apagaba a los saltos de la detección; y el anillo del
objeto elegido quedaba entero mientras el carrusel se apagaba y se cortaba al
final. Además, en un monitor apaisado los cuatro objetos de un costado se
amontonaban contra el borde de arriba: ahora la composición del fondo se
conserva en lo que se ve de la foto.

## 4. Para la reunión

Con `npm start`:

- **`http://localhost:8080/herramientas/fondos.html`**: los tres candidatos de
  cada ingeniería, con sus cuatro objetos meciéndose y las fichas abriéndose por
  turno. La casilla de arriba dibuja la zona de la persona. El primero de cada
  fila es el activo; elegir otro es reordenar `fondos` en
  `contenido/carreras.json`.
- **`http://localhost:8080/herramientas/colores.html`**: el nombre en los cinco
  colores de MAITE sobre cuatro fondos, y las cinco opciones de carga andando.
- **La experiencia entera sin cámara**: abrir el espejo, apretar `D` (modo demo)
  y usar el mouse como mano: sostenerlo sobre un objeto del carrusel para elegir
  y pasarlo sobre los objetos del fondo para abrir sus fichas.

Queda para decidir:

- Qué fondo va activo en cada ingeniería.
- Si el dorado de MAITE convence para el nombre y la carga.
- Las 48 descripciones: que las lea alguien de cada carrera.
- Si algún objeto conviene cambiarlo (hay 25 PNG más en el banco).
- La licencia de Muffaroo, que sigue siendo "free for personal use only".
- Las horas reales de cada integrante en la planilla.

## 5. Límites conocidos

- **Los objetos finos se ven más chicos** —la probeta, el compás, la maqueta—,
  porque se dibujan dentro del círculo de su escala. Si alguno no se encuentra,
  se agranda la escala de su escondite.
- **Los costados piden estirar el brazo.** A dos metros de la cámara, los objetos
  de la periferia quedan más lejos de la mano que los del carrusel. Si cuesta, se
  agranda el blanco de las fichas (`CONFIG.fichas.radioFactor`) o se acercan los
  escondites al centro, sin entrar en la zona de la persona.
- **Algunos PNG tienen restos del recorte** (las hojas, el casco): se notan de
  cerca. Es un detalle de producción de las imágenes, no del código.
- **La planilla es una estimación** hecha con los commits: no ve reuniones,
  pruebas en el stand, filmaciones ni búsqueda de material.
