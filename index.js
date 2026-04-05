const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");

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
    const logEntry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.unshift(logEntry);
    if (logs.length > 50) logs.pop(); // Last 50 logs save rakhega
    console.log(logEntry);
}

async function connectToWhatsApp() {
    addLog("Initializing WhatsApp Socket...");
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"],
        printQRInTerminal: false,
        connectTimeoutMs: 100000,
        keepAliveIntervalMs: 30000,
        markOnlineOnConnect: true // Humesha online dikhega taki connection na tute
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'connecting') {
            isConnected = false;
            addLog("Status: Connecting...");
        }

        if (connection === 'close') {
            isConnected = false;
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            addLog(`Status: Offline. Reason: ${lastDisconnect.error}. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000);
            }
        }

        if (connection === 'open') {
            isConnected = true;
            addLog("✅ SUCCESS: WhatsApp Connected and Ready!");
        }
    });

    // --- API ROUTES ---

    // 1. Status & Logs Dashboard (For Admin)
    app.get('/', (req, res) => {
        const logContent = logs.map(l => `<div style="padding:5px; border-bottom:1px solid #eee; font-family:monospace;">${l}</div>`).join('');
        
        if (isConnected && sock?.user) {
            res.send(`
                <body style="font-family:sans-serif; background:#f0fdf4; padding:20px; text-align:center;">
                    <div style="background:white; padding:30px; border-radius:20px; box-shadow:0 10px 20px rgba(0,0,0,0.1); max-width:600px; margin:auto;">
                        <h1 style="color:#16a34a;">🟢 SERVER ONLINE</h1>
                        <p>WhatsApp Linked: <b>${sock.user.id.split(':')[0]}</b></p>
                        <div style="background:#000; color:#0f0; padding:15px; border-radius:10px; text-align:left; height:300px; overflow-y:auto; font-size:12px;">
                            ${logContent}
                        </div>
                        <p style="font-size:12px; color:gray; margin-top:10px;">Uptime Monitoring Active (Ping every 5 min)</p>
                    </div>
                    <script>setTimeout(() => location.reload(), 30000);</script>
                </body>
            `);
        } else {
            res.send(`
                <body style="font-family:sans-serif; background:#f1f5f9; padding:20px; text-align:center;">
                    <div style="background:white; padding:30px; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1); max-width:400px; margin:auto;">
                        <h1 style="color:#6366f1;">Link WhatsApp</h1>
                        <input type="number" id="n" placeholder="91..." style="width:100%;padding:15px;margin-bottom:15px;border:2px solid #ddd;border-radius:10px;font-size:16px;">
                        <button onclick="g()" id="b" style="width:100%;padding:15px;background:#6366f1;color:white;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">Get Pairing Code</button>
                        <div id="c" style="margin-top:20px;font-size:32px;font-weight:800;letter-spacing:5px;color:#ec4899;"></div>
                        <div style="margin-top:20px; text-align:left; font-size:10px; color:gray; background:#f8fafc; padding:10px;">${logContent}</div>
                    </div>
                    <script>
                        async function g(){
                            const n=document.getElementById('n').value;
                            if(!n)return alert('Enter number with 91');
                            document.getElementById('b').innerText='Requesting...';
                            const r=await fetch('/request-code?phone='+n);
                            const d=await r.json();
                            document.getElementById('c').innerText = d.code || 'Error';
                            document.getElementById('b').innerText='Enter Code in WhatsApp';
                        }
                    </script>
                </body>
            `);
        }
    });

    // 2. Uptime Robot Route (Flask style)
    app.get('/uptime', (req, res) => {
        res.status(200).json({ status: "alive", connected: isConnected });
    });

    // 3. Request Code
    app.get('/request-code', async (req, res) => {
        const phone = req.query.phone;
        addLog(`Pairing requested for: ${phone}`);
        try {
            const code = await sock.requestPairingCode(phone);
            res.json({ code });
        } catch (e) { 
            addLog(`Pairing Error: ${e.message}`);
            res.json({ error: e.message }); 
        }
    });

    // 4. Send OTP
    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY) return res.status(403).json({ error: "Invalid Key" });
        if (!isConnected) return res.status(503).json({ error: "WhatsApp Offline" });

        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { 
                text: `☀️ *Solor Energy Verification*\n\nYour OTP code is: *${otp}*\n\nDo not share this with anyone.` 
            });
            addLog(`✅ OTP ${otp} sent to ${phone}`);
            res.json({ status: "success" });
        } catch (err) {
            addLog(`❌ Send Error: ${err.message}`);
            res.status(500).json({ error: err.message });
        }
    });
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on port ${PORT}`));