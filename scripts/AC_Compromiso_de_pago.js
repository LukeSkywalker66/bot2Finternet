const axios = require('axios');
const constGlobales = JSON.parse(context.userData.constants);
const ISPCUBE_BASEURL = constGlobales.ISPCUBE_BASEURL;
const ISPCUBE_APIKEY = constGlobales.ISPCUBE_APIKEY;
const ISPCUBE_USER = constGlobales.ISPCUBE_USER;
const ISPCUBE_PASSWORD = constGlobales.ISPCUBE_PASSWORD;
const ISPCUBE_CLIENTID = constGlobales.ISPCUBE_CLIENTID;

const userID = user.get('nIdCliente');
const rawBlockDate = user.get('nFechadeBloqueo'); // "2025-11-13 19:54:24"
const normalizedBlockDate = rawBlockDate.replace(" ", "T") + "Z"; // "2025-11-13T19:54:24"
const blockDate = new Date(normalizedBlockDate);
// Convertir AAAAMMDD a DD/MM/YYYY para mostrar al cliente
function formatearFechaLegible(aaaammdd) {
  const yyyy = aaaammdd.substring(0,4);
  const mm = aaaammdd.substring(4,6);
  const dd = aaaammdd.substring(6,8);
  return `${dd}/${mm}/${yyyy}`;
}



// Función para calcular fecha límite
function calcularFechaLimiteDesdeBlockDate(blckDate) {
  if (!(blckDate instanceof Date) || isNaN(blckDate.getTime())) {
    throw new Error("Fecha de bloqueo inválida");
  }

  // 1. Fecha + 7 días
  const fechaMas7 = new Date(blckDate);
  fechaMas7.setDate(fechaMas7.getDate() + 7);

  // 2. Último día del mes
  const ultimoDiaMes = new Date(blckDate.getFullYear(), blckDate.getMonth() + 1, 0);

  // 3. Menor de ambos
  const fechaLimite = fechaMas7 < ultimoDiaMes ? fechaMas7 : ultimoDiaMes;

  // 4. Formatear AAAAMMDD
  const yyyy = fechaLimite.getFullYear();
  const mm = String(fechaLimite.getMonth() + 1).padStart(2, '0');
  const dd = String(fechaLimite.getDate()).padStart(2, '0');

  return `${yyyy}${mm}${dd}`;
}


const main = async () => {
  // 1. Obtener token
  const authResp = await axios.post(
    `${ISPCUBE_BASEURL}/sanctum/token`,
    {
      username: ISPCUBE_USER,
      password: ISPCUBE_PASSWORD,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'api-key': ISPCUBE_APIKEY,
        'client-id': ISPCUBE_CLIENTID,
        'login-type': 'api'
      }
    }
  );
  const token = authResp.data.token;

  // 2. Calcular fecha límite del compromiso
  const fechaLimiteCompromiso = calcularFechaLimiteDesdeBlockDate(blockDate);
  const fechaLegible = formatearFechaLegible(fechaLimiteCompromiso);
  bmconsole.log(fechaLimiteCompromiso + " - " + fechaLegible + " - " + blockDate);
  // 3. Payload del compromiso
  const data = {
    customer_id: userID,
    date: fechaLimiteCompromiso, // AAAAMMDD calculado
    apply_surcharge: false
  };

  // 4. POST del compromiso
  const compromisoResp = await axios.post(
    `${ISPCUBE_BASEURL}/customers/paycomm`,
    data,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'api-key': ISPCUBE_APIKEY,
        'client-id': ISPCUBE_CLIENTID,
        'login-type': 'api',
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'username': ISPCUBE_USER
      }
    }
  );

  bmconsole.log("Respuesta compromiso: " + JSON.stringify(compromisoResp.data));

  // 5. Si el compromiso fue exitoso, habilitar cliente
  if (compromisoResp.data && compromisoResp.data.success !== false) {
    const habilitarResp = await axios.put(
      `${ISPCUBE_BASEURL}/customers/${userID}`,
      { status: "enabled" },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'api-key': ISPCUBE_APIKEY,
          'client-id': ISPCUBE_CLIENTID,
          'login-type': 'api',
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'username': ISPCUBE_USER
        }
      }
    );

    bmconsole.log("Respuesta habilitación: " + JSON.stringify(habilitarResp.data));
    result.text("✅ Compromiso de pago registrado y cliente habilitado hasta el " + fechaLegible);
    user.set('compPagoFecha', fechaLimiteCompromiso);
  } else {
    result.text("⚠️ Compromiso registrado, pero no se pudo habilitar al cliente.");
  }
};

main()
  .catch(err => {
    const errorMessage = `[AC_Compromiso_de_pago] Error ${err.message}`;
    user.set('ca_error', errorMessage);
    bmconsole.log(errorMessage);

    if (err.response) {
      bmconsole.log("Status: " + err.response.status);
      bmconsole.log("Headers: " + JSON.stringify(err.response.headers));
      bmconsole.log("Data: " + JSON.stringify(err.response.data));
    } else if (err.request) {
      bmconsole.log("No hubo respuesta del servidor. Request: " + err.request);
    } else {
      bmconsole.log("Error al configurar la request: " + err.message);
    }

    result.text('⚠️ Hubo un problema al registrar el compromiso de pago.');
  })
  .finally(result.done);