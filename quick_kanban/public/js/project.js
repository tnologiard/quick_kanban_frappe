frappe.ui.form.on('Project', {
    refresh: function(frm) {
        // Evitar que se duplique el botón al refrescar
        if (!frm.custom_buttons_added) {
            let $btn = frm.page.add_inner_button(__('Ir a Advertech'), function() {
                window.location.href = '/app/advertech';
            });

            // Darle estilo al botón
            $btn
                .removeClass("btn-default")   // quitar estilo gris por defecto
                .addClass("btn-primary")      // azul
                .css({
                    "background-color": "#ff5722", // naranja fuerte
                    "color": "white",
                    "font-weight": "bold",
                    "border-radius": "8px"
                });

            frm.custom_buttons_added = true;
        }
    },
    custom_vendedor: function(frm) {
        console.log(frm)
        if (!frm.doc.custom_vendedor) {
            // Si el valor es vacío, limpiar los campos
            frm.set_value('custom_nombre_vendedor', '');
        } 
        else {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: "Employee",
                    filters: { name: frm.doc.custom_vendedor },
                    fieldname: "employee_name"
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('custom_nombre_vendedor', r.message.employee_name);
                    }
                },
                error: function(r) {
                    // Limpiar los campos
                    frm.set_value('custom_nombre_vendedor', '');
                }
            });
        }
    },   
    custom_diseñador: function(frm) {
        console.log(frm)
        if (!frm.doc.custom_diseñador) {
            // Si el valor es vacío, limpiar los campos
            frm.set_value('custom_nombre_diseñador', '');
        } 
        else {
            frappe.call({
                method: 'frappe.client.get_value',
                args: {
                    doctype: "Employee",
                    filters: { name: frm.doc.custom_diseñador },
                    fieldname: "employee_name"
                },
                callback: function(r) {
                    if (r.message) {
                        frm.set_value('custom_nombre_diseñador', r.message.employee_name);
                    }
                },
                error: function(r) {
                    // Limpiar los campos
                    frm.set_value('custom_nombre_diseñador', '');
                }
            });
        }
    },
    status: function(frm){
      if (["Completed", "Completado", "Terminado"].includes(frm.doc.status)) {
            frm.set_value("custom_departamento_kanban", "Completado" || "");
            
            // Guarda el documento inmediatamente sin pedir al usuario presionar "Save"
            frm.save('Update');  // o frm.save_or_update();
        }
    },
    custom_departamento_kanban: function(frm){
      if (["Completado", "Completado", "Terminado"].includes(frm.doc.custom_departamento_kanban)) {
            frm.set_value("status", "Completed");
            
            // Guarda el documento inmediatamente sin pedir al usuario presionar "Save"
            frm.save('Update');  // o frm.save_or_update();
        }
    }
});