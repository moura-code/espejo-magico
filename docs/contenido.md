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
  "fondo": "assets/fondos/computacion.png",
  "persona": {
    "nombre": "Maite Martínez",
    "texto": "Diseña los sistemas que hacen que el resto funcione."
  },
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
| `nombre` | `string` | Nombre oficial completo. Se ve arriba, junto al objeto elegido. |
| `color` | `string` | Color hexadecimal distintivo (`#rrggbb`). Se usa en el nombre, el anillo de progreso y el fondo de respaldo. |
| `maite` | `string \| null` | El id que **esta misma carrera tiene en el proyecto MAITE**. Ver §7. |
| `fondo` | `string` | Ruta a la imagen que aparece detrás de la persona al elegir esta carrera. |
| `persona` | `objeto` | `{ nombre, texto }`: quién es la persona que se muestra y qué cuenta de ella. Los dos son obligatorios. |
| `objeto` | `objeto` | **Opcional.** El objeto que representa a esta carrera en la elección. Si no está, se sortea uno de `objetos`. |
| `objetos` | `array` | Lista de 6 o más objetos característicos. De acá sale el representante cuando `objeto` no está declarado. |

### La persona

Es lo único que la pantalla muestra del contenido humano: el nombre en el color
de la carrera y, debajo, dos o tres renglones sobre quién es. El texto se parte
solo en líneas y el nombre se achica si no entra, así que no hay un largo máximo
duro — pero un texto de más de tres renglones ya no se alcanza a leer en los
segundos que alguien está sentado.

De fábrica cada carrera trae `"Nombre y Apellido"` y un texto de relleno.
**`npm run listo` se queda en rojo mientras eso siga puesto**, a propósito: los
placeholders se ven perfectos en pantalla y sin esa red llegan al evento.

### Los objetos

Cada carrera aporta **un solo objeto** a la elección, y esos son los cinco que la
persona ve flotando en arco a su alrededor.

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
ingeniería en vez de tapada por ella.

Por eso conviene que sean imágenes **oscuras y sin mucho detalle en la mitad
inferior**, que es donde va el nombre y el texto en blanco.

```bash
npm run generar-fondos
```

genera un degradado del color de cada carrera para las que no tengan imagen.
Es un **placeholder**, no arte final: existe para poder ver el sistema entero
funcionando antes de que haya una sola fotografía. Nunca pisa un archivo
existente, así que para reemplazarlo alcanza con dejar la imagen real en su ruta.

Si el fondo falta del todo, la revelación cae al color plano de la carrera. Se
ve, y el nombre y el texto siguen entrando: una carrera sin fondo no rompe la
escena.

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
objeto que no se dibuja es una opción que no se puede elegir: la persona ve un
hueco en el arco y no entiende por qué ahí no pasa nada.

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

Los nombres —el de la ingeniería y el de la persona— se dibujan en **Germania
One**, la misma tipografía que usan las tablets de MAITE. El espejo y los
retratos están a dos metros uno del otro en el stand: comparten la letra para
que se lean como una sola instalación.

El texto de cada persona y la consigna del sostenido van en la sans del sistema.
No es una concesión: a tamaño de párrafo la display cuesta leerla, y son segundos
los que alguien está sentado. MAITE hace la misma división.

Para reemplazarla hay que tocar tres lugares: el archivo en
`contenido/assets/tipografias/`, el `@font-face` de `espejo/espejo.html` y las
constantes `FAMILIA_TITULO` / `FAMILIA_TEXTO` de `espejo/escena.js`. Si la nueva
tiene negrita de verdad, ahí se puede subir `PESO_TITULO`.

La licencia (SIL OFL) viaja al lado del archivo, que es lo que la licencia exige,
y está acreditada en `contenido/assets/CREDITOS.md`.

---

## 7. El puente con MAITE

El campo `maite` es el id que **esa misma carrera tiene del otro lado**. Los dos
catálogos crecieron por separado, así que no coinciden:

| Espejo | MAITE |
|---|---|
| `computacion` | `sistemas` |
| `electrica` | `electronica` |
| `produccion` | `industrial` |
| `civil` | `civil` |
| `mecanica` | `mecanica` |

**`maite: null` significa "todavía no hay gente filmada para esta ingeniería"**:
la carrera queda escrita en el catálogo pero **no se ofrece** en la elección. Es
deliberado — si se ofreciera, alguien la elegiría y las tablets se quedarían en
humo, que se lee como que el sistema se rompió.

Hoy hay **5 carreras jugables de 12**. Para sumar una: filmar a su gente, darla
de alta en `MAITE/data/carreras.json`, y poner ese id acá. Ni una línea de
código.

---

## 8. Verificación de contenido real (`npm run listo`)

```bash
npm run listo
```

Verifica que estén los PNG de objetos declarados, los doce fondos, el video de
humo, las doce carreras con sus colores distintos y al menos seis objetos cada
una, que los nombres y textos de las personas estén escritos de verdad, que cada
`maite` declarado exista del otro lado, que haya al menos cinco carreras jugables
para llenar la elección, y que MediaPipe esté vendorizado.

- **En rojo:** falta algo que el stand necesita. El espejo igual funciona
  —los objetos sin PNG caen a la figura vectorial y de ahí al círculo del color,
  el fondo cae al color plano— pero no está listo para montarse.
- **En verde:** el contenido está completo.
