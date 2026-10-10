// Utilidades comunes de prueba (Playwright + Chromium local). Uso: NODE_PATH=$(npm root -g) node <script>
const { chromium } = require('playwright');
const path = require('path');
const RAIZ = path.resolve(__dirname, '..');
const url = f => 'file://' + path.join(RAIZ, f);

async function abrir(perfil, archivo, { movil = false, sinRed = true } = {}) {
  const ctx = await chromium.launchPersistentContext(perfil, {
    headless: true, acceptDownloads: true,
    viewport: movil ? { width: 390, height: 844 } : { width: 1366, height: 860 },
    deviceScaleFactor: 1, isMobile: movil, hasTouch: movil,
  });
  const externas = [];
  if (sinRed) await ctx.route(/^https?:/, r => { externas.push(r.request().url()); r.abort(); });
  const page = ctx.pages()[0] || await ctx.newPage();
  const errores = [];
  page.on('pageerror', e => errores.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errores.push('console: ' + m.text()); });
  page.on('dialog', d => d.dismiss());
  await page.goto(url(archivo));
  return { ctx, page, errores, externas };
}

async function login(page, pin = '1234', usuario = null) {
  await page.waitForFunction(() => document.querySelector('.login') || document.querySelector('#app .topbar'), null, { timeout: 120000 });
  if (await page.$('.login')) {
    if (usuario) await page.selectOption('#lg-u', usuario);
    for (const d of pin) await page.click(`.teclado [data-d="${d}"]`);
    await page.click('.teclado [data-ok]');
  }
  await page.waitForSelector('#app .topbar', { timeout: 60000 });
  await page.waitForTimeout(300);
}

async function cerrarModales(page) {
  for (let i = 0; i < 6; i++) { const c = await page.$('.capa-oscura .cerrar'); if (!c) break; await c.click().catch(() => {}); await page.waitForTimeout(80); }
}

// Instantánea de resultados de cálculo sobre los datos actuales (para regresión v5 ↔ v6)
const instantanea = () => {
  const r6 = x => x == null || !isFinite(x) ? x : Math.round(x * 1e6) / 1e6;
  const out = {};
  const cd = D.costosDetalle();
  out.costos = { n: cd.length, monto: r6(cd.reduce((s, c) => s + (c.monto || 0), 0)), ingreso: r6(cd.reduce((s, c) => s + (c.ingreso || 0), 0)), porOrigen: {} };
  for (const c of cd) { const o = out.costos.porOrigen[c.origen] = out.costos.porOrigen[c.origen] || { n: 0, m: 0 }; o.n++; o.m = r6(o.m + (c.monto || 0) + (c.ingreso || 0)); }
  out.aforos = {}; for (const a of DB.todos('aforos')) { const x = Aforo.calcular(a); out.aforos[a.id] = [r6(x.msHa), r6(x.msAprov), r6(x.uggSoporta), r6(x.tasa), r6(x.cargaUGGha)]; }
  out.stock = {}; for (const i of DB.todos('insumos')) out.stock[i.id] = D.stock(i.id);
  out.fert = {}; for (const f of DB.todos('fertilizaciones')) { const p = Fert.producto(f.productoId); out.fert[f.id] = p ? r6(Fert.aporte(p, f.cantidad, f.unidad).N) : null; }
  out.potreros = {}; for (const l of DB.todos('lotes')) { const ip = D.infoPotrero(l); out.potreros[l.id] = [ip.n, r6(ip.carga), r6(ip.uaHa), ip.diasOcup, ip.diasDesc]; }
  out.animales = {}; for (const a of DB.todos('animales')) out.animales[a.id] = [D.categoria(a), r6(D.gananciaDiaria(a))];
  out.dash = {}; for (const P of [30, 90, 365]) { const k = Dash.calcular(P).kpi; out.dash[P] = JSON.parse(JSON.stringify(k, (kk, v) => typeof v === 'number' ? r6(v) : v)); }
  out.indicadores = Rapido.indicadores().map(x => x[1]);
  out.lluvia = Lluvia.resumen('2000-01-01', U.hoyISO());
  const al = D.alertas(); out.alertas = {}; for (const a of al) out.alertas[a.tipo] = (out.alertas[a.tipo] || 0) + 1;
  out.conteos = {}; for (const c of DB.COLECCIONES) if (c !== 'fotos') out.conteos[c] = DB.todos(c).length;
  return out;
};

module.exports = { abrir, login, cerrarModales, instantanea, RAIZ, url };
