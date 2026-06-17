import frappe


def execute():
    """
    El SLA del tablero Departamento paso de 'dias' a 'tiempo (horas/minutos)'.
    Si el campo viejo 'custom_dias_en_etapa' llego a crearse, se elimina
    (lo reemplaza 'custom_tiempo_en_etapa', tipo Duration).
    """
    if frappe.db.exists("Custom Field", "Project-custom_dias_en_etapa"):
        frappe.delete_doc(
            "Custom Field",
            "Project-custom_dias_en_etapa",
            ignore_permissions=True,
            force=True,
        )
