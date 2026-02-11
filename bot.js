const puppeteer = require('puppeteer');

async function run() {
    const browser = await puppeteer.launch({
        headless: "new",
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 }); // Standard size
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');

    try {
        console.log(`Opening URL: ${process.env.TARGET_URL}`);
        await page.goto(process.env.TARGET_URL, { 
            waitUntil: 'networkidle2', 
            timeout: 60000 
        });

        // Redirect hone ke liye thoda extra wait
        console.log("Waiting for redirect and loading...");
        await new Promise(r => setTimeout(r, 10000)); 

        // Screenshot lena
        await page.screenshot({ path: 'web_view.png', fullPage: true });
        console.log("Screenshot saved as web_view.png");

        // Tabs ko khula rakhne ke liye (agar tumne cancel nahi kiya)
        await new Promise(() => {}); 

    } catch (e) {
        console.log("Error:", e.message);
        // Error hone par bhi screenshot lelo taaki pata chale kya dikh raha hai
        await page.screenshot({ path: 'error_view.png' });
    } finally {
        await browser.close();
    }
}

run();
