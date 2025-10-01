<template>
    <div class="kanban-card drag">
        <!-- Imagen de portada -->
        <div>
            <a v-if="getDoctype() === 'project'" :href="getUrl()" draggable="false">
                <img
                    loading="lazy"
                    :srcset="card.custom_imagen_portada
                        ? `${card.custom_imagen_portada}?w=400 1x, ${card.custom_imagen_portada}?w=800 2x`
                        : '/files/default_project_image.jpg'"
                    :src="card.custom_imagen_portada || '/files/default_project_image.jpg'"
                    alt="imagen"
                    :style="{
                        width: '60%',
                        height: '60%',
                        objectFit: 'cover',
                        objectPosition: 'top',
                        display: 'block',
                    }"
                    draggable="false"
                    />

            </a>
            <!-- <a v-if="getDoctype() === 'job card'" :href="getUrl()" draggable="false">
                <PdfPreview
                    v-if="card.custom_guia_de_trabajo && card.custom_guia_de_trabajo.endsWith('.pdf')"
                    :src="card.custom_guia_de_trabajo"
                />
                <img
                    loading="lazy"
                    :srcset="card.custom_guia_de_trabajo
                        ? `${card.custom_guia_de_trabajo}?w=400 1x, ${card.custom_guia_de_trabajo}?w=800 2x`
                        : '/files/default_project_image.jpg'"
                    :src="card.custom_guia_de_trabajo || '/files/default_project_image.jpg'"
                    alt="imagen"
                    :style="{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: 'top',
                        display: 'block',
                    }"
                    draggable="false"
                    />

            </a>
            <span class="card-title ellipsis drag" :title="card.custom_proyecto">
                    {{ card.custom_proyecto }}
            </span> -->
        </div>
        <div class="kanban-title-area pb-3 drag">
            <a :href="getUrl()" draggable="false">
                <!-- <span class="card-title ellipsis drag" :title="card[config.title_field]"> -->
                <span class="card-title drag" :title="card[config.title_field]">
                    {{ card[config.title_field] }}
                </span>
            </a>
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

        <div v-for="field in config.fields" class="drag">
            <span v-if="field !== card[config.title_field] && field !== config.highlighted_field" class="drag">
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
    </div>
</template>
<script setup>

import { defineProps } from 'vue';
import { useStore } from 'vuex';
import Assignments from '../Assignments.vue'

const store = useStore();

const props = defineProps({
    card: Object,
    config: Object,
    columnIndex: Number
});

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
    return '/app/' + props.config.ref_doctype.toLowerCase() + '/' + props.card.name
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