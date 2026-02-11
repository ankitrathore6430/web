const puppeteer = require('puppeteer');

// GitHub Actions se inputs lena (ya default values use karna)
const BOT_ENABLED = process.env.BOT_ENABLED === 'true';      
const TARGET_URL = process.env.TARGET_URL || 'https://google.com'; 
const TAB_COUNT = parseInt(process.env.TAB_COUNT) || 1;

async function run() {
    if (!BOT_ENABLED) {
        console.log("Bot abhi OFF hai. GitHub Actions se ON karein.");
        return;
    }

    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    console.log(`Target: ${TARGET_URL}`);
    console.log(`${TAB_COUNT} tabs khule rahenge jab tak workflow cancel nahi hota.`);
    
    const tasks = [];

    for (let i = 0; i < TAB_COUNT; i++) {
        tasks.push((async () => {
            const page = await browser.newPage();
            try {
                await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 0 });
                console.log(`[Tab ${i + 1}] Active.`);
                // Infinite wait
                await new Promise(() => {}); 
            } catch (e) {
                console.log(`[Tab ${i + 1}] Error: ${e.message}`);
            }
        })());
    }

    await Promise.all(tasks);
}

run();
