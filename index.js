const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcodeTerminal = require("qrcode-terminal");
const QRCode = require('qrcode'); // Web QR के लिए
const express = require("express");
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 10000;
const API_KEY = "SOLOR_SECRET_786"; 

let lastQr = null; // QR स्टोर करने के लिए

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }),
        browser: ["Ubuntu", "Chrome", "20.0.0"],
        connectTimeoutMs: 60000,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            lastQr = qr; // QR कोड को वेरिएबल में सेव करें
            console.log("👇 --- QR CODE UPDATED (Check Web URL) --- 👇");
            qrcodeTerminal.generate(qr, { small: true });
        }

        if (connection === 'close') {
            lastQr = null;
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) setTimeout(() => connectToWhatsApp(), 5000);
        } else if (connection === 'open') {
            lastQr = null; // कनेक्ट होने पर QR हटा दें
            console.log("✅ SUCCESS: WhatsApp Connected!");
        }
    });

    // --- ROUTES ---

    // 1. WEB QR VIEW (इस URL को ब्राउज़र में खोलें)
    app.get('/', async (req, res) => {
        if (!lastQr) {
            return res.send(`
                <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;text-align:center;">
                    <div style="padding:20px; border-radius:15px; background:#dcfce7; color:#166534;">
                        <h1>✅ WhatsApp is Connected!</h1>
                        <p>Server is live and ready to send OTPs.</p>
                    </div>
                </body>
            `);
        }

        // QR को Image (DataURL) में बदलें
        const qrImage = await QRCode.toDataURL(lastQr);
        
        res.send(`
            <body style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;background:#f1f5f9;">
                <div style="background:white; padding:40px; border-radius:30px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1); text-align:center;">
                    <h1 style="color:#6366f1;">Scan for Solor Energy</h1>
                    <p style="color:#64748b;">Open WhatsApp > Linked Devices > Link a Device</p>
                    <img src="${qrImage}" style="width:300px; height:300px; border:10px solid white; box-shadow:0 0 10px rgba(0,0,0,0.1); margin:20px 0;" />
                    <p style="font-size:12px; color:#94a3b8;">Page will auto-refresh every 20 seconds</p>
                </div>
                <script>setTimeout(() => location.reload(), 20000);</script>
            </body>
        `);
    });

    // 2. OTP API
    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY) return res.status(403).json({ error: "Invalid Key" });
        try {
            const jid = `91${phone}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: `☀️ *Solor Energy*\n\nYour OTP: *${otp}*` });
            res.json({ status: "success" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });
}

connectToWhatsApp().catch(err => console.log(err));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});