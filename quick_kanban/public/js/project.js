frappe.ui.form.on('Project', {
    custom_imagen_portada: function(frm) {
        const allowed = ['png', 'jpg', 'jpeg']; // extensiones permitidas
        const file_url = frm.doc.custom_imagen_portada;

        if (file_url) {
            const ext = file_url.split('.').pop().toLowerCase();
            if (!allowed.includes(ext)) {
                frappe.msgprint({
                    title: __('Archivo no permitido'),
                    // message: __('Solo se permiten imágenes PNG o JPG.'),
                    indicator: 'red'
                });

                // Obtener el nombre del archivo (basename)
                const file_name = file_url.split('/').pop();

                // Buscar y eliminar el archivo del File Manager
                frappe.call({
                    method: 'frappe.client.get_list',
                    args: {
                        doctype: 'File',
                        filters: { file_name: file_name },
                        fields: ['name']
                    },
                    callback: function(r) {
                        if (r.message && r.message.length > 0) {
                            const file_docname = r.message[0].name;
                            frappe.call({
                                method: 'frappe.client.delete',
                                args: {
                                    doctype: 'File',
                                    name: file_docname
                                },
                                callback: function() {
                                    console.log('Archivo eliminado:', file_docname);
                                }
                            });
                        }
                    }
                });

                // Limpiar el campo
                frm.set_value('custom_imagen_portada', null);
            }
        }
    },
    custom_vendedor: function(frm) {
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
    },
    
});