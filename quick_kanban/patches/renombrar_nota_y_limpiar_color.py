import frappe


def execute():
    """
    Limpieza:
    - Renombra el DocType 'Nota Planificacion' a 'Nota Proyecto' (nombre generico,
      ya que las notas son del proyecto y se muestran en todos los tableros).
      El rename conserva los datos (renombra tambien la tabla).
    - Elimina el campo obsoleto 'custom_color_planificacion' (el color ahora se
      guarda por tablero en el child doctype 'Color Tablero').
    """
    # 1) Renombrar el DocType de notas (solo si existe el viejo y no el nuevo)
    if frappe.db.exists("DocType", "Nota Planificacion") and not frappe.db.exists("DocType", "Nota Proyecto"):
        frappe.rename_doc("DocType", "Nota Planificacion", "Nota Proyecto", force=True)
        frappe.clear_cache(doctype="Nota Proyecto")

    # 2) Quitar el campo de color viejo (reemplazado por la tabla Color Tablero)
    if frappe.db.exists("Custom Field", "Project-custom_color_planificacion"):
        frappe.delete_doc(
            "Custom Field",
            "Project-custom_color_planificacion",
            ignore_permissions=True,
            force=True,
        )

    # 3) Crear el rol para editar colores de las tarjetas (si no existe)
    if not frappe.db.exists("Role", "Editor de Color Kanban"):
        frappe.get_doc({
            "doctype": "Role",
            "role_name": "Editor de Color Kanban",
            "desk_access": 1,
        }).insert(ignore_permissions=True)
