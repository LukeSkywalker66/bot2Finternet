// AC_Crear_Ticket.js
// Crea un ticket en ISPCube clasificándolo automáticamente según el diagnóstico.

const axios = require('axios');

async function main() {
    try {
        // --- 1. CONFIGURACIÓN Y MAPEO (Tus IDs Reales) ---
        const CONFIG_ISPCUBE = {
            AREAS: {
                "SOPORTE": 1,
                "VENTAS": 2,
                "ADMIN": 3
            },
            PRIORIDADES: {
                "NORMAL": 1,
                "URGENTE": 2, // Usar para Críticos/Cortes masivos
                "BAJA": 3,
                "ALTA": 4     // Usar para Cortes individuales
            },
            CATEGORIAS: {
                "GENERICA": 13,         // 'RECLAMOS'
                "CORTE_TOTAL": 17,      // 'RECLAMOS DE FALTA DE SERVICIO'
                "LENTITUD": 16,         // 'RECLAMOS DE VELOCIDAD'
                "ADMINISTRACION": 13    // Usamos 'RECLAMOS' por defecto
            }
        };

        // --- 2. OBTENER DATOS DE ENTRADA ---
        const constGlobales = JSON.parse(context.userData.constants);
        const ISPCUBE_BASEURL = constGlobales.ISPCUBE_BASEURL;
        const ISPCUBE_APIKEY  = constGlobales.ISPCUBE_APIKEY;
        const ISPCUBE_CLIENTID = constGlobales.ISPCUBE_CLIENTID;
        const ISPCUBE_USER = constGlobales.ISPCUBE_USER;

        // Datos del Cliente y Conexión
        const idCliente = user.get('nIdCliente');
        const idConexion = user.get('nIdConexionSeleccionada'); // ¡El dato clave!
        
        // Contexto del Reclamo
        // 'ctx_ticket_sector' debe venir seteado antes (SOPORTE, ADMIN, VENTAS)
        const sectorBot = user.get('ctx_ticket_sector') || "SOPORTE"; 
        const quejaUsuario = user.get('ticket_descripcion_usuario') || "Sin descripción.";

        // Datos del Diagnóstico (Solo existen si pasó por el flujo de soporte)
        const notaTecnica = user.get('ticket_nota_interna') || "";
        const diagCodigo = user.get('diag_status_code') || ""; // OK, CRITICO, LOGICO
        const prioridadDetectada = user.get('ticket_prioridad') || "NORMAL"; // Viene del script de diag

        // --- 3. LÓGICA DE CLASIFICACIÓN INTELIGENTE ---
        
        // A. Definir ÁREA
        // Mapeamos el sector del bot al ID de Área de ISPCube
        const areaId = CONFIG_ISPCUBE.AREAS[sectorBot] || CONFIG_ISPCUBE.AREAS["SOPORTE"];

        // B. Definir PRIORIDAD
        // Mapeamos la prioridad detectada (BAJA, NORMAL, ALTA) a los IDs (3, 1, 4)
        let prioridadId = CONFIG_ISPCUBE.PRIORIDADES[prioridadDetectada] || 1; // 1 = Normal por defecto

        // C. Definir CATEGORÍA (La magia)
        let categoriaId = CONFIG_ISPCUBE.CATEGORIAS["GENERICA"]; // Por defecto 'RECLAMOS' (13)

        if (sectorBot === "SOPORTE") {
            if (diagCodigo === 'CRITICO') {
                categoriaId = CONFIG_ISPCUBE.CATEGORIAS["CORTE_TOTAL"]; // ID 17
                prioridadId = CONFIG_ISPCUBE.PRIORIDADES["ALTA"];      // ID 4
            } else if (diagCodigo === 'LOGICO') {
                categoriaId = CONFIG_ISPCUBE.CATEGORIAS["LENTITUD"];    // ID 16
            }
            // Si es OK o no hay diag, queda en 13 (RECLAMOS)
        } else if (sectorBot === "ADMIN") {
             // Podríamos usar ID 5 (Suspendidos) si detectamos deuda, pero 13 es seguro.
             categoriaId = CONFIG_ISPCUBE.CATEGORIAS["ADMINISTRACION"];
        }

        // --- 4. ARMADO DEL CUERPO DEL TICKET ---
        
        // Asunto: Lo hacemos descriptivo
        const titulo = `[${sectorBot}] Reclamo Automático Bot`;

        // Contenido Visible (Cliente)
        const contenidoCliente = `REPORTE DEL USUARIO:\n"${quejaUsuario}"\n\n(Ticket generado automáticamente vía WhatsApp)`;

        // Contenido Oculto (Técnico) - CAJA NEGRA
        // Si hay nota técnica, la metemos acá.
        const contenidoInterno = notaTecnica 
            ? `[DIAGNÓSTICO AUTOMÁTICO]\n${notaTecnica}` 
            : "Sin diagnóstico preliminar.";

        // --- 5. ENVIAR A ISPCUBE ---
        
        // Mini-Auth para Token fresco
        const authResp = await axios.post(`${ISPCUBE_BASEURL}/sanctum/token`, 
            { username: ISPCUBE_USER, password: constGlobales.ISPCUBE_PASSWORD },
            { headers: { 'api-key': ISPCUBE_APIKEY, 'client-id': ISPCUBE_CLIENTID, 'login-type': 'api' }}
        );
        const token = authResp.data.token;

        // Payload Final
        const ticketPayload = {
            customer_id: parseInt(idCliente),
            connection_id: parseInt(idConexion), // <--- Vital para asociar a la casa correcta
            ticket_category_id: categoriaId,
            priority: prioridadId,
            subject: titulo,
            item_content: contenidoCliente,         // Visible
            internal_item_content: contenidoInterno, // Oculto
            ticket_status_id: 1, // Nuevo/Abierto
            assigned_user_id: 0, // Sin asignar (Cola General)
            origin: 'api'
        };

        bmconsole.log("Enviando Ticket:", JSON.stringify(ticketPayload));

        const response = await axios.post(`${ISPCUBE_BASEURL}/tickets`, ticketPayload, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'api-key': ISPCUBE_APIKEY,
                'client-id': ISPCUBE_CLIENTID,
                'login-type': 'api',
                'Content-Type': 'application/json',
                'username': ISPCUBE_USER
            }
        });

        // --- 6. RESULTADO ---
        const nuevoId = response.data.id || response.data.ticket_id || "Creado";
        user.set('ticket_id_creado', nuevoId.toString());
        bmconsole.log(`✅ Ticket #${nuevoId} creado con éxito. Cat: ${categoriaId}, Prio: ${prioridadId}`);

    } catch (err) {
        bmconsole.log("❌ Error creando ticket: " + err.message);
        if (err.response) {
            bmconsole.log("Detalle API: " + JSON.stringify(err.response.data));
        }
        user.set('ticket_id_creado', 'ERROR');
    }
}

// Ejecución
main().then(() => result.done()).catch(() => result.done());