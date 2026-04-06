const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, BufferJSON, initAuthCreds } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const QRCode = require('qrcode');
const http = require('http');

// Firebase v10 Modular SDK
const { initializeApp } = require("firebase/app");
const { getDatabase, ref, set, get, child, update, remove } = require("firebase/database");

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = "SOLOR_SECRET_786";

// Your Firebase Config (Direct)
const firebaseConfig = {
  apiKey: "AIzaSyDUIEOhBJicrq8YorveBeeYSWZTOj7FvJQ",
  authDomain: "solor-otp.firebaseapp.com",
  projectId: "solor-otp",
  storageBucket: "solor-otp.firebasestorage.app",
  messagingSenderId: "977573551783",
  appId: "1:977573551783:web:bd8d696e42c812cc9b0582",
  measurementId: "G-CVT93320BV",
  databaseURL: "https://solor-otp-default-rtdb.asia-southeast1.firebasedatabase.app/"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

app.use(cors());
app.use(express.json());

let sock;
let logs = [];
let connectionStatus = "OFFLINE";
let qrCodeData = null;
let sessionError = null;
let lastPingTime = Date.now();

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${msg}`;
    logs.unshift(logEntry);
    if (logs.length > 50) logs.pop();
    console.log(logEntry);
}

// ==================== 24/7 UPTIME KEEP-ALIVE ====================
// Self-ping every 10 minutes to prevent Render from sleeping
const SELF_PING_INTERVAL = 10 * 60 * 1000; // 10 minutes
const SERVER_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;

function keepAlive() {
    setInterval(() => {
        const pingUrl = `${SERVER_URL}/ping`;
        http.get(pingUrl, (res) => {
            lastPingTime = Date.now();
            addLog(`🔄 Self-ping successful: ${res.statusCode}`);
        }).on('error', (err) => {
            addLog(`⚠️ Self-ping failed: ${err.message}`);
        });
    }, SELF_PING_INTERVAL);
    
    addLog(`⏰ Self-ping enabled every ${SELF_PING_INTERVAL/60000} minutes`);
}

// Clear session from Firebase
async function clearSession() {
    try {
        await remove(ref(db, 'sessions/whatsapp_session'));
        addLog("🗑️ Session cleared from Firebase");
        return true;
    } catch (err) {
        addLog(`❌ Error clearing session: ${err.message}`);
        return false;
    }
}

// Check if session exists
async function sessionExists() {
    try {
        const snapshot = await get(ref(db, 'sessions/whatsapp_session/creds'));
        return snapshot.exists();
    } catch {
        return false;
    }
}

// Firebase Auth State for Baileys
async function useFirebaseAuthState(sessionId = 'whatsapp_session') {
    const credsRef = ref(db, `sessions/${sessionId}/creds`);
    const keysRef = ref(db, `sessions/${sessionId}/keys`);
    
    const credsSnapshot = await get(credsRef);
    let creds = credsSnapshot.val();
    
    if (creds) {
        try {
            creds = JSON.parse(JSON.stringify(creds), BufferJSON.reviver);
            addLog(`📂 Loaded session from Firebase: ${sessionId}`);
        } catch (err) {
            addLog(`⚠️ Corrupted session data: ${err.message}`);
            await clearSession();
            creds = initAuthCreds();
        }
    } else {
        creds = initAuthCreds();
        addLog(`🆕 New session initialized: ${sessionId}`);
    }

    return {
        state: {
            creds,
            keys: {
                get: async (type, ids) => {
                    const data = {};
                    for (const id of ids) {
                        try {
                            const keySnapshot = await get(child(keysRef, `${type}/${id}`));
                            let value = keySnapshot.val();
                            if (value) {
                                value = JSON.parse(JSON.stringify(value), BufferJSON.reviver);
                            }
                            data[id] = value;
                        } catch (err) {
                            addLog(`⚠️ Error reading key ${id}: ${err.message}`);
                            data[id] = null;
                        }
                    }
                    return data;
                },
                set: async (data) => {
                    const updates = {};
                    for (const category in data) {
                        for (const id in data[category]) {
                            const value = data[category][id];
                            if (value === null) {
                                updates[`${category}/${id}`] = null;
                            } else {
                                updates[`${category}/${id}`] = JSON.parse(JSON.stringify(value, BufferJSON.replacer));
                            }
                        }
                    }
                    try {
                        await update(keysRef, updates);
                    } catch (err) {
                        addLog(`⚠️ Error saving keys: ${err.message}`);
                    }
                }
            }
        },
        saveCreds: async () => {
            try {
                const serializedCreds = JSON.parse(JSON.stringify(creds, BufferJSON.replacer));
                await set(credsRef, serializedCreds);
                addLog(`💾 Saved creds to Firebase`);
            } catch (err) {
                addLog(`❌ Error saving creds: ${err.message}`);
            }
        }
    };
}

async function connectToWhatsApp() {
    addLog("🚀 Starting WhatsApp Connection...");
    sessionError = null;
    
    let authState;
    try {
        authState = await useFirebaseAuthState();
        addLog("Using Firebase Auth State (Persistent)");
    } catch (err) {
        addLog(`❌ Firebase Auth Error: ${err.message}. Clearing session...`);
        await clearSession();
        try {
            authState = await useFirebaseAuthState();
            addLog("🆕 New session created after error");
        } catch (err2) {
            addLog(`❌ Fatal error: ${err2.message}. Using file fallback...`);
            const fileAuth = await useMultiFileAuthState('auth_info');
            authState = fileAuth;
        }
    }

    const { version } = await fetchLatestBaileysVersion();

    try {
        sock = makeWASocket({
            version,
            auth: authState.state,
            logger: pino({ level: 'silent' }),
            browser: ["Ubuntu", "Chrome", "20.0.0"],
            connectTimeoutMs: 60000,
            printQRInTerminal: false
        });
    } catch (err) {
        addLog(`❌ Socket creation error: ${err.message}`);
        sessionError = "Invalid session data. Please clear and re-login.";
        return;
    }

    sock.ev.on('creds.update', authState.saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = qr;
            addLog("📱 QR Code generated - Scan required");
        }

        if (connection === 'connecting') {
            connectionStatus = "CONNECTING";
            addLog("⏳ Connecting to WhatsApp...");
        }

        if (connection === 'close') {
            connectionStatus = "OFFLINE";
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            const isBadSession = [
                DisconnectReason.badSession,
                DisconnectReason.connectionReplaced,
                401, 403, 411, 428
            ].includes(statusCode);
            
            if (isBadSession) {
                addLog(`❌ Bad session detected (Code: ${statusCode}). Clearing...`);
                sessionError = `Session invalid (Error ${statusCode}). Please scan QR again.`;
                await clearSession();
                setTimeout(() => connectToWhatsApp(), 3000);
                return;
            }
            
            addLog(`Connection Closed. Code: ${statusCode}. Reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000);
            } else {
                addLog("❌ Logged out - Clearing session");
                await clearSession();
            }
        }

        if (connection === 'open') {
            connectionStatus = "CONNECTED";
            qrCodeData = null;
            sessionError = null;
            addLog(`✅ SUCCESS: WhatsApp Linked! ${sock.user?.id?.split(':')[0] || ''}`);
            await authState.saveCreds();
        }
    });

    sock.ev.on('error', async (err) => {
        addLog(`❌ Socket Error: ${err.message}`);
        if (err.message.includes('decrypt') || err.message.includes('session')) {
            sessionError = "Session error detected. Please clear and re-login.";
        }
    });
}

// ==================== ROUTES ====================

// Ping endpoint for uptime monitoring (external + self)
app.get('/ping', (req, res) => {
    const uptime = Math.floor(process.uptime());
    const minutes = Math.floor(uptime / 60);
    const seconds = uptime % 60;
    
    res.json({ 
        status: "alive", 
        timestamp: new Date().toISOString(),
        whatsapp: connectionStatus,
        uptime: `${minutes}m ${seconds}s`,
        lastPing: new Date(lastPingTime).toISOString(),
        error: sessionError
    });
});

app.get('/', async (req, res) => {
    const logHtml = logs.map(l => `<div style="border-bottom:1px solid #eee;padding:5px;">${l}</div>`).join('');
    
    // Check for delete request
    if (req.query.delete === 'session') {
        await clearSession();
        return res.send(`
            <body style="font-family:sans-serif; background:#fef2f2; padding:20px; text-align:center;">
                <div style="background:white; padding:40px; border-radius:20px; max-width:400px; margin:auto;">
                    <h1 style="color:#dc2626;">🗑️ Session Deleted</h1>
                    <p>Session cleared successfully!</p>
                    <p>Redirecting to login...</p>
                    <script>setTimeout(()=>window.location.href='/',2000);</script>
                </div>
            </body>
        `);
    }
    
    if (connectionStatus === "CONNECTED" && sock?.user) {
        return res.send(`
            <body style="font-family:sans-serif; background:#f0fdf4; padding:20px; text-align:center;">
                <div style="background:white; padding:40px; border-radius:20px; max-width:500px; margin:auto;">
                    <h1 style="color:#16a34a;">✅ WhatsApp Active</h1>
                    <p>Linked to: <b>${sock.user.id.split(':')[0]}</b></p>
                    <p>Storage: <b>🔥 Firebase</b></p>
                    <p>Uptime: <b>${Math.floor(process.uptime()/60)} minutes</b></p>
                    <hr>
                    <div style="text-align:left; font-size:12px; height:200px; overflow-y:auto; background:#f8fafc; padding:10px;">
                        <b>Logs:</b><br>${logHtml}
                    </div>
                    <br>
                    <a href="/?delete=session" style="background:#dc2626; color:white; padding:10px 20px; border-radius:8px; text-decoration:none; display:inline-block; margin-top:10px;">🗑️ Logout & Clear Session</a>
                </div>
            </body>
        `);
    }

    let qrImage = '';
    if (qrCodeData) {
        try {
            qrImage = await QRCode.toDataURL(qrCodeData);
        } catch (e) {}
    }

    let errorHtml = '';
    if (sessionError) {
        errorHtml = `
            <div style="background:#fef2f2; border:2px solid #dc2626; color:#dc2626; padding:15px; border-radius:10px; margin-bottom:20px;">
                <strong>⚠️ Error:</strong> ${sessionError}<br>
                <a href="/?delete=session" style="color:#dc2626; font-weight:bold;">Click here to clear session and login again</a>
            </div>
        `;
    }

    res.send(`
        <body style="font-family:sans-serif; background:#f1f5f9; padding:20px; text-align:center;">
            <div style="background:white; padding:40px; border-radius:20px; max-width:400px; margin:auto;">
                <h1 style="color:#6366f1;">Link WhatsApp</h1>
                <p>Status: <b>${connectionStatus}</b> | Storage: <b>🔥 Firebase</b></p>
                <p style="font-size:12px; color:#64748b;">⏰ Auto-refresh every 10s | 🔄 Self-ping every 10min</p>
                
                ${errorHtml}
                
                ${qrImage ? `
                <div style="margin:20px 0;">
                    <p><strong>Scan QR Code:</strong></p>
                    <img src="${qrImage}" style="max-width:200px; border:8px solid white; box-shadow:0 4px 15px rgba(0,0,0,0.1);">
                </div>
                <hr>
                ` : ''}
                
                <input type="number" id="phone" placeholder="91XXXXXXXXXX" style="width:100%; padding:15px; border:2px solid #e2e8f0; border-radius:12px; margin-bottom:20px; font-size:16px;">
                <button onclick="getCode()" id="btn" style="width:100%; padding:15px; background:#6366f1; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Get Pairing Code</button>
                <div id="code" style="margin-top:20px; font-size:32px; font-weight:800; letter-spacing:5px; color:#ec4899;"></div>
                
                <hr style="margin:20px 0;">
                <div style="text-align:left; font-size:11px; height:100px; overflow-y:auto; background:#f8fafc; padding:10px;">
                    <b>Logs:</b><br>${logHtml}
                </div>
                
                ${await sessionExists() ? `
                <br>
                <a href="/?delete=session" style="color:#dc2626; font-size:12px;">🗑️ Clear saved session & start fresh</a>
                ` : ''}
            </div>
            <script>
                async function getCode(){
                    const num=document.getElementById('phone').value;
                    if(!num) return alert('Enter number');
                    document.getElementById('btn').innerText='Requesting...';
                    const r=await fetch('/request-code?phone='+num);
                    const d=await r.json();
                    if(d.code){
                        document.getElementById('code').innerText=d.code;
                        document.getElementById('btn').innerText='Verify in WhatsApp';
                    }else{
                        alert('Error: '+d.message);
                        document.getElementById('btn').innerText='Try Again';
                    }
                }
                ${connectionStatus !== 'CONNECTED' ? 'setTimeout(()=>location.reload(),10000);' : ''}
            </script>
        </body>
    `);
});

app.get('/request-code', async (req, res) => {
    const phone = req.query.phone;
    addLog(`Pairing Code Requested for: ${phone}`);
    try { 
        const code = await sock.requestPairingCode(phone); 
        res.json({ status: "success", code: code }); 
    } catch (err) { 
        addLog(`Error: ${err.message}`);
        res.json({ status: "error", message: err.message }); 
    }
});

app.get('/send-otp', async (req, res) => {
    const { phone, otp, key } = req.query;
    if (key !== API_KEY) return res.status(403).json({ status: "error", message: "Invalid Key" });
    if (connectionStatus !== "CONNECTED") return res.status(500).json({ status: "error", message: "WhatsApp not linked" });

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

app.get('/clear-session', async (req, res) => {
    const success = await clearSession();
    if (success) {
        res.json({ status: "success", message: "Session cleared. Please re-login." });
    } else {
        res.status(500).json({ status: "error", message: "Failed to clear session" });
    }
});

// ==================== START SERVER ====================
connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server live on ${PORT}`);
    addLog(`🚀 Server started on port ${PORT}`);
    addLog(`📊 Dashboard: ${SERVER_URL}`);
    
    // Start keep-alive mechanism
    keepAlive();
});