const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const firebase = require("firebase/compat/app");
require("firebase/compat/database");

// --- FIREBASE CONFIG ---
const firebaseConfig = {
    databaseURL: "https://solor-energy-default-rtdb.firebaseio.com"
};
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = "SOLOR_SECRET_786"; 

app.use(cors());
app.use(express.json());

let sock;
let isConnected = false;
let logs = [];

// --- LOGGING SYSTEM ---
function addLog(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.unshift(entry);
    if (logs.length > 50) logs.pop(); // 50 लॉग्स तक सेव रखेगा
    console.log(entry);
}

const AUTH_PATH = path.join(__dirname, 'auth_info');
const CREDS_PATH = path.join(AUTH_PATH, 'creds.json');

async function connectToWhatsApp() {
    addLog("Checking Cloud Sync...");
    
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    try {
        const snapshot = await db.ref("wa_auth/creds").once("value");
        if (snapshot.exists()) {
            fs.writeFileSync(CREDS_PATH, snapshot.val());
            addLog("✅ Session restored from Firebase.");
        } else {
            addLog("ℹ️ No previous session found in Cloud.");
        }
    } catch (e) { addLog("❌ Sync Error: Permission Denied or URL wrong."); }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        browser: ["Solor Server", "Chrome", "20.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        try {
            if (fs.existsSync(CREDS_PATH)) {
                const credsData = fs.readFileSync(CREDS_PATH, 'utf-8');
                await db.ref("wa_auth/creds").set(credsData);
                addLog("☁️ Session backed up to Firebase.");
            }
        } catch (e) { console.log("Upload failed"); }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            addLog(`🔴 Connection Lost. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) setTimeout(connectToWhatsApp, 5000);
        } else if (connection === 'open') {
            isConnected = true;
            addLog("🟢 SUCCESS: WhatsApp is Online!");
        }
    });

    // --- DASHBOARD UI WITH FULL LOGS ---
    app.get('/', (req, res) => {
        const logHtml = logs.map(l => `<div style="border-bottom:1px solid #333;padding:4px;">${l}</div>`).join('');
        
        let statusBox = ``;
        if (isConnected && sock?.user) {
            statusBox = `<div style="background:#dcfce7;color:#166534;padding:20px;border-radius:15px;"><h1>🟢 Active</h1><p>Linked to: ${sock.user.id.split(':')[0]}</p></div>`;
        } else {
            statusBox = `<div style="background:white;padding:25px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.05);">
                <h1>Link WhatsApp</h1>
                <input type="number" id="p" placeholder="916395..." style="width:80%;padding:12px;border:1px solid #ddd;border-radius:8px;margin-bottom:10px;">
                <button onclick="getCode()" id="b" style="padding:12px 25px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;font-weight:bold;">Get Pairing Code</button>
                <div id="c" style="margin-top:15px;font-size:30px;font-weight:800;letter-spacing:5px;color:#ec4899;"></div>
            </div>`;
        }

        res.send(`
            <body style="font-family:sans-serif;background:#f1f5f9;margin:0;padding:20px;display:flex;flex-direction:column;align-items:center;">
                <div style="width:100%;max-width:600px;text-align:center;">
                    ${statusBox}
                    <div style="margin-top:20px;background:#1e293b;color:#38bdf8;padding:15px;border-radius:15px;text-align:left;box-shadow:0 10px 20px rgba(0,0,0,0.2);">
                        <div style="display:flex;justify-content:space-between;border-bottom:1px solid #334155;padding-bottom:10px;margin-bottom:10px;">
                            <b style="color:white;">SYSTEM LOGS</b>
                            <span style="font-size:12px;color:#94a3b8;">Auto-refreshing...</span>
                        </div>
                        <div style="height:300px;overflow-y:auto;font-family:monospace;font-size:12px;line-height:1.5;">${logHtml}</div>
                    </div>
                </div>
                <script>
                    async function getCode(){
                        const num=document.getElementById('p').value;
                        if(!num) return alert('Enter number with 91');
                        document.getElementById('b').innerText='Requesting...';
                        const r=await fetch('/request-code?phone='+num);
                        const d=await r.json();
                        if(d.code){
                            document.getElementById('c').innerText=d.code;
                            document.getElementById('b').innerText='Verify in WhatsApp';
                        } else { alert('Error'); document.getElementById('b').innerText='Try Again'; }
                    }
                    setTimeout(() => location.reload(), 20000);
                </script>
            </body>
        `);
    });

    app.get('/uptime', (req, res) => res.json({ status: "alive", connected: isConnected }));

    app.get('/request-code', async (req, res) => {
        try { 
            const code = await sock.requestPairingCode(req.query.phone); 
            addLog(`Pairing requested for: ${req.query.phone}`);
            res.json({ code }); 
        } catch (e) { res.json({ error: e.message }); }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY) return res.status(403).json({ error: "Key Error" });
        if (!isConnected) return res.status(503).json({ error: "Offline" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { text: `☀️ *Solor Energy*\n\nYour OTP is: *${otp}*` });
            addLog(`✅ OTP ${otp} sent to ${phone}`);
            res.json({ status: "success" });
        } catch (e) { addLog(`❌ Send Error: ${e.message}`); res.status(500).json({ error: e.message }); }
    });
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log("Server Live"));