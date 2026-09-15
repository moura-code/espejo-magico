# Render Pipeline v2 del Espejo Mágico

## Objetivo

Mejorar la calidad del recorte, medir el costo de cada etapa gráfica y reducir
el trabajo que bloquea el hilo principal sin cambiar la interacción del stand.
La aplicación conserva los módulos ES nativos, la ejecución local, Canvas 2D
para la escena, MediaPipe en el navegador y el servidor Node limitado a
archivos estáticos.

El cambio incorpora WebGL2 sólo para producir la capa transparente de la
persona. Canvas 2D mantiene el fondo, los objetos, el carrusel, las fichas, el
humo, la niebla y los textos.

## Reglas de alcance

- No se incorporan React, bundlers, Three.js, PixiJS, Phaser ni dependencias de
  producción.
- La cámara y MediaPipe permanecen en el hilo principal durante esta entrega.
- La aplicación no envía, guarda ni registra cuadros de cámara o máscaras.
- `eleccion.js`, la máquina de estados y el contrato HTTP con MAITE no cambian.
- Los detectores conservan sus frecuencias actuales hasta contar con una línea
  base medida.
- Canvas sigue disponible durante toda la sesión como respaldo de WebGL2.
- Cada etapa termina en un commit funcional y permite volver al commit
  anterior sin migraciones ni conversión de datos.

## Arquitectura resultante

```text
Cámara
  │
  ├──────────────► recorte de análisis
  │                     │
  │                     ├── FaceLandmarker
  │                     ├── HandLandmarker
  │                     └── PoseLandmarker ──► máscara
  │
  └──────────────► frame de cámara ───────────────┐
                                                   │
Fondo activo ─────────► Canvas 2D                  │
                              │                    │
                              ├── objetos detrás   │
                              │                    ▼
                              │          compositor de persona
                              │          WebGL2 o Canvas 2D
                              │                    │
                              │                    ▼
                              ├── capa transparente de persona
                              ├── objetos delante
                              ├── carrusel y manos
                              ├── fichas y textos
                              └── humo y niebla
```

El compositor no aplana fondo y persona en una sola imagen. Si lo hiciera, los
objetos del fondo no podrían quedar entre ambos. El compositor recibe el fondo
para calcular `light wrap` y otros ajustes de borde, pero entrega una capa RGBA
transparente que contiene sólo a la persona. `escena.js` conserva este orden:

```text
video espejo
fondo de la carrera
objetos detrás
persona recortada
objetos interactuados delante
carrusel
señal de manos
fichas y nombre
humo, niebla e instrucciones
```

## Componentes nuevos

```text
espejo/render/
├── compositor.js
├── compositor-canvas.js
├── compositor-webgl.js
└── shaders/
    ├── pantalla.vert
    └── composicion.frag
```

### Contrato de la máscara

`silueta.js` conserva la lectura defensiva de MediaPipe, pero deja de convertir
la confianza a RGBA como parte obligatoria del flujo. Entrega un paquete que
vive durante la composición del cuadro:

```js
{
  confianza: Uint8Array,
  ancho: number,
  alto: number,
  revision: number,
}
```

`revision` aumenta sólo cuando PoseLandmarker entrega una máscara nueva. El
compositor Canvas convierte `confianza` en alfa RGBA y el compositor WebGL2 la
carga como textura `R8` con formato `RED` y tipo `UNSIGNED_BYTE`. Así el shader
lee la confianza en el canal rojo y el flujo WebGL evita construir `ImageData`.
La instrumentación mide por separado la lectura de MediaPipe y la conversión
RGBA que necesita Canvas.

### `compositor.js`

Selecciona una implementación y expone una interfaz estable. Intenta crear el
compositor WebGL2 cuando la configuración lo permite. Si el navegador no ofrece
WebGL2 o la inicialización falla, crea el compositor Canvas.

```js
const compositor = crearCompositor({
  canvas,
  crearCanvas,
  preferirWebGL: true,
  config,
});

const resultado = compositor.componer({
  video,
  mascara,
  fondo,
  rectVideo,
  rectFondo,
  opacidad,
});
```

`componer()` devuelve:

```js
{
  dibujado: boolean,
  capa: HTMLCanvasElement | OffscreenCanvas | null,
  backend: 'webgl2' | 'canvas2d',
}
```

El compositor también expone:

```js
compositor.backend();
compositor.metricas();
compositor.redimensionar(ancho, alto);
compositor.cerrar();
```

El llamador reutiliza `capa`; no crea un canvas por cuadro.

### `compositor-canvas.js`

Reproduce el camino actual:

1. Dibuja el video espejado en una capa transparente.
2. Usa la máscara de confianza como canal alfa mediante `destination-in`.
3. Devuelve la capa sin dibujarla sobre la escena principal.

Esta implementación define la referencia visual. La primera extracción mueve
responsabilidades sin ajustar color, alfa, suavizado o geometría.

Si falta video o máscara, devuelve `dibujado: false`. `escena.js` conserva el
comportamiento actual: muestra el fondo con
`CONFIG.fondo.opacidadSinMascara` sobre el espejo atenuado.

### `compositor-webgl.js`

Mantiene texturas persistentes para cámara, máscara actual, máscara anterior y
fondo. Carga la confianza como una textura `R8`; no sube el lienzo blanco RGBA
que usa Canvas. Actualiza cada textura cuando cambia su fuente y dibuja un rectángulo de
pantalla completa. Acepta `HTMLImageElement`, `ImageBitmap`,
`HTMLVideoElement`, `HTMLCanvasElement` y `OffscreenCanvas` cuando Chrome
permite usarlos como origen de textura.

El primer fragment shader busca paridad con Canvas:

```glsl
vec4 persona = texture(uVideo, uvVideo);
float confianza = texture(uMascaraActual, uvMascara).r;
vec3 rgb = persona.rgb;
salida = vec4(rgb, confianza * uOpacidad);
```

El shader conserva el fondo fuera del resultado. Las versiones posteriores lo
muestrean cerca del borde para calcular `light wrap`, sin incorporar sus
píxeles al alfa final.

## Recuperación ante fallas

El selector cubre estas situaciones:

- WebGL2 no está disponible al iniciar.
- Falla la compilación o el enlace de un shader.
- Chrome rechaza una textura.
- El navegador emite `webglcontextlost`.
- El contexto no se restaura dentro del plazo de la sesión.

Ante cualquiera de ellas, `compositor.js` cierra los recursos WebGL y cambia al
compositor Canvas. El cambio no reinicia la máquina de estados ni la sesión. El
HUD muestra el backend activo y el último motivo de degradación.

Si Chrome emite `webglcontextrestored`, el sistema puede intentar WebGL2 en la
siguiente sesión, cuando la máquina vuelva a `ATRACCION`. No cambia de Canvas a
WebGL2 en medio de una experiencia.

## Línea base y métricas

La primera etapa no cambia el aspecto ni las frecuencias. Agrega un medidor puro
que acumula duración, cantidad de ejecuciones, media móvil y máximo reciente.
El HUD muestra:

```text
FPS                  57.8
FRAME                16.4 ms

Face                  5.8 ms / 20 fps
Hands                 7.7 ms / 18 fps
Pose                  9.4 ms / 20 fps
Mask read             2.8 ms
Mask convert          1.1 ms

Video compose         3.6 ms
Objects               0.7 ms
UI                    0.4 ms

Perfil          equilibrado
Compositor           canvas2d
WebGL2                     sí
```

Las métricas miden segmentos del código con `performance.now()`. No usan
`performance.mark()` de forma indefinida, porque las marcas acumuladas durante
un evento consumirían memoria. El panel redondea los valores; las decisiones de
rendimiento usan los números completos.

El equipo registra una línea base en tres escenarios:

1. `ATRACCION` sin persona.
2. `EXPLORACION` con carrusel, antes de elegir.
3. `EXPLORACION` con fondo, silueta y cuatro objetos.

Cada registro incluye equipo, Chrome, resolución, perfil, duración, FPS medio,
FPS mínimo reciente y medias de cada etapa. El repositorio guarda los
resultados agregados en `docs/benchmarks/render-pipeline-v2.md`. El registro no
incluye capturas ni datos de visitantes.

## Refinamiento de la máscara

El refinamiento empieza después de comprobar la paridad del compositor WebGL2.
Los parámetros viven en `CONFIG.composicion`:

```js
composicion: {
  preferirWebGL: true,
  umbralBajo: 0.32,
  umbralAlto: 0.68,
  suavizadoTemporal: 0.35,
  featherPx: 2,
  lightWrap: 0.08,
  sombra: 0.10,
  exposicion: 0,
  contraste: 1,
}
```

El shader aplica las operaciones en este orden:

1. Mezcla la máscara anterior con la actual.
2. Corrige el rango de confianza con `smoothstep`.
3. Aplica un feather de 1 a 3 píxeles según el perfil.
4. Ajusta exposición y contraste de la cámara.
5. Agrega `light wrap` alrededor del borde.
6. Calcula una sombra ambiental tenue cuando el perfil la habilita.

El suavizado temporal sólo avanza cuando PoseLandmarker entrega una máscara
nueva. Renderizar el mismo cuadro no vuelve a mezclarla, porque eso alteraría el
factor según los FPS de presentación.

## Rendimiento adaptativo

Los perfiles existentes agregan propiedades gráficas sin cambiar el contrato
del gobernador:

| Perfil | Pose con fondo | Feather | Temporal | Light wrap | Sombra |
| --- | ---: | --- | --- | --- | --- |
| `completo` | 20 FPS | 3 px | sí | 0.08 | 0.10 |
| `equilibrado` | 16 FPS | 2 px | sí | 0.04 | 0.06 |
| `seguro` | 12 FPS | 1 px | sí | no | no |

El gobernador degrada en este orden:

1. Reduce `light wrap`, sombra y feather.
2. Baja la frecuencia de pose a la cifra del perfil.
3. Mantiene el render solicitado por `requestAnimationFrame`.

Esta entrega no limita el render a 30 o 45 FPS. El equipo sólo agregará ese
control si la comparación en el equipo del stand demuestra que los tres
perfiles anteriores no sostienen la experiencia.

## Objetos y carrusel

Canvas 2D conserva la interacción y la geometría. La presentación puede usar
el progreso que ya calcula `eleccion.js` para aplicar estos estados:

| Estado | Escala | Alfa | Halo |
| --- | ---: | ---: | ---: |
| reposo | 1.00 | 0.82 | actual |
| mano encima | 1.08 | 1.00 | 0.35 |
| sostenido | 1.12 | 1.00 | 0.35 |
| elegido | 1.18 | 1.00 | actual |

Estos valores se calibran en `CONFIG`. La presentación no cambia blancos,
tiempos, congelamiento del carrusel ni la carrera elegida.

## Carga de imágenes y videos

La carga progresiva actual se mantiene. Un adaptador intenta decodificar
fotografías y PNG con `createImageBitmap()` y vuelve a `HTMLImageElement` cuando
la API no existe o falla. El banco cierra los bitmaps que deja de usar.

La conversión de JPEG o PNG a WebP queda fuera de esta entrega hasta medir
tiempo de decodificación, RAM y memoria gráfica. El repositorio no reemplaza
archivos en masa sin esa evidencia.

Los videos conservan su banco separado, la carga de a uno y la fotografía como
respaldo. El compositor trata una imagen y un video mediante la misma interfaz
de textura.

## Pruebas

### Pruebas unitarias

- Acumulación y reinicio de métricas.
- Formato del HUD con valores presentes y ausentes.
- Selección de WebGL2 y fallback a Canvas.
- Falta de video, máscara o fondo.
- Cambio de backend después de una falla.
- Pérdida y restauración del contexto.
- Actualización temporal sólo ante una máscara nueva.
- Propiedades gráficas de cada perfil.
- Fallback de `createImageBitmap()`.

### Pruebas de integración

- Paridad del orden de capas con el compositor Canvas.
- Objeto detrás de la persona y copia enfocada delante.
- Cambio de fotografía a video sin alterar el rectángulo del fondo.
- Redimensionamiento vertical y apaisado.
- Sesión completa con el compositor Canvas forzado.
- Sesión completa con un contexto WebGL2 disponible.

Las pruebas de Node validan decisiones y llamadas mediante contextos mínimos
inyectados. No afirman paridad visual de WebGL.

### Verificación visual y de stand

La revisión visual compara Canvas y WebGL en las tres situaciones de la línea
base, en pantalla vertical y apaisada. Comprueba borde de cabeza y hombros,
posición de objetos, transición foto a video y pérdida simulada del contexto.

La prueba final dura entre dos y tres horas y registra:

- RAM de Chrome al inicio y al final.
- FPS medio y mínimo reciente.
- Uso y temperatura de CPU y GPU.
- Contextos WebGL perdidos.
- Sesiones completadas y errores JavaScript.

## Criterios de aceptación

- El compositor Canvas reproduce el comportamiento anterior.
- WebGL2 conserva el orden de objetos detrás y delante de la persona.
- La pérdida de WebGL2 cambia a Canvas sin pantalla negra ni reinicio de sesión.
- El espejo funciona sin internet y sin nuevas dependencias de producción.
- Cara, manos, selección, fichas y MAITE conservan sus contratos.
- La máscara mantiene confianza continua y reduce el halo visible.
- El equipo del stand iguala o mejora FPS y CPU respecto de la línea base.
- La memoria permanece estable durante la prueba prolongada.
- El HUD permite atribuir el costo a detectores, máscara, composición, objetos
  o interfaz.

## Etapas y límites de cada commit

1. Instrumentación y registro de línea base.
2. Extracción del compositor Canvas con paridad.
3. Selector de backend y fallback.
4. WebGL2 básico con salida transparente.
5. Recuperación por pérdida de contexto.
6. `smoothstep`, feather y configuración.
7. Suavizado temporal ligado a máscaras nuevas.
8. Exposición, `light wrap` y sombra.
9. Jerarquía visual de objetos sin cambios de interacción.
10. Calidad gráfica integrada a los perfiles.
11. `createImageBitmap()` con fallback.
12. Pruebas visuales, benchmark comparativo y protocolo prolongado.

La implementación se divide en cuatro planes. Cada uno entrega una versión
operable y parte de la verificación del anterior:

1. Observabilidad y línea base: etapas 1 y registro de los tres escenarios.
2. Límite de composición: etapas 2 y 3, todavía con salida Canvas.
3. WebGL2 y calidad de máscara: etapas 4 a 8.
4. Presentación, recursos y validación prolongada: etapas 9 a 12.

El tercer plan no comienza hasta que la comparación Canvas confirme paridad de
geometría y orden de capas. El cuarto no comienza hasta que WebGL2 y la pérdida
simulada de contexto conserven una sesión completa.

MediaPipe en Worker, `OffscreenCanvas` en Worker, conversión masiva a WebP y
limitación explícita del render quedan como experimentos posteriores. Sólo un
benchmark que identifique un cuello de botella abre una de esas líneas.
