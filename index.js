const { default: makeWASocket, DisconnectReason, fetchLatestBaileysVersion, BufferJSON } = require("@whiskeysockets/baileys");
const express = require("express");
const cors = require('cors');
const pino = require("pino");
const admin = require('firebase-admin');

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = "SOLOR_SECRET_786"; 

app.use(cors());
app.use(express.json());

let sock;
let logs = []; // ब्राउज़र में लॉग्स दिखाने के लिए
let connectionStatus = "OFFLINE";

// Firebase Configuration
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

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: firebaseConfig.projectId,
      clientEmail: "firebase-adminsdk-fbsvc@solor-otp.iam.gserviceaccount.com",
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n') || ""
    }),
    databaseURL: firebaseConfig.databaseURL
  });
}

const db = admin.database();
const authRef = db.ref('whatsapp_auth');

function addLog(msg) {
    const time = new Date().toLocaleTimeString();
    const logEntry = `[${time}] ${msg}`;
    logs.unshift(logEntry);
    if (logs.length > 20) logs.pop();
    console.log(logEntry);
}

// Custom Firebase Auth State
async function useFirebaseAuthState() {
    const writeData = async (data, file) => {
        try {
            await authRef.child(file).set(JSON.stringify(data, BufferJSON.replacer));
        } catch (err) {
            console.error('Firebase write error:', err);
        }
    };

    const readData = async (file) => {
        try {
            const snapshot = await authRef.child(file).once('value');
            const data = snapshot.val();
            return data ? JSON.parse(data, BufferJSON.reviver) : null;
        } catch (err) {
            console.error('Firebase read error:', err);
            return null;
        }
    };

    const removeData = async (file) => {
        try {
            await authRef.child(file).remove();
        } catch (err) {
            console.error('Firebase remove error:', err);
        }
    };

    let creds = await readData('creds');
    const keys = {
        get: async (type, ids) => {
            const data = {};
            await Promise.all(ids.map(async (id) => {
                const value = await readData(`${type}-${id}`);
                if (value) {
                    data[id] = value;
                }
            }));
            return data;
        },
        set: async (data) => {
            const tasks = [];
            for (const [type, ids] of Object.entries(data)) {
                for (const [id, value] of Object.entries(ids)) {
                    const file = `${type}-${id}`;
                    if (value) {
                        tasks.push(writeData(value, file));
                    } else {
                        tasks.push(removeData(file));
                    }
                }
            }
            await Promise.all(tasks);
        }
    };

    return {
        state: { creds, keys },
        saveCreds: async () => {
            if (creds) {
                await writeData(creds, 'creds');
            }
        }
    };
}

async function connectToWhatsApp() {
    addLog("Starting WhatsApp Connection...");
    const { state, saveCreds } = await useFirebaseAuthState();
    const { version } = await fetchLatestBaileysVersion();

    sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'silent' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"], 
        connectTimeoutMs: 60000,
        printQRInTerminal: false
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect } = update;
        
        if (connection === 'connecting') {
            connectionStatus = "CONNECTING";
            addLog("Connecting to WhatsApp...");
        }

        if (connection === 'close') {
            connectionStatus = "OFFLINE";
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            addLog(`Connection Closed. Reason: ${lastDisconnect.error}. Reconnecting: ${shouldReconnect}`);
            if (shouldReconnect) {
                setTimeout(() => connectToWhatsApp(), 5000);
            }
        }

        if (connection === 'open') {
            connectionStatus = "CONNECTED";
            addLog("✅ SUCCESS: WhatsApp is Linked and Live!");
        }
    });

    // --- API ROUTES ---

    // pairing and status UI
    app.get('/', (req, res) => {
        const logHtml = logs.map(l => `<div style="border-bottom:1px solid #eee;padding:5px;">${l}</div>`).join('');
        
        if (connectionStatus === "CONNECTED" && sock?.user) {
            return res.send(`
                <body style="font-family:sans-serif; background:#f0fdf4; padding:20px; text-align:center;">
                    <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 10px 20px rgba(0,0,0,0.05); max-width:500px; margin:auto;">
                        <h1 style="color:#16a34a;">✅ WhatsApp Active</h1>
                        <p>Linked to: <b>${sock.user.id.split(':')[0]}</b></p>
                        <hr>
                        <div style="text-align:left; font-size:12px; height:200px; overflow-y:auto; background:#f8fafc; padding:10px;">
                            <b>System Logs:</b><br>${logHtml}
                        </div>
                        <p style="color:red; font-size:12px; margin-top:10px;">Note: If OTP stops working, refresh this page.</p>
                    </div>
                </body>
            `);
        }

        res.send(`
            <body style="font-family:sans-serif; background:#f1f5f9; padding:20px; text-align:center;">
                <div style="background:white; padding:40px; border-radius:20px; box-shadow:0 10px 25px rgba(0,0,0,0.1); max-width:400px; margin:auto;">
                    <h1 style="color:#6366f1;">Link WhatsApp</h1>
                    <p style="color:#64748b;">Enter Admin Number with 91</p>
                    <input type="number" id="p" placeholder="9163955XXXXX" style="width:100%; padding:15px; border:2px solid #e2e8f0; border-radius:12px; margin-bottom:20px; font-size:16px;">
                    <button onclick="getCode()" id="b" style="width:100%; padding:15px; background:#6366f1; color:white; border:none; border-radius:12px; font-weight:bold; cursor:pointer;">Get Pairing Code</button>
                    <div id="c" style="margin-top:20px; font-size:32px; font-weight:800; letter-spacing:5px; color:#ec4899;"></div>
                    <hr style="margin:20px 0;">
                    <div style="text-align:left; font-size:11px; height:100px; overflow-y:auto; background:#f8fafc; padding:10px;">
                        <b>Logs:</b><br>${logHtml}
                    </div>
                </div>
                <script>
                    async function getCode(){
                        const num=document.getElementById('p').value;
                        if(!num) return alert('Enter number');
                        document.getElementById('b').innerText='Requesting Code...';
                        const r=await fetch('/request-code?phone='+num);
                        const d=await r.json();
                        if(d.code){
                            document.getElementById('c').innerText=d.code;
                            document.getElementById('b').innerText='Verify in WhatsApp';
                        }else{
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
        addLog(`Pairing Code Requested for: ${phone}`);
        try { 
            const code = await sock.requestPairingCode(phone); 
            res.json({ status: "success", code: code }); 
        } 
        catch (err) { 
            addLog(`Code Request Error: ${err.message}`);
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
}

connectToWhatsApp();
app.listen(PORT, '0.0.0.0', () => console.log(`Server live on ${PORT}`));