// bot.js - Solor Energy Telegram Bot
// FIXED: Express server + Webhook for Render.com production
// URL: https://solorbot.onrender.com

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Firebase v9 modular imports
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onChildAdded, onChildChanged, get } = require('firebase/database');

// ==================== CONFIGURATION ====================
const BOT_TOKEN = '1233674761:AAFdjpqG-N64dTVnK1vFTuQAplFD-WyK8u8';
const ADMIN_IDS = ['745211839'];
const ADMIN_PHONE = '+916395503566';

// Express app
const app = express();
app.use(express.json());
const PORT = process.env.PORT || 10000;

// Auto-detect webhook URL from Render environment
const RENDER_URL = process.env.RENDER_EXTERNAL_HOSTNAME 
    ? `https://${process.env.RENDER_EXTERNAL_HOSTNAME}` 
    : 'https://solorbot.onrender.com';
const WEBHOOK_PATH = `/bot${BOT_TOKEN}`;
const WEBHOOK_URL = `${RENDER_URL}${WEBHOOK_PATH}`;

// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyA3pH_dnb6_--wRoDSuoj-TAudsmJ7D4R0",
    authDomain: "solor-energy.firebaseapp.com",
    databaseURL: "https://solor-energy-default-rtdb.firebaseio.com",
    projectId: "solor-energy",
    storageBucket: "solor-energy.firebasestorage.app",
    messagingSenderId: "772737546715",
    appId: "1:772737546715:web:3736545b464523bdc04ffe"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// Store admin states
const adminStates = {};

// ==================== EXPRESS SERVER ====================

// Health check - REQUIRED by Render.com
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        bot: 'running',
        webhook: WEBHOOK_URL,
        timestamp: new Date().toISOString() 
    });
});

// Ping endpoint
app.get('/ping', (req, res) => {
    res.status(200).send('OK');
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Solor Energy Telegram Bot is running!',
        admin: ADMIN_PHONE,
        webhook_url: WEBHOOK_URL,
        status: 'active'
    });
});

// Webhook endpoint for Telegram
app.post(WEBHOOK_PATH, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Start Express server FIRST
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Express server running on port ${PORT}`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
    console.log(`🔗 Webhook URL: ${WEBHOOK_URL}`);
});

// ==================== BOT INITIALIZATION ====================

// Create bot with webhook mode (NO polling to avoid crashes)
const bot = new TelegramBot(BOT_TOKEN, { 
    webHook: { 
        autoOpen: false  // Don't open local port, we use Express
    } 
});

// Set webhook on Telegram servers
bot.setWebHook(WEBHOOK_URL).then(() => {
    console.log('✅ Webhook set successfully on Telegram');
}).catch(err => {
    console.error('❌ Webhook setup failed:', err.message);
    console.log('⚠️ Bot will still work for outbound messages');
});

// ==================== UTILITY FUNCTIONS ====================
function isAdmin(chatId) {
    return ADMIN_IDS.includes(chatId.toString());
}

function escapeMarkdown(text) {
    if (!text) return '';
    return text.replace(/[_*\[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

function formatCurrency(amount) {
    return '₹' + parseInt(amount || 0).toLocaleString('en-IN');
}

// ==================== NOTIFICATION FUNCTIONS ====================

async function sendDailyClaimReminder(telegramId, userName, claimAmount) {
    if (!telegramId) return;
    try {
        const message = `🔔 *Daily Claim Reminder*\n\n` +
            `Hi ${escapeMarkdown(userName)}\!\n\n` +
            `💰 Your daily earning of *${formatCurrency(claimAmount)}* is ready to claim\!\n\n` +
            `👉 Open the app and tap "Claim Now"\n\n` +
            `⏰ Don't miss it\! Claim before 11:59 PM\n\n` +
            `☀️ *Solor Energy*`;
        await bot.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        console.error('❌ Daily claim error:', error.message);
    }
}

async function sendDepositNotification(telegramId, userName, amount, status, reason) {
    if (!telegramId) return;
    try {
        let emoji, title, message;
        if (status === 'pending') {
            emoji = '⏳'; title = 'Deposit Pending';
            message = `Hi ${escapeMarkdown(userName)}\!\n\nYour deposit of *${formatCurrency(amount)}* is under review\n\n⏳ Status: *PENDING*\n\n☀️ *Solor Energy*`;
        } else if (status === 'approved') {
            emoji = '✅'; title = 'Deposit Approved';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n🎉 Your deposit of *${formatCurrency(amount)}* has been *APPROVED*\n\n✅ Amount added to wallet\n\n☀️ *Solor Energy*`;
        } else {
            emoji = '❌'; title = 'Deposit Rejected';
            message = `Hi ${escapeMarkdown(userName)}\!\n\nYour deposit of *${formatCurrency(amount)}* was *REJECTED*\n\n❌ Reason: *${escapeMarkdown(reason || 'Invalid details')}*\n\n☀️ *Solor Energy*`;
        }
        await bot.sendMessage(telegramId, `${emoji} *${title}*\n\n${message}`, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        console.error('❌ Deposit notify error:', error.message);
    }
}

async function sendWithdrawalNotification(telegramId, userName, amount, status, reason) {
    if (!telegramId) return;
    try {
        let emoji, title, message;
        if (status === 'pending') {
            emoji = '⏳'; title = 'Withdrawal Requested';
            message = `Hi ${escapeMarkdown(userName)}\!\n\nYour withdrawal of *${formatCurrency(amount)}* is submitted\n\n⏳ Status: *PENDING*\n\n☀️ *Solor Energy*`;
        } else if (status === 'approved') {
            emoji = '✅'; title = 'Withdrawal Approved';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n🎉 Your withdrawal of *${formatCurrency(amount)}* is *APPROVED*\n\n💳 UTR: *${escapeMarkdown(reason || 'N/A')}*\n\n☀️ *Solor Energy*`;
        } else {
            emoji = '❌'; title = 'Withdrawal Rejected';
            message = `Hi ${escapeMarkdown(userName)}\!\n\nYour withdrawal of *${formatCurrency(amount)}* was *REJECTED*\n\n❌ Reason: *${escapeMarkdown(reason || 'Invalid details')}*\n💰 Amount refunded\n\n☀️ *Solor Energy*`;
        }
        await bot.sendMessage(telegramId, `${emoji} *${title}*\n\n${message}`, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        console.error('❌ Withdrawal notify error:', error.message);
    }
}

async function sendTicketNotification(telegramId, userName, ticketSubject, status, reply) {
    if (!telegramId) return;
    try {
        let emoji, title, message;
        if (status === 'created') {
            emoji = '🎫'; title = 'Ticket Created';
            message = `Hi ${escapeMarkdown(userName)}\!\n\nYour ticket *${escapeMarkdown(ticketSubject)}* is created\n\n⏳ Status: *OPEN*\n\n☀️ *Solor Energy*`;
        } else {
            emoji = '💬'; title = 'Ticket Reply';
            message = `Hi ${escapeMarkdown(userName)}\!\n\nAdmin replied to *${escapeMarkdown(ticketSubject)}*\n\n💬 *${escapeMarkdown(reply)}*\n\n✅ Status: *CLOSED*\n\n☀️ *Solor Energy*`;
        }
        await bot.sendMessage(telegramId, `${emoji} *${title}*\n\n${message}`, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        console.error('❌ Ticket notify error:', error.message);
    }
}

async function sendReferralNotification(telegramId, userName, referredUserName, amount) {
    if (!telegramId) return;
    try {
        const message = `🎁 *Referral Bonus\!*\n\nHi ${escapeMarkdown(userName)}\!\n\n🎉 ${escapeMarkdown(referredUserName)} joined\n\n💰 You earned: *${formatCurrency(amount)}*\n\n☀️ *Solor Energy*`;
        await bot.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        console.error('❌ Referral notify error:', error.message);
    }
}

// ==================== FIREBASE LISTENERS ====================

function setupDepositListeners() {
    const depositsRef = ref(database, 'deposits');
    onChildChanged(depositsRef, async (snapshot) => {
        const deposit = snapshot.val();
        if (!deposit || !deposit.userId) return;
        try {
            const userRef = ref(database, `users/${deposit.userId}`);
            const userSnap = await get(userRef);
            const user = userSnap.val();
            if (user && user.telegramId && (deposit.status === 'approved' || deposit.status === 'rejected')) {
                await sendDepositNotification(user.telegramId, user.name, deposit.amount, deposit.status, deposit.adminReason);
            }
        } catch (error) {
            console.error('❌ Deposit listener error:', error.message);
        }
    });
}

function setupWithdrawalListeners() {
    const withdrawalsRef = ref(database, 'withdrawals');
    onChildChanged(withdrawalsRef, async (snapshot) => {
        const withdrawal = snapshot.val();
        if (!withdrawal || !withdrawal.userId) return;
        try {
            const userRef = ref(database, `users/${withdrawal.userId}`);
            const userSnap = await get(userRef);
            const user = userSnap.val();
            if (user && user.telegramId && (withdrawal.status === 'approved' || withdrawal.status === 'rejected')) {
                await sendWithdrawalNotification(user.telegramId, user.name, withdrawal.amount, withdrawal.status, withdrawal.adminReason);
            }
        } catch (error) {
            console.error('❌ Withdrawal listener error:', error.message);
        }
    });
}

function setupTicketListeners() {
    const ticketsRef = ref(database, 'tickets');

    onChildAdded(ticketsRef, async (snapshot) => {
        const ticket = snapshot.val();
        if (!ticket || !ticket.userId) return;

        // Notify admin
        for (const adminId of ADMIN_IDS) {
            try {
                const message = `🎫 *New Ticket*\n\nFrom: *${escapeMarkdown(ticket.userName || 'Unknown')}*\nPhone: *${escapeMarkdown(ticket.userPhone || 'N/A')}*\nType: *${escapeMarkdown((ticket.type || 'OTHER').toUpperCase())}*\nSubject: *${escapeMarkdown(ticket.subject)}*\n\n${escapeMarkdown(ticket.message)}\n\n☀️ *Admin*`;
                await bot.sendMessage(adminId, message, { parse_mode: 'MarkdownV2' });
            } catch (error) {
                console.error('❌ Admin notify error:', error.message);
            }
        }

        // Notify user
        try {
            const userRef = ref(database, `users/${ticket.userId}`);
            const userSnap = await get(userRef);
            const user = userSnap.val();
            if (user && user.telegramId) {
                await sendTicketNotification(user.telegramId, user.name, ticket.subject, 'created');
            }
        } catch (error) {
            console.error('❌ Ticket user notify error:', error.message);
        }
    });

    onChildChanged(ticketsRef, async (snapshot) => {
        const ticket = snapshot.val();
        if (!ticket || !ticket.userId || ticket.status !== 'closed') return;
        try {
            const userRef = ref(database, `users/${ticket.userId}`);
            const userSnap = await get(userRef);
            const user = userSnap.val();
            if (user && user.telegramId && ticket.reply) {
                await sendTicketNotification(user.telegramId, user.name, ticket.subject, 'replied', ticket.reply);
            }
        } catch (error) {
            console.error('❌ Ticket reply error:', error.message);
        }
    });
}

function setupReferralListeners() {
    const usersRef = ref(database, 'users');
    onChildAdded(usersRef, async (snapshot) => {
        const user = snapshot.val();
        if (!user || !user.referredBy || user.referredBy === 'ADMIN') return;
        try {
            const refQuery = ref(database, 'users');
            const refSnap = await get(refQuery);
            const allUsers = refSnap.val() || {};

            let referrer = null;
            for (const [uid, uData] of Object.entries(allUsers)) {
                if (uData.referralCode === user.referredBy) {
                    referrer = uData;
                    break;
                }
            }

            if (referrer && referrer.telegramId) {
                const settingsRef = ref(database, 'settings/referAmount');
                const settingsSnap = await get(settingsRef);
                const referAmount = settingsSnap.val() || 15;
                await sendReferralNotification(referrer.telegramId, referrer.name, user.name, referAmount);
            }
        } catch (error) {
            console.error('❌ Referral listener error:', error.message);
        }
    });
}

// ==================== ADMIN BROADCAST ====================

async function broadcastMessage(text) {
    try {
        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};
        let sent = 0, failed = 0;

        for (const [userId, user] of Object.entries(users)) {
            if (user.telegramId) {
                try {
                    await bot.sendMessage(user.telegramId, text, { parse_mode: 'MarkdownV2' });
                    sent++;
                } catch (error) {
                    failed++;
                    console.error(`❌ Failed to send to ${userId}:`, error.message);
                }
            }
        }
        return { sent, failed, total: Object.keys(users).length };
    } catch (error) {
        console.error('❌ Broadcast error:', error.message);
        return { sent: 0, failed: 0, total: 0 };
    }
}

async function broadcastPhoto(photoFileId, caption) {
    try {
        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};
        let sent = 0, failed = 0;

        for (const [userId, user] of Object.entries(users)) {
            if (user.telegramId) {
                try {
                    await bot.sendPhoto(user.telegramId, photoFileId, {
                        caption: caption || '',
                        parse_mode: 'MarkdownV2'
                    });
                    sent++;
                } catch (error) {
                    failed++;
                    console.error(`❌ Failed photo to ${userId}:`, error.message);
                }
            }
        }
        return { sent, failed, total: Object.keys(users).length };
    } catch (error) {
        console.error('❌ Photo broadcast error:', error.message);
        return { sent: 0, failed: 0, total: 0 };
    }
}

// ==================== BOT COMMANDS ====================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.first_name || 'User';

    if (isAdmin(chatId)) {
        const adminMenu = `👑 *Welcome Admin\!*\n\n☀️ *Solor Energy Bot*\n\n📢 *Commands:*\n• /broadcast \- Text to all\n• /broadcastpic \- Photo to all\n• /stats \- Statistics\n• /users \- User list\n• /notifyuser \- Message to one\n\n🔔 *Auto notifications:*\n• Deposits\n• Withdrawals\n• Tickets\n• Referrals\n\n☀️ *Solor Energy*`;
        await bot.sendMessage(chatId, adminMenu, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                keyboard: [
                    ['📢 Broadcast', '📸 Broadcast Pic'],
                    ['📊 Stats', '👥 Users'],
                    ['🔔 Test']
                ],
                resize_keyboard: true
            }
        });
    } else {
        const welcome = `☀️ *Welcome\!*\n\nHi ${escapeMarkdown(username)}\!\n\n🔗 *Link your account:*\n1\. Login to app\n2\. Go to Profile\n3\. Enter code: *${chatId}*\n\n📱 *Notifications:*\n✅ Deposits\n💰 Withdrawals\n🎫 Tickets\n🎁 Daily claims\n\n☀️ *Solor Energy*`;
        await bot.sendMessage(chatId, welcome, { parse_mode: 'MarkdownV2' });
    }
});

bot.onText(/\/broadcast/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    adminStates[chatId] = { action: 'broadcast_text' };
    await bot.sendMessage(chatId, '📢 *Broadcast Mode*\n\nType message for ALL users\n\nUse *bold* _italic_ `code`\n\n/cancel to exit', { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/broadcastpic/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    adminStates[chatId] = { action: 'broadcast_photo', step: 'waiting_photo' };
    await bot.sendMessage(chatId, '📸 *Broadcast Photo*\n\nSend photo\n\n/cancel to exit', { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/stats/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};

        const totalUsers = Object.keys(users).length;
        const telegramUsers = Object.values(users).filter(u => u.telegramId).length;
        const activeUsers = Object.values(users).filter(u => u.status === 'active').length;

        const depositsRef = ref(database, 'deposits');
        const depositsSnap = await get(depositsRef);
        const deposits = depositsSnap.val() || {};
        const pendingDeps = Object.values(deposits).filter(d => d.status === 'pending').length;

        const withdrawalsRef = ref(database, 'withdrawals');
        const withdrawalsSnap = await get(withdrawalsRef);
        const withdrawals = withdrawalsSnap.val() || {};
        const pendingWiths = Object.values(withdrawals).filter(w => w.status === 'pending').length;

        const ticketsRef = ref(database, 'tickets');
        const ticketsSnap = await get(ticketsRef);
        const tickets = ticketsSnap.val() || {};
        const openTickets = Object.values(tickets).filter(t => t.status === 'open').length;

        const stats = `📊 *Statistics*\n\n👥 Users: *${totalUsers}*\n📱 With Telegram: *${telegramUsers}*\n✅ Active: *${activeUsers}*\n\n💰 Pending Deposits: *${pendingDeps}*\n💰 Pending Withdrawals: *${pendingWiths}*\n\n🎫 Open Tickets: *${openTickets}*\n\n☀️ *Solor Energy Bot*`;
        await bot.sendMessage(chatId, stats, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${escapeMarkdown(error.message)}`, { parse_mode: 'MarkdownV2' });
    }
});

bot.onText(/\/users/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    try {
        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};

        const telegramUsers = Object.entries(users)
            .filter(([_, u]) => u.telegramId)
            .map(([id, u]) => ({ id, ...u }));

        if (telegramUsers.length === 0) {
            await bot.sendMessage(chatId, '❌ No Telegram users yet', { parse_mode: 'MarkdownV2' });
            return;
        }

        let message = `👥 *Telegram Users (${telegramUsers.length})*\n\n`;
        for (const user of telegramUsers.slice(0, 20)) {
            message += `• *${escapeMarkdown(user.name || 'Unknown')}* (${escapeMarkdown(user.phone || 'N/A')})\n  ID: \`${user.telegramId}\`\n  Bal: *${formatCurrency(user.wallet?.mainBalance || 0)}*\n\n`;
        }
        if (telegramUsers.length > 20) message += `... *${telegramUsers.length - 20}* more\n`;
        message += `☀️ *Solor Energy*`;
        await bot.sendMessage(chatId, message, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error: ${escapeMarkdown(error.message)}`, { parse_mode: 'MarkdownV2' });
    }
});

bot.onText(/\/notifyuser/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    adminStates[chatId] = { action: 'notify_user', step: 'waiting_id' };
    await bot.sendMessage(chatId, '👤 *Notify User*\n\nEnter Telegram ID or Phone\n\n/cancel to exit', { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    delete adminStates[chatId];
    await bot.sendMessage(chatId, '✅ Cancelled', { parse_mode: 'MarkdownV2' });
});

// Keyboard buttons
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!isAdmin(chatId) || !text) return;

    if (text === '📢 Broadcast') {
        adminStates[chatId] = { action: 'broadcast_text' };
        await bot.sendMessage(chatId, '📢 *Broadcast Mode*\n\nType message for ALL users\n\n/cancel to exit', { parse_mode: 'MarkdownV2' });
    } else if (text === '📸 Broadcast Pic') {
        adminStates[chatId] = { action: 'broadcast_photo', step: 'waiting_photo' };
        await bot.sendMessage(chatId, '📸 *Broadcast Photo*\n\nSend photo\n\n/cancel to exit', { parse_mode: 'MarkdownV2' });
    } else if (text === '📊 Stats') {
        bot.emit('text', { ...msg, text: '/stats' });
    } else if (text === '👥 Users') {
        bot.emit('text', { ...msg, text: '/users' });
    } else if (text === '🔔 Test') {
        await bot.sendMessage(chatId, '🔔 *Test*\n\n*Bold* _Italic_ `Code`\n\n☀️ *Solor Energy*', { parse_mode: 'MarkdownV2' });
    }
});

// Text handler for states
bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;
    if (!adminStates[chatId] || text.startsWith('/')) return;

    const state = adminStates[chatId];

    if (state.action === 'broadcast_text') {
        await bot.sendMessage(chatId, '⏳ Broadcasting...');
        const result = await broadcastMessage(text);
        await bot.sendMessage(chatId, `✅ *Done*\n\n📤 Sent: *${result.sent}*\n❌ Failed: *${result.failed}*\n👥 Total: *${result.total}*\n\n☀️ *Solor Energy*`, { parse_mode: 'MarkdownV2' });
        delete adminStates[chatId];
        return;
    }

    if (state.action === 'notify_user' && state.step === 'waiting_id') {
        state.target = text.trim();
        state.step = 'waiting_message';
        await bot.sendMessage(chatId, '✅ ID saved\n\nType message\n\n/cancel to exit', { parse_mode: 'MarkdownV2' });
        return;
    }

    if (state.action === 'notify_user' && state.step === 'waiting_message') {
        const target = state.target;
        try {
            let telegramId = target;
            if (target.length === 10 && !isNaN(target)) {
                const usersRef = ref(database, 'users');
                const usersSnap = await get(usersRef);
                const users = usersSnap.val() || {};
                for (const [uid, uData] of Object.entries(users)) {
                    if (uData.phone === target && uData.telegramId) {
                        telegramId = uData.telegramId;
                        break;
                    }
                }
            }
            if (!telegramId) {
                await bot.sendMessage(chatId, '❌ User not found', { parse_mode: 'MarkdownV2' });
                delete adminStates[chatId];
                return;
            }
            await bot.sendMessage(telegramId, text, { parse_mode: 'MarkdownV2' });
            await bot.sendMessage(chatId, `✅ Sent to *${escapeMarkdown(target)}*`, { parse_mode: 'MarkdownV2' });
        } catch (error) {
            await bot.sendMessage(chatId, `❌ Error: ${escapeMarkdown(error.message)}`, { parse_mode: 'MarkdownV2' });
        }
        delete adminStates[chatId];
        return;
    }

    if (state.action === 'broadcast_photo' && state.step === 'waiting_caption') {
        state.caption = text;
        state.step = 'ready_to_send';
        await bot.sendMessage(chatId, `📸 *Ready*\n\n${escapeMarkdown(text)}\n\n/confirm or /cancel`, { parse_mode: 'MarkdownV2' });
        return;
    }
});

// Photo handler
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    if (!adminStates[chatId] || adminStates[chatId].action !== 'broadcast_photo') return;

    const state = adminStates[chatId];
    if (state.step === 'waiting_photo') {
        const photos = msg.photo;
        state.photoFileId = photos[photos.length - 1].file_id;
        state.step = 'waiting_caption';
        await bot.sendMessage(chatId, '📸 Photo received\!\n\nType caption\n\n/skip for none\n/cancel to exit', { parse_mode: 'MarkdownV2' });
    }
});

bot.onText(/\/confirm/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    if (!adminStates[chatId]) return;

    const state = adminStates[chatId];
    if (state.action === 'broadcast_photo' && state.step === 'ready_to_send') {
        await bot.sendMessage(chatId, '⏳ Broadcasting photo...');
        const result = await broadcastPhoto(state.photoFileId, state.caption || '');
        await bot.sendMessage(chatId, `✅ *Done*\n\n📤 Sent: *${result.sent}*\n❌ Failed: *${result.failed}*\n👥 Total: *${result.total}*\n\n☀️ *Solor Energy*`, { parse_mode: 'MarkdownV2' });
        delete adminStates[chatId];
    }
});

bot.onText(/\/skip/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;
    if (!adminStates[chatId]) return;

    const state = adminStates[chatId];
    if (state.action === 'broadcast_photo' && state.step === 'waiting_caption') {
        state.caption = '';
        state.step = 'ready_to_send';
        await bot.sendMessage(chatId, `📸 *Ready*\n\nNo caption\n\n/confirm or /cancel`, { parse_mode: 'MarkdownV2' });
    }
});

// ==================== DAILY REMINDERS ====================

async function sendDailyReminders() {
    try {
        const now = new Date();
        if (now.getHours() !== 9) return;

        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};

        for (const [userId, user] of Object.entries(users)) {
            if (!user.telegramId || user.status === 'blocked') continue;

            const plans = Object.values(user.activePlans || {});
            if (plans.length === 0) continue;
            if (user.lastClaimDate === now.toDateString()) continue;

            const totalDaily = plans.reduce((sum, p) => sum + (p.dailyReturn || 0), 0);
            await sendDailyClaimReminder(user.telegramId, user.name, totalDaily);
        }
        console.log('✅ Daily reminders sent');
    } catch (error) {
        console.error('❌ Daily reminders error:', error);
    }
}

setInterval(sendDailyReminders, 3600000);

// ==================== INIT ====================
console.log('🤖 Solor Energy Bot Started!');
console.log('🔗 URL:', RENDER_URL);
console.log('👑 Admin:', ADMIN_IDS);

setupDepositListeners();
setupWithdrawalListeners();
setupTicketListeners();
setupReferralListeners();

console.log('✅ Listeners active');

// Error handling
bot.on('error', (error) => {
    console.error('⚠️ Bot error:', error.message);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down...');
    server.close(() => {
        console.log('✅ Server closed');
        process.exit(0);
    });
    setTimeout(() => process.exit(1), 25000);
});

process.on('SIGINT', () => {
    console.log('\n🛑 Stopping...');
    server.close(() => process.exit(0));
});