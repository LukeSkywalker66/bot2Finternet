const axios = require('axios');
const constGlobales = JSON.parse(context.userData.constants);

const BEHOLDER_BASEURL   = constGlobales.BEHOLDER_BASEURL;
const BEHOLDER_APIKEY = constGlobales.BEHOLDER_APIKEY;


const main = async () => {
  try {
    const numConexiones = parseInt(user.get('nNumConexiones') || "0", 10);

    if (numConexiones > 1) {
      // Más de una conexión → ticket directo
      user.set('diag_ticketNecesario', 'true');
      user.set('diag_diagnosticoEjecutado', 'false');
      bmconsole.log("Cliente con múltiples conexiones, se deriva a ticket.");
      return;
    }

    // Una sola conexión → ejecutar diagnóstico
    const clienteId = user.get('nIdCliente');
    const pppoeUser = user.get('pppoeUser'); // guardalo en el AC inicial

    // Beholder
    const oltResp = await axios.get(`${BEHOLDER_BASEURL}/diagnosis/${pppoeUser}`, {
      headers: { "x-api-key": BEHOLDER_APIKEY }
      
    });
    const oltData = oltResp.data;

    user.set('diag_onuEncendida', oltData.onu_powered ? 'true' : 'false');
    user.set('diag_onuOnline', oltData.onu_online ? 'true' : 'false');
    user.set('diag_rxPower', oltData.rx_power?.toString());

    user.set('diag_pppoeSesionActiva', mkData.active ? 'true' : 'false');

    user.set('diag_ticketNecesario', 'false');
    user.set('diag_diagnosticoEjecutado', 'true');

    bmconsole.log("Diagnóstico ejecutado:", {
      onuEncendida: oltData.onu_powered,
      onuOnline: oltData.onu_online,
      rxPower: oltData.rx_power,
      pppoeSesionActiva: mkData.active
    });

  } catch (err) {
    bmconsole.log("Error en diagnóstico:", err.message);
    user.set('diag_error', err.message);
  }
};

main().finally(result.done);