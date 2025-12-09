const fs = require('fs');

const raw = fs.readFileSync('datoscliente.json', 'utf8');

// Saca la primera y última comilla si existen
const cleaned = raw.trim().replace(/^"|"$/g, '');

const parsed = JSON.parse(cleaned);
console.log(JSON.stringify(parsed, null, 2));
