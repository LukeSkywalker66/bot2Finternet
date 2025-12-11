// test_local.js
const { ejecutarGetDatosCliente } = require('./AC_GetDatosCliente');
const { ejecutarDiagnostico } = require('./AC_Diagnostico_cliente');

// --- CONFIGURACIÓN DEL ESCENARIO ---
const DNI_PRUEBA = "40683956"; // Poné el DNI de la clienta con 2 casas para probar el selector
// const DNI_PRUEBA = "12345678"; // Poné un DNI de 1 casa para probar flujo directo

// Credenciales (Copiá las reales acá para que funcione local)
const CONFIG = {
    // BEHOLDER
    BEHOLDER_BASEURL: "http://138.59.172.24:8500",
    BEHOLDER_APIKEY: "Zo9fUbuGS5QhJUi8k4zvydAOrHBcBsZx9vz67Woy4Bk9PVSql1rjycpoI2yrajd8",
    
    // ISPCUBE (Llenar con los datos reales que tenías en tu script)
    ISPCUBE_BASEURL: "https://online21.ispcube.com/api", 
    ISPCUBE_APIKEY: "99e5dd24-ca53-48c6-aa85-68a38e7301a7",
    ISPCUBE_USER: "api",
    ISPCUBE_PASSWORD: "14cqcrzjEi2Vzf58Ijx7iUbM",
    ISPCUBE_CLIENTID: "423"
};

// 1. SIMULADOR DE MEMORIA 
const memoriaUsuario = {
    'dni_ingresado': DNI_PRUEBA
};

// 2. MOCKS GLOBALES
global.user = {
    get: (key) => memoriaUsuario[key],
    set: (key, value) => {
        console.log(`💾 [GUARDAR] ${key} =`, (typeof value === 'string' && value.length > 50) ? value.substring(0,20)+"..." : value);
        memoriaUsuario[key] = value;
    }
};

global.context = {
    userData: { constants: JSON.stringify(CONFIG) }
};

global.bmconsole = { log: (...args) => console.log('🤖 [LOG]:', ...args) };

global.result = {
    text: (msg) => console.log(`💬 [BOT DICE]: "${msg}"`),
    done: () => {}
};

// 3. ORQUESTADOR DE PRUEBA
async function correrPruebaIntegrada() {
    console.clear();
    console.log(`🎬 INICIANDO PRUEBA INTEGRAL PARA DNI: ${DNI_PRUEBA}`);
    console.log("==================================================");

    // --- PASO 1: OBTENER DATOS ---
    console.log("\n1️⃣  Ejecutando AC_GetDatosCliente...");
    await ejecutarGetDatosCliente();

    // --- INTERMEDIO: SIMULACIÓN DE IA / SELECCIÓN ---
    console.log("\n2️⃣  Analizando resultados del Paso 1...");
    
    // Verificamos si pidió selección
    if (memoriaUsuario['necesita_seleccion'] === 'true') {
        
        // 1. Simulamos que la IA eligió un ID (NO un usuario)
        // Sacamos el ID 15127 del JSON de prueba que tenemos en mente
        const idSimuladoIA = "15127"; 
        console.log(`🤖 [IA SIMULADA]: Eligió el ID ${idSimuladoIA}`);
        
        memoriaUsuario['ia_selected_id'] = idSimuladoIA;

        // 2. Ejecutamos el Resolver (El script nuevo)
        await resolverSeleccion(); 
        
        // Ahora memoriaUsuario['pppoeUser'] debería tener el valor correcto
    }
        
    else {
        console.log("✅  DETECTADO DOMICILIO ÚNICO (O SIN SERVICIO).");
        console.log(`👉  Usuario PPPoE: ${memoriaUsuario['pppoeUser']}`);
    }

    // --- PASO 3: DIAGNÓSTICO ---
    if (memoriaUsuario['pppoeUser']) {
        console.log("\n3️⃣  Ejecutando AC_Diagnostico_cliente...");
        await ejecutarDiagnostico();

        console.log("\n🏁  --- RESULTADO FINAL DEL DIAGNÓSTICO ---");
        console.log("STATUS:", memoriaUsuario['diag_status_code']);
        console.log("TEXTO BOT:\n", memoriaUsuario['bot_respuesta_texto']);
    } else {
        console.log("\n⛔  No se ejecuta diagnóstico (No hay pppoeUser o no es cliente).");
    }
}

correrPruebaIntegrada();