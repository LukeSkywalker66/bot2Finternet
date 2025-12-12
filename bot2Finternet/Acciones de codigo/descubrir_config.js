const axios = require('axios');

// REEMPLAZÁ CON TUS CREDENCIALES REALES
const CONFIG = {
    BASEURL: "https://online21.ispcube.com/api", 
    APIKEY: "99e5dd24-ca53-48c6-aa85-68a38e7301a7",
    USER: "api",
    PASS: "14cqcrzjEi2Vzf58Ijx7iUbM",
    CLIENTID: "423"
};

async function espiarIds() {
    try {
        console.log("🔐 Autenticando...");
        const auth = await axios.post(`${CONFIG.BASEURL}/sanctum/token`, 
            { username: CONFIG.USER, password: CONFIG.PASS },
            { headers: { 'api-key': CONFIG.APIKEY, 'client-id': CONFIG.CLIENTID, 'login-type': 'api' }}
        );
        const token = auth.data.token;
        
        const headers = { 
            'Authorization': `Bearer ${token}`, 
            'api-key': CONFIG.APIKEY, 
            'client-id': CONFIG.CLIENTID, 
            'login-type': 'api',
            'username': CONFIG.USER
        };

        // 1. ÁREAS (Soporte, Admin, etc.)
        console.log("\n📡 --- LISTADO DE ÁREAS ---");
        try {
            const areas = await axios.get(`${CONFIG.BASEURL}/tickets/areas_list`, { headers });
            console.table(areas.data.map(a => ({ ID: a.id, NOMBRE: a.name })));
        } catch (e) { console.log("Falló areas:", e.message); }

        // 2. CATEGORÍAS (Reclamo, Consulta, Cambio de Plan)
        console.log("\n📡 --- LISTADO DE CATEGORÍAS ---");
        try {
            const cats = await axios.get(`${CONFIG.BASEURL}/tickets/category_list`, { headers });
            console.table(cats.data.map(c => ({ ID: c.id, NOMBRE: c.name })));
        } catch (e) { console.log("Falló categorías:", e.message); }

        // 3. PRIORIDADES (Baja, Alta)
        console.log("\n📡 --- LISTADO DE PRIORIDADES ---");
        try {
            const prio = await axios.get(`${CONFIG.BASEURL}/tickets/priority_list`, { headers });
            console.table(prio.data.map(p => ({ ID: p.id, NOMBRE: p.name })));
        } catch (e) { console.log("Falló prioridades:", e.message); }

    } catch (e) {
        console.error("❌ Error General:", e.message);
    }
}

espiarIds();