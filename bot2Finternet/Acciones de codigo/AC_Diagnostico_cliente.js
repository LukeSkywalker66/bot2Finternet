


// ================================================
// 2. FUNCIÓN DE DIAGNÓSTICO (PARA ENTORNO HÍBRIDO)
// ================================================
const axios = require('axios');

async function main() {
    try {
        // 1. Constantes y Contexto
        const constGlobales = JSON.parse(context.userData.constants);
        const BEHOLDER_BASEURL = constGlobales.BEHOLDER_BASEURL;
        const BEHOLDER_APIKEY  = constGlobales.BEHOLDER_APIKEY;

        const pppoeUser = user.get('pppoeUser');

        if (!pppoeUser) {
            user.set('diag_resultado', 'ERROR_DATOS');
            user.set('ticket_nota_interna', '⚠️ No se pudo identificar usuario PPPoE.');
            return;
        }

        // 2. Ejecutar Diagnóstico
        const diagResp = await axios.get(`${BEHOLDER_BASEURL}/diagnosis/${pppoeUser}`, {
            headers: { "x-api-key": BEHOLDER_APIKEY }
        });
        const data = diagResp.data;

        // 3. Extracción de Datos
        const onuEstadoRaw  = data.onu_status_smrt?.onu_status || 'Offline';
        const onuEstadoNorm = String(onuEstadoRaw).toLowerCase(); 
        
        const onuSenalRaw   = data.onu_signal_smrt?.onu_signal || 'Unknown'; // Critical, Warning, Good, Very good
        const onuSenalNorm  = String(onuSenalRaw).toLowerCase();
        const onuSenalVal   = data.onu_signal_smrt?.onu_signal_value || '-';
        
        const mkActive      = data.mikrotik?.active || false; 
        const mkLastLogOut  = data?.mikrotik?.secret?.["last-logged-out"] || '-';
        const mkUptime      = data.mikrotik?.uptime || '0s';
        const ipAddress     = data.mikrotik?.address || '-'; // Dato Nuevo
        const macAddress    = data.mikrotik?.["caller-id"] || data?.mikrotik?.secret?.["last-caller-id-id"] || '-';
        const planNombre    = data.plan || '-';
        const nodoInfo      = data.nodo_nombre || '-';

        // --- FUNCIONES AUXILIARES ---

        // A. Validar Estabilidad (> 2 minutos)
        const esEstable = (uptimeStr) => {
            if (!uptimeStr) return false;
            // Si tiene Semanas(w), Días(d) u Horas(h), seguro es mayor a 2 min.
            if (uptimeStr.match(/[wdh]/)) return true;
            
            // Si solo tiene minutos (m) y segundos (s), parseamos
            // Ejemplos Mikrotik: "1m30s", "45s", "10m"
            const matchMin = uptimeStr.match(/(\d+)m/);
            if (matchMin && parseInt(matchMin[1]) >= 2) return true;
            
            return false; // Si son solo segundos o menos de 2m
        };

        // B. Validar Calidad Señal (Para no dar por bueno un enlace con mala luz)
        const esBuenaSenal = () => {
            return ['good', 'very good'].includes(onuSenalNorm);
        };

        // C. Traductor Simple
        const traducir = (txt) => {
            const dic = {
                "online": "Online 🟢", "offline": "Offline 🔴",
                "los": "LOS (Corte) ✂️", "power fail": "Sin Energía ⚡",
                "critical": "Crítica ⚠️", "warning": "Regular 🔸",
                "good": "Buena 🟢", "very good": "Óptima 🟢",
                "true": "Conectado", "false": "Caído"
            };
            return dic[String(txt).toLowerCase()] || txt;
        };

        // --- LÓGICA DE CLASIFICACIÓN (AND) ---
        
        let ticketSubject = "";
        let botReplyType = "";     
        let userMessageFront = ""; 
        let prioridad = "NORMAL";
        let estadoLogico = "";

        // CASO 1: Conectado (PPPoE UP)
        if (mkActive === true) {
            
            // Sub-evaluación: ¿Es estable y tiene buena señal?
            if (esEstable(mkUptime) && esBuenaSenal()) {
                // CASO 1.A: SERVICIO OK
                ticketSubject = "[LAN/WIFI] ENLACE OK - BAJA VEL";
                botReplyType = "generic_msg";
                userMessageFront = "El sistema indica que la señal llega perfecta y estable al módem. El problema es el WiFi o tu dispositivo interno.";
                prioridad = "BAJA";
                estadoLogico = "OK_STABLE";
            } else {
                // CASO 1.B: CONECTADO PERO INESTABLE / MALA SEÑAL
                // Acá NO le decimos que es su culpa.
                ticketSubject = `[ENLACE] INESTABLE / SEÑAL: ${onuSenalRaw}`;
                botReplyType = "generic_msg";
                userMessageFront = "Vemos que tenés conexión, pero detectamos inestabilidad en los parámetros de la fibra. Vamos a derivarlo a revisión técnica.";
                prioridad = "MEDIA";
                estadoLogico = "OK_UNSTABLE";
            }

        } else {
            // CASOS DE DESCONEXIÓN (PPPoE Down)

            if (onuEstadoNorm.includes('los')) {
                ticketSubject = "[CRITICO] CORTE FIBRA / LOS";
                botReplyType = "generic_msg";
                userMessageFront = "Detectamos un corte físico en la fibra óptica (luz roja). Requiere asistencia técnica.";
                prioridad = "ALTA";

            } else if (onuEstadoNorm.includes('power fail')) {
                ticketSubject = "[LOG] REINICIO POR POWERFAIL";
                botReplyType = "interaction_req"; 
                userMessageFront = "Detectamos posible falta de energía eléctrica en el equipo.";
                prioridad = "MEDIA";

            } else if (onuEstadoNorm.includes('online')) {
                ticketSubject = "[CONFIG] ERROR AUTH / VLAN";
                botReplyType = "generic_msg";
                userMessageFront = "Error de validación: El equipo prende pero no conecta a internet. Revisaremos la configuración.";
                prioridad = "ALTA";

            } else {
                // Offline genérico
                ticketSubject = "[LOG] REINICIO POR OFFLINE";
                botReplyType = "interaction_req"; 
                userMessageFront = "No logramos comunicarnos con el equipo.";
                prioridad = "MEDIA";
            }
        }

        // --- NOTA INTERNA TICKET ---
        const notaTecnica = `
--- 🤖 DIAGNÓSTICO AVANZADO ---
Cliente: ${pppoeUser}
Plan: ${planNombre}
Nodo: ${nodoInfo}

🔌 CONEXIÓN:
- PPPoE: ${mkActive ? 'ACTIVO ✅' : 'CAÍDO ❌'}
- IP: ${ipAddress}
- MAC: ${macAddress}
- Uptime: ${mkUptime} (Estable: ${esEstable(mkUptime) ? 'SI' : 'NO'})
- Ultimo Logout: ${mkLastLogOut}

📡 FIBRA (ONT):
- Estado: ${traducir(onuEstadoRaw)}
- Señal: ${onuSenalVal} (${traducir(onuSenalRaw)})

🏁 RESULTADO:
- Ticket: ${ticketSubject}
- Acción: ${botReplyType}
`;

        // Guardado
        user.set('ticket_nota_interna', notaTecnica);
        user.set('ticket_prioridad', prioridad);
        user.set('ticket_titulo_sugerido', ticketSubject);
        user.set('bot_reply_type', botReplyType);
        user.set('user_message_front', userMessageFront);

        bmconsole.log(`Diag: ${pppoeUser} | IP: ${ipAddress} | ${ticketSubject}`);

    } catch (err) {
        bmconsole.log(`Error: ${err.message}`);
        user.set('bot_reply_type', 'generic_msg');
        user.set('user_message_front', 'Error al consultar sistema. Derivando a humano.');
    }
}

main().then(() => result.done()).catch(() => result.done());