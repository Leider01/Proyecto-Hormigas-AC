# -*- coding: utf-8 -*-
"""Puente entre el backend de los compañeros y la página.

Todo lo que se usa del archivo de ellos está en este módulo. Si cambian el
nombre de una clase, un método o una constante, solo se ajusta aquí.
"""
import importlib.util
import pathlib
import threading

import numpy as np

CARPETA_BACKEND = pathlib.Path(__file__).parent / "backend"
ALTO = 500
ANCHO = 500


def archivo_backend():
    """El .py más reciente de la carpeta backend/."""
    archivos = sorted(CARPETA_BACKEND.glob("*.py"), key=lambda p: p.stat().st_mtime)
    if not archivos:
        raise FileNotFoundError(f"No hay ningún archivo .py en {CARPETA_BACKEND}")
    return archivos[-1]


def cargar_backend(ruta):
    spec = importlib.util.spec_from_file_location("backend_hormigas", ruta)
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


class Simulacion:
    def __init__(self):
        self.ruta = archivo_backend()
        b = self.b = cargar_backend(self.ruta)

        # --- Nombres del backend que usa la página -------------------------
        self.estados = {
            "vacio": b.VACIO, "arena": b.ARENA_SECA, "muro": b.MURO,
            "comida": b.COMIDA, "veneno": b.VENENO, "cadaver": b.CADAVER,
            "nido_n": b.NIDO_N, "reina_n": b.REINA_N, "obrera_n": b.OBRERA_N,
            "soldado_n": b.SOLDADO_N, "nido_r": b.NIDO_R, "reina_r": b.REINA_R,
            "obrera_r": b.OBRERA_R, "soldado_r": b.SOLDADO_R,
            "basurero": b.BASURERO, "depredador": b.DEPREDADOR,
        }
        self.capas = {
            "fisica": b.CAPA_FISICA, "rastro": b.CAPA_RASTRO_COMIDA,
            "alarma": b.CAPA_ALARMA, "real": b.CAPA_FEROMONA_REAL,
            "necro": b.CAPA_NECROFEROMONAS, "reclutamiento": b.CAPA_RECLUTAMIENTO,
        }
        e = self.estados
        # Pincel de la página -> id_pincel de la API Modo Dios
        self.pinceles = {
            "muro": e["muro"], "comida": e["comida"], "veneno": e["veneno"],
            "hormiga-n": e["obrera_n"], "hormiga-r": e["obrera_r"],
            "soldado-n": e["soldado_n"], "soldado-r": e["soldado_r"],
            "depredador": e["depredador"], "arena": e["arena"],
            "cadaver": e["cadaver"], "basurero": e["basurero"],
            "f-rastro": -1, "f-alarma": -2, "f-real": -3, "f-necro": -4,
            "f-reclutamiento": -5,
        }
        self.colonias = {"colonia-n": (e["nido_n"], e["reina_n"]),
                         "colonia-r": (e["nido_r"], e["reina_r"])}

        self.api = b.ModoDios()
        self.motor = b.MotorCuPy(ALTO, ANCHO, api=self.api)
        self.candado = threading.Lock()
        self.version = 0
        self.cuadro = None
        self._fotografiar()

    # --- Llamadas al backend ------------------------------------------------
    def avanzar(self):
        with self.candado:
            self.motor.avanzar_tick()
            self._fotografiar()

    def reiniciar(self):
        with self.candado:
            self.motor.cargar_mapa(np.zeros((ALTO, ANCHO, len(self.capas)), dtype=np.uint8))
            self._fotografiar()

    def pintar(self, pincel, puntos, grosor, aplicar_ya):
        """puntos: lista de (fila, columna). aplicar_ya: con la simulación en pausa."""
        for fila, columna in puntos:
            if pincel == "borrar":
                self.api.borrar_celda(fila, columna, grosor)
            elif pincel in self.colonias:
                nido, reina = self.colonias[pincel]
                if 1 <= fila <= ALTO - 3 and 1 <= columna <= ANCHO - 2:
                    self.api.pintar_celda(fila, columna, nido, 1)
                    self.api.pintar_celda(fila + 1, columna, reina, 1)
            elif pincel in self.pinceles:
                self.api.pintar_celda(fila, columna, self.pinceles[pincel], grosor)
        if aplicar_ya:
            # La cola normalmente se aplica al inicio de avanzar_tick; en pausa
            # se aplica de inmediato con la misma llamada que hace el motor.
            with self.candado:
                m = self.motor
                self.api.procesar_cola_acciones(
                    m.actual, terreno_arena=m.terreno_arena,
                    estado_entidades=(m.carga_comida, m.pasos_con_carga, m.direccion_anterior))
                self._fotografiar()

    def estadisticas(self):
        fisica = self.cuadro[self.capas["fisica"]]
        conteo = np.bincount(fisica.ravel(), minlength=16)
        e = self.estados
        return {
            "tick": int(self.motor.tick),
            "negras": int(conteo[e["obrera_n"]] + conteo[e["soldado_n"]]),
            "rojas": int(conteo[e["obrera_r"]] + conteo[e["soldado_r"]]),
            "colonias": self.motor.estado_colonias(),
        }

    def gpu(self):
        cp = self.motor.xp
        return cp.cuda.runtime.getDeviceProperties(0)["name"].decode()

    # --- Cuadro para la página ----------------------------------------------
    def _fotografiar(self):
        """Copia la matriz de la GPU a la CPU, una capa detrás de otra."""
        matriz = self.motor.snapshot_cpu()
        self.cuadro = np.ascontiguousarray(matriz.transpose(2, 0, 1))
        self.version += 1

    def bytes_capas(self, indices):
        cuadro = self.cuadro
        return b"".join(cuadro[i].tobytes() for i in indices)
