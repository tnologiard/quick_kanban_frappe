frappe.ui.form.on('Project', {
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
});