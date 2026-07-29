# Espejo Mágico — Stand Facultad de Ingeniería

**Fecha:** 2026-07-28
**Estado:** diseño aprobado, pendiente de plan de implementación

---

## 1. Resumen

Instalación interactiva para el stand principal. Un visitante se sienta en un sillón
frente a una pantalla grande enmarcada como espejo. Una cámara lo captura, el sistema
detecta su rostro y le "sortea" una de las ingenierías de la facultad. La pantalla se
cubre de niebla, se despeja, y el participante aparece rodeado de objetos característicos
de esa carrera que caen y rebotan contra su cabeza, con un accesorio (casco, gafas,
antiparras) acoplado al rostro.

El sorteo es explícitamente azaroso: el sistema no intenta deducir identidad, género,
aptitudes ni vocación a partir de la imagen. La experiencia presenta una posibilidad y
conecta cada carrera con su dimensión humana, creativa y social. El concepto rector es:
**la ingeniería tiene muchas caras; una puede ser la tuya.**

En simultáneo, cuatro o cinco tablets enmarcadas alrededor funcionan como otros espejos:
reproducen animaciones breves de mujeres vinculadas a esa carrera —docentes, estudiantes,
egresadas, investigadoras y profesionales— con su nombre, vínculo y una frase sobre lo que
hacen. Cuando la sesión termina, las tablets vuelven a negro.

Las animaciones ya están producidas por el equipo. El desarrollo cubre el espejo, el
sorteo, la composición gráfica por carrera y la sincronización con las tablets.

---

## 2. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Plazo | Menos de un mes |
| Equipo | Desarrolladores con experiencia JS/web |
| Stack | Todo navegador: Chrome en modo kiosco + servidor Node local |
| Imagen del participante | Video real de cámara + objetos encima + accesorio anclado al rostro |
| Disparo de la sesión | Automático por detección de presencia |
| Carreras | 6: Mecánica, Eléctrica, Computación, Físico-Matemático, Civil, Química |
| Recuerdo para el visitante | Ninguno. No se guarda ni se envía nada |
| Audio de los videos | Mudos, con nombre y descripción sobreimpresos |
| Interacción de objetos | Caen y rebotan contra un círculo de colisión en la cabeza |
| Detección de rostro | MediaPipe Tasks Vision — Face Landmarker, servido localmente |
| Conectividad | Red local propia con router dedicado. Cero dependencia de internet |

### Alternativas descartadas

**Segmentación del cuerpo** (recortar a la persona y ponerla sobre un fondo ilustrado).
Es lo más impactante visualmente, pero los bordes tiemblan, sufre con la iluminación
variable de un stand y consume CPU que hace falta para la escena. Riesgo alto para un mes.

**Motor gráfico nativo** (Unity, TouchDesigner). Mejor calidad visual y física real, pero
el equipo no lo maneja y el costo de aprendizaje no entra en el plazo.

**Aplicación Electron.** Da un kiosco más a prueba de accidentes, pero Chrome con los flags
de arranque adecuados cubre casi lo mismo sin costo. Queda como mejora opcional para la
última semana, no como plan.

---

## 3. Alcance

### Dentro

- Aplicación de espejo: cámara, detección de rostro, máquina de estados, sorteo, escena.
- Animación de sorteo (niebla) y de revelación.
- Composición gráfica por carrera, definida como datos y no como código.
- Física simple: gravedad, rebote contra la cabeza, piso, apilamiento básico.
- Accesorio anclado al rostro, con escala y rotación derivadas de la posición de los ojos.
- Servidor local: archivos estáticos + relé WebSocket.
- Página de tablet: reproduce el video correspondiente y se desvanece al terminar.
- Arranque de un solo golpe, vigilante de cámara, atajos de operación, modo demo.

### Fuera

- Cualquier captura, almacenamiento o envío de imágenes del público.
- Cuentas, formularios, datos personales.
- Detección de cuerpo completo, manos o gestos.
- Segmentación o recorte del participante.
- Producción de las animaciones de las referentes (ya resuelta por el equipo).
- Producción de los PNG de objetos y accesorios (ver sección 12: es un encargo a diseño).

---

## 4. Narrativa de la experiencia

### 4.1. Atracción

El reflejo del espacio aparece atenuado y ligeramente desenfocado. Sobre la imagen se
muestra: **“¿Cómo es la cara de la ingeniería?”** La pregunta activa una representación
mental antes de presentar una respuesta.

### 4.2. Encuentro

Cuando el sistema detecta una persona, el reflejo se vuelve nítido y aparece:
**“No vamos a adivinar quién sos. Vamos a mostrarte una posibilidad.”** El texto evita
que la detección facial se interprete como un análisis de personalidad, género o aptitudes.

### 4.3. Sorteo

La pantalla se cubre de niebla, circulan objetos de las distintas carreras y aparece:
**“Entre muchos futuros posibles…”** La carrera se selecciona mediante una bolsa aleatoria
equilibrada. El azar garantiza que ninguna característica visible determine el resultado.

### 4.4. Revelación

Al despejarse la niebla aparece: **“Hoy podés verte en Ingeniería en Computación.”**
La formulación presenta una posibilidad sin convertir el juego en un diagnóstico vocacional.

### 4.5. Interacción

Los objetos y símbolos de la carrera caen, rebotan e interactúan con la cabeza y las manos.
Además de herramientas, la pantalla muestra la finalidad social de cada disciplina:

- **Ingeniería en Computación:** crear tecnologías para comunicar, aprender y resolver problemas.
- **Ingeniería Mecánica:** diseñar máquinas y sistemas que transforman la vida cotidiana.
- **Ingeniería Eléctrica:** hacer posibles la energía, las comunicaciones y la automatización.
- **Ingeniería Físico-Matemática:** modelar problemas complejos para comprenderlos y tomar decisiones.
- **Ingeniería Civil:** construir las infraestructuras y los espacios que habitamos.
- **Ingeniería Química:** transformar la materia para producir, innovar y cuidar el ambiente.

### 4.6. Los otros espejos

Las tablets muestran personas reales que ya ocupan el lugar que el visitante acaba de
imaginar. Cada video incluye una dimensión —**“Yo estudio.”, “Yo investigo.”,
“Yo enseño.”, “Yo diseño.” o “Yo trabajo.”**—, el nombre, el vínculo con la carrera y una
frase breve sobre lo que esa persona hace. La selección debe combinar estudiantes,
docentes, egresadas, investigadoras y profesionales, no sólo figuras extraordinarias.

### 4.7. Cierre

Los objetos desaparecen y el reflejo vuelve a quedar limpio. Primero aparece:
**“No era una predicción. Era una posibilidad.”** Luego:
**“La ingeniería tiene muchas caras. Una puede ser la tuya.”**

---

## 5. Arquitectura

Una sola PC hace todo. Nada sale a internet.

```
        PC DEL ESPEJO                          TABLETS
  ┌──────────────────────────┐          ┌───────────────────┐
  │ Chrome kiosco            │          │ tablet.html?slot=1│
  │   espejo.html  ◀── cámara│          ├───────────────────┤
  │        │                 │   WiFi   │ tablet.html?slot=2│
  │        ▼         WebSocket ◀───────▶├───────────────────┤
  │ Node: servidor.js        │  router  │ tablet.html?slot=3│
  │   archivos + relé        │  propio  └───────────────────┘
  └──────────────────────────┘
```

El servidor de Node no tiene lógica de negocio: sirve archivos estáticos y repite a todos
los clientes conectados los mensajes que recibe del espejo. Son unas ochenta líneas.

Toda la inteligencia vive en el navegador del espejo. Las tablets son clientes tontos: no
deciden nada, sólo reaccionan al mensaje que reciben.

### Flujo de datos

```
cámara ──▶ rostro.js ──▶ {rostro} ──┬──▶ maquina-estados.js ──▶ estado + carrera
                                     │              │
                                     │              └──▶ bus.js ──▶ servidor ──▶ tablets
                                     ▼
                              escena.js.dibujar(estado, rostro, carrera)
```

---

## 6. Estructura del código

La regla de corte: cada archivo se tiene que poder entender y probar solo.

```
servidor/
  servidor.js           archivos estáticos + relé WebSocket. Sin lógica de negocio.

espejo/
  espejo.html
  main.js               arranque, bucle de render, cableado entre módulos
  camara.js             getUserMedia, espejado horizontal, encuadre, reintentos
  rostro.js             entra un cuadro → sale {rostro} o null
  maquina-estados.js    estados y transiciones. No dibuja nada.
  sorteo.js             bolsa barajada de carreras
  fisica.js             gravedad, rebote contra círculo, piso, amortiguación
  escena.js             dibuja video, objetos, accesorio, textos
  niebla.js             efecto de sorteo y de revelación
  bus.js                cliente WebSocket con reconexión
  config.js             tiempos, umbrales, presupuestos de rendimiento

tablet/
  tablet.html
  tablet.js             escucha el bus, precarga y reproduce el video de su slot

assets/
  carreras.json         definición de cada carrera
  <carrera>/            PNG de objetos y accesorio
  videos/<carrera>/     MP4 de las referentes
  iconos/               SVG de la interfaz

vendor/
  mediapipe/            WASM + modelo, copiados. Nunca desde CDN.

herramientas/
  arrancar.bat          levanta Node y abre Chrome en kiosco
```

### Contratos entre módulos

`rostro.js` no sabe qué es una carrera.
`maquina-estados.js` no sabe dibujar.
`escena.js` no sabe que existe MediaPipe.
`fisica.js` sólo conoce círculos, rectángulos y un vector de gravedad.

Esa separación permite probar la máquina de estados sin cámara y la física sin pantalla,
que es la única forma de que varias personas avancen en paralelo con una sola webcam.

---

## 7. Ciclo de la experiencia

| Estado | Duración | Qué ocurre |
|---|---|---|
| `ATRACCION` | indefinida | El reflejo aparece atenuado y desenfocado con “¿Cómo es la cara de la ingeniería?”. Objetos de todas las carreras flotan suavemente. |
| `ENGANCHE` | ~2 s | El reflejo se vuelve nítido y aclara: “No vamos a adivinar quién sos. Vamos a mostrarte una posibilidad.” |
| `SORTEO` | ~3 s | La niebla cubre la pantalla, circulan objetos diversos y aparece “Entre muchos futuros posibles…”. |
| `REVELACION` | ~2 s | La niebla se abre. Aparece “Hoy podés verte en…”, el accesorio se acopla y se envía la carrera a las tablets. |
| `ESCENA` | ~20 s | Los objetos interactúan con cabeza y manos; el texto explica la finalidad social de la disciplina. |
| `REFLEXION` | ~10 s | Los objetos se detienen y se explicita que ninguna característica visible determinó el sorteo. |
| `CIERRE` | ~4 s | “No era una predicción. Era una posibilidad.” Luego: “La ingeniería tiene muchas caras. Una puede ser la tuya.” Se envía `reposo` a las tablets. |

Después vuelve a `ATRACCION` con unos 3 segundos de enfriamiento, para que la misma persona
no dispare otra sesión sin querer al moverse.

Todos los tiempos viven en `config.js`. Se van a ajustar el día que se pruebe con público
real, no antes.

### Cortes de seguridad

- Si el rostro desaparece más de ~3 segundos en cualquier estado activo, salta directo a
  `CIERRE`. Sin esto, alguien se levanta a mitad de la escena y el espejo le habla a un
  sillón vacío durante medio minuto.
- Si la cámara falla o se desconecta, va a `ATRACCION` y reintenta cada 5 segundos. El
  público ve una invitación, nunca un error.
- Duración máxima absoluta de sesión, como red de seguridad contra cualquier estado trabado.

### El sorteo

Bolsa barajada, no azar puro. Se baraja el conjunto de carreras, se van consumiendo una por
una, y al vaciarse se vuelve a barajar evitando que la última repetida quede primera. Con
azar puro sale la misma carrera cuatro veces seguidas y las tablets muestran a las mismas
mujeres toda la tarde.

---

## 8. Detección de rostro

Librería: **MediaPipe Tasks Vision, Face Landmarker**, con los archivos WASM y el modelo
copiados dentro de `vendor/mediapipe/`. Nunca desde CDN: el día del evento no hay internet.

Configuración: un solo rostro, modo video, matrices de transformación facial activadas,
delegado GPU con caída automática a CPU.

### Interfaz que expone `rostro.js`

```js
{
  presente: true,
  centro:   { x, y },   // píxeles de canvas, punto medio entre los ojos
  ojoIzq:   { x, y },
  ojoDer:   { x, y },
  radio:    number,     // radio del círculo de colisión de la cabeza
  angulo:   number,     // inclinación en radianes
  confianza: number
}
```

o `null` si no hay nadie. Nada más. Si hubiera que cambiar de librería, se cambia un archivo.

### Tres detalles que importan

**Suavizado.** Los puntos detectados tiemblan cuadro a cuadro. Sin un filtro exponencial
sobre centro, radio y ángulo, el accesorio vibra sobre la cabeza y la instalación se ve
barata. Constante más alta para posición, más lenta para el ángulo.

**Histéresis de presencia.** Para declarar presencia hacen falta unos pocos cuadros
consecutivos con rostro; para declarar ausencia, dos o tres segundos sin él. La asimetría
es deliberada: si no, la experiencia parpadea cada vez que alguien gira la cabeza.

**Espejado.** El video se voltea horizontalmente para comportarse como espejo. En
consecuencia, la coordenada x de cada punto detectado también debe voltearse
(`x_pantalla = (1 - x_detectada) * ancho`). Es el error clásico de estos proyectos: todo
funciona, pero el accesorio se va para el lado contrario al mover la cabeza. Los textos se
dibujan en el espacio sin voltear, para que no salgan al revés.

### Presupuesto de cuadros

Detección a 20–25 cuadros por segundo; dibujo a 60, interpolando la posición del rostro
entre detecciones. Detectar en cada cuadro no aporta nada visible y consume el CPU que
necesita la escena.

### Desarrollo sin cámara

`rostro.js` acepta tres fuentes: cámara real, un video grabado del propio equipo probando,
o un generador sintético (un rostro falso que se mueve por la pantalla). Así se puede
trabajar en escena, física y anclaje sin depender de la única webcam, y en la máquina de
cualquiera.

---

## 9. Anclaje del accesorio

Cada accesorio declara dónde están los ojos **dentro de su propio dibujo**, en coordenadas
normalizadas de la imagen:

```json
"accesorio": {
  "img": "assets/computacion/gafas-vr.png",
  "anclaOjoIzq": [0.28, 0.52],
  "anclaOjoDer": [0.72, 0.52]
}
```

El código alinea esos dos puntos con los dos ojos detectados. De esa única operación salen
posición, escala y rotación, igual para todas las carreras.

La consecuencia práctica es la que importa: quien dibuja no necesita saber nada de
programación, sólo marcar dónde van los ojos en su ilustración. Cambiar un accesorio no
toca una línea de JavaScript.

Se admite un desplazamiento opcional (`offsetY`) para accesorios que no se apoyan en la
línea de los ojos, como un casco que va sobre la frente.

---

## 10. Escena y física

Física escrita a mano, sin motor externo: gravedad, colisión contra el círculo de la cabeza,
piso, paredes laterales y amortiguación. Alrededor de cien líneas.

Un motor como Matter.js daría apilamiento más convincente, pero suma peso, una API que
aprender y comportamientos difíciles de acotar. Queda como reemplazo opcional de `fisica.js`
si sobra tiempo — el contrato del módulo está pensado para permitirlo.

**Presupuesto fijo:** máximo ~40 objetos simultáneos en pantalla. Los más antiguos se
desvanecen y se retiran. Así el rendimiento no depende de cuánto tiempo lleve alguien
sentado, que es lo que suele degradar estas instalaciones sobre el final del día.

**Fallo elegante:** si un PNG no carga, se dibuja una forma simple del color de la carrera
en su lugar. Un archivo mal nombrado no puede dejar la pantalla en negro.

### Orientación de pantalla

Se diseña contra **vertical 1080 × 1920** como disposición de referencia: es la que mejor
encuadra a una persona sentada y la que más se parece a un espejo real. El código no la
asume: el encuadre del rostro, la posición de los textos y el área de caída se calculan a
partir de la relación de aspecto real del canvas, de modo que una pantalla horizontal
funcione sin cambios de código, sólo peor aprovechada. Si el televisor que consigan es
apaisado, se ajustan proporciones en `config.js`, no se reescribe la escena.

---

## 11. El contenido como datos

Todo lo que distingue una carrera de otra vive en `assets/carreras.json`:

```json
{
  "carreras": [
    {
      "id": "computacion",
      "nombre": "Ingeniería en Computación",
      "color": "#00E5A0",
      "finalidad": "Crear tecnologías para comunicar, aprender y resolver problemas.",
      "accesorio": {
        "img": "assets/computacion/gafas-vr.png",
        "anclaOjoIzq": [0.28, 0.52],
        "anclaOjoDer": [0.72, 0.52],
        "offsetY": 0
      },
      "objetos": [
        { "img": "assets/computacion/laptop.png", "escala": 0.18, "peso": 1.0 },
        { "img": "assets/computacion/robot.png",  "escala": 0.22, "peso": 0.8 }
      ],
      "referentes": [
        {
          "video": "assets/videos/computacion/ana.mp4",
          "dimension": "Yo trabajo.",
          "nombre": "Ana Rodríguez",
          "detalle": "Egresada de Ingeniería en Computación",
          "frase": "Creo tecnologías para comunicar, aprender y resolver problemas."
        }
      ]
    }
  ]
}
```

Agregar o cambiar una carrera es soltar PNG y editar un bloque. Cero código. **Esta decisión
es lo que hace que seis carreras entren en un mes.**

El archivo se valida al arrancar: si a una carrera le falta el accesorio, los anclajes o los
objetos, el sistema lo informa en la consola de operación en vez de fallar en silencio a
mitad de una sesión con público delante.

---

## 12. Encargo de diseño

Es el camino crítico real del proyecto, más que el código.

**Por cada carrera (5 o 6):**

- 6 a 10 objetos característicos. PNG con transparencia, lado mayor 512 px.
- 1 accesorio para la cabeza. PNG con transparencia, con los dos puntos de ojos indicados.
- 1 color de identidad.
- 1 finalidad social breve.

**Transversal:** mismo estilo gráfico entre carreras, pensado para leerse a dos o tres metros
de distancia y sobre un fondo de video real que puede ser claro u oscuro. Contornos definidos
o sombra suave, para que no se pierdan contra la ropa del participante.

**Total aproximado:** 50 archivos PNG.

### Las seis carreras

| id | Nombre | Color | Accesorio |
|---|---|---|---|
| `mecanica` | Ingeniería Mecánica | `#4FC3F7` celeste acero | Antiparras de taller |
| `electrica` | Ingeniería Eléctrica | `#FFD23F` amarillo | Casco dieléctrico con visor |
| `computacion` | Ingeniería en Computación | `#00E5A0` verde menta | Gafas de realidad virtual |
| `fisico-matematico` | Ingeniería Físico-Matemática | `#A78BFA` violeta | Aro de órbitas atómicas |
| `civil` | Ingeniería Civil | `#FF8A3D` naranja | Casco de obra |
| `quimica` | Ingeniería Química | `#FF5D8F` magenta | Antiparras de laboratorio |

Los seis tonos están elegidos bien separados en el círculo cromático y con brillo suficiente
para leerse sobre video real. Los nombres exactos de las carreras se confirman con la
facultad antes de imprimir nada.

### Objetos sugeridos por carrera

Punto de partida para diseño, no una lista cerrada. Se necesitan entre 6 y 10 por carrera.

- **Mecánica:** engranaje, llave inglesa, pistón, resorte, rodamiento, motor, calibre, tornillo
- **Eléctrica:** rayo, resistencia, lámpara LED, batería, transformador, enchufe, panel solar, onda de osciloscopio
- **Computación:** laptop, robot, chip, llaves `{ }`, servidor, dron, cursor, cadena de binario
- **Físico-Matemático:** π, sumatoria, integral, órbita atómica, prisma con espectro, péndulo, curva de función, dado
- **Civil:** casco, grúa, puente, plano enrollado, teodolito, ladrillo, hormigonera, viga
- **Química:** matraz, tubo de ensayo, molécula, mechero, pipeta, celda de tabla periódica, gota, balanza

---

## 13. Sincronización con tablets

Todo el protocolo son dos mensajes, en JSON sobre WebSocket:

```json
{ "tipo": "carrera", "id": "computacion", "sesion": 412 }
{ "tipo": "reposo" }
```

Cada tablet abre `http://<ip-de-la-pc>:8080/tablet.html?slot=2`. Al recibir `carrera`, elige
la referente que le corresponde según su slot y reproduce el video. Al recibir `reposo`,
se desvanece a negro.

El campo `sesion` es un contador que se incrementa en cada revelación. La tablet lo usa para
distinguir una sesión nueva de un latido repetido: si el número no cambió, ignora el mensaje
y no reinicia el video que ya está reproduciendo.

**Decisiones de implementación:**

- Video `muted` + `playsinline` + `loop`. Al ser mudos, el autoplay está permitido en todos
  los navegadores, iPad incluido. Esa sola decisión elimina el problema más molesto de este
  tipo de instalación.
- Dimensión, nombre, vínculo y frase los dibuja el sistema desde el JSON, no vienen quemados
  en el video. Así se corrige un texto sin volver a renderizar la animación.
- El conjunto de referentes combina estudiantes, docentes, egresadas, investigadoras y
  profesionales para mostrar una presencia cotidiana, no sólo figuras extraordinarias.
- **Precarga:** al abrir la página, la tablet precarga todos los videos que le tocan. Sin
  esto, la primera reproducción de cada carrera arranca con un parpadeo.
- **Reconexión automática** cada 2 segundos si se cae la conexión. Nadie tiene que ir a tocar
  una tablet durante el evento.
- **Latido:** el espejo reenvía su estado actual cada 2 segundos. Una tablet que se reconecta
  a mitad de sesión se pone al día sola.
- Si hay más tablets que referentes, los slots dan la vuelta con módulo.

El espejo no lleva registro de qué tablets existen. Si hay tres o si hay cinco funciona
igual; si una se apaga, el resto sigue.

**Qué tablets usar queda pendiente** y no bloquea el desarrollo. El único requisito es
navegador moderno con pantalla completa. Android es más dócil para el modo kiosco; iPad
también sirve porque los videos son mudos.

---

## 14. Robustez operativa

Esta es la parte que decide si la instalación funciona, y la que normalmente no se escribe.

- **Sin internet.** Todos los archivos, incluidos los de MediaPipe, servidos desde la PC.
  Se prueba explícitamente con el cable desenchufado y el wifi apagado.
- **Arranque de un golpe.** `arrancar.bat` levanta Node y abre Chrome con `--kiosk`,
  `--autoplay-policy=no-user-gesture-required` y un perfil dedicado que ya tiene concedido
  el permiso de cámara. Nadie debería configurar nada a las ocho de la mañana.
- **Vigilante de cámara.** Si `getUserMedia` falla o el dispositivo se desconecta, se muestra
  la pantalla de atracción y se reintenta cada 5 segundos.
- **Recarga programada.** La página se recarga sola, estando en `ATRACCION`, cada pocas
  horas. Es barato y evita la degradación acumulada en ocho horas de feria.
- **Atajos ocultos** para el equipo del stand: teclas 1 a 6 para forzar una carrera, reinicio
  de sesión, panel de FPS y estado, recarga manual. Nada visible para el público.
- **Modo demo sin cámara**, para mostrar el sistema en una reunión o en una máquina prestada.
- **Presupuesto de rendimiento:** se mide FPS desde el primer día y no se deja bajar de 30 en
  la máquina real. Si baja, primero se reduce la resolución de cámara, después la cantidad de
  objetos.

---

## 15. Estrategia de pruebas

Automatizado:

- **Máquina de estados** con relojes falsos: todas las transiciones, los cortes de seguridad
  por pérdida de rostro, el enfriamiento y el tope de duración, sin cámara ni pantalla.
- **Sorteo:** que la bolsa recorra todas las carreras antes de repetir ninguna, y que no
  repita en el cruce entre bolsas.
- **Física:** un objeto que cae sobre una cabeza en una posición conocida rebota hacia
  arriba; los objetos no atraviesan el piso; el tope de objetos se respeta.
- **Anclaje del accesorio:** dados dos ojos en posiciones conocidas, la posición, escala y
  rotación resultantes son las esperadas, incluido el caso de cabeza inclinada.
- **Bus:** con un servidor de mentira, que los mensajes lleguen y que la reconexión se
  recupere sola tras una caída.
- **Validación de `carreras.json`:** que un archivo incompleto sea detectado al arrancar.

No automatizable, y más importante que todo lo anterior:

- **Una tarde de prueba con diez personas ajenas al equipo, una semana antes del evento.**
  Ahí se descubre que treinta segundos son demasiados, que la gente alta queda fuera de
  cuadro, que los niños no llegan al encuadre, y que el sillón está mal orientado respecto
  a la ventana.

---

## 16. Privacidad

La imagen de la cámara nunca sale de la PC. No se graba, no se guarda, no se transmite, no
se pide ningún dato al visitante. El procesamiento de rostro ocurre íntegramente en el
navegador local.

Conviene un cartel visible en el stand que lo diga. En una facultad pública, declararlo suma
en vez de restar.

---

## 17. Riesgos

| # | Riesgo | Mitigación |
|---|---|---|
| 1 | **La producción de los ~50 PNG atrasa.** Es más probable que se atrase el arte que el código. | Cerrar el encargo en los primeros días. Trabajar con marcadores de posición desde el inicio para no bloquear el desarrollo. |
| 2 | **Contraluz en el stand.** Una ventana detrás del visitante arruina la detección. | Reservar y visitar el sitio. Llevar una luz frontal difusa propia. Orientar el sillón en contra de cualquier ventana. |
| 3 | **La PC no da el rendimiento.** | Probar en la máquina real cuanto antes, no sobre la laptop del desarrollador. Medir FPS desde el primer día. |
| 4 | **Tablets.** | Riesgo bajo: son clientes tontos, la decisión de hardware es postergable. |

---

## 18. Plan de recorte

Si el tiempo aprieta, se recorta en este orden:

1. Accesorio anclado al rostro.
2. Física: los objetos pasan a ser decorativos, sin colisión.
3. Cantidad de carreras: de 6 a 4.
4. Tablets.

**Irrenunciable:** el espejo con detección de presencia, el sorteo con niebla y los objetos
de la carrera apareciendo alrededor del participante.

---

## 19. Puntos abiertos

- **Qué tablets se usan y cuántas.** Postergado a propósito. No bloquea el desarrollo: el
  único requisito es navegador moderno con pantalla completa.
- **Nombre oficial exacto de cada carrera** según la facultad, para el texto en pantalla.
  Se completa en `carreras.json` sin tocar código.
- **Tamaño concreto del televisor y del marco.** La orientación de referencia ya está
  definida (vertical); falta el tamaño físico para el montaje del stand.
- **El link al ejemplo de p5.js** quedó cortado en la conversación original. No bloquea nada.

---

# Anexo A — Objetos dibujados por código y efectos por carrera

**Fecha:** 2026-07-28. Cambio de diseño posterior a la primera prueba en pantalla.

## Qué motivó el cambio

En la primera prueba con el sistema completo no se veía ni un objeto: sólo
círculos de colores. Ese era el comportamiento previsto —el respaldo para cuando
falta un PNG— pero dejaba la experiencia vacía, y dependía por completo de una
entrega de diseño que todavía no existía.

## La decisión

**Cada objeto se dibuja con formas vectoriales en código.** Con eso, los 42 PNG
dejan de ser el camino crítico del proyecto: hay engranajes, matraces y grúas
desde el primer día. Cuando diseño entregue, los PNG reemplazan a las figuras sin
tocar código.

El orden de preferencia al dibujar un objeto pasa a ser:

1. **PNG**, si el archivo existe
2. **Figura de código**, si el objeto declara una
3. **Círculo del color de la carrera**, como último recurso

Las tres capas conviven. La primera y la tercera ya existían; se agrega la del medio.

Contrapartida asumida: son íconos vectoriales, no ilustraciones. Un engranaje
dibujado con código se ve como un engranaje, no como el dibujo de alguien. A
cambio, las treinta y seis figuras son consistentes entre sí por construcción,
que es lo más difícil de lograr con seis carreras y poco tiempo.

## Módulos nuevos

**`espejo/figuras.js`** — un registro de funciones, una por objeto. Cada una
dibuja centrada en el origen dentro de un radio dado, con el color de la carrera.
`carreras.json` gana un campo `figura` por objeto.

**`espejo/efectos.js`** — un comportamiento de partículas por carrera, declarado
en `carreras.json`. Se dibujan encima del video y debajo de los objetos, para que
el participante quede dentro de la escena y no tapado por ella.

| Carrera | Efecto |
|---|---|
| Mecánica | engranajes girando lento en el fondo |
| Eléctrica | chispas y arcos que saltan entre puntos |
| Computación | columnas de código cayendo |
| Físico-Matemática | símbolos orbitando la cabeza |
| Civil | grilla de plano que se traza sola, con polvo de obra |
| Química | burbujas que suben y se deforman |

Presupuesto fijo de partículas, igual que los objetos: el rendimiento no puede
depender de cuánto tiempo lleve alguien sentado.

**`herramientas/figuras.html`** — hoja de contacto con las treinta y seis figuras
en grilla, cada una con su nombre. Para aprobarlas o descartarlas de un vistazo,
sin esperar que salgan sorteadas en el espejo.

## Textos

Las frases de las seis carreras se reescriben en registro institucional. Las
anteriores usaban voseo coloquial, que no corresponde a una facultad.

Además, `dibujarTextos` pasa a **ajustar el tamaño de letra para que el texto
entre siempre en el ancho de la pantalla**. Sin eso, una frase larga escrita en
`carreras.json` se sale de cuadro, y eso se descubre con público delante.
