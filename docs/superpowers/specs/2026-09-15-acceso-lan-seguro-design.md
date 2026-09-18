# Acceso LAN seguro al Espejo Mágico

## Objetivo

Permitir que una PC, laptop, celular Android o tablet Android conectados a la
misma red local ejecuten la experiencia completa, incluida su propia cámara y
la comunicación con MAITE. El sistema seguirá funcionando sin Internet durante
el evento.

El navegador necesita un origen HTTPS confiable para entregar la cámara cuando
la página se abre mediante una IP o un nombre de red. La excepción de
`localhost` solo cubre la máquina que ejecuta el navegador. Por eso escuchar en
`0.0.0.0` resuelve el alcance de red, pero no alcanza para los clientes remotos.

## Topología

```text
PC, laptop o Android
  https://espejo.local:8080
              |
              | HTTPS: archivos, MediaPipe y eventos MAITE
              v
Servidor del Espejo
  - archivos estáticos
  - catálogo generado
  - proxy limitado /maite/api/carrera y /maite/api/humo
              |
              | HTTP o HTTPS según MAITE_URL
              v
MAITE
```

El navegador nunca conocerá la ubicación real de MAITE. `espejo/maite.js`
enviará los eventos al mismo origen desde el que cargó la experiencia. El
servidor leerá `MAITE_URL` y reenviará solo las dos rutas permitidas. Este proxy
evita CORS, elimina el contenido mixto de una página HTTPS que llama a un MAITE
HTTP y mantiene la variable de entorno del lado del servidor.

## Configuración

El servidor aceptará estas variables:

| Variable | Requerida | Uso |
|---|---:|---|
| `HOST` | No | Interfaz de escucha. Valor predeterminado: `0.0.0.0`. |
| `PUERTO` | No | Puerto del espejo. Valor predeterminado: `8080`. |
| `HTTPS_CERT` | Para cámara remota | Ruta al certificado público PEM. |
| `HTTPS_KEY` | Para cámara remota | Ruta a la clave privada PEM. |
| `MAITE_URL` | Para controlar MAITE | Origen de MAITE, por ejemplo `http://192.168.1.20:3000`. |

`HTTPS_CERT` y `HTTPS_KEY` forman una pareja: si falta una, el servidor se
negará a arrancar con un mensaje concreto. Sin ambas, conservará el modo HTTP
para desarrollo mediante `localhost`. Si falta `MAITE_URL`, el espejo seguirá
funcionando y el proxy responderá `503`; el panel de operación mostrará el fallo
igual que hoy cuando MAITE no responde.

El servidor imprimirá las URLs de las interfaces IPv4 no internas. En modo
HTTPS también imprimirá un recordatorio de que cada dispositivo debe confiar en
la autoridad certificadora local.

## Certificados locales

La documentación usará `mkcert` para crear una autoridad local y un certificado
con los nombres e IP que usarán los dispositivos. Los archivos quedarán en
`.certificados/`, directorio ignorado por Git. La clave privada permanecerá en
la PC que sirve el espejo.

Ejemplo orientativo:

```bash
mkcert -install
mkcert -cert-file .certificados/espejo.pem \
  -key-file .certificados/espejo-key.pem \
  localhost 127.0.0.1 192.168.1.20
```

Cada PC, laptop, celular y tablet Android debe confiar una vez en la autoridad
raíz creada por `mkcert`. Los dispositivos accederán usando uno de los nombres o
IP incluidos en el certificado. Un nombre local solo sirve si el router o un
DNS de la red ya lo resuelve. Si cambia la IP, el equipo deberá regenerar el
certificado.

La guía explicará cómo instalar la autoridad en Windows, Linux y Android. No se
automatizará la instalación en dispositivos remotos: requiere una decisión
visible del operador y credenciales del propio dispositivo.

## Servidor HTTPS y acceso LAN

`servidor/servidor.js` conservará el manejador actual de archivos. Una fábrica
elegirá `node:http.createServer` o `node:https.createServer` según la presencia
de los dos archivos TLS. `escuchar` recibirá puerto y host para que la interfaz
de red quede explícita y comprobable.

La raíz `/` seguirá abriendo `espejo/espejo.html`. Las herramientas quedarán
disponibles mediante el mismo origen. El modo HTTPS no modificará el contenido
ni introducirá un bundler o una dependencia de producción.

## Proxy limitado hacia MAITE

El servidor atenderá únicamente:

- `POST /maite/api/carrera`
- `POST /maite/api/humo`

Para ambas rutas reenviará método, `Content-Type` y cuerpo a `MAITE_URL`. No
aceptará destinos enviados por el cliente ni otras rutas. Aplicará un límite de
tamaño pequeño al cuerpo y un tiempo máximo menor que el límite de 1,5 segundos
del puente del navegador.

El proxy devolverá el estado de MAITE cuando reciba una respuesta. Ante URL
ausente, URL inválida, timeout o conexión rechazada responderá con `503` y
mantendrá vivo el servidor. El espejo conservará su regla actual: una falla de
MAITE no detiene la experiencia.

## Navegador y privacidad

`espejo/maite.js` usará una base relativa al mismo origen. La única información
que sale del dispositivo cliente es el identificador de carrera o la orden de
volver al humo. El video de la cámara y los resultados de MediaPipe permanecen
en la memoria del navegador del dispositivo que ejecuta la experiencia.

El modo de pantalla completa del dispositivo servidor seguirá abriendo
`localhost`. Los clientes remotos abrirán la URL HTTPS anunciada. Android pedirá
permiso de cámara la primera vez; el código no intentará saltar ese permiso.

## Pruebas

Las pruebas automatizadas cubrirán:

- selección de HTTP o HTTPS según la configuración;
- rechazo de una configuración TLS incompleta;
- escucha explícita en el host solicitado;
- publicación de URLs LAN sin incluir interfaces internas;
- reenvío de los dos `POST` permitidos a `MAITE_URL`;
- rechazo de métodos y rutas ajenos al proxy;
- `503` ante MAITE ausente, inválido o fuera de plazo;
- uso de una ruta relativa por `espejo/maite.js`;
- conservación del servidor estático, rangos de video y catálogo;
- suite completa y `npm run listo`.

La prueba manual se hará desde una PC o Android conectado a la misma red:
abrir la URL HTTPS, aceptar la cámara, entrar en modo demo o completar una
elección real y comprobar en el panel que MAITE recibió el evento.

## Fuera de alcance

- Exponer el servidor a Internet.
- Instalar certificados sin intervención en otros dispositivos.
- Incorporar autenticación de usuarios.
- Transmitir video entre dispositivos.
- Cambiar la interfaz visual, Canvas 2D o MediaPipe.
- Garantizar rendimiento equivalente en todos los teléfonos Android.
