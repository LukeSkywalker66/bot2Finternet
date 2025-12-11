// pretty_json.js
const fs = require('fs');

try {
    // 1. Leemos el archivo sucio
    let rawContent = fs.readFileSync('dump.txt', 'utf8').trim();

    // 2. Limpieza heurística de comillas escapadas
    // Si el texto empieza con " y termina con ", es probable que sea un string JSONificado(un json stringificado)
    if (rawContent.startsWith('"') && rawContent.endsWith('"')) {
        // Parseamos una vez para sacarle la capa de string
        rawContent = JSON.parse(rawContent);
    }

    // 3. Intentamos parsear a Objeto (si todavía es string)
    let jsonObject;
    if (typeof rawContent === 'string') {
        jsonObject = JSON.parse(rawContent);
    } else {
        jsonObject = rawContent;
    }

    // 4. IMPRIMIR LINDO (El 2 es la cantidad de espacios de indentación)
    console.log(JSON.stringify(jsonObject, null, 2));

} catch (e) {
    console.error("❌ No se pudo parsear el JSON.");
    console.error("Error:", e.message);
    console.log("\n--- Contenido Crudo Intentado ---");
    // console.log(rawContent); // Descomentar si querés ver qué falló
}