const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const express = require("express");
const pino = require("pino");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY = "SOLOR_SECRET_786"; // इसे अपने index.html में इस्तेमाल करें

async function connectToWhatsApp() {
    // 'auth_info' फोल्डर में आपकी लॉगिन डिटेल्स सेव होंगी
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true, // Render के Logs में QR दिखेगा
        logger: pino({ level: 'silent' }), // फालतू के लॉग्स बंद ताकि RAM न भरे
        browser: ["Solor Energy", "Chrome", "1.0.0"]
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            console.log("👇 SCAN THIS QR CODE IN YOUR WHATSAPP 👇");
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
            console.log('Connection closed. Reconnecting...', shouldReconnect);
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') {
            console.log("✅ WhatsApp Connected Successfully!");
        }
    });

    // OTP भेजने का API Endpoint
    app.get('/send-otp', async (req, res) => {
        const { phone, otp, key } = req.query;

        if (key !== API_KEY) return res.status(403).json({ error: "Invalid API Key" });
        if (!phone || !otp) return res.status(400).json({ error: "Missing Parameters" });

        try {
            const jid = `91${phone}@s.whatsapp.net`; // 91 for India
            const msg = `☀️ *Solor Energy Verification*\n\nYour OTP is: *${otp}*\n\nDo not share this code with anyone.`;
            
            await sock.sendMessage(jid, { text: msg });
            console.log(`OTP ${otp} sent to ${phone}`);
            res.json({ status: "success", message: "OTP Sent" });
        } catch (err) {
            console.error("Error sending message:", err);
            res.status(500).json({ status: "error", message: err.message });
        }
    });

    // हेल्थ चेक (ताकि Render सर्वर को बंद न करे)
    app.get('/', (res) => {
        res.send("WhatsApp OTP Server is Running!");
    });
}

// शुरू करें
connectToWhatsApp();
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
