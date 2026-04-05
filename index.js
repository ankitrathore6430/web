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

function addLog(msg) {
    const log = `[${new Date().toLocaleTimeString()}] ${msg}`;
    logs.unshift(log);
    if (logs.length > 20) logs.pop();
    console.log(log);
}

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"],
        connectTimeoutMs: 60000,
        keepAliveIntervalMs: 30000, // Connection को जिंदा रखने के लिए
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            isConnected = false;
            const shouldReconnect = (lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut);
            addLog(`❌ Connection Closed. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(), 5000);
        } else if (connection === 'open') {
            isConnected = true;
            addLog("✅ WhatsApp Connected!");
        }
    });

    // Pairing UI
    app.get('/', (req, res) => {
        if (isConnected && sock?.user) {
            res.send(`
                <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f0fdf4;">
                    <div style="background:white;padding:30px;border-radius:20px;box-shadow:0 5px 15px rgba(0,0,0,0.1);max-width:400px;margin:auto;">
                        <h1 style="color:#16a34a;">✅ Active</h1>
                        <p>Linked: <b>${sock.user.id.split(':')[0]}</b></p>
                        <div style="text-align:left;background:#f8fafc;padding:10px;font-size:11px;max-height:100px;overflow-y:auto;">
                            ${logs.join('<br>')}
                        </div>
                    </div>
                </body>
            `);
        } else {
            res.send(`
                <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f1f5f9;">
                    <div style="background:white;padding:30px;border-radius:20px;box-shadow:0 5px 15px rgba(0,0,0,0.1);max-width:400px;margin:auto;">
                        <h1 style="color:#6366f1;">Link Account</h1>
                        <input type="number" id="n" placeholder="91..." style="width:100%;padding:12px;margin-bottom:15px;border:1px solid #ddd;border-radius:8px;">
                        <button onclick="g()" id="b" style="width:100%;padding:12px;background:#6366f1;color:white;border:none;border-radius:8px;cursor:pointer;">Get Pairing Code</button>
                        <div id="c" style="margin-top:20px;font-size:28px;font-weight:800;letter-spacing:4px;color:#ec4899;"></div>
                    </div>
                    <script>
                        async function g(){
                            const n=document.getElementById('n').value;
                            if(!n)return alert('Number?');
                            document.getElementById('b').innerText='Loading...';
                            const r=await fetch('/request-code?phone='+n);
                            const d=await r.json();
                            document.getElementById('c').innerText = d.code || 'Error';
                            document.getElementById('b').innerText='Check WhatsApp Notification';
                        }
                    </script>
                </body>
            `);
        }
    });

    app.get('/request-code', async (req, res) => {
        try {
            const code = await sock.requestPairingCode(req.query.phone);
            res.json({ code });
        } catch (e) { res.json({ error: e.message }); }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY || !isConnected) return res.status(403).json({ status: "error" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { text: `☀️ *Solor Energy Verification*\n\nYour OTP is: *${otp}*` });
            addLog(`OTP sent to ${phone}`);
            res.json({ status: "success" });
        } catch (e) { res.json({ error: e.message }); }
    });
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log("Live"));