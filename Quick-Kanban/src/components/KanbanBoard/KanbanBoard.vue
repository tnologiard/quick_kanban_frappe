<template>
  <div class="kanban-wrapper">
    <!-- Barra de seleccion de mes (solo tablero de Planificacion) -->
    <div v-if="planning.active" class="planning-toolbar">
      <button class="btn btn-default btn-sm" @click="prevMonth">&#8249;</button>
      <select class="planning-select" :value="planning.month" @change="onMonthChange">
        <option v-for="(m, i) in monthNames" :key="i" :value="i">{{ m }}</option>
      </select>
      <input
        class="planning-year"
        type="number"
        :value="planning.year"
        @change="onYearChange"
      />
      <button class="btn btn-default btn-sm" @click="nextMonth">&#8250;</button>
      <button class="btn btn-default btn-sm" @click="goToday">Hoy</button>
      <span class="planning-label">{{ monthNames[planning.month] }} {{ planning.year }}</span>
      <span class="planning-spacer"></span>
      <button class="btn btn-default btn-sm" @click="expandAll(true)" title="Mostrar detalles de todas">Expandir todas</button>
      <button class="btn btn-default btn-sm" @click="expandAll(false)" title="Colapsar todas">Colapsar todas</button>
    </div>

    <!-- Barra de expandir/colapsar para los demas tableros de Project -->
    <div v-else-if="featuresOn" class="planning-toolbar">
      <span class="planning-spacer"></span>
      <button class="btn btn-default btn-sm" @click="expandAll(true)" title="Mostrar detalles de todas">Expandir todas</button>
      <button class="btn btn-default btn-sm" @click="expandAll(false)" title="Colapsar todas">Colapsar todas</button>
    </div>

    <div class="kanban" ref="kanbanBoard">
      <KanbanColumn
        v-for="(column, columnIndex) in columns"
        :key="column.name"
        :column="column"
        :columnIndex="columnIndex"
        :config="config"
        @drop="drop"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useStore } from "vuex";
import KanbanColumn from "./KanbanColumn.vue";

const store = useStore();
const columns = computed(() => store.getters.getColumns);
const config = computed(() => store.getters.getConfig);
const planning = computed(() => store.getters.getPlanning);
const featuresOn = computed(() => config.value && config.value.ref_doctype === 'Project');
const kanbanBoard = ref(null);

const monthNames = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const board_name = frappe.get_route()[3];

onMounted(() => {
  window.refreshKanbanBoard = refreshKanbanBoard;
  store.dispatch("fetchCanEditColor");
  refreshKanbanBoard();
  bindClickDrag();
});

onBeforeUnmount(() => {
  unbindClickDrag();
});

const refreshKanbanBoard = (args) => {
  store
    .dispatch("fetchColumns", { board_name })
    .then(() => {
      if (store.getters.getPlanning.active) {
        return store.dispatch("fetchPlanning", { args });
      }
      return store.dispatch("fetchKanban", { args });
    })
    .catch((error) => console.error("Error during Kanban setup:", error));
};

// ---- Controles del selector de mes ----
function prevMonth() {
  store.dispatch("changeMonth", { delta: -1 });
}
function nextMonth() {
  store.dispatch("changeMonth", { delta: 1 });
}
function onMonthChange(e) {
  store.dispatch("setPeriod", {
    month: parseInt(e.target.value, 10),
    year: planning.value.year,
  });
}
function onYearChange(e) {
  store.dispatch("setPeriod", {
    month: planning.value.month,
    year: parseInt(e.target.value, 10),
  });
}
function goToday() {
  const now = new Date();
  store.dispatch("setPeriod", { month: now.getMonth(), year: now.getFullYear() });
}
function expandAll(value) {
  store.dispatch("setAllExpanded", { value });
}

function drop(event) {
  const evt = event.event;
  if (evt.newIndex === -1) {
    // console.log("Dropped from index", evt.oldIndex);
  }
  if (evt.oldIndex === -1) {
    const card = columns.value[evt.to.id].cards.find(
      (item) => item.name === event.key
    );
    // console.log(card.name, ":", card[config.value.title_field]);

    store.dispatch("updateOrder", {
      fromColumn: evt.from.id,
      toColumn: evt.to.id,
      fromIndex: -1,
      toIndex: evt.newIndex,
      card,
    });

    // --------- Mover tarjeta al final de la columna ---------
    const col = columns.value[evt.to.id];
    const length = col.cards.length

    // Primero removerla si estaba en esa columna
    col.cards = col.cards.filter(c => c.name !== card.name);

    // Insertarla al final
    col.cards.push(card);

    // // // Esto asegura que Vue detecte el cambio
    // col.cards = [...col.cards];

    // Recargar doc si es el actual
    if (window.cur_frm && cur_frm.doc.name === card.name) {
      cur_frm.reload_doc();
    }
  }
}

const bindClickDrag = () => {
  let isDown = false;
  let startX;
  let scrollLeft;

  const draggable = kanbanBoard.value;

  const onMouseDown = (e) => {
    let ignoreEl = [
      ".kanban-column .kanban-column-header",
      ".kanban-column .add-card",
      ".kanban-column .kanban-card",
      ".kanban-card-wrapper",
    ];
    if (ignoreEl.some((el) => e.target.closest(el))) return;

    isDown = true;
    draggable.classList.add("clickdrag-active");
    startX = e.pageX - draggable.offsetLeft;
    scrollLeft = draggable.scrollLeft;
  };

  const onMouseLeave = () => {
    isDown = false;
    draggable.classList.remove("clickdrag-active");
  };

  const onMouseUp = () => {
    isDown = false;
    draggable.classList.remove("clickdrag-active");
  };

  const onMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - draggable.offsetLeft;
    const walk = x - startX;
    draggable.scrollLeft = scrollLeft - walk;
  };

  draggable.addEventListener("mousedown", onMouseDown);
  draggable.addEventListener("mouseleave", onMouseLeave);
  draggable.addEventListener("mouseup", onMouseUp);
  draggable.addEventListener("mousemove", onMouseMove);
};

const unbindClickDrag = () => {
  const draggable = kanbanBoard.value;

  draggable.removeEventListener("mousedown", onMouseDown);
  draggable.removeEventListener("mouseleave", onMouseLeave);
  draggable.removeEventListener("mouseup", onMouseUp);
  draggable.removeEventListener("mousemove", onMouseMove);
};
</script>

<style scoped>
.planning-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  flex-wrap: wrap;
}
.planning-select,
.planning-year {
  height: 28px;
  border: 1px solid var(--border-color, #d1d8dd);
  border-radius: 6px;
  padding: 0 8px;
  background: var(--fg-color, #fff);
}
.planning-year {
  width: 80px;
}
.planning-label {
  font-weight: 600;
  margin-left: 4px;
  text-transform: capitalize;
}
.planning-spacer {
  flex: 1;
}
</style>
