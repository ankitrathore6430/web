const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = "SOLOR_SECRET_786"; 

app.use(cors());

let sock;

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"], 
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(), 5000);
        } else if (connection === 'open') {
            console.log("✅ WhatsApp Connected Successfully!");
        }
    });

    // --- ROUTES ---

    // 1. Pairing UI
    app.get('/', (req, res) => {
        if (sock?.user) {
            return res.send(`<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;background:#f1f5f9;"><div style="padding:40px; border-radius:25px; background:white; color:#166534; box-shadow:0 10px 20px rgba(0,0,0,0.05);"><h1 style="margin:0;">✅ Connected!</h1><p style="color:#64748b;">Linked to: ${sock.user.id.split(':')[0]}</p></div></body>`);
        }
        res.send(`<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f1f5f9;"><div style="background:white; padding:40px; border-radius:30px; box-shadow:0 10px 25px rgba(0,0,0,0.1); text-align:center; max-width:400px;"><h1 style="color:#6366f1;">Link WhatsApp</h1><p style="color:#64748b;">Enter Admin WhatsApp number with 91</p><input type="number" id="phone" placeholder="9163955XXXXX" style="width:100%; padding:15px; border:2px solid #e2e8f0; border-radius:12px; margin-bottom:20px; font-size:16px;"><button onclick="getCode()" id="btn" style="width:100%; padding:15px; background:#6366f1; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Get Code</button><div id="code" style="margin-top:20px; font-size:32px; font-weight:800; letter-spacing:5px; color:#ec4899;"></div></div><script>async function getCode(){ const p=document.getElementById('phone').value; if(!p) return alert('Enter number'); document.getElementById('btn').innerText='Requesting...'; const r=await fetch('/request-code?phone='+p); const d=await r.json(); if(d.code){ document.getElementById('code').innerText=d.code; document.getElementById('btn').innerText='Code Received!'; }else{ alert('Error: '+d.message); document.getElementById('btn').innerText='Try Again'; }}</script></body>`);
    });

    // 2. Request Code API
    app.get('/request-code', async (req, res) => {
        const phone = req.query.phone;
        if (!phone || sock.user) return res.json({ status: "error", message: "Invalid request" });
        try {
            const code = await sock.requestPairingCode(phone);
            res.json({ status: "success", code: code });
        } catch (err) { res.json({ status: "error", message: err.message }); }
    });

    // 3. Send OTP API
    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY) return res.status(403).json({ error: "Invalid Key" });
        try {
            const jid = `91${phone}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: `☀️ *Solor Energy*\n\nYour OTP is: *${otp}*` });
            res.json({ status: "success" });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log(`Live on ${PORT}`));