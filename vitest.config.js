import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // tests/listo/ no corre acá: son las verificaciones de "¿está listo el
    // stand?", que dependen de contenido que todavía no llegó. Van por
    // `npm run listo`, para que `npm test` se mantenga verde durante el
    // desarrollo. Una suite permanentemente roja deja de mirarse.
    exclude: [...configDefaults.exclude, 'tests/listo/**'],
  },
});
