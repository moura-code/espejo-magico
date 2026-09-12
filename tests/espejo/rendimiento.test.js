import { describe, expect, it } from 'vitest';
import { crearGobernadorDeRendimiento } from '../../espejo/rendimiento.js';

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
});
