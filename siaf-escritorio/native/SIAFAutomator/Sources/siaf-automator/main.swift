// siaf-automator — auxiliar nativo de «SIAF Control y Automatización» (macOS 12+).
//
// Protocolo (modo «serve»): una línea JSON por mensaje en stdin/stdout.
//   petición  {"id":1,"cmd":"pulsar","args":{...}}
//   respuesta {"id":1,"ok":true,"resultado":...} | {"id":1,"ok":false,"error":"..."}
//   evento    {"evento":"paso","datos":{...}}   (solo durante una grabación)
//
// Principios de seguridad:
//   - Usa únicamente mecanismos oficiales: API de Accesibilidad (AXUIElement), CGEvent y CGEventTap en modo
//     SOLO ESCUCHA. No intenta eludir permisos ni Secure Input.
//   - Nunca graba ni escribe en campos seguros (AXSecureTextField) y no graba teclado mientras Secure Input
//     está activo.
//   - Solo graba eventos de las aplicaciones autorizadas que le indica SIAF y solo mientras dura la grabación.
//   - No ejecuta comandos de shell ni scripts: los AppleScript aprobados los ejecuta SIAF con /usr/bin/osascript.
//
// Subcomandos de diagnóstico: `siaf-automator version | permisos | apps | frontal`.

import AppKit
import ApplicationServices
import Carbon.HIToolbox
import Foundation

let VERSION = "1.0.0"

// MARK: - Salida JSON (serializada)

let colaSalida = DispatchQueue(label: "siaf.salida")
func enviar(_ obj: [String: Any]) {
    colaSalida.sync {
        guard JSONSerialization.isValidJSONObject(obj),
              let d = try? JSONSerialization.data(withJSONObject: obj, options: []) else { return }
        FileHandle.standardOutput.write(d)
        FileHandle.standardOutput.write("\n".data(using: .utf8)!)
    }
}

struct FalloAux: Error { let mensaje: String; init(_ m: String) { mensaje = m } }

// MARK: - Utilidades de Accesibilidad

func copiar(_ e: AXUIElement, _ a: String) -> CFTypeRef? {
    var v: CFTypeRef?
    let r = AXUIElementCopyAttributeValue(e, a as CFString, &v)
    return r == .success ? v : nil
}
func texto(_ e: AXUIElement, _ a: String) -> String {
    guard let v = copiar(e, a) else { return "" }
    if let s = v as? String { return s }
    if let n = v as? NSNumber { return n.stringValue }
    return ""
}
func elemento(_ e: AXUIElement, _ a: String) -> AXUIElement? {
    guard let v = copiar(e, a), CFGetTypeID(v) == AXUIElementGetTypeID() else { return nil }
    return (v as! AXUIElement)
}
func elementos(_ e: AXUIElement, _ a: String) -> [AXUIElement] {
    guard let v = copiar(e, a), CFGetTypeID(v) == CFArrayGetTypeID(), let arr = v as? [AXUIElement] else { return [] }
    return arr
}
func valorAX<T>(_ e: AXUIElement, _ a: String, _ tipo: AXValueType, _ inicial: T) -> T? {
    guard let v = copiar(e, a), CFGetTypeID(v) == AXValueGetTypeID() else { return nil }
    var x = inicial
    return AXValueGetValue(v as! AXValue, tipo, &x) ? x : nil
}
func marco(_ e: AXUIElement) -> CGRect? {
    guard let p: CGPoint = valorAX(e, kAXPositionAttribute, .cgPoint, CGPoint.zero),
          let s: CGSize = valorAX(e, kAXSizeAttribute, .cgSize, CGSize.zero) else { return nil }
    return CGRect(origin: p, size: s)
}
func rol(_ e: AXUIElement) -> String { texto(e, kAXRoleAttribute) }
func subrol(_ e: AXUIElement) -> String { texto(e, kAXSubroleAttribute) }
func titulo(_ e: AXUIElement) -> String {
    let t = texto(e, kAXTitleAttribute)
    if !t.isEmpty { return t }
    if let te = elemento(e, kAXTitleUIElementAttribute) { return texto(te, kAXValueAttribute) }
    return ""
}
func esSeguro(_ e: AXUIElement) -> Bool { subrol(e) == (kAXSecureTextFieldSubrole as String) }
func acciones(_ e: AXUIElement) -> [String] {
    var v: CFArray?
    guard AXUIElementCopyActionNames(e, &v) == .success, let arr = v as? [String] else { return [] }
    return arr
}

func appEnEjecucion(_ bundleId: String) -> NSRunningApplication? {
    NSRunningApplication.runningApplications(withBundleIdentifier: bundleId).first(where: { !$0.isTerminated })
}
func axApp(_ bundleId: String) throws -> (NSRunningApplication, AXUIElement) {
    guard let app = appEnEjecucion(bundleId) else { throw FalloAux("La aplicación \(bundleId) no está abierta.") }
    let ax = AXUIElementCreateApplication(app.processIdentifier)
    AXUIElementSetMessagingTimeout(ax, 3.0)
    return (app, ax)
}
func ventanaFoco(_ ax: AXUIElement) -> AXUIElement? {
    elemento(ax, kAXFocusedWindowAttribute) ?? elemento(ax, kAXMainWindowAttribute) ?? elementos(ax, kAXWindowsAttribute).first
}

// MARK: - Selectores

struct PasoRuta { let rol: String; let indice: Int; let titulo: String }
struct Selector {
    var rol = "", subrol = "", titulo = "", identificador = "", descripcion = "", ventana = ""
    var ruta: [PasoRuta] = []
    init(_ d: [String: Any]?) {
        guard let d = d else { return }
        rol = d["rol"] as? String ?? ""; subrol = d["subrol"] as? String ?? ""; titulo = d["titulo"] as? String ?? ""
        identificador = d["identificador"] as? String ?? ""; descripcion = d["descripcion"] as? String ?? ""; ventana = d["ventana"] as? String ?? ""
        ruta = (d["ruta"] as? [[String: Any]] ?? []).map { PasoRuta(rol: $0["rol"] as? String ?? "", indice: ($0["indice"] as? NSNumber)?.intValue ?? 0, titulo: $0["titulo"] as? String ?? "") }
    }
    var vacio: Bool { rol.isEmpty && titulo.isEmpty && identificador.isEmpty && descripcion.isEmpty && ruta.isEmpty }
}

/// Describe un elemento para grabarlo: rol, títulos y la ruta desde su ventana.
func describir(_ e: AXUIElement) -> [String: Any] {
    var ruta: [[String: Any]] = []
    var actual: AXUIElement? = e
    var ventana = ""
    var pasos = 0
    while let x = actual, pasos < 40 {
        pasos += 1
        let r = rol(x)
        if r == (kAXWindowRole as String) { ventana = titulo(x); break }
        if r == (kAXApplicationRole as String) { break }
        guard let padre = elemento(x, kAXParentAttribute) else { break }
        let hermanos = elementos(padre, kAXChildrenAttribute).filter { rol($0) == r }
        let indice = hermanos.firstIndex(where: { CFEqual($0, x) }) ?? 0
        ruta.insert(["rol": r, "indice": indice, "titulo": String(titulo(x).prefix(120))], at: 0)
        actual = padre
    }
    return ["rol": rol(e), "subrol": subrol(e), "titulo": String(titulo(e).prefix(200)), "identificador": String(texto(e, "AXIdentifier").prefix(200)),
            "descripcion": String(texto(e, kAXDescriptionAttribute).prefix(200)), "ventana": String(ventana.prefix(200)), "ruta": ruta]
}

/// Búsqueda en anchura acotada (profundidad y número de nodos) para no bloquear apps con árboles enormes.
func buscarEn(_ raiz: AXUIElement, _ coincide: (AXUIElement) -> Bool, maxNodos: Int = 6000) -> AXUIElement? {
    var cola: [(AXUIElement, Int)] = [(raiz, 0)]
    var vistos = 0
    while !cola.isEmpty && vistos < maxNodos {
        let (e, prof) = cola.removeFirst()
        vistos += 1
        if coincide(e) { return e }
        if prof < 40 { for h in elementos(e, kAXChildrenAttribute) { cola.append((h, prof + 1)) } }
    }
    return nil
}

func resolver(_ sel: Selector, en ax: AXUIElement) -> AXUIElement? {
    var ventanas = elementos(ax, kAXWindowsAttribute)
    if let f = ventanaFoco(ax) { ventanas.removeAll(where: { CFEqual($0, f) }); ventanas.insert(f, at: 0) }
    if !sel.ventana.isEmpty, let i = ventanas.firstIndex(where: { titulo($0) == sel.ventana }) { let v = ventanas.remove(at: i); ventanas.insert(v, at: 0) }
    let raices = ventanas.isEmpty ? [ax] : ventanas
    for v in raices {
        if !sel.identificador.isEmpty, let e = buscarEn(v, { texto($0, "AXIdentifier") == sel.identificador }) { return e }
        if !sel.titulo.isEmpty || !sel.descripcion.isEmpty {
            if let e = buscarEn(v, { x in
                (sel.rol.isEmpty || rol(x) == sel.rol) &&
                ((!sel.titulo.isEmpty && titulo(x) == sel.titulo) || (!sel.descripcion.isEmpty && texto(x, kAXDescriptionAttribute) == sel.descripcion))
            }) { return e }
        }
        if !sel.ruta.isEmpty {
            var actual: AXUIElement? = v
            for p in sel.ruta {
                guard let a = actual else { break }
                let hs = elementos(a, kAXChildrenAttribute).filter { rol($0) == p.rol }
                if !p.titulo.isEmpty, let t = hs.first(where: { titulo($0) == p.titulo }) { actual = t }
                else { actual = p.indice < hs.count ? hs[p.indice] : nil }
            }
            if let e = actual, rol(e) == (sel.rol.isEmpty ? rol(e) : sel.rol) { return e }
        }
        if sel.titulo.isEmpty && sel.descripcion.isEmpty && sel.identificador.isEmpty && sel.ruta.isEmpty && !sel.rol.isEmpty,
           let e = buscarEn(v, { rol($0) == sel.rol }) { return e }
    }
    return nil
}

func esperarElemento(_ bundleId: String, _ sel: Selector, timeoutMs: Int) throws -> AXUIElement {
    if sel.vacio { throw FalloAux("El paso no indica qué control buscar.") }
    let limite = Date().addingTimeInterval(Double(max(200, timeoutMs)) / 1000)
    repeat {
        let (_, ax) = try axApp(bundleId)
        if let e = resolver(sel, en: ax) { return e }
        Thread.sleep(forTimeInterval: 0.15)
    } while Date() < limite
    let nombre = !sel.titulo.isEmpty ? sel.titulo : !sel.descripcion.isEmpty ? sel.descripcion : !sel.identificador.isEmpty ? sel.identificador : sel.rol
    throw FalloAux("La interfaz cambió: no se encontró «\(nombre)» en la aplicación.")
}

// MARK: - Eventos sintéticos (requieren Accesibilidad)

let TECLAS: [String: Int] = [
    "a": kVK_ANSI_A, "b": kVK_ANSI_B, "c": kVK_ANSI_C, "d": kVK_ANSI_D, "e": kVK_ANSI_E, "f": kVK_ANSI_F, "g": kVK_ANSI_G, "h": kVK_ANSI_H,
    "i": kVK_ANSI_I, "j": kVK_ANSI_J, "k": kVK_ANSI_K, "l": kVK_ANSI_L, "m": kVK_ANSI_M, "n": kVK_ANSI_N, "o": kVK_ANSI_O, "p": kVK_ANSI_P,
    "q": kVK_ANSI_Q, "r": kVK_ANSI_R, "s": kVK_ANSI_S, "t": kVK_ANSI_T, "u": kVK_ANSI_U, "v": kVK_ANSI_V, "w": kVK_ANSI_W, "x": kVK_ANSI_X,
    "y": kVK_ANSI_Y, "z": kVK_ANSI_Z, "0": kVK_ANSI_0, "1": kVK_ANSI_1, "2": kVK_ANSI_2, "3": kVK_ANSI_3, "4": kVK_ANSI_4, "5": kVK_ANSI_5,
    "6": kVK_ANSI_6, "7": kVK_ANSI_7, "8": kVK_ANSI_8, "9": kVK_ANSI_9, "return": kVK_Return, "enter": kVK_ANSI_KeypadEnter, "tab": kVK_Tab,
    "space": kVK_Space, "escape": kVK_Escape, "esc": kVK_Escape, "delete": kVK_ForwardDelete, "backspace": kVK_Delete, "up": kVK_UpArrow,
    "down": kVK_DownArrow, "left": kVK_LeftArrow, "right": kVK_RightArrow, "home": kVK_Home, "end": kVK_End, "pageup": kVK_PageUp,
    "pagedown": kVK_PageDown, "f1": kVK_F1, "f2": kVK_F2, "f3": kVK_F3, "f4": kVK_F4, "f5": kVK_F5, "f6": kVK_F6, "f7": kVK_F7, "f8": kVK_F8,
    "f9": kVK_F9, "f10": kVK_F10, "f11": kVK_F11, "f12": kVK_F12, "-": kVK_ANSI_Minus, "=": kVK_ANSI_Equal, "[": kVK_ANSI_LeftBracket,
    "]": kVK_ANSI_RightBracket, ";": kVK_ANSI_Semicolon, "'": kVK_ANSI_Quote, ",": kVK_ANSI_Comma, ".": kVK_ANSI_Period, "/": kVK_ANSI_Slash,
    "\\": kVK_ANSI_Backslash, "`": kVK_ANSI_Grave,
]
let NOMBRE_TECLA: [Int: String] = Dictionary(TECLAS.map { ($0.value, $0.key) }, uniquingKeysWith: { a, b in a.count >= b.count ? a : b })

func asegurarFrontal(_ bundleId: String) throws {
    guard let f = NSWorkspace.shared.frontmostApplication, f.bundleIdentifier == bundleId else {
        throw FalloAux("La interfaz cambió: \(bundleId) no está al frente; no se envían teclas ni clics a otra aplicación.")
    }
}

func enviarCombinacion(_ combo: String) throws {
    var flags: CGEventFlags = []
    var tecla: Int? = nil
    for parte in combo.lowercased().split(separator: "+").map(String.init) {
        switch parte {
        case "cmd", "command": flags.insert(.maskCommand)
        case "ctrl", "control": flags.insert(.maskControl)
        case "alt", "option": flags.insert(.maskAlternate)
        case "shift": flags.insert(.maskShift)
        case "fn": flags.insert(.maskSecondaryFn)
        default: tecla = TECLAS[parte]
        }
    }
    guard let k = tecla else { throw FalloAux("Combinación de teclas no reconocida: \(combo)") }
    let fuente = CGEventSource(stateID: .hidSystemState)
    guard let abajo = CGEvent(keyboardEventSource: fuente, virtualKey: CGKeyCode(k), keyDown: true),
          let arriba = CGEvent(keyboardEventSource: fuente, virtualKey: CGKeyCode(k), keyDown: false) else { throw FalloAux("No se pudo crear el evento de teclado.") }
    abajo.flags = flags; arriba.flags = flags
    abajo.post(tap: .cghidEventTap); arriba.post(tap: .cghidEventTap)
}

/// Escribe texto como pulsaciones Unicode. Con `pid` los eventos se entregan directamente a esa aplicación
/// (más fiable que el flujo HID global, que algunas apps ignoran para eventos sin tecla física).
func teclear(_ s: String, pid: pid_t? = nil) {
    let fuente = CGEventSource(stateID: .combinedSessionState)
    for ch in s {
        let u = Array(String(ch).utf16)
        guard let a = CGEvent(keyboardEventSource: fuente, virtualKey: 0, keyDown: true),
              let b = CGEvent(keyboardEventSource: fuente, virtualKey: 0, keyDown: false) else { continue }
        a.keyboardSetUnicodeString(stringLength: u.count, unicodeString: u)
        b.keyboardSetUnicodeString(stringLength: u.count, unicodeString: u)
        if let p = pid { a.postToPid(p); b.postToPid(p) } else { a.post(tap: .cghidEventTap); b.post(tap: .cghidEventTap) }
        Thread.sleep(forTimeInterval: 0.02)
    }
}

/// Inserta texto en la posición del cursor usando Accesibilidad (equivale a escribirlo). Devuelve false si el
/// control no lo admite.
func insertarAX(_ e: AXUIElement, _ t: String) -> Bool {
    var ajustable: DarwinBoolean = false
    guard AXUIElementIsAttributeSettable(e, kAXSelectedTextAttribute as CFString, &ajustable) == .success, ajustable.boolValue else { return false }
    return AXUIElementSetAttributeValue(e, kAXSelectedTextAttribute as CFString, t as CFTypeRef) == .success
}

func clic(en p: CGPoint, derecho: Bool = false, dobles: Bool = false) {
    let tipoAbajo: CGEventType = derecho ? .rightMouseDown : .leftMouseDown
    let tipoArriba: CGEventType = derecho ? .rightMouseUp : .leftMouseUp
    let boton: CGMouseButton = derecho ? .right : .left
    for n in 1...(dobles ? 2 : 1) {
        guard let a = CGEvent(mouseEventSource: nil, mouseType: tipoAbajo, mouseCursorPosition: p, mouseButton: boton),
              let b = CGEvent(mouseEventSource: nil, mouseType: tipoArriba, mouseCursorPosition: p, mouseButton: boton) else { return }
        a.setIntegerValueField(.mouseEventClickState, value: Int64(n)); b.setIntegerValueField(.mouseEventClickState, value: Int64(n))
        a.post(tap: .cghidEventTap); b.post(tap: .cghidEventTap)
        Thread.sleep(forTimeInterval: 0.05)
    }
}

// MARK: - Grabación (CGEventTap solo escucha)

final class Grabador {
    var tap: CFMachPort?
    var fuente: CFRunLoopSource?
    var apps: Set<String> = []
    var teclado = false
    var ultimoEscape = Date.distantPast
    var avisoSeguro = false

    func iniciar(apps: [String], teclado: Bool) throws {
        detener()
        self.apps = Set(apps); self.teclado = teclado; avisoSeguro = false
        var mascara = (1 << CGEventType.leftMouseDown.rawValue) | (1 << CGEventType.rightMouseDown.rawValue)
        if teclado { mascara |= (1 << CGEventType.keyDown.rawValue) }
        let yo = Unmanaged.passUnretained(self).toOpaque()
        guard let t = CGEvent.tapCreate(tap: .cgSessionEventTap, place: .tailAppendEventTap, options: .listenOnly, eventsOfInterest: CGEventMask(mascara),
                                        callback: { _, tipo, ev, ref in
                                            if let ref = ref { Unmanaged<Grabador>.fromOpaque(ref).takeUnretainedValue().evento(tipo, ev) }
                                            return Unmanaged.passUnretained(ev)
                                        }, userInfo: yo) else {
            throw FalloAux(teclado ? "macOS no permitió escuchar el teclado: conceda «Monitorización de entrada» a SIAF." : "macOS no permitió escuchar los clics: conceda «Accesibilidad» a SIAF.")
        }
        tap = t
        fuente = CFMachPortCreateRunLoopSource(kCFAllocatorDefault, t, 0)
        CFRunLoopAddSource(CFRunLoopGetMain(), fuente, .commonModes)
        CGEvent.tapEnable(tap: t, enable: true)
    }

    func detener() {
        if let t = tap { CGEvent.tapEnable(tap: t, enable: false) }
        if let f = fuente { CFRunLoopRemoveSource(CFRunLoopGetMain(), f, .commonModes) }
        tap = nil; fuente = nil
    }

    private func appFrontalAutorizada() -> String? {
        guard let f = NSWorkspace.shared.frontmostApplication, let b = f.bundleIdentifier, apps.contains(b) else { return nil }
        return b
    }

    private func emitir(_ app: String, _ paso: [String: Any], ventana: String = "") {
        var p = paso
        p["contexto"] = ["app": app, "ventana": ventana]
        enviar(["evento": "paso", "datos": ["app": app, "paso": p]])
    }

    func evento(_ tipo: CGEventType, _ ev: CGEvent) {
        if tipo == .tapDisabledByTimeout || tipo == .tapDisabledByUserInput { if let t = tap { CGEvent.tapEnable(tap: t, enable: true) }; return }
        // doble Escape = detener (válido en cualquier app mientras se graba)
        if tipo == .keyDown && Int(ev.getIntegerValueField(.keyboardEventKeycode)) == kVK_Escape {
            if Date().timeIntervalSince(ultimoEscape) < 0.5 { enviar(["evento": "detener"]) }
            ultimoEscape = Date()
        }
        guard let app = appFrontalAutorizada() else { return }
        switch tipo {
        case .leftMouseDown, .rightMouseDown:
            let p = ev.location
            var e: AXUIElement?
            let sistema = AXUIElementCreateSystemWide()
            var x: AXUIElement?
            if AXUIElementCopyElementAtPosition(sistema, Float(p.x), Float(p.y), &x) == .success { e = x }
            guard let el = e else { return }
            if esSeguro(el) { emitir(app, ["tipo": "campoSensible", "nota": "Campo seguro: escríbalo manualmente."]); return }
            let r = rol(el)
            if r == (kAXMenuItemRole as String) {
                var ruta: [String] = []
                var a: AXUIElement? = el
                while let m = a, ruta.count < 8 {
                    let rm = rol(m)
                    if rm == (kAXMenuItemRole as String) || rm == (kAXMenuBarItemRole as String) { let t = titulo(m); if !t.isEmpty { ruta.insert(t, at: 0) } }
                    if rm == (kAXMenuBarRole as String) { break }
                    a = elemento(m, kAXParentAttribute)
                }
                emitir(app, ["tipo": "menu", "ruta": ruta]); return
            }
            if r == (kAXMenuBarItemRole as String) || r == (kAXMenuRole as String) { return } // se graba al elegir la opción
            let d = describir(el)
            let ventana = d["ventana"] as? String ?? ""
            let identificable = !(d["titulo"] as? String ?? "").isEmpty || !(d["identificador"] as? String ?? "").isEmpty || !(d["descripcion"] as? String ?? "").isEmpty
            if identificable || !acciones(el).isEmpty {
                emitir(app, ["tipo": "pulsar", "elemento": d], ventana: ventana)
            } else if let par = try? axApp(app), let v = ventanaFoco(par.1), let m = marco(v), m.width > 0, m.height > 0 {
                // sin controles accesibles: posición relativa a la ventana (automatización visual complementaria)
                emitir(app, ["tipo": "clicRelativo", "x": Double((p.x - m.minX) / m.width), "y": Double((p.y - m.minY) / m.height), "boton": tipo == .rightMouseDown ? "derecho" : "izquierdo"], ventana: ventana)
            }
        case .keyDown:
            guard teclado else { return }
            if IsSecureEventInputEnabled() { return } // macOS protege la entrada (contraseñas): no se graba
            if let par = try? axApp(app), let foco = elemento(par.1, kAXFocusedUIElementAttribute), esSeguro(foco) {
                if !avisoSeguro { avisoSeguro = true; emitir(app, ["tipo": "campoSensible", "nota": "Campo seguro: escríbalo manualmente."]) }
                return
            }
            let k = Int(ev.getIntegerValueField(.keyboardEventKeycode))
            let f = ev.flags
            var mods: [String] = []
            if f.contains(.maskCommand) { mods.append("cmd") }
            if f.contains(.maskControl) { mods.append("ctrl") }
            if f.contains(.maskAlternate) { mods.append("alt") }
            let especiales: Set<Int> = [kVK_Return, kVK_Tab, kVK_Escape, kVK_ForwardDelete, kVK_Delete, kVK_UpArrow, kVK_DownArrow, kVK_LeftArrow, kVK_RightArrow, kVK_Home, kVK_End, kVK_PageUp, kVK_PageDown, kVK_ANSI_KeypadEnter]
            if !mods.isEmpty || especiales.contains(k) {
                if f.contains(.maskShift) { mods.append("shift") }
                guard let nombre = NOMBRE_TECLA[k] else { return }
                emitir(app, ["tipo": "teclas", "combinacion": (mods + [nombre]).joined(separator: "+")]); return
            }
            if let ns = NSEvent(cgEvent: ev), let s = ns.characters, !s.isEmpty, s.unicodeScalars.allSatisfy({ !CharacterSet.controlCharacters.contains($0) }) {
                emitir(app, ["tipo": "escribirTexto", "texto": s, "modo": "teclear"])
            }
        default: break
        }
    }
}
let grabador = Grabador()

// MARK: - Comandos

func permisos() -> [String: Any] {
    ["accesibilidad": AXIsProcessTrusted(), "monitorEntrada": CGPreflightListenEventAccess(), "version": VERSION]
}

func listarApps() -> [[String: Any]] {
    NSWorkspace.shared.runningApplications.filter { $0.activationPolicy == .regular && $0.bundleIdentifier != nil }
        .map { ["bundleId": $0.bundleIdentifier!, "nombre": $0.localizedName ?? $0.bundleIdentifier!, "pid": Int($0.processIdentifier)] }
}

func frontal() -> [String: Any] {
    guard let f = NSWorkspace.shared.frontmostApplication else { return [:] }
    let ax = AXUIElementCreateApplication(f.processIdentifier)
    AXUIElementSetMessagingTimeout(ax, 1.0)
    let ventana = ventanaFoco(ax).map { titulo($0) } ?? ""
    return ["bundleId": f.bundleIdentifier ?? "", "nombre": f.localizedName ?? "", "pid": Int(f.processIdentifier), "ventana": ventana]
}

func activar(_ b: String) throws {
    guard let app = appEnEjecucion(b) else { throw FalloAux("La aplicación \(b) no está abierta.") }
    if #available(macOS 14.0, *) { app.activate() } else { app.activate(options: [.activateIgnoringOtherApps]) }
    let limite = Date().addingTimeInterval(4)
    while NSWorkspace.shared.frontmostApplication?.bundleIdentifier != b && Date() < limite { Thread.sleep(forTimeInterval: 0.1) }
}

func abrir(_ b: String) throws {
    if appEnEjecucion(b) != nil { try activar(b); return }
    guard let url = NSWorkspace.shared.urlForApplication(withBundleIdentifier: b) else { throw FalloAux("No se encontró la aplicación \(b) en este Mac.") }
    let sem = DispatchSemaphore(value: 0)
    var error: Error?
    let conf = NSWorkspace.OpenConfiguration(); conf.activates = true
    NSWorkspace.shared.openApplication(at: url, configuration: conf) { _, e in error = e; sem.signal() }
    if sem.wait(timeout: .now() + 30) == .timedOut { throw FalloAux("La aplicación tardó demasiado en abrir.") }
    if let e = error { throw FalloAux("No se pudo abrir la aplicación: \(e.localizedDescription)") }
    let limite = Date().addingTimeInterval(10)
    while Date() < limite { if let par = try? axApp(b), ventanaFoco(par.1) != nil { break }; Thread.sleep(forTimeInterval: 0.2) }
}

func ejecutar(_ cmd: String, _ a: [String: Any]) throws -> Any {
    let b = a["bundleId"] as? String ?? ""
    let timeout = (a["timeoutMs"] as? NSNumber)?.intValue ?? 8000
    switch cmd {
    case "version": return VERSION
    case "permisos": return permisos()
    case "pedir-monitor": return CGRequestListenEventAccess()
    case "apps": return listarApps()
    case "frontal": return frontal()
    case "activar": try activar(b); return true
    case "abrir": try abrir(b); return true
    case "buscar":
        let e = try esperarElemento(b, Selector(a["elemento"] as? [String: Any]), timeoutMs: timeout)
        return describir(e)
    case "leer":
        let e = try esperarElemento(b, Selector(a["elemento"] as? [String: Any]), timeoutMs: timeout)
        if esSeguro(e) { throw FalloAux("No se leen campos seguros.") }
        return ["valor": String(texto(e, kAXValueAttribute).prefix(20000))]
    case "pulsar":
        let e = try esperarElemento(b, Selector(a["elemento"] as? [String: Any]), timeoutMs: timeout)
        if acciones(e).contains(kAXPressAction as String) {
            let r = AXUIElementPerformAction(e, kAXPressAction as CFString)
            if r != .success { throw FalloAux("El control no aceptó la pulsación (código \(r.rawValue)).") }
        } else if let m = marco(e) {
            try asegurarFrontal(b); clic(en: CGPoint(x: m.midX, y: m.midY))
        } else { throw FalloAux("El control no se puede pulsar.") }
        return true
    case "escribir":
        let t = a["texto"] as? String ?? ""
        let modo = a["modo"] as? String ?? "valor"
        var destino: AXUIElement?
        if let sel = a["elemento"] as? [String: Any], !Selector(sel).vacio { destino = try esperarElemento(b, Selector(sel), timeoutMs: timeout) }
        else { let (_, ax) = try axApp(b); destino = elemento(ax, kAXFocusedUIElementAttribute) }
        if let d = destino, esSeguro(d) { throw FalloAux("SIAF no escribe en campos seguros (contraseñas). Hágalo manualmente.") }
        if modo == "valor", let d = destino {
            var ajustable: DarwinBoolean = false
            if AXUIElementIsAttributeSettable(d, kAXValueAttribute as CFString, &ajustable) == .success, ajustable.boolValue,
               AXUIElementSetAttributeValue(d, kAXValueAttribute as CFString, t as CFTypeRef) == .success { return true }
        }
        try asegurarFrontal(b)
        if let d = destino {
            AXUIElementSetAttributeValue(d, kAXFocusedAttribute as CFString, kCFBooleanTrue)
            if insertarAX(d, t) { return true }   // 1.º: inserción accesible en el cursor
        }
        teclear(t, pid: appEnEjecucion(b)?.processIdentifier) // 2.º: pulsaciones dirigidas al proceso de la app
        return true
    case "teclas":
        try asegurarFrontal(b)
        try enviarCombinacion(a["combinacion"] as? String ?? "")
        return true
    case "menu":
        let ruta = a["ruta"] as? [String] ?? []
        if ruta.isEmpty { throw FalloAux("Ruta de menú vacía.") }
        let (_, ax) = try axApp(b)
        guard var actual = elemento(ax, kAXMenuBarAttribute) else { throw FalloAux("La aplicación no expone su barra de menús.") }
        for (i, nombre) in ruta.enumerated() {
            var hijo: AXUIElement? = nil
            let limite = Date().addingTimeInterval(Double(timeout) / 1000)
            repeat {
                var candidatos = elementos(actual, kAXChildrenAttribute)
                // las opciones cuelgan de un AXMenu intermedio
                candidatos += candidatos.filter { rol($0) == (kAXMenuRole as String) }.flatMap { elementos($0, kAXChildrenAttribute) }
                hijo = candidatos.first(where: { titulo($0) == nombre })
                if hijo == nil { Thread.sleep(forTimeInterval: 0.1) }
            } while hijo == nil && Date() < limite
            guard let h = hijo else { throw FalloAux("La interfaz cambió: no existe el menú «\(nombre)».") }
            if i < ruta.count - 1 {
                AXUIElementPerformAction(h, kAXPressAction as CFString)
                Thread.sleep(forTimeInterval: 0.15)
                actual = h
            } else {
                let r = AXUIElementPerformAction(h, kAXPressAction as CFString)
                if r != .success { throw FalloAux("No se pudo elegir «\(nombre)» (código \(r.rawValue)).") }
            }
        }
        return true
    case "clicRelativo":
        try asegurarFrontal(b)
        let (_, ax) = try axApp(b)
        guard let v = ventanaFoco(ax), let m = marco(v) else { throw FalloAux("No hay una ventana visible para el clic por posición.") }
        let x = (a["x"] as? NSNumber)?.doubleValue ?? 0.5, y = (a["y"] as? NSNumber)?.doubleValue ?? 0.5
        clic(en: CGPoint(x: m.minX + CGFloat(x) * m.width, y: m.minY + CGFloat(y) * m.height), derecho: (a["boton"] as? String) == "derecho", dobles: (a["dobles"] as? Bool) == true)
        return true
    case "grabar":
        guard AXIsProcessTrusted() else { throw FalloAux("Falta el permiso de Accesibilidad.") }
        try grabador.iniciar(apps: a["apps"] as? [String] ?? [], teclado: (a["teclado"] as? Bool) == true)
        return true
    case "grabar-detener":
        grabador.detener(); return true
    default:
        throw FalloAux("Comando desconocido: \(cmd)")
    }
}

// MARK: - Bucle principal

let colaAX = DispatchQueue(label: "siaf.ax") // los comandos se atienden en orden, fuera del hilo principal

func atender(_ linea: String) {
    guard let d = linea.data(using: .utf8), let obj = (try? JSONSerialization.jsonObject(with: d)) as? [String: Any],
          let id = obj["id"] as? NSNumber, let cmd = obj["cmd"] as? String else { return }
    let args = obj["args"] as? [String: Any] ?? [:]
    let enHiloPrincipal = cmd == "grabar" || cmd == "grabar-detener" // el CGEventTap vive en el run loop principal
    let trabajo = {
        do { enviar(["id": id, "ok": true, "resultado": try ejecutar(cmd, args)]) }
        catch let e as FalloAux { enviar(["id": id, "ok": false, "error": e.mensaje]) }
        catch { enviar(["id": id, "ok": false, "error": error.localizedDescription]) }
    }
    if enHiloPrincipal { DispatchQueue.main.async(execute: trabajo) } else { colaAX.async(execute: trabajo) }
}

let argumentos = CommandLine.arguments.dropFirst()
if let sub = argumentos.first, sub != "serve" {
    // modo diagnóstico de una sola orden
    do {
        let r = try ejecutar(sub, [:])
        if JSONSerialization.isValidJSONObject(r), let d = try? JSONSerialization.data(withJSONObject: r, options: [.prettyPrinted]) { print(String(data: d, encoding: .utf8)!) } else { print(r) }
        exit(0)
    } catch let e as FalloAux { FileHandle.standardError.write((e.mensaje + "\n").data(using: .utf8)!); exit(1) }
    catch { exit(1) }
}

setvbuf(stdout, nil, _IOLBF, 0)
DispatchQueue.global(qos: .userInitiated).async {
    while let linea = readLine(strippingNewline: true) { atender(linea) }
    // SIAF cerró la tubería: se termina (y con ello cualquier grabación)
    DispatchQueue.main.async { grabador.detener(); exit(0) }
}
RunLoop.main.run()
