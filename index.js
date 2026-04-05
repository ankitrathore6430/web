const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const express = require("express");
const pino = require("pino");

const app = express();
const PORT = process.env.PORT || 10000; // Render uses 10000
const API_KEY = "SOLOR_SECRET_786"; 

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: 'error' }), // सिर्फ Error दिखाएगा
        browser: ["Ubuntu", "Chrome", "20.0.0"], // Standard browser
        printQRInTerminal: false,
        connectTimeoutMs: 60000, // 1 मिनट का टाइमआउट
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 30000, // हर 30 सेकंड में सिग्नल भेजेगा
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("\n\n👇 --- SCAN THIS QR CODE --- 👇\n");
            qrcode.generate(qr, { small: true });
            console.log("\n👆 --- SCAN NOW --- 👆\n\n");
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            console.log(`Connection closed due to ${lastDisconnect.error}, reconnecting: ${shouldReconnect}`);
            
            if (shouldReconnect) {
                // 5 सेकंड रुक कर रीकनेक्ट करें
                setTimeout(() => connectToWhatsApp(), 5000);
            }
        } else if (connection === 'open') {
            console.log("✅ SUCCESS: WhatsApp Connected!");
        }
    });

    // OTP API
    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;
        if (key !== API_KEY) return res.status(403).json({ error: "Invalid Key" });
        if (!phone || !otp) return res.status(400).json({ error: "Missing Params" });

        try {
            const jid = `91${phone}@s.whatsapp.net`;
            await sock.sendMessage(jid, { text: `☀️ *Solor Energy*\n\nYour OTP: *${otp}*` });
            res.json({ status: "success" });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    });

    app.get('/', (req, res) => res.send("Server Alive"));
}

// Start
connectToWhatsApp().catch(err => console.log("Init Error: " + err));

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});