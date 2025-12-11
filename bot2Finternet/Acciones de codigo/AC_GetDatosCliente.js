/// AC_GetDatosCliente.js

// 1. Imports seguros
let axios;
try { axios = require('axios'); } catch (e) {}

// 2. FUNCIÓN PRINCIPAL ENCAPSULADA
async function ejecutarGetDatosCliente() {

    // --- MOCK DE CONTEXTO DEFENSIVO ---
    const rawConst = (typeof context !== 'undefined' && context.userData) 
        ? context.userData.constants 
        : '{}';
    const constGlobales = JSON.parse(rawConst);

    // Constantes
    const ISPCUBE_BASEURL = constGlobales.ISPCUBE_BASEURL || 'http://mock';
    const ISPCUBE_APIKEY = constGlobales.ISPCUBE_APIKEY || '';
    const ISPCUBE_USER = constGlobales.ISPCUBE_USER || '';
    const ISPCUBE_PASSWORD = constGlobales.ISPCUBE_PASSWORD || '';
    const ISPCUBE_CLIENTID = constGlobales.ISPCUBE_CLIENTID || '';

    // 1. Normalizar DNI
    let rawDni = user.get('dni_ingresado') || '';
    let cleanDni = rawDni.replace(/\D/g, ''); 
    user.set('ingDNI', cleanDni);

    // Validar longitud
    if (cleanDni.length < 7 || cleanDni.length > 11) {
        if (typeof result !== 'undefined' && result.text) {
            result.text('El DNI ingresado no es válido (debe tener entre 7 y 11 números).');
        } else {
            console.log("❌ DNI Inválido");
        }
        return; 
    }

    try {
        // 2. Obtener Token
        const authResp = await axios.post(
            `${ISPCUBE_BASEURL}/sanctum/token`,
            { username: ISPCUBE_USER, password: ISPCUBE_PASSWORD },
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

        // 3. Consultar Cliente
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

        // ============================================================
        // NUEVO: LA CAJA FUERTE (Guardamos todo el JSON por las dudas)
        // ============================================================
        user.set('ctx_cliente_full_json', JSON.stringify(cliente));

        // 4. Guardar variables "Header" (Datos básicos)
        user.set('nIdCliente', cliente.id?.toString());
        user.set('nNombreCliente', cliente.name?.toString());
        user.set('nEstadoCuenta', cliente.status === 'enabled' ? 'Habilitado' : 'Suspendido');
        user.set('nDeudaCliente', cliente.debt?.toString());
        
        // Manejo defensivo de arrays para evitar crash en stringify
        user.set('nEtiquetasCliente', JSON.stringify(cliente.tags || []));
        user.set('compPagoFecha', JSON.stringify(cliente.paycomm || [])); 
        user.set('nFechadeBloqueo', cliente.block_date || '');

        // ============================================================
        // NUEVO: LÓGICA DE CONEXIONES E INTELIGENCIA ARTIFICIAL
        // ============================================================
        const conexiones = Array.isArray(cliente.connections) ? cliente.connections : [];
        const numConexiones = conexiones.length;
        
        user.set('nNumConexiones', numConexiones.toString());

        if (numConexiones === 1) {
            // --- CASO A: AUTOMÁTICO (1 sola casa) ---
            // Tomamos el user. En tu JSON de ejemplo el campo es "user", ponemos fallbacks por si cambia.
            const usuarioPPPoE = conexiones[0].user || conexiones[0].username || conexiones[0].radius_login || ''; 
            
            user.set('pppoeUser', usuarioPPPoE);
            user.set('necesita_seleccion', 'false'); // Bandera apagada
            user.set('ctx_lista_domicilios_texto', ''); // Limpiamos

            if(typeof bmconsole !== 'undefined') bmconsole.log(`✅ Única conexión auto-seleccionada: ${usuarioPPPoE}`);

        } else if (numConexiones > 1) {
            // --- CASO B: MULTI-DOMICILIO (Preparamos datos para la IA) ---
            
            // Creamos una lista de texto que la IA pueda leer y entender.
            // Formato: "USER_ID | DIRECCION | PLAN"
            // 1. EL DICCIONARIO OCULTO (ID -> PPPoE)
            // Clave: ID de conexión (ej: 11460) -> Valor: Usuario Técnico (ej: avlsosa)
            const mapaLookup = {};
            
            // 2. LA LISTA PÚBLICA (Para la IA y el Cliente)
            const listaParaIA = conexiones.map(c => {
                const idSeguro = c.id; // El ID único de base de datos
                const direccion = c.address || "Domicilio sin registrar";
                // Como no tenemos el nombre del plan, usamos el ID solo como referencia técnica si hiciera falta
                // o simplemente lo omitimos para no confundir. Acá lo dejo como 'Plan Ref'.
                const planRef = c.plan_id || "-"; 
                
                // Llenamos el mapa secreto
                mapaLookup[idSeguro] = c.user || c.username || c.radius_login; 
                
                // Retornamos texto limpio para el Prompt
                return `ID_REF: ${idSeguro} | DIRECCION: ${direccion} | PLAN_ID: ${planRef}`;
            }).join('\n');

            // GUARDAMOS
            user.set('ctx_lista_domicilios_texto', listaParaIA); // Lo que lee la IA
            user.set('ctx_mapa_pppoe_oculto', JSON.stringify(mapaLookup)); // La "Caja Fuerte"
            
            user.set('necesita_seleccion', 'true');
            user.set('pppoeUser', ''); // Borramos para obligar a seleccionar

            if(typeof bmconsole !== 'undefined') {
                bmconsole.log(`⚠️ Multi-conexión. Mapa generado para ${conexiones.length} servicios.`);
            }
        } else {
            // --- CASO C: SIN SERVICIO ---
            user.set('pppoeUser', '');
            user.set('necesita_seleccion', 'false');
            user.set('nEstadoCuenta', 'Sin Conexiones Activas');
        }

        if(typeof bmconsole !== 'undefined') bmconsole.log(`Cliente procesado: ${cliente.name}`);

    } catch (err) {
        const errorMessage = `[GET_CLIENTE] Error: ${err.message}`;
        user.set('ca_error', errorMessage);
        
        if(typeof bmconsole !== 'undefined') {
            bmconsole.log(errorMessage);
            if (err.response) {
                bmconsole.log("Data Error: " + JSON.stringify(err.response.data));
            }
        }

        if (typeof result !== 'undefined' && result.text) {
            result.text('Hubo un problema al validar tus datos. Por favor intentá mas tarde.');
        }
    }
}

// 3. EXPORTAR O EJECUTAR (Híbrido)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ejecutarGetDatosCliente };
} else {
    ejecutarGetDatosCliente().then(() => {
        if (typeof result !== 'undefined' && result.done) result.done();
    }).catch(err => {
        if (typeof result !== 'undefined' && result.done) result.done();
    });
}