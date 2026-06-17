import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import store from './utils/store'

window.frappe = frappe;

let appInstance = null;

// Monta (o re-monta) la app en el contenedor actual #kanbanapp.
// Esto evita el problema de tener que recargar con Ctrl+R: cada vez que
// se entra al tablero, Frappe recrea el contenedor y aqui re-montamos.
window.mountKanbanApp = function () {
    const el = document.getElementById('kanbanapp');
    if (!el) return;

    // Si habia una instancia previa montada en un contenedor viejo, la desmontamos
    if (appInstance) {
        try { appInstance.unmount(); } catch (e) { /* noop */ }
        appInstance = null;
    }

    appInstance = createApp(App);
    appInstance.use(store);
    appInstance.mount(el);
};

// Primer montaje al cargar el script
window.mountKanbanApp();
