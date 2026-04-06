const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const fs = require('fs');
const path = require('path');
const https = require('https'); // Self-ping ke liye
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, get, set, remove } = require("firebase/database");

// --- CONFIG ---
const API_KEY = "SOLOR_SECRET_786";
const PORT = process.env.PORT || 10000;
const AUTH_DIR = './auth_info';
const SESSION_PATH = 'full_whatsapp_session';
const APP_URL = "https://solor-whatsapp-otp.onrender.com"; // 👈 APNA RENDER URL YAHA DALO

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

const app = express();
app.use(cors());
app.use(express.json());

let sock;
let logs = [];
let connectionStatus = "OFFLINE";
let retryCount = 0;

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${msg}`;
    logs.unshift(logEntry);
    if (logs.length > 25) logs.pop();
    console.log(logEntry);
}

// --- SELF-PING LOGIC (Internal) ---
function keepAlive() {
    setInterval(() => {
        https.get(APP_URL + "/ping", (res) => {
            addLog("Self-Ping: Server is Active");
        }).on('error', (e) => {
            addLog("Self-Ping Error: " + e.message);
        });
    }, 10 * 60 * 1000); // Har 10 minute mein
}

// --- FIREBASE SYNC LOGIC ---
async function restoreFolderFromFirebase() {
    try {
        const snapshot = await get(ref(db, SESSION_PATH));
        if (snapshot.exists()) {
            const files = snapshot.val();
            if (!fs.existsSync(AUTH_DIR)) fs.mkdirSync(AUTH_DIR, { recursive: true });
            for (const [fileName, fileContent] of Object.entries(files)) {
                fs.writeFileSync(path.join(AUTH_DIR, fileName), fileContent);
            }
            addLog("✅ Session Restored from Firebase");
            return true;
        }
    } catch (e) { addLog("Restore Error: " + e.message); }
    return false;
}

async function saveFolderToFirebase() {
    try {
        if (!fs.existsSync(AUTH_DIR)) return;
        const files = fs.readdirSync(AUTH_DIR);
        const sessionData = {};
        for (const file of files) {
            const fullPath = path.join(AUTH_DIR, file);
            if (fs.lstatSync(fullPath).isFile()) {
                sessionData[file] = fs.readFileSync(fullPath, 'utf-8');
            }
        }
        await set(ref(db, SESSION_PATH), sessionData);
    } catch (e) { addLog("Backup Error: " + e.message); }
}

async function clearEverything() {
    addLog("🚨 Resetting everything...");
    await remove(ref(db, SESSION_PATH));
    if (fs.existsSync(AUTH_DIR)) fs.rmSync(AUTH_DIR, { recursive: true, force: true });
    retryCount = 0;
}

// --- WHATSAPP CONNECTION ---
async function connectToWhatsApp() {
    if (retryCount > 4) await clearEverything();

    addLog("Recovering session...");
    const hasBackup = await restoreFolderFromFirebase();

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Solor OTP", "Chrome", "1.0.0"],
        connectTimeoutMs: 60000
    });

    sock.ev.on('creds.update', async () => {
        await saveCreds();
        await saveFolderToFirebase();
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'connecting') connectionStatus = "CONNECTING";

        if (connection === 'close') {
            connectionStatus = "OFFLINE";
            retryCount++;
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

            if (statusCode === DisconnectReason.loggedOut || statusCode === 401) {
                await clearEverything();
                setTimeout(() => connectToWhatsApp(), 5000);
            } else if (shouldReconnect) {
                if (retryCount > 3 && hasBackup) await clearEverything();
                setTimeout(() => connectToWhatsApp(), 5000);
            }
        }

        if (connection === 'open') {
            connectionStatus = "CONNECTED";
            retryCount = 0;
            addLog("✅ SUCCESS: WhatsApp is Live!");
            await saveFolderToFirebase();
        }
    });
}

// --- ROUTES ---

// 1. UptimeRobot Endpoint
app.get('/ping', (req, res) => {
    res.status(200).send("Server is Active ☀️");
});

app.get('/', (req, res) => {
    const logHtml = logs.map(l => `<div style="border-bottom:1px solid #eee;padding:5px;">${l}</div>`).join('');
    if (connectionStatus === "CONNECTED" && sock?.user) {
        return res.send(`
            <body style="font-family:sans-serif; background:#f0fdf4; padding:20px; text-align:center;">
                <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 10px 20px rgba(0,0,0,0.05); max-width:500px; margin:auto;">
                    <h1 style="color:#16a34a;">✅ System Active</h1>
                    <p>Number: <b>${sock.user.id.split(':')[0]}</b></p>
                    <p style="color:blue; font-size:12px;">Anti-Sleep & Cloud Backup: ON</p>
                    <hr>
                    <div style="text-align:left; font-size:12px; height:300px; overflow-y:auto; background:#f8fafc; padding:10px;">
                        <b>Live Logs:</b><br>${logHtml}
                    </div>
                </div>
            </body>
        `);
    }
    res.send(`
        <body style="font-family:sans-serif; background:#f1f5f9; padding:20px; text-align:center;">
            <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1); max-width:400px; margin:auto;">
                <h1 style="color:#6366f1;">Link WhatsApp</h1>
                <input type="number" id="p" placeholder="9163955XXXXX" style="width:100%; padding:15px; border:2px solid #e2e8f0; border-radius:12px; margin-bottom:20px; font-size:16px;">
                <button onclick="getCode()" id="b" style="width:100%; padding:15px; background:#6366f1; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Get Pairing Code</button>
                <div id="c" style="margin-top:20px; font-size:32px; font-weight:800; letter-spacing:5px; color:#ec4899;"></div>
                <hr style="margin:20px 0;">
                <div style="text-align:left; font-size:11px; height:150px; overflow-y:auto; background:#f8fafc; padding:10px;">
                    <b>Logs:</b><br>${logHtml}
                </div>
            </div>
            <script>
                async function getCode(){
                    const num=document.getElementById('p').value;
                    if(!num) return alert('Enter number');
                    document.getElementById('b').innerText='Requesting...';
                    const r=await fetch('/request-code?phone='+num);
                    const d=await r.json();
                    if(d.code) {
                        document.getElementById('c').innerText=d.code;
                        document.getElementById('b').innerText='Verify in WhatsApp';
                    } else {
                        alert('Error: ' + d.message);
                        document.getElementById('b').innerText='Try Again';
                    }
                }
            </script>
        </body>
    `);
});

app.get('/request-code', async (req, res) => {
    const phone = req.query.phone;
    try { 
        const code = await sock.requestPairingCode(phone); 
        res.json({ status: "success", code: code }); 
    } catch (err) { res.json({ status: "error", message: err.message }); }
});

app.get('/send-otp', async (req, res) => {
    const { phone, otp, key } = req.query;
    if (key !== API_KEY) return res.status(403).json({ status: "error", message: "Invalid Key" });
    if (connectionStatus !== "CONNECTED") return res.status(500).json({ status: "error", message: "WhatsApp offline" });
    try {
        await sock.sendMessage(`91${phone}@s.whatsapp.net`, { 
            text: `☀️ *Solor Energy Verification*\n\nYour OTP is: *${otp}*\n\nDo not share this with anyone.` 
        });
        addLog(`OTP ${otp} sent to ${phone}`);
        res.json({ status: "success" });
    } catch (err) {
        addLog(`Send Error: ${err.message}`);
        res.status(500).json({ error: err.message });
    }
});

// Start everything
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on ${PORT}`);
    connectToWhatsApp();
    keepAlive(); // Self-ping start
});