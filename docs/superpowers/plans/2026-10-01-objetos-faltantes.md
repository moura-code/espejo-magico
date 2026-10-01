# Plan: pintar los objetos que faltan en las escenas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los cinco objetos de cada ingeniería estén pintados adentro de su foto, integrados a la escena y no pegados encima: detectar los que el generador no pintó y repintar sólo esos, en su mismo sitio.

**Architecture:** El código ya está en la rama `fix/fondos-mano-y-objetos-faltantes` (commit `62f985c`). Lo que falta es correrlo en una PC con placa NVIDIA:

1. `herramientas/escenas.py --revisar` audita las doce fotos con un juez de presencia (`herramientas/presencia.py`, CLIP en CPU).
2. `--repintar --solo carrera:objeto,...` pinta sólo los ausentes sobre la `imagen.jpg` actual, con el modelo de relleno (SDXL inpainting), y reescribe sólo su recorte y su caja.

El espejo no cambia: los archivos que quedan tienen el mismo formato.

**Tech Stack:** Python 3 con `torch` (CUDA), `diffusers`, `transformers`, `accelerate`, `scipy`, `numpy` y Pillow. Las pruebas de la herramienta usan `unittest`, de la biblioteca estándar.

**Spec:** la sección «Contexto» de este documento, y `docs/contenido.md` › «Los fondos se generan».

## Global Constraints

- Corre en la PC con placa NVIDIA (16 GB de VRAM, CUDA), nunca en el evento. Lo que se versiona son `imagen.jpg`, `recortes/<n>.png` y `metadata.json` de `contenido/carreras/<id>/fondos/escena/`.
- No cambia el formato: `metadata.json` conserva `lugar`, `escondites` y `recortes[{archivo, caja}]`, y la máscara va en el canal alfa del PNG.
- Los sitios (`lugar`, `escondites`) no se mueven: `tests/integracion/fondos.test.js` los valida.
- El índice de un objeto es su lugar en el orden alfabético de sus carpetas, el mismo que arma el catálogo (`servidor/descubrimiento.js`).
- Los objetos que ya están pintados no se tocan: se repinta sólo una lista explícita (`--solo`), revisada a ojo.
- Castellano en identificadores, comentarios y commits; identificadores y comentarios sin tildes.
- `npm test` en verde al terminar. Única excepción conocida: en macOS falla `servidor.test.js` porque no se puede escuchar en 127.0.0.2.

## Review Focus

1. **El juez da por ausente un objeto que está.** Repintarlo lo arruinaría. Por eso `--repintar` exige `--solo` y nunca toma la auditoría cruda; la lista se arma mirando `contenido/objetos-contacto.jpg` (Task 2, paso 3).
2. **Un objeto repintado cae lejos de su sitio.** Su silueta nueva puede quedar corrida del blanco de la mano. `npm test` lo atrapa: `fondos.test.js` exige que el centro de cada recorte quede dentro de su blanco (Task 4, paso 1).
3. **El índice cambiado.** Sería guardar la máscara del motor en el recorte del panel solar. Lo cubre `test_coincide_con_las_carpetas_del_contenido` (Task 1, paso 2).
4. **Sin memoria en la placa.** CLIP corre en CPU a propósito; si igual falta VRAM, la causa es otro proceso usando la placa (Task 0, paso 3).
5. **La foto se gasta.** Repintar sobre lo ya repintado recomprime el JPEG cada vez. Para reintentar una carrera, primero se la restaura con `git checkout` (Task 3, paso 4).

## Contexto

El 2026-10-01 se revisaron a ojo las 60 cajas de objetos, recortadas de las fotos generadas. **En unas 25 no hay ningún objeto pintado**: sólo pared, estantes o luces del techo.

El modelo de relleno a veces no pinta el objeto y se limita a rehacer la superficie. El control de entonces medía cuánto había cambiado la ventana, y una pared repintada también cambia, así que esos intentos pasaban por buenos.

En el espejo eso se ve así:

- un latido que respira sobre una pared vacía;
- una ficha que describe algo que no se ve;
- el «objeto» que se levanta al pasar la mano es un pedazo de pared;
- en Alimentos y Química falta justo el objeto del carrusel: vuela a su lugar y, al aterrizar, desaparece.

Los cuatro del techo (arriba al centro) estaban pedidos «en la pared» y ahí hay techo. Los que se confundían con su superficie eran blanco sobre blanco, acero sobre acero o vidrio. Los textos de esos ya se cambiaron en `GUIONES`.

Lo que se vio a ojo. El número es el índice: el orden alfabético de las carpetas, el mismo de `recortes/<n>.png`.

| Carrera | n | Objeto | A ojo |
|---|---|---|---|
| agrimensura | 3 | prisma-topografico | falta |
| alimentos | 0 | centrifuga | falta (es el del carrusel) |
| alimentos | 1 | equipo-coccion | falta |
| alimentos | 3 | placa-petri | falta |
| civil | 3 | puente-atirantado | falta |
| civil | 4 | viga-acero | falta |
| computacion | 1 | arbol-binario | falta |
| computacion | 2 | base-datos | falta |
| computacion | 3 | laptop | falta |
| computacion | 4 | servidor | falta |
| comunicacion | 2 | bobina-fibra | falta |
| comunicacion | 4 | torre-telecomunicaciones | falta |
| electrica | 1 | motor-trifasico | falta |
| electrica | 3 | panel-solar | falta |
| electrica | 4 | transformador-trifasico | falta |
| fisico-matematico | 3 | prisma-optico | falta |
| fisico-matematico | 4 | superficie-3d | falta |
| forestal | 4 | plantin | dudoso |
| mecanica | 1 | llave-dinamometrica | falta |
| mecanica | 4 | torno-cnc | falta |
| naval | 4 | timon | dudoso |
| produccion | 1 | calibre-digital | falta |
| produccion | 2 | cinta-transportadora | falta |
| quimica | 0 | bomba-peristaltica | falta (es el del carrusel) |
| quimica | 1 | columna-destilacion | dudoso |
| quimica | 2 | intercambiador-placas | falta |

Los otros 34 están pintados, y son los que el juez tiene que dar por presentes.

---

### Task 0: Traer la rama y armar el entorno

**Files:**
- Ninguno del repo: el entorno vive en `.venv-escenas/`, que `.gitignore` ya ignora.

- [ ] **Paso 1: Traer la rama**

```bash
git fetch origin
git checkout fix/fondos-mano-y-objetos-faltantes
git log --oneline -3
```

Esperado: arriba de todo, `docs: plan para pintar los objetos que faltan`, y debajo `feat(escenas): un juez de presencia y los modos revisar y repintar`.

- [ ] **Paso 2: Crear el entorno e instalar**

```bash
python -m venv .venv-escenas
# Windows (PowerShell):  .venv-escenas\Scripts\Activate.ps1
# Linux / macOS:         source .venv-escenas/bin/activate
pip install --upgrade pip
pip install torch --index-url https://download.pytorch.org/whl/cu128
pip install diffusers transformers accelerate safetensors scipy numpy pillow
```

`cu128` es el índice de las placas Blackwell (serie 50). Con una placa anterior, `cu126` también anda.

- [ ] **Paso 3: Confirmar que torch ve la placa**

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
nvidia-smi
```

Esperado: `True <nombre de la placa>`, y en `nvidia-smi` ningún otro proceso ocupando la memoria.

### Task 1: Verificar el generador antes de usarlo

**Files:**
- Test: `tests/herramientas/test_escenas.py`, `tests/herramientas/test_presencia.py` (ya escritos)

**Interfaces:**
- Produces:
  - `escenas.py --revisar [carreras...] [--umbral U]`;
  - `escenas.py --repintar --solo carrera:objeto,... [--umbral U]`;
  - `presencia.UMBRAL`, el umbral por defecto: `0.5`.

- [ ] **Paso 1: Correr las pruebas sin GPU**

```bash
python -m unittest discover -s tests/herramientas -v
```

Esperado: `Ran 20 tests ... OK`.

- [ ] **Paso 2: Confirmar que el orden de objetos coincide con el contenido de esta máquina**

Ya lo hace la suite del paso 1: `test_coincide_con_las_carpetas_del_contenido` tiene que pasar. Si falla, alguien agregó o renombró una carpeta de objetos sin actualizar `GUIONES`. **No seguir**: repintar con el orden cambiado guarda máscaras en el objeto equivocado.

- [ ] **Paso 3: Probar el juez con una sola carrera**

```bash
python herramientas/escenas.py --revisar electrica
```

La primera vez baja `openai/clip-vit-large-patch14`, unos 1,7 GB. Esperado: cinco líneas, una por objeto.

- `cadena-aisladores` y `multimetro` (pintados) con presencia alta.
- `motor-trifasico`, `panel-solar` y `transformador-trifasico` con `<-- falta`.
- Al final, la línea `--solo electrica:motor-trifasico,electrica:panel-solar,electrica:transformador-trifasico`.

Si los cinco dan lo mismo, el juez no está distinguiendo: revisar `VACIOS` en `herramientas/presencia.py` antes de seguir.

### Task 2: Revisar las doce y calibrar el umbral

**Files:**
- Modify: `herramientas/presencia.py`, sólo la constante `UMBRAL`, si la calibración lo pide
- Genera, sin versionar: `contenido/objetos-contacto.jpg`

- [ ] **Paso 1: Auditar todo**

```bash
python herramientas/escenas.py --revisar
```

Esperado: 60 líneas, la hoja `contenido/objetos-contacto.jpg` y, al final, la línea `--solo ...` con los ausentes.

- [ ] **Paso 2: Compararlo con la tabla del Contexto**

Por cada fila, el veredicto del juez contra lo que se vio a ojo:

- **Un «falta» de la tabla que el juez da por presente:** el umbral es bajo. Probar `--revisar --umbral 0.6` y después `0.7`. Si el objeto se confunde con algo que no está en `VACIOS` (por ejemplo «empty ceiling tiles»), agregarlo ahí.
- **Uno pintado que el juez da por ausente:** el umbral es alto. Probar `0.4`. Si el texto del objeto en `GUIONES` no describe lo que quedó pintado, el problema es el texto y no el umbral.
- **Los «dudosos»:** decidirlos mirando la hoja.

El umbral bueno es el que separa las dos columnas de la tabla sin excepciones. Si ninguno las separa, se queda con el que deja menos errores, y los que quedan mal se deciden a ojo en el paso 3.

- [ ] **Paso 3: Armar la lista a repintar, mirando la hoja**

Abrir `contenido/objetos-contacto.jpg`: cada objeto, recortado de su foto, con su puntaje, y en rojo los que el juez da por ausentes. La lista a repintar son los que **se ven vacíos en la hoja**, no la línea `--solo` sin revisar. Con la tabla del Contexto, la lista de arranque es:

```text
agrimensura:prisma-topografico,alimentos:centrifuga,alimentos:equipo-coccion,alimentos:placa-petri,civil:puente-atirantado,civil:viga-acero,computacion:arbol-binario,computacion:base-datos,computacion:laptop,computacion:servidor,comunicacion:bobina-fibra,comunicacion:torre-telecomunicaciones,electrica:motor-trifasico,electrica:panel-solar,electrica:transformador-trifasico,fisico-matematico:prisma-optico,fisico-matematico:superficie-3d,mecanica:llave-dinamometrica,mecanica:torno-cnc,produccion:calibre-digital,produccion:cinta-transportadora,quimica:bomba-peristaltica,quimica:intercambiador-placas
```

Más los dudosos que la hoja muestre vacíos (`forestal:plantin`, `naval:timon`, `quimica:columna-destilacion`).

- [ ] **Paso 4: Fijar el umbral y commitear**

Si el umbral calibrado no es `0.5`, cambiar la constante en `herramientas/presencia.py`:

```python
UMBRAL = 0.6  # el valor que salio de la calibracion
```

```bash
python -m unittest discover -s tests/herramientas
git add herramientas/presencia.py
git commit -m "fix(escenas): el umbral de presencia calibrado contra las doce fotos"
```

Si quedó en `0.5`, no hay nada que commitear.

### Task 3: Repintar y revisar a ojo

**Files:**
- Modify: `contenido/carreras/<id>/fondos/escena/imagen.jpg`, `recortes/<n>.png` y `metadata.json`, sólo de las carreras con objetos repintados

- [ ] **Paso 1: Repintar la lista del Task 2**

```bash
python herramientas/escenas.py --repintar --solo <la lista del Task 2, paso 3>
```

Va de a una carrera: abre la foto una vez, pinta los objetos que le tocan y la guarda una vez. Por objeto imprime una línea como esta:

```text
    electrica 1 motor-trifasico          area 0.62  presencia 0.91  x2
```

`x2` son los intentos usados. Un `<-- revisar` quiere decir que no pasó los dos controles en seis intentos, y que quedó el más parecido. Con una placa de 16 GB, cada intento lleva unos segundos.

- [ ] **Paso 2: Volver a auditar**

```bash
python herramientas/escenas.py --revisar
```

Esperado: ningún `<-- falta`, o sólo los que el paso 1 marcó `<-- revisar`.

- [ ] **Paso 3: Mirar el resultado**

Mirar `contenido/objetos-contacto.jpg` y `contenido/escenas-contacto.jpg` (la escena entera). Cada objeto repintado tiene que:

- verse de lejos, con su forma reconocible;
- estar apoyado en una superficie o colgado, no flotando;
- llevar la luz y la sombra de la escena.

Si se lee como pegado encima, no sirve: es justo lo que estos fondos existen para evitar.

- [ ] **Paso 4: Reintentar lo que no sirve**

Por cada carrera con un objeto malo:

1. Restaurar la carrera, para no repintar sobre lo ya repintado (un repintado sobre otro gasta el JPEG):

   ```bash
   git checkout -- contenido/carreras/<id>/fondos/escena/
   ```

2. Cambiar el texto de ese objeto en `GUIONES` (`herramientas/escenas.py`). Más saliente: color que contraste con su superficie, «large», un rasgo inconfundible. Para los del centro alto, siempre «hanging from the ceiling».
3. Repintar sólo esa carrera, con sus objetos que faltaban:

   ```bash
   python herramientas/escenas.py --repintar --solo <id>:<objeto>,<id>:<otro>
   ```

4. Volver al paso 2.

- [ ] **Paso 5: Commitear el contenido y los textos**

```bash
git add contenido/carreras/*/fondos/escena/ herramientas/escenas.py
git commit -m "content: los objetos que faltaban, pintados adentro de su escena"
```

### Task 4: Verificar en el espejo

**Files:**
- Ninguno nuevo. Si algo de los pasos falla, se arregla en el contenido (Task 3), no en el espejo.

- [ ] **Paso 1: Pruebas del espejo y del contenido**

```bash
npm test
npm run listo
```

En `npm test`, `tests/integracion/fondos.test.js` exige que el centro de cada recorte nuevo caiga dentro del blanco de la mano: un objeto que se repintó corrido de su sitio sale ahí. `npm run listo` exige la máscara de cada objeto.

Excepciones conocidas, que no son de esto:

- en macOS falla `servidor.test.js` (127.0.0.2);
- `listo` falla en «cada maite declarado existe del otro lado» si la copia local de MAITE está desactualizada.

- [ ] **Paso 2: Recorrer las doce en el espejo**

```bash
npm start
```

Abrir `https://localhost:8080/espejo/espejo.html`. En la notebook la foto entra entera, con los costados desenfocados, así que se ven los cinco.

Para recorrerlas:

- tecla `D` (modo demo: el mouse hace de mano);
- `A` (manual, para que la sesión no se corte);
- las teclas `1`–`9`, `0`, `-`, `=` fuerzan cada ingeniería.

En cada objeto del fondo:

- el latido respira **sobre el objeto**, no sobre la pared;
- con el mouse encima, se levanta **el objeto pintado** y no un pedazo de pared;
- la ficha que se abre debajo habla de lo que se ve.

- [ ] **Paso 3: El objeto del carrusel de Alimentos y Química**

Con la cámara (o en demo, sosteniendo el mouse tres segundos sobre el objeto del carrusel), elegir Alimentos y después Química. El objeto vuela a su lugar y, al aterrizar, **se funde con el que está pintado**: ya no desaparece.

- [ ] **Paso 4: Subir**

```bash
git push
```

Después, el PR de `fix/fondos-mano-y-objetos-faltantes` a `main`.
