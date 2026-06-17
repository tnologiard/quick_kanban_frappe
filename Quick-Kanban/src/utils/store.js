import { createStore } from 'vuex';

// Tablero de Planificacion Mensual (vista por mes).
// El modo "mes" se activa SOLO para este tablero (detectado por su nombre),
// asi los demas tableros no se ven afectados.
const PLANNING_BOARD = 'Planificacion Mensual';          // nombre del board que usa la vista por mes
const PLANNING_DATE_FIELD = 'custom_date_planificacion'; // campo Date que define el dia

// Prioridad de cada color (mayor = mas arriba en la columna)
const COLOR_PRIORITY = { Rojo: 5, Naranja: 4, Azul: 3, Verde: 2, Gris: 1 };
function colorPriority(c) {
    return COLOR_PRIORITY[c] || COLOR_PRIORITY.Gris; // sin color = General (Gris)
}
// Orden de tarjetas: primero por color (rojo arriba), luego mas antiguas primero.
// El color es por tablero, guardado en card._boardColor.
function sortCards(a, b) {
    const diff = colorPriority(b._boardColor) - colorPriority(a._boardColor);
    if (diff !== 0) return diff;
    return new Date(a.modified) - new Date(b.modified);
}

const store = createStore({
    state: {
        columns: [],
        // Permiso para editar colores (rol asignado explicitamente). Lo define el servidor.
        canEditColor: false,
        config: {
            board_name: '',
            ref_doctype: '',
            field_name: '',
            title_field: '',
            fields: [],
            highlighted_field: '',
            highlight_table: '',
        },
        // Modo planificacion: columnas = dias del mes seleccionado
        planning: {
            active: false,
            month: null, // 0-11
            year: null,
            // Excepciones por tarjeta: { [board]: { [cardName]: true|false } } (persiste)
            expanded: loadExpanded(),
            // Preferencia global por tablero: { [board]: true|false } (persiste)
            // true = todas expandidas por defecto, false = todas colapsadas
            expandDefault: loadExpandDefault(),
        },
    },
    mutations: {
        SET_COLUMNS(state, columns) {
            if (state.columns.length === 0) {
                state.columns = columns;
            } else {
                columns.forEach((newColumn, index) => {
                    if (state.columns[index]) {
                        state.columns[index] = newColumn.cards
                            ? newColumn
                            : Object.assign(state.columns[index], ...Object.keys(newColumn).filter(key => key !== 'cards').map(key => ({ [key]: newColumn[key] })));
                    } else {
                        state.columns.push(newColumn);
                    }
                });
            }
            state.columns = state.columns.filter(oldColumn =>
                columns.some(newColumn => newColumn.name === oldColumn.name)
            );
        },
        // Reemplaza las columnas por completo (usado en modo planificacion)
        SET_COLUMNS_DIRECT(state, columns) {
            state.columns = columns;
        },
        MOVE_CARD(state, { fromColumn, toColumn, fromIndex, toIndex, card }) {
            state.columns[fromColumn].cards.splice(fromIndex, 1);
            if (toIndex !== null) {
                state.columns[toColumn].cards.splice(toIndex, 0, card);
            } else {
                state.columns[toColumn].cards.push(card);
            }
        },
        UPDATE_COLUMN_INDICATOR(state, { columnIndex, indicator }) {
            state.columns[columnIndex].indicator = indicator;
        },
        SET_KANBAN_CONFIG(state, config) {
            state.config = config;
        },
        SET_CAN_EDIT_COLOR(state, value) {
            state.canEditColor = !!value;
        },
        SET_PLANNING(state, payload) {
            if (payload.active !== undefined) state.planning.active = payload.active;
            if (payload.month !== undefined) state.planning.month = payload.month;
            if (payload.year !== undefined) state.planning.year = payload.year;
        },
        // Reordena las tarjetas de cada columna por color + fecha
        RESORT_PLANNING(state) {
            state.columns.forEach((c) => {
                if (c.cards) c.cards.sort(sortCards);
            });
        },
        // Despliega/colapsa una tarjeta como EXCEPCION sobre el default del tablero
        TOGGLE_CARD(state, { board, name }) {
            const base = !!state.planning.expandDefault[board];
            if (!state.planning.expanded[board]) state.planning.expanded[board] = {};
            const ovMap = state.planning.expanded[board];
            const current = ovMap[name] !== undefined ? ovMap[name] : base;
            const next = !current;
            if (next === base) {
                delete ovMap[name]; // vuelve al default -> no necesita excepcion
            } else {
                ovMap[name] = next;
            }
            persistExpanded(state);
        },
        // Fija la preferencia global del tablero (expandir/colapsar todas) y limpia excepciones
        SET_ALL_EXPANDED(state, { board, value }) {
            state.planning.expandDefault = { ...state.planning.expandDefault, [board]: value };
            state.planning.expanded = { ...state.planning.expanded, [board]: {} };
            persistExpanded(state);
        },
    },
    actions: {
        async fetchKanban({ commit, state }, { args }) {
            if (args === undefined) {
                args = window.cur_list.get_args();
            }
            if (state.config.ref_doctype === "Project") {

                // Agregar el campo custom_image
                if (!args.fields.includes("`tabProject`.`custom_imagen_portada`")) {
                    args.fields.push("`tabProject`.`custom_imagen_portada`");
                }
                if (!args.fields.includes("`tabProject`.`custom_nombre_vendedor`")) {
                    args.fields.push("`tabProject`.`custom_nombre_vendedor`");
                }
                if (!args.fields.includes("`tabProject`.`custom_nombre_diseñador`")) {
                    args.fields.push("`tabProject`.`custom_nombre_diseñador`");
                }
                if (!args.fields.includes("`tabProject`.`project_type`")) {
                    args.fields.push("`tabProject`.`project_type`");
                }
             }
             if (state.config.ref_doctype === "Job Card") {

                // Agregar el campo custom_image
                if (!args.fields.includes("`tabJob Card`.`custom_guia_de_trabajo`")) {
                    args.fields.push("`tabJob Card`.`custom_guia_de_trabajo`");
                }
                if (!args.fields.includes("`tabJob Card`.`custom_proyecto`")) {
                    args.fields.push("`tabJob Card`.`custom_proyecto`");
                }
             }

            try {
                const response = await frappe.call({
                    method: 'frappe.desk.reportview.get',
                    args: args,
                });

                // TAGS
                const nameIndex = response.message.keys.findIndex(key => key === "name");
                const projectNames = response.message.values.map(card => card[nameIndex]);
                const tagsResponse = await frappe.call({
                    method: 'quick_kanban.api.get_tags_for_projects',
                    args: { project_names: JSON.stringify(projectNames) }
                });
                const allTags = tagsResponse.message || {};

                // COLORES por tablero (las notas solo se cargan en el tablero mensual)
                let allColors = {};
                if (state.config.ref_doctype === "Project") {
                    const colorsResponse = await frappe.call({
                        method: 'quick_kanban.api.get_colors_for_projects',
                        args: { project_names: JSON.stringify(projectNames), board: state.config.board_name }
                    });
                    allColors = colorsResponse.message || {};
                }
                //

                const board = response.message;
                if (board.length !== 0) {
                    const columns = state.columns;
                    const fieldIndex = board.keys.findIndex(key => key === state.config.field_name);
                    const userInfoLookup = {};
                    Object.values(board.user_info).forEach((user) => {
                        userInfoLookup[user.name] = user.fullname
                    });

                    columns.forEach((column) => {
                        column.cards = [];
                        board.values.forEach((card) => {
                            if (card[fieldIndex] === column.column_name) {
                                const transformedCard = transformCard(board.keys, card, userInfoLookup);

                                //AGREGO LOS TAGS A LA TARJETA
                                transformedCard.tags = allTags[transformedCard.name] || [];
                                //Las notas solo se usan en el tablero mensual
                                transformedCard.notas = [];
                                //COLOR POR TABLERO
                                transformedCard._boardColor = allColors[transformedCard.name] || 'Gris';

                                column.cards.push(transformedCard);
                            }
                        });
                        // Ordenar: prioridad de color y luego mas antiguas primero
                        column.cards.sort(sortCards);
                    });
                    commit('SET_COLUMNS', columns);
                }
            } catch (error) {
                console.error('Error fetching columns:', error);
            }
        },

        // ============================================================
        //  MODO PLANIFICACION: columnas = dias del mes seleccionado
        // ============================================================
        async fetchPlanning({ commit, state }, { args }) {
            if (args === undefined) {
                args = window.cur_list.get_args();
            }

            // Campos necesarios para Project + el campo de fecha de planificacion
            const needed = [
                'custom_imagen_portada',
                'custom_nombre_vendedor',
                'custom_nombre_diseñador',
                'project_type',
                'status',
                'custom_departamento_kanban',
                PLANNING_DATE_FIELD,
            ];
            needed.forEach((f) => {
                const col = '`tabProject`.`' + f + '`';
                if (!args.fields.includes(col)) args.fields.push(col);
            });

            const cols = buildPlanningColumns(state.planning.month, state.planning.year);

            try {
                const response = await frappe.call({
                    method: 'frappe.desk.reportview.get',
                    args: args,
                });

                const board = response.message;
                if (!board || board.length === 0 || !board.values) {
                    commit('SET_COLUMNS_DIRECT', cols);
                    return;
                }

                const keys = board.keys;
                const nameIndex = keys.findIndex((k) => k === 'name');
                const dateIndex = keys.findIndex((k) => k === PLANNING_DATE_FIELD);
                const projectNames = board.values.map((c) => c[nameIndex]);

                // Tags, Notas, Colores por tablero y Ordenes de Venta validas en lote
                const [tagsResponse, notasResponse, colorsResponse, soResponse] = await Promise.all([
                    frappe.call({
                        method: 'quick_kanban.api.get_tags_for_projects',
                        args: { project_names: JSON.stringify(projectNames) },
                    }),
                    frappe.call({
                        method: 'quick_kanban.api.get_notas_for_projects',
                        args: { project_names: JSON.stringify(projectNames) },
                    }),
                    frappe.call({
                        method: 'quick_kanban.api.get_colors_for_projects',
                        args: { project_names: JSON.stringify(projectNames), board: state.config.board_name },
                    }),
                    frappe.call({
                        method: 'quick_kanban.api.get_projects_with_valid_so',
                        args: { project_names: JSON.stringify(projectNames) },
                    }),
                ]);
                const allTags = tagsResponse.message || {};
                const allNotas = notasResponse.message || {};
                const allColors = colorsResponse.message || {};
                // Proyectos con al menos una Orden de Venta valida
                const conOrdenVenta = new Set(soResponse.message || []);

                const userInfoLookup = {};
                Object.values(board.user_info).forEach((user) => {
                    userInfoLookup[user.name] = user.fullname;
                });

                const byDate = {};
                board.values.forEach((c) => {
                    const card = transformCard(keys, c, userInfoLookup);

                    // Se quitan de la planificacion los proyectos Completados/Cancelados
                    // o cuyo departamento ya esta en "Completado".
                    if (['Completed', 'Cancelled'].includes(card.status)) return;
                    if (card.custom_departamento_kanban === 'Completado') return;

                    card.tags = allTags[card.name] || [];
                    card.notas = allNotas[card.name] || [];
                    card._boardColor = allColors[card.name] || 'Gris';

                    let key = '__pendientes__';
                    const raw = dateIndex !== -1 ? c[dateIndex] : null;
                    if (raw) {
                        key = String(raw).slice(0, 10); // YYYY-MM-DD
                    } else {
                        // Sin fecha -> solo va a Pendientes si tiene una Orden de Venta valida
                        if (!conOrdenVenta.has(card.name)) return;
                    }
                    (byDate[key] = byDate[key] || []).push(card);
                });

                cols.forEach((col) => {
                    const k = col.dateStr || '__pendientes__';
                    col.cards = (byDate[k] || []).sort(sortCards);
                });

                commit('SET_COLUMNS_DIRECT', cols);
            } catch (error) {
                console.error('Error fetching planning:', error);
                commit('SET_COLUMNS_DIRECT', cols);
            }
        },

        async fetchColumns({ commit, state }, { board_name }) {
            try {
                const response = await frappe.call({
                    method: 'frappe.client.get',
                    args: {
                        doctype: 'Kanban Board',
                        name: board_name,
                    },
                });

                const board = response.message;

                const ref_doctype = board.reference_doctype;
                const field_name = board.field_name;
                const highlighted_field = board.custom_highlighted_field
                const highlight_table = board.custom_highlight_table
                let fields = [];
                if (board.fields) {
                    try {
                        fields = JSON.parse(board.fields);
                    } catch (e) {
                        console.error("Error parsing fields:", e);
                    }
                } else {
                    fields = ['name', 'title'];
                }
                const meta = frappe.get_meta(ref_doctype);

                const config = { board_name, ref_doctype, field_name, title_field: meta.title_field, fields, highlighted_field, highlight_table }
                commit('SET_KANBAN_CONFIG', config);

                // Detectar tablero de Planificacion Mensual -> activar modo "mes"
                if (board.name === PLANNING_BOARD || board_name === PLANNING_BOARD) {
                    const payload = { active: true };
                    if (state.planning.month === null || state.planning.year === null) {
                        const now = new Date();
                        payload.month = now.getMonth();
                        payload.year = now.getFullYear();
                    }
                    commit('SET_PLANNING', payload);
                } else {
                    commit('SET_PLANNING', { active: false });
                    commit('SET_COLUMNS', board.columns);
                }

            } catch (error) {
                console.error('Error fetching columns:', error);
            }
        },
        async updateOrder({ commit, state }, { fromColumn, toColumn, fromIndex, toIndex, card }) {
            try {
                let fieldname, value;
                if (state.planning.active) {
                    // En modo planificacion movemos la FECHA del proyecto
                    fieldname = PLANNING_DATE_FIELD;
                    value = state.columns[toColumn].dateStr || ''; // '' = Pendientes (sin fecha)
                } else {
                    fieldname = state.config.field_name;
                    value = state.columns[toColumn].column_name;
                }
                await frappe.call({
                    method: 'frappe.client.set_value',
                    args: {
                        doctype: state.config.ref_doctype,
                        name: card.name,
                        fieldname: fieldname,
                        value: value,
                    },
                });
            } catch (error) {
                console.error(error);
            }
        },
        // Cambiar el mes mostrado (delta = -1 / +1) y recargar
        async changeMonth({ commit, state, dispatch }, { delta }) {
            let m = state.planning.month + delta;
            let y = state.planning.year;
            if (m < 0) { m = 11; y -= 1; }
            if (m > 11) { m = 0; y += 1; }
            commit('SET_PLANNING', { month: m, year: y });
            await dispatch('fetchPlanning', {});
        },
        // Ir a un mes/año especifico y recargar
        async setPeriod({ commit, dispatch }, { month, year }) {
            commit('SET_PLANNING', { month: month, year: year });
            await dispatch('fetchPlanning', {});
        },
        // Desplegar/colapsar una tarjeta (usa el tablero actual)
        toggleCard({ commit, state }, { name }) {
            commit('TOGGLE_CARD', { board: state.config.board_name, name });
        },
        // Desplegar/colapsar todas las tarjetas del tablero actual
        setAllExpanded({ commit, state }, { value }) {
            commit('SET_ALL_EXPANDED', { board: state.config.board_name, value });
        },
        // Agregar una nota a un proyecto; devuelve la lista actualizada
        async addNota(_, { project_name, nota }) {
            const r = await frappe.call({
                method: 'quick_kanban.api.add_nota',
                args: { project_name, nota },
            });
            return r.message || [];
        },
        // Editar el texto de una nota; devuelve la lista actualizada
        async updateNota(_, { project_name, row_name, nota }) {
            const r = await frappe.call({
                method: 'quick_kanban.api.update_nota',
                args: { project_name, row_name, nota },
            });
            return r.message || [];
        },
        // Eliminar una nota; devuelve la lista actualizada
        async deleteNota(_, { project_name, row_name }) {
            const r = await frappe.call({
                method: 'quick_kanban.api.delete_nota',
                args: { project_name, row_name },
            });
            return r.message || [];
        },
        // Consultar al servidor si el usuario puede editar colores (rol asignado)
        async fetchCanEditColor({ commit }) {
            try {
                const r = await frappe.call({ method: 'quick_kanban.api.can_edit_color' });
                commit('SET_CAN_EDIT_COLOR', !!r.message);
            } catch (e) {
                commit('SET_CAN_EDIT_COLOR', false);
            }
        },
        // Asignar color/objetivo a una tarjeta para el tablero actual y reordenar
        async setCardColor({ commit, state }, { card, color }) {
            try {
                await frappe.call({
                    method: 'quick_kanban.api.set_card_color',
                    args: {
                        project_name: card.name,
                        board: state.config.board_name,
                        color: color || '',
                    },
                });
                card._boardColor = color || 'Gris';
                commit('RESORT_PLANNING');
            } catch (error) {
                console.error('Error setting card color:', error);
            }
        },
        async setIndicator({ commit, state }, { indicator, columnIndex, board_name }) {
            try {
                await frappe.call({
                    method: 'frappe.desk.doctype.kanban_board.kanban_board.set_indicator',
                    args: {
                        board_name: board_name,
                        column_name: state.columns[columnIndex].column_name,
                        indicator: indicator,
                    },
                    callback: function () {
                        commit('UPDATE_COLUMN_INDICATOR', { columnIndex, indicator });
                    }
                });
            } catch (error) {
                console.error(`Error updating indicator ${indicator}:`, error);
            }
        },
    },
    getters: {
        getColumns: state => state.columns,
        getConfig: state => state.config,
        getPlanning: state => state.planning,
        getCanEditColor: state => state.canEditColor,
    },
});

// Persistencia del estado desplegado/colapsado de las tarjetas
const EXPANDED_KEY = 'qk_planning_expanded';        // excepciones por tarjeta
const EXPAND_DEFAULT_KEY = 'qk_planning_expand_default'; // preferencia global por tablero
function loadExpanded() {
    try {
        return JSON.parse(localStorage.getItem(EXPANDED_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}
function loadExpandDefault() {
    try {
        return JSON.parse(localStorage.getItem(EXPAND_DEFAULT_KEY) || '{}') || {};
    } catch (e) {
        return {};
    }
}
function persistExpanded(state) {
    try {
        localStorage.setItem(EXPANDED_KEY, JSON.stringify(state.planning.expanded));
        localStorage.setItem(EXPAND_DEFAULT_KEY, JSON.stringify(state.planning.expandDefault));
    } catch (e) { /* noop */ }
}

// Genera las columnas de un mes: Pendientes + un dia por cada dia del mes
function buildPlanningColumns(month, year) {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const wd = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const cols = [{
        name: '__pendientes__',
        column_name: 'Pendientes',
        dateStr: null,
        indicator: 'Gray',
        cards: [],
    }];
    for (let d = 1; d <= daysInMonth; d++) {
        const dt = new Date(year, month, d);
        const mm = String(month + 1).padStart(2, '0');
        const dd = String(d).padStart(2, '0');
        const dateStr = `${year}-${mm}-${dd}`;
        cols.push({
            name: dateStr,
            column_name: `${wd[dt.getDay()]} ${d}`,
            dateStr: dateStr,
            indicator: 'Gray',
            cards: [],
        });
    }
    return cols;
}

function transformCard(keys, card, userInfoLookup) {
    try {
        const transformedCard = {};
        keys.forEach((key, index) => {
            transformedCard[key] = card[index];
        });

        const transformedAssign = {};
        if (transformedCard['_assign']) {
            const assignees = JSON.parse(transformedCard['_assign']);
            assignees.forEach((assignee) => {
                transformedAssign[assignee] = userInfoLookup[assignee];
            });

        }
        transformedCard['_assign'] = transformedAssign;

        // console.log(transformedCard)
        return transformedCard;

    } catch (e) {
        console.error("Error parsing fields:", e);
    }
}

export default store;
