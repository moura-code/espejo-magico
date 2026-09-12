import { describe, expect, it } from 'vitest';
import { crearGobernadorDeRendimiento } from '../../espejo/rendimiento.js';
import * as moduloDeRendimiento from '../../espejo/rendimiento.js';

const perfiles = [
  { nombre: 'completo', manos: 34, pose: 20 },
  { nombre: 'equilibrado', manos: 24, pose: 16 },
  { nombre: 'seguro', manos: 16, pose: 12 },
];

const crear = () =>
  crearGobernadorDeRendimiento({
    perfiles,
    fpsParaBajar: 27,
    fpsParaSubir: 35,
    msParaBajar: 5000,
    msParaSubir: 10000,
    ventanaMs: 2000,
  });

describe('crearGobernadorDeRendimiento', () => {
  it('baja un perfil despues de rendimiento bajo sostenido', () => {
    const gobernador = crear();

    gobernador.registrar({ ahora: 0, fps: 24 });
    gobernador.registrar({ ahora: 4999, fps: 24 });
    expect(gobernador.perfil().nombre).toBe('completo');

    gobernador.registrar({ ahora: 5000, fps: 24 });
    expect(gobernador.perfil().nombre).toBe('equilibrado');
  });

  it('recupera calidad solo con rendimiento alto sostenido', () => {
    const gobernador = crear();
    gobernador.registrar({ ahora: 0, fps: 20 });
    gobernador.registrar({ ahora: 5000, fps: 20 });

    gobernador.registrar({ ahora: 6000, fps: 40 });
    gobernador.registrar({ ahora: 15999, fps: 40 });
    expect(gobernador.perfil().nombre).toBe('equilibrado');

    gobernador.registrar({ ahora: 16000, fps: 40 });
    expect(gobernador.perfil().nombre).toBe('completo');
  });

  it('no baja calidad mientras una eleccion esta en curso', () => {
    const gobernador = crear();

    gobernador.registrar({ ahora: 0, fps: 20, protegiendoEleccion: true });
    gobernador.registrar({ ahora: 8000, fps: 20, protegiendoEleccion: true });

    expect(gobernador.perfil().nombre).toBe('completo');
  });

  it('usa el promedio y no deja que un pico aislado oculte la lentitud sostenida', () => {
    const gobernador = crear();

    for (let ahora = 0; ahora <= 7000; ahora += 250) {
      gobernador.registrar({ ahora, fps: ahora % 1000 === 0 ? 40 : 24 });
    }

    expect(gobernador.perfil().nombre).toBe('equilibrado');
  });

  it('ignora los cuadros limitados por una pestaña oculta', () => {
    const gobernador = crear();

    for (let ahora = 0; ahora <= 7000; ahora += 1000) {
      gobernador.registrar({ ahora, fps: 1, visible: false });
    }

    expect(gobernador.perfil().nombre).toBe('completo');
  });
});

describe('fpsDeManos', () => {
  it('usa la frecuencia completa durante un sostenido aunque el perfil sea seguro', () => {
    expect(
      moduloDeRendimiento.fpsDeManos?.({
        perfil: perfiles[2],
        perfilCompleto: perfiles[0],
        protegiendoEleccion: true,
        conFondo: false,
      }),
    ).toBe(34);
  });

  it('respeta el perfil adaptativo fuera del sostenido', () => {
    expect(
      moduloDeRendimiento.fpsDeManos?.({
        perfil: perfiles[2],
        perfilCompleto: perfiles[0],
        protegiendoEleccion: false,
        conFondo: false,
      }),
    ).toBe(16);
  });
});
