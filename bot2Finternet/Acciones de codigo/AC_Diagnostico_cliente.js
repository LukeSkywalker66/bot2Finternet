// AC_Diagnostico_cliente.js

// 1. Importación segura de dependencias
let axios;
try {
    axios = require('axios');
} catch (e) {
    // En Botmaker a veces axios es global o se maneja distinto, 
    // pero el try/catch evita que explote si falta el require.
}

// 2. FUNCIÓN PRINCIPAL (Toda tu lógica va acá adentro)
async function ejecutarDiagnostico() {
    
    // --- MOCK DE CONTEXTO DEFENSIVO ---
    // Esto evita que falle si 'context' no existe al inicio
    const rawConst = (typeof context !== 'undefined' && context.userData) 
        ? context.userData.constants 
        : '{}';
    
    const constGlobales = JSON.parse(rawConst);
    const BEHOLDER_BASEURL = constGlobales.BEHOLDER_BASEURL || 'http://localhost_mock';
    const BEHOLDER_APIKEY  = constGlobales.BEHOLDER_APIKEY || 'mock_key';

    // Función auxiliar de traducción
    const traducir = (valor) => {
        const diccionario = {
            "Online": "En línea",
            "Power fail": "Problema de energía (Corte de luz)",
            "LOS": "Sin señal (Cable cortado)",
            "Offline": "Fuera de línea",
            "true": "Conectado",
            "false": "Desconectado",
            "Critical": "Crítico - Luz muy alta",
            "Warning": "Advertencia - Luz alta",
            "Very good": "Muy buena - Luz óptima",
            "Good": "Buena",
            "Bad": "Mala señal"
        };
        return diccionario[String(valor)] || valor;
    };

    // --- TU LÓGICA DE NEGOCIO ORIGINAL ---
    try {
        // En local 'user' se inyectará globalmente, en Botmaker ya existe
        const numConexiones = parseInt(user.get('nNumConexiones') || "0", 10);
        const pppoeUser = user.get('pppoeUser'); 

        // CASO 1: Múltiples Conexiones
        if (numConexiones > 1) {
            user.set('diag_status_code', 'CRITICO');
            user.set('ticket_categoria', 'SOPORTE_COMPLEJO');
            user.set('ticket_resumen_tecnico', `CLIENTE CON ${numConexiones} CONEXIONES`);
            user.set('bot_respuesta_texto', 'Tenés múltiples conexiones. Generando ticket manual.');
            
            if(typeof bmconsole !== 'undefined') bmconsole.log("Cliente con múltiples conexiones.");
            return;
        }

        // CASO 2: Diagnóstico Beholder
        // Usamos axios.get real para probar tu API
        const diagResp = await axios.get(`${BEHOLDER_BASEURL}/diagnosis/${pppoeUser}`, {
            headers: { "x-api-key": BEHOLDER_APIKEY }
        });
        
        const data = diagResp.data; 

        // Extracción de datos
        const onuEstadoRaw  = data.onu_status_smrt?.onu_status || 'Offline';
        const onuSenalRaw   = data.onu_signal_smrt?.onu_signal || 'Unknown';
        const onuSenalVal   = data.onu_signal_smrt?.onu_signal_value || '-';
        const mkActive      = data.mikrotik?.active || false;
        const mkUptime      = data.mikrotik?.uptime || '0s';
        const clienteNombre = data.cliente_nombre || 'Cliente';
        const nodoNombre    = data.nodo_nombre || '-';

        const textoOnuEstado = traducir(onuEstadoRaw);
        const textoOnuSenal  = traducir(onuSenalRaw);
        const textoMkEstado  = mkActive ? "Conectado a Internet" : "Sin acceso a Internet";

        // Veredicto
        let statusCode = "OK"; 
        let botMensaje = "";
        let ticketPrioridad = "NORMAL";

        if (onuEstadoRaw !== 'Online' || onuSenalRaw === 'Critical' || onuEstadoRaw === 'LOS') {
            statusCode = "CRITICO";
            ticketPrioridad = "ALTA";
            botMensaje = `Problema físico detectado (${textoOnuEstado}, ${textoOnuSenal}).`;
        } else if (!mkActive) {
            statusCode = "LOGICO";
            botMensaje = `Equipo bien, pero sin navegación. Posible router desconfigurado.`;
        } else {
            statusCode = "OK";
            botMensaje = `Línea OK.\nONU: ${textoOnuEstado}\nSeñal: ${textoOnuSenal}\nEstado: ${textoMkEstado}`;
        }

        // Guardado de variables
        user.set('diag_status_code', statusCode);
        user.set('bot_respuesta_texto', botMensaje);
        
        const technicalContext = `--- DIAGNOSTICO ---\nCLIENTE: ${clienteNombre}\nONU: ${textoOnuEstado}\nSEÑAL: ${textoOnuSenal}`;
        user.set('ticket_resumen_tecnico', technicalContext);
        user.set('ticket_prioridad', ticketPrioridad);
        user.set('ticket_categoria', statusCode === 'CRITICO' ? 'SOPORTE_TECNICO' : 'RECLAMO_SERVICIO');

        if(typeof bmconsole !== 'undefined') bmconsole.log("Diagnóstico OK. Status:", statusCode);

    } catch (err) {
        if(typeof bmconsole !== 'undefined') bmconsole.log("Error en diagnóstico:", err.message);
        user.set('diag_status_code', 'ERROR_API'); 
        user.set('bot_respuesta_texto', 'Error al conectar con diagnóstico. Tomando reclamo manual.');
        user.set('ticket_resumen_tecnico', `ERROR API: ${err.message}`);
    }
}

// ==========================================
// 3. EL SECRETO DEL ENTORNO HÍBRIDO
// ==========================================

// Si estamos en VS Code (Node local), exportamos la función
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ejecutarDiagnostico };
} 
// Si estamos en Botmaker (No existe module), ejecutamos
else {
    ejecutarDiagnostico().then(() => {
        if (typeof result !== 'undefined' && result.done) result.done();
    }).catch(err => {
        if (typeof bmconsole !== 'undefined') bmconsole.log("Error fatal:", err);
        if (typeof result !== 'undefined' && result.done) result.done();
    });
}