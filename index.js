const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const firebase = require("firebase/compat/app");
require("firebase/compat/database");

const firebaseConfig = { databaseURL: "https://solor-energy-default-rtdb.firebaseio.com" };
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
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
    if (logs.length > 50) logs.pop();
    console.log(entry);
}

const AUTH_PATH = path.join(__dirname, 'auth_info');
const CREDS_PATH = path.join(AUTH_PATH, 'creds.json');

async function connectToWhatsApp() {
    addLog("Initializing WhatsApp Connection...");
    
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    try {
        const snapshot = await db.ref("wa_auth/creds").once("value");
        if (snapshot.exists() && !fs.existsSync(CREDS_PATH)) {
            fs.writeFileSync(CREDS_PATH, snapshot.val());
            addLog("📥 Session backup downloaded from Firebase.");
        }
    } catch (e) { addLog("Firebase Sync Info: No backup found."); }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        browser: ["Solor OTP", "Chrome", "20.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        try {
            if (fs.existsSync(CREDS_PATH)) {
                const credsData = fs.readFileSync(CREDS_PATH, 'utf-8');
                await db.ref("wa_auth/creds").set(credsData);
            }
        } catch (e) {}
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect.error?.output?.statusCode || lastDisconnect.error?.output?.payload?.statusCode;
            
            addLog(`🔴 Disconnected. Status: ${statusCode}`);

            // अगर सेशन खराब है (401 Unauthorized), तो डेटा डिलीट करें
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                addLog("⚠️ Session Expired! Clearing data...");
                if (fs.existsSync(CREDS_PATH)) fs.unlinkSync(CREDS_PATH);
                await db.ref("wa_auth").remove();
                setTimeout(connectToWhatsApp, 3000);
            } else {
                addLog("🔄 Attempting to Reconnect...");
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            isConnected = true;
            addLog("🟢 SUCCESS: WhatsApp Connected!");
        }
    });

    app.get('/', (req, res) => {
        const logHtml = logs.map(l => `<div style="border-bottom:1px solid #333;padding:4px;">${l}</div>`).join('');
        let ui = ``;
        if (isConnected) {
            ui = `<div style="background:#dcfce7;color:#166534;padding:20px;border-radius:15px;"><h1>🟢 Online</h1><p>Linked: ${sock.user.id.split(':')[0]}</p><button onclick="location.href='/logout'" style="background:#ef4444;color:white;border:none;padding:10px 20px;border-radius:8px;cursor:pointer;">Logout & Reset</button></div>`;
        } else {
            ui = `<div style="background:white;padding:25px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.1);"><h1>Link Account</h1><input type="number" id="p" placeholder="91..." style="width:80%;padding:12px;margin-bottom:10px;"><button onclick="getCode()" id="b" style="padding:12px 25px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;">Get Code</button><div id="c" style="margin-top:15px;font-size:32px;font-weight:800;color:#ec4899;"></div></div>`;
        }
        res.send(`<body style="font-family:sans-serif;background:#f1f5f9;padding:20px;display:flex;flex-direction:column;align-items:center;"><div style="width:100%;max-width:600px;text-align:center;">${ui}<div style="margin-top:20px;background:#1e293b;color:#38bdf8;padding:15px;border-radius:15px;text-align:left;height:300px;overflow-y:auto;font-family:monospace;font-size:12px;">${logHtml}</div></div><script>async function getCode(){const num=document.getElementById('p').value;if(!num)return alert('91?');document.getElementById('b').innerText='Requesting...';const r=await fetch('/request-code?phone='+num);const d=await r.json();if(d.code){document.getElementById('c').innerText=d.code;document.getElementById('b').innerText='Enter Code in WhatsApp';}else{alert('Error: '+d.message);document.getElementById('b').innerText='Try Again';}}</script></body>`);
    });

    app.get('/logout', async (req, res) => {
        if (fs.existsSync(CREDS_PATH)) fs.unlinkSync(CREDS_PATH);
        await db.ref("wa_auth").remove();
        res.send("Session Cleared. <a href='/'>Go Back</a>");
        process.exit(0); // Restart server
    });

    app.get('/request-code', async (req, res) => {
        const phone = req.query.phone;
        try {
            const code = await sock.requestPairingCode(phone);
            addLog(`Pairing Code: ${code} for ${phone}`);
            res.json({ status: "success", code });
        } catch (e) {
            addLog(`Error: ${e.message}`);
            res.json({ status: "error", message: e.message });
        }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY || !isConnected) return res.status(403).json({ status: "error" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { text: `☀️ *Solor Energy*\n\nYour OTP: *${otp}*` });
            addLog(`✅ OTP sent to ${phone}`);
            res.json({ status: "success" });
        } catch (e) { res.status(500).json({ error: e.message }); }
    });
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log("Server Live"));