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
