const fs = require('fs');
const path = require('path');

const ruta = path.join(__dirname, '..', 'datoscliente.json'); // ajustá si es otra ruta
let raw = fs.readFileSync(ruta, 'utf8').trim();

function intentar(fn, etiqueta) {
  try { return fn(); } catch (e) { return { error: e, etiqueta }; }
}

// Caso A: el archivo ya es JSON válido
let pasoA = intentar(() => JSON.parse(raw), 'A(JSON directo)');
if (!pasoA.error) {
  console.log(JSON.stringify(pasoA, null, 2));
  process.exit(0);
}

// Normalización: asegurar que sea un string JS válido
// Si NO empieza y termina con comillas, lo envolvemos en comillas dobles
if (!(raw.startsWith('"') && raw.endsWith('"'))) {
  raw = `"${raw.replace(/"/g, '\\"')}"`;
}

// Paso 1: convertir el string con escapes a texto JSON sin escapes
const pasoB = intentar(() => JSON.parse(raw), 'B(parse string)');
if (pasoB.error) {
  console.error('Fallo al desescapar (B):', pasoB.error.message);
  process.exit(1);
}
const textoJSON = pasoB;

// Paso 2: convertir ese texto JSON a objeto
const pasoC = intentar(() => JSON.parse(textoJSON), 'C(parse objeto)');
if (pasoC.error) {
  console.error('Fallo al parsear objeto (C):', pasoC.error.message);
  process.exit(1);
}

const objeto = pasoC;
console.log(JSON.stringify(objeto, null, 2));