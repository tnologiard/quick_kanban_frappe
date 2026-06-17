<template>
    <div class="kanban-card drag" :style="featuresOn ? { borderLeft: '6px solid ' + colorCss } : {}">
        <!-- ENCABEZADO: siempre visible (numero de proyecto + nombre) -->
        <div class="card-head drag">
            <a :href="getUrl()" draggable="false" class="card-head-link drag">
                <span class="card-num">{{ card.name }}</span>
                <span class="card-title-min" :title="card[config.title_field]">{{ card[config.title_field] }}</span>
            </a>
            <span
                v-if="featuresOn"
                class="card-toggle"
                title="Mostrar/ocultar detalles"
                @click.stop="toggleExpandido"
                @mousedown.stop
            >{{ expandido ? '▾' : '▸' }}</span>
        </div>

        <!-- DETALLE: se puede ocultar en los tableros de Project -->
        <div v-show="!featuresOn || expandido" class="card-detalle">
        <!-- Imagen de portada -->
        <div>
            <a v-if="getDoctype() === 'project'" :href="getUrl()" draggable="false">
                <img
                    loading="lazy"
                    :src="imgSrc"
                    alt="imagen"
                    @error="onImgError"
                    :style="{
                        width: '100%',
                        height: '130px',
                        objectFit: 'cover',
                        objectPosition: 'center',
                        display: 'block',
                        borderRadius: '6px',
                    }"
                    draggable="false"
                    />

            </a>
            <a v-if="getDoctype() === 'job card'" :href="getUrl()" draggable="false">
                <iframe :src="card.custom_guia_de_trabajo"  width="100%" height="250px"></iframe>
            </a>
        </div>

        <!-- SELECTOR DE COLOR / OBJETIVO -->
        <div v-if="featuresOn" class="card-colores" @mousedown.stop @touchstart.stop>
            <!-- Editable solo con permiso -->
            <template v-if="canEditColor">
                <span
                    v-for="c in COLORES"
                    :key="c.key"
                    class="color-dot"
                    :class="{ active: colorActual === c.key }"
                    :style="{ backgroundColor: c.css }"
                    :title="c.objetivo"
                    @click="elegirColor(c.key)"
                ></span>
            </template>
            <!-- Solo lectura para el resto -->
            <template v-else>
                <span class="color-dot active" :style="{ backgroundColor: colorCss }" :title="objetivoActual"></span>
            </template>
            <span class="color-objetivo">{{ objetivoActual }}</span>
        </div>

        <div class="kanban-title-area pb-3 drag">
            <span v-if="card.custom_proyecto" class="drag" style="font-weight: bold; font-style: italic; color: blue; font-size: 10;">
                PROYECTO: {{ card.custom_proyecto }}
            </span>
            <br v-if="card.production_item">
            <span v-if="card.production_item" class="drag" style="font-weight: bold; font-style: italic; color: red; font-size: 10;">
                {{ card.production_item }}
            </span>
            <br v-if="card.custom_nombre_vendedor">
            <span v-if="card.custom_nombre_vendedor" class="drag" style="font-weight: bold; font-style: italic; color: red;">
                Vendedor: {{ card.custom_nombre_vendedor }}
            </span>
            <br v-if="card.custom_nombre_diseñador">
            <span v-if="card.custom_nombre_diseñador" class="drag" style="font-weight: bold; font-style: italic; color: blue; font-size: 10;">
                Diseñador: {{ card.custom_nombre_diseñador }}
            </span>
            <br v-if="card.project">
            <span v-if="card.project" class="drag">
                {{ card.project }}
            </span>
            <br v-if="card.project_type">
            <span v-if="card.project_type" class="drag">
                {{ card.project_type }}
            </span>
            <br v-if="card.item_name">
            <span v-if="card.item_name" class="drag">
                {{ card.item_name }}
            </span>
        </div>
         <div class="kanban-tags" :style="{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }">
            <span v-for="tag in card.tags" :key="tag.tag_name"
                :style="{
                backgroundColor: tag.custom_color,
                padding: '2px 8px',
                borderRadius: '999px',
                fontSize: '0.75rem',
                fontWeight: 500,
                color: '#fff',
                lineHeight: 1,
                marginRight: '3px',
                whiteSpace: 'nowrap'
                }">
                {{ tag.tag_name }}
            </span>
        </div>

        <!-- NOTAS DE ACTUALIZACION (solo en el tablero de Planificacion Mensual) -->
        <div v-if="notesOn" class="kanban-notas" @mousedown.stop @touchstart.stop>
            <div class="notas-header" @click="mostrarNotas = !mostrarNotas">
                Notas ({{ (card.notas && card.notas.length) || 0 }})
                <span class="notas-toggle">{{ mostrarNotas ? '▾' : '▸' }}</span>
            </div>
            <div v-show="mostrarNotas" class="notas-body">
                <div v-for="n in card.notas" :key="n.name" class="nota-item">
                    <div class="nota-meta">
                        <span>{{ formatFecha(n.fecha) }} · {{ n.usuario }}</span>
                        <span class="nota-acciones" v-if="editId !== n.name">
                            <a class="nota-accion" title="Editar" @click="empezarEdicion(n)">✎</a>
                            <a class="nota-accion danger" title="Eliminar" @click="eliminarNota(n)">🗑</a>
                        </span>
                    </div>
                    <div v-if="editId !== n.name" class="nota-text">{{ n.nota }}</div>
                    <div v-else class="nota-edit">
                        <textarea v-model="editTexto" class="nota-input" rows="2"></textarea>
                        <div class="nota-edit-btns">
                            <button class="btn btn-primary btn-xs" :disabled="!editTexto.trim() || guardando" @click="guardarEdicion(n)">Guardar</button>
                            <button class="btn btn-default btn-xs" @click="cancelarEdicion">Cancelar</button>
                        </div>
                    </div>
                </div>
                <div v-if="!card.notas || card.notas.length === 0" class="nota-vacia">
                    Sin notas todavía.
                </div>
                <div class="nota-add">
                    <textarea
                        v-model="nuevaNota"
                        class="nota-input"
                        rows="2"
                        placeholder="Agregar actualización..."
                        @keydown.enter.exact.prevent="agregarNota"
                    ></textarea>
                    <button
                        class="btn btn-primary btn-xs nota-btn"
                        :disabled="!nuevaNota.trim() || guardando"
                        @click="agregarNota"
                    >
                        {{ guardando ? '...' : 'Agregar' }}
                    </button>
                </div>
            </div>
        </div>

        <div v-for="field in config.fields" class="drag">
            <span v-if="field !== card[config.title_field] && field !== config.highlighted_field && !(featuresOn && field === 'name')" class="drag">
                {{ field === 'creation' ? card[field]?.split('.')[0] : card[field] }}
            </span>
        </div>

        <div class="kanban-card-meta drag">
            <span :style="(getHighlight(card[config.highlighted_field]))" class="drag">
                {{ config.fields.includes(config.highlighted_field) ? card[config.highlighted_field] : '' }}
            </span>

            <div class="kanban-assignments d-flex float-right drag">
                <div class="avatar-group float-right overlap">
                    <Assignments :assignments="card._assign" />

                    <span @click="assignTo(card)" class="avatar avatar-small">
                        <div class="avatar-frame avatar-action">
                            <svg class="icon  icon-sm" style="" aria-hidden="true">
                                <use class="" href="#icon-add"></use>
                            </svg>
                        </div>
                    </span>
                </div>
            </div>
        </div>
        </div><!-- /card-detalle -->
    </div>
</template>
<script setup>

import { defineProps, ref, computed } from 'vue';
import { useStore } from 'vuex';
import Assignments from '../Assignments.vue'

const store = useStore();

const props = defineProps({
    card: Object,
    config: Object,
    columnIndex: Number
});

// ---- Imagen de portada (codifica espacios/comas del nombre de archivo) ----
const DEFAULT_IMG = '/files/default_project_image.jpg';
const imgSrc = computed(() => {
    const u = props.card.custom_imagen_portada;
    if (!u) return DEFAULT_IMG;
    try {
        // Si ya viene codificada (tiene %), no la vuelvo a codificar
        return /%[0-9A-Fa-f]{2}/.test(u) ? u : encodeURI(u);
    } catch (e) {
        return u;
    }
});
function onImgError(e) {
    // Si la imagen no carga (archivo movido/privado), muestro la de por defecto
    if (e && e.target && e.target.src && !e.target.src.includes('default_project_image')) {
        e.target.src = DEFAULT_IMG;
    }
}

// ---- Colores / objetivos de la tarjeta (independiente por tablero) ----
const COLORES = [
    { key: 'Rojo', objetivo: 'Urgente / Bloqueante', css: '#e24c4c' },
    { key: 'Naranja', objetivo: 'Importante / Atención', css: '#f5a623' },
    { key: 'Azul', objetivo: 'En seguimiento', css: '#4c84e2' },
    { key: 'Verde', objetivo: 'Resuelto / OK', css: '#28a745' },
    { key: 'Gris', objetivo: 'General', css: '#adb5bd' },
];
// Por defecto, toda tarjeta sin color se considera "Gris" (General)
const colorActual = computed(() => props.card._boardColor || 'Gris');
const colorCss = computed(() => {
    const c = COLORES.find((x) => x.key === colorActual.value);
    return c ? c.css : '#adb5bd';
});
const objetivoActual = computed(() => {
    const c = COLORES.find((x) => x.key === colorActual.value);
    return c ? c.objetivo : 'General';
});
function elegirColor(key) {
    // Toda tarjeta debe tener un color: siempre se asigna el elegido
    if (key === colorActual.value) return;
    store.dispatch('setCardColor', { card: props.card, color: key });
}

const planning = computed(() => store.getters.getPlanning);
// Colores y compactar: en todos los tableros de Project
const featuresOn = computed(() => props.config && props.config.ref_doctype === 'Project');
// Notas: SOLO en el tablero de Planificacion Mensual
const notesOn = computed(() => planning.value.active);
// Color editable solo si el servidor confirma el permiso (rol asignado explicitamente)
const canEditColor = computed(() => store.getters.getCanEditColor);
// Estado desplegado/colapsado por tarjeta y por tablero (persiste en localStorage)
const expandido = computed(() => {
    const board = props.config && props.config.board_name;
    const m = planning.value.expanded[board] || {};
    const ov = m[props.card.name];
    // Excepcion por tarjeta si existe; si no, la preferencia global del tablero.
    // Si no hay preferencia guardada, por defecto EXPANDIDAS.
    if (ov !== undefined) return ov;
    const def = planning.value.expandDefault[board];
    return def === undefined ? true : !!def;
});
function toggleExpandido() {
    store.dispatch('toggleCard', { name: props.card.name });
}
const nuevaNota = ref('');
const mostrarNotas = ref(false);
const guardando = ref(false);
const editId = ref(null);
const editTexto = ref('');

async function agregarNota() {
    const texto = nuevaNota.value.trim();
    if (!texto || guardando.value) return;
    guardando.value = true;
    try {
        const lista = await store.dispatch('addNota', {
            project_name: props.card.name,
            nota: texto,
        });
        props.card.notas = lista;
        nuevaNota.value = '';
        mostrarNotas.value = true;
    } catch (e) {
        console.error('Error agregando nota:', e);
    } finally {
        guardando.value = false;
    }
}

function empezarEdicion(n) {
    editId.value = n.name;
    editTexto.value = n.nota;
    mostrarNotas.value = true;
}
function cancelarEdicion() {
    editId.value = null;
    editTexto.value = '';
}
async function guardarEdicion(n) {
    const texto = editTexto.value.trim();
    if (!texto || guardando.value) return;
    guardando.value = true;
    try {
        const lista = await store.dispatch('updateNota', {
            project_name: props.card.name,
            row_name: n.name,
            nota: texto,
        });
        props.card.notas = lista;
        editId.value = null;
        editTexto.value = '';
    } catch (e) {
        console.error('Error editando nota:', e);
    } finally {
        guardando.value = false;
    }
}
async function eliminarNota(n) {
    if (!window.confirm('¿Eliminar esta nota?')) return;
    guardando.value = true;
    try {
        const lista = await store.dispatch('deleteNota', {
            project_name: props.card.name,
            row_name: n.name,
        });
        props.card.notas = lista;
    } catch (e) {
        console.error('Error eliminando nota:', e);
    } finally {
        guardando.value = false;
    }
}

function formatFecha(fecha) {
    if (!fecha) return '';
    const d = new Date(String(fecha).replace(' ', 'T'));
    if (isNaN(d)) return String(fecha).slice(0, 16);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mi = String(d.getMinutes()).padStart(2, '0');
    return `${dd}/${mm} ${hh}:${mi}`;
}

function getHighlight(field) {
    let style = 'border-radius: 4px;text-align:center;padding:5px;'
    if (props.config.fields.includes(props.config.highlighted_field) && props.card[props.config.highlighted_field]) {
        let color = 'gray'
        for (const highlight of props.config.highlight_table) {
            if (highlight.tag === field) {
                { color = highlight.color }
            }
        }
        style += `background-color:  var(--${color}-200); color: var(--${color}-800);`
        return style
    }
}

function getUrl() {
    if(props.config.ref_doctype.toLowerCase() == "job card"){
        const doctype = decodeURIComponent(props.config.ref_doctype)
        .toLowerCase()
        .replace(/\s+/g, "-");
        return '/app/' + doctype + '/' + props.card.name

    }
    else{
        return '/app/' + props.config.ref_doctype.toLowerCase() + '/' + props.card.name

    }
}
function getDoctype() {
    return props.config.ref_doctype.toLowerCase()
}
async function assignTo(card) {
    let args = window.cur_list.get_args()
    const assignToDialog = new frappe.ui.form.AssignToDialog({
        obj: card,
        method: 'frappe.desk.form.assign_to.add',
        doctype: args.doctype,
        docname: card.name,
        callback: async function () {
            args = window.cur_list.get_args()
            store.dispatch('fetchKanban', { args });
        },
    });
    assignToDialog.dialog.show();
}

</script>

<style scoped>
/* ---- Encabezado siempre visible ---- */
.card-head {
    display: flex;
    align-items: flex-start;
    gap: 6px;
}
.card-head-link {
    flex: 1;
    min-width: 0;
    text-decoration: none;
    display: flex;
    flex-direction: column;
}
.card-num {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--text-muted, #6c7680);
}
.card-title-min {
    font-weight: 600;
    color: var(--text-color, #1f272e);
    line-height: 1.2;
}
.card-toggle {
    cursor: pointer;
    font-size: 0.9rem;
    color: var(--text-muted, #6c7680);
    padding: 0 4px;
    user-select: none;
    flex-shrink: 0;
}

/* ---- Selector de color / objetivo ---- */
.card-colores {
    display: flex;
    align-items: center;
    gap: 5px;
    margin-top: 6px;
    flex-wrap: wrap;
}
.color-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    cursor: pointer;
    border: 2px solid transparent;
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
}
.color-dot.active {
    border-color: var(--text-color, #1f272e);
    transform: scale(1.15);
}
.color-objetivo {
    font-size: 0.68rem;
    color: var(--text-muted, #6c7680);
    font-weight: 600;
    margin-left: 2px;
}

/* ---- Notas ---- */
.kanban-notas {
    margin-top: 6px;
    border-top: 1px dashed var(--border-color, #d1d8dd);
    padding-top: 4px;
    font-size: 0.75rem;
}
.notas-header {
    cursor: pointer;
    font-weight: 600;
    color: var(--text-muted, #6c7680);
    display: flex;
    align-items: center;
    gap: 4px;
    user-select: none;
}
.notas-toggle {
    margin-left: auto;
}
.notas-body {
    margin-top: 4px;
}
.nota-item {
    background: var(--bg-color, #f4f5f6);
    border-radius: 6px;
    padding: 4px 6px;
    margin-bottom: 4px;
}
.nota-meta {
    font-size: 0.65rem;
    color: var(--text-muted, #8d99a6);
    margin-bottom: 2px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}
.nota-acciones {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
}
.nota-accion {
    cursor: pointer;
    text-decoration: none;
    font-size: 0.8rem;
}
.nota-accion.danger {
    color: #e24c4c;
}
.nota-text {
    white-space: pre-wrap;
    word-break: break-word;
}
.nota-vacia {
    color: var(--text-muted, #8d99a6);
    font-style: italic;
    margin-bottom: 4px;
}
.nota-edit {
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.nota-edit-btns {
    display: flex;
    gap: 6px;
    justify-content: flex-end;
}
.nota-add {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 4px;
}
.nota-input {
    width: 100%;
    border: 1px solid var(--border-color, #d1d8dd);
    border-radius: 6px;
    padding: 4px 6px;
    font-size: 0.75rem;
    resize: vertical;
}
.nota-btn {
    align-self: flex-end;
}
</style>
