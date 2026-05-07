// bot.js - Complete Telegram Bot for Solor Energy
// FIXED: Express server + Webhook for Render.com production

const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Firebase v9 modular imports
const { initializeApp } = require('firebase/app');
const { getDatabase, ref, onValue, onChildAdded, onChildChanged, set, update, remove, get } = require('firebase/database');

// ==================== CONFIGURATION ====================
const BOT_TOKEN = '1233674761:AAFdjpqG-N64dTVnK1vFTuQAplFD-WyK8u8';
const ADMIN_IDS = ['745211839']; // Telegram user IDs of admins
const ADMIN_PHONE = '+916395503566';

// Express app for health check port
const app = express();
const PORT = process.env.PORT || 10000;

// Firebase Config (Same as your app)
const firebaseConfig = {
    apiKey: "AIzaSyA3pH_dnb6_--wRoDSuoj-TAudsmJ7D4R0",
    authDomain: "solor-energy.firebaseapp.com",
    databaseURL: "https://solor-energy-default-rtdb.firebaseio.com",
    projectId: "solor-energy",
    storageBucket: "solor-energy.firebasestorage.app",
    messagingSenderId: "772737546715",
    appId: "1:772737546715:web:3736545b464523bdc04ffe"
};

// Initialize Firebase v9
const firebaseApp = initializeApp(firebaseConfig);
const database = getDatabase(firebaseApp);

// Store admin states for broadcast
const adminStates = {};

// ==================== EXPRESS SERVER (For Render.com) ====================

// Health check endpoint - Render.com requires this
app.get('/health', (req, res) => {
    res.status(200).json({ 
        status: 'healthy', 
        bot: 'running',
        timestamp: new Date().toISOString() 
    });
});

// Ping endpoint to keep alive
app.get('/ping', (req, res) => {
    res.status(200).send('OK');
});

// Root endpoint
app.get('/', (req, res) => {
    res.status(200).json({ 
        message: 'Solor Energy Telegram Bot is running!',
        admin: ADMIN_PHONE,
        status: 'active'
    });
});

// Start Express server
const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`🌐 Express server running on port ${PORT}`);
    console.log(`📡 Health check: http://0.0.0.0:${PORT}/health`);
});

// ==================== WEBHOOK SETUP (Better than polling for production) ====================

// Use WEBHOOK_URL from environment variable, or construct from Render URL
const WEBHOOK_URL = process.env.WEBHOOK_URL || `https://${process.env.RENDER_EXTERNAL_HOSTNAME}/bot${BOT_TOKEN}`;

let bot;

if (process.env.WEBHOOK_URL || process.env.RENDER_EXTERNAL_HOSTNAME) {
    // Production: Use Webhook
    bot = new TelegramBot(BOT_TOKEN, { webHook: { port: false } });
    bot.setWebHook(`${WEBHOOK_URL}/bot${BOT_TOKEN}`).then(() => {
        console.log('✅ Webhook set:', `${WEBHOOK_URL}/bot${BOT_TOKEN}`);
    }).catch(err => {
        console.error('❌ Webhook setup failed:', err.message);
        // Fallback to polling
        startPolling();
    });

    // Express route for webhook
    app.post(`/bot${BOT_TOKEN}`, (req, res) => {
        bot.processUpdate(req.body);
        res.sendStatus(200);
    });
} else {
    // Development: Use Polling
    startPolling();
}

function startPolling() {
    bot = new TelegramBot(BOT_TOKEN, { polling: true });
    console.log('🔄 Using polling mode (development)');

    // Handle polling errors gracefully
    bot.on('polling_error', (error) => {
        console.error('⚠️ Polling error:', error.message);
        // Don't crash - just log and continue
    });
}

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

// ==================== USER NOTIFICATION FUNCTIONS ====================

async function sendDailyClaimReminder(telegramId, userName, claimAmount) {
    if (!telegramId) return;
    try {
        const message = `🔔 *Daily Claim Reminder*\n\n` +
            `Hi ${escapeMarkdown(userName)}\!\n\n` +
            `💰 Your daily earning of *${formatCurrency(claimAmount)}* is ready to claim\!\n\n` +
            `👉 Open the app and tap "Claim Now" to receive your earnings\n\n` +
            `⏰ Don't miss it\! Claim before 11:59 PM today\n\n` +
            `☀️ *Solor Energy*`;

        await bot.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
        console.log(`✅ Daily claim reminder sent to ${telegramId}`);
    } catch (error) {
        console.error('❌ Error sending daily claim reminder:', error.message);
    }
}

async function sendDepositNotification(telegramId, userName, amount, status, reason) {
    if (!telegramId) return;
    reason = reason || '';
    try {
        let emoji, title, message;

        if (status === 'pending') {
            emoji = '⏳';
            title = 'Deposit Pending';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `Your deposit request of *${formatCurrency(amount)}* has been received and is under review\n\n` +
                `⏳ Status: *PENDING*\n` +
                `We will notify you once approved\n\n` +
                `☀️ *Solor Energy*`;
        } else if (status === 'approved') {
            emoji = '✅';
            title = 'Deposit Approved';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `🎉 Great news\! Your deposit of *${formatCurrency(amount)}* has been *APPROVED*\n\n` +
                `✅ Amount added to your wallet\n` +
                `💰 You can now invest in plans\n\n` +
                `☀️ *Solor Energy*`;
        } else if (status === 'rejected') {
            emoji = '❌';
            title = 'Deposit Rejected';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `Your deposit of *${formatCurrency(amount)}* has been *REJECTED*\n\n` +
                `❌ Reason: *${escapeMarkdown(reason || 'Invalid transaction details')}*\n\n` +
                `Please check your payment details and try again\n\n` +
                `☀️ *Solor Energy*`;
        }

        const fullMessage = `${emoji} *${title}*\n\n${message}`;
        await bot.sendMessage(telegramId, fullMessage, { parse_mode: 'MarkdownV2' });
        console.log(`✅ Deposit ${status} notification sent to ${telegramId}`);
    } catch (error) {
        console.error('❌ Error sending deposit notification:', error.message);
    }
}

async function sendWithdrawalNotification(telegramId, userName, amount, status, reason) {
    if (!telegramId) return;
    reason = reason || '';
    try {
        let emoji, title, message;

        if (status === 'pending') {
            emoji = '⏳';
            title = 'Withdrawal Requested';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `Your withdrawal request of *${formatCurrency(amount)}* has been submitted\n\n` +
                `⏳ Status: *PENDING*\n` +
                `Our team is processing your request\n` +
                `You will be notified once completed\n\n` +
                `☀️ *Solor Energy*`;
        } else if (status === 'approved') {
            emoji = '✅';
            title = 'Withdrawal Approved';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `🎉 Your withdrawal of *${formatCurrency(amount)}* has been *APPROVED*\n\n` +
                `✅ Payment has been sent to your account\n` +
                `💳 UTR/Reference: *${escapeMarkdown(reason || 'N/A')}*\n\n` +
                `Thank you for using Solor Energy\n\n` +
                `☀️ *Solor Energy*`;
        } else if (status === 'rejected') {
            emoji = '❌';
            title = 'Withdrawal Rejected';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `Your withdrawal of *${formatCurrency(amount)}* has been *REJECTED*\n\n` +
                `❌ Reason: *${escapeMarkdown(reason || 'Invalid bank/UPI details')}*\n` +
                `💰 Amount refunded to your wallet\n\n` +
                `Please update your details and try again\n\n` +
                `☀️ *Solor Energy*`;
        }

        const fullMessage = `${emoji} *${title}*\n\n${message}`;
        await bot.sendMessage(telegramId, fullMessage, { parse_mode: 'MarkdownV2' });
        console.log(`✅ Withdrawal ${status} notification sent to ${telegramId}`);
    } catch (error) {
        console.error('❌ Error sending withdrawal notification:', error.message);
    }
}

async function sendTicketNotification(telegramId, userName, ticketSubject, status, reply) {
    if (!telegramId) return;
    reply = reply || '';
    try {
        let emoji, title, message;

        if (status === 'created') {
            emoji = '🎫';
            title = 'Support Ticket Created';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `Your support ticket has been created successfully\n\n` +
                `📋 Subject: *${escapeMarkdown(ticketSubject)}*\n` +
                `⏳ Status: *OPEN*\n\n` +
                `Our team will review and respond shortly\n\n` +
                `☀️ *Solor Energy*`;
        } else if (status === 'replied') {
            emoji = '💬';
            title = 'New Reply on Your Ticket';
            message = `Hi ${escapeMarkdown(userName)}\!\n\n` +
                `Admin has replied to your ticket\n\n` +
                `📋 Subject: *${escapeMarkdown(ticketSubject)}*\n` +
                `💬 Reply: *${escapeMarkdown(reply)}*\n\n` +
                `✅ Status: *CLOSED*\n\n` +
                `If you need further help, create a new ticket\n\n` +
                `☀️ *Solor Energy*`;
        }

        const fullMessage = `${emoji} *${title}*\n\n${message}`;
        await bot.sendMessage(telegramId, fullMessage, { parse_mode: 'MarkdownV2' });
        console.log(`✅ Ticket ${status} notification sent to ${telegramId}`);
    } catch (error) {
        console.error('❌ Error sending ticket notification:', error.message);
    }
}

async function sendPlanPurchaseNotification(telegramId, userName, planName, price, dailyReturn) {
    if (!telegramId) return;
    try {
        const message = `🎉 *Plan Activated\!*\n\n` +
            `Hi ${escapeMarkdown(userName)}\!\n\n` +
            `✅ You have successfully purchased\n` +
            `📦 Plan: *${escapeMarkdown(planName)}*\n` +
            `💰 Price: *${formatCurrency(price)}*\n` +
            `📈 Daily Return: *${formatCurrency(dailyReturn)}*\n\n` +
            `🎁 First day earning of *${formatCurrency(dailyReturn)}* has been credited to your wallet\n\n` +
            `Don't forget to claim daily\!\n\n` +
            `☀️ *Solor Energy*`;

        await bot.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
        console.log(`✅ Plan purchase notification sent to ${telegramId}`);
    } catch (error) {
        console.error('❌ Error sending plan purchase notification:', error.message);
    }
}

async function sendReferralNotification(telegramId, userName, referredUserName, amount) {
    if (!telegramId) return;
    try {
        const message = `🎁 *Referral Bonus Earned\!*\n\n` +
            `Hi ${escapeMarkdown(userName)}\!\n\n` +
            `🎉 Your friend *${escapeMarkdown(referredUserName)}* just joined Solor Energy\n\n` +
            `💰 You earned: *${formatCurrency(amount)}*\n` +
            `💳 Credited to your wallet instantly\n\n` +
            `Keep sharing your link to earn more\!\n\n` +
            `☀️ *Solor Energy*`;

        await bot.sendMessage(telegramId, message, { parse_mode: 'MarkdownV2' });
        console.log(`✅ Referral notification sent to ${telegramId}`);
    } catch (error) {
        console.error('❌ Error sending referral notification:', error.message);
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

            if (!user || !user.telegramId) return;

            if (deposit.status === 'approved' || deposit.status === 'rejected') {
                await sendDepositNotification(
                    user.telegramId,
                    user.name,
                    deposit.amount,
                    deposit.status,
                    deposit.adminReason
                );
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

            if (!user || !user.telegramId) return;

            if (withdrawal.status === 'approved' || withdrawal.status === 'rejected') {
                await sendWithdrawalNotification(
                    user.telegramId,
                    user.name,
                    withdrawal.amount,
                    withdrawal.status,
                    withdrawal.adminReason
                );
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

        // Notify admin about new ticket
        for (const adminId of ADMIN_IDS) {
            try {
                const message = `🎫 *New Support Ticket*\n\n` +
                    `From: *${escapeMarkdown(ticket.userName || 'Unknown')}*\n` +
                    `Phone: *${escapeMarkdown(ticket.userPhone || 'N/A')}*\n` +
                    `Type: *${escapeMarkdown((ticket.type || 'OTHER').toUpperCase())}*\n` +
                    `Subject: *${escapeMarkdown(ticket.subject)}*\n\n` +
                    `Message:\n${escapeMarkdown(ticket.message)}\n\n` +
                    `Reply to close this ticket\n\n` +
                    `☀️ *Solor Energy Admin*`;

                await bot.sendMessage(adminId, message, { parse_mode: 'MarkdownV2' });
            } catch (error) {
                console.error('❌ Error notifying admin:', error.message);
            }
        }

        // Notify user that ticket is created
        try {
            const userRef = ref(database, `users/${ticket.userId}`);
            const userSnap = await get(userRef);
            const user = userSnap.val();

            if (user && user.telegramId) {
                await sendTicketNotification(
                    user.telegramId,
                    user.name,
                    ticket.subject,
                    'created'
                );
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
                await sendTicketNotification(
                    user.telegramId,
                    user.name,
                    ticket.subject,
                    'replied',
                    ticket.reply
                );
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

                await sendReferralNotification(
                    referrer.telegramId,
                    referrer.name,
                    user.name,
                    referAmount
                );
            }
        } catch (error) {
            console.error('❌ Referral listener error:', error.message);
        }
    });
}

// ==================== ADMIN BROADCAST FUNCTIONS ====================

async function broadcastMessage(text) {
    try {
        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};

        let sent = 0;
        let failed = 0;

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

        let sent = 0;
        let failed = 0;

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
                    console.error(`❌ Failed to send photo to ${userId}:`, error.message);
                }
            }
        }

        return { sent, failed, total: Object.keys(users).length };
    } catch (error) {
        console.error('❌ Photo broadcast error:', error.message);
        return { sent: 0, failed: 0, total: 0 };
    }
}

// ==================== BOT COMMAND HANDLERS ====================

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const username = msg.from.first_name || 'User';

    if (isAdmin(chatId)) {
        const adminMenu = `👑 *Welcome Admin\!*\n\n` +
            `☀️ *Solor Energy Bot Control Panel*\n\n` +
            `📢 *Broadcast Commands:*\n` +
            `• /broadcast \- Send text to all users\n` +
            `• /broadcastpic \- Send photo with caption\n` +
            `• /stats \- View bot statistics\n\n` +
            `👤 *User Management:*\n` +
            `• /users \- List all users with Telegram\n` +
            `• /notifyuser \- Send message to specific user\n\n` +
            `🔔 *Notifications are automatic for:*\n` +
            `• Deposits (pending/approved/rejected)\n` +
            `• Withdrawals (pending/approved/rejected)\n` +
            `• Support tickets (created/replied)\n` +
            `• Referral bonuses\n\n` +
            `☀️ *Solor Energy Admin Bot*`;

        await bot.sendMessage(chatId, adminMenu, {
            parse_mode: 'MarkdownV2',
            reply_markup: {
                keyboard: [
                    ['📢 Broadcast Message', '📸 Broadcast Photo'],
                    ['📊 Statistics', '👥 User List'],
                    ['🔔 Test Notification']
                ],
                resize_keyboard: true
            }
        });
    } else {
        const welcomeMessage = `☀️ *Welcome to Solor Energy Bot\!*\n\n` +
            `Hi ${escapeMarkdown(username)}\!\n\n` +
            `🔗 *Link your account to receive notifications:*\n` +
            `1\. Login to your Solor Energy app\n` +
            `2\. Go to Profile page\n` +
            `3\. Enter this code: *${chatId}*\n\n` +
            `📱 Once linked, you will get instant notifications for:\n` +
            `✅ Deposit updates\n` +
            `💰 Withdrawal status\n` +
            `🎫 Support ticket replies\n` +
            `🎁 Daily claim reminders\n\n` +
            `☀️ *Solor Energy*`;

        await bot.sendMessage(chatId, welcomeMessage, { parse_mode: 'MarkdownV2' });
    }
});

bot.onText(/\/broadcast/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    adminStates[chatId] = { action: 'broadcast_text' };
    await bot.sendMessage(chatId, '📢 *Broadcast Mode*\n\nPlease type the message you want to send to ALL users\n\nUse *bold* , _italic_ , or `code` formatting\n\nType /cancel to exit', { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/broadcastpic/, async (msg) => {
    const chatId = msg.chat.id;
    if (!isAdmin(chatId)) return;

    adminStates[chatId] = { action: 'broadcast_photo', step: 'waiting_photo' };
    await bot.sendMessage(chatId, '📸 *Broadcast Photo Mode*\n\nPlease send the photo you want to broadcast\n\nType /cancel to exit', { parse_mode: 'MarkdownV2' });
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
        const blockedUsers = Object.values(users).filter(u => u.status === 'blocked').length;

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

        const statsMessage = `📊 *Bot Statistics*\n\n` +
            `👥 *Users:*\n` +
            `• Total: *${totalUsers}*\n` +
            `• With Telegram: *${telegramUsers}*\n` +
            `• Active: *${activeUsers}*\n` +
            `• Blocked: *${blockedUsers}*\n\n` +
            `💰 *Transactions:*\n` +
            `• Pending Deposits: *${pendingDeps}*\n` +
            `• Pending Withdrawals: *${pendingWiths}*\n\n` +
            `🎫 *Support:*\n` +
            `• Open Tickets: *${openTickets}*\n\n` +
            `☀️ *Solor Energy Bot*`;

        await bot.sendMessage(chatId, statsMessage, { parse_mode: 'MarkdownV2' });
    } catch (error) {
        await bot.sendMessage(chatId, `❌ Error fetching stats: ${escapeMarkdown(error.message)}`, { parse_mode: 'MarkdownV2' });
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
            await bot.sendMessage(chatId, '❌ No users have linked Telegram yet', { parse_mode: 'MarkdownV2' });
            return;
        }

        let message = `👥 *Users with Telegram (${telegramUsers.length})*\n\n`;

        for (const user of telegramUsers.slice(0, 20)) {
            message += `• *${escapeMarkdown(user.name || 'Unknown')}* (${escapeMarkdown(user.phone || 'N/A')})\n` +
                `  ID: \`${user.telegramId}\`\n` +
                `  Balance: *${formatCurrency(user.wallet?.mainBalance || 0)}*\n\n`;
        }

        if (telegramUsers.length > 20) {
            message += `... and *${telegramUsers.length - 20}* more users\n`;
        }

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
    await bot.sendMessage(chatId, '👤 *Notify User*\n\nPlease enter the user\'s Telegram ID or Phone Number\n\nType /cancel to exit', { parse_mode: 'MarkdownV2' });
});

bot.onText(/\/cancel/, async (msg) => {
    const chatId = msg.chat.id;
    delete adminStates[chatId];
    await bot.sendMessage(chatId, '✅ Cancelled', { parse_mode: 'MarkdownV2' });
});

// Handle admin keyboard buttons
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!isAdmin(chatId)) return;
    if (!text) return;

    if (text === '📢 Broadcast Message') {
        adminStates[chatId] = { action: 'broadcast_text' };
        await bot.sendMessage(chatId, '📢 *Broadcast Mode*\n\nPlease type the message you want to send to ALL users\n\nUse *bold* , _italic_ , or `code` formatting\n\nType /cancel to exit', { parse_mode: 'MarkdownV2' });
        return;
    }

    if (text === '📸 Broadcast Photo') {
        adminStates[chatId] = { action: 'broadcast_photo', step: 'waiting_photo' };
        await bot.sendMessage(chatId, '📸 *Broadcast Photo Mode*\n\nPlease send the photo you want to broadcast\n\nType /cancel to exit', { parse_mode: 'MarkdownV2' });
        return;
    }

    if (text === '📊 Statistics') {
        bot.emit('text', { ...msg, text: '/stats' });
        return;
    }

    if (text === '👥 User List') {
        bot.emit('text', { ...msg, text: '/users' });
        return;
    }

    if (text === '🔔 Test Notification') {
        await bot.sendMessage(chatId, '🔔 *Test Notification*\n\nThis is how your notifications will look\n\n*Bold Text* - _Italic Text_ - `Code`\n\n☀️ *Solor Energy*', { parse_mode: 'MarkdownV2' });
        return;
    }
});

// Handle text messages (for admin states)
bot.on('text', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (!adminStates[chatId]) return;
    if (text.startsWith('/')) return;

    const state = adminStates[chatId];

    if (state.action === 'broadcast_text') {
        await bot.sendMessage(chatId, '⏳ Broadcasting message to all users...');

        const result = await broadcastMessage(text);

        await bot.sendMessage(chatId, 
            `✅ *Broadcast Complete*\n\n` +
            `📤 Sent: *${result.sent}*\n` +
            `❌ Failed: *${result.failed}*\n` +
            `👥 Total Users: *${result.total}*\n\n` +
            `☀️ *Solor Energy*`,
            { parse_mode: 'MarkdownV2' }
        );

        delete adminStates[chatId];
        return;
    }

    if (state.action === 'notify_user' && state.step === 'waiting_id') {
        state.target = text.trim();
        state.step = 'waiting_message';
        await bot.sendMessage(chatId, '✅ User ID saved\n\nNow type the message you want to send\n\nType /cancel to exit', { parse_mode: 'MarkdownV2' });
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
                await bot.sendMessage(chatId, '❌ User not found or no Telegram linked', { parse_mode: 'MarkdownV2' });
                delete adminStates[chatId];
                return;
            }

            await bot.sendMessage(telegramId, text, { parse_mode: 'MarkdownV2' });
            await bot.sendMessage(chatId, `✅ Message sent to *${escapeMarkdown(target)}*`, { parse_mode: 'MarkdownV2' });
        } catch (error) {
            await bot.sendMessage(chatId, `❌ Error: ${escapeMarkdown(error.message)}`, { parse_mode: 'MarkdownV2' });
        }

        delete adminStates[chatId];
        return;
    }

    if (state.action === 'broadcast_photo' && state.step === 'waiting_caption') {
        state.caption = text;
        state.step = 'ready_to_send';

        await bot.sendMessage(chatId, 
            `📸 *Ready to Broadcast*\n\n` +
            `Preview your message:\n\n` +
            `${escapeMarkdown(text)}\n\n` +
            `Send /confirm to broadcast or /cancel to exit`,
            { parse_mode: 'MarkdownV2' }
        );
        return;
    }
});

// Handle photos (for broadcast)
bot.on('photo', async (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) return;
    if (!adminStates[chatId] || adminStates[chatId].action !== 'broadcast_photo') return;

    const state = adminStates[chatId];

    if (state.step === 'waiting_photo') {
        const photos = msg.photo;
        const largestPhoto = photos[photos.length - 1];
        state.photoFileId = largestPhoto.file_id;
        state.step = 'waiting_caption';

        await bot.sendMessage(chatId, 
            '📸 Photo received\!\n\n' +
            'Now type the caption for this photo\n' +
            'Use *bold* , _italic_ formatting\n\n' +
            'Type /skip for no caption\n' +
            'Type /cancel to exit',
            { parse_mode: 'MarkdownV2' }
        );
        return;
    }
});

// Handle /confirm for photo broadcast
bot.onText(/\/confirm/, async (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) return;
    if (!adminStates[chatId]) return;

    const state = adminStates[chatId];

    if (state.action === 'broadcast_photo' && state.step === 'ready_to_send') {
        await bot.sendMessage(chatId, '⏳ Broadcasting photo to all users...');

        const result = await broadcastPhoto(state.photoFileId, state.caption || '');

        await bot.sendMessage(chatId, 
            `✅ *Photo Broadcast Complete*\n\n` +
            `📤 Sent: *${result.sent}*\n` +
            `❌ Failed: *${result.failed}*\n` +
            `👥 Total Users: *${result.total}*\n\n` +
            `☀️ *Solor Energy*`,
            { parse_mode: 'MarkdownV2' }
        );

        delete adminStates[chatId];
    }
});

// Handle /skip for no caption
bot.onText(/\/skip/, async (msg) => {
    const chatId = msg.chat.id;

    if (!isAdmin(chatId)) return;
    if (!adminStates[chatId]) return;

    const state = adminStates[chatId];

    if (state.action === 'broadcast_photo' && state.step === 'waiting_caption') {
        state.caption = '';
        state.step = 'ready_to_send';

        await bot.sendMessage(chatId, 
            `📸 *Ready to Broadcast*\n\n` +
            `Photo with no caption\n\n` +
            `Send /confirm to broadcast or /cancel to exit`,
            { parse_mode: 'MarkdownV2' }
        );
    }
});

// ==================== CRON JOB FOR DAILY CLAIM REMINDERS ====================

async function sendDailyReminders() {
    try {
        const now = new Date();
        const currentHour = now.getHours();

        if (currentHour !== 9) return;

        const usersRef = ref(database, 'users');
        const usersSnap = await get(usersRef);
        const users = usersSnap.val() || {};

        for (const [userId, user] of Object.entries(users)) {
            if (!user.telegramId) continue;
            if (user.status === 'blocked') continue;

            const activePlans = user.activePlans || {};
            const plans = Object.values(activePlans);

            if (plans.length === 0) continue;

            const lastClaimDate = user.lastClaimDate;
            const today = now.toDateString();

            if (lastClaimDate === today) continue;

            const totalDaily = plans.reduce((sum, p) => sum + (p.dailyReturn || 0), 0);

            await sendDailyClaimReminder(user.telegramId, user.name, totalDaily);
        }

        console.log('✅ Daily reminders sent successfully');
    } catch (error) {
        console.error('❌ Error sending daily reminders:', error);
    }
}

setInterval(sendDailyReminders, 3600000);

// ==================== INITIALIZATION ====================
console.log('🤖 Solor Energy Telegram Bot Started!');
console.log('👑 Admin IDs:', ADMIN_IDS);
console.log('📱 Phone:', ADMIN_PHONE);

setupDepositListeners();
setupWithdrawalListeners();
setupTicketListeners();
setupReferralListeners();

console.log('✅ All Firebase listeners active');
console.log('✅ Bot is ready to send notifications');

// Handle bot errors gracefully
bot.on('error', (error) => {
    console.error('⚠️ Bot error:', error.message);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('\n🛑 SIGTERM received. Shutting down gracefully...');
    server.close(() => {
        console.log('✅ Express server closed');
        if (bot.stopPolling) bot.stopPolling();
        process.exit(0);
    });

    // Force exit after 25 seconds
    setTimeout(() => {
        console.log('⚠️ Forced exit after timeout');
        process.exit(1);
    }, 25000);
});

process.on('SIGINT', () => {
    console.log('\n🛑 SIGINT received. Shutting down...');
    server.close(() => {
        if (bot.stopPolling) bot.stopPolling();
        process.exit(0);
    });
});