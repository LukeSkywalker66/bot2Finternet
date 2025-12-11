// AC_Resolver_Seleccion.js
async function resolverSeleccion() {
    
    // 1. Intentamos leer qué ID eligió la IA
    // Asumimos que la IA guardó su output en una variable 'ia_seleccion_json'
    // O si usaste "Parsear JSON" del bloque, quizás ya tengas una variable 'selected_id'.
    // Ajustá esto según cómo configures el bloque IA.
    
    const idSeleccionado = user.get('ia_selected_id'); 
    const mapaRaw = user.get('ctx_mapa_pppoe_oculto');

    if (!idSeleccionado || !mapaRaw) {
        if(typeof bmconsole !== 'undefined') bmconsole.log("❌ Error: Faltan datos para resolver la selección.");
        return;
    }

    try {
        const mapa = JSON.parse(mapaRaw);
        const usuarioReal = mapa[idSeleccionado];

        if (usuarioReal) {
            user.set('pppoeUser', usuarioReal);
            user.set('necesita_seleccion', 'false'); // Ya está resuelto
            if(typeof bmconsole !== 'undefined') bmconsole.log(`✅ Selección resuelta: ID ${idSeleccionado} -> User ${usuarioReal}`);
        } else {
            if(typeof bmconsole !== 'undefined') bmconsole.log(`❌ Error: El ID ${idSeleccionado} no existe en el mapa.`);
        }
    } catch (e) {
        if(typeof bmconsole !== 'undefined') bmconsole.log("Error parseando mapa:", e.message);
    }
}

// Wrapper para exportar/ejecutar
if (typeof module !== 'undefined' && module.exports) { module.exports = { resolverSeleccion }; }
else { resolverSeleccion().then(() => { if (typeof result !== 'undefined' && result.done) result.done(); }); }