// Pruebas de extremo a extremo de la app Electron real (proceso principal + SIAF + puente).
// En Linux como root (contenedores de CI) se añade --no-sandbox SOLO para el proceso de prueba.
const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: 'tests/e2e',
  timeout: 300000,
  expect: { timeout: 20000 },
  workers: 1,
  fullyParallel: false,
  reporter: [['list'], ['json', { outputFile: 'evidencias/resultados-e2e.json' }]],
  outputDir: 'test-results',
});
