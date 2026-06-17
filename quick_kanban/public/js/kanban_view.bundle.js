
frappe.provide("frappe.views");

let kanban_conf = frappe.call({
    method: "quick_kanban.get_beta _users.get_kanban_config",
    callback: function (r) {
        if (!r.exc && r.message) {
            kanban_conf = r.message
        }
    }
});

frappe.views.KanbanView = class KanbanView extends frappe.views.KanbanView {

    render() {
        if (!kanban_conf.kanban_beta) {
            this.renderOld()
            return
        }
        if (kanban_conf.kanban_beta_users?.length) {
            if (kanban_conf.kanban_beta_users.includes(frappe.session.user)) {
                this.renderBeta()
            }
            else {
                this.renderOld()
            }
        }
        else {
            this.renderBeta()
        }
    }

    renderBeta() {
        const existing = this.$result.find('#kanbanapp');

        // Si la app ya esta montada y visible, solo refrescamos los datos.
        if (existing.length && existing.children().length && window.refreshKanbanBoard) {
            window.refreshKanbanBoard(this.get_args());
            return;
        }

        // (Re)creamos el contenedor en el resultado actual y (re)montamos la app.
        // Esto evita tener que recargar con Ctrl+R al volver a entrar al tablero.
        this.$result.html(`<div id="kanbanapp"></div>`);

        if (window.mountKanbanApp) {
            window.mountKanbanApp();
        } else if (!window.__kanbanScriptLoading) {
            // Primera vez: cargamos el script. Al ejecutarse hace el primer montaje.
            window.__kanbanScriptLoading = true;
            const script = document.createElement('script');
            // ?v=... evita que el navegador sirva una version vieja cacheada del bundle
            script.src = '/assets/quick_kanban/js/quick_kanban.bundle.js?v=' + Date.now();
            document.head.appendChild(script);
        }
    }

    renderOld() {
        const board_name = this.board_name;
        if (!this.kanban) {
            this.kanban = new frappe.views.KanbanBoard({
                doctype: this.doctype,
                board: this.board,
                board_name: board_name,
                cards: this.data,
                card_meta: this.card_meta,
                wrapper: this.$result,
                cur_list: this,
                user_settings: this.view_user_settings,
            });
        } else if (board_name === this.kanban.board_name) {
            this.kanban.update(this.data);
        }
    }
}
