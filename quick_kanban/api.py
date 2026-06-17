import frappe
import json

@frappe.whitelist()
def get_tags_for_projects(project_names):
    """
    Recibe una lista de nombres de proyectos y devuelve todos los tags de cada proyecto con custom_color.
    """
    if isinstance(project_names, str):
        # convertir JSON string a lista si se envía desde JS
        project_names = json.loads(project_names)

        # Query única para traer todos los tags de los proyectos
        query = """
            SELECT ct.parent AS project_name, t.name AS tag_name, t.custom_color
            FROM `tabCustom Tag` ct
            JOIN `tabTag` t ON t.name = ct.tag
            WHERE ct.parent IN ({placeholders}) AND ct.parenttype = 'Project'
            ORDER BY ct.parent, t.name
        """.format(placeholders=','.join(['%s']*len(project_names)))

    tags = frappe.db.sql(query, project_names, as_dict=True)

    # Agrupar por proyecto
    result = {}
    for row in tags:
        result.setdefault(row['project_name'], []).append({
            'tag_name': row['tag_name'],
            'custom_color': row['custom_color']
        })

    return result

@frappe.whitelist()
def get_tags_for_project(project_name):
    """
    Recibe el nombre de un proyecto y devuelve todos sus tags con custom_color.
    """
    # Consulta a la base de datos
    query = """
        SELECT t.name AS tag_name, t.custom_color
        FROM `tabCustom Tag` ct
        JOIN `tabTag` t ON t.name = ct.tag
        WHERE ct.parent = %s AND ct.parenttype = 'Project'
        ORDER BY t.name
    """

    tags = frappe.db.sql(query, project_name, as_dict=True)

    # Retornar directamente la lista de tags
    return tags


@frappe.whitelist()
def get_colors_for_projects(project_names, board):
    """
    Devuelve {proyecto: color} para un tablero (board) especifico.
    El color es independiente por tablero.
    """
    if isinstance(project_names, str):
        project_names = json.loads(project_names)

    result = {}
    if not project_names or not board:
        return result

    rows = frappe.get_all(
        "Color Tablero",
        filters={
            "parenttype": "Project",
            "parentfield": "custom_colores_tablero",
            "parent": ["in", project_names],
            "tablero": board,
        },
        fields=["parent", "color"],
    )
    for r in rows:
        if r.get("color"):
            result[r["parent"]] = r["color"]
    return result


COLOR_ROLE = "Editor de Color Kanban"


def _user_can_edit_color(user=None):
    """
    True solo si el rol 'Editor de Color Kanban' esta ASIGNADO EXPLICITAMENTE
    al usuario. Se usa 'Has Role' (no frappe.get_roles) para que el Administrator
    no quede habilitado de forma implicita.
    """
    user = user or frappe.session.user
    return bool(frappe.db.exists("Has Role", {
        "parenttype": "User",
        "parent": user,
        "role": COLOR_ROLE,
    }))


@frappe.whitelist()
def can_edit_color():
    """Devuelve si el usuario actual puede editar colores (rol asignado explicitamente)."""
    return _user_can_edit_color()


def _colores_map(d):
    out = {}
    if not d:
        return out
    for r in (d.get("custom_colores_tablero") or []):
        out[r.tablero] = (r.color or "")
    return out


def protect_colores_tablero(doc, method=None):
    """
    Hook validate en Project: impide modificar la tabla de colores (custom_colores_tablero)
    a quien no tenga el rol 'Editor de Color Kanban'. Se compara solo esa tabla, asi
    otros cambios del proyecto (notas, etc.) siguen permitidos.
    """
    if _user_can_edit_color():
        return

    old = doc.get_doc_before_save()
    if old is None and not doc.is_new():
        try:
            old = frappe.get_doc("Project", doc.name)
        except Exception:
            old = None

    if _colores_map(doc) != _colores_map(old):
        frappe.throw(
            "No tienes permiso para cambiar el color de las tarjetas.",
            frappe.PermissionError,
        )


@frappe.whitelist()
def set_card_color(project_name, board, color):
    """
    Asigna el color de una tarjeta para un tablero especifico (upsert por tablero).
    Solo permitido a usuarios con el rol 'Editor de Color Kanban' asignado.
    """
    if not _user_can_edit_color():
        frappe.throw(
            "No tienes permiso para cambiar el color de las tarjetas.",
            frappe.PermissionError,
        )

    doc = frappe.get_doc("Project", project_name)
    fila = None
    for r in (doc.custom_colores_tablero or []):
        if r.tablero == board:
            fila = r
            break

    if fila:
        fila.color = color or ""
    else:
        doc.append("custom_colores_tablero", {"tablero": board, "color": color or ""})

    doc.save()
    frappe.db.commit()
    return {"project": project_name, "board": board, "color": color or ""}


@frappe.whitelist()
def get_projects_with_valid_so(project_names):
    """
    Recibe una lista (JSON) de proyectos y devuelve los que tienen al menos una
    Orden de Venta (Sales Order) VALIDA = enviada (docstatus = 1, no cancelada).
    """
    if isinstance(project_names, str):
        project_names = json.loads(project_names)

    if not project_names:
        return []

    rows = frappe.get_all(
        "Sales Order",
        filters={
            "project": ["in", project_names],
            "docstatus": 1,
        },
        pluck="project",
    )
    # proyectos unicos (sin vacios)
    return list({p for p in rows if p})


# ============================================================
#  NOTAS DEL PROYECTO (Tabla hija en Project, se muestran en todos los tableros)
# ============================================================

@frappe.whitelist()
def get_notas_for_projects(project_names):
    """
    Recibe una lista (JSON) de nombres de proyectos y devuelve todas las notas
    de planificacion de cada proyecto, agrupadas por proyecto.
    """
    if isinstance(project_names, str):
        project_names = json.loads(project_names)

    result = {}
    if not project_names:
        return result

    rows = frappe.get_all(
        "Nota Proyecto",
        filters={
            "parenttype": "Project",
            "parentfield": "custom_notas_planificacion",
            "parent": ["in", project_names],
        },
        fields=["name", "parent", "nota", "fecha", "usuario"],
        order_by="fecha desc",
    )

    for row in rows:
        result.setdefault(row["parent"], []).append({
            "name": row["name"],
            "nota": row["nota"],
            "fecha": str(row["fecha"]) if row["fecha"] else None,
            "usuario": row["usuario"],
        })

    return result


@frappe.whitelist()
def get_notas_for_project(project_name):
    """Devuelve la lista de notas de planificacion de un proyecto."""
    rows = frappe.get_all(
        "Nota Proyecto",
        filters={
            "parenttype": "Project",
            "parentfield": "custom_notas_planificacion",
            "parent": project_name,
        },
        fields=["name", "nota", "fecha", "usuario"],
        order_by="fecha desc",
    )
    return [{
        "name": r["name"],
        "nota": r["nota"],
        "fecha": str(r["fecha"]) if r["fecha"] else None,
        "usuario": r["usuario"],
    } for r in rows]


@frappe.whitelist()
def add_nota(project_name, nota):
    """
    Agrega una nota de actualizacion a un proyecto y devuelve la lista
    actualizada de notas. Registra fecha y usuario automaticamente.
    """
    nota = (nota or "").strip()
    if not nota:
        frappe.throw("La nota no puede estar vacia")

    usuario = frappe.utils.get_fullname(frappe.session.user) or frappe.session.user

    doc = frappe.get_doc("Project", project_name)
    doc.append("custom_notas_planificacion", {
        "nota": nota,
        "fecha": frappe.utils.now_datetime(),
        "usuario": usuario,
    })
    doc.save()
    frappe.db.commit()

    return get_notas_for_project(project_name)


@frappe.whitelist()
def update_nota(project_name, row_name, nota):
    """Edita el texto de una nota existente."""
    nota = (nota or "").strip()
    if not nota:
        frappe.throw("La nota no puede estar vacia")

    usuario = frappe.utils.get_fullname(frappe.session.user) or frappe.session.user

    doc = frappe.get_doc("Project", project_name)
    for r in (doc.custom_notas_planificacion or []):
        if r.name == row_name:
            r.nota = nota
            r.fecha = frappe.utils.now_datetime()  # refresca la fecha al editar
            r.usuario = usuario
            break
    doc.save()
    frappe.db.commit()
    return get_notas_for_project(project_name)


@frappe.whitelist()
def delete_nota(project_name, row_name):
    """Elimina una nota especifica de un proyecto."""
    doc = frappe.get_doc("Project", project_name)
    doc.custom_notas_planificacion = [
        r for r in (doc.custom_notas_planificacion or []) if r.name != row_name
    ]
    doc.save()
    frappe.db.commit()
    return get_notas_for_project(project_name)
