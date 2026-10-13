# -*- coding: utf-8 -*-
"""
Los guiones con los que se generaron las siete escenas que el espejo tuvo hasta
octubre de 2026 —Agrimensura, Civil, Comunicacion, Electrica, Fisico-Matematica,
Forestal y Produccion—, tal como estaban en herramientas/escenas.py.

Esas carreras pasaron a una foto con sus objetos fotografiados adentro
(herramientas/ubicar.py) y dejaron de generarse: en escenas.py no queda ningun
guion. Aca siguen por dos razones. Las pruebas de la herramienta necesitan
guiones de verdad —el orden de los objetos, las semillas, que el juez no lea el
sitio— y test_escenas.py los pone en lugar de los de escenas.py mientras corre.
Y son el ejemplo de como se escribe uno, con lo que se aprendio de cada objeto
que no salia: el de una carrera nueva va en escenas.GUIONES, con esta forma.

Los ids de los objetos son los de las carpetas de entonces: ya no existen en
contenido/carreras/, y por eso estos guiones no pueden volver a escenas.py tal
cual.
"""

GUIONES = {
    'agrimensura': {
        'escena': 'surveying instrument storage room interior, tall grey metal shelving units with empty shelves along both side walls up to the ceiling, workbenches below, cool daylight',
        'objetos': [
            ('prisma-topografico', 'a yellow and black surveying reflector prism on a small stand, on the metal shelf'),
            ('nivel-automatico', 'a yellow automatic surveying level instrument, on the metal shelf'),
            ('receptor-gnss', 'a black GNSS survey antenna on a short metal pole, mounted under the ceiling'),
            ('estacion-total', 'a yellow and grey total station survey instrument with a keypad, on a yellow tripod on the floor'),
            ('mira-estadal', 'a tall white levelling staff rod with black and red E-shaped markings and numbers, leaning against the shelving'),
        ],
    },
    'civil': {
        'escena': 'concrete materials testing laboratory interior, empty concrete benches and '
                  'steel racks along both side walls, bare grey walls, overhead lighting',
        # Arriba al centro el puente no salia en ningun intento: ahi cuelga la
        # viga, de un gancho de grua, y la maqueta del puente va a la mesada.
        'objetos': [
            ('casco-seguridad', 'a bright yellow construction safety helmet, on the shelf'),
            ('cono-abrams', 'a steel slump test cone for concrete, on a small steel wall shelf'),
            ('viga-acero', 'a short grey steel I-beam, hanging from a crane hook on two chains'),
            ('hormigonera', 'a small orange portable concrete mixer, on the concrete ledge'),
            # Fina y clara, la maqueta se plantaba chica y el modelo la borraba: va
            # entera (COBERTURA_FINA), sobre la mesada de la derecha.
            ('puente-atirantado', 'a white scale model of a cable-stayed bridge with two tall towers and fan cables, on the concrete bench'),
        ],
    },
    'comunicacion': {
        'escena': 'radio frequency laboratory interior, empty instrument benches and bare equipment '
                  'racks along both side walls, grey walls, cool even light',
        # La torre no salia colgada: arriba al centro va el satelite, que se
        # cuelga como en un museo, y la torre va parada arriba del gabinete.
        'objetos': [
            ('bobina-fibra', 'a large spool of bright yellow optical fiber cable, on top of the grey cabinet'),
            ('torre-telecomunicaciones', 'a red and white steel lattice telecom tower model, standing '
                                         'on top of the grey cabinet'),
            ('satelite-comunicaciones', 'a scale model of a communications satellite with blue solar '
                                        'panels, hanging from the ceiling on thin wires'),
            ('analizador-espectro', 'a rack spectrum analyzer with a glowing screen, on the bench'),
            ('antena-parabolica', 'a white parabolic dish antenna on a stand, on the bench'),
        ],
    },
    'electrica': {
        # El salon de hormigon de antes tenia la pared derecha desnuda: el motor,
        # el panel y el transformador no tenian donde apoyarse y no se pintaron.
        # Estanterias a los dos costados y mesadas abajo, como en Produccion.
        'escena': 'electrical engineering laboratory interior, tall grey metal shelving units with '
                  'empty shelves along both side walls, sturdy steel workbenches below, polished '
                  'concrete floor, dark ceiling with lights along the side walls',
        'objetos': [
            ('multimetro', 'a yellow digital multimeter with red and black test leads, on the metal shelf'),
            ('panel-solar', 'a dark blue photovoltaic solar panel with a silver frame, standing upright on the metal shelf'),
            # El del carrusel: la columna de discos de su PNG.
            ('cadena-aisladores', 'a long vertical string of seven glossy red-brown porcelain insulator discs with galvanized steel fittings, hanging from the ceiling on a steel hook'),
            ('motor-trifasico', 'a blue three phase induction electric motor, on the steel workbench'),
            ('transformador-trifasico', 'a large green power transformer with brown porcelain bushings, on the steel workbench'),
        ],
    },
    'fisico-matematico': {
        # En los estantes blancos de antes el vidrio y el blanco no se veian:
        # estantes de madera, mesas opticas negras y techo oscuro.
        'escena': 'physics optics laboratory interior, light wooden shelves with empty shelves along '
                  'both side walls, black optical tables below, light grey walls, dark ceiling with '
                  'lights along the side walls, bright daylight',
        'objetos': [
            ('prisma-optico', 'a large triangular glass prism on a black stand, casting a bright '
                              'rainbow onto the wooden shelf'),
            # El del carrusel: aros negros alrededor de un disco de bronce, como su PNG.
            ('giroscopio', 'a precision gyroscope with black gimbal rings around a brass rotor disc on '
                           'a black base, on the wooden shelf'),
            ('pendulo-foucault', 'a brass pendulum bob, hanging from a long wire from the ceiling'),
            ('osciloscopio', 'a digital oscilloscope with a glowing waveform screen, on the black optical table'),
            ('superficie-3d', 'a white 3d printed mathematical saddle surface model, on the black optical table'),
        ],
    },
    'forestal': {
        'escena': 'forest logging yard, stacks of cut logs piled along both sides, empty dirt track '
                  'down the middle, tall pine trees, soft overcast daylight',
        'objetos': [
            ('forcipula', 'a blue forestry caliper tool, resting on the log stack'),
            # A media altura entre los pinos no hay donde apoyar nada: ahi va la
            # motosierra clavada en el tronco, como se la deja en el monte, y el
            # plantin baja al piso, junto a los troncos.
            ('motosierra', 'an orange professional chainsaw, with its guide bar stuck into a pine tree trunk'),
            ('dron-multiespectral', 'a black quadcopter survey drone, flying in the air'),
            ('plantin', 'a small tree seedling with broad green leaves in a black plastic tube, standing on the ground beside the cut logs'),
            ('autocargador', 'a yellow forestry forwarder machine, parked among the logs'),
        ],
    },
    'produccion': {
        # El galpon enorme de antes no tenia donde apoyar nada a la altura de los
        # objetos de arriba: el engranaje flotaba delante del techo, y el calibre
        # no se llego a pintar. Estanterias pegadas a los dos costados.
        'escena': 'factory warehouse interior, tall steel pallet racking with empty shelves close '
                  'on both sides, steel workbenches below, polished concrete floor, '
                  'overhead industrial lighting',
        # Los de los costados van en los estantes del rack, donde se apoyan; arriba
        # al centro hay techo, y lo unico que puede ir ahi es la cinta colgada.
        # Amarilla, porque gris contra el techo gris no se pintaba nunca.
        'objetos': [
            ('calibre-digital', 'a long stainless steel digital caliper with a black digital display, '
                                'lying flat on the orange rack beam'),
            ('engranaje-industrial', 'a large polished steel industrial gear, standing on the rack shelf'),
            ('cinta-transportadora', 'a short yellow belt conveyor section with a cardboard box on it, '
                                     'hanging from the ceiling on two chains'),
            ('pallet', 'a wooden pallet stacked with cardboard boxes, on the lowest rack level'),
            ('brazo-robotico', 'a single white industrial robot arm with black joints on a black base, '
                               'standing on the lowest rack level'),
        ],
    },
}
