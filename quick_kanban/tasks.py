import frappe
from datetime import datetime, timedelta


DEPTO_FIELD = "custom_departamento_kanban"
ENTRADA_FIELD = "custom_fecha_entrada_departamento"
TIEMPO_FIELD = "custom_tiempo_en_etapa"
VENCIDOS_FIELD = "custom_vencidos_kanban"

# weekday() -> nombre del check en la configuracion (Lunes=0 ... Domingo=6)
DIA_CHECK = {
    0: "lunes",
    1: "martes",
    2: "miercoles",
    3: "jueves",
    4: "viernes",
    5: "sabado",
    6: "domingo",
}


def stamp_departamento_entrada(doc, method=None):
    """
    Hook validate en Project: cada vez que cambia la etapa del tablero Departamento
    (custom_departamento_kanban), se registra la fecha/hora de entrada a esa etapa.
    """
    nuevo = doc.get(DEPTO_FIELD)

    if doc.is_new():
        if nuevo and not doc.get(ENTRADA_FIELD):
            doc.set(ENTRADA_FIELD, frappe.utils.now_datetime())
        return

    old = doc.get_doc_before_save()
    if old is not None:
        viejo = old.get(DEPTO_FIELD)
    else:
        viejo = frappe.db.get_value("Project", doc.name, DEPTO_FIELD)

    if nuevo != viejo:
        doc.set(ENTRADA_FIELD, frappe.utils.now_datetime())


def _dias_activos(cfg):
    return {i for i, fn in DIA_CHECK.items() if cfg.get(fn)}


def _feriados(cfg):
    if not cfg.get("lista_feriados"):
        return set()
    rows = frappe.get_all(
        "Holiday",
        filters={"parent": cfg.lista_feriados},
        fields=["holiday_date"],
    )
    return {frappe.utils.getdate(r.holiday_date) for r in rows if r.holiday_date}


def _overlap_seg(a_start, a_end, b_start, b_end):
    """Segundos de solape entre dos intervalos."""
    s = max(a_start, b_start)
    e = min(a_end, b_end)
    return (e - s).total_seconds() if e > s else 0.0


def _segundos_laborables(start_dt, end_dt, work_start, work_end, dias_activos, feriados,
                         lunch_start=None, lunch_end=None):
    """
    Segundos laborables entre dos fechas, contando solo los dias activos
    (no fines de semana / feriados), solo dentro del horario [work_start, work_end]
    y descontando el almuerzo [lunch_start, lunch_end] si se indica.
    """
    if not start_dt or not end_dt or end_dt <= start_dt:
        return 0.0
    if not dias_activos or not work_start or not work_end or work_end <= work_start:
        return 0.0

    total = 0.0
    d = start_dt.date()
    last = end_dt.date()
    while d <= last:
        if d.weekday() in dias_activos and d not in feriados:
            ws = datetime.combine(d, work_start)
            we = datetime.combine(d, work_end)
            seg_start = max(ws, start_dt)
            seg_end = min(we, end_dt)
            if seg_end > seg_start:
                trabajado = (seg_end - seg_start).total_seconds()
                # descontar el solape con el horario de almuerzo
                if lunch_start and lunch_end:
                    ls = datetime.combine(d, lunch_start)
                    le = datetime.combine(d, lunch_end)
                    trabajado -= _overlap_seg(seg_start, seg_end, ls, le)
                if trabajado > 0:
                    total += trabajado
        d += timedelta(days=1)
    return total


def reiniciar_entrada_departamento():
    """
    Correccion de una sola vez: re-sella la 'Fecha Entrada Departamento' de TODOS
    los proyectos que estan en el tablero Departamento, usando su ultima fecha de
    modificacion (modified). Sirve para corregir los valores de arranque que la
    version anterior habia inicializado con la hora en que corria la tarea.
    Ejecutar manualmente una vez:
        bench --site TU_SITIO execute quick_kanban.tasks.reiniciar_entrada_departamento
    """
    proyectos = frappe.get_all(
        "Project",
        filters={DEPTO_FIELD: ["is", "set"]},
        fields=["name", "modified"],
    )
    for p in proyectos:
        frappe.db.set_value(
            "Project", p["name"], ENTRADA_FIELD,
            frappe.utils.get_datetime(p.get("modified")),
            update_modified=False,
        )
    frappe.db.commit()
    # recalcula tiempos y vencidos con las fechas corregidas
    marcar_vencidos_departamento()


def marcar_vencidos_departamento():
    """
    Tarea programada: revisa los proyectos del tablero Departamento y, segun los
    tiempos maximos configurados por etapa (en horas/minutos laborables), marca como
    'vencidos' los que se pasaron del limite. Cuenta solo horas laborables, dias
    activos y excluye feriados (todo configurable en 'Configuracion SLA Departamento').
    """
    cfg = frappe.get_single("Configuracion SLA Departamento")
    if not cfg or not cfg.activo:
        return

    # tiempo_max esta en SEGUNDOS (campo Duration)
    limites = {r.etapa: (r.tiempo_max or 0) for r in (cfg.etapas or []) if r.etapa}
    if not limites:
        return

    work_start = frappe.utils.get_time(cfg.hora_inicio) if cfg.hora_inicio else None
    work_end = frappe.utils.get_time(cfg.hora_fin) if cfg.hora_fin else None
    dias_activos = _dias_activos(cfg)
    feriados = _feriados(cfg)

    lunch_start = lunch_end = None
    if cfg.get("tiene_almuerzo") and cfg.get("almuerzo_inicio") and cfg.get("almuerzo_fin"):
        lunch_start = frappe.utils.get_time(cfg.almuerzo_inicio)
        lunch_end = frappe.utils.get_time(cfg.almuerzo_fin)

    ahora = frappe.utils.now_datetime()

    proyectos = frappe.get_all(
        "Project",
        filters={DEPTO_FIELD: ["in", list(limites.keys())]},
        fields=["name", DEPTO_FIELD, ENTRADA_FIELD, "modified"],
    )

    for p in proyectos:
        etapa = p.get(DEPTO_FIELD)
        limite = limites.get(etapa, 0)
        entrada = p.get(ENTRADA_FIELD)

        if not entrada:
            # Proyectos previos (sin fecha de entrada): se arranca desde la ultima
            # modificacion del proyecto.
            inicial = frappe.utils.get_datetime(p.get("modified")) or ahora
            frappe.db.set_value("Project", p["name"], ENTRADA_FIELD, inicial, update_modified=False)
            entrada_dt = inicial
        else:
            entrada_dt = frappe.utils.get_datetime(entrada)

        transcurrido = _segundos_laborables(
            entrada_dt, ahora,
            work_start, work_end, dias_activos, feriados,
            lunch_start, lunch_end,
        )

        vencido = bool(limite) and transcurrido >= limite
        nuevo_vencidos = etapa if vencido else ""

        frappe.db.set_value(
            "Project",
            p["name"],
            {
                TIEMPO_FIELD: int(transcurrido),
                VENCIDOS_FIELD: nuevo_vencidos,
            },
            update_modified=False,
        )

    frappe.db.commit()
