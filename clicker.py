"""Mi Clicker: juego simple de clics con multiplicador y reinicios (prestige)."""

import tkinter as tk

REQUISITOS = [500, 1000, 2000]


class Clicker:
    def __init__(self, ventana: tk.Tk) -> None:
        self.ventana = ventana
        self.puntos = 0
        self.multiplicador = 1
        self.reinicios = 0

        ventana.title("Mi Clicker")
        ventana.geometry("400x300")
        ventana.resizable(False, False)

        self.etiqueta_puntos = tk.Label(ventana, text="Puntos: 0", font=("Arial", 24))
        self.etiqueta_puntos.pack(pady=20)

        self.etiqueta_multiplicador = tk.Label(
            ventana, text="Multiplicador: x1", font=("Arial", 18)
        )
        self.etiqueta_multiplicador.pack(pady=10)

        self.boton_click = tk.Button(
            ventana, text="¡CLIC!", font=("Arial", 20), command=self.hacer_click
        )
        self.boton_click.pack(pady=10)

        self.boton_reiniciar = tk.Button(
            ventana,
            text=f"Necesitas {REQUISITOS[0]} puntos",
            font=("Arial", 14),
            command=self.reiniciar,
        )
        self.boton_reiniciar.pack(pady=10)

        self.actualizar()

    def hacer_click(self) -> None:
        self.puntos += self.multiplicador
        self.actualizar()

    def reiniciar(self) -> None:
        if self.reinicios >= len(REQUISITOS):
            return

        if self.puntos < REQUISITOS[self.reinicios]:
            return

        self.puntos = 0
        self.reinicios += 1
        # Cada reinicio aumenta el multiplicador en x2
        self.multiplicador = self.reinicios * 2
        self.actualizar()

    def actualizar(self) -> None:
        self.etiqueta_puntos.config(text=f"Puntos: {self.puntos}")
        self.etiqueta_multiplicador.config(
            text=f"Multiplicador: x{self.multiplicador}"
        )

        if self.reinicios < len(REQUISITOS):
            siguiente = REQUISITOS[self.reinicios]
            if self.puntos >= siguiente:
                self.boton_reiniciar.config(
                    text=f"REINICIAR → x{(self.reinicios + 1) * 2}",
                    state="normal",
                )
            else:
                self.boton_reiniciar.config(
                    text=f"Necesitas {siguiente} puntos", state="disabled"
                )
        else:
            self.boton_reiniciar.config(text="¡Completados!", state="disabled")


def main() -> None:
    ventana = tk.Tk()
    Clicker(ventana)
    ventana.mainloop()


if __name__ == "__main__":
    main()
