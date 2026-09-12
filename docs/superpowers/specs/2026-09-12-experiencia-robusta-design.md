# Experiencia robusta del Espejo Mágico

## Objetivo

Hacer que la instalación sea comprensible sin mediación, no asigne una carrera
sin consentimiento y mantenga una respuesta fluida cuando los detectores
comparten una PC limitada.

## Decisiones

### Selección asistida, nunca sorteada

La persona tiene que elegir su ingeniería. `eleccionMaxima` deja de llamar a
`mirar(opciones[0])`: al vencer, la máquina vuelve a `ATRACCION` mediante el
cierre normal. Antes de ese límite, a los diez segundos sin una elección, emite
un evento `ayuda-eleccion` una única vez por sesión. El dibujo responde con una
consigna breve: "Mantené la mano sobre un objeto hasta completar el círculo".

La primera consigna de exploración usa el mismo lenguaje y aparece desde el
inicio; la ayuda sólo la refuerza para quien no progresó. No se agrega un gesto
de deshacer en esta entrega: introducirlo cambiaría el contrato de una sola
elección con MAITE y debe validarse con la cátedra antes de hacerlo público.

### Arranque no bloqueante

El humo es decorativo. La aplicación no debe esperar su `loadeddata` ni su
timeout para iniciar cámara, detectores y ciclo. Se inicia su carga en paralelo;
si todavía no está disponible, `alfaDeHumo` sigue funcionando y el dibujo omite
el video. Cuando llega, se incorpora a los cuadros posteriores. Un fallo queda
en consola y no cambia el flujo del visitante.

### Rendimiento adaptativo y observable

Se agrega un gobernador puro de calidad con tres perfiles:

| Perfil | Pose con fondo | Manos al explorar |
| --- | ---: | ---: |
| `completo` | 20 FPS | 12 FPS |
| `equilibrado` | 16 FPS | 10 FPS |
| `seguro` | 12 FPS | 8 FPS |

El gobernador calcula una media móvil de los tiempos de cuadro. Baja un perfil
tras cinco segundos por debajo de 27 FPS y sube uno sólo tras diez segundos por
encima de 35 FPS. Nunca toca el detector de manos durante el sostenido de
selección: en esa etapa la precisión del gesto prevalece sobre el ahorro.

Además, rostro, manos y pose reciben desfases iniciales distintos. Así evitan
arrancar juntos en el mismo cuadro sin cambiar sus FPS objetivo.

### Señales para visitantes y operación

La consigna de selección se muestra sólo durante `EXPLORACION` antes de elegir.
El panel técnico conserva los datos existentes y añade el perfil activo. La
guía operativa utiliza un único umbral: investigar a menos de 30 FPS y dejar
que el gobernador actúe primero.

## Validación

- Tests unitarios de máquina de estados: la ayuda aparece una vez y el plazo
  devuelve el espejo al cierre sin emitir `mira`.
- Tests unitarios del gobernador: degradación, recuperación lenta e inmunidad
  del sostenido.
- Tests de carga opcional: iniciar una carga pendiente no bloquea al llamador y
  actualiza el valor cuando resuelve o falla.
- Suite completa (`npm test`) y semáforo de contenido (`npm run listo`).
- Prueba de stand con al menos ocho personas: registrar sólo de forma agregada
  el tiempo hasta la elección, intentos abandonados, alcance de los objetos y
  FPS mínimo. No capturar imágenes ni identificadores.

## Fuera de alcance

- Elegir el fondo definitivo, reescribir descripciones y reemplazar PNG: son
  decisiones editoriales para la reunión con referentes.
- Cambiar la licencia de Muffaroo.
- Distinguir automáticamente personas o implantar reconocimiento facial.
