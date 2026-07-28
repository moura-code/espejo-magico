import { defineConfig } from 'vitest/config';

// El semáforo del proyecto: ¿está el contenido listo para montar el stand?
// Corre con `npm run listo`. Va a estar en rojo hasta que lleguen los PNG y
// los videos de las referentes, y eso es lo esperado.

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/listo/**/*.test.js'],
  },
});
