# -*- coding: utf-8 -*-
"""Servidor local: carga el backend, corre los ticks y atiende la página.

Uso:  .venv\\Scripts\\python servidor.py  [--puerto 8000]
"""
import argparse
import json
import pathlib
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

from adaptador import ALTO, ANCHO, Simulacion

CARPETA_WEB = pathlib.Path(__file__).parent / "web"


class Control:
    """Ciclo de vida: play, pausa, reset y DELAY."""

    def __init__(self, sim):
        self.sim = sim
        self.corriendo = False
        self.delay = 0.05
        self.ms_tick = 0.0
        self.despertar = threading.Event()
        threading.Thread(target=self._ciclo, daemon=True).start()

    def _ciclo(self):
        while True:
            if not self.corriendo:
                self.despertar.wait()
                self.despertar.clear()
                continue
            inicio = time.perf_counter()
            self.sim.avanzar()
            self.ms_tick = (time.perf_counter() - inicio) * 1000
            time.sleep(self.delay)

    def play(self):
        self.corriendo = True
        self.despertar.set()

    def pausa(self):
        self.corriendo = False

    def reset(self):
        self.pausa()
        self.sim.reiniciar()


class Manejador(SimpleHTTPRequestHandler):
    sim = None
    control = None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(CARPETA_WEB), **kwargs)

    def log_message(self, *args):
        pass

    def _json(self, datos, codigo=200):
        cuerpo = json.dumps(datos).encode("utf-8")
        self.send_response(codigo)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(cuerpo)))
        self.end_headers()
        self.wfile.write(cuerpo)

    def _leer_json(self):
        largo = int(self.headers.get("Content-Length", 0))
        return json.loads(self.rfile.read(largo) or b"{}")

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/api/config":
            return self._json({
                "alto": ALTO, "ancho": ANCHO, "estados": self.sim.estados,
                "capas": self.sim.capas, "backend": self.sim.ruta.name, "gpu": self.sim.gpu(),
                "delay": self.control.delay,
            })
        if url.path == "/api/estado":
            datos = self.sim.estadisticas()
            datos.update(corriendo=self.control.corriendo, delay=self.control.delay,
                         version=self.sim.version, ms_tick=round(self.control.ms_tick))
            return self._json(datos)
        if url.path == "/api/cuadro":
            q = parse_qs(url.query)
            capas = [int(c) for c in q.get("capas", ["0"])[0].split(",") if c != ""]
            version_cliente = int(q.get("version", ["-1"])[0])
            version = self.sim.version
            if version == version_cliente:
                self.send_response(204)
                self.end_headers()
                return
            cuerpo = self.sim.bytes_capas(capas)
            self.send_response(200)
            self.send_header("Content-Type", "application/octet-stream")
            self.send_header("Content-Length", str(len(cuerpo)))
            self.send_header("X-Version", str(version))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(cuerpo)
            return
        return super().do_GET()

    def do_POST(self):
        url = urlparse(self.path)
        datos = self._leer_json()
        if url.path == "/api/control":
            accion = datos.get("accion")
            if accion == "play":
                self.control.play()
            elif accion == "pausa":
                self.control.pausa()
            elif accion == "reset":
                self.control.reset()
            elif accion == "delay":
                self.control.delay = max(0.0, min(0.5, float(datos.get("valor", 0.05))))
            return self._json({"ok": True})
        if url.path == "/api/pincel":
            puntos = [(int(f), int(c)) for f, c in datos.get("puntos", [])]
            self.sim.pintar(datos.get("pincel"), puntos, int(datos.get("grosor", 1)),
                            aplicar_ya=not self.control.corriendo)
            return self._json({"ok": True})
        self._json({"error": "ruta desconocida"}, 404)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--puerto", type=int, default=8000)
    args = parser.parse_args()

    print("Cargando el backend (tarda unos segundos)...", flush=True)
    sim = Simulacion()
    print(f"Backend: {sim.ruta.name}  |  GPU: {sim.gpu()}", flush=True)
    for _ in range(3):  # CuPy compila sus funciones en los primeros ticks
        sim.avanzar()
    sim.reiniciar()

    Manejador.sim = sim
    Manejador.control = Control(sim)
    servidor = ThreadingHTTPServer(("127.0.0.1", args.puerto), Manejador)
    print(f"Listo: abra http://localhost:{args.puerto}  (Ctrl + C para apagar)", flush=True)
    try:
        servidor.serve_forever()
    except KeyboardInterrupt:
        print("\nApagado.")


if __name__ == "__main__":
    main()
