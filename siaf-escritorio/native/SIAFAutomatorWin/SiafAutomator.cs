// siaf-automator.exe — auxiliar nativo de «SIAF Control y Automatización» para Windows 10/11.
//
// Mismo protocolo que el auxiliar de macOS (una línea JSON por mensaje en stdin/stdout):
//   petición  {"id":1,"cmd":"pulsar","args":{...}}
//   respuesta {"id":1,"ok":true,"resultado":...} | {"id":1,"ok":false,"error":"..."}
//   evento    {"evento":"paso","datos":{...}}   (solo durante una grabación)
//
// Mecanismos oficiales de Windows:
//   - UI Automation (System.Windows.Automation): buscar, leer, pulsar y escribir en controles.
//   - SendInput: teclas, texto Unicode y clics (solo hacia la aplicación autorizada que está al frente).
//   - Hooks de bajo nivel WH_MOUSE_LL / WH_KEYBOARD_LL en modo SOLO LECTURA, únicamente durante una grabación.
// Seguridad: no graba ni escribe en campos de contraseña (IsPassword); solo emite eventos de las aplicaciones
// autorizadas; no ejecuta comandos ni scripts; no puede controlar apps que se ejecutan como administrador si SIAF
// no lo está (UIPI, protección de Windows que no se intenta eludir).
//
// Compilación (sin SDK, con el compilador incluido en Windows): scripts\build-automator-win.ps1
// Código C# 5 (compatible con csc.exe de .NET Framework 4.x).

using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Automation;

namespace SiafAutomator
{
    class Fallo : Exception { public Fallo(string m) : base(m) { } }

    static class Win
    {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
        [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);
        [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetWindowText(IntPtr h, StringBuilder sb, int max);
        [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
        [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint a, uint b, bool attach);
        [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
        [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
        [DllImport("user32.dll", SetLastError = true)] public static extern uint SendInput(uint n, INPUT[] inputs, int size);
        [DllImport("user32.dll")] public static extern bool SetCursorPos(int x, int y);
        [DllImport("user32.dll")] public static extern short VkKeyScan(char c);
        [DllImport("user32.dll")] public static extern short GetKeyState(int vk);
        [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int vk);
        [DllImport("user32.dll")] public static extern IntPtr GetKeyboardLayout(uint thread);
        [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int ToUnicodeEx(uint vk, uint scan, byte[] state, StringBuilder buf, int len, uint flags, IntPtr hkl);
        [DllImport("user32.dll", SetLastError = true)] public static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr mod, uint thread);
        [DllImport("user32.dll")] public static extern bool UnhookWindowsHookEx(IntPtr h);
        [DllImport("user32.dll")] public static extern IntPtr CallNextHookEx(IntPtr h, int code, IntPtr w, IntPtr l);
        [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] public static extern IntPtr GetModuleHandle(string name);
        [DllImport("user32.dll")] public static extern int GetMessage(out MSG m, IntPtr h, uint min, uint max);
        [DllImport("user32.dll")] public static extern bool PostThreadMessage(uint thread, uint msg, IntPtr w, IntPtr l);
        [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
        [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v);
        [DllImport("advapi32.dll", SetLastError = true)] public static extern bool OpenProcessToken(IntPtr p, uint access, out IntPtr token);
        [DllImport("advapi32.dll", SetLastError = true)] public static extern bool GetTokenInformation(IntPtr t, int cls, out int info, int len, out int ret);
        [DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
        [DllImport("kernel32.dll")] public static extern bool CloseHandle(IntPtr h);

        public delegate IntPtr HookProc(int code, IntPtr w, IntPtr l);

        [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
        [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X, Y; }
        [StructLayout(LayoutKind.Sequential)] public struct MSG { public IntPtr hwnd; public uint message; public IntPtr wParam, lParam; public uint time; public POINT pt; }
        [StructLayout(LayoutKind.Sequential)] public struct MSLLHOOKSTRUCT { public POINT pt; public uint mouseData, flags, time; public IntPtr extra; }
        [StructLayout(LayoutKind.Sequential)] public struct KBDLLHOOKSTRUCT { public uint vkCode, scanCode, flags, time; public IntPtr extra; }
        [StructLayout(LayoutKind.Sequential)] public struct MOUSEINPUT { public int dx, dy; public uint mouseData, dwFlags, time; public IntPtr extra; }
        [StructLayout(LayoutKind.Sequential)] public struct KEYBDINPUT { public ushort wVk, wScan; public uint dwFlags, time; public IntPtr extra; }
        [StructLayout(LayoutKind.Explicit)] public struct ENTRADA { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
        [StructLayout(LayoutKind.Sequential)] public struct INPUT { public uint type; public ENTRADA u; }

        public const uint INPUT_MOUSE = 0, INPUT_KEYBOARD = 1, KEYEVENTF_KEYUP = 2, KEYEVENTF_UNICODE = 4;
        public const uint MOUSEEVENTF_LEFTDOWN = 2, MOUSEEVENTF_LEFTUP = 4, MOUSEEVENTF_RIGHTDOWN = 8, MOUSEEVENTF_RIGHTUP = 16;
        public const int WH_KEYBOARD_LL = 13, WH_MOUSE_LL = 14, WM_KEYDOWN = 0x100, WM_SYSKEYDOWN = 0x104, WM_LBUTTONDOWN = 0x201, WM_RBUTTONDOWN = 0x204;
        public const uint WM_QUIT = 0x12;
        public const int VK_SHIFT = 0x10, VK_CONTROL = 0x11, VK_MENU = 0x12, VK_LWIN = 0x5B, VK_RWIN = 0x5C, VK_CAPITAL = 0x14, VK_ESCAPE = 0x1B;

        public static string Titulo(IntPtr h) { var sb = new StringBuilder(512); GetWindowText(h, sb, 512); return sb.ToString(); }
        public static uint Pid(IntPtr h) { uint p; GetWindowThreadProcessId(h, out p); return p; }

        public static void Teclas(IEnumerable<KeyValuePair<ushort, bool>> eventos)
        {
            var lista = new List<INPUT>();
            foreach (var e in eventos)
            {
                var i = new INPUT { type = INPUT_KEYBOARD };
                i.u.ki = new KEYBDINPUT { wVk = e.Key, dwFlags = e.Value ? 0u : KEYEVENTF_KEYUP };
                lista.Add(i);
            }
            if (lista.Count > 0) SendInput((uint)lista.Count, lista.ToArray(), Marshal.SizeOf(typeof(INPUT)));
        }

        public static void Unicode(string texto)
        {
            foreach (char c in texto)
            {
                var a = new INPUT { type = INPUT_KEYBOARD }; a.u.ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE };
                var b = new INPUT { type = INPUT_KEYBOARD }; b.u.ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP };
                // pulsación y liberación por separado: algunas apps (Bloc de notas de Windows 11) pierden la
                // liberación si llegan en el mismo lote y repiten la tecla
                SendInput(1, new[] { a }, Marshal.SizeOf(typeof(INPUT)));
                Thread.Sleep(5);
                SendInput(1, new[] { b }, Marshal.SizeOf(typeof(INPUT)));
                Thread.Sleep(15);
            }
        }

        public static void Clic(int x, int y, bool derecho, bool dobles)
        {
            SetCursorPos(x, y);
            Thread.Sleep(30);
            for (int n = 0; n < (dobles ? 2 : 1); n++)
            {
                var a = new INPUT { type = INPUT_MOUSE }; a.u.mi = new MOUSEINPUT { dwFlags = derecho ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_LEFTDOWN };
                var b = new INPUT { type = INPUT_MOUSE }; b.u.mi = new MOUSEINPUT { dwFlags = derecho ? MOUSEEVENTF_RIGHTUP : MOUSEEVENTF_LEFTUP };
                SendInput(2, new[] { a, b }, Marshal.SizeOf(typeof(INPUT)));
                Thread.Sleep(60);
            }
        }

        public static bool Elevado()
        {
            IntPtr t;
            if (!OpenProcessToken(GetCurrentProcess(), 8, out t)) return false;
            try { int v, r; return GetTokenInformation(t, 20, out v, 4, out r) && v != 0; } finally { CloseHandle(t); }
        }
    }

    static class Programa
    {
        public const string VERSION = "1.0.0";
        static readonly object candado = new object();
        public static readonly JavaScriptSerializer Json = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

        public static void Enviar(Dictionary<string, object> o)
        {
            string s = Json.Serialize(o);
            lock (candado) { Console.Out.Write(s + "\n"); Console.Out.Flush(); }
        }

        // ---------- lectura de argumentos ----------
        public static string Str(IDictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v != null ? Convert.ToString(v) : ""; }
        public static double Num(IDictionary<string, object> d, string k, double def) { object v; if (d != null && d.TryGetValue(k, out v) && v != null) { try { return Convert.ToDouble(v); } catch { } } return def; }
        public static bool Bool(IDictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) && v is bool && (bool)v; }
        public static IDictionary<string, object> Dic(IDictionary<string, object> d, string k) { object v; return d != null && d.TryGetValue(k, out v) ? v as IDictionary<string, object> : null; }
        public static List<object> Lista(IDictionary<string, object> d, string k)
        {
            object v; var r = new List<object>();
            if (d != null && d.TryGetValue(k, out v) && v is IEnumerable && !(v is string)) foreach (var x in (IEnumerable)v) r.Add(x);
            return r;
        }

        // ---------- aplicaciones (identificador = nombre del ejecutable en minúsculas, p. ej. «notepad.exe») ----------
        public static string IdProceso(Process p) { try { return (p.ProcessName + ".exe").ToLowerInvariant(); } catch { return ""; } }
        public static Process Proceso(string id)
        {
            string n = Path.GetFileNameWithoutExtension(id);
            Process conVentana = null, cualquiera = null;
            foreach (var p in Process.GetProcessesByName(n))
            {
                if (cualquiera == null) cualquiera = p;
                try { if (p.MainWindowHandle != IntPtr.Zero && conVentana == null) conVentana = p; } catch { }
            }
            return conVentana ?? cualquiera;
        }
        public static Process ProcesoObligatorio(string id) { var p = Proceso(id); if (p == null) throw new Fallo("La aplicación " + id + " no está abierta."); return p; }

        public static List<AutomationElement> Ventanas(int pid)
        {
            var r = new List<AutomationElement>();
            var col = AutomationElement.RootElement.FindAll(TreeScope.Children, new PropertyCondition(AutomationElement.ProcessIdProperty, pid));
            foreach (AutomationElement v in col) r.Add(v);
            // la ventana al frente primero
            IntPtr fg = Win.GetForegroundWindow();
            r.Sort((a, b) => (Hwnd(b) == fg ? 1 : 0) - (Hwnd(a) == fg ? 1 : 0));
            return r;
        }
        static IntPtr Hwnd(AutomationElement e) { try { return new IntPtr(e.Current.NativeWindowHandle); } catch { return IntPtr.Zero; } }

        public static Dictionary<string, object> Frontal()
        {
            IntPtr h = Win.GetForegroundWindow();
            var r = new Dictionary<string, object>();
            if (h == IntPtr.Zero) return r;
            uint pid = Win.Pid(h);
            try { var p = Process.GetProcessById((int)pid); r["bundleId"] = IdProceso(p); r["nombre"] = p.ProcessName; } catch { r["bundleId"] = ""; r["nombre"] = ""; }
            r["pid"] = (int)pid; r["ventana"] = Win.Titulo(h);
            return r;
        }

        public static void Activar(string id)
        {
            var p = ProcesoObligatorio(id);
            IntPtr h = p.MainWindowHandle;
            if (h == IntPtr.Zero) throw new Fallo("La aplicación no tiene una ventana visible.");
            if (Win.IsIconic(h)) Win.ShowWindow(h, 9);
            if (Win.Pid(Win.GetForegroundWindow()) == (uint)p.Id) return; // ya está al frente: no se toca nada
            // 1.º petición normal; 2.º adjuntando la cola de entrada de la ventana actual (técnica documentada).
            Win.SetForegroundWindow(h);
            if (EsperarFrente(p.Id, 600)) return;
            uint hilo = Win.GetCurrentThreadId(), hiloFg = GetHilo(Win.GetForegroundWindow());
            if (hiloFg != 0 && hiloFg != hilo) Win.AttachThreadInput(hilo, hiloFg, true);
            Win.BringWindowToTop(h); Win.SetForegroundWindow(h);
            if (hiloFg != 0 && hiloFg != hilo) Win.AttachThreadInput(hilo, hiloFg, false);
            if (EsperarFrente(p.Id, 1000)) return;
            // 3.º último recurso: una pulsación de Alt habilita el cambio de primer plano (solo si la app aún no está al frente,
            // para no abrir su barra de menús).
            Win.Teclas(new[] { new KeyValuePair<ushort, bool>((ushort)Win.VK_MENU, true), new KeyValuePair<ushort, bool>((ushort)Win.VK_MENU, false) });
            Win.SetForegroundWindow(h);
            EsperarFrente(p.Id, 2500);
        }
        static bool EsperarFrente(int pid, int ms)
        {
            var limite = DateTime.Now.AddMilliseconds(ms);
            while (DateTime.Now < limite) { if (Win.Pid(Win.GetForegroundWindow()) == (uint)pid) return true; Thread.Sleep(100); }
            return false;
        }
        static uint GetHilo(IntPtr h) { uint pid; return Win.GetWindowThreadProcessId(h, out pid); }

        public static void Abrir(string id, string ruta)
        {
            if (Proceso(id) != null && Proceso(id).MainWindowHandle != IntPtr.Zero) { Activar(id); return; }
            string destino = !string.IsNullOrEmpty(ruta) && File.Exists(ruta) ? ruta : id;
            try { Process.Start(new ProcessStartInfo(destino) { UseShellExecute = true }); }
            catch (Exception e) { throw new Fallo("No se pudo abrir la aplicación: " + e.Message); }
            // algunas apps (alias de la Tienda, lanzadores) terminan y abren otro proceso: se espera la ventana por nombre
            var limite = DateTime.Now.AddSeconds(20);
            while (DateTime.Now < limite)
            {
                var p = Proceso(id);
                if (p != null)
                {
                    p.Refresh();
                    if (p.MainWindowHandle != IntPtr.Zero)
                    {
                        // la ventana existe antes de que la app acepte teclado (Bloc de notas de Windows 11 en ARM64
                        // alteraba el primer texto tecleado): se espera a que quede inactiva y se da un margen
                        EsperarInactiva(p, 10000);
                        Thread.Sleep(800);
                        Activar(id); return;
                    }
                }
                Thread.Sleep(250);
            }
            throw new Fallo("La aplicación no mostró ninguna ventana en 20 s.");
        }

        static void EsperarInactiva(Process p, int ms)
        {
            try { p.WaitForInputIdle(ms); } catch { } // apps de consola o que ya terminaron: no aplica
        }

        /// Valor legible del control (ValuePattern o TextPattern), o null si no expone ninguno.
        static string ValorLegible(AutomationElement e)
        {
            if (e == null) return null;
            try
            {
                object pat;
                if (e.TryGetCurrentPattern(ValuePattern.Pattern, out pat)) return ((ValuePattern)pat).Current.Value ?? "";
                if (e.TryGetCurrentPattern(TextPattern.Pattern, out pat)) return ((TextPattern)pat).DocumentRange.GetText(200000) ?? "";
            }
            catch { }
            return null;
        }

        /// Teclea el texto y comprueba, si el control es legible, que quedó escrito. Si no quedó y el control permite
        /// restaurar su valor anterior (ValuePattern editable), lo restaura y teclea una vez más; si sigue sin quedar,
        /// falla con un mensaje claro en lugar de dejar el texto alterado sin avisar.
        static void TeclearVerificado(string idApp, AutomationElement d, string t)
        {
            for (int intento = 1; ; intento++)
            {
                EsperarInactiva(ProcesoObligatorio(idApp), 3000);
                AsegurarFrontal(idApp);
                if (d != null) { try { d.SetFocus(); } catch { } }
                string antes = ValorLegible(d);
                Win.Unicode(t);
                if (antes == null || t.Length == 0) return; // control no legible: no se puede verificar
                string despues = null;
                var limite = DateTime.Now.AddMilliseconds(1500);
                while (DateTime.Now < limite)
                {
                    Thread.Sleep(150);
                    despues = ValorLegible(d);
                    if (despues != null && Normalizar(despues).Contains(Normalizar(t))) return;
                }
                object pat;
                bool restaurable = d.TryGetCurrentPattern(ValuePattern.Pattern, out pat) && !((ValuePattern)pat).Current.IsReadOnly;
                if (intento == 1 && restaurable)
                {
                    Console.Error.WriteLine("escribir: el texto tecleado no coincide; se restaura el valor anterior y se reintenta");
                    ((ValuePattern)pat).SetValue(antes);
                    Thread.Sleep(300);
                    continue;
                }
                throw new Fallo("El texto no se escribió correctamente en el control (la aplicación no procesó bien las pulsaciones). Revise el contenido y repita el paso.");
            }
        }

        static string Normalizar(string v) { return (v ?? "").Replace("\r\n", "\n").Replace('\r', '\n'); }

        public static void AsegurarFrontal(string id)
        {
            var f = Frontal();
            object b; f.TryGetValue("bundleId", out b);
            if (!string.Equals(Convert.ToString(b), id, StringComparison.OrdinalIgnoreCase))
                throw new Fallo("La interfaz cambió: " + id + " no está al frente; no se envían teclas ni clics a otra aplicación.");
        }

        // ---------- selectores ----------
        public static string Rol(AutomationElement e) { try { var p = e.Current.ControlType.ProgrammaticName; return p.StartsWith("ControlType.") ? p.Substring(12) : p; } catch { return ""; } }
        static ControlType TipoDe(string rol)
        {
            if (string.IsNullOrEmpty(rol)) return null;
            foreach (var f in typeof(ControlType).GetFields(System.Reflection.BindingFlags.Public | System.Reflection.BindingFlags.Static))
            {
                var t = f.GetValue(null) as ControlType;
                if (t != null && (t.ProgrammaticName == "ControlType." + rol || t.ProgrammaticName == rol)) return t;
            }
            return null;
        }
        public static bool EsSeguro(AutomationElement e) { try { return e.Current.IsPassword; } catch { return false; } }

        public static Dictionary<string, object> Describir(AutomationElement e)
        {
            var ruta = new List<object>();
            var w = TreeWalker.ControlViewWalker;
            string ventana = "";
            AutomationElement x = e;
            for (int n = 0; x != null && n < 40; n++)
            {
                var padre = w.GetParent(x);
                if (padre == null || padre == AutomationElement.RootElement) { try { ventana = x.Current.Name; } catch { } break; }
                string r = Rol(x);
                int indice = 0, i = 0;
                for (var h = w.GetFirstChild(padre); h != null && i < 2000; h = w.GetNextSibling(h), i++)
                {
                    if (Automation.Compare(h, x)) break;
                    if (Rol(h) == r) indice++;
                }
                string t = ""; try { t = x.Current.Name ?? ""; } catch { }
                ruta.Insert(0, new Dictionary<string, object> { { "rol", r }, { "indice", indice }, { "titulo", Corto(t, 120) } });
                x = padre;
            }
            var c = e.Current;
            return new Dictionary<string, object> {
                { "rol", Rol(e) }, { "subrol", Corto(c.ClassName ?? "", 60) }, { "titulo", Corto(c.Name ?? "", 200) }, { "identificador", Corto(c.AutomationId ?? "", 200) },
                { "descripcion", Corto(c.HelpText ?? "", 200) }, { "ventana", Corto(ventana, 200) }, { "ruta", ruta } };
        }
        public static string Corto(string s, int n) { return s == null ? "" : s.Length > n ? s.Substring(0, n) : s; }

        public static AutomationElement Resolver(IDictionary<string, object> sel, int pid)
        {
            string rol = Str(sel, "rol"), titulo = Str(sel, "titulo"), id = Str(sel, "identificador"), desc = Str(sel, "descripcion"), ventana = Str(sel, "ventana");
            var ruta = Lista(sel, "ruta");
            var tipo = TipoDe(rol);
            var vs = Ventanas(pid);
            if (!string.IsNullOrEmpty(ventana)) { var v = vs.Find(x => { try { return x.Current.Name == ventana; } catch { return false; } }); if (v != null) { vs.Remove(v); vs.Insert(0, v); } }
            foreach (var v in vs)
            {
                AutomationElement r = null;
                if (id != "") r = v.FindFirst(TreeScope.Subtree, new PropertyCondition(AutomationElement.AutomationIdProperty, id));
                if (r == null && (titulo != "" || desc != ""))
                {
                    Condition c = titulo != "" ? (Condition)new PropertyCondition(AutomationElement.NameProperty, titulo) : new PropertyCondition(AutomationElement.HelpTextProperty, desc);
                    if (tipo != null) c = new AndCondition(c, new PropertyCondition(AutomationElement.ControlTypeProperty, tipo));
                    r = v.FindFirst(TreeScope.Subtree, c);
                }
                if (r == null && ruta.Count > 0)
                {
                    var w = TreeWalker.ControlViewWalker; AutomationElement actual = v;
                    foreach (var o in ruta)
                    {
                        var p = o as IDictionary<string, object>; if (actual == null || p == null) { actual = null; break; }
                        string pr = Str(p, "rol"), pt = Str(p, "titulo"); int pi = (int)Num(p, "indice", 0), k = 0;
                        AutomationElement elegido = null, porTitulo = null;
                        for (var h = w.GetFirstChild(actual); h != null && k < 3000; h = w.GetNextSibling(h))
                        {
                            if (Rol(h) != pr) continue;
                            if (pt != "") { try { if (h.Current.Name == pt) { porTitulo = h; break; } } catch { } }
                            if (k == pi) elegido = h;
                            k++;
                        }
                        actual = porTitulo ?? elegido;
                    }
                    if (actual != null && (rol == "" || Rol(actual) == rol)) r = actual;
                }
                if (r == null && id == "" && titulo == "" && desc == "" && ruta.Count == 0 && tipo != null)
                    r = v.FindFirst(TreeScope.Subtree, new PropertyCondition(AutomationElement.ControlTypeProperty, tipo));
                if (r != null) return r;
            }
            return null;
        }

        public static AutomationElement Esperar(string idApp, IDictionary<string, object> sel, int timeoutMs)
        {
            if (sel == null || (Str(sel, "rol") == "" && Str(sel, "titulo") == "" && Str(sel, "identificador") == "" && Str(sel, "descripcion") == "" && Lista(sel, "ruta").Count == 0))
                throw new Fallo("El paso no indica qué control buscar.");
            var limite = DateTime.Now.AddMilliseconds(Math.Max(200, timeoutMs));
            do
            {
                var p = ProcesoObligatorio(idApp);
                AutomationElement e = null;
                try { e = Resolver(sel, p.Id); } catch (ElementNotAvailableException) { }
                if (e != null) return e;
                Thread.Sleep(150);
            } while (DateTime.Now < limite);
            string nombre = Str(sel, "titulo") != "" ? Str(sel, "titulo") : Str(sel, "descripcion") != "" ? Str(sel, "descripcion") : Str(sel, "identificador") != "" ? Str(sel, "identificador") : Str(sel, "rol");
            throw new Fallo("La interfaz cambió: no se encontró «" + nombre + "» en la aplicación.");
        }

        public static string Leer(AutomationElement e)
        {
            object pat;
            if (e.TryGetCurrentPattern(ValuePattern.Pattern, out pat)) return ((ValuePattern)pat).Current.Value ?? "";
            if (e.TryGetCurrentPattern(TextPattern.Pattern, out pat)) return ((TextPattern)pat).DocumentRange.GetText(20000) ?? "";
            return e.Current.Name ?? "";
        }

        /// Ejecuta una acción de UIA que puede quedar bloqueada mientras la app muestra un cuadro modal (problema
        /// conocido de InvokePattern): se espera hasta 3 s y se da por enviada.
        static void ConLimite(Action a)
        {
            Exception error = null;
            var t = new Thread(() => { try { a(); } catch (Exception e) { error = e; } }) { IsBackground = true };
            t.Start();
            if (t.Join(3000) && error != null) throw new Fallo("El control no aceptó la acción: " + error.Message);
        }

        public static void Pulsar(string idApp, AutomationElement e)
        {
            object pat;
            if (e.TryGetCurrentPattern(InvokePattern.Pattern, out pat)) { var ip = (InvokePattern)pat; ConLimite(() => ip.Invoke()); return; }
            if (e.TryGetCurrentPattern(TogglePattern.Pattern, out pat)) { ((TogglePattern)pat).Toggle(); return; }
            if (e.TryGetCurrentPattern(SelectionItemPattern.Pattern, out pat)) { ((SelectionItemPattern)pat).Select(); return; }
            if (e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out pat)) { ((ExpandCollapsePattern)pat).Expand(); return; }
            var r = e.Current.BoundingRectangle;
            if (r.IsEmpty) throw new Fallo("El control no se puede pulsar.");
            AsegurarFrontal(idApp);
            Win.Clic((int)(r.Left + r.Width / 2), (int)(r.Top + r.Height / 2), false, false);
        }

        static readonly Dictionary<string, ushort> TECLAS = new Dictionary<string, ushort> {
            { "return", 0x0D }, { "enter", 0x0D }, { "tab", 0x09 }, { "space", 0x20 }, { "escape", 0x1B }, { "esc", 0x1B }, { "delete", 0x2E }, { "backspace", 0x08 },
            { "up", 0x26 }, { "down", 0x28 }, { "left", 0x25 }, { "right", 0x27 }, { "home", 0x24 }, { "end", 0x23 }, { "pageup", 0x21 }, { "pagedown", 0x22 } };
        public static readonly Dictionary<int, string> NOMBRES = new Dictionary<int, string> {
            { 0x0D, "return" }, { 0x09, "tab" }, { 0x20, "space" }, { 0x1B, "escape" }, { 0x2E, "delete" }, { 0x08, "backspace" }, { 0x26, "up" }, { 0x28, "down" },
            { 0x25, "left" }, { 0x27, "right" }, { 0x24, "home" }, { 0x23, "end" }, { 0x21, "pageup" }, { 0x22, "pagedown" } };

        public static void Combinacion(string combo)
        {
            var mods = new List<ushort>(); ushort? tecla = null;
            foreach (var parte in combo.ToLowerInvariant().Split('+'))
            {
                switch (parte)
                {
                    case "cmd": case "command": case "ctrl": case "control": mods.Add(Win.VK_CONTROL); break; // ⌘ de macOS equivale a Ctrl en Windows
                    case "alt": case "option": mods.Add(Win.VK_MENU); break;
                    case "shift": mods.Add(Win.VK_SHIFT); break;
                    case "win": case "fn": mods.Add(Win.VK_LWIN); break;
                    default:
                        ushort vk;
                        if (TECLAS.TryGetValue(parte, out vk)) tecla = vk;
                        else if (parte.Length > 1 && parte[0] == 'f') { int n; if (int.TryParse(parte.Substring(1), out n) && n >= 1 && n <= 24) tecla = (ushort)(0x6F + n); }
                        else if (parte.Length == 1) { short s = Win.VkKeyScan(parte[0]); if (s != -1) tecla = (ushort)(s & 0xFF); }
                        break;
                }
            }
            if (tecla == null) throw new Fallo("Combinación de teclas no reconocida: " + combo);
            var ev = new List<KeyValuePair<ushort, bool>>();
            foreach (var m in mods) ev.Add(new KeyValuePair<ushort, bool>(m, true));
            ev.Add(new KeyValuePair<ushort, bool>(tecla.Value, true)); ev.Add(new KeyValuePair<ushort, bool>(tecla.Value, false));
            for (int i = mods.Count - 1; i >= 0; i--) ev.Add(new KeyValuePair<ushort, bool>(mods[i], false));
            Win.Teclas(ev);
        }

        static AutomationElement BuscarMenu(int pid, string nombre, AutomationElement dentro)
        {
            var c = new AndCondition(new PropertyCondition(AutomationElement.NameProperty, nombre),
                new OrCondition(new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.MenuItem), new PropertyCondition(AutomationElement.ControlTypeProperty, ControlType.Button)));
            if (dentro != null) { var r = dentro.FindFirst(TreeScope.Descendants, c); if (r != null) return r; }
            foreach (var v in Ventanas(pid)) { var r = v.FindFirst(TreeScope.Descendants, c); if (r != null) return r; }
            // los submenús emergentes son ventanas de nivel superior del mismo proceso o del escritorio
            var m = AutomationElement.RootElement.FindFirst(TreeScope.Descendants, new AndCondition(c, new PropertyCondition(AutomationElement.ProcessIdProperty, pid)));
            return m;
        }

        public static void Menu(string idApp, List<object> ruta, int timeoutMs)
        {
            if (ruta.Count == 0) throw new Fallo("Ruta de menú vacía.");
            var p = ProcesoObligatorio(idApp);
            AutomationElement actual = null;
            for (int i = 0; i < ruta.Count; i++)
            {
                string nombre = Convert.ToString(ruta[i]);
                AutomationElement e = null; var limite = DateTime.Now.AddMilliseconds(timeoutMs);
                while (e == null && DateTime.Now < limite) { e = BuscarMenu(p.Id, nombre, null); if (e == null) Thread.Sleep(150); }
                if (e == null) throw new Fallo("La interfaz cambió: no existe el menú «" + nombre + "».");
                object pat;
                if (i < ruta.Count - 1 && e.TryGetCurrentPattern(ExpandCollapsePattern.Pattern, out pat)) { ((ExpandCollapsePattern)pat).Expand(); Thread.Sleep(250); }
                else Pulsar(idApp, e);
                actual = e;
            }
        }

        public static object Ejecutar(string cmd, IDictionary<string, object> a)
        {
            string b = Str(a, "bundleId");
            int timeout = (int)Num(a, "timeoutMs", 8000);
            switch (cmd)
            {
                case "version": return VERSION;
                case "permisos":
                    // Windows no exige permisos de privacidad para UI Automation ni SendInput. La única barrera es
                    // UIPI: una app que se ejecuta como administrador no acepta órdenes de un proceso sin elevar.
                    return new Dictionary<string, object> { { "accesibilidad", true }, { "monitorEntrada", true }, { "elevado", Win.Elevado() }, { "version", VERSION } };
                case "pedir-monitor": return true;
                case "apps":
                    var apps = new List<object>(); var vistos = new HashSet<string>();
                    foreach (var p in Process.GetProcesses())
                    {
                        try { if (p.MainWindowHandle == IntPtr.Zero || Win.Titulo(p.MainWindowHandle) == "") continue; } catch { continue; }
                        string id = IdProceso(p); if (id == "" || !vistos.Add(id)) continue;
                        apps.Add(new Dictionary<string, object> { { "bundleId", id }, { "nombre", Win.Titulo(p.MainWindowHandle) + " (" + p.ProcessName + ")" }, { "pid", p.Id } });
                    }
                    return apps;
                case "frontal": return Frontal();
                case "activar": Activar(b); return true;
                case "abrir": Abrir(b, Str(a, "ruta")); return true;
                case "buscar": return Describir(Esperar(b, Dic(a, "elemento"), timeout));
                case "foco":
                    {
                        var p = ProcesoObligatorio(b); var f = AutomationElement.FocusedElement;
                        if (f == null || f.Current.ProcessId != p.Id) throw new Fallo("Ningún control de la aplicación tiene el foco.");
                        return Describir(f);
                    }
                case "leer":
                    {
                        // sin selector: se lee el control que tiene el foco en la aplicación
                        var sl = Dic(a, "elemento");
                        bool vacio = sl == null || (Str(sl, "rol") == "" && Str(sl, "titulo") == "" && Str(sl, "identificador") == "" && Str(sl, "descripcion") == "" && Lista(sl, "ruta").Count == 0);
                        AutomationElement e;
                        if (vacio) { var p = ProcesoObligatorio(b); e = AutomationElement.FocusedElement; if (e == null || e.Current.ProcessId != p.Id) throw new Fallo("Ningún control de la aplicación tiene el foco."); }
                        else e = Esperar(b, sl, timeout);
                        if (EsSeguro(e)) throw new Fallo("No se leen campos de contraseña.");
                        return new Dictionary<string, object> { { "valor", Corto(Leer(e), 20000) } };
                    }
                case "pulsar": Pulsar(b, Esperar(b, Dic(a, "elemento"), timeout)); return true;
                case "escribir":
                    {
                        string t = Str(a, "texto"), modo = Str(a, "modo") == "" ? "valor" : Str(a, "modo");
                        var sel = Dic(a, "elemento");
                        AutomationElement d = null;
                        bool conSelector = sel != null && (Str(sel, "rol") != "" || Str(sel, "titulo") != "" || Str(sel, "identificador") != "" || Lista(sel, "ruta").Count > 0);
                        if (conSelector) d = Esperar(b, sel, timeout);
                        else { var p = ProcesoObligatorio(b); var f = AutomationElement.FocusedElement; if (f != null && f.Current.ProcessId == p.Id) d = f; }
                        if (d != null && EsSeguro(d)) throw new Fallo("SIAF no escribe en campos de contraseña. Hágalo manualmente.");
                        object pat;
                        if (modo == "valor" && d != null && d.TryGetCurrentPattern(ValuePattern.Pattern, out pat) && !((ValuePattern)pat).Current.IsReadOnly) { ((ValuePattern)pat).SetValue(t); return true; }
                        TeclearVerificado(b, d, t);
                        return true;
                    }
                case "teclas": AsegurarFrontal(b); Combinacion(Str(a, "combinacion")); return true;
                case "menu": Menu(b, Lista(a, "ruta"), timeout); return true;
                case "clicRelativo":
                    {
                        AsegurarFrontal(b);
                        var p = ProcesoObligatorio(b); Win.RECT r;
                        if (!Win.GetWindowRect(Win.GetForegroundWindow(), out r)) throw new Fallo("No hay una ventana visible para el clic por posición.");
                        double x = Num(a, "x", 0.5), y = Num(a, "y", 0.5);
                        Win.Clic((int)(r.Left + x * (r.Right - r.Left)), (int)(r.Top + y * (r.Bottom - r.Top)), Str(a, "boton") == "derecho", Bool(a, "dobles"));
                        return true;
                    }
                case "grabar":
                    var lista = new List<string>(); foreach (var o in Lista(a, "apps")) lista.Add(Convert.ToString(o).ToLowerInvariant());
                    Grabador.Iniciar(lista, Bool(a, "teclado")); return true;
                case "grabar-detener": Grabador.Detener(); return true;
                default: throw new Fallo("Comando desconocido: " + cmd);
            }
        }

        static void Atender(string linea)
        {
            Dictionary<string, object> m;
            try { m = Json.Deserialize<Dictionary<string, object>>(linea); } catch { return; }
            if (m == null || !m.ContainsKey("id") || !m.ContainsKey("cmd")) return;
            object id = m["id"];
            try { Enviar(new Dictionary<string, object> { { "id", id }, { "ok", true }, { "resultado", Ejecutar(Convert.ToString(m["cmd"]), Dic(m, "args") ?? new Dictionary<string, object>()) } }); }
            catch (Fallo f) { Enviar(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", f.Message } }); }
            catch (ElementNotAvailableException) { Enviar(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", "La interfaz cambió: el control dejó de existir." } }); }
            catch (Exception e) { Enviar(new Dictionary<string, object> { { "id", id }, { "ok", false }, { "error", e.Message } }); }
        }

        [MTAThread]
        static int Main(string[] args)
        {
            try { if (!Win.SetProcessDpiAwarenessContext(new IntPtr(-4))) Win.SetProcessDPIAware(); } catch { try { Win.SetProcessDPIAware(); } catch { } }
            Console.OutputEncoding = new UTF8Encoding(false);
            if (args.Length > 0 && args[0] != "serve")
            {
                try { var r = Ejecutar(args[0], new Dictionary<string, object>()); Console.WriteLine(r is string ? (string)r : Json.Serialize(r)); return 0; }
                catch (Exception e) { Console.Error.WriteLine(e.Message); return 1; }
            }
            var entrada = new StreamReader(Console.OpenStandardInput(), new UTF8Encoding(false));
            string l;
            while ((l = entrada.ReadLine()) != null) Atender(l);
            Grabador.Detener(); // SIAF cerró la tubería: se termina cualquier grabación
            return 0;
        }
    }

    /// Grabación con hooks de bajo nivel en modo solo lectura. Los callbacks solo encolan; el análisis con UI
    /// Automation se hace en otro hilo (Windows retira los hooks que tardan).
    static class Grabador
    {
        static Thread hiloHook, hiloTrabajo;
        static uint idHilo;
        static IntPtr hRaton = IntPtr.Zero, hTeclado = IntPtr.Zero;
        static Win.HookProc procRaton, procTeclado; // referencias vivas: evita que el recolector libere los delegados
        static readonly Queue<object[]> cola = new Queue<object[]>();
        static volatile bool activo;
        static HashSet<string> apps = new HashSet<string>();
        static bool teclado, avisoSeguro;
        static DateTime ultimoEscape = DateTime.MinValue;

        public static void Iniciar(List<string> lista, bool conTeclado)
        {
            Detener();
            apps = new HashSet<string>(lista); teclado = conTeclado; avisoSeguro = false; activo = true;
            var listo = new ManualResetEvent(false); string error = null;
            hiloHook = new Thread(() =>
            {
                idHilo = Win.GetCurrentThreadId();
                procRaton = Raton; procTeclado = Teclado;
                IntPtr mod = Win.GetModuleHandle(null);
                hRaton = Win.SetWindowsHookEx(Win.WH_MOUSE_LL, procRaton, mod, 0);
                if (conTeclado) hTeclado = Win.SetWindowsHookEx(Win.WH_KEYBOARD_LL, procTeclado, mod, 0);
                if (hRaton == IntPtr.Zero || (conTeclado && hTeclado == IntPtr.Zero)) error = "Windows no permitió instalar la escucha de ratón/teclado (código " + Marshal.GetLastWin32Error() + ").";
                listo.Set();
                Win.MSG msg;
                while (error == null && Win.GetMessage(out msg, IntPtr.Zero, 0, 0) > 0) { }
                if (hRaton != IntPtr.Zero) Win.UnhookWindowsHookEx(hRaton);
                if (hTeclado != IntPtr.Zero) Win.UnhookWindowsHookEx(hTeclado);
                hRaton = hTeclado = IntPtr.Zero;
            }) { IsBackground = true };
            hiloHook.Start();
            listo.WaitOne(5000);
            if (error != null) { activo = false; throw new Fallo(error); }
            hiloTrabajo = new Thread(Procesar) { IsBackground = true };
            hiloTrabajo.Start();
        }

        public static void Detener()
        {
            activo = false;
            if (hiloHook != null && idHilo != 0) { Win.PostThreadMessage(idHilo, Win.WM_QUIT, IntPtr.Zero, IntPtr.Zero); hiloHook.Join(2000); }
            hiloHook = null; idHilo = 0;
            lock (cola) { cola.Clear(); Monitor.PulseAll(cola); }
        }

        static void Encolar(object[] e) { lock (cola) { cola.Enqueue(e); Monitor.Pulse(cola); } }

        static IntPtr Raton(int code, IntPtr w, IntPtr l)
        {
            if (code >= 0 && activo && (w.ToInt32() == Win.WM_LBUTTONDOWN || w.ToInt32() == Win.WM_RBUTTONDOWN))
            {
                var s = (Win.MSLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(Win.MSLLHOOKSTRUCT));
                Encolar(new object[] { "clic", s.pt.X, s.pt.Y, w.ToInt32() == Win.WM_RBUTTONDOWN });
            }
            return Win.CallNextHookEx(IntPtr.Zero, code, w, l);
        }

        static IntPtr Teclado(int code, IntPtr w, IntPtr l)
        {
            if (code >= 0 && activo && (w.ToInt32() == Win.WM_KEYDOWN || w.ToInt32() == Win.WM_SYSKEYDOWN))
            {
                var s = (Win.KBDLLHOOKSTRUCT)Marshal.PtrToStructure(l, typeof(Win.KBDLLHOOKSTRUCT));
                bool ctrl = (Win.GetAsyncKeyState(Win.VK_CONTROL) & 0x8000) != 0, alt = (Win.GetAsyncKeyState(Win.VK_MENU) & 0x8000) != 0;
                bool shift = (Win.GetAsyncKeyState(Win.VK_SHIFT) & 0x8000) != 0, caps = (Win.GetKeyState(Win.VK_CAPITAL) & 1) != 0;
                Encolar(new object[] { "tecla", (int)s.vkCode, (int)s.scanCode, ctrl, alt, shift, caps });
            }
            return Win.CallNextHookEx(IntPtr.Zero, code, w, l);
        }

        static void Emitir(string app, Dictionary<string, object> paso, string ventana)
        {
            paso["contexto"] = new Dictionary<string, object> { { "app", app }, { "ventana", ventana } };
            Programa.Enviar(new Dictionary<string, object> { { "evento", "paso" }, { "datos", new Dictionary<string, object> { { "app", app }, { "paso", paso } } } });
        }

        static void Procesar()
        {
            while (true)
            {
                object[] e;
                lock (cola) { while (cola.Count == 0 && activo) Monitor.Wait(cola, 500); if (!activo) return; e = cola.Dequeue(); }
                try { Analizar(e); } catch { /* el control desapareció o la app no responde: se ignora este evento */ }
            }
        }

        static void Analizar(object[] e)
        {
            if ((string)e[0] == "tecla" && (int)e[1] == Win.VK_ESCAPE)
            {
                if ((DateTime.Now - ultimoEscape).TotalMilliseconds < 500) Programa.Enviar(new Dictionary<string, object> { { "evento", "detener" } });
                ultimoEscape = DateTime.Now;
            }
            var f = Programa.Frontal(); object idObj; f.TryGetValue("bundleId", out idObj);
            string app = Convert.ToString(idObj); object vObj; f.TryGetValue("ventana", out vObj); string ventana = Convert.ToString(vObj);
            if (!apps.Contains(app)) return;
            if ((string)e[0] == "clic")
            {
                int x = (int)e[1], y = (int)e[2]; bool derecho = (bool)e[3];
                var el = AutomationElement.FromPoint(new System.Windows.Point(x, y));
                if (el == null) return;
                if (Programa.EsSeguro(el)) { Emitir(app, new Dictionary<string, object> { { "tipo", "campoSensible" }, { "nota", "Campo de contraseña: escríbalo manualmente." } }, ventana); return; }
                string rol = Programa.Rol(el);
                if (rol == "MenuItem")
                {
                    var ruta = new List<object>(); var w = TreeWalker.ControlViewWalker; AutomationElement m = el;
                    for (int n = 0; m != null && n < 8; n++, m = w.GetParent(m)) { string r = Programa.Rol(m); if (r == "MenuItem") { string t = m.Current.Name; if (!string.IsNullOrEmpty(t)) ruta.Insert(0, t); } else if (r == "MenuBar" || r == "Window") break; }
                    Emitir(app, new Dictionary<string, object> { { "tipo", "menu" }, { "ruta", ruta } }, ventana); return;
                }
                var d = Programa.Describir(el);
                bool identificable = (string)d["titulo"] != "" || (string)d["identificador"] != "" || (string)d["descripcion"] != "";
                object pat;
                if (identificable || el.TryGetCurrentPattern(InvokePattern.Pattern, out pat)) { Emitir(app, new Dictionary<string, object> { { "tipo", "pulsar" }, { "elemento", d } }, ventana); return; }
                Win.RECT r2;
                if (Win.GetWindowRect(Win.GetForegroundWindow(), out r2) && r2.Right > r2.Left && r2.Bottom > r2.Top)
                    Emitir(app, new Dictionary<string, object> { { "tipo", "clicRelativo" }, { "x", (x - r2.Left) / (double)(r2.Right - r2.Left) }, { "y", (y - r2.Top) / (double)(r2.Bottom - r2.Top) }, { "boton", derecho ? "derecho" : "izquierdo" } }, ventana);
                return;
            }
            if (!teclado) return;
            var foco = AutomationElement.FocusedElement;
            if (foco != null && Programa.EsSeguro(foco))
            {
                if (!avisoSeguro) { avisoSeguro = true; Emitir(app, new Dictionary<string, object> { { "tipo", "campoSensible" }, { "nota", "Campo de contraseña: escríbalo manualmente." } }, ventana); }
                return;
            }
            int vk = (int)e[1], scan = (int)e[2]; bool ctrl = (bool)e[3], alt = (bool)e[4], shift = (bool)e[5], caps = (bool)e[6];
            if (vk == Win.VK_SHIFT || vk == Win.VK_CONTROL || vk == Win.VK_MENU || (vk >= 0xA0 && vk <= 0xA5) || vk == Win.VK_LWIN || vk == Win.VK_RWIN) return;
            string nombre;
            bool especial = Programa.NOMBRES.TryGetValue(vk, out nombre);
            bool altGr = ctrl && alt; // AltGr produce Ctrl+Alt en Windows: se trata como texto
            if ((ctrl || alt) && !altGr || especial)
            {
                if (!especial)
                {
                    if (vk >= 0x41 && vk <= 0x5A) nombre = ((char)(vk + 32)).ToString();
                    else if (vk >= 0x30 && vk <= 0x39) nombre = ((char)vk).ToString();
                    else if (vk >= 0x70 && vk <= 0x7B) nombre = "f" + (vk - 0x6F);
                    else return;
                }
                var mods = new List<string>(); if (ctrl) mods.Add("ctrl"); if (alt) mods.Add("alt"); if (shift && (ctrl || alt)) mods.Add("shift");
                mods.Add(nombre);
                Emitir(app, new Dictionary<string, object> { { "tipo", "teclas" }, { "combinacion", string.Join("+", mods) } }, ventana);
                return;
            }
            var estado = new byte[256];
            if (shift) estado[Win.VK_SHIFT] = 0x80; if (caps) estado[Win.VK_CAPITAL] = 0x01; if (altGr) { estado[Win.VK_CONTROL] = 0x80; estado[Win.VK_MENU] = 0x80; }
            uint hilo = 0; uint pid; hilo = Win.GetWindowThreadProcessId(Win.GetForegroundWindow(), out pid);
            var sb = new StringBuilder(8);
            int n2 = Win.ToUnicodeEx((uint)vk, (uint)scan, estado, sb, 8, 4, Win.GetKeyboardLayout(hilo)); // 4: no altera el estado de teclas muertas
            if (n2 > 0) { string s = sb.ToString(0, n2); if (s.Trim('\0').Length > 0 && !char.IsControl(s[0])) Emitir(app, new Dictionary<string, object> { { "tipo", "escribirTexto" }, { "texto", s }, { "modo", "teclear" } }, ventana); }
        }
    }
}
