# Plan: pintar los objetos que faltan en las escenas

> **Estado (2026-10-02): ejecutado.** Los 60 objetos están pintados adentro de su foto, y no sólo los que faltaban: el problema era más ancho que la tabla del Contexto, porque los que sí estaban se leían pegados encima. El camino no fue el de los tasks, sino el que enseñaron las fotos:
>
> - **Cinco escenas rearmadas enteras** (Producción, Agrimensura, Eléctrica, Alimentos y Físico-matemático): no tenían dónde apoyar los objetos. Las nuevas tienen estanterías a los dos costados y techo sin luz arriba al centro, y la elección de escena castiga la luz en ese sitio. Química también se rearmó, salió con un ventanal sin estantes a la izquierda, y volvió a su escena original.
> - **El PNG del objeto plantado en el óvalo** cuando el relleno solo no pinta nada (`plantar_objeto`, `--con-png`; al 75 %, y entero lo que es fino), el **repaso local** de lo que sale del PNG (`--repasar`), el sitio devuelto a la escena vacía antes de repintar, y una guarda que no deja que ninguna pasada borre un objeto.
> - **La pasada de armonía** sobre todo objeto pintado (`--armonizar`).
> - Textos que describen el PNG y no nombran el sitio antes de la coma, e intercambios de sitio donde lo de arriba al centro no colgaba (Civil, Comunicación, Computación).
>
> El umbral quedó en 0,5: el juez se equivoca con los objetos finos o rodeados de estanterías (la mira, el pallet), así que la última palabra fue siempre la vista. Lo que se aprendió está en `docs/contenido.md`, «Los fondos se generan». Los tasks de abajo quedan como registro de lo planeado.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que los cinco objetos de cada ingeniería estén pintados adentro de su foto, integrados a la escena y no pegados encima: detectar los que el generador no pintó y repintar sólo esos, en su mismo sitio.

**Architecture:** El juez y los modos `--revisar` y `--repintar` llegaron a `main` con el PR #23 (`62f985c`). La rama `fix/objetos-faltantes` les suma lo que este plan necesita para correrlos sin sorpresas:

- `--semilla N`, otra tanda de semillas. Las semillas son fijas por objeto: sin esto, reintentar con el mismo texto da lo mismo que la vez anterior.
- `--repintar` escribe cada carrera entera al terminarla, así que una corrida cortada no deja recortes nuevos sobre la foto vieja.
- En `GUIONES`, cada texto es «el objeto, el sitio», para que el juez no lea el sitio, y la centrífuga —el objeto del carrusel de Alimentos— se describe como su PNG.

Lo que falta es correrlo en la PC con la placa NVIDIA:

1. `herramientas/escenas.py --revisar` audita las doce fotos con un juez de presencia (`herramientas/presencia.py`, CLIP en CPU).
2. `--repintar --solo carrera:objeto,...` pinta sólo los ausentes sobre la `imagen.jpg` actual, con el modelo de relleno (SDXL inpainting), y reescribe sólo su recorte y su caja.
3. Si un objeto no sale ni cambiando el texto ni la semilla, `--fase objetos <id>` rearma su carrera desde la escena vacía, en los mismos sitios.

El espejo no cambia: los archivos que quedan tienen el mismo formato.

**Tech Stack:** Python 3 con `torch` (CUDA), `diffusers`, `transformers`, `accelerate`, `scipy`, `numpy` y Pillow. Las pruebas de la herramienta usan `unittest`, de la biblioteca estándar.

**Spec:** la sección «Contexto» de este documento, y `docs/contenido.md` › «Los fondos se generan».

## Global Constraints

- Corre en la PC con placa NVIDIA (16 GB de VRAM, CUDA), nunca en el evento. Lo que se versiona son `imagen.jpg`, `recortes/<n>.png` y `metadata.json` de `contenido/carreras/<id>/fondos/escena/`, y `contenido/catalogo.json`, que también está versionado y se regenera con `npm run catalogo`.
- No cambia el formato: `metadata.json` conserva `lugar`, `escondites` y `recortes[{archivo, caja}]`, y la máscara va en el canal alfa del PNG.
- Los sitios (`lugar`, `escondites`) no se mueven: `tests/integracion/fondos.test.js` los valida.
- El índice de un objeto es su lugar en el orden alfabético de sus carpetas, el mismo que arma el catálogo (`servidor/descubrimiento.js`). El catálogo ordena con `localeCompare('es')` y la herramienta con `sorted()`: con los ids de hoy —minúsculas, guiones, sin tildes— dan lo mismo, pero `test_coincide_con_las_carpetas_del_contenido` sólo compara contra `sorted()`.
- Los objetos que ya están pintados no se tocan: se repinta sólo una lista explícita (`--solo`), revisada a ojo.
- **`--repintar` no es idempotente**: pinta encima de lo que haya. Una lista que ya corrió no se vuelve a correr entera.
- **Las semillas son fijas**: la misma foto con el mismo texto da el mismo objeto. Para otro resultado, otro texto o `--semilla N`.
- En `GUIONES`, cada texto es «el objeto, el sitio»: el juez lee sólo lo de antes de la primera coma (`texto_del_objeto`). Lo vigila `test_el_juez_no_lee_el_sitio`.
- Se commitea en una rama, nunca en `main`: `.githooks/pre-commit` lo bloquea, y `main` recibe cambios sólo por PR.
- Castellano en identificadores, comentarios y commits; identificadores y comentarios sin tildes.
- `npm test` en verde al terminar. Única excepción conocida: en macOS falla `servidor.test.js` porque no se puede escuchar en 127.0.0.2.

## Review Focus

1. **El juez da por ausente un objeto que está.** Repintarlo lo arruinaría. Por eso `--repintar` exige `--solo` y nunca toma la auditoría cruda (`test_repintar_sin_lista_no_pinta_nada`); la lista se arma mirando `contenido/objetos-contacto.jpg` (Task 2, paso 3).
2. **Una corrida cortada o relanzada.** Si se corta a mitad —falta de memoria, Ctrl+C—, la carrera en curso queda como estaba, porque `--repintar` la escribe recién al terminarla (`test_si_se_corta_a_mitad_la_carrera_queda_como_estaba`). Las que ya terminaron sí quedaron escritas, y relanzar la misma lista las repintaría encima. Cómo seguir: Task 3, paso 1.
3. **Reintentar sin cambiar nada da lo mismo.** Las semillas son fijas por objeto y CLIP corre en CPU: el mismo texto sobre la misma foto repite los mismos seis intentos. El reintento cambia el texto o pide `--semilla N`, que nunca repite un intento de otra tanda (`test_ninguna_tanda_repite_un_intento_de_otra`; Task 3, paso 4).
4. **Un objeto repintado cae lejos de su sitio.** Su silueta nueva puede quedar corrida del blanco de la mano. `npm test` lo atrapa: `fondos.test.js` exige que el centro de cada recorte quede dentro de su blanco (Task 4, paso 1).
5. **El objeto del carrusel no se parece a su PNG.** En Alimentos y Química el repintado es justo el objeto del carrusel, y al aterrizar su PNG se funde con el pintado: si no se parecen, se lo ve cambiar de color o de forma en el cuadro más mirado de la experiencia. Ninguna prueba lo ve: se mira en Task 3, paso 3, y en Task 4, paso 3.

## Contexto

El 2026-10-01 se revisaron a ojo las 60 cajas de objetos, recortadas de las fotos generadas. **En unas 25 no hay ningún objeto pintado**: sólo pared, estantes o luces del techo.

El modelo de relleno a veces no pinta el objeto y se limita a rehacer la superficie. El control de entonces medía cuánto había cambiado la ventana, y una pared repintada también cambia, así que esos intentos pasaban por buenos.

En el espejo eso se ve así:

- un latido que respira sobre una pared vacía;
- una ficha que describe algo que no se ve;
- el «objeto» que se levanta al pasar la mano es un pedazo de pared;
- en Alimentos y Química falta justo el objeto del carrusel: vuela a su lugar y, al aterrizar, desaparece.

Los cuatro del techo (arriba al centro) estaban pedidos «en la pared» y ahí hay techo. Los que se confundían con su superficie eran blanco sobre blanco, acero sobre acero o vidrio. Los textos de esos ya se cambiaron en `GUIONES`. Después, en todos, el sitio pasó detrás de la coma, para que el juez no lo lea, y la centrífuga se describe como su PNG —blanca, con la tapa gris abierta y el rotor negro— en vez de «white and blue».

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

**Producción ya no está en esta tabla.** El 2026-10-02 se rearmó entera: el galpón vacío de antes no tenía dónde apoyar los objetos de arriba (el engranaje flotaba delante del techo), y la escena nueva es un depósito con estanterías a los dos costados. Sus cinco objetos están pintados y armonizados, así que `produccion:calibre-digital` y `produccion:cinta-transportadora` salen de la lista de arranque del Task 2.

**Y todo lo que se repinta se armoniza solo:** `--repintar` termina con la pasada de armonía alrededor de lo que pintó (ver `docs/contenido.md`). En el Task 3, paso 3, se mira lo que quedó después de esa pasada.

---

### Task 0: La rama y el entorno

**Files:**
- Ninguno del repo.

- [ ] **Paso 1: Estar en la rama**

```bash
git fetch origin
git switch fix/objetos-faltantes
```

Si ya se mergeó a `main`, crear otra desde ahí: `git switch -c fix/objetos-pintados origin/main`. En `main` no se puede commitear.

- [ ] **Paso 2: El entorno**

En la PC de desarrollo con la 5080 ya está armado, fuera del repo: `%USERPROFILE%\.venvs\espejo-img`, con torch 2.11 (cu128), diffusers 0.40 y transformers 5.17, y con RealVisXL, el relleno de SDXL y el VAE fp16 ya bajados. Es el entorno que generó las escenas: usar ése.

```powershell
& "$env:USERPROFILE\.venvs\espejo-img\Scripts\Activate.ps1"
```

En otra PC, crearlo con las mismas versiones (`.venv-escenas/` ya está en `.gitignore`):

```bash
python -m venv .venv-escenas
# Windows (PowerShell):  .venv-escenas\Scripts\Activate.ps1
# Linux / macOS:         source .venv-escenas/bin/activate
pip install --upgrade pip
pip install torch torchvision --index-url https://download.pytorch.org/whl/cu128
pip install diffusers==0.40.0 transformers==5.17.0 accelerate safetensors scipy numpy pillow
```

`cu128` es el índice de las placas Blackwell (serie 50). Con una placa anterior, `cu126` también anda. Sin versiones, `pip` trae las últimas, que no son las que generaron las escenas.

- [ ] **Paso 3: Confirmar que torch ve la placa**

```bash
python -c "import torch; print(torch.cuda.is_available(), torch.cuda.get_device_name(0))"
nvidia-smi
python herramientas/escenas.py --help
```

Esperado: `True <nombre de la placa>`; en `nvidia-smi`, ningún otro proceso ocupando la memoria; y `--semilla N` en la ayuda, que confirma que es la rama buena.

### Task 1: Verificar el generador antes de usarlo

**Files:**
- Test: `tests/herramientas/test_escenas.py`, `tests/herramientas/test_presencia.py` (ya escritos)

**Interfaces:**
- Produces:
  - `escenas.py --revisar [carreras...] [--umbral U]`;
  - `escenas.py --repintar --solo carrera:objeto,... [--umbral U] [--semilla N]`;
  - `escenas.py --fase objetos <carrera> [--umbral U] [--semilla N]`;
  - `presencia.UMBRAL`, el umbral por defecto: `0.5`.

- [ ] **Paso 1: Correr las pruebas sin GPU**

```bash
python -m unittest discover -s tests/herramientas -v
```

Esperado: `Ran 30 tests ... OK`.

- [ ] **Paso 2: Confirmar que el orden de objetos coincide con el contenido de esta máquina**

Ya lo hace la suite del paso 1: `test_coincide_con_las_carpetas_del_contenido` tiene que pasar. Si falla, alguien agregó o renombró una carpeta de objetos sin actualizar `GUIONES`. **No seguir**: repintar con el orden cambiado guarda máscaras en el objeto equivocado.

- [ ] **Paso 3: Probar el juez con una sola carrera**

```bash
python herramientas/escenas.py --revisar electrica
```

La primera vez baja `openai/clip-vit-large-patch14`, unos 1,7 GB. Es también la primera vez que el juez corre de verdad: si algo de transformers 5 no le cae bien, revienta acá y no a mitad de un repintado. Esperado: cinco líneas, una por objeto.

- `cadena-aisladores` y `multimetro` (pintados) con presencia alta.
- `motor-trifasico`, `panel-solar` y `transformador-trifasico` con `<-- falta`.
- Al final, la línea `--solo electrica:motor-trifasico,electrica:panel-solar,electrica:transformador-trifasico`.

Si los cinco dan lo mismo, el juez no está distinguiendo: revisar `VACIOS` en `herramientas/presencia.py` antes de seguir.

### Task 2: Revisar las doce y calibrar el umbral

**Files:**
- Modify: `herramientas/presencia.py`: la constante `UMBRAL` y, si la calibración lo pide, la lista `VACIOS`
- Genera, sin versionar: `contenido/objetos-contacto.jpg`, y `../revision.txt`, fuera del repo

- [ ] **Paso 1: Auditar todo, una sola vez**

```bash
python herramientas/escenas.py --revisar | tee ../revision.txt
```

Esperado: 60 líneas con su puntaje, la hoja `contenido/objetos-contacto.jpg` y, al final, la línea `--solo ...` con los ausentes. `--umbral` cambia sólo qué se marca `<-- falta`, no los puntajes: para calibrar alcanza con esta corrida.

- [ ] **Paso 2: Leer los umbrales de los puntajes**

Separar los 60 puntajes en dos columnas, con la tabla del Contexto: los «falta» y los 34 pintados. De ahí salen dos números:

- **El umbral** (`UMBRAL`, el de `--revisar`) va en el hueco entre las dos columnas: por encima del más alto de los «falta» y por debajo del más bajo de los pintados. Si no hay hueco, el que deja menos errores; los que quedan mal se deciden a ojo en el paso 3.
- **El exigente**, para todos los `--repintar` del Task 3: `0.9`, o el puntaje más bajo de los pintados si es menor; nunca menos que el umbral. Cuando ningún intento lo pasa, la herramienta se queda igual con el que más se parece, así que exigir más cuesta sólo tiempo, y exigir poco acepta la primera pared que pase raspando.

Y por fila:

- **Un «falta» con puntaje alto** porque se confunde con algo que no está en `VACIOS` (por ejemplo, «empty ceiling tiles»): agregarlo a `VACIOS`. Eso cambia todos los puntajes —cada vacío más le saca probabilidad a todos los objetos—, así que después se vuelve al paso 1.
- **Un pintado con puntaje bajo** porque el texto de `GUIONES` no describe lo que quedó pintado: el problema es el texto y no el umbral.
- **Los «dudosos»:** decidirlos mirando la hoja.

- [ ] **Paso 3: Armar la lista a repintar, mirando la hoja**

Abrir `contenido/objetos-contacto.jpg`: cada objeto, recortado de su foto, con su puntaje, y en rojo los que el juez da por ausentes. La lista a repintar son los que **se ven vacíos en la hoja**, no la línea `--solo` sin revisar. Con la tabla del Contexto, la lista de arranque es:

```text
agrimensura:prisma-topografico,alimentos:centrifuga,alimentos:equipo-coccion,alimentos:placa-petri,civil:puente-atirantado,civil:viga-acero,computacion:arbol-binario,computacion:base-datos,computacion:laptop,computacion:servidor,comunicacion:bobina-fibra,comunicacion:torre-telecomunicaciones,electrica:motor-trifasico,electrica:panel-solar,electrica:transformador-trifasico,fisico-matematico:prisma-optico,fisico-matematico:superficie-3d,mecanica:llave-dinamometrica,mecanica:torno-cnc,quimica:bomba-peristaltica,quimica:intercambiador-placas
```

Más los dudosos que la hoja muestre vacíos (`forestal:plantin`, `naval:timon`, `quimica:columna-destilacion`).

- [ ] **Paso 4: Fijar el umbral y commitear**

Si el umbral no es `0.5`, cambiar la constante en `herramientas/presencia.py`:

```python
UMBRAL = 0.6  # el valor que salio de la calibracion
```

Si `presencia.py` cambió en algo —el umbral o `VACIOS`—, commitearlo:

```bash
python -m unittest discover -s tests/herramientas
git add herramientas/presencia.py
git commit -m "fix(escenas): el umbral de presencia calibrado contra las doce fotos"
```

Si `git status` no lo muestra, no hay nada que commitear. El exigente no se commitea: anotarlo, que va en cada `--repintar` del Task 3.

### Task 3: Repintar y revisar a ojo

**Files:**
- Modify: `contenido/carreras/<id>/fondos/escena/imagen.jpg`, `recortes/<n>.png` y `metadata.json`, sólo de las carreras con objetos repintados; `contenido/catalogo.json`; `herramientas/escenas.py`, sólo `GUIONES` y sólo si algún texto cambia

- [ ] **Paso 1: Repintar la lista del Task 2**

```bash
python herramientas/escenas.py --repintar --umbral <el exigente> --solo <la lista del Task 2, paso 3>
```

Va de a una carrera: abre la foto una vez, pinta los objetos que le tocan y la escribe entera al terminarla —foto, recortes y metadata juntos—. Por objeto imprime una línea como esta:

```text
    electrica 1 motor-trifasico          area 0.62  presencia 0.91  x2
```

`x2` son los intentos usados. Un `<-- revisar` quiere decir que en seis intentos ninguno pasó los dos controles —el área y el exigente— y que quedó el que más se parece; con el exigente puede ser un objeto que está bien, y eso lo dice la hoja del paso 3. Con una placa de 16 GB, cada intento lleva unos segundos.

Cuando termina una carrera imprime `  <id>: <segundos>s`, y esa carrera ya quedó escrita. **Si la corrida se corta**, la que estaba en curso quedó como estaba y las que ya imprimieron su línea, escritas: relanzar con la lista sin esas, nunca la misma lista entera, que pintaría encima de lo ya repintado. `git status --short contenido/carreras` muestra cuáles cambiaron.

- [ ] **Paso 2: Volver a auditar**

```bash
python herramientas/escenas.py --revisar
```

Con el umbral de siempre, no el exigente. Esperado: ningún `<-- falta`, o sólo objetos que el paso 1 marcó `<-- revisar`.

- [ ] **Paso 3: Mirar el resultado**

Mirar `contenido/objetos-contacto.jpg` y `contenido/escenas-contacto.jpg`, la escena entera, que `--repintar` rearma al terminar. Cada objeto repintado tiene que:

- verse de lejos, con su forma reconocible;
- estar apoyado en una superficie o colgado, no flotando;
- llevar la luz y la sombra de la escena;
- si es el del carrusel —`alimentos:centrifuga` y `quimica:bomba-peristaltica`—, parecerse a su PNG (`contenido/carreras/<id>/objetos/<objeto>/imagen.png`) en color y en forma, porque al aterrizar se funden.

Si se lee como pegado encima, no sirve: es justo lo que estos fondos existen para evitar.

- [ ] **Paso 4: Reintentar lo que no sirve**

Por cada objeto que no sirve:

1. Decidir qué cambiar.
   - **Lo pintado no es el objeto, o se confunde con su superficie:** su texto en `GUIONES` (`herramientas/escenas.py`). Más saliente: un color que contraste con la superficie, «large», un rasgo inconfundible. El objeto antes de la coma y el sitio después —para los del centro alto, «…, hanging from the ceiling»—, porque el juez no lee lo de después de la coma. El del carrusel se describe como su PNG, aunque contraste menos.
   - **El texto está bien y salió mal de casualidad:** otra tanda, `--semilla 1`; la vuelta siguiente, `2`, y después `3`.

   Con el mismo texto y sin `--semilla` sale casi lo mismo que la vez anterior: las semillas son fijas, y el modelo casi no mira lo que había adentro del óvalo que repinta.

2. Repintar sólo ese objeto, encima de la foto actual; los otros de su carrera no se tocan:

   ```bash
   python herramientas/escenas.py --repintar --umbral <el exigente> --semilla <n> --solo <id>:<objeto>
   ```

   Cada vuelta recomprime la foto entera (JPEG, calidad 94): unas pocas no se notan.

3. Volver al paso 2. Alcanza con `--revisar <id>`, y la hoja muestra sólo esa carrera.

**Si después de tres vueltas un objeto sigue sin servir**, rearmar su carrera desde la escena vacía. Antes, commitear lo que ya sirve (paso 5): si el rearmado sale peor, `git checkout -- contenido/carreras/<id>/fondos/escena/` vuelve a eso.

```bash
python herramientas/escenas.py --fase objetos <id>
```

Con `--fase objetos`: sin eso regenera también la escena. Pinta los cinco objetos con el juez y el umbral de siempre sobre `contenido/escenas-base/<id>.jpg`, y los sitios salen los mismos: `elegir_sitios` sobre esa base da exactamente los del `metadata.json` (comprobado el 2026-10-01 en las doce). Los que ya estaban bien salen casi siempre iguales —misma escena, mismas semillas—, pero hay que volver a mirar los cinco. Las escenas vacías no se versionan: existen sólo en la PC donde se generaron, y sin la de esa carrera esta salida no existe. Si tampoco así sale, el objeto queda anotado como pendiente para la reunión con la cátedra.

- [ ] **Paso 5: Commitear el contenido y los textos**

```bash
npm run catalogo
git add contenido/carreras/*/fondos/escena/ contenido/catalogo.json herramientas/escenas.py
git commit -m "fix(contenido): los objetos que faltaban, pintados adentro de su escena"
```

`contenido/catalogo.json` está versionado y lleva la caja de cada recorte: sin regenerarlo, el que queda en git es el de antes. `npm start` también lo reescribe al arrancar, pero ahí queda como un cambio suelto.

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

Abrir `https://localhost:8080/espejo/espejo.html`. El certificado es autofirmado: la primera vez Chrome avisa que la conexión no es privada, y se sigue desde sus opciones avanzadas. En la notebook la foto entra entera y los costados son la misma escena extendida (`imagen-apaisada.jpg`), así que se ven los cinco. Repintar objetos no obliga a regenerar la extensión: de ella el espejo usa sólo los costados.

Para recorrerlas:

- tecla `D`: modo demo, el mouse hace de mano y un rostro sintético sostiene la sesión;
- `A`: manual, porque si no la sesión se cierra sola a los tres minutos;
- las teclas `1`–`9`, `0`, `-`, `=` fuerzan cada ingeniería en orden alfabético: `2` es Alimentos y `=` es Química.

En cada objeto del fondo:

- el latido respira **sobre el objeto**, no sobre la pared;
- con el mouse encima, se levanta **el objeto pintado** y no un pedazo de pared;
- la ficha que se abre debajo habla de lo que se ve.

- [ ] **Paso 3: El objeto del carrusel de Alimentos y Química**

Una carrera forzada con las teclas no pasa por el carrusel: su objeto crece en su lugar desde cero. Para verlo volar:

1. `R` (vuelve al reposo) y `Espacio` tres veces —enganche, humo, exploración—: en manual el espejo no avanza solo.
2. En el carrusel, sostener el mouse tres segundos sobre la centrífuga.
3. Mirar el aterrizaje: el objeto vuela a su lugar y **se funde con el que está pintado**, sin desaparecer y sin cambiar de color ni de forma.
4. Lo mismo para Química, con la bomba peristáltica.

- [ ] **Paso 4: Subir**

```bash
git push -u origin HEAD
```

Después, el PR de esa rama a `main`.
