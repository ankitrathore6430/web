const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const https = require('https');
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, remove } = require("firebase/database");

// --- CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyDUIEOhBJicrq8YorveBeeYSWZTOj7FvJQ",
    authDomain: "solor-otp.firebaseapp.com",
    databaseURL: "https://solor-otp-default-rtdb.firebaseio.com",
    projectId: "solor-otp",
    storageBucket: "solor-otp.firebasestorage.app",
    messagingSenderId: "977573551783",
    appId: "1:977573551783:web:bd8d696e42c812cc9b0582",
    measurementId: "G-CVT93320BV"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);
const SESSION_PATH = 'whatsapp_session_v2';
const API_KEY = "SOLOR_SECRET_786";

// ⚠️ APNA RENDER URL YAHAN DALEIN (e.g., 'https://solor-wa.onrender.com')
const MY_URL = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'solor-otp'}.onrender.com`;

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());

let sock;
let logs = [];
let connectionStatus = "OFFLINE";

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${msg}`;
    logs.unshift(logEntry);
    if (logs.length > 15) logs.pop();
    console.log(logEntry);
}

// --- SAFE ANTI-SLEEP (Self-Ping) ---
function startSafePing() {
    // Har 8 minute mein ek baar ping karega
    setInterval(() => {
        if (connectionStatus === "OFFLINE") return; 
        
        https.get(`${MY_URL}/ping`, (res) => {
            // Success
        }).on('error', (e) => {
            console.log("Ping error, ignored to prevent crash.");
        });
    }, 480000); 
}

// --- WHATSAPP LOGIC ---
async function clearSession(reason) {
    try {
        await remove(ref(db, SESSION_PATH));
        if (fs.existsSync('./auth_info')) {
            fs.rmSync('./auth_info', { recursive: true, force: true });
        }
        addLog(`Session Cleared: ${reason}`);
        connectionStatus = "OFFLINE";
    } catch (e) {}
}

async function syncSessionFromFirebase() {
    try {
        const snapshot = await get(ref(db, SESSION_PATH));
        if (snapshot.exists()) {
            const data = snapshot.val();
            if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info', { recursive: true });
            for (const [filename, content] of Object.entries(data)) {
                const realFilename = filename.replace(/_/g, '.');
                fs.writeFileSync(path.join('./auth_info', realFilename), content);
            }
            return true;
        }
    } catch (e) { addLog("Cloud Load Error: " + e.message); }
    return false;
}

async function saveSessionToFirebase() {
    try {
        if (!fs.existsSync('./auth_info')) return;
        const files = fs.readdirSync('./auth_info');
        const sessionData = {};
        files.forEach(file => {
            const content = fs.readFileSync(path.join('./auth_info', file), 'utf-8');
            const safeName = file.replace(/\./g, '_');
            sessionData[safeName] = content;
        });
        await set(ref(db, SESSION_PATH), sessionData);
    } catch (e) {}
}

async function connectToWhatsApp() {
    addLog("WhatsApp connecting...");
    await syncSessionFromFirebase();

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"],
        printQRInTerminal: false,
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        await saveSessionToFirebase();
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'connecting') connectionStatus = "CONNECTING";
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                await clearSession("Invalid Session");
                setTimeout(() => connectToWhatsApp(), 3000);
            } else {
                setTimeout(() => connectToWhatsApp(), 5000);
            }
        }
        if (connection === 'open') {
            connectionStatus = "CONNECTED";
            addLog("✅ SUCCESS: Linked!");
            await saveSessionToFirebase();
        }
    });

    // --- ROUTES ---
    app.get('/ping', (req, res) => res.send('pong'));

    app.get('/', (req, res) => {
        const logHtml = logs.map(l => `<div style="border-bottom:1px solid #eee;padding:4px;">${l}</div>`).join('');
        if (connectionStatus === "CONNECTED" && sock?.user) {
            return res.send(`
                <body style="font-family:sans-serif; background:#f0fdf4; padding:20px; text-align:center;">
                    <div style="background:white; padding:30px; border-radius:15px; box-shadow:0 5px 15px rgba(0,0,0,0.05); max-width:400px; margin:auto;">
                        <h2 style="color:#16a34a;">✅ WhatsApp Active</h2>
                        <p style="font-size:14px;">Linked: ${sock.user.id.split(':')[0]}</p>
                        <div style="text-align:left; font-size:11px; height:150px; overflow-y:auto; background:#f8fafc; padding:10px; border:1px solid #eee;">
                            ${logHtml}
                        </div>
                    </div>
                </body>
            `);
        }
        res.send(`
            <body style="font-family:sans-serif; background:#f1f5f9; padding:20px; text-align:center;">
                <div style="background:white; padding:30px; border-radius:15px; max-width:400px; margin:auto;">
                    <h2 style="color:#6366f1;">Link WhatsApp</h2>
                    <input type="number" id="p" placeholder="9163955XXXXX" style="width:100%; padding:12px; border:1px solid #ddd; border-radius:8px; margin-bottom:15px;">
                    <button onclick="getCode()" id="b" style="width:100%; padding:12px; background:#6366f1; color:white; border:none; border-radius:8px; cursor:pointer;">Get Pairing Code</button>
                    <div id="c" style="margin-top:15px; font-size:28px; font-weight:bold; color:#ec4899;"></div>
                </div>
                <script>
                    async function getCode(){
                        const num=document.getElementById('p').value;
                        if(!num) return alert('Enter number');
                        document.getElementById('b').innerText='Loading...';
                        const r=await fetch('/request-code?phone='+num);
                        const d=await r.json();
                        document.getElementById('c').innerText = d.code || 'Error';
                        document.getElementById('b').innerText = 'Get Pairing Code';
                    }
                </script>
            </body>
        `);
    });

    app.get('/logout', async (req, res) => {
        await clearSession("Manual Logout");
        res.send("Logged out. <a href='/'>Back</a>");
    });

    app.get('/request-code', async (req, res) => {
        const phone = req.query.phone;
        try { 
            const code = await sock.requestPairingCode(phone); 
            res.json({ status: "success", code: code }); 
        } catch (err) { res.json({ status: "error" }); }
    });

    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY || connectionStatus !== "CONNECTED") return res.status(403).json({ error: "Unauthorized" });
        try {
            await sock.sendMessage(`91${phone}@s.whatsapp.net`, { 
                text: `☀️ *Solor Energy Verification*\n\nYour OTP is: *${otp}*\n\nDo not share this.` 
            });
            addLog(`Sent to ${phone}`);
            res.json({ status: "success" });
        } catch (err) { res.status(500).json({ error: "Failed" }); }
    });
}

connectToWhatsApp();
startSafePing(); 
app.listen(PORT, '0.0.0.0', () => console.log(`Live on ${PORT}`));