const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const firebase = require("firebase/compat/app");
require("firebase/compat/database");

// --- FIREBASE CONFIG ---
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
    addLog("WhatsApp Connection Shuru Ho Rahi Hai...");
    
    if (!fs.existsSync(AUTH_PATH)) fs.mkdirSync(AUTH_PATH, { recursive: true });

    try {
        const snapshot = await db.ref("wa_auth/creds").once("value");
        if (snapshot.exists() && !fs.existsSync(CREDS_PATH)) {
            fs.writeFileSync(CREDS_PATH, snapshot.val());
            addLog("✅ Firebase se purana session mil gaya.");
        }
    } catch (e) { addLog("Firebase backup check failed."); }

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_PATH);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        // Pairing code ke liye ye browser setting sabse best hai
        browser: ["Chrome (Linux)", "Chrome", "110.0.5481.177"],
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
            addLog(`🔴 Connection band ho gaya. Status: ${statusCode}`);

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                addLog("⚠️ Session expire ho gaya! Sab data saaf kar rahe hain...");
                if (fs.existsSync(CREDS_PATH)) fs.unlinkSync(CREDS_PATH);
                await db.ref("wa_auth").remove();
                setTimeout(connectToWhatsApp, 3000);
            } else {
                addLog("🔄 Fir se connect karne ki koshish...");
                setTimeout(connectToWhatsApp, 5000);
            }
        } else if (connection === 'open') {
            isConnected = true;
            addLog("🟢 SUCCESS: WhatsApp Link Ho Gaya!");
        }
    });

    // --- API ROUTES ---

    app.get('/', (req, res) => {
        const logHtml = logs.map(l => `<div style="border-bottom:1px solid #333;padding:4px;">${l}</div>`).join('');
        let content = "";

        if (isConnected) {
            content = `
            <div style="background:#dcfce7;color:#166534;padding:25px;border-radius:15px;box-shadow:0 5px 15px rgba(0,0,0,0.05);">
                <h1>🟢 WhatsApp Active</h1>
                <p>Number: <b>${sock.user.id.split(':')[0]}</b></p>
                <button onclick="location.href='/logout'" style="background:#ef4444;color:white;border:none;padding:12px 25px;border-radius:8px;cursor:pointer;font-weight:bold;">Logout & Reset Server</button>
            </div>`;
        } else {
            content = `
            <div style="background:white;padding:30px;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.1);">
                <h1 style="color:#6366f1;">Link WhatsApp</h1>
                <p style="color:#64748b;">WhatsApp number 91 ke saath dalein (Ex: 919876543210)</p>
                <input type="number" id="p" placeholder="916395XXXXXX" style="width:90%;padding:15px;border:2px solid #e2e8f0;border-radius:12px;margin-bottom:15px;font-size:16px;">
                <button onclick="getCode()" id="b" style="width:90%;padding:15px;background:#6366f1;color:white;border:none;border-radius:12px;font-weight:bold;cursor:pointer;">Get Pairing Code</button>
                <div id="c" style="margin-top:20px;font-size:35px;font-weight:800;color:#ec4899;letter-spacing:5px;"></div>
                <p id="msg" style="color:#ef4444;margin-top:10px;font-weight:bold;"></p>
            </div>`;
        }

        res.send(`
            <body style="font-family:sans-serif;background:#f1f5f9;margin:0;padding:20px;display:flex;flex-direction:column;align-items:center;">
                <div style="width:100%;max-width:500px;text-align:center;">
                    ${content}
                    <div style="margin-top:20px;background:#1e293b;color:#38bdf8;padding:15px;border-radius:15px;text-align:left;box-shadow:0 10px 20px rgba(0,0,0,0.2);">
                        <b style="color:white;display:block;margin-bottom:10px;border-bottom:1px solid #334155;padding-bottom:5px;">LIVE SERVER LOGS</b>
                        <div style="height:250px;overflow-y:auto;font-family:monospace;font-size:12px;">${logHtml}</div>
                    </div>
                </div>
                <script>
                    async function getCode(){
                        const num=document.getElementById('p').value;
                        if(!num || num.length < 12) return alert('Pura number 91 ke saath dalein!');
                        document.getElementById('b').innerText='Requesting...';
                        try {
                            const r=await fetch('/request-code?phone='+num);
                            const d=await r.json();
                            if(d.code){
                                document.getElementById('c').innerText = d.code;
                                document.getElementById('b').innerText = 'Check WhatsApp App';
                                document.getElementById('msg').innerText = 'WhatsApp > Linked Devices > Link with Phone Number me ye code bharein.';
                            } else {
                                alert('Error: ' + d.message);
                                document.getElementById('b').innerText = 'Try Again';
                            }
                        } catch(e){ alert('Server Error'); }
                    }
                    // Auto refresh check
                    setTimeout(() => { if(!document.getElementById('c')?.innerText) location.reload(); }, 60000);
                </script>
            </body>
        `);
    });

    app.get('/logout', async (req, res) => {
        addLog("Manual Logout Requested...");
        if (fs.existsSync(CREDS_PATH)) fs.unlinkSync(CREDS_PATH);
        await db.ref("wa_auth").remove();
        res.send("Session Cleared! <a href='/'>Wapas Jayein</a>");
        process.exit(0); 
    });

    app.get('/request-code', async (req, res) => {
        const phone = req.query.phone;
        try {
            if (isConnected) return res.json({ status: "error", message: "Already connected" });
            const code = await sock.requestPairingCode(phone);
            addLog(`New Pairing Code: ${code} for ${phone}`);
            res.json({ status: "success", code });
        } catch (e) {
            addLog(`Pairing Error: ${e.message}`);
            res.json({ status: "error", message: e.message });
        }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY || !isConnected) return res.status(403).json({ error: "Offline ya Key Galat" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { text: `☀️ *Solor Energy Verification*\n\nYour OTP: *${otp}*` });
            addLog(`✅ OTP ${otp} bheja gaya: ${phone}`);
            res.json({ status: "success" });
        } catch (e) { addLog(`❌ Send Error: ${e.message}`); res.status(500).json({ error: e.message }); }
    });

    app.get('/uptime', (req, res) => res.json({ status: "alive", wa: isConnected }));
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log("Server Live"));