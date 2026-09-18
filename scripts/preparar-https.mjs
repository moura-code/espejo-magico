import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export function obtenerNombresCertificado(interfaces = networkInterfaces()) {
  const direccionesLan = Object.values(interfaces)
    .flatMap((direcciones) => direcciones ?? [])
    .filter(
      ({ address, family, internal }) =>
        !internal && (family === 'IPv4' || family === 4) && address,
    )
    .map(({ address }) => address);

  return ['localhost', '127.0.0.1', ...new Set(direccionesLan)];
}

export function crearArgumentosMkcert({ certificado, clave, nombres }) {
  return ['-cert-file', certificado, '-key-file', clave, ...nombres];
}

export function mensajeInstalacionMkcert(plataforma = process.platform) {
  if (plataforma === 'win32') {
    return 'Instalá mkcert con: choco install mkcert (o: scoop install mkcert)';
  }
  return 'Instalá mkcert siguiendo https://github.com/FiloSottile/mkcert#installation';
}

function ejecutarMkcert(argumentos) {
  const resultado = spawnSync('mkcert', argumentos, { stdio: 'inherit' });
  if (resultado.error) throw resultado.error;
  if (resultado.status !== 0) {
    throw new Error(`mkcert terminó con código ${resultado.status}`);
  }
}

export async function prepararHttps({
  raiz = process.cwd(),
  interfaces = networkInterfaces(),
  plataforma = process.platform,
  ejecutar = ejecutarMkcert,
} = {}) {
  const directorio = resolve(raiz, '.certificados');
  const certificado = resolve(directorio, 'espejo.pem');
  const clave = resolve(directorio, 'espejo-key.pem');
  const nombres = obtenerNombresCertificado(interfaces);
  await mkdir(directorio, { recursive: true });

  try {
    await ejecutar(['-install']);
  } catch (error) {
    if (error?.code === 'ENOENT') {
      throw new Error(`No se encontró mkcert. ${mensajeInstalacionMkcert(plataforma)}`, {
        cause: error,
      });
    }
    throw new Error(
      'No se pudo instalar la autoridad local. Ejecutá mkcert -install en una terminal ' +
        'interactiva con permisos y volvé a intentar.',
      { cause: error },
    );
  }

  try {
    await ejecutar(crearArgumentosMkcert({ certificado, clave, nombres }));
  } catch (error) {
    throw new Error(`No se pudo generar el certificado: ${error.message}`, { cause: error });
  }

  return { certificado, clave, nombres };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const resultado = await prepararHttps();
    console.log('HTTPS preparado para:');
    for (const nombre of resultado.nombres) console.log(`  ${nombre}`);
    console.log(`Certificado: ${resultado.certificado}`);
    console.log(`Clave privada: ${resultado.clave}`);
  } catch (error) {
    console.error(`No se pudo preparar HTTPS: ${error.message}`);
    process.exitCode = 1;
  }
}
