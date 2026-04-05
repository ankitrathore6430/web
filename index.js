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
            isConnected = false;
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(), 5000);
        } else if (connection === 'open') {
            isConnected = true;
            console.log("✅ WhatsApp Connected!");
        }
    });

    // Pairing UI
    app.get('/', (req, res) => {
        if (isConnected && sock?.user) {
            return res.send(`<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;background:#dcfce7;"><div style="padding:40px; border-radius:25px; background:white; color:#166534; box-shadow:0 10px 20px rgba(0,0,0,0.1);"><h1>✅ WhatsApp Linked!</h1><p>Ready to send OTPs.</p><p>Number: ${sock.user.id.split(':')[0]}</p></div></body>`);
        }
        res.send(`<body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f1f5f9;"><div style="background:white; padding:40px; border-radius:30px; box-shadow:0 10px 25px rgba(0,0,0,0.1); text-align:center; max-width:400px;"><h1 style="color:#6366f1;">Link WhatsApp</h1><p>Enter Admin Number with 91</p><input type="number" id="p" placeholder="9163955XXXXX" style="width:100%; padding:15px; border:2px solid #e2e8f0; border-radius:12px; margin-bottom:20px;"><button onclick="getCode()" id="b" style="width:100%; padding:15px; background:#6366f1; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Get Code</button><div id="c" style="margin-top:20px; font-size:32px; font-weight:800; letter-spacing:5px; color:#ec4899;"></div></div><script>async function getCode(){const num=document.getElementById('p').value; if(!num) return alert('Enter number'); document.getElementById('b').innerText='Requesting...'; const r=await fetch('/request-code?phone='+num); const d=await r.json(); if(d.code){document.getElementById('c').innerText=d.code; document.getElementById('b').innerText='Check WhatsApp';}else{alert('Error'); document.getElementById('b').innerText='Try Again';}}</script></body>`);
    });

    app.get('/request-code', async (req, res) => {
        const phone = req.query.phone;
        try { const code = await sock.requestPairingCode(phone); res.json({ status: "success", code: code }); } 
        catch (err) { res.json({ status: "error", message: err.message }); }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY || !isConnected) return res.status(403).json({ status: "error" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { text: `☀️ *Solor Energy*\n\nYour OTP: *${otp}*` });
            res.json({ status: "success" });
        } catch (err) { res.status(500).json({ error: err.message }); }
    });
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log("Server Live"));