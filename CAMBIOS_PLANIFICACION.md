# Tablero de Planificación: vista por mes + notas de actualización

Se crea un **tablero nuevo** llamado **`Planificacion Mensual`** (el tablero original "Planificacion Kanban" queda intacto) para que:

1. Muestre **una columna por cada día del mes** (más una columna **Pendientes** para proyectos sin fecha).
2. Tenga un **selector de mes/año** arriba del tablero para moverse entre meses.
3. Cada tarjeta (proyecto) tenga una sección de **Notas de actualización** donde se pueden agregar y ver notas con fecha y usuario.

## Sobre la restricción de Frappe (campo Select)

El Kanban de Frappe exige que el campo del tablero (`field_name`) sea de tipo **Select** (sus opciones son las columnas). Por eso el board nuevo usa formalmente el Select existente `custom_planificacion_kanban` como `field_name` para que Frappe lo acepte. Pero la app Vue **detecta este board por su nombre** (`Planificacion Mensual`) y entra en "modo mes": genera las columnas por JavaScript a partir del campo Date `custom_date_planificacion` y, al arrastrar una tarjeta, escribe esa fecha — ignorando el Select. Así se cumple la restricción de Frappe y el comportamiento real es por fechas.

---

## Qué se modificó

### Backend (Python)
- **Nuevo DocType hijo `Nota Planificacion`** (`quick_kanban/quick_kanban/doctype/nota_planificacion/`): campos `fecha`, `usuario`, `nota`.
- **Nuevos campos en Project** (`fixtures/custom_field.json`):
  - `custom_date_planificacion` (Date) — define el día en el tablero.
  - `custom_notas_planificacion` (Table → Nota Planificacion) — guarda las notas.
- **Nuevos métodos en `api.py`**: `get_notas_for_projects`, `get_notas_for_project`, `add_nota`, `delete_nota`.

### Frontend (Vue — carpeta `Quick-Kanban/src/`)
- `utils/store.js`: nuevo "modo planificación" que agrupa las tarjetas por fecha, genera las columnas del mes y maneja el cambio de mes y el alta de notas.
- `components/KanbanBoard/KanbanBoard.vue`: barra superior con selector de mes/año, flechas ‹ › y botón **Hoy**.
- `components/KanbanBoard/KanbanColumn.vue`: al crear un proyecto desde una columna-día, se le asigna esa fecha.
- `components/KanbanBoard/KanbanCard.vue`: sección de notas (ver, agregar, contador) en cada tarjeta.

> El tablero se detecta por su campo `custom_planificacion_kanban`. Los demás tableros (Departamento, Almacén, Job Card) **no cambian**.

---

## Cómo desplegar

Desde la raíz del bench (`frappe-bench-15-version-2`):

```bash
# 1) Compilar el frontend Vue (genera y copia quick_kanban.bundle.js/.css)
cd apps/quick_kanban/Quick-Kanban
yarn install          # solo si faltan dependencias
yarn build            # vite build + copia automática a ../quick_kanban/public/

# 2) Aplicar el DocType nuevo y los campos custom
cd ../../..           # volver a frappe-bench-15-version-2
bench --site TU_SITIO migrate

# 3) Reconstruir assets y limpiar cache
bench build
bench --site TU_SITIO clear-cache
```

Luego abrí el tablero **Planificacion Kanban** y hacé refresco fuerte (Ctrl/Cmd + Shift + R).

> Reemplazá `TU_SITIO` por el nombre real de tu site.

---

## Cómo se usa

- **Elegir mes:** usá el selector de mes y el campo de año, las flechas ‹ › o el botón **Hoy**.
- **Programar un proyecto:** arrastrá la tarjeta a la columna del día deseado → se guarda `custom_date_planificacion` con esa fecha. Arrastrarla a **Pendientes** borra la fecha.
- **Agregar nota:** en la tarjeta, abrí **Notas**, escribí el texto y **Agregar**. Queda registrada con fecha y tu usuario.

---

## Colores / objetivos de la tarjeta

Cada tarjeta del tablero mensual puede tener un color (campo nuevo `custom_color_planificacion`). Las tarjetas con mayor prioridad de color **suben automáticamente al tope de su columna**. El significado y orden de prioridad:

1. 🔴 **Rojo** — Urgente / Bloqueante (siempre arriba)
2. 🟠 **Naranja** — Importante / Atención
3. 🔵 **Azul** — En seguimiento
4. 🟢 **Verde** — Resuelto / OK
5. ⚪ **Gris** — General

Se asigna desde la propia tarjeta con los puntos de color (clic en el color activo lo quita). Dentro de un mismo color, las tarjetas se ordenan por antigüedad.

## Notas: orden, editar y eliminar

- Las notas se muestran de **más nuevas a más viejas**.
- Cada nota tiene botones para **editar** (✎) y **eliminar** (🗑) directo desde el kanban.

## Imagen de portada

Se corrigió el tamaño de `custom_imagen_portada` (ahora ocupa el ancho completo de la tarjeta con alto fijo y recorte proporcional).

## Notas importantes

- Los proyectos que antes usaban el campo de día de semana (Lunes…Sábado) aparecerán en **Pendientes** hasta que les asignes una fecha (arrastrándolos a un día). El cambio de "día de la semana" a "fecha real" es necesario para poder distinguir, por ejemplo, el 15 de junio del 15 de julio.
- Solo se muestran las tarjetas cuya fecha cae dentro del mes seleccionado; las de otros meses aparecen al cambiar de mes.
- El build del bundle Vue debe hacerse en tu máquina/servidor (no se pudo compilar aquí porque el sandbox no tiene acceso a npm ni el binario nativo de rollup para Linux).
