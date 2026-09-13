# Línea base del Render Pipeline v2

| Campo | Valor |
| --- | --- |
| Fecha | |
| Commit | |
| Equipo | |
| Chrome | |
| Resolución | |
| Cámara | |
| Perfil inicial | |

| Escenario | Duración | FPS medio | FPS mínimo | Frame | Face | Hands | Pose | Mask read | Mask convert | Video compose | Objects | UI | CPU | GPU | Errores JS |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| ATRACCION sin persona | 60 s | | | | | | | | | | | | | | |
| EXPLORACION con carrusel | 60 s | | | | | | | | | | | | | | |
| EXPLORACION con carrera elegida, fondo, silueta y cuatro objetos | 60 s | | | | | | | | | | | | | | |

## Protocolo

1. Abrir el espejo mediante `http://localhost:8080` y presionar `P` para mostrar
   el panel de rendimiento.
2. Para cada escenario, esperar 10 segundos de estabilización y registrar luego
   60 segundos.
3. Transcribir únicamente los valores agregados del panel y del monitor del
   sistema en esta tabla. El identificador técnico `compose` corresponde a la
   columna y etiqueta humana del HUD `Video compose`.
4. No guardar imágenes, video, landmarks, identificadores ni datos de
   visitantes.
