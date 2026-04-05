const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const firebase = require("firebase/compat/app");
require("firebase/compat/database");

// --- FIREBASE SETUP (FIXED) ---
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

function addLog(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.unshift(entry);
    if (logs.length > 30) logs.pop();
    console.log(entry);
}

const AUTH_PATH = path.join(__dirname, 'auth_info');
const CREDS_PATH = path.join(AUTH_PATH, 'creds.json');

async function connectToWhatsApp() {
    addLog("Syncing Session with Firebase...");
    
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    try {
        // Firebase से पुराना सेशन डाउनलोड करना
        const snapshot = await db.ref("wa_auth/creds").once("value");
        if (snapshot.exists()) {
            fs.writeFileSync(CREDS_PATH, snapshot.val());
            addLog("✅ Session restored from Cloud.");
        }
    } catch (e) { addLog("No cloud backup found or Permission denied."); }

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

    // क्रेडेंशियल अपडेट होने पर Firebase में ऑटो-सेव करना
    sock.ev.on('creds.update', async () => {
        await saveCreds();
        try {
            if (fs.existsSync(CREDS_PATH)) {
                const credsData = fs.readFileSync(CREDS_PATH, 'utf-8');
                await db.ref("wa_auth/creds").set(credsData);
            }
        } catch (e) { console.log("Firebase sync error"); }
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            addLog(`❌ Closed. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(), 5000);
        } else if (connection === 'open') {
            isConnected = true;
            addLog("✅ WhatsApp Connected!");
        }
    });

    // Dashboard UI
    app.get('/', (req, res) => {
        const logHtml = logs.map(l => `<div style="font-family:monospace;padding:5px;border-bottom:1px solid #eee;">${l}</div>`).join('');
        if (isConnected && sock?.user) {
            res.send(`<body style="text-align:center;font-family:sans-serif;background:#f0fdf4;padding:20px;"><div style="background:white;padding:30px;border-radius:20px;max-width:500px;margin:auto;box-shadow:0 10px 20px rgba(0,0,0,0.05);"><h1 style="color:#16a34a;">🟢 SERVER ACTIVE</h1><p>Number: <b>${sock.user.id.split(':')[0]}</b></p><hr><div style="text-align:left;height:150px;overflow-y:auto;background:#f8fafc;padding:10px;">${logHtml}</div></div></body>`);
        } else {
            res.send(`<body style="text-align:center;font-family:sans-serif;background:#f1f5f9;padding:20px;"><div style="background:white;padding:30px;border-radius:20px;max-width:400px;margin:auto;box-shadow:0 10px 20px rgba(0,0,0,0.1);"><h1>Link WhatsApp</h1><input type="number" id="n" placeholder="91..." style="width:100%;padding:15px;margin-bottom:15px;border:1px solid #ddd;border-radius:10px;"><button onclick="g()" id="b" style="width:100%;padding:15px;background:#6366f1;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">Get Code</button><div id="c" style="margin-top:20px;font-size:35px;font-weight:800;letter-spacing:5px;color:#ec4899;"></div></div><script>async function g(){const num=document.getElementById('n').value;if(!num)return alert('91?');document.getElementById('b').innerText='Loading...';const r=await fetch('/request-code?phone='+num);const d=await r.json();document.getElementById('c').innerText=d.code||'Error';document.getElementById('b').innerText='Verify in WhatsApp';}</script></body>`);
        }
    });

    app.get('/request-code', async (req, res) => {
        try { const code = await sock.requestPairingCode(req.query.phone); res.json({ code }); } 
        catch (e) { res.json({ error: e.message }); }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY || !isConnected) return res.status(403).json({ status: "error" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { text: `☀️ *Solor Energy Verification*\n\nYour OTP is: *${otp}*` });
            addLog(`✅ OTP sent to ${phone}`);
            res.json({ status: "success" });
        } catch (e) { addLog(`Error: ${e.message}`); res.status(500).json({ error: e.message }); }
    });

    app.get('/uptime', (req, res) => res.json({ status: "alive" }));
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log("Server Live"));