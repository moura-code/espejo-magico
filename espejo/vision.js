// Carga de MediaPipe, una sola vez para todos los detectores.
//
// El paquete de WASM pesa mas de 11 MB. Si los detectores de rostro, manos y
// pose lo cargaran cada uno por su cuenta, se pagaria tres veces al arrancar.
// La memorizacion no es reentrante: los detectores se crean uno despues del
// otro en main.js, nunca en paralelo.

let modulo = null;
let recursos = null;

export async function cargarVision(base) {
  modulo ??= await import(`${base}/vision_bundle.mjs`);
  recursos ??= await modulo.FilesetResolver.forVisionTasks(`${base}/wasm`);
  return { modulo, recursos };
}

// Solo para las pruebas: olvida lo cargado.
export function olvidarVision() {
  modulo = null;
  recursos = null;
}
