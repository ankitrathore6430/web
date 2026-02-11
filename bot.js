const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');

puppeteer.use(StealthPlugin());

async function run() {
    // Purane Features: Inputs from Environment
    const BOT_ENABLED = process.env.BOT_ENABLED === 'true';
    const TARGET_URL = process.env.TARGET_URL;
    const TAB_COUNT = parseInt(process.env.TAB_COUNT) || 1;

    if (!BOT_ENABLED) {
        console.log("Bot OFF hai. GitHub se ON karein.");
        return;
    }

    if (!fs.existsSync('./screenshots')) fs.mkdirSync('./screenshots');

    const browser = await puppeteer.launch({
        headless: "new",
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--window-size=1920,1080'
        ]
    });

    console.log(`🚀 Bot Started! Link: ${TARGET_URL} | Tabs: ${TAB_COUNT}`);

    for (let i = 0; i < TAB_COUNT; i++) {
        (async () => {
            const page = await browser.newPage();
            await page.setViewport({ width: 1366, height: 768 });
            
            // Real User Identity
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');

            try {
                await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 0 });
                console.log(`✅ [Tab ${i+1}] Page Fully Loaded.`);

                // Naya Feature: Infinite Auto-Scroll
                const scrollTask = async () => {
                    await page.evaluate(async () => {
                        await new Promise((resolve) => {
                            let totalHeight = 0;
                            let distance = 150;
                            let timer = setInterval(() => {
                                let scrollHeight = document.body.scrollHeight;
                                window.scrollBy(0, distance);
                                totalHeight += distance;
                                if (totalHeight >= scrollHeight) {
                                    window.scrollTo(0, 0);
                                    totalHeight = 0;
                                }
                            }, 800);
                        });
                    });
                };

                // Naya Feature: Random Clicks (Ads trigger karne ke liye)
                const clickTask = async () => {
                    while (true) {
                        try {
                            const x = Math.floor(Math.random() * 500) + 100;
                            const y = Math.floor(Math.random() * 400) + 100;
                            await page.mouse.click(x, y);
                            console.log(`🖱️ [Tab ${i+1}] Clicked at ${x},${y}`);
                        } catch (e) {}
                        await new Promise(r => setTimeout(r, 20000)); // Har 20 sec mein click
                    }
                };

                // Saare tasks background mein chalenge
                scrollTask().catch(() => {});
                clickTask().catch(() => {});

                // Screenshot Loop (Har 1 minute mein "Live" update)
                while (true) {
                    await new Promise(r => setTimeout(r, 60000)); 
                    await page.screenshot({ path: `./screenshots/tab${i + 1}.png` });
                    console.log(`📸 [Tab ${i + 1}] Screenshot Updated.`);
                }
            } catch (e) {
                console.log(`❌ Error [Tab ${i+1}]: ${e.message}`);
            }
        })();
    }
}

run().catch(err => console.log("Fatal Error:", err));
