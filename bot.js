const puppeteer = require('puppeteer');
const fs = require('fs');

async function run() {
    const BOT_ENABLED = process.env.BOT_ENABLED === 'true';
    const TARGET_URL = process.env.TARGET_URL;
    const TAB_COUNT = parseInt(process.env.TAB_COUNT) || 1;

    if (!BOT_ENABLED) {
        console.log("Bot is currently OFF. Set bot_on to 'true' in GitHub Actions.");
        return;
    }

    // Ensure screenshot directory exists
    if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox', 
            '--disable-dev-shm-usage',
            '--disable-gpu'
        ]
    });

    console.log(`🚀 Bot Started! Target: ${TARGET_URL}`);
    console.log(`📑 Opening ${TAB_COUNT} tabs and staying active...`);

    const tasks = [];

    for (let i = 0; i < TAB_COUNT; i++) {
        tasks.push((async () => {
            const page = await browser.newPage();
            await page.setViewport({ width: 1280, height: 720 });
            
            // Masking as a real user
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

            try {
                // Timeout set to 0 to allow slow redirects (Bitly/Shorteners)
                await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 0 });
                console.log(`✅ [Tab ${i + 1}] Page Loaded.`);

                // Infinite loop to keep tab open and update screenshots every 60 seconds
                while (true) {
                    await page.screenshot({ path: `./screenshots/tab${i + 1}.png` });
                    console.log(`📸 [Tab ${i + 1}] Screenshot updated at ${new Date().toLocaleTimeString()}`);
                    await new Promise(r => setTimeout(r, 60000)); 
                }
            } catch (e) {
                console.log(`❌ [Tab ${i + 1}] Error: ${e.message}`);
                await page.screenshot({ path: `./screenshots/error_tab${i + 1}.png` });
            }
        })());
    }

    // This keeps the process alive
    await Promise.all(tasks);
}

run().catch(err => console.log("Fatal Error:", err));
