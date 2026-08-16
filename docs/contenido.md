# Espejo Mágico — Guía de Contenido y Diseño

Esta guía explica cómo agregar, editar o reemplazar carreras, objetos, figuras vectoriales y efectos visuales en el **Espejo Mágico**.

Toda la definición de contenido se gestiona desde **`contenido/carreras.json`**. Agregar o cambiar una carrera no requiere modificar código en JavaScript.

---

## 1. Estructura de `contenido/carreras.json`

El catálogo contiene doce carreras. Cada carrera dentro de la lista `"carreras"` incluye los siguientes campos:

```json
{
  "id": "computacion",
  "nombre": "Ingeniería en Computación",
  "color": "#00E5A0",
  "frase": "Diseño de sistemas de cómputo, del hardware al software",
  "efecto": "codigo",
  "objetos": [
    { "img": "assets/computacion/laptop.png", "figura": "laptop", "escala": 0.2 },
    { "img": "assets/computacion/procesador.png", "figura": "chip", "escala": 0.18 }
  ]
}
```

---

## 2. Definición de Campos por Carrera

| Campo | Tipo | Descripción |
|---|---|---|
| `id` | `string` | Identificador único sin acentos ni espacios (ej: `mecanica`, `forestal`, `quimica`). |
| `nombre` | `string` | Nombre oficial completo visible en la pantalla del espejo durante la revelación y escena. |
| `color` | `string` | Color hexadecimal distintivo de la carrera. Usado para textos, partículas y siluetas. |
| `frase` | `string` | Frase descriptiva institucional que acompaña al nombre de la carrera en pantalla. |
| `efecto` | `string` | Nombre del efecto visual de fondo (`engranajes`, `burbujas`, `chispas`, `codigo`, `planos`, `formulas`). |
| `objetos` | `array` | Lista de 6 o más elementos flotantes/caóticos característicos de la carrera. |

---

## 3. Objetos Caen y Flotan

Cada carrera declara 6 objetos o más (Civil tiene 7) que caen desde la parte superior, rebotan físicamente contra la cabeza y se atraen magnéticamente a las manos.

### Campos de cada objeto:
- **`img`**: Ruta al PNG transparente recortado (ej: `assets/mecanica/engranaje.png`).
- **`figura`**: Nombre de la figura vectorial de reserva en `espejo/figuras.js` (ej: `engranaje`).
- **`escala`**: Factor de tamaño relativo respecto al lado corto de la pantalla (típicamente entre `0.13` y `0.22`). Es lo único que distingue el tamaño de un objeto de otro: la física los trata a todos con la misma masa.

---

## 4. Sistema de Fallback Vectorial (`espejo/figuras.js`)

Si un archivo PNG de objeto no existe aún en el disco, el espejo utiliza **figuras vectoriales dibujadas por código Canvas 2D**.
Además, se dispone del comando:
```bash
npm run generar-pngs
```
que genera automáticamente los PNGs de reserva a partir de las figuras vectoriales sin sobreescribir los archivos de fotos reales.

Existen 36 figuras vectoriales registradas en `espejo/figuras.js`:
- `engranaje`, `llave`, `piston`, `resorte`, `rodamiento`, `motor`
- `matraz`, `gota`, `molecula`, `tubo`, `lampara`, `bateria`
- `rayo`, `resistencia`, `panel-solar`, `onda`, `laptop`, `robot`
- `chip`, `llaves`, `servidor`, `dron`, `teodolito`, `plano`
- `prisma`, `sumatoria`, `pi`, `integral`, `atomo`, `curva`
- `grua`, `puente`, `ladrillo`, `viga`, `mechero`, `pipeta`

Para previsualizar y validar todas las figuras vectoriales disponibles:
```
http://localhost:8080/herramientas/figuras.html
```

---

## 5. Efectos Visuales de Fondo (`espejo/efectos.js`)

Los efectos de partículas asignados a cada carrera se dibujan detrás del participante para sumergirlo en la ambientación sin oscurecer su rostro:

| Efecto | Descripción Visual |
|---|---|
| `engranajes` | Engranajes vectoriales girando suavemente en el fondo. |
| `burbujas` | Burbujas transparentes flotando hacia arriba con deformación. |
| `chispas` | Arcos eléctricos y destellos de energía que saltan entre puntos. |
| `codigo` | Columnas de matriz de código binario y caracteres cayendo. |
| `planos` | Trazo dinámico de grillas de diseño técnico y vectores. |
| `formulas` | Símbolos matemáticos y físicos ($\pi, \Sigma, \int, \infty$) orbitando. |

---

## 6. Verificación de Contenido Real (`npm run listo`)

Para comprobar si el contenido que necesita el stand está completo en el disco, ejecute:

```bash
npm run listo
```

Verifica que estén los 73 PNG de objetos declarados, que las doce carreras acordadas sigan ahí con sus colores distintos y al menos seis objetos cada una, y que MediaPipe esté vendorizado (`npm run vendorizar`).

- **En Rojo:** falta algo que el stand necesita. El espejo igual funciona —los objetos sin PNG caen a la figura vectorial y de ahí al círculo del color— pero no está listo para montarse.
- **En Verde:** el contenido está completo.
