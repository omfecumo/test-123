# Manual de «SIAF Control y Automatización»

Módulo opcional para **grabar, guardar, editar y reproducir** secuencias de acciones, dentro de SIAF y en otras aplicaciones de macOS que usted autorice. Ábralo con **Herramientas → SIAF Control y Automatización…** (⇧⌘A).

## 1. Dos tipos de objetivo

| Objetivo | Cómo actúa | Permisos de macOS | Estado |
|---|---|---|---|
| **SIAF** (esta app) | Reproductor interno sobre la página de SIAF (botones, campos, listas, casillas, secciones) | Ninguno | ✅ Probado automáticamente (Linux y macOS CI) |
| **Otra aplicación** autorizada | Auxiliar nativo `siaf-automator`: API de Accesibilidad (AXUIElement), eventos de teclado/ratón (CGEvent), menús, AppleScript aprobado, Atajos | Accesibilidad; Monitorización de entrada solo para grabar teclado; Automatización solo para AppleScript | ⚠️ Compila y responde a su protocolo en macOS (CI). La prueba con TextEdit (`P13-mac`) requiere conceder Accesibilidad a mano en un Mac: **pendiente de ejecución en un Mac real** |

## 2. Grabar

1. Pestaña **Grabar** → elija **SIAF** o una aplicación autorizada.
2. (Solo otras apps) Marque «Grabar teclado» si necesita capturar escritura. Requiere el permiso «Monitorización de entrada».
3. **⏺ Iniciar grabación** y realice las acciones. En SIAF aparece la etiqueta roja «⏺ Grabando acciones en SIAF».
4. **■ Detener grabación**, revise la lista de pasos, póngale nombre, carpeta y descripción y **Guardar como secuencia**.

Qué se graba:

* **En SIAF:** cambio de sección, clics en botones/enlaces/pestañas/filas, texto escrito en campos (valor final), opciones elegidas en listas, casillas, envío de formularios, con el contexto (sección y título del diálogo abierto).
* **En otras apps:** clics sobre controles accesibles (rol, título, identificador, descripción, ruta desde la ventana), opciones de menú (como ruta «Archivo › Guardar»), combinaciones de teclas y texto (si autorizó el teclado). Si el control pulsado no es accesible, se graba un **clic por posición** relativo a la ventana.

Qué **nunca** se graba:

* La pantalla de ingreso de SIAF (ni el PIN ni el número de pulsaciones).
* Campos de contraseña, PIN, claves, frases de cifrado, tokens, tarjetas o cuentas bancarias (por tipo de campo y por su etiqueta): quedan como paso **«Campo protegido (manual)»**, sin valor. Verificado por prueba: el PIN escrito durante una grabación no aparece en la secuencia.
* Campos seguros de macOS (`AXSecureTextField`) ni nada mientras macOS tiene activa la entrada segura (Secure Input).
* Eventos de aplicaciones no autorizadas o fuera del periodo de grabación.
* Selección de archivos (paso manual).

## 3. Editar y organizar

En **Secuencias**: buscar, carpetas, duplicar, exportar (`.siafseq.json`), importar, eliminar (se mueve a `Automatizacion/eliminadas`). En cada paso: subir/bajar, editar, duplicar, quitar, marcar **Confirmar** (pide su visto bueno antes de ejecutarlo) y **Reintento seguro**.

Pasos que puede añadir: Pausa · Pedir confirmación · Punto de recuperación · Condición (si un elemento existe / un texto aparece: continuar, saltar N pasos o detener) · Esperar elemento · Validar texto (SIAF) / Validar valor (apps) · Ir a sección · Clic · Escribir · Elegir opción · Marcar casilla · Enviar formulario · Abrir / traer al frente una app · Pulsar control · Escribir texto · Combinación de teclas · Elegir menú · Clic por posición · AppleScript · Ejecutar atajo (Shortcuts).

## 4. Ejecutar y controlar

* **▶ Ejecutar**: secuencia completa. **⏯ Paso a paso**: espera «⏭ Siguiente paso» antes de cada paso. **↻ Desde punto…**: reanuda desde un punto de recuperación (propone el último alcanzado).
* Durante la ejecución aparece una **barra flotante** (siempre visible) con la app controlada, el paso actual, ⏸ Pausar/▶ Continuar y **■ Detener**.
* **Detener de inmediato:** botón «Detener todo», barra flotante, Herramientas → Detener toda automatización, atajo global **⌘⇧⎋** (Comando+Mayúsculas+Escape) o, mientras graba otra app, **Escape dos veces**. Probado: detiene una espera de 2 minutos en menos de 5 s.
* Ajustes por secuencia: espera entre pasos, tiempo máximo por paso y número de reintentos.
* **Historial**: inicio, secuencia, objetivo, modo, estado, pasos completados, error y último punto alcanzado (sin valores escritos).

Reglas de seguridad del motor (todas con prueba automatizada):

* Los pasos que **borran, restauran, venden, pagan, transfieren, envían, vacían o reemplazan** —detectados por el texto del control grabado y otra vez por el control real en el momento de ejecutar— piden confirmación **siempre**. Los pasos AppleScript y Atajos también (efecto desconocido). Si usted no confirma, la secuencia se detiene sin ejecutarlos.
* Solo se reintentan pasos sin efectos secundarios (esperar, validar, navegar, traer al frente, condiciones) o los marcados «reintento seguro». Un clic o una escritura **no** se repite automáticamente.
* Si la interfaz no coincide (falta el botón, otro diálogo, otra app al frente), la secuencia se detiene con un mensaje como *«La interfaz cambió: no se encontró «Guardar» en «Nueva tarea»»*.
* Antes de enviar teclas o clics a otra app, el auxiliar comprueba que **esa** app está al frente; si no, intenta traerla y, si no lo logra, se detiene. Nunca envía eventos a otra aplicación.
* Los pasos manuales (campo protegido, archivo) se pausan y piden «Ya lo hice — Continuar».
* Un AppleScript no se ejecuta hasta que usted lo **revisa y aprueba** en este Mac (se guarda la huella SHA-256 del código; cualquier cambio exige aprobarlo de nuevo). Importar una secuencia **nunca** aprueba sus scripts. No existen pasos de «comando de shell».

## 5. Aplicaciones autorizadas y permisos de macOS

Pestaña **Permisos y aplicaciones**:

1. **Autorizar aplicación…** (elegir en /Applications) o elegirla entre las abiertas. Se puede revocar en cualquier momento.
2. **Accesibilidad** — necesario para controlar o grabar otras apps. Botón «Solicitar» (muestra el aviso del sistema) o Ajustes del Sistema → Privacidad y seguridad → **Accesibilidad** → activar **SIAF**.
3. **Monitorización de entrada** — solo para grabar el teclado de otras apps. Ajustes → Privacidad y seguridad → **Monitorización de entrada** → SIAF. Puede requerir reabrir SIAF.
4. **Automatización (Apple Events)** — macOS lo pregunta la primera vez que un AppleScript aprobado controla una app. Ajustes → Privacidad y seguridad → **Automatización**.
5. **Grabación de pantalla** — **no se usa**. SIAF no captura la pantalla.

Si deniega un permiso, las funciones que lo necesitan muestran el motivo y el resto sigue funcionando; al concederlo, la pestaña se actualiza al volver a la ventana (si macOS no lo refleja, reabra SIAF).

## 6. Limitaciones (no hay compatibilidad universal)

* Aplicaciones que no exponen controles accesibles (juegos, interfaces dibujadas a mano, algunos programas multiplataforma o con Java/Qt antiguos): solo el **clic por posición**, que depende del tamaño y la posición de la ventana y puede fallar si la interfaz cambia.
* Ventanas del sistema protegidas (Ajustes de seguridad, diálogos de contraseña, Llavero), campos seguros y Secure Input: no se graban ni se controlan, por diseño de macOS.
* Apps sandbox o con políticas propias pueden rechazar Apple Events.
* Combinaciones de teclas usan posiciones del teclado ANSI (EE. UU.); en distribuciones como AZERTY/QWERTZ revise las letras. El texto se escribe como Unicode y no depende de la distribución.
* El reconocimiento de imágenes (buscar un botón por su aspecto) **no está implementado**; requeriría el permiso de Grabación de pantalla y queda como mejora futura.
* Los selectores de SIAF se basan en atributos estables y el texto visible; si una versión futura de SIAF cambia esos textos, regrabe o edite el paso.

## 7. Almacenamiento

`~/Library/Application Support/SIAF/Automatizacion/`: `secuencias/*.json`, `historial.jsonl`, `apps.json`, `aprobaciones.json`, `eliminadas/`. Todo local; nada se envía a Internet.
