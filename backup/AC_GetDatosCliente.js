const axios = require('axios');
const constGlobales = JSON.parse(context.userData.constants);
const ISPCUBE_BASEURL = constGlobales.ISPCUBE_BASEURL;
const ISPCUBE_APIKEY = constGlobales.ISPCUBE_APIKEY;
const ISPCUBE_USER = constGlobales.ISPCUBE_USER;
const ISPCUBE_PASSWORD = constGlobales.ISPCUBE_PASSWORD;
const ISPCUBE_CLIENTID = constGlobales.ISPCUBE_CLIENTID;

const main = async () => {
  // 1. Normalizar DNI ingresado
  //let dni_ing = user.get('dni_ingresado');
  //result.text(dni_ing);
  let rawDni = user.get('dni_ingresado') || '';
  let cleanDni = rawDni.replace(/\D/g, ''); // elimina todo lo que no sea número
  //result.text(cleanDni);
  user.set('ingDNI', cleanDni);
  
  // Validar longitud (ejemplo: 7 a 8 dígitos en Argentina)
  if (cleanDni.length < 7 || cleanDni.length > 11) {
    result.text('El DNI ingresado no es válido. Por favor, revisalo.');
    return;
  }
  //result.text(context.userData.constants.ISPCUBE_BASEURL);
  // 2. Obtener token desde ISPCube
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

  // 3. Consultar cliente por DNI
  const clienteResp = await axios.get(
    `${ISPCUBE_BASEURL}/customer/?doc_number=${cleanDni}`,
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'api-key': ISPCUBE_APIKEY,
        'client-id': ISPCUBE_CLIENTID,
        'login-type': 'api',
        'Accept': 'application/json',
        'username': ISPCUBE_USER
      }
    }
  );

  const cliente = clienteResp.data;

  // 4. Guardar variables en sesión
  user.set('nIdCliente', cliente.id?.toString());
  user.set('nNombreCliente', cliente.name?.toString());
  user.set('nEstadoCuenta', cliente.status === 'enabled' ? 'Habilitado' : 'Suspendido');
  user.set('nDeudaCliente', cliente.debt?.toString());
  user.set('nEtiquetasCliente', JSON.stringify(cliente.tags || []));
  user.set('compPagoFecha', cliente.paycomm || []);
  user.set('nFechadeBloqueo', cliente.block_date || []);
  // NUEVO: cantidad de conexiones
  const numConexiones = Array.isArray(cliente.connections) ? cliente.connections.length : 0;
  user.set('nNumConexiones', numConexiones.toString());

  
  bmconsole.log(JSON.stringify(cliente));
  // 5. Mensaje de confirmación
  //result.text(`Cliente encontrado: ${cliente.name}. Estado: ${cliente.status}`);
};

main()
  .catch(err => {
    // Mensaje genérico
    const errorMessage = `[CA_NAME] Error ${err.message}`;
    user.set('ca_error', errorMessage);
    bmconsole.log(errorMessage);

    // Logs extendidos para depuración
    if (err.response) {
      bmconsole.log("Status: " + err.response.status);
      bmconsole.log("Headers: " + JSON.stringify(err.response.headers));
      bmconsole.log("Data: " + JSON.stringify(err.response.data));
    } else if (err.request) {
      bmconsole.log("No hubo respuesta del servidor. Request: " + err.request);
    } else {
      bmconsole.log("Error al configurar la request: " + err.message);
    }

    // Mensaje al usuario final
    result.text('No pudimos validar tu DNI en este momento. Intentalo más tarde.');
  })
  .finally(result.done);

