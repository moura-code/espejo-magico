# Espejo Mágico — Plan de Implementación

> **Para agentes:** SUB-SKILL REQUERIDA: usar `superpowers:subagent-driven-development` (recomendada) o `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Los pasos usan casillas (`- [ ]`) para seguimiento.

**Objetivo:** Construir una instalación de espejo interactivo que detecta el rostro de un visitante, le sortea una de seis ingenierías, lo rodea de objetos de esa carrera que rebotan contra su cabeza, y dispara en tablets cercanas videos de mujeres referentes de esa disciplina.

**Arquitectura:** Una sola PC corre un servidor Node mínimo (archivos estáticos + relé WebSocket) y Chrome en modo kiosco con la aplicación del espejo. Toda la lógica vive en el navegador del espejo; las tablets son clientes tontos que reaccionan a dos mensajes. Nada depende de internet.

**Stack:** Módulos ES nativos sin bundler · Canvas 2D · MediaPipe Tasks Vision (Face Landmarker) copiado localmente · Node + `ws` · Vitest.

**Especificación:** `docs/superpowers/specs/2026-07-28-espejo-magico-design.md`

---

## Restricciones globales

Todas las tareas heredan estas reglas. No hace falta repetirlas en cada una.

- **Cero red externa.** Ningún CDN, ninguna fuente web, ningún recurso remoto. Todo se sirve desde `http://<ip-pc>:8080`. La Tarea 15 lo verifica con la máquina desconectada.
- **Sin paso de compilación.** Módulos ES nativos (`<script type="module">`). El navegador carga los archivos fuente tal cual. `package.json` lleva `"type": "module"`.
- **Dos dependencias de ejecución como máximo:** `ws` en el servidor. En el navegador, sólo MediaPipe copiado a `vendor/`.
- **Nombres en español**, igual que la especificación: `rostro`, `carrera`, `sorteo`, `niebla`. Sin mezclar idiomas dentro de un identificador.
- **Nada de estado global mutable entre módulos.** Cada módulo recibe lo que necesita por parámetro. Es lo que permite probarlos sin navegador.
- **Reloj y azar siempre inyectados** en la lógica pura (`ahora` como parámetro, RNG como dependencia). Ningún `Date.now()` ni `Math.random()` dentro de un módulo probable.
- **Resolución de referencia:** 1080 × 1920 vertical. El código no la asume: todo se calcula desde el tamaño real del canvas.
- **Puerto 8080.**
- **Las seis carreras y sus ids:** `mecanica`, `electrica`, `computacion`, `fisico-matematico`, `civil`, `quimica`.
- **Ningún fotograma de cámara se guarda, se copia a disco ni se envía por la red.** Nunca. En ninguna tarea.
- **Commits en español**, formato `tipo: descripción` (`feat:`, `test:`, `fix:`, `chore:`, `docs:`).

---

## Mapa de archivos

```
package.json                  scripts y dependencias
vitest.config.js              configuración de pruebas
.gitignore

servidor/
  servidor.js                 archivos estáticos + relé WebSocket. Sin lógica de negocio.

comun/
  protocolo.js                los dos mensajes del sistema. Compartido espejo ↔ tablet.

espejo/
  espejo.html                 el canvas y poco más
  config.js                   tiempos, umbrales, presupuestos. Todo número ajustable vive acá.
  contenido.js                carga y valida carreras.json
  imagenes.js                 banco de PNG con caída elegante si falta un archivo
  camara.js                   getUserMedia, espejado, reintentos
  suavizado.js                filtro exponencial e histéresis de presencia
  rostro.js                   MediaPipe → {rostro}. Tres fuentes: cámara, video, sintética.
  anclaje.js                  posición, escala y rotación del accesorio desde dos ojos
  fisica.js                   gravedad, rebote contra círculo, piso, paredes
  objetos.js                  pool de objetos con presupuesto y desvanecido
  sorteo.js                   bolsa barajada de carreras
  maquina-estados.js          estados, transiciones y cortes de seguridad
  niebla.js                   efecto de sorteo y de revelación
  escena.js                   dibuja video, objetos, accesorio y textos
  bus.js                      cliente WebSocket con reconexión
  operacion.js                atajos, panel de FPS, modo demo, recarga programada
  main.js                     cableado y bucle de render

tablet/
  tablet.html
  tablet.js                   precarga, elección por slot, reproducción, desvanecido

contenido/
  carreras.json               las seis carreras
  assets/<carrera>/           PNG de objetos y accesorio
  videos/<carrera>/           MP4 de las referentes

vendor/mediapipe/             WASM + modelo copiados. Nunca desde CDN.

herramientas/
  vendorizar.mjs              copia MediaPipe a vendor/
  arrancar.bat                levanta Node y abre Chrome en kiosco

tests/                        espeja la estructura de arriba
docs/operacion.md             guía para el equipo del stand
```

**Regla de corte:** `rostro.js` no sabe qué es una carrera. `maquina-estados.js` no dibuja. `escena.js` no sabe que existe MediaPipe. `fisica.js` sólo conoce círculos y rectángulos.

---

## Orden de las tareas y por qué

El riesgo mayor no es la lógica, es que MediaPipe no ande bien en la máquina real con la luz del stand. Por eso la **Tarea 2 pone cámara y detección en pantalla antes que ninguna otra cosa**: si algo va a fallar, que falle la primera semana y no la última.

| # | Tarea | Entregable verificable |
|---|---|---|
| 1 | Esqueleto, servidor y arranque | `npm start` sirve una página; dos clientes WebSocket se ven |
| 2 | Cámara y detección de rostro en pantalla | La caja del rostro y los ojos dibujados sobre el video espejado |
| 3 | Suavizado e histéresis | El marcador deja de temblar y de parpadear |
| 4 | Contenido y su validación | `carreras.json` con seis carreras, validado al arrancar |
| 5 | Sorteo con bolsa barajada | Seis carreras antes de repetir ninguna |
| 6 | Anclaje del accesorio | Un PNG pegado a la cara que sigue la inclinación |
| 7 | Física y pool de objetos | Objetos que caen y rebotan contra la cabeza |
| 8 | Máquina de estados | Todas las transiciones y cortes, probadas sin cámara |
| 9 | Protocolo y bus | El espejo emite; un cliente de prueba recibe |
| 10 | Escena | El dibujo completo de un estado |
| 11 | Niebla | Sorteo y revelación |
| 12 | Cableado | La experiencia completa de punta a punta |
| 13 | Operación | Atajos, FPS, modo demo, recarga |
| 14 | Tablets | Cinco tablets reaccionando al sorteo |
| 15 | Sin internet y guía de operación | Todo funciona con el cable desenchufado |

---

### Tarea 1: Esqueleto, servidor y arranque

**Archivos:**
- Crear: `package.json`, `vitest.config.js`, `servidor/servidor.js`, `espejo/espejo.html`, `herramientas/arrancar.bat`
- Modificar: `.gitignore`
- Probar: `tests/servidor/servidor.test.js`

**Interfaces:**
- Consume: nada.
- Produce: `crearServidor({ raiz })` → `{ escuchar(puerto): Promise<number>, cerrar(): Promise<void> }`. `escuchar(0)` toma un puerto libre, que es lo que usan las pruebas.

- [ ] **Paso 1: Crear `package.json`**

Sin versiones a mano: las escribe npm en el paso siguiente.

```json
{
  "name": "espejo-magico",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "node servidor/servidor.js",
    "test": "vitest run",
    "test:mirar": "vitest",
    "vendorizar": "node herramientas/vendorizar.mjs"
  }
}
```

- [ ] **Paso 2: Instalar dependencias**

```bash
npm install ws
npm install -D vitest
```

- [ ] **Paso 3: Crear `vitest.config.js` y ampliar `.gitignore`**

```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
  },
});
```

Agregar a `.gitignore`:

```
node_modules/
vendor/mediapipe/
.perfil-chrome/
contenido/videos/
```

Los videos y MediaPipe no van al repositorio: pesan y se regeneran. `docs/operacion.md` (Tarea 15) explica de dónde salen.

- [ ] **Paso 4: Escribir la prueba que falla**

`tests/servidor/servidor.test.js`:

```js
import { describe, it, expect, afterEach } from 'vitest';
import WebSocket from 'ws';
import { crearServidor } from '../../servidor/servidor.js';

let servidor = null;

afterEach(async () => {
  if (servidor) await servidor.cerrar();
  servidor = null;
});

const abierto = (socket) => new Promise((ok) => socket.once('open', ok));
const primerMensaje = (socket) =>
  new Promise((ok) => socket.once('message', (m) => ok(JSON.parse(m.toString()))));

describe('servidor', () => {
  it('repite a los demas clientes el mensaje que recibe de uno', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    const receptor = new WebSocket(`ws://localhost:${puerto}`);
    await Promise.all([abierto(emisor), abierto(receptor)]);

    const llegada = primerMensaje(receptor);
    emisor.send(JSON.stringify({ tipo: 'carrera', id: 'civil', sesion: 1 }));

    expect(await llegada).toEqual({ tipo: 'carrera', id: 'civil', sesion: 1 });
    emisor.close();
    receptor.close();
  });

  it('le manda el ultimo mensaje a quien se conecta despues', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const emisor = new WebSocket(`ws://localhost:${puerto}`);
    await abierto(emisor);
    emisor.send(JSON.stringify({ tipo: 'carrera', id: 'quimica', sesion: 7 }));

    await new Promise((ok) => setTimeout(ok, 50));
    const tardio = new WebSocket(`ws://localhost:${puerto}`);
    const llegada = primerMensaje(tardio);

    expect(await llegada).toEqual({ tipo: 'carrera', id: 'quimica', sesion: 7 });
    emisor.close();
    tardio.close();
  });

  it('no sirve archivos fuera de la raiz', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const respuesta = await fetch(`http://localhost:${puerto}/../../../etc/passwd`);
    expect([403, 404]).toContain(respuesta.status);
  });

  it('sirve la pagina del espejo en la raiz', async () => {
    servidor = crearServidor();
    const puerto = await servidor.escuchar(0);
    const respuesta = await fetch(`http://localhost:${puerto}/`);
    expect(respuesta.status).toBe(200);
    expect(respuesta.headers.get('content-type')).toContain('text/html');
  });
});
```

- [ ] **Paso 5: Correr la prueba y confirmar que falla**

```bash
npm test
```

Esperado: FALLA con `Failed to resolve import "../../servidor/servidor.js"`.

- [ ] **Paso 6: Escribir `servidor/servidor.js`**

```js
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer } from 'ws';

const RAIZ_POR_DEFECTO = resolve(fileURLToPath(new URL('..', import.meta.url)));

const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
};

export function crearServidor({ raiz = RAIZ_POR_DEFECTO } = {}) {
  const servidorHttp = createServer(async (pedido, respuesta) => {
    const ruta = new URL(pedido.url, 'http://local').pathname;
    const absoluta = resolve(raiz, '.' + (ruta === '/' ? '/espejo/espejo.html' : ruta));

    if (absoluta !== raiz && !absoluta.startsWith(raiz + sep)) {
      respuesta.writeHead(403).end('Fuera de la raiz');
      return;
    }
    try {
      const cuerpo = await readFile(absoluta);
      respuesta
        .writeHead(200, {
          'Content-Type': TIPOS[extname(absoluta)] ?? 'application/octet-stream',
          'Cache-Control': 'no-cache',
        })
        .end(cuerpo);
    } catch {
      respuesta.writeHead(404).end('No encontrado');
    }
  });

  const sockets = new WebSocketServer({ server: servidorHttp });
  let ultimoMensaje = null;

  sockets.on('connection', (cliente) => {
    if (ultimoMensaje) cliente.send(ultimoMensaje);
    cliente.on('message', (crudo) => {
      ultimoMensaje = crudo.toString();
      for (const otro of sockets.clients) {
        if (otro !== cliente && otro.readyState === otro.OPEN) otro.send(ultimoMensaje);
      }
    });
  });

  return {
    escuchar: (puerto) =>
      new Promise((ok) => servidorHttp.listen(puerto, () => ok(servidorHttp.address().port))),
    cerrar: () =>
      new Promise((ok) => {
        for (const cliente of sockets.clients) cliente.terminate();
        sockets.close();
        servidorHttp.close(ok);
      }),
  };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const servidor = crearServidor();
  const puerto = await servidor.escuchar(Number(process.env.PUERTO) || 8080);
  console.log(`Espejo servido en http://localhost:${puerto}/espejo/espejo.html`);
}
```

El servidor guarda el último mensaje y se lo manda a quien se conecte después. Una tablet que se enciende tarde o se reconecta se pone al día al instante, sin esperar el latido.

- [ ] **Paso 7: Crear `espejo/espejo.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Espejo Mágico</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    canvas { display: block; width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <canvas id="lienzo"></canvas>
  <script type="module" src="./main.js"></script>
</body>
</html>
```

Y un `espejo/main.js` provisorio de una línea, para que la página cargue sin error:

```js
console.log('espejo listo');
```

- [ ] **Paso 8: Correr las pruebas y confirmar que pasan**

```bash
npm test
```

Esperado: PASAN las cuatro.

- [ ] **Paso 9: Crear `herramientas/arrancar.bat`**

```bat
@echo off
setlocal
cd /d "%~dp0.."

start "servidor-espejo" /min cmd /c "node servidor\servidor.js"

timeout /t 2 /nobreak >nul

start "" "C:\Program Files\Google\Chrome\Application\chrome.exe" ^
  --kiosk ^
  --user-data-dir="%~dp0..\.perfil-chrome" ^
  --autoplay-policy=no-user-gesture-required ^
  --use-fake-ui-for-media-stream ^
  --disable-infobars ^
  --disable-session-crashed-bubble ^
  --noerrdialogs ^
  --disable-features=Translate,TranslateUI ^
  "http://localhost:8080/espejo/espejo.html"
```

**Detalle que arruina la instalación si se pasa por alto:** el espejo tiene que abrirse por **`localhost`**, nunca por la IP de la máquina. Chrome sólo entrega la cámara en contextos seguros, y `http://192.168.x.x` no lo es. Las tablets sí van por IP, pero ellas no usan cámara.

`--use-fake-ui-for-media-stream` acepta el permiso de cámara automáticamente. No falsea la cámara: eso sería `--use-fake-device-for-media-stream`, que no queremos.

- [ ] **Paso 10: Verificar el arranque a mano**

Ejecutar `herramientas\arrancar.bat`. Esperado: Chrome abre a pantalla completa, sin barras, en negro, y la consola (F12) muestra `espejo listo`.

- [ ] **Paso 11: Commit**

```bash
git add package.json package-lock.json vitest.config.js .gitignore servidor espejo herramientas tests
git commit -m "feat: servidor local con archivos estaticos y rele WebSocket"
```

---

### Tarea 2: Cámara y detección de rostro en pantalla

El hito de desriesgo. Al terminarla, se ve el video espejado con los ojos y el círculo de la cabeza dibujados encima. Si MediaPipe no rinde en la máquina real, queremos saberlo hoy.

**Archivos:**
- Crear: `herramientas/vendorizar.mjs`, `espejo/config.js`, `espejo/camara.js`, `espejo/rostro.js`
- Modificar: `espejo/main.js`
- Probar: `tests/espejo/camara.test.js`, `tests/espejo/rostro.test.js`

**Interfaces:**
- Consume: el servidor de la Tarea 1.
- Produce:
  - `CONFIG` — objeto con todos los números ajustables del sistema.
  - `crearReintentador({ abrir, reintentoMs, alEstado, dormir })` → `{ obtener(), perdida(), detener() }`
  - `abrirCamara({ ancho, alto, obtenerMedia })` → `Promise<{ video, detener() }>`
  - `mapearRostro(puntos, { ancho, alto, indices, factorRadio, espejar })` → objeto rostro
  - `crearDetectorMediaPipe({ base, ancho, alto })` → `Promise<{ detectar(video, ahora): rostro|null }>`
  - `crearFuenteSintetica({ ancho, alto })` → `{ detectar(ahora): rostro }`
  - Forma del rostro: `{ presente, centro:{x,y}, ojoIzq:{x,y}, ojoDer:{x,y}, radio, angulo, confianza }` o `null`.

- [ ] **Paso 1: Instalar y copiar MediaPipe**

```bash
npm install -D @mediapipe/tasks-vision
```

`herramientas/vendorizar.mjs`:

```js
import { cp, mkdir, readdir } from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const ORIGEN = resolve(RAIZ, 'node_modules/@mediapipe/tasks-vision');
const DESTINO = resolve(RAIZ, 'vendor/mediapipe');
const MODELO =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

await mkdir(DESTINO, { recursive: true });

console.log('Archivos que trae el paquete:');
for (const nombre of await readdir(ORIGEN)) console.log('  -', nombre);

await cp(ORIGEN, DESTINO, { recursive: true });
console.log('Paquete copiado a vendor/mediapipe/');

const respuesta = await fetch(MODELO);
if (!respuesta.ok) throw new Error(`No se pudo bajar el modelo: ${respuesta.status}`);
await pipeline(Readable.fromWeb(respuesta.body), createWriteStream(resolve(DESTINO, 'face_landmarker.task')));
console.log('Modelo guardado en vendor/mediapipe/face_landmarker.task');
```

```bash
npm run vendorizar
```

**Anotá lo que imprime.** El nombre exacto del bundle ES y de la carpeta de WASM sale de ahí, no de este plan: el paquete cambia de versión en versión. Al momento de escribir esto el bundle se llama `vision_bundle.mjs` y los WASM viven en `wasm/`. Si el listado dice otra cosa, mandan los nombres reales y hay que ajustar el `import` del Paso 6.

Si la descarga del modelo falla, bajarlo a mano desde la URL de `MODELO` y dejarlo en `vendor/mediapipe/face_landmarker.task`. Es la única vez en todo el proyecto que hace falta internet.

- [ ] **Paso 2: Crear `espejo/config.js`**

```js
export const CONFIG = {
  tiempos: {
    enganche: 2000,
    sorteo: 3000,
    revelacion: 2000,
    escena: 30000,
    cierre: 4000,
    enfriamiento: 3000,
    ausenciaParaCortar: 3000,
    sesionMaxima: 75000,
  },
  presencia: {
    cuadrosParaEntrar: 6,
    msParaSalir: 400,
  },
  suavizado: {
    posicion: 0.35,
    radio: 0.25,
    angulo: 0.15,
  },
  deteccion: {
    fpsObjetivo: 22,
    anchoCamara: 1280,
    altoCamara: 720,
    factorRadio: 1.6,
    ventanaConfianza: 30,
    indices: {
      ojoIzq: [33, 133],
      ojoDer: [362, 263],
    },
  },
  objetos: {
    maximo: 40,
    intervaloAparicion: 350,
    vidaMs: 12000,
  },
  fisica: {
    gravedad: 1600,
    restitucion: 0.55,
    friccion: 0.98,
  },
  render: {
    anchoReferencia: 1080,
    altoReferencia: 1920,
  },
  operacion: {
    recargaCadaMs: 4 * 60 * 60 * 1000,
  },
  red: {
    puerto: 8080,
    reconexionMs: 2000,
    latidoMs: 2000,
  },
};
```

`deteccion.indices` son los puntos de MediaPipe que se promedian para ubicar cada ojo. Los valores de arriba son los habituales para las esquinas de cada ojo en la malla facial, **pero se verifican a ojo en el Paso 8 antes de seguir.** Si caen en otro lado, se corrigen acá y en ningún otro archivo.

- [ ] **Paso 3: Escribir las pruebas que fallan**

`tests/espejo/rostro.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { mapearRostro, crearMedidorConfianza, crearFuenteSintetica } from '../../espejo/rostro.js';

const OPCIONES = {
  ancho: 1000,
  alto: 500,
  indices: { ojoIzq: [0], ojoDer: [1] },
  factorRadio: 2,
};

describe('mapearRostro', () => {
  it('convierte puntos normalizados a pixeles espejando la x', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: true });

    expect(rostro.ojoIzq).toEqual({ x: 300, y: 200 });
    expect(rostro.ojoDer).toEqual({ x: 700, y: 200 });
    expect(rostro.centro).toEqual({ x: 500, y: 200 });
  });

  it('no espeja cuando se le pide que no', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(rostro.ojoIzq).toEqual({ x: 300, y: 200 });
  });

  it('llama izquierdo al ojo que queda a la izquierda en pantalla, sin importar el indice', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const alDerecho = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    const alReves = mapearRostro(puntos, {
      ...OPCIONES,
      espejar: false,
      indices: { ojoIzq: [1], ojoDer: [0] },
    });
    expect(alReves.ojoIzq).toEqual(alDerecho.ojoIzq);
    expect(alReves.ojoDer).toEqual(alDerecho.ojoDer);
  });

  it('promedia varios puntos por ojo', () => {
    const puntos = [{ x: 0.2, y: 0.4 }, { x: 0.4, y: 0.4 }, { x: 0.6, y: 0.4 }, { x: 0.8, y: 0.4 }];
    const rostro = mapearRostro(puntos, {
      ...OPCIONES,
      espejar: false,
      indices: { ojoIzq: [0, 1], ojoDer: [2, 3] },
    });
    expect(rostro.ojoIzq.x).toBeCloseTo(300);
    expect(rostro.ojoDer.x).toBeCloseTo(700);
  });

  it('deriva el radio de la distancia entre ojos', () => {
    const puntos = [{ x: 0.3, y: 0.4 }, { x: 0.7, y: 0.4 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(rostro.radio).toBeCloseTo(800);
  });

  it('calcula la inclinacion de la cabeza', () => {
    const puntos = [{ x: 0.4, y: 0.2 }, { x: 0.6, y: 0.6 }];
    const rostro = mapearRostro(puntos, { ...OPCIONES, espejar: false });
    expect(rostro.angulo).toBeCloseTo(Math.atan2(200, 200));
  });

  it('devuelve null si no hay puntos', () => {
    expect(mapearRostro([], OPCIONES)).toBeNull();
    expect(mapearRostro(null, OPCIONES)).toBeNull();
  });
});

describe('crearMedidorConfianza', () => {
  it('vale 1 cuando todas las lecturas recientes tienen rostro', () => {
    const medidor = crearMedidorConfianza(4);
    for (let i = 0; i < 4; i++) medidor.registrar(true);
    expect(medidor.valor()).toBe(1);
  });

  it('baja a la mitad con la mitad de las lecturas vacias', () => {
    const medidor = crearMedidorConfianza(4);
    medidor.registrar(true);
    medidor.registrar(false);
    medidor.registrar(true);
    medidor.registrar(false);
    expect(medidor.valor()).toBe(0.5);
  });

  it('olvida lo que queda fuera de la ventana', () => {
    const medidor = crearMedidorConfianza(2);
    medidor.registrar(false);
    medidor.registrar(true);
    medidor.registrar(true);
    expect(medidor.valor()).toBe(1);
  });
});

describe('crearFuenteSintetica', () => {
  it('entrega siempre un rostro valido que se mueve con el tiempo', () => {
    const fuente = crearFuenteSintetica({ ancho: 1080, alto: 1920 });
    const a = fuente.detectar(0);
    const b = fuente.detectar(1200);

    expect(a.presente).toBe(true);
    expect(a.radio).toBeGreaterThan(0);
    expect(a.ojoIzq.x).toBeLessThan(a.ojoDer.x);
    expect(b.centro.x).not.toBeCloseTo(a.centro.x);
  });
});
```

`tests/espejo/camara.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { crearReintentador } from '../../espejo/camara.js';

// Cede el turno al reloj de verdad. Con `Promise.resolve()` el bucle de reintento
// giraría en microtareas y ningún setTimeout del test llegaría a dispararse.
const yaMismo = () => new Promise((ok) => setTimeout(ok, 0));

describe('crearReintentador', () => {
  it('entrega la camara cuando abre a la primera', async () => {
    const camara = { video: 'falso', detener() {} };
    const reintentador = crearReintentador({
      abrir: vi.fn().mockResolvedValue(camara),
      reintentoMs: 1,
      alEstado: () => {},
      dormir: yaMismo,
    });

    await reintentador.listo();
    expect(reintentador.obtener()).toBe(camara);
  });

  it('reintenta hasta conseguirla y avisa cada fracaso', async () => {
    const camara = { video: 'falso', detener() {} };
    const abrir = vi
      .fn()
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockRejectedValueOnce(new Error('NotReadableError'))
      .mockResolvedValue(camara);
    const estados = [];

    const reintentador = crearReintentador({
      abrir,
      reintentoMs: 1,
      alEstado: (e) => estados.push(e),
      dormir: yaMismo,
    });

    await reintentador.listo();
    expect(abrir).toHaveBeenCalledTimes(3);
    expect(reintentador.obtener()).toBe(camara);
    expect(estados.filter((e) => !e.lista)).toHaveLength(2);
    expect(estados.at(-1)).toEqual({ lista: true });
  });

  it('vuelve a abrir cuando se le avisa que la camara se perdio', async () => {
    const primera = { video: 'a', detener: vi.fn() };
    const segunda = { video: 'b', detener: vi.fn() };
    const abrir = vi.fn().mockResolvedValueOnce(primera).mockResolvedValueOnce(segunda);

    const reintentador = crearReintentador({
      abrir, reintentoMs: 1, alEstado: () => {}, dormir: yaMismo,
    });
    await reintentador.listo();

    reintentador.perdida();
    await reintentador.listo();

    expect(reintentador.obtener()).toBe(segunda);
    expect(abrir).toHaveBeenCalledTimes(2);
  });

  it('deja de reintentar despues de detener', async () => {
    const abrir = vi.fn().mockRejectedValue(new Error('sin camara'));
    const reintentador = crearReintentador({
      abrir, reintentoMs: 1, alEstado: () => {}, dormir: yaMismo,
    });

    await new Promise((ok) => setTimeout(ok, 10));
    reintentador.detener();
    const intentosAlDetener = abrir.mock.calls.length;

    await new Promise((ok) => setTimeout(ok, 10));
    expect(abrir.mock.calls.length).toBe(intentosAlDetener);
    expect(reintentador.obtener()).toBeNull();
  });
});
```

- [ ] **Paso 4: Correr las pruebas y confirmar que fallan**

```bash
npm test
```

Esperado: FALLAN por `Failed to resolve import` de `rostro.js` y `camara.js`.

- [ ] **Paso 5: Escribir `espejo/camara.js`**

```js
export async function abrirCamara({ ancho, alto, obtenerMedia }) {
  const flujo = await obtenerMedia({
    video: { width: { ideal: ancho }, height: { ideal: alto }, facingMode: 'user' },
    audio: false,
  });
  const video = document.createElement('video');
  video.srcObject = flujo;
  video.playsInline = true;
  video.muted = true;
  await video.play();
  return { video, detener: () => flujo.getTracks().forEach((pista) => pista.stop()) };
}

export function crearReintentador({ abrir, reintentoMs, alEstado, dormir }) {
  let actual = null;
  let vivo = true;
  let enCurso = null;

  function intentar() {
    enCurso = (async () => {
      while (vivo && !actual) {
        try {
          actual = await abrir();
          if (!vivo) { actual.detener(); actual = null; return; }
          alEstado({ lista: true });
        } catch (error) {
          alEstado({ lista: false, error: String(error) });
          await dormir(reintentoMs);
        }
      }
    })();
    return enCurso;
  }

  intentar();

  return {
    listo: () => enCurso,
    obtener: () => actual,
    perdida: () => {
      actual = null;
      alEstado({ lista: false, error: 'camara perdida' });
      intentar();
    },
    detener: () => {
      vivo = false;
      actual?.detener();
      actual = null;
    },
  };
}

export const dormir = (ms) => new Promise((ok) => setTimeout(ok, ms));
```

`abrirCamara` toca el DOM y por eso no se prueba en Node; el bucle de reintento, que es donde vive la lógica frágil, sí.

- [ ] **Paso 6: Escribir `espejo/rostro.js`**

```js
function promediar(puntos, indices, ancho, alto, espejar) {
  let sumaX = 0;
  let sumaY = 0;
  for (const indice of indices) {
    const punto = puntos[indice];
    sumaX += espejar ? 1 - punto.x : punto.x;
    sumaY += punto.y;
  }
  return { x: (sumaX / indices.length) * ancho, y: (sumaY / indices.length) * alto };
}

export function mapearRostro(puntos, { ancho, alto, indices, factorRadio, espejar = true }) {
  if (!puntos || puntos.length === 0) return null;

  const unoDeLosOjos = promediar(puntos, indices.ojoIzq, ancho, alto, espejar);
  const elOtro = promediar(puntos, indices.ojoDer, ancho, alto, espejar);

  const [ojoIzq, ojoDer] =
    unoDeLosOjos.x <= elOtro.x ? [unoDeLosOjos, elOtro] : [elOtro, unoDeLosOjos];

  const dx = ojoDer.x - ojoIzq.x;
  const dy = ojoDer.y - ojoIzq.y;
  const distancia = Math.hypot(dx, dy);

  return {
    presente: true,
    centro: { x: (ojoIzq.x + ojoDer.x) / 2, y: (ojoIzq.y + ojoDer.y) / 2 },
    ojoIzq,
    ojoDer,
    radio: distancia * factorRadio,
    angulo: Math.atan2(dy, dx),
    confianza: 1,
  };
}

export function crearMedidorConfianza(ventana) {
  const lecturas = [];
  return {
    registrar(huboRostro) {
      lecturas.push(huboRostro ? 1 : 0);
      if (lecturas.length > ventana) lecturas.shift();
    },
    valor() {
      if (lecturas.length === 0) return 0;
      return lecturas.reduce((a, b) => a + b, 0) / lecturas.length;
    },
  };
}

export function crearFuenteSintetica({ ancho, alto }) {
  return {
    detectar(ahora) {
      const t = ahora / 1000;
      const centro = {
        x: ancho / 2 + Math.sin(t * 0.7) * ancho * 0.18,
        y: alto * 0.38 + Math.cos(t * 0.5) * alto * 0.05,
      };
      const mitad = ancho * 0.055;
      const angulo = Math.sin(t * 0.4) * 0.22;
      const dx = Math.cos(angulo) * mitad;
      const dy = Math.sin(angulo) * mitad;
      return {
        presente: true,
        centro,
        ojoIzq: { x: centro.x - dx, y: centro.y - dy },
        ojoDer: { x: centro.x + dx, y: centro.y + dy },
        radio: mitad * 2 * 1.6,
        angulo,
        confianza: 1,
      };
    },
  };
}

export async function crearDetectorMediaPipe({ base, ancho, alto, indices, factorRadio, ventanaConfianza }) {
  const { FaceLandmarker, FilesetResolver } = await import(`${base}/vision_bundle.mjs`);
  const recursos = await FilesetResolver.forVisionTasks(`${base}/wasm`);
  const detector = await FaceLandmarker.createFromOptions(recursos, {
    baseOptions: { modelAssetPath: `${base}/face_landmarker.task`, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numFaces: 1,
  });

  const medidor = crearMedidorConfianza(ventanaConfianza);

  return {
    detectar(video, ahora) {
      const salida = detector.detectForVideo(video, ahora);
      const puntos = salida?.faceLandmarks?.[0];
      medidor.registrar(Boolean(puntos));
      if (!puntos) return null;
      const rostro = mapearRostro(puntos, { ancho, alto, indices, factorRadio, espejar: true });
      if (rostro) rostro.confianza = medidor.valor();
      return rostro;
    },
    cerrar: () => detector.close(),
  };
}
```

Ordenar los dos ojos por su x en pantalla elimina de raíz la duda de cuál índice de MediaPipe es el ojo izquierdo. Después del espejado, el izquierdo es el que quedó a la izquierda, y punto. Lo único que queda por verificar a ojo es que los índices caigan sobre ojos.

Si el listado del Paso 1 mostró otro nombre de bundle o de carpeta WASM, ajustar las dos rutas del `import` y de `forVisionTasks`.

- [ ] **Paso 7: Correr las pruebas y confirmar que pasan**

```bash
npm test
```

Esperado: PASAN las de `rostro` y `camara`, además de las de la Tarea 1.

- [ ] **Paso 8: Escribir `espejo/main.js` de verificación visual**

```js
import { CONFIG } from './config.js';
import { abrirCamara, crearReintentador, dormir } from './camara.js';
import { crearDetectorMediaPipe } from './rostro.js';

const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');

function ajustarLienzo() {
  lienzo.width = window.innerWidth;
  lienzo.height = window.innerHeight;
}
ajustarLienzo();
window.addEventListener('resize', ajustarLienzo);

const camara = crearReintentador({
  abrir: () =>
    abrirCamara({
      ancho: CONFIG.deteccion.anchoCamara,
      alto: CONFIG.deteccion.altoCamara,
      obtenerMedia: (r) => navigator.mediaDevices.getUserMedia(r),
    }),
  reintentoMs: 5000,
  alEstado: (estado) => console.log('camara:', estado),
  dormir,
});

const detector = await crearDetectorMediaPipe({
  base: '/vendor/mediapipe',
  ancho: lienzo.width,
  alto: lienzo.height,
  indices: CONFIG.deteccion.indices,
  factorRadio: CONFIG.deteccion.factorRadio,
  ventanaConfianza: CONFIG.deteccion.ventanaConfianza,
});

let ultimoRostro = null;
let ultimaDeteccion = 0;
const intervaloDeteccion = 1000 / CONFIG.deteccion.fpsObjetivo;

function cuadro(ahora) {
  const camaraLista = camara.obtener();
  ctx.clearRect(0, 0, lienzo.width, lienzo.height);

  if (camaraLista) {
    const video = camaraLista.video;

    ctx.save();
    ctx.translate(lienzo.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    ctx.restore();

    if (ahora - ultimaDeteccion >= intervaloDeteccion) {
      ultimaDeteccion = ahora;
      ultimoRostro = detector.detectar(video, ahora);
    }

    if (ultimoRostro) {
      const { ojoIzq, ojoDer, centro, radio, angulo, confianza } = ultimoRostro;

      ctx.strokeStyle = '#00E5A0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#FF5D8F';
      for (const ojo of [ojoIzq, ojoDer]) {
        ctx.beginPath();
        ctx.arc(ojo.x, ojo.y, 10, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.strokeStyle = '#FFD23F';
      ctx.beginPath();
      ctx.moveTo(ojoIzq.x, ojoIzq.y);
      ctx.lineTo(ojoDer.x, ojoDer.y);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '28px monospace';
      ctx.fillText(
        `angulo ${(angulo * 180 / Math.PI).toFixed(1)}°  radio ${radio.toFixed(0)}  confianza ${confianza.toFixed(2)}`,
        24, 48,
      );
    }
  } else {
    ctx.fillStyle = '#fff';
    ctx.font = '32px monospace';
    ctx.fillText('esperando camara…', 24, 60);
  }

  requestAnimationFrame(cuadro);
}

requestAnimationFrame(cuadro);
```

- [ ] **Paso 9: Verificar a ojo — este paso decide si el resto del plan se sostiene**

Correr `herramientas\arrancar.bat` y sentarse frente a la cámara. Confirmar las cinco cosas:

1. **La imagen se comporta como espejo.** Levantás la mano derecha y en pantalla sube la mano del mismo lado que verías en un espejo de baño.
2. **Los dos puntos rosados caen sobre los ojos**, no sobre las cejas ni sobre la nariz. Si no, corregir `CONFIG.deteccion.indices` y volver a mirar. Es el único lugar donde se tocan.
3. **Al mover la cabeza a la izquierda, los puntos se van a la izquierda.** Si se van al lado contrario, el espejado de la x está mal aplicado.
4. **Al inclinar la cabeza, el ángulo cambia de signo de forma coherente** y la línea amarilla acompaña la inclinación.
5. **El círculo verde cubre la cabeza** sin quedar chico ni desbordar. Ajustar `factorRadio` si hace falta.

Anotar también los FPS en la máquina real (`Rendimiento` de las herramientas de desarrollo). Si baja de 30, bajar `anchoCamara`/`altoCamara` a 640×480 antes de tocar cualquier otra cosa.

- [ ] **Paso 10: Commit**

```bash
git add espejo herramientas tests package.json package-lock.json
git commit -m "feat: camara con reintento y deteccion de rostro con MediaPipe"
```

---

### Tarea 3: Suavizado e histéresis de presencia

Sin esto el accesorio vibra sobre la cabeza y la experiencia parpadea cada vez que alguien gira la cara. Es media hora de trabajo y es la diferencia entre un prototipo y una instalación.

**Archivos:**
- Crear: `espejo/suavizado.js`
- Modificar: `espejo/main.js`
- Probar: `tests/espejo/suavizado.test.js`

**Interfaces:**
- Consume: la forma de rostro de la Tarea 2.
- Produce:
  - `crearFiltroExponencial(alfa)` → `{ filtrar(n): number|null, reiniciar(), valor() }`
  - `crearFiltroRostro({ posicion, radio, angulo })` → `{ filtrar(rostro|null): rostro|null, reiniciar() }`
  - `crearHisteresis({ cuadrosParaEntrar, msParaSalir })` → `{ actualizar(hayRostro, ahora): boolean, presente(): boolean }`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tests/espejo/suavizado.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearFiltroExponencial, crearFiltroRostro, crearHisteresis } from '../../espejo/suavizado.js';

const rostroEn = (x) => ({
  presente: true,
  centro: { x, y: 100 },
  ojoIzq: { x: x - 50, y: 100 },
  ojoDer: { x: x + 50, y: 100 },
  radio: 160,
  angulo: 0,
  confianza: 1,
});

describe('crearFiltroExponencial', () => {
  it('toma el primer valor tal cual', () => {
    const filtro = crearFiltroExponencial(0.5);
    expect(filtro.filtrar(10)).toBe(10);
  });

  it('se acerca al nuevo valor segun alfa, sin llegar de golpe', () => {
    const filtro = crearFiltroExponencial(0.5);
    filtro.filtrar(0);
    expect(filtro.filtrar(100)).toBe(50);
    expect(filtro.filtrar(100)).toBe(75);
  });

  it('un alfa mas chico responde mas lento', () => {
    const lento = crearFiltroExponencial(0.1);
    const rapido = crearFiltroExponencial(0.9);
    lento.filtrar(0);
    rapido.filtrar(0);
    expect(lento.filtrar(100)).toBeLessThan(rapido.filtrar(100));
  });

  it('conserva el ultimo valor si le llega null', () => {
    const filtro = crearFiltroExponencial(0.5);
    filtro.filtrar(42);
    expect(filtro.filtrar(null)).toBe(42);
  });

  it('vuelve a arrancar de cero despues de reiniciar', () => {
    const filtro = crearFiltroExponencial(0.5);
    filtro.filtrar(0);
    filtro.reiniciar();
    expect(filtro.filtrar(100)).toBe(100);
  });
});

describe('crearFiltroRostro', () => {
  it('suaviza el desplazamiento en vez de saltar', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));
    const suavizado = filtro.filtrar(rostroEn(300));

    expect(suavizado.centro.x).toBe(200);
    expect(suavizado.ojoIzq.x).toBe(150);
    expect(suavizado.ojoDer.x).toBe(250);
  });

  it('devuelve null sin tocar el estado cuando no hay rostro', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));
    expect(filtro.filtrar(null)).toBeNull();
    expect(filtro.filtrar(rostroEn(300)).centro.x).toBe(200);
  });

  it('despues de reiniciar toma la posicion nueva sin arrastrar la anterior', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    filtro.filtrar(rostroEn(100));
    filtro.reiniciar();
    expect(filtro.filtrar(rostroEn(900)).centro.x).toBe(900);
  });

  it('conserva los campos que no se filtran', () => {
    const filtro = crearFiltroRostro({ posicion: 0.5, radio: 0.5, angulo: 0.5 });
    const salida = filtro.filtrar({ ...rostroEn(100), confianza: 0.73 });
    expect(salida.presente).toBe(true);
    expect(salida.confianza).toBe(0.73);
  });
});

describe('crearHisteresis', () => {
  const opciones = { cuadrosParaEntrar: 3, msParaSalir: 400 };

  it('no declara presencia antes de acumular los cuadros pedidos', () => {
    const h = crearHisteresis(opciones);
    expect(h.actualizar(true, 0)).toBe(false);
    expect(h.actualizar(true, 30)).toBe(false);
    expect(h.actualizar(true, 60)).toBe(true);
  });

  it('un cuadro perdido no corta la presencia si el rostro vuelve enseguida', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);
    expect(h.actualizar(false, 90)).toBe(true);
    expect(h.actualizar(true, 120)).toBe(true);
  });

  it('declara ausencia recien pasado msParaSalir', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);
    expect(h.actualizar(false, 100)).toBe(true);
    expect(h.actualizar(false, 400)).toBe(true);
    expect(h.actualizar(false, 501)).toBe(false);
  });

  it('exige acumular los cuadros de nuevo despues de una ausencia', () => {
    const h = crearHisteresis(opciones);
    for (const t of [0, 30, 60]) h.actualizar(true, t);
    h.actualizar(false, 100);
    h.actualizar(false, 600);
    expect(h.presente()).toBe(false);

    expect(h.actualizar(true, 700)).toBe(false);
    expect(h.actualizar(true, 730)).toBe(false);
    expect(h.actualizar(true, 760)).toBe(true);
  });

  it('arranca en ausente', () => {
    expect(crearHisteresis(opciones).presente()).toBe(false);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
npm test -- suavizado
```

Esperado: FALLA con `Failed to resolve import "../../espejo/suavizado.js"`.

- [ ] **Paso 3: Escribir `espejo/suavizado.js`**

```js
export function crearFiltroExponencial(alfa) {
  let valor = null;
  return {
    filtrar(nuevo) {
      if (nuevo === null || nuevo === undefined) return valor;
      valor = valor === null ? nuevo : valor + alfa * (nuevo - valor);
      return valor;
    },
    reiniciar() {
      valor = null;
    },
    valor: () => valor,
  };
}

export function crearFiltroRostro({ posicion, radio, angulo }) {
  const filtros = {
    centroX: crearFiltroExponencial(posicion),
    centroY: crearFiltroExponencial(posicion),
    izqX: crearFiltroExponencial(posicion),
    izqY: crearFiltroExponencial(posicion),
    derX: crearFiltroExponencial(posicion),
    derY: crearFiltroExponencial(posicion),
    radio: crearFiltroExponencial(radio),
    angulo: crearFiltroExponencial(angulo),
  };

  return {
    filtrar(rostro) {
      if (!rostro) return null;
      return {
        ...rostro,
        centro: {
          x: filtros.centroX.filtrar(rostro.centro.x),
          y: filtros.centroY.filtrar(rostro.centro.y),
        },
        ojoIzq: {
          x: filtros.izqX.filtrar(rostro.ojoIzq.x),
          y: filtros.izqY.filtrar(rostro.ojoIzq.y),
        },
        ojoDer: {
          x: filtros.derX.filtrar(rostro.ojoDer.x),
          y: filtros.derY.filtrar(rostro.ojoDer.y),
        },
        radio: filtros.radio.filtrar(rostro.radio),
        angulo: filtros.angulo.filtrar(rostro.angulo),
      };
    },
    reiniciar() {
      for (const filtro of Object.values(filtros)) filtro.reiniciar();
    },
  };
}

export function crearHisteresis({ cuadrosParaEntrar, msParaSalir }) {
  let presente = false;
  let seguidos = 0;
  let desdeQueFalta = null;

  return {
    actualizar(hayRostro, ahora) {
      if (hayRostro) {
        desdeQueFalta = null;
        seguidos += 1;
        if (!presente && seguidos >= cuadrosParaEntrar) presente = true;
      } else {
        seguidos = 0;
        if (presente) {
          if (desdeQueFalta === null) desdeQueFalta = ahora;
          if (ahora - desdeQueFalta > msParaSalir) {
            presente = false;
            desdeQueFalta = null;
          }
        }
      }
      return presente;
    },
    presente: () => presente,
  };
}
```

El ángulo se filtra sin cuidar el salto de −π a π: la cabeza de alguien sentado se inclina como mucho medio radián, así que el caso no se da. Si algún día se detectaran cabezas invertidas, habría que interpolar por seno y coseno.

- [ ] **Paso 4: Correr y confirmar que pasan**

```bash
npm test
```

Esperado: PASAN todas.

- [ ] **Paso 5: Enchufar el suavizado en `main.js`**

Agregar los imports y crear los dos objetos junto al detector:

```js
import { crearFiltroRostro, crearHisteresis } from './suavizado.js';

const filtro = crearFiltroRostro(CONFIG.suavizado);
const histeresis = crearHisteresis(CONFIG.presencia);
```

Y reemplazar el bloque de detección dentro de `cuadro()` por:

```js
    if (ahora - ultimaDeteccion >= intervaloDeteccion) {
      ultimaDeteccion = ahora;
      const crudo = detector.detectar(video, ahora);
      const habiaPresencia = histeresis.presente();
      const hayPresencia = histeresis.actualizar(Boolean(crudo), ahora);

      if (habiaPresencia && !hayPresencia) filtro.reiniciar();
      ultimoRostro = hayPresencia ? filtro.filtrar(crudo) : null;
    }
```

Reiniciar el filtro al perder la presencia es lo que evita que el accesorio se deslice por la pantalla cuando se sienta la persona siguiente.

- [ ] **Paso 6: Verificar a ojo**

Correr `arrancar.bat`. Confirmar:
1. El círculo verde ya no vibra cuando estás quieto.
2. Tapate la cara con la mano medio segundo y destapala: el círculo no parpadea.
3. Salí de cuadro y volvé: el círculo aparece en tu cara nueva, no viene deslizándose desde donde estaba antes.

- [ ] **Paso 7: Commit**

```bash
git add espejo/suavizado.js espejo/main.js tests/espejo/suavizado.test.js
git commit -m "feat: suavizado del rostro e histeresis de presencia"
```

---

### Tarea 4: Contenido y su validación

**Archivos:**
- Crear: `espejo/contenido.js`, `contenido/carreras.json`, `contenido/assets/<carrera>/.gitkeep`
- Probar: `tests/espejo/contenido.test.js`

**Interfaces:**
- Consume: nada.
- Produce:
  - `validarContenido(datos)` → `string[]` (vacío si está bien)
  - `cargarContenido({ ruta, traer })` → `Promise<{ carreras, ids, obtener(id), todasLasImagenes() }>`
  - Forma de una carrera: `{ id, nombre, color, frase, accesorio: { img, anclaOjoIzq, anclaOjoDer, offsetY }, objetos: [{ img, escala, peso }], referentes: [{ video, nombre, detalle }] }`

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/espejo/contenido.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { validarContenido, cargarContenido } from '../../espejo/contenido.js';

const carreraValida = () => ({
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  frase: 'Construís lo que queda de pie',
  accesorio: { img: 'assets/civil/casco.png', anclaOjoIzq: [0.3, 0.7], anclaOjoDer: [0.7, 0.7], offsetY: -0.4 },
  objetos: [{ img: 'assets/civil/grua.png', escala: 0.2, peso: 1 }],
  referentes: [{ video: 'videos/civil/ana.mp4', nombre: 'Ana Pérez', detalle: 'Egresada' }],
});

const sinErrores = (datos) => expect(validarContenido(datos)).toEqual([]);
const conError = (datos, fragmento) =>
  expect(validarContenido(datos).join(' | ')).toContain(fragmento);

describe('validarContenido', () => {
  it('acepta una carrera bien formada', () => {
    sinErrores({ carreras: [carreraValida()] });
  });

  it('rechaza un archivo sin carreras', () => {
    conError({}, 'arreglo "carreras"');
    conError({ carreras: [] }, 'arreglo "carreras"');
  });

  it('exige id, nombre y color', () => {
    conError({ carreras: [{ ...carreraValida(), id: undefined }] }, 'falta "id"');
    conError({ carreras: [{ ...carreraValida(), nombre: undefined }] }, 'falta "nombre"');
    conError({ carreras: [{ ...carreraValida(), color: 'naranja' }] }, '#rrggbb');
  });

  it('rechaza ids repetidos', () => {
    conError({ carreras: [carreraValida(), carreraValida()] }, 'repetido');
  });

  it('exige los dos anclajes del accesorio dentro de 0 a 1', () => {
    const roto = carreraValida();
    roto.accesorio.anclaOjoDer = [1.4, 0.7];
    conError({ carreras: [roto] }, 'entre 0 y 1');

    const faltante = carreraValida();
    delete faltante.accesorio.anclaOjoIzq;
    conError({ carreras: [faltante] }, 'anclaOjoIzq');
  });

  it('rechaza dos anclajes en el mismo punto, que darian escala infinita', () => {
    const roto = carreraValida();
    roto.accesorio.anclaOjoDer = [...roto.accesorio.anclaOjoIzq];
    conError({ carreras: [roto] }, 'mismo punto');
  });

  it('exige al menos un objeto con escala positiva', () => {
    conError({ carreras: [{ ...carreraValida(), objetos: [] }] }, '"objetos" vacio');
    conError(
      { carreras: [{ ...carreraValida(), objetos: [{ img: 'a.png', escala: 0 }] }] },
      'mayor que cero',
    );
  });

  it('exige al menos una referente con video y nombre', () => {
    conError({ carreras: [{ ...carreraValida(), referentes: [] }] }, '"referentes" vacio');
    conError(
      { carreras: [{ ...carreraValida(), referentes: [{ nombre: 'Ana' }] }] },
      'sin "video"',
    );
  });

  it('nombra la carrera en el mensaje para que se sepa cual arreglar', () => {
    conError({ carreras: [{ ...carreraValida(), nombre: undefined }] }, '(civil)');
  });
});

describe('cargarContenido', () => {
  const traerCon = (datos, ok = true) => async () => ({
    ok,
    status: ok ? 200 : 404,
    json: async () => datos,
  });

  it('devuelve las carreras y un buscador por id', async () => {
    const contenido = await cargarContenido({ traer: traerCon({ carreras: [carreraValida()] }) });
    expect(contenido.ids).toEqual(['civil']);
    expect(contenido.obtener('civil').nombre).toBe('Ingeniería Civil');
    expect(contenido.obtener('nada')).toBeNull();
  });

  it('junta todas las rutas de imagen para precargarlas', async () => {
    const contenido = await cargarContenido({ traer: traerCon({ carreras: [carreraValida()] }) });
    expect(contenido.todasLasImagenes()).toEqual([
      'assets/civil/casco.png',
      'assets/civil/grua.png',
    ]);
  });

  it('falla con un mensaje que enumera todos los problemas', async () => {
    const roto = { carreras: [{ ...carreraValida(), nombre: undefined, color: 'azul' }] };
    await expect(cargarContenido({ traer: traerCon(roto) })).rejects.toThrow(/falta "nombre"/);
    await expect(cargarContenido({ traer: traerCon(roto) })).rejects.toThrow(/#rrggbb/);
  });

  it('falla si el archivo no esta', async () => {
    await expect(cargarContenido({ traer: traerCon(null, false) })).rejects.toThrow(/404/);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- contenido
```

Esperado: FALLA por import sin resolver.

- [ ] **Paso 3: Escribir `espejo/contenido.js`**

```js
const esPunto = (p) =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && v >= 0 && v <= 1);

export function validarContenido(datos) {
  if (!datos || !Array.isArray(datos.carreras) || datos.carreras.length === 0) {
    return ['carreras.json necesita un arreglo "carreras" con al menos una entrada'];
  }

  const errores = [];
  const vistos = new Set();

  datos.carreras.forEach((carrera, i) => {
    const donde = `carreras[${i}]${carrera?.id ? ` (${carrera.id})` : ''}`;

    if (!carrera.id) errores.push(`${donde}: falta "id"`);
    else if (vistos.has(carrera.id)) errores.push(`${donde}: "id" repetido`);
    else vistos.add(carrera.id);

    if (!carrera.nombre) errores.push(`${donde}: falta "nombre"`);
    if (!/^#[0-9a-fA-F]{6}$/.test(carrera.color ?? '')) {
      errores.push(`${donde}: "color" tiene que ser #rrggbb`);
    }

    const accesorio = carrera.accesorio;
    if (!accesorio?.img) errores.push(`${donde}: falta "accesorio.img"`);
    for (const clave of ['anclaOjoIzq', 'anclaOjoDer']) {
      if (!esPunto(accesorio?.[clave])) {
        errores.push(`${donde}: "accesorio.${clave}" tiene que ser [x, y] con valores entre 0 y 1`);
      }
    }
    if (
      esPunto(accesorio?.anclaOjoIzq) &&
      esPunto(accesorio?.anclaOjoDer) &&
      accesorio.anclaOjoIzq[0] === accesorio.anclaOjoDer[0] &&
      accesorio.anclaOjoIzq[1] === accesorio.anclaOjoDer[1]
    ) {
      errores.push(`${donde}: los dos anclajes del accesorio caen en el mismo punto`);
    }

    if (!Array.isArray(carrera.objetos) || carrera.objetos.length === 0) {
      errores.push(`${donde}: "objetos" vacio`);
    } else {
      carrera.objetos.forEach((objeto, j) => {
        if (!objeto.img) errores.push(`${donde}: objetos[${j}] sin "img"`);
        if (typeof objeto.escala !== 'number' || objeto.escala <= 0) {
          errores.push(`${donde}: objetos[${j}] "escala" tiene que ser un numero mayor que cero`);
        }
      });
    }

    if (!Array.isArray(carrera.referentes) || carrera.referentes.length === 0) {
      errores.push(`${donde}: "referentes" vacio`);
    } else {
      carrera.referentes.forEach((referente, j) => {
        if (!referente.video) errores.push(`${donde}: referentes[${j}] sin "video"`);
        if (!referente.nombre) errores.push(`${donde}: referentes[${j}] sin "nombre"`);
      });
    }
  });

  return errores;
}

export async function cargarContenido({ ruta = '/contenido/carreras.json', traer = fetch } = {}) {
  const respuesta = await traer(ruta);
  if (!respuesta.ok) throw new Error(`No se pudo leer ${ruta}: ${respuesta.status}`);

  const datos = await respuesta.json();
  const errores = validarContenido(datos);
  if (errores.length > 0) {
    throw new Error(`carreras.json invalido:\n  - ${errores.join('\n  - ')}`);
  }

  const porId = new Map(datos.carreras.map((carrera) => [carrera.id, carrera]));

  return {
    carreras: datos.carreras,
    ids: datos.carreras.map((carrera) => carrera.id),
    obtener: (id) => porId.get(id) ?? null,
    todasLasImagenes: () =>
      datos.carreras.flatMap((carrera) => [
        carrera.accesorio.img,
        ...carrera.objetos.map((objeto) => objeto.img),
      ]),
  };
}
```

Nombrar la carrera en cada mensaje de error importa: a las ocho de la mañana del día del evento, `carreras[3] (quimica): objetos[5] sin "img"` se arregla en veinte segundos y `contenido inválido` no se arregla nunca.

- [ ] **Paso 4: Crear `contenido/carreras.json` con las seis carreras**

Los PNG todavía no existen. Se declaran igual: el banco de imágenes de la Tarea 10 dibuja una figura del color de la carrera cuando falta un archivo, así que todo el sistema se puede desarrollar y probar antes de que diseño entregue nada.

```json
{
  "carreras": [
    {
      "id": "mecanica",
      "nombre": "Ingeniería Mecánica",
      "color": "#4FC3F7",
      "frase": "Hacés que las cosas se muevan",
      "accesorio": { "img": "assets/mecanica/antiparras.png", "anclaOjoIzq": [0.3, 0.5], "anclaOjoDer": [0.7, 0.5], "offsetY": 0 },
      "objetos": [
        { "img": "assets/mecanica/engranaje.png", "escala": 0.18, "peso": 1 },
        { "img": "assets/mecanica/llave.png", "escala": 0.2, "peso": 1 },
        { "img": "assets/mecanica/piston.png", "escala": 0.17, "peso": 1 },
        { "img": "assets/mecanica/resorte.png", "escala": 0.15, "peso": 1 },
        { "img": "assets/mecanica/rodamiento.png", "escala": 0.14, "peso": 1 },
        { "img": "assets/mecanica/motor.png", "escala": 0.22, "peso": 1 }
      ],
      "referentes": []
    },
    {
      "id": "electrica",
      "nombre": "Ingeniería Eléctrica",
      "color": "#FFD23F",
      "frase": "Movés la energía que mueve todo lo demás",
      "accesorio": { "img": "assets/electrica/casco-visor.png", "anclaOjoIzq": [0.3, 0.6], "anclaOjoDer": [0.7, 0.6], "offsetY": -0.3 },
      "objetos": [
        { "img": "assets/electrica/rayo.png", "escala": 0.18, "peso": 1 },
        { "img": "assets/electrica/resistencia.png", "escala": 0.14, "peso": 1 },
        { "img": "assets/electrica/lampara.png", "escala": 0.17, "peso": 1 },
        { "img": "assets/electrica/bateria.png", "escala": 0.16, "peso": 1 },
        { "img": "assets/electrica/panel-solar.png", "escala": 0.22, "peso": 1 },
        { "img": "assets/electrica/onda.png", "escala": 0.2, "peso": 1 }
      ],
      "referentes": []
    },
    {
      "id": "computacion",
      "nombre": "Ingeniería en Computación",
      "color": "#00E5A0",
      "frase": "Programás lo que todavía no existe",
      "accesorio": { "img": "assets/computacion/gafas-vr.png", "anclaOjoIzq": [0.28, 0.52], "anclaOjoDer": [0.72, 0.52], "offsetY": 0 },
      "objetos": [
        { "img": "assets/computacion/laptop.png", "escala": 0.2, "peso": 1 },
        { "img": "assets/computacion/robot.png", "escala": 0.22, "peso": 1 },
        { "img": "assets/computacion/chip.png", "escala": 0.15, "peso": 1 },
        { "img": "assets/computacion/llaves.png", "escala": 0.14, "peso": 1 },
        { "img": "assets/computacion/servidor.png", "escala": 0.19, "peso": 1 },
        { "img": "assets/computacion/dron.png", "escala": 0.21, "peso": 1 }
      ],
      "referentes": []
    },
    {
      "id": "fisico-matematico",
      "nombre": "Ingeniería Físico-Matemática",
      "color": "#A78BFA",
      "frase": "Le encontrás la forma a lo que parece caos",
      "accesorio": { "img": "assets/fisico-matematico/orbitas.png", "anclaOjoIzq": [0.32, 0.62], "anclaOjoDer": [0.68, 0.62], "offsetY": -0.2 },
      "objetos": [
        { "img": "assets/fisico-matematico/pi.png", "escala": 0.16, "peso": 1 },
        { "img": "assets/fisico-matematico/sumatoria.png", "escala": 0.16, "peso": 1 },
        { "img": "assets/fisico-matematico/integral.png", "escala": 0.16, "peso": 1 },
        { "img": "assets/fisico-matematico/atomo.png", "escala": 0.19, "peso": 1 },
        { "img": "assets/fisico-matematico/prisma.png", "escala": 0.2, "peso": 1 },
        { "img": "assets/fisico-matematico/curva.png", "escala": 0.18, "peso": 1 }
      ],
      "referentes": []
    },
    {
      "id": "civil",
      "nombre": "Ingeniería Civil",
      "color": "#FF8A3D",
      "frase": "Construís lo que queda de pie",
      "accesorio": { "img": "assets/civil/casco.png", "anclaOjoIzq": [0.3, 0.72], "anclaOjoDer": [0.7, 0.72], "offsetY": -0.45 },
      "objetos": [
        { "img": "assets/civil/grua.png", "escala": 0.24, "peso": 1 },
        { "img": "assets/civil/puente.png", "escala": 0.24, "peso": 1 },
        { "img": "assets/civil/plano.png", "escala": 0.18, "peso": 1 },
        { "img": "assets/civil/teodolito.png", "escala": 0.19, "peso": 1 },
        { "img": "assets/civil/ladrillo.png", "escala": 0.14, "peso": 1 },
        { "img": "assets/civil/viga.png", "escala": 0.22, "peso": 1 }
      ],
      "referentes": []
    },
    {
      "id": "quimica",
      "nombre": "Ingeniería Química",
      "color": "#FF5D8F",
      "frase": "Transformás una cosa en otra",
      "accesorio": { "img": "assets/quimica/antiparras-lab.png", "anclaOjoIzq": [0.3, 0.5], "anclaOjoDer": [0.7, 0.5], "offsetY": 0 },
      "objetos": [
        { "img": "assets/quimica/matraz.png", "escala": 0.19, "peso": 1 },
        { "img": "assets/quimica/tubo.png", "escala": 0.15, "peso": 1 },
        { "img": "assets/quimica/molecula.png", "escala": 0.2, "peso": 1 },
        { "img": "assets/quimica/mechero.png", "escala": 0.17, "peso": 1 },
        { "img": "assets/quimica/pipeta.png", "escala": 0.15, "peso": 1 },
        { "img": "assets/quimica/gota.png", "escala": 0.13, "peso": 1 }
      ],
      "referentes": []
    }
  ]
}
```

**Ojo:** `referentes` está vacío en las seis, y el validador exige al menos una. Es a propósito: obliga a completarlo antes de que el sistema arranque. Para desarrollar mientras tanto, agregá en cada carrera una entrada provisoria:

```json
"referentes": [{ "video": "videos/mecanica/prueba.mp4", "nombre": "Nombre Apellido", "detalle": "Estudiante" }]
```

Se reemplazan con los datos reales cuando lleguen las animaciones. La Tarea 15 verifica que ninguno quede como `Nombre Apellido`.

- [ ] **Paso 5: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 6: Commit**

```bash
git add espejo/contenido.js contenido tests/espejo/contenido.test.js
git commit -m "feat: carga y validacion de las seis carreras"
```

---

### Tarea 5: Sorteo con bolsa barajada

**Archivos:**
- Crear: `espejo/sorteo.js`
- Probar: `tests/espejo/sorteo.test.js`

**Interfaces:**
- Consume: `contenido.ids` de la Tarea 4.
- Produce:
  - `barajar(lista, azar)` → nuevo arreglo mezclado, sin mutar el original
  - `crearSorteo({ ids, mezclar })` → `{ siguiente(): string, restantes(): number }`
  - `mezclar` es inyectable para las pruebas; por defecto usa `barajar` con `Math.random`.

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/espejo/sorteo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { barajar, crearSorteo } from '../../espejo/sorteo.js';

const IDS = ['mecanica', 'electrica', 'computacion', 'fisico-matematico', 'civil', 'quimica'];

describe('barajar', () => {
  it('devuelve los mismos elementos sin repetir ni perder ninguno', () => {
    const salida = barajar(IDS, Math.random);
    expect(salida).toHaveLength(IDS.length);
    expect([...salida].sort()).toEqual([...IDS].sort());
  });

  it('no toca el arreglo original', () => {
    const original = [...IDS];
    barajar(IDS, Math.random);
    expect(IDS).toEqual(original);
  });

  it('es determinista con un azar determinista', () => {
    const a = barajar(IDS, () => 0.5);
    const b = barajar(IDS, () => 0.5);
    expect(a).toEqual(b);
  });
});

describe('crearSorteo', () => {
  it('entrega las seis carreras antes de repetir ninguna', () => {
    const sorteo = crearSorteo({ ids: IDS });
    const salidas = IDS.map(() => sorteo.siguiente());
    expect(new Set(salidas).size).toBe(6);
  });

  it('sigue sin repetir en la segunda vuelta completa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    IDS.forEach(() => sorteo.siguiente());
    const segunda = IDS.map(() => sorteo.siguiente());
    expect(new Set(segunda).size).toBe(6);
  });

  it('evita que la primera de una bolsa repita la ultima de la anterior', () => {
    const bolsas = [
      ['a', 'b', 'c'],
      ['c', 'a', 'b'],
    ];
    let i = 0;
    const sorteo = crearSorteo({ ids: ['a', 'b', 'c'], mezclar: () => bolsas[i++] });

    expect(sorteo.siguiente()).toBe('a');
    expect(sorteo.siguiente()).toBe('b');
    expect(sorteo.siguiente()).toBe('c');
    expect(sorteo.siguiente()).not.toBe('c');
  });

  it('cuenta cuantas quedan en la bolsa', () => {
    const sorteo = crearSorteo({ ids: IDS });
    expect(sorteo.restantes()).toBe(0);
    sorteo.siguiente();
    expect(sorteo.restantes()).toBe(5);
  });

  it('con una sola carrera la devuelve siempre', () => {
    const sorteo = crearSorteo({ ids: ['civil'] });
    expect([sorteo.siguiente(), sorteo.siguiente()]).toEqual(['civil', 'civil']);
  });

  it('protesta si no hay carreras', () => {
    expect(() => crearSorteo({ ids: [] })).toThrow(/al menos una carrera/);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- sorteo
```

- [ ] **Paso 3: Escribir `espejo/sorteo.js`**

```js
export function barajar(lista, azar) {
  const mezclada = [...lista];
  for (let i = mezclada.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1));
    [mezclada[i], mezclada[j]] = [mezclada[j], mezclada[i]];
  }
  return mezclada;
}

export function crearSorteo({ ids, mezclar = (lista) => barajar(lista, Math.random) }) {
  if (!ids || ids.length === 0) throw new Error('El sorteo necesita al menos una carrera');

  let bolsa = [];
  let ultima = null;

  function llenar() {
    const nueva = mezclar(ids);
    if (nueva.length > 1 && nueva[0] === ultima) {
      [nueva[0], nueva[nueva.length - 1]] = [nueva[nueva.length - 1], nueva[0]];
    }
    bolsa = nueva;
  }

  return {
    siguiente() {
      if (bolsa.length === 0) llenar();
      ultima = bolsa.shift();
      return ultima;
    },
    restantes: () => bolsa.length,
  };
}
```

- [ ] **Paso 4: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 5: Commit**

```bash
git add espejo/sorteo.js tests/espejo/sorteo.test.js
git commit -m "feat: sorteo con bolsa barajada sin repeticiones"
```

---

### Tarea 6: Anclaje del accesorio

**Archivos:**
- Crear: `espejo/anclaje.js`
- Probar: `tests/espejo/anclaje.test.js`

**Interfaces:**
- Consume: la forma de rostro (Tarea 2) y `accesorio` de una carrera (Tarea 4).
- Produce: `calcularAnclaje(rostro, accesorio, imagen)` → `{ x, y, angulo, escala, anclaX, anclaY }` o `null`.
  - `imagen` es `{ ancho, alto }` en píxeles del PNG.
  - `x, y` es dónde va, en pantalla, el punto medio entre los dos anclajes del dibujo.
  - `anclaX, anclaY` es ese mismo punto medio, en píxeles del dibujo.
  - `offsetY` se mide en múltiplos de la distancia entre ojos y se aplica sobre el eje vertical **de la cabeza**, no de la pantalla: así un casco sigue quedando sobre la frente aunque la persona incline la cabeza.
  - Se dibuja así: `translate(x, y)` → `rotate(angulo)` → `scale(escala, escala)` → `drawImage(img, -anclaX, -anclaY)`.

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/espejo/anclaje.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { calcularAnclaje } from '../../espejo/anclaje.js';

const IMAGEN = { ancho: 400, alto: 200 };
const ACCESORIO = { anclaOjoIzq: [0.25, 0.5], anclaOjoDer: [0.75, 0.5], offsetY: 0 };

const rostro = (izq, der) => ({
  presente: true,
  ojoIzq: { x: izq[0], y: izq[1] },
  ojoDer: { x: der[0], y: der[1] },
  centro: { x: (izq[0] + der[0]) / 2, y: (izq[1] + der[1]) / 2 },
  radio: 100,
  angulo: 0,
  confianza: 1,
});

describe('calcularAnclaje', () => {
  it('centra el accesorio entre los ojos', () => {
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, IMAGEN);
    expect(a.x).toBeCloseTo(500);
    expect(a.y).toBeCloseTo(500);
  });

  it('escala 1 cuando la separacion de ojos coincide con la de los anclajes', () => {
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, IMAGEN);
    expect(a.escala).toBeCloseTo(1);
  });

  it('achica el accesorio cuando la cara esta mas lejos', () => {
    const a = calcularAnclaje(rostro([450, 500], [550, 500]), ACCESORIO, IMAGEN);
    expect(a.escala).toBeCloseTo(0.5);
  });

  it('devuelve el punto medio de los anclajes en pixeles del dibujo', () => {
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), ACCESORIO, IMAGEN);
    expect(a.anclaX).toBeCloseTo(200);
    expect(a.anclaY).toBeCloseTo(100);
  });

  it('rota y escala segun la inclinacion de la cabeza', () => {
    const a = calcularAnclaje(rostro([400, 500], [500, 600]), ACCESORIO, IMAGEN);
    expect(a.angulo).toBeCloseTo(Math.PI / 4);
    expect(a.escala).toBeCloseTo(Math.hypot(100, 100) / 200);
    expect(a.x).toBeCloseTo(450);
    expect(a.y).toBeCloseTo(550);
  });

  it('un offsetY positivo baja el accesorio en proporcion a la separacion de ojos', () => {
    const casco = { ...ACCESORIO, offsetY: 0.5 };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), casco, IMAGEN);
    expect(a.x).toBeCloseTo(500);
    expect(a.y).toBeCloseTo(600);
  });

  it('un offsetY negativo lo sube, que es el caso del casco', () => {
    const casco = { ...ACCESORIO, offsetY: -0.5 };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), casco, IMAGEN);
    expect(a.y).toBeCloseTo(400);
  });

  it('el offset acompaña la inclinacion de la cabeza, no la vertical de la pantalla', () => {
    const casco = { ...ACCESORIO, offsetY: 0.5 };
    const a = calcularAnclaje(rostro([400, 500], [500, 600]), casco, IMAGEN);
    expect(a.x).toBeCloseTo(400);
    expect(a.y).toBeCloseTo(600);
  });

  it('devuelve null si no hay rostro', () => {
    expect(calcularAnclaje(null, ACCESORIO, IMAGEN)).toBeNull();
  });

  it('devuelve null si los ojos coinciden o los anclajes coinciden', () => {
    expect(calcularAnclaje(rostro([500, 500], [500, 500]), ACCESORIO, IMAGEN)).toBeNull();
    const pegados = { anclaOjoIzq: [0.5, 0.5], anclaOjoDer: [0.5, 0.5] };
    expect(calcularAnclaje(rostro([400, 500], [600, 500]), pegados, IMAGEN)).toBeNull();
  });

  it('trata offsetY ausente como cero', () => {
    const sinOffset = { anclaOjoIzq: [0.25, 0.5], anclaOjoDer: [0.75, 0.5] };
    const a = calcularAnclaje(rostro([400, 500], [600, 500]), sinOffset, IMAGEN);
    expect(a.y).toBeCloseTo(500);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- anclaje
```

- [ ] **Paso 3: Escribir `espejo/anclaje.js`**

```js
export function calcularAnclaje(rostro, accesorio, imagen) {
  if (!rostro || !accesorio || !imagen) return null;

  const dx = rostro.ojoDer.x - rostro.ojoIzq.x;
  const dy = rostro.ojoDer.y - rostro.ojoIzq.y;
  const distanciaOjos = Math.hypot(dx, dy);
  if (distanciaOjos === 0) return null;

  const anclaIzq = {
    x: accesorio.anclaOjoIzq[0] * imagen.ancho,
    y: accesorio.anclaOjoIzq[1] * imagen.alto,
  };
  const anclaDer = {
    x: accesorio.anclaOjoDer[0] * imagen.ancho,
    y: accesorio.anclaOjoDer[1] * imagen.alto,
  };
  const distanciaAnclas = Math.hypot(anclaDer.x - anclaIzq.x, anclaDer.y - anclaIzq.y);
  if (distanciaAnclas === 0) return null;

  const angulo = Math.atan2(dy, dx);
  const desplazamiento = (accesorio.offsetY ?? 0) * distanciaOjos;

  const medioX = (rostro.ojoIzq.x + rostro.ojoDer.x) / 2;
  const medioY = (rostro.ojoIzq.y + rostro.ojoDer.y) / 2;

  return {
    x: medioX - Math.sin(angulo) * desplazamiento,
    y: medioY + Math.cos(angulo) * desplazamiento,
    angulo,
    escala: distanciaOjos / distanciaAnclas,
    anclaX: (anclaIzq.x + anclaDer.x) / 2,
    anclaY: (anclaIzq.y + anclaDer.y) / 2,
  };
}
```

El vector "hacia abajo de la cabeza" es la perpendicular al que une los ojos: `(−sen α, cos α)`. Con la cabeza derecha da `(0, 1)`, que es abajo en pantalla. Con la cabeza inclinada, el casco se inclina con ella en vez de quedar flotando de costado.

- [ ] **Paso 4: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 5: Commit**

```bash
git add espejo/anclaje.js tests/espejo/anclaje.test.js
git commit -m "feat: anclaje del accesorio por los dos puntos de ojos"
```

---

### Tarea 7: Física y pool de objetos

**Archivos:**
- Crear: `espejo/fisica.js`, `espejo/objetos.js`
- Probar: `tests/espejo/fisica.test.js`, `tests/espejo/objetos.test.js`

**Interfaces:**
- Consume: `CONFIG.fisica` y `CONFIG.objetos`.
- Produce:
  - `crearCuerpo({ x, y, vx, vy, radio, giro, velocidadGiro })` → cuerpo
  - `integrar(cuerpo, dt, gravedad)` — muta el cuerpo
  - `rebotarContraCirculo(cuerpo, circulo, restitucion)` → `boolean`
  - `limitarACaja(cuerpo, caja, restitucion, friccion)` → `boolean`
  - `paso(cuerpos, dt, mundo)` con `mundo = { gravedad, restitucion, friccion, caja, cabeza|null }`
  - `caja` es `{ x, y, ancho, alto }`
  - `crearPool({ maximo, vidaMs })` → `{ aparecer(definicion, cuerpo, ahora), actualizar(dt, ahora, mundo), vivos(), vaciar() }`
  - Un objeto vivo es `{ definicion, cuerpo, nacido, alfa }`
- `dt` va **en segundos**, no en milisegundos. Es el error más fácil de cometer acá.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tests/espejo/fisica.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearCuerpo, integrar, rebotarContraCirculo, limitarACaja, paso } from '../../espejo/fisica.js';

const CAJA = { x: 0, y: 0, ancho: 1000, alto: 1000 };

describe('integrar', () => {
  it('acelera hacia abajo y avanza segun la velocidad', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 0, radio: 10 });
    integrar(cuerpo, 0.1, 1000);
    expect(cuerpo.vy).toBeCloseTo(100);
    expect(cuerpo.y).toBeCloseTo(10);
  });

  it('conserva la velocidad horizontal', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 0, vx: 50, radio: 10 });
    integrar(cuerpo, 0.2, 1000);
    expect(cuerpo.vx).toBe(50);
    expect(cuerpo.x).toBeCloseTo(10);
  });

  it('hace girar el objeto', () => {
    const cuerpo = crearCuerpo({ x: 0, y: 0, radio: 10, velocidadGiro: 2 });
    integrar(cuerpo, 0.5, 0);
    expect(cuerpo.giro).toBeCloseTo(1);
  });
});

describe('rebotarContraCirculo', () => {
  const cabeza = { x: 100, y: 150, radio: 40 };

  it('no toca nada si esta lejos', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 0, vy: 200, radio: 10 });
    expect(rebotarContraCirculo(cuerpo, cabeza, 0.5)).toBe(false);
    expect(cuerpo.vy).toBe(200);
  });

  it('empuja el objeto fuera del circulo y lo manda hacia arriba', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 120, vy: 200, radio: 10 });
    expect(rebotarContraCirculo(cuerpo, cabeza, 0.5)).toBe(true);
    expect(cuerpo.y).toBeCloseTo(100);
    expect(cuerpo.vy).toBeCloseTo(-100);
  });

  it('no lo frena si ya se esta alejando', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 120, vy: -80, radio: 10 });
    rebotarContraCirculo(cuerpo, cabeza, 0.5);
    expect(cuerpo.vy).toBeCloseTo(-80);
  });

  it('rebota de costado cuando el golpe es lateral', () => {
    const cuerpo = crearCuerpo({ x: 70, y: 150, vx: 100, radio: 10 });
    rebotarContraCirculo(cuerpo, cabeza, 0.5);
    expect(cuerpo.x).toBeCloseTo(50);
    expect(cuerpo.vx).toBeCloseTo(-50);
  });

  it('no divide por cero si el objeto cae justo en el centro', () => {
    const cuerpo = crearCuerpo({ x: 100, y: 150, vy: 200, radio: 10 });
    expect(() => rebotarContraCirculo(cuerpo, cabeza, 0.5)).not.toThrow();
    expect(Number.isFinite(cuerpo.x)).toBe(true);
    expect(Number.isFinite(cuerpo.y)).toBe(true);
  });
});

describe('limitarACaja', () => {
  it('no deja que atraviese el piso', () => {
    const cuerpo = crearCuerpo({ x: 500, y: 995, vy: 400, radio: 20 });
    expect(limitarACaja(cuerpo, CAJA, 0.5, 0.9)).toBe(true);
    expect(cuerpo.y).toBeCloseTo(980);
    expect(cuerpo.vy).toBeCloseTo(-200);
  });

  it('frena el deslizamiento al tocar el piso', () => {
    const cuerpo = crearCuerpo({ x: 500, y: 995, vx: 100, vy: 10, radio: 20 });
    limitarACaja(cuerpo, CAJA, 0.5, 0.9);
    expect(cuerpo.vx).toBeCloseTo(90);
  });

  it('rebota contra las paredes', () => {
    const izquierda = crearCuerpo({ x: 5, y: 500, vx: -100, radio: 20 });
    limitarACaja(izquierda, CAJA, 0.5, 0.9);
    expect(izquierda.x).toBeCloseTo(20);
    expect(izquierda.vx).toBeCloseTo(50);

    const derecha = crearCuerpo({ x: 995, y: 500, vx: 100, radio: 20 });
    limitarACaja(derecha, CAJA, 0.5, 0.9);
    expect(derecha.x).toBeCloseTo(980);
    expect(derecha.vx).toBeCloseTo(-50);
  });

  it('deja en paz a un objeto que va por el medio', () => {
    const cuerpo = crearCuerpo({ x: 500, y: 500, vx: 10, vy: 10, radio: 20 });
    expect(limitarACaja(cuerpo, CAJA, 0.5, 0.9)).toBe(false);
  });
});

describe('paso', () => {
  it('ningun objeto termina fuera de la caja despues de caer un rato', () => {
    const mundo = {
      gravedad: 1600, restitucion: 0.55, friccion: 0.98,
      caja: CAJA, cabeza: { x: 500, y: 400, radio: 90 },
    };
    const cuerpos = Array.from({ length: 20 }, (_, i) =>
      crearCuerpo({ x: 100 + i * 40, y: -50, vx: (i % 5) * 20 - 40, radio: 25 }),
    );

    for (let i = 0; i < 600; i++) paso(cuerpos, 1 / 60, mundo);

    for (const cuerpo of cuerpos) {
      expect(cuerpo.x).toBeGreaterThanOrEqual(CAJA.x + cuerpo.radio - 0.5);
      expect(cuerpo.x).toBeLessThanOrEqual(CAJA.x + CAJA.ancho - cuerpo.radio + 0.5);
      expect(cuerpo.y).toBeLessThanOrEqual(CAJA.y + CAJA.alto - cuerpo.radio + 0.5);
      expect(Number.isFinite(cuerpo.x) && Number.isFinite(cuerpo.y)).toBe(true);
    }
  });

  it('funciona sin cabeza, que es el caso de la pantalla de atraccion', () => {
    const cuerpos = [crearCuerpo({ x: 500, y: 0, radio: 10 })];
    expect(() =>
      paso(cuerpos, 1 / 60, {
        gravedad: 1600, restitucion: 0.5, friccion: 0.98, caja: CAJA, cabeza: null,
      }),
    ).not.toThrow();
  });
});
```

`tests/espejo/objetos.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearPool } from '../../espejo/objetos.js';
import { crearCuerpo } from '../../espejo/fisica.js';

const MUNDO = {
  gravedad: 0, restitucion: 0.5, friccion: 1,
  caja: { x: 0, y: 0, ancho: 1000, alto: 1000 }, cabeza: null,
};
const cuerpo = () => crearCuerpo({ x: 500, y: 100, radio: 10 });

describe('crearPool', () => {
  it('guarda lo que aparece', () => {
    const pool = crearPool({ maximo: 3, vidaMs: 1000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    expect(pool.vivos()).toHaveLength(1);
    expect(pool.vivos()[0].definicion.img).toBe('a.png');
  });

  it('respeta el maximo tirando el mas viejo', () => {
    const pool = crearPool({ maximo: 2, vidaMs: 10000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.aparecer({ img: 'b.png' }, cuerpo(), 10);
    pool.aparecer({ img: 'c.png' }, cuerpo(), 20);

    expect(pool.vivos()).toHaveLength(2);
    expect(pool.vivos().map((o) => o.definicion.img)).toEqual(['b.png', 'c.png']);
  });

  it('mantiene alfa 1 mientras al objeto le sobra vida', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 2000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.actualizar(1 / 60, 1000, MUNDO);
    expect(pool.vivos()[0].alfa).toBe(1);
  });

  it('lo desvanece en el ultimo medio segundo', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 2000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.actualizar(1 / 60, 1750, MUNDO);
    expect(pool.vivos()[0].alfa).toBeCloseTo(0.5);
  });

  it('retira los vencidos', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 1000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.aparecer({ img: 'b.png' }, cuerpo(), 800);
    pool.actualizar(1 / 60, 1100, MUNDO);

    expect(pool.vivos().map((o) => o.definicion.img)).toEqual(['b.png']);
  });

  it('mueve los cuerpos al actualizar', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 5000 });
    pool.aparecer({ img: 'a.png' }, crearCuerpo({ x: 500, y: 100, vy: 60, radio: 10 }), 0);
    pool.actualizar(0.5, 100, { ...MUNDO, gravedad: 0 });
    expect(pool.vivos()[0].cuerpo.y).toBeCloseTo(130);
  });

  it('vaciar los saca a todos', () => {
    const pool = crearPool({ maximo: 5, vidaMs: 5000 });
    pool.aparecer({ img: 'a.png' }, cuerpo(), 0);
    pool.vaciar();
    expect(pool.vivos()).toHaveLength(0);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
npm test -- fisica objetos
```

- [ ] **Paso 3: Escribir `espejo/fisica.js`**

```js
export function crearCuerpo({ x, y, vx = 0, vy = 0, radio, giro = 0, velocidadGiro = 0 }) {
  return { x, y, vx, vy, radio, giro, velocidadGiro };
}

export function integrar(cuerpo, dt, gravedad) {
  cuerpo.vy += gravedad * dt;
  cuerpo.x += cuerpo.vx * dt;
  cuerpo.y += cuerpo.vy * dt;
  cuerpo.giro += cuerpo.velocidadGiro * dt;
}

export function rebotarContraCirculo(cuerpo, circulo, restitucion) {
  const dx = cuerpo.x - circulo.x;
  const dy = cuerpo.y - circulo.y;
  const distancia = Math.hypot(dx, dy);
  const minima = circulo.radio + cuerpo.radio;
  if (distancia >= minima) return false;

  const nx = distancia === 0 ? 0 : dx / distancia;
  const ny = distancia === 0 ? -1 : dy / distancia;

  cuerpo.x = circulo.x + nx * minima;
  cuerpo.y = circulo.y + ny * minima;

  const normal = cuerpo.vx * nx + cuerpo.vy * ny;
  if (normal < 0) {
    cuerpo.vx -= (1 + restitucion) * normal * nx;
    cuerpo.vy -= (1 + restitucion) * normal * ny;
  }
  return true;
}

export function limitarACaja(cuerpo, caja, restitucion, friccion) {
  let toco = false;

  if (cuerpo.x - cuerpo.radio < caja.x) {
    cuerpo.x = caja.x + cuerpo.radio;
    cuerpo.vx = -cuerpo.vx * restitucion;
    toco = true;
  } else if (cuerpo.x + cuerpo.radio > caja.x + caja.ancho) {
    cuerpo.x = caja.x + caja.ancho - cuerpo.radio;
    cuerpo.vx = -cuerpo.vx * restitucion;
    toco = true;
  }

  if (cuerpo.y + cuerpo.radio > caja.y + caja.alto) {
    cuerpo.y = caja.y + caja.alto - cuerpo.radio;
    cuerpo.vy = -cuerpo.vy * restitucion;
    cuerpo.vx *= friccion;
    cuerpo.velocidadGiro *= friccion;
    toco = true;
  }

  return toco;
}

export function paso(cuerpos, dt, mundo) {
  for (const cuerpo of cuerpos) {
    integrar(cuerpo, dt, mundo.gravedad);
    if (mundo.cabeza) rebotarContraCirculo(cuerpo, mundo.cabeza, mundo.restitucion);
    limitarACaja(cuerpo, mundo.caja, mundo.restitucion, mundo.friccion);
  }
}
```

La colisión es discreta: si un objeto viajara más que su propio diámetro en un cuadro, podría atravesar la cabeza. Con la gravedad y las alturas de este proyecto no llega ni cerca, y `main.js` acota el `dt` por si el navegador se cuelga un instante. No hace falta nada más complicado.

- [ ] **Paso 4: Escribir `espejo/objetos.js`**

```js
import { paso } from './fisica.js';

const MS_DE_DESVANECIDO = 500;

export function crearPool({ maximo, vidaMs }) {
  const vivos = [];

  return {
    aparecer(definicion, cuerpo, ahora) {
      while (vivos.length >= maximo) vivos.shift();
      const objeto = { definicion, cuerpo, nacido: ahora, alfa: 1 };
      vivos.push(objeto);
      return objeto;
    },

    actualizar(dt, ahora, mundo) {
      paso(vivos.map((objeto) => objeto.cuerpo), dt, mundo);

      for (const objeto of vivos) {
        const restante = vidaMs - (ahora - objeto.nacido);
        objeto.alfa = restante >= MS_DE_DESVANECIDO
          ? 1
          : Math.max(0, restante / MS_DE_DESVANECIDO);
      }

      for (let i = vivos.length - 1; i >= 0; i--) {
        if (ahora - vivos[i].nacido >= vidaMs) vivos.splice(i, 1);
      }
    },

    vivos: () => vivos,
    vaciar: () => {
      vivos.length = 0;
    },
  };
}
```

- [ ] **Paso 5: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 6: Commit**

```bash
git add espejo/fisica.js espejo/objetos.js tests/espejo/fisica.test.js tests/espejo/objetos.test.js
git commit -m "feat: fisica de rebote contra la cabeza y pool de objetos con presupuesto"
```

---

### Tarea 8: Máquina de estados

El corazón del sistema, y el único módulo que se prueba entero sin cámara, sin pantalla y sin red.

**Archivos:**
- Crear: `espejo/maquina-estados.js`
- Probar: `tests/espejo/maquina-estados.test.js`

**Interfaces:**
- Consume: `CONFIG.tiempos` y `sortear()` de la Tarea 5.
- Produce:
  - `ESTADOS` — `{ ATRACCION, ENGANCHE, SORTEO, REVELACION, ESCENA, CIERRE }`
  - `crearMaquina({ tiempos, sortear })` → `{ actualizar({ hayRostro, ahora }), forzarCarrera(id, ahora), reiniciar(ahora), estado(), carrera(), sesion() }`
  - `actualizar` devuelve `{ estado, carrera, sesion, eventos }`
  - Eventos posibles: `{ tipo: 'entra', estado }`, `{ tipo: 'carrera', id, sesion }`, `{ tipo: 'reposo' }`
- **ENGANCHE aborta apenas se pierde el rostro**, sin esperar los tres segundos de tolerancia. Los tres segundos son para alguien que ya vio su carrera y se movió; en el enganche todavía no pasó nada, y esperar significaría arrancar un sorteo frente a un sillón vacío. Los parpadeos cortos ya los absorbe la histéresis de la Tarea 3, así que acá la señal llega limpia.
- **La carrera se elige al entrar en SORTEO**, tres segundos antes de anunciarla. Ese margen le sirve al espejo para tener listos los PNG cuando se despeje la niebla. El mensaje a las tablets, en cambio, sale recién al entrar en REVELACION: mandarlo antes sería contar el final.

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/espejo/maquina-estados.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearMaquina, ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = {
  enganche: 2000,
  sorteo: 3000,
  revelacion: 2000,
  escena: 30000,
  cierre: 4000,
  enfriamiento: 3000,
  ausenciaParaCortar: 3000,
  sesionMaxima: 75000,
};

function nueva(carreras = ['civil', 'quimica']) {
  let i = 0;
  return crearMaquina({ tiempos: TIEMPOS, sortear: () => carreras[i++ % carreras.length] });
}

/** Avanza el reloj de a 100 ms hasta `hasta`, juntando todos los eventos. */
function avanzar(maquina, desde, hasta, hayRostro) {
  const eventos = [];
  let ahora = desde;
  let ultimo = null;
  while (ahora <= hasta) {
    ultimo = maquina.actualizar({ hayRostro, ahora });
    eventos.push(...ultimo.eventos);
    ahora += 100;
  }
  return { ...ultimo, eventos, ahora: ahora - 100 };
}

const tipos = (eventos, tipo) => eventos.filter((e) => e.tipo === tipo);

describe('crearMaquina', () => {
  it('arranca en atraccion sin carrera', () => {
    const maquina = nueva();
    expect(maquina.estado()).toBe(ESTADOS.ATRACCION);
    expect(maquina.carrera()).toBeNull();
  });

  it('pasa a enganche apenas hay rostro', () => {
    const maquina = nueva();
    const salida = maquina.actualizar({ hayRostro: true, ahora: 0 });
    expect(salida.estado).toBe(ESTADOS.ENGANCHE);
    expect(tipos(salida.eventos, 'entra')).toHaveLength(1);
  });

  it('recorre el ciclo completo con alguien sentado', () => {
    const maquina = nueva();
    const vistos = [];

    let ahora = 0;
    while (ahora <= 45000) {
      const salida = maquina.actualizar({ hayRostro: true, ahora });
      for (const evento of salida.eventos) {
        if (evento.tipo === 'entra') vistos.push(evento.estado);
      }
      ahora += 100;
    }

    expect(vistos.slice(0, 6)).toEqual([
      ESTADOS.ENGANCHE,
      ESTADOS.SORTEO,
      ESTADOS.REVELACION,
      ESTADOS.ESCENA,
      ESTADOS.CIERRE,
      ESTADOS.ATRACCION,
    ]);
  });

  it('elige la carrera al entrar en sorteo, antes de anunciarla', () => {
    const maquina = nueva(['civil']);
    avanzar(maquina, 0, 2100, true);
    expect(maquina.estado()).toBe(ESTADOS.SORTEO);
    expect(maquina.carrera()).toBe('civil');
  });

  it('recien emite el mensaje de carrera al entrar en revelacion', () => {
    const maquina = nueva(['civil']);

    const hastaSorteo = avanzar(maquina, 0, 2100, true);
    expect(tipos(hastaSorteo.eventos, 'carrera')).toHaveLength(0);

    const hastaRevelacion = avanzar(maquina, 2200, 5200, true);
    expect(tipos(hastaRevelacion.eventos, 'carrera')).toEqual([
      { tipo: 'carrera', id: 'civil', sesion: 1 },
    ]);
  });

  it('emite reposo al entrar en cierre', () => {
    const maquina = nueva();
    const salida = avanzar(maquina, 0, 40000, true);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);
  });

  it('corta a cierre si el rostro falta mas de lo permitido durante la escena', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    const salida = avanzar(maquina, 8100, 11500, false);
    expect(salida.estado).toBe(ESTADOS.CIERRE);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);
  });

  it('aguanta una perdida breve de rostro sin cortar', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);
    avanzar(maquina, 8100, 9500, false);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);

    avanzar(maquina, 9600, 10000, true);
    expect(maquina.estado()).toBe(ESTADOS.ESCENA);
  });

  it('vuelve a atraccion sin emitir reposo si se van durante el enganche', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 0 });
    const salida = avanzar(maquina, 100, 3500, false);

    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(0);
    expect(tipos(salida.eventos, 'carrera')).toHaveLength(0);
  });

  it('no arranca otra sesion durante el enfriamiento', () => {
    const maquina = nueva();
    const finDelCiclo = avanzar(maquina, 0, 42000, true);
    expect(finDelCiclo.estado).toBe(ESTADOS.ATRACCION);

    const enFrio = avanzar(maquina, finDelCiclo.ahora + 100, finDelCiclo.ahora + 1000, true);
    expect(enFrio.estado).toBe(ESTADOS.ATRACCION);

    const yaCaliente = maquina.actualizar({ hayRostro: true, ahora: finDelCiclo.ahora + 5000 });
    expect(yaCaliente.estado).toBe(ESTADOS.ENGANCHE);
  });

  it('numera las sesiones de forma creciente', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 42000, true);
    const segunda = avanzar(maquina, 48000, 90000, true);
    const anuncios = tipos(segunda.eventos, 'carrera');
    expect(anuncios).toHaveLength(1);
    expect(anuncios[0].sesion).toBe(2);
  });

  it('corta por tope de sesion aunque la persona siga ahi', () => {
    const tiemposLargos = { ...TIEMPOS, escena: 600000, sesionMaxima: 20000 };
    const maquina = crearMaquina({ tiempos: tiemposLargos, sortear: () => 'civil' });

    const salida = avanzar(maquina, 0, 25000, true);
    expect([ESTADOS.CIERRE, ESTADOS.ATRACCION]).toContain(salida.estado);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);
  });

  it('forzarCarrera salta a la revelacion con la carrera pedida', () => {
    const maquina = nueva();
    const salida = maquina.forzarCarrera('quimica', 500);

    expect(salida.estado).toBe(ESTADOS.REVELACION);
    expect(salida.carrera).toBe('quimica');
    expect(tipos(salida.eventos, 'carrera')).toEqual([
      { tipo: 'carrera', id: 'quimica', sesion: 1 },
    ]);
  });

  it('reiniciar vuelve a atraccion, emite reposo y deja lista otra sesion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 8000, true);

    const salida = maquina.reiniciar(8100);
    expect(salida.estado).toBe(ESTADOS.ATRACCION);
    expect(tipos(salida.eventos, 'reposo')).toHaveLength(1);

    expect(maquina.actualizar({ hayRostro: true, ahora: 8200 }).estado).toBe(ESTADOS.ENGANCHE);
  });

  it('limpia la carrera al volver a atraccion', () => {
    const maquina = nueva();
    avanzar(maquina, 0, 42000, true);
    expect(maquina.carrera()).toBeNull();
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- maquina-estados
```

- [ ] **Paso 3: Escribir `espejo/maquina-estados.js`**

```js
export const ESTADOS = {
  ATRACCION: 'ATRACCION',
  ENGANCHE: 'ENGANCHE',
  SORTEO: 'SORTEO',
  REVELACION: 'REVELACION',
  ESCENA: 'ESCENA',
  CIERRE: 'CIERRE',
};

export function crearMaquina({ tiempos, sortear }) {
  let estado = ESTADOS.ATRACCION;
  let desde = 0;
  let ausenteDesde = null;
  let inicioDeSesion = null;
  let finDeCierre = null;
  let carrera = null;
  let sesion = 0;

  function ir(nuevo, ahora, eventos) {
    estado = nuevo;
    desde = ahora;
    eventos.push({ tipo: 'entra', estado: nuevo });

    if (nuevo === ESTADOS.REVELACION) {
      sesion += 1;
      eventos.push({ tipo: 'carrera', id: carrera, sesion });
    }
    if (nuevo === ESTADOS.CIERRE) {
      eventos.push({ tipo: 'reposo' });
    }
    if (nuevo === ESTADOS.ATRACCION) {
      carrera = null;
      inicioDeSesion = null;
    }
  }

  function salida(eventos) {
    return { estado, carrera, sesion, eventos };
  }

  return {
    estado: () => estado,
    carrera: () => carrera,
    sesion: () => sesion,

    actualizar({ hayRostro, ahora }) {
      const eventos = [];

      if (hayRostro) ausenteDesde = null;
      else if (ausenteDesde === null) ausenteDesde = ahora;

      const seFue =
        !hayRostro && ausenteDesde !== null && ahora - ausenteDesde >= tiempos.ausenciaParaCortar;
      const pasoElTope =
        inicioDeSesion !== null && ahora - inicioDeSesion >= tiempos.sesionMaxima;
      const transcurrido = ahora - desde;

      switch (estado) {
        case ESTADOS.ATRACCION:
          if (finDeCierre !== null && ahora - finDeCierre < tiempos.enfriamiento) break;
          if (hayRostro) {
            inicioDeSesion = ahora;
            ir(ESTADOS.ENGANCHE, ahora, eventos);
          }
          break;

        case ESTADOS.ENGANCHE:
          if (!hayRostro) {
            ir(ESTADOS.ATRACCION, ahora, eventos);
          } else if (transcurrido >= tiempos.enganche) {
            carrera = sortear();
            ir(ESTADOS.SORTEO, ahora, eventos);
          }
          break;

        case ESTADOS.SORTEO:
          if (seFue || pasoElTope) ir(ESTADOS.CIERRE, ahora, eventos);
          else if (transcurrido >= tiempos.sorteo) ir(ESTADOS.REVELACION, ahora, eventos);
          break;

        case ESTADOS.REVELACION:
          if (seFue || pasoElTope) ir(ESTADOS.CIERRE, ahora, eventos);
          else if (transcurrido >= tiempos.revelacion) ir(ESTADOS.ESCENA, ahora, eventos);
          break;

        case ESTADOS.ESCENA:
          if (seFue || pasoElTope || transcurrido >= tiempos.escena) {
            ir(ESTADOS.CIERRE, ahora, eventos);
          }
          break;

        case ESTADOS.CIERRE:
          if (transcurrido >= tiempos.cierre) {
            finDeCierre = ahora;
            ir(ESTADOS.ATRACCION, ahora, eventos);
          }
          break;
      }

      return salida(eventos);
    },

    forzarCarrera(id, ahora) {
      const eventos = [];
      carrera = id;
      inicioDeSesion = ahora;
      finDeCierre = null;
      ausenteDesde = null;
      ir(ESTADOS.REVELACION, ahora, eventos);
      return salida(eventos);
    },

    reiniciar(ahora) {
      const eventos = [{ tipo: 'reposo' }];
      finDeCierre = null;
      ausenteDesde = null;
      ir(ESTADOS.ATRACCION, ahora, eventos);
      return salida(eventos);
    },
  };
}
```

- [ ] **Paso 4: Correr y confirmar que pasan**

```bash
npm test
```

Esperado: PASAN los quince casos de la máquina, además de todo lo anterior.

- [ ] **Paso 5: Commit**

```bash
git add espejo/maquina-estados.js tests/espejo/maquina-estados.test.js
git commit -m "feat: maquina de estados de la experiencia con cortes de seguridad"
```

---

### Tarea 9: Protocolo y bus WebSocket

**Archivos:**
- Crear: `comun/protocolo.js`, `espejo/bus.js`
- Probar: `tests/comun/protocolo.test.js`, `tests/espejo/bus.test.js`

**Interfaces:**
- Consume: los eventos de la máquina de estados (Tarea 8).
- Produce:
  - `TIPOS` — `{ CARRERA: 'carrera', REPOSO: 'reposo' }`
  - `mensajeCarrera(id, sesion)`, `mensajeReposo()`
  - `esValido(mensaje)` → `boolean`
  - `interpretar(texto)` → mensaje o `null`
  - `crearBus({ url, reconexionMs, alMensaje, alEstado, CrearSocket, programar })` → `{ enviar(mensaje): boolean, conectado(): boolean, cerrar() }`
- `comun/protocolo.js` lo importan **el espejo y la tablet**. Es lo que impide que los dos lados se desincronicen sin que nadie se entere.

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tests/comun/protocolo.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { TIPOS, mensajeCarrera, mensajeReposo, esValido, interpretar } from '../../comun/protocolo.js';

describe('protocolo', () => {
  it('arma el mensaje de carrera', () => {
    expect(mensajeCarrera('civil', 12)).toEqual({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 12 });
  });

  it('arma el mensaje de reposo', () => {
    expect(mensajeReposo()).toEqual({ tipo: TIPOS.REPOSO });
  });

  it('acepta los dos mensajes del sistema', () => {
    expect(esValido(mensajeCarrera('civil', 1))).toBe(true);
    expect(esValido(mensajeReposo())).toBe(true);
  });

  it('rechaza cualquier otra cosa', () => {
    expect(esValido(null)).toBe(false);
    expect(esValido('civil')).toBe(false);
    expect(esValido({ tipo: 'otra' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: '', sesion: 1 })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil' })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 0 })).toBe(false);
    expect(esValido({ tipo: TIPOS.CARRERA, id: 'civil', sesion: 1.5 })).toBe(false);
  });

  it('interpreta texto JSON y descarta lo que no sirve', () => {
    expect(interpretar('{"tipo":"reposo"}')).toEqual({ tipo: TIPOS.REPOSO });
    expect(interpretar('no es json')).toBeNull();
    expect(interpretar('{"tipo":"otra"}')).toBeNull();
    expect(interpretar('')).toBeNull();
  });
});
```

`tests/espejo/bus.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { crearBus } from '../../espejo/bus.js';

class SocketFalso {
  static creados = [];
  constructor(url) {
    this.url = url;
    this.readyState = 0;
    this.enviados = [];
    SocketFalso.creados.push(this);
  }
  send(texto) { this.enviados.push(texto); }
  close() { this.readyState = 3; this.onclose?.(); }
  abrir() { this.readyState = 1; this.onopen?.(); }
  recibir(texto) { this.onmessage?.({ data: texto }); }
}

function preparar(opciones = {}) {
  SocketFalso.creados = [];
  const recibidos = [];
  const estados = [];
  const programados = [];
  const bus = crearBus({
    url: 'ws://prueba',
    reconexionMs: 2000,
    alMensaje: (m) => recibidos.push(m),
    alEstado: (e) => estados.push(e),
    CrearSocket: SocketFalso,
    programar: (fn) => { programados.push(fn); return programados.length; },
    ...opciones,
  });
  return { bus, recibidos, estados, programados, socket: () => SocketFalso.creados.at(-1) };
}

describe('crearBus', () => {
  it('se conecta a la url apenas se crea', () => {
    const { socket } = preparar();
    expect(socket().url).toBe('ws://prueba');
  });

  it('manda el mensaje como JSON cuando esta abierto', () => {
    const { bus, socket } = preparar();
    socket().abrir();
    expect(bus.enviar({ tipo: 'reposo' })).toBe(true);
    expect(socket().enviados).toEqual(['{"tipo":"reposo"}']);
  });

  it('no manda nada y avisa que no pudo si esta cerrado', () => {
    const { bus, socket } = preparar();
    expect(bus.enviar({ tipo: 'reposo' })).toBe(false);
    expect(socket().enviados).toEqual([]);
  });

  it('entrega los mensajes validos que le llegan', () => {
    const { recibidos, socket } = preparar();
    socket().abrir();
    socket().recibir('{"tipo":"carrera","id":"civil","sesion":3}');
    expect(recibidos).toEqual([{ tipo: 'carrera', id: 'civil', sesion: 3 }]);
  });

  it('descarta la basura sin romperse', () => {
    const { recibidos, socket } = preparar();
    socket().abrir();
    socket().recibir('esto no es json');
    socket().recibir('{"tipo":"desconocido"}');
    expect(recibidos).toEqual([]);
  });

  it('avisa cuando se conecta y cuando se cae', () => {
    const { estados, socket } = preparar();
    socket().abrir();
    socket().close();
    expect(estados).toEqual([{ conectado: true }, { conectado: false }]);
  });

  it('programa una reconexion cuando se corta', () => {
    const { programados, socket } = preparar();
    socket().abrir();
    socket().close();
    expect(programados).toHaveLength(1);

    programados[0]();
    expect(SocketFalso.creados).toHaveLength(2);
  });

  it('deja de reconectar despues de cerrar', () => {
    const { bus, programados, socket } = preparar();
    socket().abrir();
    bus.cerrar();
    expect(programados).toHaveLength(0);
    expect(SocketFalso.creados).toHaveLength(1);
  });

  it('informa si esta conectado', () => {
    const { bus, socket } = preparar();
    expect(bus.conectado()).toBe(false);
    socket().abrir();
    expect(bus.conectado()).toBe(true);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
npm test -- protocolo bus
```

- [ ] **Paso 3: Escribir `comun/protocolo.js`**

```js
export const TIPOS = { CARRERA: 'carrera', REPOSO: 'reposo' };

export function mensajeCarrera(id, sesion) {
  return { tipo: TIPOS.CARRERA, id, sesion };
}

export function mensajeReposo() {
  return { tipo: TIPOS.REPOSO };
}

export function esValido(mensaje) {
  if (!mensaje || typeof mensaje !== 'object') return false;
  if (mensaje.tipo === TIPOS.REPOSO) return true;
  return (
    mensaje.tipo === TIPOS.CARRERA &&
    typeof mensaje.id === 'string' &&
    mensaje.id.length > 0 &&
    Number.isInteger(mensaje.sesion) &&
    mensaje.sesion > 0
  );
}

export function interpretar(texto) {
  try {
    const mensaje = JSON.parse(texto);
    return esValido(mensaje) ? mensaje : null;
  } catch {
    return null;
  }
}
```

- [ ] **Paso 4: Escribir `espejo/bus.js`**

```js
import { interpretar } from '../comun/protocolo.js';

const ABIERTO = 1;

export function crearBus({
  url,
  reconexionMs,
  alMensaje = () => {},
  alEstado = () => {},
  CrearSocket = WebSocket,
  programar = setTimeout,
  cancelar = clearTimeout,
}) {
  let socket = null;
  let vivo = true;
  let pendiente = null;

  function conectar() {
    pendiente = null;
    socket = new CrearSocket(url);

    socket.onopen = () => alEstado({ conectado: true });

    socket.onmessage = (evento) => {
      const mensaje = interpretar(
        typeof evento.data === 'string' ? evento.data : String(evento.data),
      );
      if (mensaje) alMensaje(mensaje);
    };

    socket.onclose = () => {
      socket = null;
      alEstado({ conectado: false });
      if (vivo) pendiente = programar(conectar, reconexionMs);
    };

    socket.onerror = () => {
      try { socket?.close(); } catch { /* ya estaba cerrado */ }
    };
  }

  conectar();

  return {
    enviar(mensaje) {
      if (socket && socket.readyState === ABIERTO) {
        socket.send(JSON.stringify(mensaje));
        return true;
      }
      return false;
    },
    conectado: () => Boolean(socket) && socket.readyState === ABIERTO,
    cerrar() {
      vivo = false;
      if (pendiente !== null) cancelar(pendiente);
      pendiente = null;
      const aCerrar = socket;
      socket = null;
      aCerrar?.close();
    },
  };
}
```

`cerrar()` pone `socket` en `null` **antes** de cerrarlo, para que el `onclose` que dispara no vuelva a programar una reconexión.

- [ ] **Paso 5: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 6: Commit**

```bash
git add comun espejo/bus.js tests/comun tests/espejo/bus.test.js
git commit -m "feat: protocolo compartido y bus WebSocket con reconexion"
```

---

### Tarea 10: Banco de imágenes y escena

**Archivos:**
- Crear: `espejo/imagenes.js`, `espejo/escena.js`
- Probar: `tests/espejo/imagenes.test.js`, `tests/espejo/escena.test.js`

**Interfaces:**
- Consume: disposición de pantalla, rostro (Tarea 2), anclaje (Tarea 6), objetos vivos (Tarea 7), carrera (Tarea 4).
- Produce:
  - `crearBanco({ cargar, raiz })` → `{ precargar(rutas), obtener(ruta), faltantes() }`
  - **Las claves del banco son las rutas tal como vienen de `carreras.json`** (`assets/civil/casco.png`). `raiz` sólo se antepone al pedirle el archivo al navegador. Si se guardara la ruta completa como clave, `dibujarObjetos` no encontraría nunca su imagen.
  - `cargarImagenDelNavegador(ruta)` → `Promise<HTMLImageElement>`
  - `calcularDisposicion(ancho, alto)` → `{ ancho, alto, vertical, caja, piso, unidad, texto }`
  - `dibujarVideoEspejado(ctx, video, disposicion, { desenfoque, brillo })`
  - `dibujarObjetos(ctx, objetos, banco, color)`
  - `dibujarAccesorio(ctx, rostro, carrera, banco)`
  - `dibujarTextos(ctx, carrera, disposicion, alfa)`
  - `dibujarInvitacion(ctx, disposicion, pulso)`

- [ ] **Paso 1: Escribir las pruebas que fallan**

`tests/espejo/imagenes.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { crearBanco } from '../../espejo/imagenes.js';

describe('crearBanco', () => {
  it('carga y devuelve lo que pidieron', async () => {
    const banco = crearBanco({ cargar: async (ruta) => ({ ruta }) });
    await banco.precargar(['a.png', 'b.png']);
    expect(banco.obtener('a.png')).toEqual({ ruta: 'a.png' });
  });

  it('devuelve null en vez de romperse cuando un archivo no esta', async () => {
    const banco = crearBanco({
      cargar: async (ruta) => {
        if (ruta === 'falta.png') throw new Error('404');
        return { ruta };
      },
    });
    const informe = await banco.precargar(['ok.png', 'falta.png']);

    expect(banco.obtener('falta.png')).toBeNull();
    expect(banco.obtener('ok.png')).toEqual({ ruta: 'ok.png' });
    expect(informe.faltantes).toEqual(['falta.png']);
    expect(informe.total).toBe(2);
  });

  it('no carga dos veces la misma ruta', async () => {
    const cargar = vi.fn(async (ruta) => ({ ruta }));
    const banco = crearBanco({ cargar });
    await banco.precargar(['a.png', 'a.png']);
    await banco.precargar(['a.png']);
    expect(cargar).toHaveBeenCalledTimes(1);
  });

  it('devuelve null para algo que nunca se pidio', () => {
    expect(crearBanco({ cargar: async () => ({}) }).obtener('nada.png')).toBeNull();
  });

  it('antepone la raiz al pedir el archivo pero guarda la ruta original como clave', async () => {
    const pedidas = [];
    const banco = crearBanco({
      cargar: async (ruta) => { pedidas.push(ruta); return { ruta }; },
      raiz: '/contenido/',
    });
    await banco.precargar(['assets/civil/casco.png']);

    expect(pedidas).toEqual(['/contenido/assets/civil/casco.png']);
    expect(banco.obtener('assets/civil/casco.png')).toEqual({
      ruta: '/contenido/assets/civil/casco.png',
    });
  });

  it('lleva la lista de faltantes para el panel de operacion', async () => {
    const banco = crearBanco({ cargar: async () => { throw new Error('no'); } });
    await banco.precargar(['x.png', 'y.png']);
    expect(banco.faltantes().sort()).toEqual(['x.png', 'y.png']);
  });
});
```

`tests/espejo/escena.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { calcularDisposicion } from '../../espejo/escena.js';

describe('calcularDisposicion', () => {
  it('reconoce una pantalla vertical', () => {
    expect(calcularDisposicion(1080, 1920).vertical).toBe(true);
  });

  it('reconoce una pantalla apaisada', () => {
    expect(calcularDisposicion(1920, 1080).vertical).toBe(false);
  });

  it('deja el piso arriba del borde para que el texto no quede tapado', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.piso).toBeLessThan(1920);
    expect(d.piso).toBeGreaterThan(1920 * 0.7);
  });

  it('la caja de fisica termina en el piso', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.caja).toEqual({ x: 0, y: 0, ancho: 1080, alto: d.piso });
  });

  it('la caja nunca se sale de la pantalla', () => {
    for (const [ancho, alto] of [[1080, 1920], [1920, 1080], [800, 600], [2160, 3840]]) {
      const d = calcularDisposicion(ancho, alto);
      expect(d.caja.ancho).toBeLessThanOrEqual(ancho);
      expect(d.caja.alto).toBeLessThanOrEqual(alto);
    }
  });

  it('escala la tipografia con el lado corto de la pantalla', () => {
    const chica = calcularDisposicion(540, 960);
    const grande = calcularDisposicion(1080, 1920);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(chica.texto.tamanoNombre * 1.9);
    expect(grande.texto.tamanoNombre).toBeLessThan(chica.texto.tamanoNombre * 2.1);
    expect(grande.texto.tamanoNombre).toBeGreaterThan(grande.texto.tamanoFrase);
  });

  it('pone el nombre arriba de la frase', () => {
    const d = calcularDisposicion(1080, 1920);
    expect(d.texto.nombreY).toBeLessThan(d.texto.fraseY);
    expect(d.texto.fraseY).toBeLessThan(1920);
  });

  it('da una unidad de referencia positiva en cualquier pantalla', () => {
    for (const [ancho, alto] of [[1080, 1920], [1920, 1080], [800, 600]]) {
      expect(calcularDisposicion(ancho, alto).unidad).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Paso 2: Correr y confirmar que fallan**

```bash
npm test -- imagenes escena
```

- [ ] **Paso 3: Escribir `espejo/imagenes.js`**

```js
export function crearBanco({ cargar, raiz = '' }) {
  const cache = new Map();

  return {
    async precargar(rutas) {
      const unicas = [...new Set(rutas)].filter((ruta) => !cache.has(ruta));
      await Promise.all(
        unicas.map(async (ruta) => {
          try {
            cache.set(ruta, await cargar(raiz + ruta));
          } catch {
            cache.set(ruta, null);
          }
        }),
      );
      const todas = [...new Set(rutas)];
      return { total: todas.length, faltantes: todas.filter((ruta) => !cache.get(ruta)) };
    },

    obtener: (ruta) => cache.get(ruta) ?? null,

    faltantes: () =>
      [...cache.entries()].filter(([, imagen]) => !imagen).map(([ruta]) => ruta),
  };
}

export function cargarImagenDelNavegador(ruta) {
  return new Promise((ok, falla) => {
    const imagen = new Image();
    imagen.onload = () => ok(imagen);
    imagen.onerror = () => falla(new Error(`No se pudo cargar ${ruta}`));
    imagen.src = ruta;
  });
}
```

- [ ] **Paso 4: Escribir `espejo/escena.js`**

```js
import { calcularAnclaje } from './anclaje.js';

export function calcularDisposicion(ancho, alto) {
  const vertical = alto >= ancho;
  const alturaTexto = alto * (vertical ? 0.16 : 0.22);
  const piso = alto - alturaTexto;
  const corto = Math.min(ancho, alto);

  return {
    ancho,
    alto,
    vertical,
    piso,
    caja: { x: 0, y: 0, ancho, alto: piso },
    unidad: Math.min(ancho, alto * 0.5625),
    texto: {
      nombreY: alto - alturaTexto * 0.55,
      fraseY: alto - alturaTexto * 0.18,
      tamanoNombre: Math.round(corto * 0.055),
      tamanoFrase: Math.round(corto * 0.03),
    },
  };
}

export function dibujarVideoEspejado(ctx, video, disposicion, { desenfoque = 0, brillo = 1 } = {}) {
  const { ancho, alto } = disposicion;
  ctx.save();
  ctx.filter = `blur(${desenfoque}px) brightness(${brillo})`;
  ctx.translate(ancho, 0);
  ctx.scale(-1, 1);

  const relacionVideo = video.videoWidth / video.videoHeight;
  const relacionPantalla = ancho / alto;
  let anchoDibujo = ancho;
  let altoDibujo = alto;
  if (relacionVideo > relacionPantalla) anchoDibujo = alto * relacionVideo;
  else altoDibujo = ancho / relacionVideo;

  ctx.drawImage(
    video,
    (ancho - anchoDibujo) / 2,
    (alto - altoDibujo) / 2,
    anchoDibujo,
    altoDibujo,
  );
  ctx.restore();
}

function dibujarSustituto(ctx, radio, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, 0, radio, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.lineWidth = Math.max(2, radio * 0.12);
  ctx.stroke();
}

export function dibujarObjetos(ctx, objetos, banco, color) {
  for (const objeto of objetos) {
    const imagen = banco.obtener(objeto.definicion.img);
    const { cuerpo } = objeto;

    ctx.save();
    ctx.globalAlpha = objeto.alfa;
    ctx.translate(cuerpo.x, cuerpo.y);
    ctx.rotate(cuerpo.giro);
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = cuerpo.radio * 0.4;

    if (imagen) {
      const lado = cuerpo.radio * 2;
      const escala = lado / Math.max(imagen.width, imagen.height);
      ctx.drawImage(
        imagen,
        (-imagen.width * escala) / 2,
        (-imagen.height * escala) / 2,
        imagen.width * escala,
        imagen.height * escala,
      );
    } else {
      dibujarSustituto(ctx, cuerpo.radio, color);
    }
    ctx.restore();
  }
}

export function dibujarAccesorio(ctx, rostro, carrera, banco) {
  if (!rostro || !carrera) return;
  const imagen = banco.obtener(carrera.accesorio.img);
  if (!imagen) return;

  const anclaje = calcularAnclaje(rostro, carrera.accesorio, {
    ancho: imagen.width,
    alto: imagen.height,
  });
  if (!anclaje) return;

  ctx.save();
  ctx.translate(anclaje.x, anclaje.y);
  ctx.rotate(anclaje.angulo);
  ctx.scale(anclaje.escala, anclaje.escala);
  ctx.drawImage(imagen, -anclaje.anclaX, -anclaje.anclaY);
  ctx.restore();
}

export function dibujarTextos(ctx, carrera, disposicion, alfa = 1) {
  if (!carrera || alfa <= 0) return;
  const { texto, ancho } = disposicion;

  ctx.save();
  ctx.globalAlpha = alfa;
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 18;

  ctx.fillStyle = carrera.color;
  ctx.font = `700 ${texto.tamanoNombre}px system-ui, sans-serif`;
  ctx.fillText(carrera.nombre, ancho / 2, texto.nombreY);

  if (carrera.frase) {
    ctx.fillStyle = '#ffffff';
    ctx.font = `400 ${texto.tamanoFrase}px system-ui, sans-serif`;
    ctx.fillText(carrera.frase, ancho / 2, texto.fraseY);
  }
  ctx.restore();
}

export function dibujarInvitacion(ctx, disposicion, pulso) {
  const { ancho, alto, texto } = disposicion;
  ctx.save();
  ctx.globalAlpha = 0.65 + 0.35 * pulso;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 24;
  ctx.font = `700 ${texto.tamanoNombre}px system-ui, sans-serif`;
  ctx.fillText('Sentate frente al espejo', ancho / 2, alto * 0.5);
  ctx.font = `400 ${texto.tamanoFrase}px system-ui, sans-serif`;
  ctx.fillText('y descubrí tu ingeniería', ancho / 2, alto * 0.5 + texto.tamanoNombre);
  ctx.restore();
}
```

Cuando falta un PNG se dibuja un círculo del color de la carrera. Es lo que permite tener el sistema entero andando y probado antes de que diseño entregue el primer archivo, y lo que evita que un nombre mal escrito deje la pantalla en negro con público delante.

- [ ] **Paso 5: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 6: Commit**

```bash
git add espejo/imagenes.js espejo/escena.js tests/espejo/imagenes.test.js tests/espejo/escena.test.js
git commit -m "feat: banco de imagenes con caida elegante y dibujo de la escena"
```

---

### Tarea 11: Niebla del sorteo y la revelación

**Archivos:**
- Crear: `espejo/niebla.js`
- Probar: `tests/espejo/niebla.test.js`

**Interfaces:**
- Consume: `ESTADOS` y `CONFIG.tiempos`.
- Produce:
  - `calcularNiebla({ estado, transcurrido, tiempos })` → `{ cobertura: 0..1, revelado: 0..1 }`
  - `crearNiebla({ cantidad, azar })` → `{ actualizar(dt), dibujar(ctx, disposicion, { cobertura, revelado, centro }) }`
- `cobertura` es cuánta niebla hay. `revelado` es cuánto se abrió el agujero alrededor de la cara. Separarlos deja que la revelación se anime sin que la niebla desaparezca de golpe.

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/espejo/niebla.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { calcularNiebla } from '../../espejo/niebla.js';
import { ESTADOS } from '../../espejo/maquina-estados.js';

const TIEMPOS = { sorteo: 3000, revelacion: 2000, cierre: 4000 };
const en = (estado, transcurrido) => calcularNiebla({ estado, transcurrido, tiempos: TIEMPOS });

describe('calcularNiebla', () => {
  it('no hay niebla en atraccion ni en enganche', () => {
    expect(en(ESTADOS.ATRACCION, 0)).toEqual({ cobertura: 0, revelado: 0 });
    expect(en(ESTADOS.ENGANCHE, 1000)).toEqual({ cobertura: 0, revelado: 0 });
  });

  it('la niebla entra rapido al empezar el sorteo', () => {
    expect(en(ESTADOS.SORTEO, 0).cobertura).toBe(0);
    expect(en(ESTADOS.SORTEO, 600).cobertura).toBeCloseTo(0.5);
    expect(en(ESTADOS.SORTEO, 1200).cobertura).toBe(1);
  });

  it('la niebla se queda cerrada el resto del sorteo', () => {
    expect(en(ESTADOS.SORTEO, 2900)).toEqual({ cobertura: 1, revelado: 0 });
  });

  it('en la revelacion la niebla sigue puesta y el agujero se abre', () => {
    expect(en(ESTADOS.REVELACION, 0)).toEqual({ cobertura: 1, revelado: 0 });
    expect(en(ESTADOS.REVELACION, 1000).revelado).toBeCloseTo(0.5);
    expect(en(ESTADOS.REVELACION, 2000)).toEqual({ cobertura: 1, revelado: 1 });
  });

  it('en escena ya no queda nada de niebla', () => {
    expect(en(ESTADOS.ESCENA, 5000)).toEqual({ cobertura: 0, revelado: 1 });
  });

  it('en cierre tampoco', () => {
    expect(en(ESTADOS.CIERRE, 100).cobertura).toBe(0);
  });

  it('nunca devuelve valores fuera de 0 a 1', () => {
    const casos = [
      [ESTADOS.SORTEO, -500], [ESTADOS.SORTEO, 99999],
      [ESTADOS.REVELACION, -100], [ESTADOS.REVELACION, 99999],
    ];
    for (const [estado, t] of casos) {
      const { cobertura, revelado } = en(estado, t);
      expect(cobertura).toBeGreaterThanOrEqual(0);
      expect(cobertura).toBeLessThanOrEqual(1);
      expect(revelado).toBeGreaterThanOrEqual(0);
      expect(revelado).toBeLessThanOrEqual(1);
    }
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- niebla
```

- [ ] **Paso 3: Escribir `espejo/niebla.js`**

```js
import { ESTADOS } from './maquina-estados.js';

const FRACCION_DE_ENTRADA = 0.4;
const acotar = (valor) => Math.min(1, Math.max(0, valor));

export function calcularNiebla({ estado, transcurrido, tiempos }) {
  switch (estado) {
    case ESTADOS.SORTEO:
      return {
        cobertura: acotar(transcurrido / (tiempos.sorteo * FRACCION_DE_ENTRADA)),
        revelado: 0,
      };
    case ESTADOS.REVELACION:
      return { cobertura: 1, revelado: acotar(transcurrido / tiempos.revelacion) };
    case ESTADOS.ESCENA:
      return { cobertura: 0, revelado: 1 };
    default:
      return { cobertura: 0, revelado: 0 };
  }
}

export function crearNiebla({ cantidad, azar = Math.random }) {
  const jirones = Array.from({ length: cantidad }, () => ({
    x: azar(),
    y: azar(),
    radio: 0.18 + azar() * 0.28,
    velocidad: (azar() - 0.5) * 0.06,
    fase: azar() * Math.PI * 2,
  }));

  let tiempo = 0;

  return {
    actualizar(dt) {
      tiempo += dt;
      for (const jiron of jirones) {
        jiron.x += jiron.velocidad * dt;
        if (jiron.x < -0.3) jiron.x = 1.3;
        if (jiron.x > 1.3) jiron.x = -0.3;
      }
    },

    dibujar(ctx, disposicion, { cobertura, revelado, centro }) {
      if (cobertura <= 0) return;
      const { ancho, alto } = disposicion;

      ctx.save();
      ctx.globalAlpha = cobertura;

      for (const jiron of jirones) {
        const x = jiron.x * ancho;
        const y = (jiron.y + Math.sin(tiempo * 0.4 + jiron.fase) * 0.02) * alto;
        const radio = jiron.radio * Math.max(ancho, alto) * 0.6;

        const degradado = ctx.createRadialGradient(x, y, 0, x, y, radio);
        degradado.addColorStop(0, 'rgba(232,240,255,0.55)');
        degradado.addColorStop(1, 'rgba(232,240,255,0)');
        ctx.fillStyle = degradado;
        ctx.beginPath();
        ctx.arc(x, y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      if (revelado > 0 && centro) {
        const maximo = Math.hypot(ancho, alto);
        const radio = Math.pow(revelado, 0.7) * maximo;
        ctx.globalCompositeOperation = 'destination-out';
        const agujero = ctx.createRadialGradient(
          centro.x, centro.y, radio * 0.6, centro.x, centro.y, radio,
        );
        agujero.addColorStop(0, 'rgba(0,0,0,1)');
        agujero.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = agujero;
        ctx.beginPath();
        ctx.arc(centro.x, centro.y, radio, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    },
  };
}
```

El agujero se abre con `destination-out`: borra la niebla ya dibujada en vez de pintar encima. Por eso la niebla se dibuja siempre sobre su propia capa y el borrado no toca el video ni los objetos.

- [ ] **Paso 4: Correr y confirmar que pasan**

```bash
npm test
```

- [ ] **Paso 5: Commit**

```bash
git add espejo/niebla.js tests/espejo/niebla.test.js
git commit -m "feat: niebla del sorteo y agujero de revelacion"
```

---

### Tarea 12: Cableado — la experiencia completa

Acá se juntan las once tareas anteriores. Al terminarla, alguien se sienta y vive el ciclo entero.

**Archivos:**
- Reescribir: `espejo/main.js`
- Probar: verificación a ojo con lista de control (el cableado no se prueba con unidades; lo que tenía lógica ya está probado en sus módulos)

**Interfaces:**
- Consume: absolutamente todo lo anterior.
- Produce: `window.espejo` — `{ maquina, contenido, banco, pool, estadoDeCamara(), modo() }`, que es lo que usa la Tarea 13 para los atajos.

- [ ] **Paso 1: Reescribir `espejo/main.js`**

```js
import { CONFIG } from './config.js';
import { cargarContenido } from './contenido.js';
import { crearBanco, cargarImagenDelNavegador } from './imagenes.js';
import { abrirCamara, crearReintentador, dormir } from './camara.js';
import { crearDetectorMediaPipe, crearFuenteSintetica } from './rostro.js';
import { crearFiltroRostro, crearHisteresis } from './suavizado.js';
import { crearSorteo } from './sorteo.js';
import { crearMaquina, ESTADOS } from './maquina-estados.js';
import { crearPool } from './objetos.js';
import { crearCuerpo } from './fisica.js';
import { crearNiebla, calcularNiebla } from './niebla.js';
import {
  calcularDisposicion, dibujarVideoEspejado, dibujarObjetos,
  dibujarAccesorio, dibujarTextos, dibujarInvitacion,
} from './escena.js';
import { crearBus } from './bus.js';
import { mensajeCarrera, mensajeReposo } from '../comun/protocolo.js';

// ---------- lienzos ----------
const lienzo = document.getElementById('lienzo');
const ctx = lienzo.getContext('2d');
const capaNiebla = document.createElement('canvas');
const ctxNiebla = capaNiebla.getContext('2d');

let disposicion = calcularDisposicion(1, 1);

function ajustar() {
  lienzo.width = capaNiebla.width = window.innerWidth;
  lienzo.height = capaNiebla.height = window.innerHeight;
  disposicion = calcularDisposicion(lienzo.width, lienzo.height);
}
ajustar();
window.addEventListener('resize', ajustar);

// ---------- contenido ----------
const contenido = await cargarContenido();
const banco = crearBanco({ cargar: cargarImagenDelNavegador, raiz: '/contenido/' });
const informe = await banco.precargar(contenido.todasLasImagenes());
if (informe.faltantes.length > 0) {
  console.warn(`Faltan ${informe.faltantes.length} de ${informe.total} imagenes:`, informe.faltantes);
}

// ---------- rostro ----------
let modo = 'camara';
let estadoDeCamara = { lista: false };

const camara = crearReintentador({
  abrir: () =>
    abrirCamara({
      ancho: CONFIG.deteccion.anchoCamara,
      alto: CONFIG.deteccion.altoCamara,
      obtenerMedia: (pedido) => navigator.mediaDevices.getUserMedia(pedido),
    }),
  reintentoMs: 5000,
  alEstado: (estado) => {
    estadoDeCamara = estado;
    if (!estado.lista) console.warn('camara:', estado.error);
  },
  dormir,
});

const detector = await crearDetectorMediaPipe({
  base: '/vendor/mediapipe',
  ancho: lienzo.width,
  alto: lienzo.height,
  indices: CONFIG.deteccion.indices,
  factorRadio: CONFIG.deteccion.factorRadio,
  ventanaConfianza: CONFIG.deteccion.ventanaConfianza,
});
const sintetica = crearFuenteSintetica({ ancho: lienzo.width, alto: lienzo.height });

const filtro = crearFiltroRostro(CONFIG.suavizado);
const histeresis = crearHisteresis(CONFIG.presencia);

// ---------- logica ----------
const sorteo = crearSorteo({ ids: contenido.ids });
const maquina = crearMaquina({ tiempos: CONFIG.tiempos, sortear: () => sorteo.siguiente() });
const pool = crearPool(CONFIG.objetos);
const niebla = crearNiebla({ cantidad: 26 });

const bus = crearBus({
  url: `ws://${location.hostname}:${CONFIG.red.puerto}`,
  reconexionMs: CONFIG.red.reconexionMs,
  alEstado: (estado) => console.log('bus:', estado),
});

let ultimoLatido = 0;
let ultimoAnuncio = null;

function atender(eventos) {
  for (const evento of eventos) {
    if (evento.tipo === 'carrera') {
      ultimoAnuncio = mensajeCarrera(evento.id, evento.sesion);
      bus.enviar(ultimoAnuncio);
    }
    if (evento.tipo === 'reposo') {
      ultimoAnuncio = mensajeReposo();
      bus.enviar(ultimoAnuncio);
    }
    if (evento.tipo === 'entra' && evento.estado === ESTADOS.ATRACCION) {
      pool.vaciar();
    }
  }
}

// ---------- aparicion de objetos ----------
let proximaAparicion = 0;

function fuenteDeObjetos(estado, carrera) {
  if (estado === ESTADOS.ESCENA && carrera) return carrera.objetos;
  if (estado === ESTADOS.ATRACCION || estado === ESTADOS.SORTEO) {
    return contenido.carreras.flatMap((c) => c.objetos);
  }
  return null;
}

function aparecerObjeto(definicion, ahora) {
  const radio = (definicion.escala * disposicion.unidad) / 2;
  pool.aparecer(
    definicion,
    crearCuerpo({
      x: radio + Math.random() * (disposicion.ancho - radio * 2),
      y: -radio,
      vx: (Math.random() - 0.5) * 120,
      vy: 60 + Math.random() * 120,
      radio,
      giro: Math.random() * Math.PI * 2,
      velocidadGiro: (Math.random() - 0.5) * 2.5,
    }),
    ahora,
  );
}

// ---------- bucle ----------
let anterior = performance.now();
let ultimaDeteccion = 0;
let rostro = null;
const intervaloDeteccion = 1000 / CONFIG.deteccion.fpsObjetivo;

function cuadro(ahora) {
  const dt = Math.min(0.05, (ahora - anterior) / 1000);
  anterior = ahora;

  // --- deteccion ---
  const camaraLista = camara.obtener();
  if (ahora - ultimaDeteccion >= intervaloDeteccion) {
    ultimaDeteccion = ahora;
    const crudo =
      modo === 'demo'
        ? sintetica.detectar(ahora)
        : camaraLista
          ? detector.detectar(camaraLista.video, ahora)
          : null;

    const habia = histeresis.presente();
    const hay = histeresis.actualizar(Boolean(crudo), ahora);
    if (habia && !hay) filtro.reiniciar();
    rostro = hay ? filtro.filtrar(crudo) : null;
  }

  // --- estado ---
  const salida = maquina.actualizar({ hayRostro: Boolean(rostro), ahora });
  atender(salida.eventos);

  if (ahora - ultimoLatido >= CONFIG.red.latidoMs) {
    ultimoLatido = ahora;
    if (ultimoAnuncio) bus.enviar(ultimoAnuncio);
  }

  const estado = salida.estado;
  const carrera = salida.carrera ? contenido.obtener(salida.carrera) : null;

  // --- fisica ---
  const fuente = fuenteDeObjetos(estado, carrera);
  if (fuente && ahora >= proximaAparicion) {
    const intervalo =
      estado === ESTADOS.ATRACCION ? CONFIG.objetos.intervaloAparicion * 3 : CONFIG.objetos.intervaloAparicion;
    proximaAparicion = ahora + intervalo;
    aparecerObjeto(fuente[Math.floor(Math.random() * fuente.length)], ahora);
  }

  pool.actualizar(dt, ahora, {
    ...CONFIG.fisica,
    caja: disposicion.caja,
    cabeza: rostro ? { x: rostro.centro.x, y: rostro.centro.y, radio: rostro.radio } : null,
  });
  niebla.actualizar(dt);

  // --- dibujo ---
  ctx.clearRect(0, 0, disposicion.ancho, disposicion.alto);

  const dormido = estado === ESTADOS.ATRACCION;
  if (camaraLista || modo === 'demo') {
    if (camaraLista) {
      dibujarVideoEspejado(ctx, camaraLista.video, disposicion, {
        desenfoque: dormido ? 10 : 0,
        brillo: dormido ? 0.45 : 1,
      });
    } else {
      ctx.fillStyle = '#101418';
      ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
    }
  } else {
    ctx.fillStyle = '#101418';
    ctx.fillRect(0, 0, disposicion.ancho, disposicion.alto);
  }

  dibujarObjetos(ctx, pool.vivos(), banco, carrera?.color ?? '#8899aa');

  if (estado === ESTADOS.ESCENA || estado === ESTADOS.REVELACION) {
    dibujarAccesorio(ctx, rostro, carrera, banco);
  }

  const capa = calcularNiebla({
    estado,
    transcurrido: ahora - maquina.desdeCuando(),
    tiempos: CONFIG.tiempos,
  });
  if (capa.cobertura > 0) {
    ctxNiebla.clearRect(0, 0, disposicion.ancho, disposicion.alto);
    niebla.dibujar(ctxNiebla, disposicion, { ...capa, centro: rostro?.centro });
    ctx.drawImage(capaNiebla, 0, 0);
  }

  if (estado === ESTADOS.ATRACCION) {
    dibujarInvitacion(ctx, disposicion, (Math.sin(ahora / 700) + 1) / 2);
  } else if (estado === ESTADOS.REVELACION || estado === ESTADOS.ESCENA) {
    dibujarTextos(ctx, carrera, disposicion, 1);
  } else if (estado === ESTADOS.CIERRE) {
    dibujarTextos(ctx, carrera, disposicion, Math.max(0, 1 - (ahora - maquina.desdeCuando()) / CONFIG.tiempos.cierre));
  }

  requestAnimationFrame(cuadro);
}

window.espejo = {
  maquina,
  contenido,
  banco,
  pool,
  bus,
  estadoDeCamara: () => estadoDeCamara,
  modo: () => modo,
  cambiarModo: (nuevo) => { modo = nuevo; filtro.reiniciar(); },
};

requestAnimationFrame(cuadro);
```

- [ ] **Paso 2: Agregar `desdeCuando()` a la máquina de estados**

`main.js` necesita saber hace cuánto está en el estado actual para animar la niebla y el desvanecido. Agregar a `espejo/maquina-estados.js`, junto a `estado()`:

```js
    desdeCuando: () => desde,
```

Y la prueba correspondiente en `tests/espejo/maquina-estados.test.js`:

```js
  it('informa desde cuando esta en el estado actual', () => {
    const maquina = nueva();
    maquina.actualizar({ hayRostro: true, ahora: 1500 });
    expect(maquina.desdeCuando()).toBe(1500);
  });
```

- [ ] **Paso 3: Correr las pruebas**

```bash
npm test
```

Esperado: PASAN todas, incluida la nueva.

- [ ] **Paso 4: Verificar a ojo el ciclo completo**

Correr `herramientas\arrancar.bat` y sentarse frente a la cámara. Confirmar en orden:

1. **Sin nadie:** video oscurecido y desenfocado, texto "Sentate frente al espejo" latiendo, algún objeto cayendo de a poco.
2. **Al sentarse:** el video se aclara y se enfoca.
3. **A los dos segundos:** entra la niebla y tapa la pantalla.
4. **A los tres segundos más:** la niebla se abre desde tu cara, aparece el nombre de una carrera con su color y su frase.
5. **En la escena:** caen objetos de esa carrera, **rebotan contra tu cabeza** y se apilan en el piso. Movete: los objetos siguen tu cabeza.
6. **Levantate y andate:** a los tres segundos todo se desvanece y vuelve la invitación.
7. **Volvé a sentarte enseguida:** no arranca de nuevo hasta pasados tres segundos.
8. **Repetir seis veces:** salen las seis carreras antes de repetirse ninguna.

Mientras no haya PNG, los objetos son círculos del color de la carrera y el accesorio no aparece. Es lo esperado.

Anotar los FPS en la máquina real. Si baja de 30 con cuarenta objetos en pantalla, en este orden: bajar `CONFIG.objetos.maximo` a 25, después la resolución de cámara.

- [ ] **Paso 5: Commit**

```bash
git add espejo/main.js espejo/maquina-estados.js tests/espejo/maquina-estados.test.js
git commit -m "feat: cableado completo de la experiencia del espejo"
```

---

### Tarea 13: Operación — atajos, FPS, modo demo y recarga

Todo lo que necesita el equipo del stand cuando algo se traba y hay quince personas en la fila.

**Archivos:**
- Crear: `espejo/operacion.js`
- Modificar: `espejo/main.js`
- Probar: `tests/espejo/operacion.test.js`

**Interfaces:**
- Consume: `window.espejo` de la Tarea 12.
- Produce:
  - `crearContadorFps({ ventana })` → `{ registrar(ahora), valor() }`
  - `interpretarTecla(tecla, ids)` → `{ accion: 'forzar', id }` · `{ accion: 'reiniciar' }` · `{ accion: 'panel' }` · `{ accion: 'demo' }` · `{ accion: 'recargar' }` · `null`
  - `instalarOperacion({ espejo, ventana, tiempos })` — engancha teclado y recarga programada

**Atajos:**

| Tecla | Qué hace |
|---|---|
| `1`–`6` | Fuerza esa carrera y salta a la revelación |
| `R` | Reinicia la sesión y vuelve a la invitación |
| `D` | Alterna el modo demo (rostro sintético, sin cámara) |
| `P` | Muestra u oculta el panel de estado |
| `F5` / `Ctrl+R` | Los de Chrome, siempre disponibles |

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/espejo/operacion.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { crearContadorFps, interpretarTecla } from '../../espejo/operacion.js';

const IDS = ['mecanica', 'electrica', 'computacion', 'fisico-matematico', 'civil', 'quimica'];

describe('interpretarTecla', () => {
  it('las teclas 1 a 6 fuerzan la carrera de esa posicion', () => {
    expect(interpretarTecla('1', IDS)).toEqual({ accion: 'forzar', id: 'mecanica' });
    expect(interpretarTecla('6', IDS)).toEqual({ accion: 'forzar', id: 'quimica' });
  });

  it('ignora numeros sin carrera detras', () => {
    expect(interpretarTecla('7', IDS)).toBeNull();
    expect(interpretarTecla('0', IDS)).toBeNull();
    expect(interpretarTecla('3', ['a', 'b'])).toBeNull();
  });

  it('reconoce las acciones sueltas sin importar mayusculas', () => {
    expect(interpretarTecla('r', IDS)).toEqual({ accion: 'reiniciar' });
    expect(interpretarTecla('R', IDS)).toEqual({ accion: 'reiniciar' });
    expect(interpretarTecla('d', IDS)).toEqual({ accion: 'demo' });
    expect(interpretarTecla('P', IDS)).toEqual({ accion: 'panel' });
  });

  it('no hace nada con cualquier otra tecla', () => {
    for (const tecla of ['a', 'Enter', ' ', 'Escape']) {
      expect(interpretarTecla(tecla, IDS)).toBeNull();
    }
  });
});

describe('crearContadorFps', () => {
  it('calcula los cuadros por segundo de la ventana reciente', () => {
    const contador = crearContadorFps({ ventana: 4 });
    for (let i = 0; i <= 4; i++) contador.registrar(i * 20);
    expect(contador.valor()).toBeCloseTo(50, 0);
  });

  it('vale cero hasta tener dos muestras', () => {
    const contador = crearContadorFps({ ventana: 4 });
    expect(contador.valor()).toBe(0);
    contador.registrar(0);
    expect(contador.valor()).toBe(0);
  });

  it('olvida lo viejo al pasar la ventana', () => {
    const contador = crearContadorFps({ ventana: 3 });
    contador.registrar(0);
    contador.registrar(1000);
    contador.registrar(1016);
    contador.registrar(1032);
    contador.registrar(1048);
    expect(contador.valor()).toBeGreaterThan(50);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- operacion
```

- [ ] **Paso 3: Escribir `espejo/operacion.js`**

```js
const ACCIONES_SUELTAS = { r: 'reiniciar', d: 'demo', p: 'panel' };

export function interpretarTecla(tecla, ids) {
  if (/^[1-9]$/.test(tecla)) {
    const indice = Number(tecla) - 1;
    return indice < ids.length ? { accion: 'forzar', id: ids[indice] } : null;
  }
  const accion = ACCIONES_SUELTAS[tecla.toLowerCase()];
  return accion ? { accion } : null;
}

export function crearContadorFps({ ventana }) {
  const marcas = [];
  return {
    registrar(ahora) {
      marcas.push(ahora);
      while (marcas.length > ventana + 1) marcas.shift();
    },
    valor() {
      if (marcas.length < 2) return 0;
      const lapso = marcas.at(-1) - marcas[0];
      return lapso <= 0 ? 0 : ((marcas.length - 1) * 1000) / lapso;
    },
  };
}

export function instalarOperacion({ espejo, ventana = window, tiempos, recargar = () => location.reload() }) {
  const panel = document.createElement('pre');
  panel.style.cssText = `
    position: fixed; top: 12px; left: 12px; margin: 0; padding: 10px 14px;
    font: 14px/1.5 monospace; color: #0f0; background: rgba(0,0,0,0.72);
    border-radius: 6px; white-space: pre; pointer-events: none; display: none; z-index: 9;
  `;
  document.body.appendChild(panel);

  const fps = crearContadorFps({ ventana: 60 });
  let visible = false;

  ventana.addEventListener('keydown', (evento) => {
    const orden = interpretarTecla(evento.key, espejo.contenido.ids);
    if (!orden) return;
    evento.preventDefault();
    const ahora = performance.now();

    if (orden.accion === 'forzar') espejo.maquina.forzarCarrera(orden.id, ahora);
    if (orden.accion === 'reiniciar') espejo.maquina.reiniciar(ahora);
    if (orden.accion === 'demo') espejo.cambiarModo(espejo.modo() === 'demo' ? 'camara' : 'demo');
    if (orden.accion === 'panel') {
      visible = !visible;
      panel.style.display = visible ? 'block' : 'none';
    }
  });

  ventana.setInterval(() => {
    if (espejo.maquina.estado() === 'ATRACCION') recargar();
  }, tiempos.recargaCadaMs);

  return {
    registrarCuadro(ahora) {
      fps.registrar(ahora);
      if (!visible) return;
      const faltantes = espejo.banco.faltantes().length;
      panel.textContent = [
        `fps        ${fps.valor().toFixed(0)}`,
        `estado     ${espejo.maquina.estado()}`,
        `carrera    ${espejo.maquina.carrera() ?? '-'}`,
        `sesion     ${espejo.maquina.sesion()}`,
        `modo       ${espejo.modo()}`,
        `camara     ${espejo.estadoDeCamara().lista ? 'ok' : espejo.estadoDeCamara().error ?? 'sin camara'}`,
        `bus        ${espejo.bus.conectado() ? 'conectado' : 'cortado'}`,
        `objetos    ${espejo.pool.vivos().length}`,
        `png faltan ${faltantes}`,
      ].join('\n');
    },
  };
}
```

- [ ] **Paso 4: Enchufarlo en `main.js`**

Al final de `main.js`, después de definir `window.espejo` y antes del `requestAnimationFrame` final:

```js
import { instalarOperacion } from './operacion.js';   // junto al resto de los imports

const operacion = instalarOperacion({ espejo: window.espejo, tiempos: CONFIG.operacion });
```

Y como primera línea dentro de `cuadro(ahora)`:

```js
  operacion.registrarCuadro(ahora);
```

- [ ] **Paso 5: Verificar a ojo**

Con `arrancar.bat` andando:
1. `P` muestra el panel con FPS, estado, carrera y cámara. `P` de nuevo lo oculta.
2. `1` a `6` saltan a la revelación de cada carrera, en el orden de `carreras.json`.
3. `R` corta y vuelve a la invitación.
4. `D` entra en modo demo: aparece un rostro sintético que se mueve solo y el ciclo corre sin cámara. `D` de nuevo vuelve a la cámara.
5. Con la cámara desenchufada, el panel dice que no hay cámara y la pantalla muestra la invitación, no un error.

- [ ] **Paso 6: Commit**

```bash
git add espejo/operacion.js espejo/main.js tests/espejo/operacion.test.js
git commit -m "feat: atajos de operacion, panel de estado, modo demo y recarga programada"
```

---

### Tarea 14: Tablets

**Archivos:**
- Crear: `tablet/tablet.html`, `tablet/tablet.js`
- Probar: `tests/tablet/tablet.test.js`

**Interfaces:**
- Consume: `comun/protocolo.js`, `espejo/contenido.js`, `espejo/bus.js`.
- Produce:
  - `elegirReferente(carrera, slot)` → referente o `null`
  - `crearTablet({ slot, contenido, pantalla })` → `{ recibir(mensaje) }`
  - `pantalla` es `{ mostrar(referente, carrera), ocultar() }` — toda la parte de DOM vive detrás de esa interfaz, y por eso la lógica se prueba en Node.
- La tablet **no decide nada**: recibe un mensaje y reacciona. Toda la inteligencia está en el espejo.

- [ ] **Paso 1: Escribir la prueba que falla**

`tests/tablet/tablet.test.js`:

```js
import { describe, it, expect, vi } from 'vitest';
import { elegirReferente, crearTablet } from '../../tablet/tablet.js';

const CIVIL = {
  id: 'civil',
  nombre: 'Ingeniería Civil',
  color: '#FF8A3D',
  referentes: [
    { video: 'videos/civil/ana.mp4', nombre: 'Ana Pérez', detalle: 'Egresada' },
    { video: 'videos/civil/sol.mp4', nombre: 'Sol Díaz', detalle: 'Docente' },
  ],
};

const contenido = { obtener: (id) => (id === 'civil' ? CIVIL : null) };
const pantallaFalsa = () => ({ mostrar: vi.fn(), ocultar: vi.fn() });

describe('elegirReferente', () => {
  it('elige por slot', () => {
    expect(elegirReferente(CIVIL, 0).nombre).toBe('Ana Pérez');
    expect(elegirReferente(CIVIL, 1).nombre).toBe('Sol Díaz');
  });

  it('da la vuelta cuando hay mas tablets que referentes', () => {
    expect(elegirReferente(CIVIL, 2).nombre).toBe('Ana Pérez');
    expect(elegirReferente(CIVIL, 5).nombre).toBe('Sol Díaz');
  });

  it('devuelve null si no hay carrera o no hay referentes', () => {
    expect(elegirReferente(null, 0)).toBeNull();
    expect(elegirReferente({ referentes: [] }, 0)).toBeNull();
  });
});

describe('crearTablet', () => {
  it('muestra la referente que le toca al recibir una carrera', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 1, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
    expect(pantalla.mostrar.mock.calls[0][0].nombre).toBe('Sol Díaz');
    expect(pantalla.mostrar.mock.calls[0][1]).toBe(CIVIL);
  });

  it('ignora el latido repetido de la misma sesion', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
  });

  it('reacciona a una sesion nueva', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 4 });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 5 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(2);
  });

  it('se apaga con reposo', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });
    tablet.recibir({ tipo: 'reposo' });

    expect(pantalla.ocultar).toHaveBeenCalledTimes(1);
  });

  it('no vuelve a encenderse con un latido viejo despues del reposo', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });
    tablet.recibir({ tipo: 'reposo' });
    tablet.recibir({ tipo: 'carrera', id: 'civil', sesion: 1 });

    expect(pantalla.mostrar).toHaveBeenCalledTimes(1);
  });

  it('aguanta una carrera que no existe sin romperse', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    expect(() => tablet.recibir({ tipo: 'carrera', id: 'inventada', sesion: 1 })).not.toThrow();
    expect(pantalla.mostrar).not.toHaveBeenCalled();
  });

  it('repetir reposo no molesta', () => {
    const pantalla = pantallaFalsa();
    const tablet = crearTablet({ slot: 0, contenido, pantalla });

    tablet.recibir({ tipo: 'reposo' });
    tablet.recibir({ tipo: 'reposo' });

    expect(pantalla.ocultar).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Paso 2: Correr y confirmar que falla**

```bash
npm test -- tablet
```

- [ ] **Paso 3: Escribir `tablet/tablet.js`**

```js
export function elegirReferente(carrera, slot) {
  if (!carrera?.referentes?.length) return null;
  return carrera.referentes[slot % carrera.referentes.length];
}

export function crearTablet({ slot, contenido, pantalla }) {
  let ultimaSesion = null;

  return {
    recibir(mensaje) {
      if (mensaje.tipo === 'reposo') {
        pantalla.ocultar();
        return;
      }
      if (mensaje.sesion === ultimaSesion) return;

      const carrera = contenido.obtener(mensaje.id);
      const referente = elegirReferente(carrera, slot);
      if (!referente) return;

      ultimaSesion = mensaje.sesion;
      pantalla.mostrar(referente, carrera);
    },
  };
}

export function crearPantallaDeVideo({ video, rotulo, nombre, detalle, raiz = '/contenido/' }) {
  return {
    mostrar(referente, carrera) {
      nombre.textContent = referente.nombre;
      detalle.textContent = referente.detalle ?? '';
      rotulo.style.borderColor = carrera.color;
      nombre.style.color = carrera.color;

      const fuente = raiz + referente.video;
      if (!video.src.endsWith(referente.video)) video.src = fuente;
      video.currentTime = 0;
      video.play().catch(() => { /* el navegador lo rechazo; queda el cartel */ });
      document.body.classList.add('encendida');
    },
    ocultar() {
      document.body.classList.remove('encendida');
      video.pause();
    },
  };
}
```

- [ ] **Paso 4: Escribir `tablet/tablet.html`**

```html
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Referente</title>
  <style>
    html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
    body { opacity: 0; transition: opacity .6s ease; }
    body.encendida { opacity: 1; }
    video { position: fixed; inset: 0; width: 100%; height: 100%; object-fit: cover; background: #000; }
    #rotulo {
      position: fixed; left: 0; right: 0; bottom: 0; padding: 4vh 5vw;
      background: linear-gradient(transparent, rgba(0,0,0,.85));
      border-bottom: 6px solid #fff; font-family: system-ui, sans-serif; text-align: center;
    }
    #nombre { font-size: 5vh; font-weight: 700; margin: 0; }
    #detalle { font-size: 3vh; color: #fff; opacity: .85; margin: .4em 0 0; }
  </style>
</head>
<body>
  <video id="video" muted playsinline loop preload="auto"></video>
  <div id="rotulo">
    <p id="nombre"></p>
    <p id="detalle"></p>
  </div>
  <script type="module">
    import { cargarContenido } from '../espejo/contenido.js';
    import { crearBus } from '../espejo/bus.js';
    import { CONFIG } from '../espejo/config.js';
    import { crearTablet, crearPantallaDeVideo, elegirReferente } from './tablet.js';

    const slot = Number(new URLSearchParams(location.search).get('slot') ?? 0);
    const contenido = await cargarContenido();

    // Precarga: sin esto, el primer video de cada carrera arranca con un parpadeo.
    for (const carrera of contenido.carreras) {
      const referente = elegirReferente(carrera, slot);
      if (!referente) continue;
      const previo = document.createElement('video');
      previo.preload = 'auto';
      previo.muted = true;
      previo.src = '/contenido/' + referente.video;
      previo.load();
    }

    const pantalla = crearPantallaDeVideo({
      video: document.getElementById('video'),
      rotulo: document.getElementById('rotulo'),
      nombre: document.getElementById('nombre'),
      detalle: document.getElementById('detalle'),
    });
    const tablet = crearTablet({ slot, contenido, pantalla });

    crearBus({
      url: `ws://${location.hostname}:${CONFIG.red.puerto}`,
      reconexionMs: CONFIG.red.reconexionMs,
      alMensaje: (mensaje) => tablet.recibir(mensaje),
      alEstado: (estado) => console.log('bus:', estado),
    });
  </script>
</body>
</html>
```

El video va `muted` + `playsinline` + `loop`. Al ser mudo, el autoplay está permitido en todos los navegadores, iPad incluido: no hace falta que nadie toque la pantalla al abrir el stand.

- [ ] **Paso 5: Correr las pruebas**

```bash
npm test
```

- [ ] **Paso 6: Verificar con tablets de verdad**

1. Averiguar la IP de la PC: `ipconfig`.
2. En cada tablet, abrir `http://<ip>:8080/tablet/tablet.html?slot=0`, `?slot=1`, `?slot=2`… uno distinto por tablet.
3. Ponerlas en pantalla completa (Chrome Android: menú → *Añadir a pantalla de inicio*; Safari iPad: compartir → *Añadir a pantalla de inicio*).
4. Sentarse frente al espejo y confirmar: al despejarse la niebla, **las tablets arrancan juntas**, cada una con una referente distinta; al terminar, se apagan todas.
5. Apagar el wifi de una tablet diez segundos y volver a encenderlo: se reconecta sola y se pone al día en la sesión siguiente sin que nadie la toque.
6. Cerrar y reabrir la pestaña a mitad de una sesión: la tablet retoma el video correcto de inmediato, gracias al último mensaje que guarda el servidor.

- [ ] **Paso 7: Commit**

```bash
git add tablet tests/tablet
git commit -m "feat: tablets que reproducen a las referentes segun la carrera sorteada"
```

---

### Tarea 15: Sin internet, contenido real y guía de operación

**Archivos:**
- Crear: `docs/operacion.md`
- Modificar: `contenido/carreras.json` (referentes reales), `tests/contenido/reales.test.js`
- Probar: `tests/contenido/reales.test.js`

**Interfaces:**
- Consume: todo lo anterior.
- Produce: una prueba que falla si el contenido quedó con datos de relleno, y un documento que le sirve a alguien que no escribió una línea de este proyecto.

- [ ] **Paso 1: Escribir la prueba que exige contenido real**

`tests/contenido/reales.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validarContenido } from '../../espejo/contenido.js';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CONTENIDO = resolve(RAIZ, 'contenido');

const leer = async () => JSON.parse(await readFile(resolve(CONTENIDO, 'carreras.json'), 'utf8'));
const existe = async (ruta) => access(resolve(CONTENIDO, ruta)).then(() => true, () => false);

const IDS_ESPERADOS = [
  'mecanica', 'electrica', 'computacion', 'fisico-matematico', 'civil', 'quimica',
];

describe('contenido real', () => {
  it('pasa la validacion del sistema', async () => {
    expect(validarContenido(await leer())).toEqual([]);
  });

  it('tiene las seis carreras acordadas', async () => {
    const datos = await leer();
    expect(datos.carreras.map((c) => c.id).sort()).toEqual([...IDS_ESPERADOS].sort());
  });

  it('no quedo ningun nombre de relleno', async () => {
    const datos = await leer();
    for (const carrera of datos.carreras) {
      for (const referente of carrera.referentes) {
        expect(referente.nombre).not.toMatch(/Nombre Apellido|prueba|placeholder/i);
        expect(referente.video).not.toMatch(/prueba/i);
      }
    }
  });

  it('cada carrera tiene al menos seis objetos', async () => {
    const datos = await leer();
    for (const carrera of datos.carreras) {
      expect(carrera.objetos.length, `${carrera.id} tiene pocos objetos`).toBeGreaterThanOrEqual(6);
    }
  });

  it('todos los colores son distintos entre si', async () => {
    const datos = await leer();
    const colores = datos.carreras.map((c) => c.color.toUpperCase());
    expect(new Set(colores).size).toBe(colores.length);
  });

  it('todos los PNG declarados existen en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      for (const ruta of [carrera.accesorio.img, ...carrera.objetos.map((o) => o.img)]) {
        if (!(await existe(ruta))) faltantes.push(ruta);
      }
    }
    expect(faltantes).toEqual([]);
  });

  it('todos los videos declarados existen en el disco', async () => {
    const datos = await leer();
    const faltantes = [];
    for (const carrera of datos.carreras) {
      for (const referente of carrera.referentes) {
        if (!(await existe(referente.video))) faltantes.push(referente.video);
      }
    }
    expect(faltantes).toEqual([]);
  });
});
```

Esta prueba va a fallar hasta que lleguen los PNG y los videos. **Es a propósito.** Es el semáforo del proyecto: mientras esté en rojo, el sistema anda pero el contenido no está listo. El día que pasa entera, se puede montar el stand.

- [ ] **Paso 2: Cargar el contenido real a medida que llega**

Reemplazar en `contenido/carreras.json` los `referentes` de relleno por los datos verdaderos, y dejar los PNG en `contenido/assets/<carrera>/` y los MP4 en `contenido/videos/<carrera>/`. Correr `npm test -- reales` después de cada entrega para ver qué falta.

- [ ] **Paso 3: Prueba sin internet**

1. Desenchufar el cable de red y apagar el wifi de la PC.
2. Correr `herramientas\arrancar.bat`.
3. Confirmar que el ciclo entero funciona: invitación, enganche, niebla, revelación, escena, cierre.
4. Abrir la consola (F12) y confirmar que **no hay ni un pedido fallido** a un dominio externo. Filtrar la pestaña *Red* por `Dominio` y verificar que sólo aparece `localhost`.

Si aparece algo apuntando a `storage.googleapis.com` o a un CDN, es que MediaPipe no quedó bien copiado: revisar el Paso 1 de la Tarea 2.

- [ ] **Paso 4: Escribir `docs/operacion.md`**

````markdown
# Espejo Mágico — Operación del stand

## Qué hay que hacer para prender todo

1. Encender el router. Esperar a que quede la luz de wifi fija.
2. Encender la PC del espejo.
3. Doble clic en `herramientas\arrancar.bat`. Aparece una ventana negra chica (el
   servidor) y Chrome a pantalla completa. **No cerrar la ventana negra.**
4. Encender las tablets. Cada una abre sola su página si quedó guardada en la pantalla
   de inicio. Si no, abrir `http://IP-DE-LA-PC:8080/tablet/tablet.html?slot=N`, con un
   número distinto en cada tablet, empezando por 0.
5. Sentarse frente al espejo y hacer una prueba completa antes de que entre el público.

## Para apagar

Cerrar Chrome con Alt+F4 y después la ventana negra del servidor.

## Atajos, en la PC del espejo

| Tecla | Qué hace |
|---|---|
| `1` a `6` | Fuerza una carrera y salta directo a la revelación |
| `R` | Corta la sesión y vuelve a la invitación |
| `D` | Modo demo: funciona sin cámara, con un rostro simulado |
| `P` | Muestra u oculta el panel de estado |
| `Ctrl` + `R` | Recarga todo |

## Si algo anda mal

**La pantalla dice "Sentate frente al espejo" y no reacciona a nadie.**
Apretar `P` y mirar la línea `camara`. Si dice algo distinto de `ok`, revisar el cable de
la cámara. El sistema reintenta solo cada cinco segundos: al reconectarla, se recupera sin
tocar nada.

**Detecta mal, o detecta sólo a algunas personas.**
Casi siempre es luz. Si hay una ventana o un foco detrás del visitante, la cara queda a
contraluz. Tapar esa fuente o girar el sillón. La luz frontal difusa del stand tiene que
estar encendida.

**Las tablets no arrancan.**
Apretar `P` y mirar la línea `bus`. Si dice `cortado`, el servidor se cayó: cerrar todo y
volver a correr `arrancar.bat`. Si dice `conectado`, el problema es de la tablet: revisar
que esté en el wifi del router del stand y recargar su página.

**Una sola tablet quedó negra.**
Recargar esa página. Se pone al día sola en la sesión siguiente.

**Todo va lento.**
Apretar `P` y mirar `fps`. Debajo de 25 se nota. Cerrar cualquier otro programa de la PC.
Si sigue lento, avisar al equipo técnico: hay que bajar `objetos.maximo` en
`espejo/config.js`.

**Siempre sale la misma carrera.**
No puede pasar: el sistema recorre las seis antes de repetir ninguna. Si pasa, alguien
está apretando las teclas `1` a `6` sin querer.

## Lo que el sistema no hace

No saca fotos, no graba video, no guarda ninguna imagen y no manda nada a internet. La
cámara se procesa dentro de la PC y nada sale de ahí. El cartel del stand lo dice y es
literal.

## Contenido

- Los PNG de cada carrera están en `contenido/assets/<carrera>/`.
- Los videos de las referentes, en `contenido/videos/<carrera>/`.
- Los nombres, colores y frases, en `contenido/carreras.json`.

Para corregir el nombre de una referente **no hay que volver a renderizar el video**: se
edita `carreras.json` y listo. Lo mismo con los colores y las frases.
````

- [ ] **Paso 5: Prueba con público, una semana antes**

No es opcional y no lo cubre ninguna prueba automática. Diez personas ajenas al equipo, una
tarde, en el sitio real o lo más parecido posible. Anotar:

- ¿Treinta segundos de escena son muchos o pocos? Ajustar `CONFIG.tiempos.escena`.
- ¿Queda gente alta o muy baja fuera de cuadro? Ajustar la altura de la cámara o del sillón.
- ¿Los chicos llegan al encuadre? Suele ser el problema más común y el que más se nota.
- ¿Se entiende sin que nadie explique nada?
- ¿Alguien se levantó a mitad y el sistema se recuperó bien?

- [ ] **Paso 6: Correr la suite completa**

```bash
npm test
```

Esperado: PASAN todas, incluidas las de contenido real.

- [ ] **Paso 7: Commit**

```bash
git add contenido docs tests/contenido
git commit -m "docs: guia de operacion del stand y verificacion del contenido real"
```

---

## Revisión del plan contra la especificación

| Sección de la especificación | Dónde queda cubierta |
|---|---|
| 4 · Arquitectura | Tarea 1 (servidor y relé), Tarea 12 (cableado) |
| 5 · Estructura del código | Mapa de archivos; una tarea por módulo |
| 6 · Ciclo de la experiencia | Tarea 8 (estados), Tarea 12 (visual) |
| 6 · Cortes de seguridad | Tarea 8, pruebas de ausencia y tope de sesión |
| 6 · Sorteo con bolsa | Tarea 5 |
| 7 · Detección de rostro | Tarea 2 |
| 7 · Suavizado e histéresis | Tarea 3 |
| 7 · Espejado | Tarea 2, paso de verificación a ojo |
| 7 · Presupuesto de cuadros | Tarea 2 (detección limitada), Tarea 13 (panel de FPS) |
| 7 · Desarrollo sin cámara | Tarea 2 (`crearFuenteSintetica`), Tarea 13 (modo demo) |
| 8 · Anclaje del accesorio | Tarea 6 |
| 9 · Física y presupuesto de objetos | Tarea 7 |
| 9 · Fallo elegante de PNG | Tarea 10 (`crearBanco` + sustituto de color) |
| 9 · Orientación adaptable | Tarea 10 (`calcularDisposicion`) |
| 10 · Contenido como datos | Tarea 4 |
| 11 · Encargo de diseño | Tarea 4 (`carreras.json` declara todo), Tarea 15 (verifica que llegó) |
| 12 · Sincronización con tablets | Tarea 9 (protocolo y bus), Tarea 14 (tablet) |
| 12 · Precarga, reconexión, latido | Tarea 14 (precarga), Tarea 9 (reconexión), Tarea 12 (latido) |
| 13 · Sin internet | Tarea 2 (vendorizado), Tarea 15 (prueba con el cable afuera) |
| 13 · Arranque de un golpe | Tarea 1 (`arrancar.bat`) |
| 13 · Vigilante de cámara | Tarea 2 (`crearReintentador`) |
| 13 · Recarga programada | Tarea 13 |
| 13 · Atajos y modo demo | Tarea 13 |
| 14 · Estrategia de pruebas | Cada tarea abre con su prueba; Tarea 15 cierra con la de contenido |
| 14 · Prueba con público | Tarea 15, paso 5 |
| 15 · Privacidad | Restricción global; Tarea 15 lo verifica en la pestaña de red |
| 16 · Riesgos | Orden de las tareas: el riesgo mayor se ataca en la Tarea 2 |

## Ruta más corta si el tiempo aprieta

El plan de recorte de la especificación, traducido a tareas:

1. **Sin accesorio anclado** → saltear la Tarea 6 y la llamada a `dibujarAccesorio`.
2. **Sin física** → en la Tarea 7, dejar `mundo.cabeza` siempre en `null`.
3. **Menos carreras** → sacar entradas de `carreras.json`. Ni una línea de código.
4. **Sin tablets** → saltear la Tarea 14. El espejo ya emite los mensajes; nadie los escucha.

Las Tareas 1 a 5, 8, 10, 11, 12 y 13 son el mínimo irrenunciable: espejo con detección,
sorteo, niebla, objetos y operación.

