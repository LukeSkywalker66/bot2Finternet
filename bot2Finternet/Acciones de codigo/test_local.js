// test_local.js
const { ejecutarDiagnostico } = require('./AC_Diagnostico_cliente');

// --- CONFIGURACIÓN DE PRUEBA ---
const USUARIO_PRUEBA = "usuarioprueba"; // <--- PONÉ UN USUARIO REAL ACÁ
const API_URL = "http://138.59.172.24:8500";   // <--- PONÉ LA URL REAL DE BEHOLDER ACÁ
const API_KEY = "Zo9fUbuGS5QhJUi8k4zvydAOrHBcBsZx9vz67Woy4Bk9PVSql1rjycpoI2yrajd8";                    // <--- PONÉ LA KEY REAL ACÁ

// 1. SIMULADOR DE MEMORIA (Acá se guardan las variables como hace Botmaker)
const memoriaUsuario = {
    'pppoeUser': USUARIO_PRUEBA,
    'nNumConexiones': '1'
};

// 2. MOCK GLOBAL DE OBJETOS BOTMAKER
global.user = {
    get: (key) => {
        // console.log(`🔎 [LEER] ${key}: ${memoriaUsuario[key]}`);
        return memoriaUsuario[key];
    },
    set: (key, value) => {
        console.log(`💾 [GUARDAR VARIABLE] ${key} =`, value); // Esto te muestra qué decidió el bot
        memoriaUsuario[key] = value;
    }
};

global.context = {
    userData: {
        constants: JSON.stringify({
            BEHOLDER_BASEURL: API_URL,
            BEHOLDER_APIKEY: API_KEY
        })
    }
};

global.bmconsole = {
    log: (...args) => console.log('🤖 [LOG BOT]:', ...args)
};

// 3. EJECUTAR PRUEBA
console.log("--- INICIANDO DIAGNÓSTICO LOCAL ---");

ejecutarDiagnostico().then(() => {
    console.log("\n--- RESULTADO FINAL (Simulación terminada) ---");
    console.log("STATUS CODE DECIDIDO:", memoriaUsuario['diag_status_code']);
    console.log("MENSAJE AL USUARIO:\n", memoriaUsuario['bot_respuesta_texto']);
});