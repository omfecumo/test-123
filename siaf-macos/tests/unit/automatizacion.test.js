'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { tmp } = require('./ayudas');
const S = require('../../src/main/automation/schema');
const { Ejecucion } = require('../../src/main/automation/runner');
const { Almacen } = require('../../src/main/automation/store');

const sec = (pasos, objetivo = { tipo: 'siaf' }, opciones = { esperaPasoMs: 0, timeoutMs: 1000, reintentos: 2 }) => S.limpiarSecuencia({ nombre: 'Prueba', objetivo, opciones, pasos });

function driverSimulado(comportamiento = {}) {
  const llamadas = [];
  return {
    llamadas,
    async preparar() { llamadas.push('preparar'); },
    async verificarContexto(p) { if (comportamiento.contexto) comportamiento.contexto(p); },
    async inspeccionar(p) { return { encontrado: true, peligro: !!(comportamiento.peligro && comportamiento.peligro(p)) }; },
    async ejecutar(p) { llamadas.push(p.tipo + ':' + (p.selector?.texto || p.ruta || '')); if (comportamiento.ejecutar) return comportamiento.ejecutar(p); },
    async comprobar(c) { return comportamiento.comprobar ? comportamiento.comprobar(c) : true; },
    async finalizar() { llamadas.push('fin'); },
  };
}
const ui = (respuesta = true, manual = true) => ({ confirmaciones: [], async confirmar(t) { this.confirmaciones.push(t); return respuesta; }, async manual() { return manual; } });

test('Esquema: elimina campos desconocidos y acota tipos', () => {
  const s = sec([{ tipo: 'clic', selector: { css: 'button', texto: 'Guardar', extra: 'x' }, malicioso: '<script>', destructivo: 'sí' }]);
  assert.deepStrictEqual(Object.keys(s.pasos[0].selector).sort(), ['aria', 'css', 'enModal', 'etiqueta', 'texto']);
  assert.strictEqual(s.pasos[0].malicioso, undefined);
  assert.strictEqual(s.pasos[0].destructivo, false); // solo true booleano
  assert.throws(() => sec([{ tipo: 'ejecutarComando', cmd: 'rm -rf /' }]), /desconocido/);
  assert.throws(() => sec([{ tipo: 'pulsar', elemento: {} }]), /no es válido para este objetivo/);
  assert.throws(() => S.limpiarSecuencia({ nombre: 'x', objetivo: { tipo: 'app', bundleId: '../../evil' }, pasos: [] }), /bundle/);
  assert.throws(() => S.limpiarSecuencia({ nombre: '', pasos: [] }), /nombre/);
});

test('Esquema: AppleScript lleva huella SHA-256 calculada (no la del archivo) y siempre es destructivo', () => {
  const s = sec([{ tipo: 'applescript', fuente: 'beep', hash: '0'.repeat(64) }], { tipo: 'app', bundleId: 'com.apple.TextEdit' });
  assert.strictEqual(s.pasos[0].hash, S.sha256('beep'));
  assert.strictEqual(S.esDestructivo(s.pasos[0]), true);
  assert.strictEqual(S.limpiarPaso({ tipo: 'teclas', combinacion: 'cmd+s; rm -rf /' }, 'app').combinacion, '');
});

test('Esquema: detecta pasos destructivos por su texto', () => {
  assert.strictEqual(S.esDestructivo(S.limpiarPaso({ tipo: 'clic', selector: { texto: '🗑️ Eliminar animal' } }, 'siaf')), true);
  assert.strictEqual(S.esDestructivo(S.limpiarPaso({ tipo: 'pulsar', elemento: { titulo: 'Pay now' } }, 'app')), true);
  assert.strictEqual(S.esDestructivo(S.limpiarPaso({ tipo: 'clic', selector: { texto: 'Guardar' } }, 'siaf')), false);
});

test('Motor: ejecuta todos los pasos en orden y registra el resultado', async () => {
  const d = driverSimulado();
  const e = new Ejecucion(sec([{ tipo: 'navegar', ruta: 'ganado' }, { tipo: 'clic', selector: { texto: 'Nuevo' } }, { tipo: 'punto', etiqueta: 'P1' }, { tipo: 'esperar', ms: 10 }]), d, ui());
  const r = await e.ejecutar();
  assert.strictEqual(r.estado, 'completada');
  assert.strictEqual(r.pasosOk, 4);
  assert.deepStrictEqual(d.llamadas, ['preparar', 'navegar:ganado', 'clic:Nuevo', 'fin']);
  assert.strictEqual(r.ultimoPunto.etiqueta, 'P1');
});

test('Motor: pide confirmación antes de un paso destructivo y se detiene si no se confirma', async () => {
  const d = driverSimulado(); const u = ui(false);
  const r = await new Ejecucion(sec([{ tipo: 'clic', selector: { texto: 'Eliminar todo' } }, { tipo: 'clic', selector: { texto: 'Después' } }]), d, u).ejecutar();
  assert.strictEqual(r.estado, 'detenida');
  assert.strictEqual(u.confirmaciones.length, 1);
  assert.ok(!d.llamadas.some(x => x.startsWith('clic')), 'no debe ejecutar el clic destructivo ni los siguientes');
});

test('Motor: también confirma cuando el elemento real es peligroso aunque la grabación no lo marcó', async () => {
  const d = driverSimulado({ peligro: () => true }); const u = ui(true);
  const r = await new Ejecucion(sec([{ tipo: 'clic', selector: { texto: 'Aceptar' } }]), d, u).ejecutar();
  assert.strictEqual(r.estado, 'completada'); assert.strictEqual(u.confirmaciones.length, 1);
});

test('Motor: reintenta solo pasos idempotentes o marcados como seguros', async () => {
  let n = 0;
  const falla2 = driverSimulado({ ejecutar: p => { if (p.tipo === 'esperarElemento' && n++ < 2) throw new Error('aún no'); } });
  assert.strictEqual((await new Ejecucion(sec([{ tipo: 'esperarElemento', selector: { css: '#x' } }]), falla2, ui()).ejecutar()).estado, 'completada');
  let clics = 0;
  const fallaClic = driverSimulado({ ejecutar: p => { if (p.tipo === 'clic') { clics++; throw new Error('La interfaz cambió: no se encontró «Guardar».'); } } });
  const r = await new Ejecucion(sec([{ tipo: 'clic', selector: { texto: 'Guardar' } }]), fallaClic, ui()).ejecutar();
  assert.strictEqual(r.estado, 'error'); assert.strictEqual(clics, 1, 'un clic no se reintenta');
  assert.match(r.error, /La interfaz cambió/);
  clics = 0;
  await new Ejecucion(sec([{ tipo: 'clic', selector: { texto: 'Guardar' }, reintentoSeguro: true }]), fallaClic, ui()).ejecutar();
  assert.strictEqual(clics, 3);
});

test('Motor: detener interrumpe de inmediato una pausa larga', async () => {
  const e = new Ejecucion(sec([{ tipo: 'esperar', ms: 600000 }, { tipo: 'clic', selector: { texto: 'X' } }]), driverSimulado(), ui());
  const p = e.ejecutar(); const t0 = Date.now();
  setTimeout(() => e.detener('prueba'), 100);
  const r = await p;
  assert.strictEqual(r.estado, 'detenida'); assert.ok(Date.now() - t0 < 2000);
});

test('Motor: pausa y continuación', async () => {
  const d = driverSimulado();
  const e = new Ejecucion(sec([{ tipo: 'esperar', ms: 200 }, { tipo: 'navegar', ruta: 'lotes' }]), d, ui());
  const p = e.ejecutar();
  setTimeout(() => e.pausar(), 50);
  await new Promise(r => setTimeout(r, 500));
  assert.strictEqual(e.estado, 'pausada'); assert.ok(!d.llamadas.includes('navegar:lotes'));
  e.continuar();
  assert.strictEqual((await p).estado, 'completada'); assert.ok(d.llamadas.includes('navegar:lotes'));
});

test('Motor: modo paso a paso espera «Siguiente» en cada paso', async () => {
  const d = driverSimulado();
  const e = new Ejecucion(sec([{ tipo: 'navegar', ruta: 'a' }, { tipo: 'navegar', ruta: 'b' }]), d, ui(), { modo: 'pasoAPaso' });
  let esperas = 0; e.on('esperandoAvance', () => { esperas++; setTimeout(() => e.avanzar(), 20); });
  assert.strictEqual((await e.ejecutar()).estado, 'completada');
  assert.strictEqual(esperas, 2);
});

test('Motor: pasos manuales (campo protegido) esperan al usuario y nunca se automatizan', async () => {
  const d = driverSimulado();
  const r = await new Ejecucion(sec([{ tipo: 'campoSensible', nota: 'Escriba su PIN' }, { tipo: 'navegar', ruta: 'x' }]), d, ui(true, false)).ejecutar();
  assert.strictEqual(r.estado, 'detenida'); assert.ok(!d.llamadas.some(x => x.startsWith('campoSensible')));
});

test('Motor: condición con «saltar» y con «detener»; reanudación desde punto', async () => {
  const d = driverSimulado({ comprobar: () => false });
  const r = await new Ejecucion(sec([{ tipo: 'condicion', comprobacion: { tipo: 'elementoExiste', selector: { css: '#no' } }, siFalla: 'saltar', saltar: 1 }, { tipo: 'navegar', ruta: 'saltado' }, { tipo: 'navegar', ruta: 'final' }]), d, ui()).ejecutar();
  assert.strictEqual(r.estado, 'completada'); assert.ok(!d.llamadas.includes('navegar:saltado')); assert.ok(d.llamadas.includes('navegar:final'));
  const r2 = await new Ejecucion(sec([{ tipo: 'condicion', comprobacion: { tipo: 'elementoExiste' }, siFalla: 'detener' }, { tipo: 'navegar', ruta: 'no' }]), driverSimulado({ comprobar: () => false }), ui()).ejecutar();
  assert.strictEqual(r2.estado, 'detenida');
  const d3 = driverSimulado();
  await new Ejecucion(sec([{ tipo: 'navegar', ruta: 'a' }, { tipo: 'punto', etiqueta: 'P' }, { tipo: 'navegar', ruta: 'b' }]), d3, ui(), { desde: 1 }).ejecutar();
  assert.deepStrictEqual(d3.llamadas.filter(x => x.startsWith('navegar')), ['navegar:b']);
});

test('Motor: si la interfaz cambia (contexto inesperado) la secuencia se detiene con mensaje claro', async () => {
  const d = driverSimulado({ contexto: () => { throw new Error('La interfaz cambió: la aplicación al frente es «Safari», no la autorizada.'); } });
  const r = await new Ejecucion(sec([{ tipo: 'clic', selector: { texto: 'A' } }]), d, ui()).ejecutar();
  assert.strictEqual(r.estado, 'error'); assert.match(r.error, /Safari/);
});

test('Almacén: guardar, listar, duplicar, eliminar (a papelera), historial, apps y aprobaciones', () => {
  const dir = tmp(); const a = new Almacen(dir);
  const s = a.guardar({ nombre: 'Uno', carpeta: 'Ganado', pasos: [{ tipo: 'navegar', ruta: 'ganado' }] });
  assert.strictEqual(a.listar().length, 1);
  const c = a.duplicar(s.id); assert.notStrictEqual(c.id, s.id); assert.match(c.nombre, /copia/);
  a.eliminar(s.id); assert.strictEqual(a.listar().length, 1);
  assert.strictEqual(fs.readdirSync(path.join(dir, 'eliminadas')).length, 1);
  a.anotarEjecucion({ id: 'e1', secuenciaId: c.id, nombre: 'x', estado: 'completada', pasosOk: 1, total: 1 });
  assert.strictEqual(a.historial()[0].estado, 'completada');
  assert.throws(() => a.autorizarApp('mal id/../', 'x'));
  a.autorizarApp('com.apple.TextEdit', 'TextEdit'); assert.ok(a.appAutorizada('com.apple.TextEdit'));
  a.revocarApp('com.apple.TextEdit'); assert.ok(!a.appAutorizada('com.apple.TextEdit'));
  const h = S.sha256('beep'); assert.ok(!a.aprobado(h)); a.aprobar(h); assert.ok(a.aprobado(h));
  assert.throws(() => a.obtener('../../etc'), /no válido/);
});

test('Almacén: importar una secuencia genera id nuevo y no hereda aprobaciones ajenas', () => {
  const a = new Almacen(tmp());
  const s = a.importarTexto(JSON.stringify({ formato: 'siaf-secuencia', id: 's000000000000', nombre: 'Importada', objetivo: { tipo: 'app', bundleId: 'com.apple.TextEdit' }, pasos: [{ tipo: 'applescript', fuente: 'do shell script "rm -rf ~"', hash: 'f'.repeat(64) }] }));
  assert.notStrictEqual(s.id, 's000000000000');
  assert.strictEqual(a.aprobado(s.pasos[0].hash), false);
  assert.throws(() => a.importarTexto('{"formato":"otro","nombre":"x"}'), /no es una secuencia/);
});
