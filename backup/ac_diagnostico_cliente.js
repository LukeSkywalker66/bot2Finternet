/* const axios = require('axios');
const constGlobales = JSON.parse(context.userData.constants);

const BEHOLDER_BASEURL   = constGlobales.BEHOLDER_BASEURL;
const BEHOLDER_APIKEY = constGlobales.BEHOLDER_APIKEY;


const main = async () => {
  try {
    const numConexiones = parseInt(user.get('nNumConexiones') || "0", 10);

    if (numConexiones > 1) {
      // Más de una conexión → ticket directo ya que no se puede diagnosticar bien sin saber cuál es la correcta
      user.set('diag_ticketNecesario', 'true');
      user.set('diag_diagnosticoEjecutado', 'false');
      //crear el json de ticket listo para cargar
      //
      // 
      bmconsole.log("Cliente con múltiples conexiones, se deriva a ticket.");
      return;
    }

    // Una sola conexión → ejecutar diagnóstico normalmente
    //const clienteId = user.get('nIdCliente');
    const pppoeUser = user.get('pppoeUser'); // guardalo en el AC inicial

    // Beholder api de diagnóstico
    const diagResp = await axios.get(`${BEHOLDER_BASEURL}/diagnosis/${pppoeUser}`, {
      headers: { "x-api-key": BEHOLDER_APIKEY }
      
    });
    const diagData = diagResp.data;

    user.set('diag_onuEstado', diagData.data?.onu_status_smrt?.onu_status || 'desconocido');
    user.set('diag_onuSeñal', diagData.data?.onu_signal_smrt?.onu_signal || 'desconocido');
    user.set('diag_pppoe_estado', diagData.rx_power?.toString());

    user.set('diag_pppoeSesionActiva', diagData.active ? 'true' : 'false');

    //user.set('diag_ticketNecesario', 'false');
    user.set('diag_diagnosticoEjecutado', 'true');

    bmconsole.log("Diagnóstico ejecutado:", {diagData});

  } catch (err) {
    bmconsole.log("Error en diagnóstico:", err.message);
    user.set('diag_error', err.message);
  }
};

main().finally(result.done); */





const axios = require('axios');
const constGlobales = JSON.parse(context.userData.constants);

const BEHOLDER_BASEURL = constGlobales.BEHOLDER_BASEURL;
const BEHOLDER_APIKEY  = constGlobales.BEHOLDER_APIKEY;

// 1. Diccionario de Traducciones (Tu "OutputBox" adaptado al backend)
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
    // Devuelve la traducción o el valor original si no existe
    return diccionario[String(valor)] || valor;
};

const main = async () => {
  try {
    const numConexiones = parseInt(user.get('nNumConexiones') || "0", 10);
    const pppoeUser = user.get('pppoeUser'); 

    // --- CASO 1: Múltiples Conexiones ---
    if (numConexiones > 1) {
      user.set('diag_status_code', 'CRITICO'); // Forzamos camino de ticket
      user.set('ticket_categoria', 'SOPORTE_COMPLEJO');
      user.set('ticket_resumen_tecnico', `CLIENTE CON ${numConexiones} CONEXIONES - REQUIERE REVISIÓN MANUAL`);
      user.set('bot_respuesta_texto', 'Veo que tenés múltiples conexiones activas. Para no cometer errores, voy a generar un ticket para que un técnico revise puntualmente tu caso.');
      
      bmconsole.log("Cliente con múltiples conexiones, derivado.");
      return;
    }

    // --- CASO 2: Diagnóstico Beholder ---
    // Nota: Ajusta la URL según tu API real. Asumo GET /diagnosis/{user}
    const diagResp = await axios.get(`${BEHOLDER_BASEURL}/diagnosis/${pppoeUser}`, {
      headers: { "x-api-key": BEHOLDER_APIKEY }
    });
    
    // El JSON que me pasaste es la respuesta directa, no tiene un wrapper "data" extra
    const data = diagResp.data; 

    // Extraemos valores clave protegiendo nulos con ?.
    const onuEstadoRaw  = data.onu_status_smrt?.onu_status || 'Offline';
    const onuSenalRaw   = data.onu_signal_smrt?.onu_signal || 'Unknown';
    const onuSenalVal   = data.onu_signal_smrt?.onu_signal_value || '-';
    const mkActive      = data.mikrotik?.active || false;
    const mkUptime      = data.mikrotik?.uptime || '0s';
    const clienteNombre = data.cliente_nombre || 'Cliente';
    const nodoNombre    = data.nodo_nombre || '-';

    // Traducimos para humanos
    const textoOnuEstado = traducir(onuEstadoRaw);
    const textoOnuSenal  = traducir(onuSenalRaw);
    const textoMkEstado  = mkActive ? "Conectado a Internet" : "Sin acceso a Internet";

    // --- EL CEREBRO: Lógica de Veredicto ---
    let statusCode = "OK"; // OK | LOGICO | CRITICO
    let botMensaje = "";
    let ticketPrioridad = "NORMAL";

    // Regla A: Corte Físico (ONU no está online o Señal Crítica)
    if (onuEstadoRaw !== 'Online' || onuSenalRaw === 'Critical' || onuEstadoRaw === 'LOS') {
        statusCode = "CRITICO";
        ticketPrioridad = "ALTA";
        botMensaje = `Detecté un problema físico en tu conexión. El equipo figura como "${textoOnuEstado}" y la señal es "${textoOnuSenal}". Es probable que necesitemos visita técnica.`;
    
    // Regla B: Problema Lógico (ONU bien, pero Mikrotik desconectado)
    } else if (!mkActive) {
        statusCode = "LOGICO";
        botMensaje = `Tu equipo de fibra está bien (${textoOnuEstado}), pero no está estableciendo conexión a internet. Puede ser un problema de configuración del router.`;
    
    // Regla C: Todo OK (Falso Positivo / Problema WiFi)
    } else {
        statusCode = "OK";
        botMensaje = `Hice un chequeo y tu línea se ve perfecta.
🟢 Equipo Fibra: ${textoOnuEstado}
🟢 Señal: ${textoOnuSenal} (${onuSenalVal})
🟢 Estado: Conectado hace ${mkUptime}

Si tenés problemas, probablemente sea el WiFi o un dispositivo específico.`;
    }

    // --- SALIDA 1: Variables para el BOT (Lo que dice al usuario) ---
    user.set('diag_status_code', statusCode); // Usar esto en el Rombo Botmaker
    user.set('bot_respuesta_texto', botMensaje); // Mensaje dinámico

    // --- SALIDA 2: Variables para el TICKET (Lo que lee el técnico) ---
    // Armamos el bloque de texto técnico formateado
    const technicalContext = `
--- DIAGNÓSTICO AUTOMÁTICO ---
CLIENTE: ${clienteNombre}
PLAN: ${data.plan}
NODO: ${nodoNombre} (${data.nodo_ip})

ONU ESTADO: ${textoOnuEstado} (${data.onu_status_smrt?.last_status_change})
SEÑAL: ${textoOnuSenal} [${onuSenalVal}]
MIKROTIK: ${textoMkEstado} (Uptime: ${mkUptime})
IP ASIGNADA: ${data.mikrotik?.address || '-'}
MAC: ${data.mikrotik?.['caller-id'] || '-'}
`;

    user.set('ticket_resumen_tecnico', technicalContext);
    user.set('ticket_prioridad', ticketPrioridad);
    user.set('ticket_categoria', statusCode === 'CRITICO' ? 'SOPORTE_TECNICO' : 'RECLAMO_SERVICIO');

    bmconsole.log("Diagnóstico Finalizado:", { statusCode, cliente: pppoeUser });

  } catch (err) {
    bmconsole.log("Error CRITICO en diagnóstico:", err.message);
    // En caso de error de API, mandamos a ticket genérico para no dejar tirado al usuario
    user.set('diag_status_code', 'ERROR_API'); 
    user.set('bot_respuesta_texto', 'No pude conectar con el sistema de diagnóstico automático, pero voy a tomar tu reclamo manualmente.');
    user.set('ticket_resumen_tecnico', `ERROR API BEHOLDER: ${err.message}`);
  }
};

main().finally(result.done);