'use strict';
// P10: migración REAL desde la versión HTML original (abierta en Chromium como la usa hoy el usuario)
// P08b: recuperación tras un cierre forzado (kill -9) del proceso.
const { test, chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { abrir, primerIngreso, menu, listarRespaldos, esperarArchivo, captura, cerrar, externas, datos, expect, RAIZ, cerrarNovedades } = require('./fixture');

const DIR = datos('p03');
const NAV = datos('p03-navegador');
const CHROMIUM = fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

test('P10 migración desde SIAF HTML en el navegador → SIAF para macOS, con verificación de registros, identificadores y fotos', async () => {
  fs.rmSync(NAV, { recursive: true, force: true }); fs.mkdirSync(NAV, { recursive: true });
  // ---------- 1. versión HTML original en Chromium (archivo sin modificar) ----------
  const nav = await chromium.launchPersistentContext(path.join(NAV, 'perfil'), { executablePath: CHROMIUM, acceptDownloads: true, args: ['--no-sandbox'] });
  const pag = nav.pages()[0] || await nav.newPage();
  await pag.goto(pathToFileURL(path.join(RAIZ, 'source', 'SIAF_v9_3_3.html')).toString());
  await pag.waitForSelector('.login', { timeout: 90000 });
  for (const d of '1234') await pag.keyboard.press(d); await pag.keyboard.press('Enter');
  await pag.waitForSelector('#cp1'); await pag.waitForFunction(() => document.activeElement && document.activeElement.id === 'cp1'); await pag.fill('#cp1', '2580'); await pag.fill('#cp2', '2580'); await pag.click('#lg-cp button[type=submit]');
  await pag.waitForSelector('#app .topbar', { timeout: 60000 });
  await cerrarNovedades(pag);
  // datos propios en el navegador: un animal con fotografía
  await pag.evaluate(() => App.ir('ganado'));
  await pag.click('[data-nuevo]');
  await pag.fill('#f-arete', 'NAV-777'); await pag.selectOption('#f-sexo', 'M'); await pag.fill('#f-nombre', 'Desde el navegador');
  await pag.setInputFiles('#f-fotos', path.join(RAIZ, 'build', 'icon.png'));
  await pag.click('.capa-oscura [data-guardar]');
  await expect(pag.locator('#toasts')).toContainText('Animal registrado', { timeout: 30000 }); // SIAF lo muestra tras guardar también la foto
  await pag.waitForFunction(() => DB.todos('animales').some(a => a.arete === 'NAV-777'));
  const origen = await pag.evaluate(async () => {
    const ids = {}; for (const c of DB.COLECCIONES) if (c !== 'fotos') ids[c] = DB.todos(c).map(o => o.id).sort();
    const fotos = (await DB.todasFotos()).map(f => f.id).sort();
    return { ids, fotos, animal: DB.todos('animales').find(a => a.arete === 'NAV-777') };
  });
  // exportación oficial de SIAF (Configuración → Respaldo → ZIP): misma función que usa el botón
  const [descarga] = await Promise.all([pag.waitForEvent('download'), pag.evaluate(() => Resp8.descargarZip({ fotos: true }))]);
  const zip = path.join(NAV, descarga.suggestedFilename());
  await descarga.saveAs(zip);
  await pag.screenshot({ path: path.join(RAIZ, 'evidencias', 'capturas', '07-siaf-html-original-en-navegador.png') });
  await nav.close();
  expect(fs.statSync(zip).size).toBeGreaterThan(1000);

  // ---------- 2. app de escritorio nueva: Archivo → Migrar datos desde SIAF (navegador)… ----------
  const { app, win } = await abrir(DIR, { limpiar: true });
  await primerIngreso(win, '1470');
  await app.evaluate(({ dialog }, zip) => {
    global.__dlg = [];
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [zip] });
    dialog.showMessageBox = async (_w, o) => { global.__dlg.push((o || _w).detail || ''); return { response: 0 }; }; // «Continuar en SIAF…»
  }, zip);
  await menu(app, 'Archivo', 'Migrar datos desde SIAF (navegador)…');
  await expect.poll(() => app.evaluate(() => global.__dlg.join('\n'))).toContain('Huellas SHA-256 del manifiesto ZIP verificadas');
  const informe = await app.evaluate(() => global.__dlg[0]);
  fs.writeFileSync(path.join(RAIZ, 'evidencias', 'migracion-analisis-previo.txt'), informe);
  await expect(win.locator('.capa-oscura .modal-cab h3').last()).toContainText('Vista previa de la restauración', { timeout: 30000 });
  await captura(win, '08-migracion-vista-previa-siaf');
  await win.locator('.capa-oscura [data-si]').last().click();
  // tras recargar: el administrador migrado conserva SU PIN del navegador (2580)
  await win.waitForSelector('.login, #app .topbar', { timeout: 60000 });
  if (await win.locator('.login').count()) { await win.selectOption('#lg-u', 'usr-admin'); for (const d of '2580') await win.keyboard.press(d); await win.keyboard.press('Enter'); await win.waitForSelector('#app .topbar'); }
  await expect(win.locator('.capa-oscura .modal-cab h3', { hasText: 'Migración verificada' })).toBeVisible({ timeout: 30000 });
  await captura(win, '09-migracion-verificada');
  // identificadores idénticos, relaciones y fotos conservadas
  const destino = await win.evaluate(async () => {
    const ids = {}; for (const c of DB.COLECCIONES) if (c !== 'fotos') ids[c] = DB.todos(c).map(o => o.id).sort();
    return { ids, fotos: (await DB.todasFotos()).map(f => f.id).sort(), animal: DB.todos('animales').find(a => a.arete === 'NAV-777'), fotoAnimal: (await DB.fotosDe('animales', DB.todos('animales').find(a => a.arete === 'NAV-777').id)).length };
  });
  for (const c of Object.keys(origen.ids)) if (c !== 'auditoria' && c !== 'config') expect(destino.ids[c], c).toEqual(origen.ids[c]);
  expect(destino.fotos).toEqual(origen.fotos);
  expect(destino.animal.id).toBe(origen.animal.id);
  expect(destino.animal.creado).toBe(origen.animal.creado); // trazabilidad: fecha de creación original
  expect(destino.fotoAnimal).toBe(1);
  const migs = fs.readdirSync(path.join(DIR, 'Migraciones')).filter(f => f.startsWith('migracion_'));
  const rep = JSON.parse(fs.readFileSync(path.join(DIR, 'Migraciones', migs[0]), 'utf8'));
  expect(rep.estado).toBe('verificada');
  expect(rep.diferencias).toEqual([]);
  fs.copyFileSync(path.join(DIR, 'Migraciones', migs[0]), path.join(RAIZ, 'evidencias', 'migracion-informe.json'));
  expect(listarRespaldos(DIR).some(f => f.startsWith('SIAF_punto_'))).toBe(true); // datos previos guardados en disco
  expect(fs.existsSync(zip)).toBe(true); // el archivo de origen no se toca
  expect(await externas(app)).toEqual([]);
  await cerrar(app);
});

test('P08b recuperación tras cierre forzado: datos confirmados intactos y punto de recuperación automático', async () => {
  let { app, win } = await abrir(DIR);
  await win.waitForSelector('#app .topbar');
  await win.evaluate(() => DB.put('tareas', { titulo: 'Antes del corte de luz', fecha: U.hoyISO(), vence: U.hoyISO(), estado: 'Pendiente', prioridad: 'Alta' }));
  const puntosAntes = listarRespaldos(DIR).filter(f => f.startsWith('SIAF_punto_')).length;
  app.process().kill('SIGKILL'); // equivalente a un apagón o un cierre forzado
  await new Promise(r => setTimeout(r, 1500));
  ({ app, win } = await abrir(DIR));
  await win.waitForSelector('#app .topbar');
  await expect(win.locator('#toasts')).toContainText('no se cerró correctamente', { timeout: 60000 });
  expect(await win.evaluate(() => DB.todos('tareas').some(t => t.titulo === 'Antes del corte de luz'))).toBe(true);
  await esperarArchivo(() => listarRespaldos(DIR).filter(f => f.startsWith('SIAF_punto_')).length > puntosAntes);
  const idx = JSON.parse(fs.readFileSync(path.join(DIR, 'Respaldos', 'indice.json'), 'utf8'));
  expect(idx.respaldos[0].motivo).toBe('cierre-inesperado');
  await captura(win, '10-recuperacion-tras-cierre-forzado');
  await cerrar(app);
});
