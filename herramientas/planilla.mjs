#!/usr/bin/env node
// planilla.mjs — borrador de la planilla «tareas realizadas por cada uno y
// horas dedicadas a cada tarea» del stand de la Facultad de Ingeniería, sacado
// del historial de git del Espejo (repositorio taller) y de MAITE (las tablets).
//
//   npm run planilla        (o node herramientas/planilla.mjs)
//
// Escribe en el repositorio del Espejo, y no toca nada más:
//   docs/planilla-de-tareas.csv  Excel es-UY: separador «;», coma decimal, UTF-8 con BOM
//   docs/planilla-de-tareas.md   lo mismo, legible, con el método explicado
//
// Para volver a correrlo cuando haya commits nuevos:
//   - Un commit se asigna poniendo su hash corto en la lista `commits` de una
//     tarea de TAREAS (o creando una tarea nueva, con su nombre y su detalle).
//   - Mientras no figure en ninguna lista, lo puede agarrar la regla `asuntos`
//     de alguna tarea (expresiones sobre el asunto del commit).
//   - Si ninguna regla lo agarra, cae en una tarea de respaldo por prefijo
//     convencional (feat, fix, docs…) y día. La consola lista los dos casos.
//   - La columna «Horas reales» que ya se haya completado en el CSV se conserva,
//     mientras la tarea siga llamándose igual.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ===========================================================================
// Configuración
// ===========================================================================

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// MAITE puede estar adentro del proyecto o al lado, que es como suele quedar al
// clonar los dos repos juntos: lo mismo que busca npm run listo. Si no esta, la
// planilla sale solo con el Espejo, y la consola lo avisa.
const MAITE = ['MAITE', '../MAITE', '../maite']
  .map((carpeta) => resolve(RAIZ, carpeta))
  .find((carpeta) => existsSync(resolve(carpeta, '.git')));
if (!MAITE) console.warn('No se encontro el repositorio de MAITE: la planilla sale sin sus filas.');

const REPOS = [
  { proyecto: 'Espejo', ruta: RAIZ },
  ...(MAITE ? [{ proyecto: 'MAITE', ruta: MAITE }] : []),
];

const SALIDA_CSV = resolve(RAIZ, 'docs/planilla-de-tareas.csv');
const SALIDA_MD = resolve(RAIZ, 'docs/planilla-de-tareas.md');

// El método, a la manera de git-hours (que por defecto suma 2 h, no 1).
const HORAS_MAXIMAS_ENTRE_COMMITS = 2; // menos que esto entre dos commits: misma sesión
const HORAS_ANTES_DEL_PRIMER_COMMIT = 1; // el trabajo previo al primer commit de cada sesión
const PASO_DE_REDONDEO = 0.5; // cada tarea se redondea a esto, y nunca baja de esto

// Una misma persona firma con varios nombres y correos. Se la reconoce por
// cualquiera de los dos (los nombres, sin mirar tildes ni mayúsculas).
const IDENTIDADES = [
  {
    persona: 'Joao Calado Moura',
    nombres: ['Joao', 'Joao Calado', 'João calado moura'],
    correos: ['jcaladomoura@gmail.com', '72951386+moura-code@users.noreply.github.com'],
  },
  {
    persona: 'Iván Arriola',
    nombres: ['Iván Arriola', 'Iván Andrés Arriola Turné'],
    correos: ['ivan.arriola@fing.edu.uy', '83203492+ivan1arriola@users.noreply.github.com'],
  },
  {
    persona: 'Maite Martínez',
    nombres: ['Maite Martinez', 'Maite Sathya Martinez Hernandez'],
    correos: ['maitem@fing.edu.uy'],
  },
];

// Commits que existieron y ya no están en ningún clon. El 06/08/2026, main y la
// rama interfaz-grafica del Espejo volvieron por force push a la primera
// versión, y 16 commits de Iván del 28 al 30/07 (los de los PR #3 y #5 que no
// estaban en otra rama) quedaron fuera de la historia. Siguen en GitHub y de ahí
// se copiaron el 10/09/2026 (gh api repos/moura-code/espejo-magico/pulls/N/commits),
// con la hora pasada de UTC a -03:00, la zona de todos sus otros commits. Si
// alguna vez vuelven a un clon, vale el de git y este se ignora. Para dejarlos
// afuera de la planilla, vaciar la lista.
const COMMITS_SOLO_EN_GITHUB = [
  { hash: 'afc16beca095beaf8b7df176ca8b22308f730097', fecha: '2026-07-28T23:04:03-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'Revertir merge accidental del PR #1' }, // PR #3
  { hash: '847a5c8240ea53ea87d297a9cf0223dbbba2d28d', fecha: '2026-07-28T23:47:47-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'Refactor espejo application to enhance content validation and narrative structure' }, // PR #5
  { hash: '05004b0e25e800db9e795af8b2fa06fe829b61f0', fecha: '2026-07-28T23:56:43-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'Refactor code structure for improved readability and maintainability' }, // PR #5
  { hash: 'e2f3f963c8f753e1d7f4c217b64792506ccc37ce', fecha: '2026-07-28T23:59:29-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: ajusta los tiempos de los estados y añade pruebas para el ritmo inmersivo de la experiencia' }, // PR #5
  { hash: '8ff3e1488b95f01a053ca0432bf9b8f7ee3dc473', fecha: '2026-07-29T00:10:11-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: expand educational offerings from 6 to 18 proposals, update related documentation and code' }, // PR #5
  { hash: '030ce2ecbd32b0738a89848ce18e4922cbd5c9b3', fecha: '2026-07-29T00:18:28-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: implementar texto adaptativo en función de la ubicación del rostro y ajustar la visualización en pantalla' }, // PR #5
  { hash: '346e4558ff080ead7869706cef204b4d6140bf8d', fecha: '2026-07-29T00:40:03-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: implement person segmentation using MediaPipe' }, // PR #5
  { hash: 'dfaa74bdaebc9c35e50b35fdc5dc87d325e98bc5', fecha: '2026-07-29T00:45:31-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: eliminar archivo binario innecesario \'Logo Fing y Udelar.7z\'' }, // PR #5
  { hash: '67cd9f96039f835094fbb29557750b45c6501ac4', fecha: '2026-07-29T00:48:59-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: integrate pose detection and visualization' }, // PR #5
  { hash: 'cd984a305996071519a34c71941b461c9774543d', fecha: '2026-07-29T00:55:47-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: actualizar documentación y mejorar diagnóstico de pose y colisiones' }, // PR #5
  { hash: 'e892668d3e3976b0327e29c364e1396c1b77f24e', fecha: '2026-07-29T00:56:46-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: eliminar estado anterior y ajustar lógica de detección de manos' }, // PR #5
  { hash: 'b8ef5eef54b7c35721b0f524987a9a63f8fe3c46', fecha: '2026-07-29T01:04:39-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: ajustar parámetros de visibilidad y detección en la configuración de pose, mejorar lógica de dibujo y agregar soporte para completar pose con respaldo' }, // PR #5
  { hash: '7a1d7aa13023ab544942e7a874dfbe8fbd51a142', fecha: '2026-07-30T20:48:21-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: update @emnapi/core and @emnapi/runtime to version 2.0.0-alpha.3, adjust dependencies and peer settings' }, // PR #5
  { hash: '9d66d237d78530eec9591b2fa8cec34a44c9a5fc', fecha: '2026-07-30T20:53:36-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: update control routes to short paths and enhance control button animations' }, // PR #5
  { hash: '02b908e663f86d4e60fbc99759fbdfc730b5f473', fecha: '2026-07-30T20:56:16-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'feat: adjust control font size for improved readability' }, // PR #5
  { hash: 'ead42d29ca5243cf2cd27310921519a4e6f9594e', fecha: '2026-07-30T21:05:57-03:00', autor: 'Iván Arriola', correo: 'ivan.arriola@fing.edu.uy', asunto: 'Anima y sincroniza los controles remotos' }, // PR #5
].map((commit) => ({ ...commit, proyecto: 'Espejo', soloEnGithub: true }));

// Las tareas. Cada una: `nombre`, `detalle` (una frase, sin «;»), `commits`
// (hashes cortos, con su asunto como comentario) y, opcionales, `asuntos`
// (expresiones que atrapan commits NUEVOS que todavía no figuran en ninguna
// lista; gana la primera tarea que coincide) y `proyecto` (a qué repositorio se
// limitan esas expresiones). Un commit va a una sola tarea.
const TAREAS = [
  // ------------------------------------------------------ Joao Calado Moura
  {
    nombre: 'Segunda devolución de la cátedra: objetos escondidos, fichas y un solo color',
    detalle:
      'Cuatro objetos por ingeniería con su nombre y su descripción (el del carrusel y tres escondidos en la periferia del fondo, meciéndose), fichas que se abren al pasar la mano, un solo color de MAITE para los nombres y la carga, un sostenido de tres segundos, fundidos en todo lo que aparecía de golpe, herramientas para comparar fondos y colores en la reunión, la documentación y esta planilla. Después, los arreglos de dos revisiones de código: nombres de ficha medidos, objetos al alcance de la mano y sin que una ficha tape a otro, nada que salte al aterrizar ni en el cierre, la copia del objeto leído delante de la persona y la herramienta de fondos decidiendo igual que el espejo.',
    commits: [
      'fea3b81', // feat: cuatro objetos por ingenieria, cada uno con su nombre y su descripcion
      '3b5765a', // feat: objetos escondidos en el fondo con su ficha, un solo color y una carga mas lenta
      'beeeb4d', // docs: la devolucion de la catedra, en CLAUDE.md, el README y las guias
      'd2759e7', // fix: una ingenieria forzada con el teclado arranca sus fichas de cero
      'd8fe772', // docs: el LEEME de cada carpeta de objetos cuenta los cuatro que se usan
      'fa9c374', // fix: las fichas se miden, los objetos quedan al alcance de la mano y nada salta
      'f49b2ba', // feat: npm run planilla arma la planilla de tareas y horas del equipo
      'd28a1a9', // docs: las fichas, el alcance de la mano y la revision en CLAUDE.md, el README y las guias
      '527f5e3', // fix: en un monitor apaisado la letra de las fichas se achica con la composicion
      '7aadc5f', // fix: la segunda revision: una sola persona para el alcance, la copia recortada y la herramienta decide como el espejo
      'f43d6c0', // docs: el alcance de la mano, la copia recortada y la herramienta a la medida del espejo
    ],
    proyecto: 'Espejo',
    asuntos: [/escondid|ficha|planilla|devoluci|revision de la rama/i],
  },
  {
    nombre: 'Primera versión del espejo mágico',
    detalle:
      'Diseño (especificación y plan) e implementación inicial del espejo: detección de rostro y manos, sorteo de carrera, objetos que caen y se manotean, efectos por carrera y sincronización con tablets, con 412 pruebas. Todo entró en un solo commit.',
    commits: [
      'a5704e2', // Espejo magico: instalacion interactiva para stand de Facultad de Ingenieria
    ],
  },
  {
    nombre: 'Imán de las manos y nubes en reposo',
    detalle:
      'Cambios tras la primera prueba con una persona ajena al desarrollo: las manos atraen los objetos como un imán, los objetos llegan al piso, el espejo descansa cubierto de nubes y la escena dura mientras la persona siga sentada (PR #6).',
    commits: [
      'd14cf7c', // updaste
    ],
  },
  {
    nombre: 'Señal visual de las manos',
    detalle:
      'Los aros de las palmas pasan a verse siempre, con el color de la carrera, y más adelante el dibujo de la mano se reemplaza por el campo del imán: un resplandor en la palma y bandas de luz que se cierran sobre ella.',
    commits: [
      'd83d33c', // Los aros de las manos se ven siempre
      '62bdff5', // feat: reemplazar el dibujo de la mano por el campo del iman
    ],
  },
  {
    nombre: 'Revisión del PR #7 (nubes y robustez)',
    detalle:
      'Correcciones pedidas en la revisión del PR de Iván, cada una con su prueba: el servidor ya no se cae con un archivo vacío, la presencia se mide en tiempo y no en cuadros, la cámara avisa si se corta y npm run listo verifica los tres modelos.',
    commits: [
      '30e5590', // fix: atender observaciones de la revision del PR 7
    ],
  },
  {
    nombre: 'Fotos de los objetos de cada ingeniería',
    detalle:
      'Setenta y dos fotos de objetos para las doce ingenierías, en PNG con el fondo recortado, con los créditos de las que vienen de Wikimedia Commons y las herramientas para recortarlas y generar PNG de respaldo.',
    commits: [
      'ae356dc', // feat: add new assets and update existing files
    ],
  },
  {
    nombre: 'Accesorio de la cara: respaldo vectorial y eliminación',
    detalle:
      'Figuras vectoriales de respaldo para el accesorio de cada carrera y recorte limpio de trece fotos de objetos (cuatro reemplazadas por fotos de estudio de Wikimedia Commons). Esa misma noche se sacó entero el accesorio anclado a la cara y se barrieron sus restos.',
    commits: [
      'fc1bfb8', // feat: accesorio vectorial y recortes limpios en los objetos
      'a671f62', // feat: eliminar el accesorio anclado a la cara
      '74d3f7f', // fix: barrer sobras de la eliminacion del accesorio
    ],
  },
  {
    nombre: 'Hooks de git que protegen main',
    detalle:
      'Hooks versionados (pre-commit, pre-merge-commit y pre-push) que bloquean los commits y los push directos a main, y que se activan solos con npm install.',
    commits: [
      '7e5e421', // chore: hooks versionados que bloquean commits y push directos a main
    ],
  },
  {
    nombre: 'Catálogo de doce carreras y limpieza',
    detalle:
      'Tecla para la duodécima carrera con una prueba que cruza los atajos contra carreras.json, el tope de sesión vigilando también el enganche, el chaleco como séptimo objeto de civil y limpieza de código muerto, LEEME y documentación desfasada.',
    commits: [
      '12f9cfc', // fix: dar tecla a la doceava carrera y cortar el enganche por tope de sesion
      'e5d9abd', // chore: barrer sobras del accesorio, codigo muerto y desajustes de documentacion
    ],
  },
  {
    nombre: 'Espejo autónomo: sin tablets, WebSocket ni referentes',
    detalle:
      'Se sacan del contenido los referentes y sus videos, y del código todo el subsistema de tablets (WebSocket, protocolo y cliente): el servidor queda en archivos estáticos sin dependencias y la documentación se pone al día (PR #8).',
    commits: [
      '07592ca', // feat: sacar los referentes y los videos del contenido
      '466b4a8', // refactor: sacar el subsistema de tablets, WebSocket y protocolo
    ],
  },
  {
    nombre: 'Detección a más distancia y estabilidad de la sesión',
    detalle:
      'Los detectores analizan solo el recorte visible de la cámara (el triple de alcance), los colchones de presencia se recalibran para no cortarle la sesión a quien sigue sentado y liberar el espejo cuando alguien se va, MediaPipe se reintenta en CPU si no hay GPU y el video de humo ya no puede frenar el arranque.',
    commits: [
      'dec6112', // fix: reconocer de mas lejos y dejar de cortarle la sesion a quien sigue sentado
      'f38e73b', // fix: soltar el espejo cuando alguien se va, para que la fila avance
      '435d37c', // . (sin mensaje: MediaPipe en CPU si no hay GPU y tope de carga del video de humo)
    ],
  },
  {
    nombre: 'Elección con la mano y puente a MAITE',
    detalle:
      'Rediseño de la experiencia: la persona elige la ingeniería sosteniendo la mano sobre uno de los objetos que la rodean, su fondo aparece recortado contra la silueta y el espejo le avisa a MAITE para que las tablets acompañen. Después, las doce carreras quedan mapeadas a los ids de MAITE.',
    commits: [
      '4866fa7', // feat: elegir la ingenieria con la mano y avisarle a MAITE
      '07df76f', // fix: las doce ingenierias mapeadas a MAITE, no cinco
    ],
    proyecto: 'Espejo',
    asuntos: [/maite/i],
  },
  {
    nombre: 'Tipografía compartida con las tablets',
    detalle:
      'El espejo pasa a usar la letra de las tablets (primero Germania One y después Muffaroo, la que los temas de MAITE muestran de verdad), esperando a que la fuente cargue antes del primer cuadro y con la nota de licencia que exige npm run listo.',
    commits: [
      '253622a', // feat: usar en el espejo la misma tipografia que las tablets
      'f5f75de', // feat: la letra que las tablets muestran de verdad es Muffaroo, no Germania One
    ],
    proyecto: 'Espejo',
    asuntos: [/tipograf|muffaroo/i],
  },
  {
    nombre: 'Explorar las ingenierías y humo en reposo',
    detalle:
      'Agarrar un objeto muestra su ingeniería y agarrar otro la reemplaza (tres estados se funden en EXPLORACION), el rostro pasa a ser lo que sostiene la sesión y la pantalla de espera queda cubierta de un humo que respira.',
    commits: [
      'b325ea2', // feat: explorar las ingenierias en vez de elegir una sola
      '2cd50b2', // feat: el espejo descansa cubierto de humo
    ],
  },
  {
    nombre: 'Documentación técnica al día',
    detalle:
      'CLAUDE.md, README y las guías de docs/ reescritos para describir el sistema real: primero la máquina de estados nueva y la exploración, después el carrusel de doce, el objeto en su lugar, los fondos candidatos y Muffaroo.',
    commits: [
      '4276ef2', // docs: la documentacion describia una maquina de estados que ya no existe
      'c61b3bf', // docs: el carrusel de doce, el objeto en su lugar, los fondos candidatos y Muffaroo
    ],
    proyecto: 'Espejo',
    asuntos: [/^docs\b/i],
  },
  {
    nombre: 'Diseño y plan de la devolución de la cátedra',
    detalle:
      'Especificación y plan de implementación (diez tareas, con las pruebas antes que el código) para responder a la devolución de la cátedra: carrusel de doce, nombre al pie, objeto dentro del fondo, tres fondos por carrera y Muffaroo.',
    commits: [
      '7d77571', // docs: diseño del carrusel de doce, el objeto en su lugar y los fondos candidatos
      'bf8042c', // docs: plan de implementación del carrusel, el objeto en su lugar y los fondos candidatos
    ],
  },
  {
    nombre: 'Carrusel de las doce ingenierías',
    detalle:
      'El tablero pasa a ser un anillo con una ranura por carrera que gira lento y del que solo se ve la ventana de arriba. Ofrece las doce en orden barajado y se detiene mientras se sostiene un objeto.',
    commits: [
      '446cd76', // feat: el tablero es un anillo que gira y del que solo se ve la ventana de arriba
      '3d16865', // feat: el carrusel ofrece las doce ingenierias y se detiene mientras se sostiene un objeto
    ],
    proyecto: 'Espejo',
    asuntos: [/carrusel|tablero|sostenid/i],
  },
  {
    nombre: 'El objeto vuela a su lugar y el nombre va al pie',
    detalle:
      'El objeto agarrado vuela de su ranura a un lugar del fondo y flota ahí con un halo del color de la carrera, y el nombre de la ingeniería va al pie. El 10/09 se corrige para que aterrice a la vista también en monitores apaisados.',
    commits: [
      '75d5190', // feat: el objeto agarrado vuela a su lugar en el fondo y flota ahi
      '37d8c18', // feat: el nombre de la ingenieria va al pie y el objeto apoyado lleva su halo
      '5a8da90', // feat: el objeto agarrado vuela a su lugar en el fondo y el nombre de la ingenieria va al pie
      '204e44f', // fix: el objeto elegido aterriza a la vista en un monitor apaisado
    ],
    proyecto: 'Espejo',
    asuntos: [/vuel[ao]|aterriz|al pie/i],
  },
  {
    nombre: 'Fondos de cada ingeniería: escenas vectoriales y fotografías',
    detalle:
      'Escenas vectoriales de respaldo del lugar donde se trabaja cada ingeniería, fondos candidatos con el lugar del objeto, una herramienta para compararlos tal como se verían en el espejo y dos fotografías por carrera de Wikimedia Commons, recortadas a 9:16, oscurecidas y puestas como fondo activo.',
    commits: [
      'e36020d', // feat: fondos que muestran donde se trabaja cada ingenieria
      '435f948', // feat: cada carrera declara sus fondos candidatos con el lugar del objeto, y ya no lleva persona
      'd5c4feb', // feat: la herramienta de fondos muestra cada candidato como se veria en el espejo
      '5d3ab26', // feat: dos fondos candidatos mas por ingenieria, fotografias de Wikimedia Commons
      '3189a97', // feat: el espejo muestra la fotografia de cada ingenieria, no el respaldo vectorial
      '5d802d5', // fix: generar-fondos escribe el respaldo vectorial, no el fondo activo
      '4e76923', // docs: como se prepara una fotografia para que sirva de fondo
    ],
    proyecto: 'Espejo',
    asuntos: [/fondo|fotograf|wikimedia|escenario/i],
  },
  {
    nombre: 'Elección única, fondos con video y fotos definitivas',
    detalle:
      'Entrega del 3/9 en un único commit («final»): se elige una sola vez y el carrusel se apaga al elegir, los fondos pueden ser un video en loop y cada carrera queda con tres fondos candidatos reales, con sus criterios y créditos (PR #9).',
    commits: [
      '62bc26e', // final
    ],
  },

  // ----------------------------------------------------------- Iván Arriola
  {
    nombre: 'Panel de configuración y selección de cámara',
    detalle:
      'Panel de configuración en pantalla para elegir la cámara y activar el modo demo, el avance manual y la malla. Se descartó con la rama interfaz-grafica.',
    commits: [
      '6533b67', // feat: agrega panel de configuracion y cambio de camara
    ],
  },
  {
    nombre: 'Rostro y manos sintéticos para probar sin cámara',
    detalle:
      'Puntos sintéticos del rostro y manos sintéticas para probar la interacción sin cámara, un control de demo que avanza solo y botones virtuales que se tocan con la mano, reemplazados después por los controles de la tablet. Se descartó con la rama interfaz-grafica.',
    commits: [
      '2553628', // feat: agrega funcionalidad para dibujar puntos sinteticos en el rostro y actualiza documentacion
      'aa140dc', // feat: implement synthetic hand generation and interaction controls
    ],
  },
  {
    nombre: 'Herramientas de desarrollo, repositorio y CI',
    detalle:
      'Script de desarrollo que reinicia el servidor solo, limpieza de .gitignore y actualización de dependencias, reversión de un merge accidental a main y un flujo de GitHub Actions que corre las pruebas en cada cambio.',
    commits: [
      '2292f7a', // feat: actualiza .gitignore y elimina dependencias obsoletas en package-lock.json
      'd9523ca', // feat: agrega script de desarrollo para reinicio automatico del servidor
      'afc16be', // Revertir merge accidental del PR #1 (solo en GitHub)
      '7a1d7aa', // feat: update @emnapi/core and @emnapi/runtime... (solo en GitHub)
      '3822523', // chore: agregar script de desarrollo
      '884a980', // ci: ejecutar pruebas en cada cambio
    ],
  },
  {
    nombre: 'Controles remotos, reflexión y narrativa',
    detalle:
      'Control del espejo desde una tablet (acción EMPEZAR, con botones animados y sincronizados con el estado), una fase de reflexión con preguntas y textos narrativos sobre la identidad de la ingeniería, y validación del contenido de los referentes. Se descartó con la rama interfaz-grafica.',
    commits: [
      '0bc738b', // feat: agrega funcionalidad de controles remotos y actualiza la interfaz de la tablet
      'f092880', // feat: agrega accion 'EMPEZAR' y actualiza la interfaz de controles remotos y documentacion
      'c927b9d', // feat: implement reflection phase with new actions and narrative texts
      '97182f5', // Separa respuestas en la tablet de controles
      'c1c491b', // Elimina respuestas de la tablet
      '847a5c8', // Refactor espejo application to enhance content validation and narrative structure (solo en GitHub)
      '9d66d23', // feat: update control routes to short paths and enhance control button animations (solo en GitHub)
      '02b908e', // feat: adjust control font size for improved readability (solo en GitHub)
      'ead42d2', // Anima y sincroniza los controles remotos (solo en GitHub)
    ],
  },
  {
    nombre: 'Temporizador y ritmo de los estados',
    detalle:
      'Temporizador en pantalla con el tiempo de cada estado, avance automático por defecto y los tiempos de cada estado ajustados, con pruebas del ritmo de la experiencia. Se descartó con la rama interfaz-grafica.',
    commits: [
      'd678d5d', // feat: agrega temporizador de estado y actualiza la interfaz de usuario
      'd591ebf', // Mueve temporizador abajo a la izquierda
      '74d8783', // feat: cambia el modo de avance a automatico y actualiza la descripcion
      'e2f3f96', // feat: ajusta los tiempos de los estados y añade pruebas para el ritmo inmersivo (solo en GitHub)
    ],
  },
  {
    nombre: 'Reorganización de los assets y logo de la facultad',
    detalle:
      'El catálogo (carreras.json) y las carpetas de imágenes pasan a assets/, con los LEEME al día e íconos SVG para el panel, y se suma a la pantalla el logo de FING y Udelar. Se descartó con la rama interfaz-grafica.',
    commits: [
      '8e27e43', // Refactor project structure: move carreras.json to assets...
      '05004b0', // Refactor code structure for improved readability... (en realidad, el logo) (solo en GitHub)
      'dfaa74b', // feat: eliminar archivo binario innecesario 'Logo Fing y Udelar.7z' (solo en GitHub)
    ],
  },
  {
    nombre: 'Catálogo ampliado de carreras',
    detalle:
      'Primero dieciocho propuestas de la facultad con su categoría y enlace oficial (en la rama descartada) y después, sobre main, de seis a once ingenierías en carreras.json, con sus carpetas y sus atajos de teclado.',
    commits: [
      '8ff3e14', // feat: expand educational offerings from 6 to 18 proposals... (solo en GitHub)
      'd7ddf31', // feat: ampliar catalogo a once ingenierias
      'c5d7e25', // feat: habilitar atajos para once carreras
    ],
  },
  {
    nombre: 'Composición de la escena alrededor de la cara',
    detalle:
      'Textos que se acomodan según dónde está el rostro (en la rama descartada) y, sobre main, efectos recortados para dibujarse fuera de la cara, la pose y el dibujo de la persona restaurados y la entrada de efecto, accesorio y textos coordinada en cada estado.',
    commits: [
      '030ce2e', // feat: implementar texto adaptativo en funcion de la ubicacion del rostro... (solo en GitHub)
      'fbf0377', // feat: agregar funciones para recortar y dibujar fuera de la cara en la escena
      '6b8182c', // fix: restaurar pose y composicion visual
    ],
  },
  {
    nombre: 'Segmentación de la persona y colisiones con la pose',
    detalle:
      'Segmentación de la persona con MediaPipe para dibujar los objetos por delante o por detrás de ella, detección de pose con colisiones contra los objetos y su diagnóstico en pantalla. Se descartó con la rama interfaz-grafica.',
    commits: [
      '346e455', // feat: implement person segmentation using MediaPipe (solo en GitHub)
      '67cd9f9', // feat: integrate pose detection and visualization (solo en GitHub)
      'cd984a3', // feat: actualizar documentacion y mejorar diagnostico de pose y colisiones (solo en GitHub)
      'e892668', // feat: eliminar estado anterior y ajustar logica de deteccion de manos (solo en GitHub)
      'b8ef5ee', // feat: ajustar parametros de visibilidad y deteccion en la configuracion de pose... (solo en GitHub)
    ],
  },
  {
    nombre: 'Imán y agarre de objetos con las manos',
    detalle:
      'Atracción de los objetos hacia las manos, detección de pose y agarre, repulsión según el estado de la mano, racimos del imán estables, seguimiento de cada mano por cercanía y un rango de atracción más amplio hacia arriba para atrapar lo que cae. Incluye las correcciones pedidas en la revisión del PR #6.',
    commits: [
      'cdf95ae', // feat: implementar atraccion de objetos hacia las manos y ajustar configuraciones de escena
      '2cc31b6', // feat: agregar deteccion de pose y funcionalidades de agarre en la experiencia
      '3711d53', // feat: agregar logica de estado de mano y repulsion de objetos en la experiencia
      '00fb7c9', // fix: atender observaciones del PR 6
      '8ad1193', // fix: estabilizar racimos del iman
      '71badfb', // fix: seguir manos por cercania
      'ba40804', // perf: reducir carga de objetos en escena
      '6c56eaf', // feat: implement asymmetric attraction range to capture objects falling from above...
      'f797e7f', // fix: increase interaction hitboxes and magnetic attraction factors...
    ],
  },
  {
    nombre: 'Animación de las nubes y tiempos de los estados',
    detalle:
      'Nueva lógica de la niebla (desplazamiento y posición de las nubes, con la velocidad corregida) y ajuste de los tiempos de cada estado y de sus transiciones (PR #7).',
    commits: [
      '6f15540', // feat: ajustar tiempos de estados y mejorar logica de transicion en la experiencia
      '74328bd', // feat: actualizar logica de niebla y ajustar pruebas para el desplazamiento
      '8c3375c', // feat: ajustar tiempos de configuracion y mejorar logica de posicionamiento de nubes
      '9856de7', // las nubes quedaron muy rapidas
    ],
  },
  {
    nombre: 'Servidor y sincronización con las tablets',
    detalle:
      'Robustez del servidor y del canal con las tablets: roles validados en el WebSocket, un único espejo a la vez, reinicios y cierre sincronizados, videos servidos por rangos con validación y caché, y cierre coordinado con la precarga.',
    commits: [
      'a1166a9', // fix: sincronizar reinicios y cierre de tablets
      '92a6145', // fix: validar roles del websocket
      '7499abe', // perf: transmitir videos por rangos
      '92b17e7', // fix: reservar un unico espejo websocket
      '7480a36', // fix: validar rangos y cache de contenido
      '0e7ed09', // perf: coordinar cierre y precarga
    ],
  },
  {
    nombre: 'Calibración de la detección y del inicio de sesión',
    detalle:
      'La sesión arranca solo con un rostro sostenido en el tiempo, y se calibran los umbrales de detección y las ventanas de retención para que el fondo y la iluminación no disparen detecciones falsas.',
    commits: [
      '13b874e', // fix: exigir rostro continuo para iniciar
      '524ae3d', // perf: calibrar umbrales de deteccion y ventanas de retencion...
    ],
  },
  {
    nombre: 'Documentación técnica, de contenido y despliegue',
    detalle:
      'Redacción de las guías de arquitectura, contenido y despliegue en docs/, y su actualización para doce carreras sin accesorio de cara.',
    commits: [
      '6f3d7b4', // docs: actualizar y agregar documentacion tecnica, de contenido y despliegue
      '81cd005', // docs: actualizar arquitectura y contenido para 12 carreras sin accesorios de cara
    ],
  },
  {
    nombre: 'Manos iluminadas',
    detalle:
      'Los aros rígidos de las manos se reemplazan por iluminación y coloreado de la mano, con un aura de energía y nodos brillantes.',
    commits: [
      'a1e58a7', // feat: reemplazar aros rigidos por iluminacion y coloreado de manos...
    ],
  },

  // --------------------------------------------------- Maite Martínez (MAITE)
  {
    nombre: 'Primera versión de las tablets',
    detalle:
      'Creación del repositorio y primera subida del proyecto de las tablets: servidor, pantallas de tablet y de control, estilos con cuatro temas, catálogo de cinco carreras con sus personas, videos de prueba y un simulador para elegir la carrera.',
    commits: [
      'e9eb1e8', // Initial commit
      'dc16274', // primer subida
    ],
  },
  {
    nombre: 'Instrucciones de arranque en el README',
    detalle: 'Pasos para levantar las tablets y el simulador que permite elegir la carrera.',
    commits: [
      '592f1a3', // Edit README.md
    ],
  },
  {
    nombre: 'Catálogo de catorce carreras y videos nuevos',
    detalle:
      'El catálogo pasa de cinco a catorce carreras, se suman videos de personas y de la escena inicial, y se prueban tipografías nuevas (Muffaroo, Roadster y Bringbold Nineties) en los temas de las tablets.',
    commits: [
      'f68ac37', // ultimos videos
    ],
  },
  {
    nombre: 'Tipografía Muffaroo en las tablets',
    detalle:
      'Los temas de las tablets pasan a usar Muffaroo en los títulos, el texto de cada persona pasa a la letra de cuerpo y se corrige la presentación de una persona.',
    commits: [
      '9a477f3', // cambios de tipografia
    ],
  },
];

// Nombre de la tarea de respaldo según el prefijo convencional del asunto.
const CATEGORIAS_DE_RESPALDO = {
  feat: 'Funcionalidades',
  fix: 'Correcciones',
  docs: 'Documentación',
  perf: 'Rendimiento',
  refactor: 'Reorganización del código',
  test: 'Pruebas',
  ci: 'Integración continua',
  build: 'Mantenimiento',
  chore: 'Mantenimiento',
  style: 'Mantenimiento',
};

// ===========================================================================
// Historial
// ===========================================================================

const HORA = 60 * 60 * 1000;
const avisos = new Set();

function git(ruta, args, opciones = {}) {
  return execFileSync('git', ['-C', ruta, ...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    ...opciones,
  });
}

// Los commits de TAREAS que el repositorio todavía tiene aunque ya no los
// alcance ninguna rama: un `git fetch --prune` borra origin/interfaz-grafica y,
// sin esto, el trabajo de Iván del 28/07 desaparecería de la planilla.
function commitsDeLaTablaEnElRepo(ruta) {
  const hashes = TAREAS.flatMap((tarea) => tarea.commits);
  const salida = git(ruta, ['cat-file', '--batch-check'], { input: `${hashes.join('\n')}\n` });
  return salida
    .split('\n')
    .map((linea) => linea.trim().split(' '))
    .filter(([, tipo]) => tipo === 'commit')
    .map(([hash]) => hash);
}

function leerRepo({ proyecto, ruta }) {
  if (!existsSync(ruta)) {
    avisos.add(`No encuentro el repositorio de ${proyecto} en ${ruta}: queda afuera de la planilla.`);
    return [];
  }
  try {
    const formato = `${['%H', '%aI', '%an', '%ae', '%P', '%s'].join('%x1f')}%x1e`;
    const salida = git(ruta, [
      '-c', 'i18n.logOutputEncoding=UTF-8',
      'log', `--format=${formato}`,
      '--branches', '--remotes', '--tags', 'HEAD',
      ...commitsDeLaTablaEnElRepo(ruta),
    ]);
    return salida
      .split('\x1e')
      .map((registro) => registro.replace(/^\s+/, ''))
      .filter(Boolean)
      .map((registro) => {
        const [hash, fecha, autor, correo, padres, asunto] = registro.split('\x1f');
        return {
          proyecto,
          hash,
          fecha, // ISO con la zona del autor: el día sale de acá, no del reloj de esta PC
          autor,
          correo,
          asunto: asunto.trim(),
          esMerge: padres.trim().split(' ').length > 1,
        };
      });
  } catch (error) {
    avisos.add(`No pude leer el historial de ${proyecto} (${ruta}): ${String(error.message).split('\n')[0]}`);
    return [];
  }
}

function leerHistorial() {
  const commits = REPOS.flatMap(leerRepo);
  const vistos = new Set(commits.map((commit) => commit.hash));
  for (const commit of COMMITS_SOLO_EN_GITHUB) {
    if (!vistos.has(commit.hash)) commits.push({ ...commit, esMerge: false });
  }
  for (const commit of commits) commit.instante = Date.parse(commit.fecha);
  return commits;
}

const comparable = (texto) =>
  texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

function identificar(commit) {
  const correo = commit.correo.toLowerCase();
  const nombre = comparable(commit.autor);
  const identidad = IDENTIDADES.find(
    ({ nombres, correos }) =>
      correos.some((otro) => otro.toLowerCase() === correo) ||
      nombres.some((otro) => comparable(otro) === nombre),
  );
  if (identidad) return identidad.persona;
  avisos.add(`Autor sin identidad en IDENTIDADES: ${commit.autor} <${commit.correo}>. Se usa el nombre tal cual.`);
  return commit.autor;
}

// ===========================================================================
// Tareas, sesiones y horas
// ===========================================================================

const PREFIJO_CONVENCIONAL = /^(\w+)(?:\([^)]*\))?!?:\s*/;

function tareaDeRespaldo(commit) {
  const prefijo = PREFIJO_CONVENCIONAL.exec(commit.asunto)?.[1].toLowerCase();
  const categoria = CATEGORIAS_DE_RESPALDO[prefijo] ?? 'Otros cambios';
  return { nombre: `${categoria} sin clasificar (${fechaCorta(commit.fecha)})`, respaldo: true };
}

function detalleDeRespaldo(commits) {
  const asunto = commits[0].asunto.replace(PREFIJO_CONVENCIONAL, '');
  const otros = commits.length - 1;
  const resto = otros === 0 ? '' : ` y ${otros} ${otros === 1 ? 'commit' : 'commits'} más`;
  return `Todavía sin tarea asignada: «${asunto}»${resto}. Hay que pasar${otros === 0 ? 'lo' : 'los'} a la tarea que corresponda en planilla.mjs.`;
}

function asignarTareas(commits) {
  const porHash = new Map();
  for (const tarea of TAREAS) {
    for (const hash of tarea.commits) {
      if (porHash.has(hash)) {
        avisos.add(`El commit ${hash} está en dos tareas, «${porHash.get(hash).nombre}» y «${tarea.nombre}»: vale la primera.`);
      } else {
        porHash.set(hash, tarea);
      }
    }
  }

  const encontrados = new Set();
  const porAsunto = [];
  const sinTarea = [];
  for (const commit of commits) {
    const hash = [...porHash.keys()].find((corto) => commit.hash.startsWith(corto));
    if (hash) {
      encontrados.add(hash);
      commit.tarea = porHash.get(hash);
      continue;
    }
    const regla = TAREAS.find(
      (tarea) =>
        (!tarea.proyecto || tarea.proyecto === commit.proyecto) &&
        (tarea.asuntos ?? []).some((expresion) => expresion.test(commit.asunto)),
    );
    if (regla) {
      commit.tarea = regla;
      porAsunto.push(commit);
    } else {
      commit.tarea = tareaDeRespaldo(commit);
      sinTarea.push(commit);
    }
  }

  for (const [hash, tarea] of porHash) {
    if (!encontrados.has(hash)) {
      avisos.add(`El commit ${hash} de «${tarea.nombre}» no aparece en ningún repositorio: ¿hash mal copiado, o una rama borrada que git ya limpió?`);
    }
  }
  return { porAsunto, sinTarea };
}

// Una sesión es una racha de commits de la misma persona separados por menos de
// HORAS_MAXIMAS_ENTRE_COMMITS. Vale del primero al último más el trabajo previo
// al primero, y se reparte en partes iguales entre sus commits: así, cada tarea
// se lleva horas en proporción a cuántos commits tiene en esa sesión.
function armarSesiones(commitsDeUnaPersona) {
  const ordenados = [...commitsDeUnaPersona].sort((a, b) => a.instante - b.instante);
  const sesiones = [];
  for (const commit of ordenados) {
    const actual = sesiones.at(-1);
    if (actual && commit.instante - actual.fin < HORAS_MAXIMAS_ENTRE_COMMITS * HORA) {
      actual.commits.push(commit);
      actual.fin = commit.instante;
    } else {
      sesiones.push({ inicio: commit.instante, fin: commit.instante, commits: [commit] });
    }
  }
  for (const sesion of sesiones) {
    sesion.horas = (sesion.fin - sesion.inicio) / HORA + HORAS_ANTES_DEL_PRIMER_COMMIT;
    for (const commit of sesion.commits) commit.horas = sesion.horas / sesion.commits.length;
  }
  return sesiones;
}

const claveDeFila = (persona, proyecto, tarea) =>
  [persona, proyecto, tarea].map((parte) => String(parte ?? '').trim()).join('\u0000');

function armarFilas(commits, horasReales) {
  const grupos = new Map();
  for (const commit of commits) {
    const clave = claveDeFila(commit.persona, commit.proyecto, commit.tarea.nombre);
    if (!grupos.has(clave)) grupos.set(clave, { clave, tarea: commit.tarea, commits: [] });
    grupos.get(clave).commits.push(commit);
  }

  return [...grupos.values()]
    .map(({ clave, tarea, commits: propios }) => {
      const ordenados = [...propios].sort((a, b) => a.instante - b.instante);
      const primero = ordenados[0];
      const ultimo = ordenados.at(-1);
      const horasExactas = ordenados.reduce((suma, commit) => suma + commit.horas, 0);
      return {
        clave,
        persona: primero.persona,
        proyecto: primero.proyecto,
        tarea: tarea.nombre,
        detalle: tarea.respaldo ? detalleDeRespaldo(ordenados) : tarea.detalle,
        desde: primero.instante,
        hasta: ultimo.instante,
        fechaDesde: fechaCorta(primero.fecha),
        fechaHasta: fechaCorta(ultimo.fecha),
        commits: ordenados.length,
        horasExactas,
        horas: redondear(horasExactas),
        horasReales: horasReales.get(clave) ?? '',
      };
    })
    .sort(
      (a, b) =>
        a.persona.localeCompare(b.persona, 'es') ||
        a.desde - b.desde ||
        a.hasta - b.hasta ||
        a.tarea.localeCompare(b.tarea, 'es'),
    );
}

// ===========================================================================
// Formatos
// ===========================================================================

function fechaCorta(iso) {
  const [anio, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

function hoy() {
  const ahora = new Date();
  const dos = (numero) => String(numero).padStart(2, '0');
  return `${dos(ahora.getDate())}/${dos(ahora.getMonth() + 1)}/${ahora.getFullYear()}`;
}

const redondear = (horas) =>
  Math.max(PASO_DE_REDONDEO, Math.round(horas / PASO_DE_REDONDEO) * PASO_DE_REDONDEO);

function formatearHoras(horas) {
  const texto = Number.isInteger(horas) ? horas.toFixed(1) : String(Math.round(horas * 100) / 100);
  return texto.replace('.', ',');
}

function enumerar(elementos) {
  if (elementos.length <= 1) return elementos.join('');
  return `${elementos.slice(0, -1).join(', ')} y ${elementos.at(-1)}`;
}

// --- CSV --------------------------------------------------------------------

const COLUMNAS = ['Integrante', 'Proyecto', 'Tarea', 'Detalle', 'Desde', 'Hasta', 'Commits', 'Horas estimadas', 'Horas reales'];

function campoCsv(valor) {
  const texto = String(valor ?? '');
  return /[;"\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

function textoCsv(filas) {
  const lineas = [
    COLUMNAS,
    ...filas.map((fila) => [
      fila.persona,
      fila.proyecto,
      fila.tarea,
      fila.detalle,
      fila.fechaDesde,
      fila.fechaHasta,
      fila.commits,
      formatearHoras(fila.horas),
      fila.horasReales,
    ]),
  ];
  return `\uFEFF${lineas.map((campos) => campos.map(campoCsv).join(';')).join('\r\n')}\r\n`;
}

function parsearCsv(texto, separador) {
  const filas = [];
  let fila = [];
  let campo = '';
  let entreComillas = false;
  for (let i = 0; i < texto.length; i++) {
    const letra = texto[i];
    if (entreComillas) {
      if (letra !== '"') campo += letra;
      else if (texto[i + 1] === '"') {
        campo += '"';
        i++;
      } else entreComillas = false;
    } else if (letra === '"') {
      entreComillas = true;
    } else if (letra === separador) {
      fila.push(campo);
      campo = '';
    } else if (letra === '\n' || letra === '\r') {
      if (letra === '\r' && texto[i + 1] === '\n') i++;
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = '';
    } else {
      campo += letra;
    }
  }
  if (campo !== '' || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }
  return filas;
}

// Lo que ya se completó a mano en «Horas reales» sobrevive a la regeneración.
function leerHorasReales() {
  const reales = new Map();
  if (!existsSync(SALIDA_CSV)) return reales;
  const texto = readFileSync(SALIDA_CSV, 'utf8').replace(/^\uFEFF/, '');
  const separador = texto.split(/\r?\n/, 1)[0].includes(';') ? ';' : ',';
  const [cabecera = [], ...filas] = parsearCsv(texto, separador);
  const columna = (nombre) => cabecera.findIndex((titulo) => titulo.trim() === nombre);
  const [persona, proyecto, tarea, horas] = ['Integrante', 'Proyecto', 'Tarea', 'Horas reales'].map(columna);
  if ([persona, proyecto, tarea, horas].includes(-1)) return reales;
  for (const fila of filas) {
    const valor = (fila[horas] ?? '').trim();
    if (valor) reales.set(claveDeFila(fila[persona], fila[proyecto], fila[tarea]), valor);
  }
  return reales;
}

// --- Markdown ---------------------------------------------------------------

const celda = (texto) => String(texto ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const negrita = (texto) => (texto === '' ? '' : `**${texto}**`);
const fila = (celdas) => `| ${celdas.join(' | ')} |`;
const sumar = (filas, campo) => filas.reduce((total, una) => total + una[campo], 0);

// El total de «Horas reales» solo tiene sentido cuando están todas cargadas.
function sumaDeReales(filas) {
  if (filas.length === 0 || filas.some((una) => una.horasReales === '')) return '';
  const numeros = filas.map((una) => Number(String(una.horasReales).trim().replace(',', '.')));
  return numeros.some(Number.isNaN) ? '' : formatearHoras(numeros.reduce((a, b) => a + b, 0));
}

function resumenDeMerges(merges) {
  const partes = [];
  for (const { proyecto } of REPOS) {
    const propios = merges.filter((merge) => merge.proyecto === proyecto);
    if (propios.length === 0) continue;
    const prs = propios
      .map((merge) => /Merge pull request #(\d+)/.exec(merge.asunto)?.[1])
      .filter(Boolean)
      .map(Number)
      .sort((a, b) => a - b);
    const otros = propios.length - prs.length;
    const trozos = [];
    if (prs.length === 1) trozos.push(`el del PR #${prs[0]}`);
    if (prs.length > 1) trozos.push(`los de los PR ${enumerar(prs.map((numero) => `#${numero}`))}`);
    if (otros > 0) trozos.push(`${otros} ${otros === 1 ? 'merge de ramas' : 'merges de ramas'}`);
    partes.push(`${proyecto === 'Espejo' ? 'en el Espejo' : `en ${proyecto}`}, ${trozos.join(', más ')}`);
  }
  return partes.length > 0 ? partes.join('; ') : 'no hubo';
}

// `historial` trae también los merges: ahí también firma la gente (los hechos
// desde GitHub, con el nombre de la cuenta).
function seccionMetodo({ historial, merges, recuperados }) {
  const horas = (numero) => `${formatearHoras(numero).replace(/,0$/, '')} ${numero === 1 ? 'hora' : 'horas'}`;
  const paso = formatearHoras(PASO_DE_REDONDEO);

  const nombres = new Map();
  for (const commit of historial) {
    if (!nombres.has(commit.persona)) nombres.set(commit.persona, new Set());
    nombres.get(commit.persona).add(commit.autor);
  }
  const alias = [...nombres]
    .filter(([, propios]) => propios.size > 1)
    .map(([persona, propios]) => {
      const lista = [...propios].sort((a, b) => a.localeCompare(b, 'es')).map((nombre) => `«${nombre}»`);
      return `${persona} firma como ${enumerar(lista)}`;
    });

  const lineas = [
    '## Cómo se estimaron las horas',
    '',
    '**Son estimaciones a partir del historial de commits, no horas medidas.** Antes de entregar la planilla, cada integrante tiene que corregir la columna «Horas reales».',
    '',
    `- **De dónde salen.** De los commits de todas las ramas de los dos repositorios, también de las que no quedaron en la versión actual, con las identidades de cada persona unificadas${alias.length > 0 ? ` (${alias.join('; ')})` : ''}.`,
  ];
  if (recuperados.length > 0) {
    const primero = recuperados.reduce((a, b) => (b.instante < a.instante ? b : a));
    const ultimo = recuperados.reduce((a, b) => (b.instante > a.instante ? b : a));
    const personas = enumerar([...new Set(recuperados.map((commit) => commit.persona))]);
    lineas.push(
      `- **Commits recuperados de GitHub.** El 06/08/2026, main y la rama interfaz-grafica del Espejo volvieron por force push a la primera versión, y ${recuperados.length} commits de ${personas} del ${fechaCorta(primero.fecha)} al ${fechaCorta(ultimo.fecha)} quedaron fuera de la historia: no están en ningún clon, pero siguen en GitHub y se tomaron de ahí. Ese trabajo no está en la versión actual, pero se hizo, y el detalle de cada tarea lo aclara.`,
    );
  }
  lineas.push(
    `- **Sesiones.** Por integrante, con los dos repositorios juntos, los commits se ordenan por fecha y se agrupan en sesiones: rachas de commits separados por menos de ${horas(HORAS_MAXIMAS_ENTRE_COMMITS)}. Cada sesión vale lo que va de su primer a su último commit, más ${horas(HORAS_ANTES_DEL_PRIMER_COMMIT)} por el trabajo previo al primero (la idea de git-hours), así que una sesión de un solo commit vale ${horas(HORAS_ANTES_DEL_PRIMER_COMMIT)}.`,
    '- **Reparto.** Las horas de cada sesión se reparten entre sus tareas en proporción a la **cantidad de commits** de cada una. Se prefirió eso a las líneas cambiadas porque las líneas las inflan las imágenes, los archivos generados y los documentos largos, y no reflejan el trabajo de borrar código o de ajustar un número.',
    `- **Redondeo.** Cada tarea se redondea al múltiplo de ${paso} h más cercano, sin bajar de ${paso} h, y los totales son la suma de esas cifras: por eso pueden quedar apenas por encima de la suma exacta de las sesiones.`,
    `- **Merges.** No son tareas y no suman horas: ${merges}.`,
    '',
    '**Lo que no ve.** Solo cuenta el tiempo que terminó en un commit: no ve reuniones, pruebas en el stand, diseño, filmaciones, investigación ni búsqueda de material, ni lo que se hizo y nunca se commiteó. Y cuando mucho trabajo entra en un solo commit, lo cuenta como una sesión corta: la primera versión del espejo (un único commit con la especificación, el plan y 412 pruebas) y la entrega «final» del 3/9 valen una hora cada una, y seguramente llevaron bastante más. Por eso la columna que vale es «Horas reales».',
    '',
    '**Las filas de MAITE** están porque MAITE es la pieza hermana del mismo stand: las tablets que, a dos metros del espejo, muestran a gente de la carrera que le tocó a cada visitante. Si ese trabajo no corresponde a este equipo, se borran esas filas y su total.',
    '',
    '**Para regenerarla** con commits nuevos se corre `npm run planilla`, que es `herramientas/planilla.mjs`. Conserva las «Horas reales» ya cargadas en el CSV mientras la tarea siga llamándose igual.',
  );
  return lineas;
}

function textoMd({ filas, sesionesPorPersona, merges, historial, recuperados }) {
  const personas = [...new Set(filas.map((una) => una.persona))];
  const ultimo = historial.reduce((a, b) => (b.instante > a.instante ? b : a));
  const lineas = [
    '# Planilla de tareas y horas',
    '',
    `Borrador de la planilla de tareas realizadas por cada integrante y horas dedicadas, generado el ${hoy()} a partir del historial de git de los dos repositorios del stand: el **Espejo** (este repositorio) y **MAITE** (las tablets). Llega hasta el último commit, del ${fechaCorta(ultimo.fecha)}.`,
    '',
    '> **Las horas son estimaciones sacadas de los commits, no horas medidas.** Antes de entregar la planilla, cada integrante tiene que completar la columna «Horas reales» con lo que de verdad dedicó. Cómo se calcularon, y qué se les escapa, está al final.',
    '',
    'Los mismos datos, para abrir en Excel, están en `planilla-de-tareas.csv`: una fila por integrante y tarea.',
    '',
    '## Totales por integrante',
    '',
    '| Integrante | Proyecto | Tareas | Commits | Sesiones | Horas estimadas | Horas reales |',
    '|---|---|--:|--:|--:|--:|--:|',
  ];
  for (const persona of personas) {
    const propias = filas.filter((una) => una.persona === persona);
    lineas.push(
      fila([
        celda(persona),
        enumerar([...new Set(propias.map((una) => una.proyecto))]),
        propias.length,
        sumar(propias, 'commits'),
        sesionesPorPersona.get(persona),
        formatearHoras(sumar(propias, 'horas')),
        sumaDeReales(propias),
      ]),
    );
  }
  const sesiones = [...sesionesPorPersona.values()].reduce((a, b) => a + b, 0);
  lineas.push(
    fila([
      '**Total**',
      '',
      `**${filas.length}**`,
      `**${sumar(filas, 'commits')}**`,
      `**${sesiones}**`,
      `**${formatearHoras(sumar(filas, 'horas'))}**`,
      negrita(sumaDeReales(filas)),
    ]),
  );

  for (const persona of personas) {
    const propias = filas.filter((una) => una.persona === persona);
    const proyectos = [...new Set(propias.map((una) => una.proyecto))];
    const conProyecto = proyectos.length > 1;
    lineas.push('', `## ${persona}`, '');
    if (!conProyecto) lineas.push(`Proyecto: ${proyectos[0]}.`, '');
    if (proyectos.includes('MAITE')) {
      lineas.push(
        '> Las filas de MAITE salen de su repositorio: es la pieza hermana del mismo stand. Si ese trabajo no le corresponde a este equipo, se borran, acá y en el CSV.',
        '',
      );
    }
    const titulos = ['Tarea', 'Detalle', 'Desde', 'Hasta', 'Commits', 'Horas estimadas', 'Horas reales'];
    const alineacion = ['---', '---', '---', '---', '--:', '--:', '--:'];
    lineas.push(
      fila(conProyecto ? ['Proyecto', ...titulos] : titulos),
      fila(conProyecto ? ['---', ...alineacion] : alineacion),
    );
    for (const una of propias) {
      const celdas = [
        celda(una.tarea),
        celda(una.detalle),
        una.fechaDesde,
        una.fechaHasta,
        una.commits,
        formatearHoras(una.horas),
        celda(una.horasReales),
      ];
      lineas.push(fila(conProyecto ? [una.proyecto, ...celdas] : celdas));
    }
    const total = [
      '**Total**',
      '',
      '',
      '',
      `**${sumar(propias, 'commits')}**`,
      `**${formatearHoras(sumar(propias, 'horas'))}**`,
      negrita(sumaDeReales(propias)),
    ];
    lineas.push(fila(conProyecto ? ['', ...total] : total));
  }

  lineas.push('', ...seccionMetodo({ historial, merges, recuperados }));
  return `${lineas.join('\n')}\n`;
}

// ===========================================================================
// Principal
// ===========================================================================

function informar({ filas, sesionesPorPersona, porAsunto, sinTarea, recuperados }) {
  console.log(`Planilla escrita en:\n  ${SALIDA_CSV}\n  ${SALIDA_MD}\n`);
  for (const persona of new Set(filas.map((una) => una.persona))) {
    const propias = filas.filter((una) => una.persona === persona);
    console.log(
      `${persona}: ${formatearHoras(sumar(propias, 'horas'))} h (exactas ${sumar(propias, 'horasExactas').toFixed(2)}) ` +
        `en ${propias.length} tareas, ${sumar(propias, 'commits')} commits, ${sesionesPorPersona.get(persona)} sesiones`,
    );
    for (const una of propias) {
      console.log(`  ${formatearHoras(una.horas).padStart(5)} h  ${una.proyecto.padEnd(6)}  ${una.tarea}`);
    }
  }
  const listar = (titulo, lista) => {
    if (lista.length === 0) return;
    console.log(`\n${titulo}`);
    for (const commit of lista) {
      console.log(`  ${commit.hash.slice(0, 7)}  ${fechaCorta(commit.fecha)}  ${commit.persona}: ${commit.asunto}  ->  ${commit.tarea.nombre}`);
    }
  };
  listar('Commits asignados por su asunto (conviene fijarlos en TAREAS):', porAsunto);
  listar('Commits sin tarea (van a una tarea de respaldo por prefijo y día):', sinTarea);
  if (recuperados.length > 0) {
    console.log(`\nSe sumaron ${recuperados.length} commits que solo están en GitHub (COMMITS_SOLO_EN_GITHUB).`);
  }
  if (avisos.size > 0) {
    console.log('\nAvisos:');
    for (const aviso of avisos) console.log(`  - ${aviso}`);
  }
}

function principal() {
  const historial = leerHistorial();
  if (historial.length === 0) {
    console.error('No hay commits para procesar.');
    process.exitCode = 1;
    return;
  }
  for (const commit of historial) commit.persona = identificar(commit);

  const merges = historial.filter((commit) => commit.esMerge);
  const commits = historial.filter((commit) => !commit.esMerge);
  const { porAsunto, sinTarea } = asignarTareas(commits);

  const sesionesPorPersona = new Map();
  for (const persona of new Set(commits.map((commit) => commit.persona))) {
    sesionesPorPersona.set(persona, armarSesiones(commits.filter((commit) => commit.persona === persona)).length);
  }

  const horasReales = leerHorasReales();
  const filas = armarFilas(commits, horasReales);
  for (const clave of horasReales.keys()) {
    if (!filas.some((una) => una.clave === clave)) {
      avisos.add(`Había «Horas reales» cargadas para «${clave.split('\u0000').join(' / ')}», que ya no existe como tarea: se pierden.`);
    }
  }

  const recuperados = commits.filter((commit) => commit.soloEnGithub);
  writeFileSync(SALIDA_CSV, textoCsv(filas), 'utf8');
  writeFileSync(
    SALIDA_MD,
    textoMd({ filas, sesionesPorPersona, merges: resumenDeMerges(merges), historial, recuperados }),
    'utf8',
  );
  informar({ filas, sesionesPorPersona, porAsunto, sinTarea, recuperados });
}

principal();
