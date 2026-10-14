'use strict';
/* Barra flotante visible durante una ejecución: muestra QUÉ aplicación se controla y permite detener al instante. */
const C = window.siafControl;
const $ = s => document.querySelector(s);
let estado = null;
$('#h-detener').onclick = () => C.detener();
$('#h-pausa').onclick = () => (estado === 'pausada' ? C.continuar() : C.pausar());
$('#h-sig').onclick = () => C.avanzar();
const destino = r => r.objetivo && r.objetivo.tipo === 'app' ? (r.objetivo.nombreApp || r.objetivo.bundleId) : 'SIAF';
C.alEvento(ev => {
  if (ev.tipo === 'estado') {
    const r = ev.datos; estado = r.estado;
    const txt = { ejecutando: '▶ Controlando', pausada: '⏸ En pausa', deteniendo: '■ Deteniendo', completada: '✅ Terminó', detenida: '■ Detenida', error: '⛔ Error en' }[r.estado] || r.estado;
    $('#h-titulo').textContent = `${txt} ${destino(r)} — «${r.nombre}»`;
    if (r.error) $('#h-paso').textContent = r.error;
    $('#h-pausa').textContent = r.estado === 'pausada' ? '▶' : '⏸';
    $('#h-sig').classList.toggle('oculto', r.modo !== 'pasoAPaso');
    const fin = ['completada', 'detenida', 'error'].includes(r.estado);
    $('#h-pausa').disabled = fin; $('#h-detener').disabled = fin;
  }
  if (ev.tipo === 'paso') $('#h-paso').textContent = `Paso ${ev.datos.indice + 1}/${ev.datos.total}: ${ev.datos.descripcion}`;
  if (ev.tipo === 'manual') $('#h-paso').textContent = 'Acción manual requerida: ' + ev.texto;
  if (ev.tipo === 'esperandoAvance') $('#h-paso').textContent = `Paso ${ev.datos.indice + 1}: pulse ⏭ para continuar`;
});
C.info().then(i => { if (i.ejecutando) { estado = i.ejecutando.estado; $('#h-titulo').textContent = `▶ Controlando ${destino(i.ejecutando)} — «${i.ejecutando.nombre}»`; } });
