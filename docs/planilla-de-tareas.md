# Planilla de tareas y horas

Borrador de la planilla de tareas realizadas por cada integrante y horas dedicadas, generado el 11/09/2026 a partir del historial de git de los dos repositorios del stand: el **Espejo** (este repositorio) y **MAITE** (las tablets). Llega hasta el último commit, del 11/09/2026.

> **Las horas son estimaciones sacadas de los commits, no horas medidas.** Antes de entregar la planilla, cada integrante tiene que completar la columna «Horas reales» con lo que de verdad dedicó. Cómo se calcularon, y qué se les escapa, está al final.

Los mismos datos, para abrir en Excel, están en `planilla-de-tareas.csv`: una fila por integrante y tarea.

## Totales por integrante

| Integrante | Proyecto | Tareas | Commits | Sesiones | Horas estimadas | Horas reales |
|---|---|--:|--:|--:|--:|--:|
| Iván Arriola | Espejo | 15 | 60 | 5 | 12,0 |  |
| Joao Calado Moura | Espejo | 20 | 52 | 14 | 25,0 |  |
| Maite Martínez | MAITE | 4 | 5 | 3 | 4,0 |  |
| **Total** |  | **39** | **117** | **22** | **41,0** |  |

## Iván Arriola

Proyecto: Espejo.

| Tarea | Detalle | Desde | Hasta | Commits | Horas estimadas | Horas reales |
| --- | --- | --- | --- | --: | --: | --: |
| Panel de configuración y selección de cámara | Panel de configuración en pantalla para elegir la cámara y activar el modo demo, el avance manual y la malla. Se descartó con la rama interfaz-grafica. | 28/07/2026 | 28/07/2026 | 1 | 0,5 |  |
| Herramientas de desarrollo, repositorio y CI | Script de desarrollo que reinicia el servidor solo, limpieza de .gitignore y actualización de dependencias, reversión de un merge accidental a main y un flujo de GitHub Actions que corre las pruebas en cada cambio. | 28/07/2026 | 06/08/2026 | 6 | 1,0 |  |
| Rostro y manos sintéticos para probar sin cámara | Puntos sintéticos del rostro y manos sintéticas para probar la interacción sin cámara, un control de demo que avanza solo y botones virtuales que se tocan con la mano, reemplazados después por los controles de la tablet. Se descartó con la rama interfaz-grafica. | 28/07/2026 | 28/07/2026 | 2 | 0,5 |  |
| Controles remotos, reflexión y narrativa | Control del espejo desde una tablet (acción EMPEZAR, con botones animados y sincronizados con el estado), una fase de reflexión con preguntas y textos narrativos sobre la identidad de la ingeniería, y validación del contenido de los referentes. Se descartó con la rama interfaz-grafica. | 28/07/2026 | 30/07/2026 | 9 | 2,0 |  |
| Temporizador y ritmo de los estados | Temporizador en pantalla con el tiempo de cada estado, avance automático por defecto y los tiempos de cada estado ajustados, con pruebas del ritmo de la experiencia. Se descartó con la rama interfaz-grafica. | 28/07/2026 | 28/07/2026 | 4 | 1,0 |  |
| Reorganización de los assets y logo de la facultad | El catálogo (carreras.json) y las carpetas de imágenes pasan a assets/, con los LEEME al día e íconos SVG para el panel, y se suma a la pantalla el logo de FING y Udelar. Se descartó con la rama interfaz-grafica. | 28/07/2026 | 29/07/2026 | 3 | 0,5 |  |
| Catálogo ampliado de carreras | Primero dieciocho propuestas de la facultad con su categoría y enlace oficial (en la rama descartada) y después, sobre main, de seis a once ingenierías en carreras.json, con sus carpetas y sus atajos de teclado. | 29/07/2026 | 07/08/2026 | 3 | 1,0 |  |
| Composición de la escena alrededor de la cara | Textos que se acomodan según dónde está el rostro (en la rama descartada) y, sobre main, efectos recortados para dibujarse fuera de la cara, la pose y el dibujo de la persona restaurados y la entrada de efecto, accesorio y textos coordinada en cada estado. | 29/07/2026 | 06/08/2026 | 3 | 0,5 |  |
| Segmentación de la persona y colisiones con la pose | Segmentación de la persona con MediaPipe para dibujar los objetos por delante o por detrás de ella, detección de pose con colisiones contra los objetos y su diagnóstico en pantalla. Se descartó con la rama interfaz-grafica. | 29/07/2026 | 29/07/2026 | 5 | 1,0 |  |
| Imán y agarre de objetos con las manos | Atracción de los objetos hacia las manos, detección de pose y agarre, repulsión según el estado de la mano, racimos del imán estables, seguimiento de cada mano por cercanía y un rango de atracción más amplio hacia arriba para atrapar lo que cae. Incluye las correcciones pedidas en la revisión del PR #6. | 06/08/2026 | 14/08/2026 | 9 | 1,5 |  |
| Animación de las nubes y tiempos de los estados | Nueva lógica de la niebla (desplazamiento y posición de las nubes, con la velocidad corregida) y ajuste de los tiempos de cada estado y de sus transiciones (PR #7). | 06/08/2026 | 06/08/2026 | 4 | 0,5 |  |
| Servidor y sincronización con las tablets | Robustez del servidor y del canal con las tablets: roles validados en el WebSocket, un único espejo a la vez, reinicios y cierre sincronizados, videos servidos por rangos con validación y caché, y cierre coordinado con la precarga. | 06/08/2026 | 06/08/2026 | 6 | 0,5 |  |
| Calibración de la detección y del inicio de sesión | La sesión arranca solo con un rostro sostenido en el tiempo, y se calibran los umbrales de detección y las ventanas de retención para que el fondo y la iluminación no disparen detecciones falsas. | 06/08/2026 | 14/08/2026 | 2 | 0,5 |  |
| Documentación técnica, de contenido y despliegue | Redacción de las guías de arquitectura, contenido y despliegue en docs/, y su actualización para doce carreras sin accesorio de cara. | 14/08/2026 | 14/08/2026 | 2 | 0,5 |  |
| Manos iluminadas | Los aros rígidos de las manos se reemplazan por iluminación y coloreado de la mano, con un aura de energía y nodos brillantes. | 14/08/2026 | 14/08/2026 | 1 | 0,5 |  |
| **Total** |  |  |  | **60** | **12,0** |  |

## Joao Calado Moura

Proyecto: Espejo.

| Tarea | Detalle | Desde | Hasta | Commits | Horas estimadas | Horas reales |
| --- | --- | --- | --- | --: | --: | --: |
| Primera versión del espejo mágico | Diseño (especificación y plan) e implementación inicial del espejo: detección de rostro y manos, sorteo de carrera, objetos que caen y se manotean, efectos por carrera y sincronización con tablets, con 412 pruebas. Todo entró en un solo commit. | 28/07/2026 | 28/07/2026 | 1 | 1,0 |  |
| Imán de las manos y nubes en reposo | Cambios tras la primera prueba con una persona ajena al desarrollo: las manos atraen los objetos como un imán, los objetos llegan al piso, el espejo descansa cubierto de nubes y la escena dura mientras la persona siga sentada (PR #6). | 04/08/2026 | 04/08/2026 | 1 | 0,5 |  |
| Señal visual de las manos | Los aros de las palmas pasan a verse siempre, con el color de la carrera, y más adelante el dibujo de la mano se reemplaza por el campo del imán: un resplandor en la palma y bandas de luz que se cierran sobre ella. | 04/08/2026 | 16/08/2026 | 2 | 1,0 |  |
| Revisión del PR #7 (nubes y robustez) | Correcciones pedidas en la revisión del PR de Iván, cada una con su prueba: el servidor ya no se cae con un archivo vacío, la presencia se mide en tiempo y no en cuadros, la cámara avisa si se corta y npm run listo verifica los tres modelos. | 07/08/2026 | 07/08/2026 | 1 | 1,0 |  |
| Fotos de los objetos de cada ingeniería | Setenta y dos fotos de objetos para las doce ingenierías, en PNG con el fondo recortado, con los créditos de las que vienen de Wikimedia Commons y las herramientas para recortarlas y generar PNG de respaldo. | 13/08/2026 | 13/08/2026 | 1 | 1,0 |  |
| Accesorio de la cara: respaldo vectorial y eliminación | Figuras vectoriales de respaldo para el accesorio de cada carrera y recorte limpio de trece fotos de objetos (cuatro reemplazadas por fotos de estudio de Wikimedia Commons). Esa misma noche se sacó entero el accesorio anclado a la cara y se barrieron sus restos. | 13/08/2026 | 13/08/2026 | 3 | 1,5 |  |
| Hooks de git que protegen main | Hooks versionados (pre-commit, pre-merge-commit y pre-push) que bloquean los commits y los push directos a main, y que se activan solos con npm install. | 13/08/2026 | 13/08/2026 | 1 | 0,5 |  |
| Catálogo de doce carreras y limpieza | Tecla para la duodécima carrera con una prueba que cruza los atajos contra carreras.json, el tope de sesión vigilando también el enganche, el chaleco como séptimo objeto de civil y limpieza de código muerto, LEEME y documentación desfasada. | 16/08/2026 | 16/08/2026 | 2 | 0,5 |  |
| Espejo autónomo: sin tablets, WebSocket ni referentes | Se sacan del contenido los referentes y sus videos, y del código todo el subsistema de tablets (WebSocket, protocolo y cliente): el servidor queda en archivos estáticos sin dependencias y la documentación se pone al día (PR #8). | 16/08/2026 | 16/08/2026 | 2 | 0,5 |  |
| Detección a más distancia y estabilidad de la sesión | Los detectores analizan solo el recorte visible de la cámara (el triple de alcance), los colchones de presencia se recalibran para no cortarle la sesión a quien sigue sentado y liberar el espejo cuando alguien se va, MediaPipe se reintenta en CPU si no hay GPU y el video de humo ya no puede frenar el arranque. | 16/08/2026 | 21/08/2026 | 3 | 2,5 |  |
| Elección con la mano y puente a MAITE | Rediseño de la experiencia: la persona elige la ingeniería sosteniendo la mano sobre uno de los objetos que la rodean, su fondo aparece recortado contra la silueta y el espejo le avisa a MAITE para que las tablets acompañen. Después, las doce carreras quedan mapeadas a los ids de MAITE. | 21/08/2026 | 28/08/2026 | 2 | 1,0 |  |
| Tipografía compartida con las tablets | El espejo pasa a usar la letra de las tablets (primero Germania One y después Muffaroo, la que los temas de MAITE muestran de verdad), esperando a que la fuente cargue antes del primer cuadro y con la nota de licencia que exige npm run listo. | 21/08/2026 | 28/08/2026 | 2 | 1,0 |  |
| Explorar las ingenierías y humo en reposo | Agarrar un objeto muestra su ingeniería y agarrar otro la reemplaza (tres estados se funden en EXPLORACION), el rostro pasa a ser lo que sostiene la sesión y la pantalla de espera queda cubierta de un humo que respira. | 27/08/2026 | 28/08/2026 | 2 | 1,0 |  |
| Fondos de cada ingeniería: escenas vectoriales y fotografías | Escenas vectoriales de respaldo del lugar donde se trabaja cada ingeniería, fondos candidatos con el lugar del objeto, una herramienta para compararlos tal como se verían en el espejo y dos fotografías por carrera de Wikimedia Commons, recortadas a 9:16, oscurecidas y puestas como fondo activo. | 28/08/2026 | 29/08/2026 | 7 | 2,0 |  |
| Documentación técnica al día | CLAUDE.md, README y las guías de docs/ reescritos para describir el sistema real: primero la máquina de estados nueva y la exploración, después el carrusel de doce, el objeto en su lugar, los fondos candidatos y Muffaroo. | 28/08/2026 | 29/08/2026 | 2 | 1,0 |  |
| Diseño y plan de la devolución de la cátedra | Especificación y plan de implementación (diez tareas, con las pruebas antes que el código) para responder a la devolución de la cátedra: carrusel de doce, nombre al pie, objeto dentro del fondo, tres fondos por carrera y Muffaroo. | 28/08/2026 | 28/08/2026 | 2 | 0,5 |  |
| Carrusel de las doce ingenierías | El tablero pasa a ser un anillo con una ranura por carrera que gira lento y del que solo se ve la ventana de arriba. Ofrece las doce en orden barajado y se detiene mientras se sostiene un objeto. | 28/08/2026 | 28/08/2026 | 2 | 0,5 |  |
| El objeto vuela a su lugar y el nombre va al pie | El objeto agarrado vuela de su ranura a un lugar del fondo y flota ahí con un halo del color de la carrera, y el nombre de la ingeniería va al pie. El 10/09 se corrige para que aterrice a la vista también en monitores apaisados. | 28/08/2026 | 10/09/2026 | 4 | 1,5 |  |
| Elección única, fondos con video y fotos definitivas | Entrega del 3/9 en un único commit («final»): se elige una sola vez y el carrusel se apaga al elegir, los fondos pueden ser un video en loop y cada carrera queda con tres fondos candidatos reales, con sus criterios y créditos (PR #9). | 03/09/2026 | 03/09/2026 | 1 | 1,0 |  |
| Segunda devolución de la cátedra: objetos escondidos, fichas y un solo color | Cuatro objetos por ingeniería con su nombre y su descripción (el del carrusel y tres escondidos en la periferia del fondo, meciéndose), fichas que se abren al pasar la mano, un solo color de MAITE para los nombres y la carga, un sostenido de tres segundos, fundidos en todo lo que aparecía de golpe, herramientas para comparar fondos y colores en la reunión, la documentación y esta planilla. Después, los arreglos de dos revisiones de código: nombres de ficha medidos, objetos al alcance de la mano y sin que una ficha tape a otro, nada que salte al aterrizar ni en el cierre, la copia del objeto leído delante de la persona y la herramienta de fondos decidiendo igual que el espejo. | 10/09/2026 | 11/09/2026 | 11 | 5,5 |  |
| **Total** |  |  |  | **52** | **25,0** |  |

## Maite Martínez

Proyecto: MAITE.

> Las filas de MAITE salen de su repositorio: es la pieza hermana del mismo stand. Si ese trabajo no le corresponde a este equipo, se borran, acá y en el CSV.

| Tarea | Detalle | Desde | Hasta | Commits | Horas estimadas | Horas reales |
| --- | --- | --- | --- | --: | --: | --: |
| Primera versión de las tablets | Creación del repositorio y primera subida del proyecto de las tablets: servidor, pantallas de tablet y de control, estilos con cuatro temas, catálogo de cinco carreras con sus personas, videos de prueba y un simulador para elegir la carrera. | 14/08/2026 | 14/08/2026 | 2 | 1,0 |  |
| Instrucciones de arranque en el README | Pasos para levantar las tablets y el simulador que permite elegir la carrera. | 20/08/2026 | 20/08/2026 | 1 | 1,0 |  |
| Catálogo de catorce carreras y videos nuevos | El catálogo pasa de cinco a catorce carreras, se suman videos de personas y de la escena inicial, y se prueban tipografías nuevas (Muffaroo, Roadster y Bringbold Nineties) en los temas de las tablets. | 26/08/2026 | 26/08/2026 | 1 | 1,0 |  |
| Tipografía Muffaroo en las tablets | Los temas de las tablets pasan a usar Muffaroo en los títulos, el texto de cada persona pasa a la letra de cuerpo y se corrige la presentación de una persona. | 26/08/2026 | 26/08/2026 | 1 | 1,0 |  |
| **Total** |  |  |  | **5** | **4,0** |  |

## Cómo se estimaron las horas

**Son estimaciones a partir del historial de commits, no horas medidas.** Antes de entregar la planilla, cada integrante tiene que corregir la columna «Horas reales».

- **De dónde salen.** De los commits de todas las ramas de los dos repositorios, también de las que no quedaron en la versión actual, con las identidades de cada persona unificadas (Joao Calado Moura firma como «Joao», «Joao Calado» y «João calado moura»; Maite Martínez firma como «Maite Martinez» y «Maite Sathya Martinez Hernandez»).
- **Commits recuperados de GitHub.** El 06/08/2026, main y la rama interfaz-grafica del Espejo volvieron por force push a la primera versión, y 16 commits de Iván Arriola del 28/07/2026 al 30/07/2026 quedaron fuera de la historia: no están en ningún clon, pero siguen en GitHub y se tomaron de ahí. Ese trabajo no está en la versión actual, pero se hizo, y el detalle de cada tarea lo aclara.
- **Sesiones.** Por integrante, con los dos repositorios juntos, los commits se ordenan por fecha y se agrupan en sesiones: rachas de commits separados por menos de 2 horas. Cada sesión vale lo que va de su primer a su último commit, más 1 hora por el trabajo previo al primero (la idea de git-hours), así que una sesión de un solo commit vale 1 hora.
- **Reparto.** Las horas de cada sesión se reparten entre sus tareas en proporción a la **cantidad de commits** de cada una. Se prefirió eso a las líneas cambiadas porque las líneas las inflan las imágenes, los archivos generados y los documentos largos, y no reflejan el trabajo de borrar código o de ajustar un número.
- **Redondeo.** Cada tarea se redondea al múltiplo de 0,5 h más cercano, sin bajar de 0,5 h, y los totales son la suma de esas cifras: por eso pueden quedar apenas por encima de la suma exacta de las sesiones.
- **Merges.** No son tareas y no suman horas: en el Espejo, los de los PR #7, #8 y #9, más 2 merges de ramas; en MAITE, 1 merge de ramas.

**Lo que no ve.** Solo cuenta el tiempo que terminó en un commit: no ve reuniones, pruebas en el stand, diseño, filmaciones, investigación ni búsqueda de material, ni lo que se hizo y nunca se commiteó. Y cuando mucho trabajo entra en un solo commit, lo cuenta como una sesión corta: la primera versión del espejo (un único commit con la especificación, el plan y 412 pruebas) y la entrega «final» del 3/9 valen una hora cada una, y seguramente llevaron bastante más. Por eso la columna que vale es «Horas reales».

**Las filas de MAITE** están porque MAITE es la pieza hermana del mismo stand: las tablets que, a dos metros del espejo, muestran a gente de la carrera que le tocó a cada visitante. Si ese trabajo no corresponde a este equipo, se borran esas filas y su total.

**Para regenerarla** con commits nuevos se corre `npm run planilla`, que es `herramientas/planilla.mjs`. Conserva las «Horas reales» ya cargadas en el CSV mientras la tarea siga llamándose igual.
