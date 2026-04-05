#!/usr/bin/env python3
"""
SOLOR ENERGY - WhatsApp OTP Server (Direct QR Scan)
Session Saved Automatically! Render Docker Ready.
Contains /ping route for UptimeRobot.
"""

from flask import Flask, request, jsonify, render_template_string, send_file
from flask_cors import CORS
import threading
import time
import os
import urllib.parse
import io

app = Flask(__name__)
CORS(app)

# Global storage
OTP_STORE = {}
MESSAGE_QUEUE =[]
WHATSAPP_STATUS = {"connected": False, "status_msg": "Initializing Server..."}
DRIVER = None

# ============== HTML TEMPLATE ==============
HTML_PAGE = """
<!DOCTYPE html>
<html lang="hi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Solor Energy - WhatsApp Admin</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        :root { --primary: #6366f1; --success: #10b981; --danger: #ef4444; --warning: #f59e0b; --dark: #0f172a; --gray: #64748b; --light: #f1f5f9; }
        body { background: var(--light); min-height: 100vh; padding: 20px; }
        .container { max-width: 800px; margin: 0 auto; }
        .card { background: white; border-radius: 24px; padding: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.1); margin-bottom: 20px; }
        h2 { color: var(--dark); margin-bottom: 10px; font-size: 24px; }
        p { color: var(--gray); font-size: 14px; margin-bottom: 20px; }
        .hidden { display: none !important; }
        .status-badge { padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-connected { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-disconnected { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .info-box { background: rgba(99, 102, 241, 0.1); border-left: 4px solid var(--primary); padding: 15px; border-radius: 0 12px 12px 0; margin-bottom: 20px; font-size: 13px; }
        .qr-container { border: 4px solid var(--dark); border-radius: 16px; overflow: hidden; background: #000; display: flex; justify-content: center; align-items: center; min-height: 300px; position: relative;}
        .qr-img { width: 100%; max-height: 450px; object-fit: cover; object-position: center; }
        .btn-main { width: 100%; padding: 18px; border-radius: 16px; border: none; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s; color: white; display:flex; justify-content:center; gap:10px; align-items:center;}
        .btn-debug { background: var(--dark); margin-top: 10px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="margin: 0;"><i class="fab fa-whatsapp" style="color: #25D366;"></i> Admin WhatsApp</h2>
                <p style="margin: 0; font-size: 12px;" id="statusText">Initializing Server...</p>
            </div>
            <span id="statusBadge" class="status-badge status-disconnected">Checking...</span>
        </div>

        <div class="card" id="loginSection">
            <h3><i class="fas fa-qrcode"></i> Scan QR to Login</h3>
            <div class="info-box">
                <i class="fas fa-info-circle"></i> Open WhatsApp on your phone -> Tap Menu/Settings -> Linked Devices -> Link a Device -> Scan this screen.
            </div>
            
            <div class="qr-container">
                <img id="liveScreen" class="qr-img" src="/debug" alt="Loading QR Code...">
            </div>
            <p style="text-align:center; font-size:12px; color:var(--gray); margin-top:15px;">
                <i class="fas fa-sync fa-spin"></i> Screen auto-refreshes every 3 seconds
            </p>
        </div>

        <div class="card hidden" id="connectedSection" style="text-align:center;">
            <div style="font-size: 60px; color: var(--success); margin-bottom: 20px;"><i class="fas fa-check-circle"></i></div>
            <h3>WhatsApp is Connected!</h3>
            <p>Session is saved. OTPs will be sent automatically.</p>
            <div class="info-box" style="text-align:left;">
                <strong>API Endpoint:</strong> POST <code>/send-otp</code><br>
                <strong>Body:</strong> <code>{"phone": "USER_NUMBER"}</code>
            </div>
            <a href="/debug" target="_blank" style="text-decoration: none;">
                <button class="btn-main btn-debug"><i class="fas fa-camera"></i> View Live Cloud Screen</button>
            </a>
        </div>
    </div>

    <script>
        const API = window.location.origin;
        let isConnected = false;

        async function checkStatus() {
            try {
                const res = await fetch(API + '/status');
                const data = await res.json();
                
                const badge = document.getElementById('statusBadge');
                const sText = document.getElementById('statusText');
                
                sText.textContent = data.status_msg;
                isConnected = data.connected;

                if (data.connected) {
                    badge.textContent = 'Connected';
                    badge.className = 'status-badge status-connected';
                    document.getElementById('loginSection').classList.add('hidden');
                    document.getElementById('connectedSection').classList.remove('hidden');
                } else {
                    badge.textContent = 'Disconnected';
                    badge.className = 'status-badge status-disconnected';
                    document.getElementById('loginSection').classList.remove('hidden');
                    document.getElementById('connectedSection').classList.add('hidden');
                }
            } catch (e) {
                console.error(e);
            }
        }

        // Auto-refresh the screenshot every 3 seconds if not connected
        setInterval(() => {
            if (!isConnected) {
                document.getElementById('liveScreen').src = API + '/debug?t=' + new Date().getTime();
            }
        }, 3000);

        setInterval(checkStatus, 3000);
        checkStatus();
    </script>
</body>
</html>
"""

# ============== WHATSAPP SELENIUM AUTOMATION ==============

def init_whatsapp():
    """Start Chrome and load WhatsApp Web with Session Saving"""
    global DRIVER, WHATSAPP_STATUS
    
    try:
        WHATSAPP_STATUS["status_msg"] = "Step 1: Starting Virtual Display..."
        print("Starting Virtual Display...")
        from pyvirtualdisplay import Display
        display = Display(visible=0, size=(1920, 1080))
        display.start()

        WHATSAPP_STATUS["status_msg"] = "Step 2: Importing Selenium..."
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        
        WHATSAPP_STATUS["status_msg"] = "Step 3: Configuring Chromium..."
        chrome_options = Options()
        
        # Pointing to the Native Linux Chromium installed via Docker
        chrome_options.binary_location = '/usr/bin/chromium'
        
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage') 
        chrome_options.add_argument('--headless=new')
        chrome_options.add_argument('--disable-gpu')
        chrome_options.add_argument('--window-size=1920,1080')
        
        user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        chrome_options.add_argument(f'user-agent={user_agent}')
        chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
        chrome_options.add_experimental_option('useAutomationExtension', False)

        user_data_dir = os.path.join(os.getcwd(), 'whatsapp_session_data')
        chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
        
        WHATSAPP_STATUS["status_msg"] = "Step 4: Launching Browser Engine..."
        print("Starting WebDriver...")
        service = Service('/usr/bin/chromedriver')
        DRIVER = webdriver.Chrome(service=service, options=chrome_options)
        
        WHATSAPP_STATUS["status_msg"] = "Step 5: Loading WhatsApp Web..."
        DRIVER.get('https://web.whatsapp.com')
        
        # Loop to constantly check if chat list appeared (meaning user scanned QR successfully)
        while True:
            try:
                WebDriverWait(DRIVER, 10).until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="chat-list"]')))
                WHATSAPP_STATUS["connected"] = True
                WHATSAPP_STATUS["status_msg"] = "Ready & Connected!"
                print("✅ Logged In & Ready!")
                break
            except:
                WHATSAPP_STATUS["connected"] = False
                WHATSAPP_STATUS["status_msg"] = "Please Scan the QR Code..."
                pass
            
    except Exception as e:
        error_msg = str(e)
        print(f"❌ CRITICAL ERROR: {error_msg}")
        WHATSAPP_STATUS["status_msg"] = f"Error: {error_msg}"
        DRIVER = None

def process_message_queue():
    """Background loop to send OTP messages one by one"""
    global DRIVER, WHATSAPP_STATUS
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC

    while True:
        if WHATSAPP_STATUS["connected"] and DRIVER and len(MESSAGE_QUEUE) > 0:
            msg_task = MESSAGE_QUEUE.pop(0)
            phone = msg_task['phone']
            text = msg_task['message']
            
            try:
                url = f"https://web.whatsapp.com/send?phone=91{phone}&text={urllib.parse.quote(text)}"
                DRIVER.get(url)
                
                send_btn = WebDriverWait(DRIVER, 30).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="send"]'))
                )
                send_btn.click()
                time.sleep(3) 
                print(f"✅ OTP Sent to {phone}")
                
            except Exception as e:
                print(f"❌ Failed to send OTP to {phone}: {e}")
                
        time.sleep(2) 

# ============== START BACKGROUND THREADS ==============
threading.Thread(target=init_whatsapp, daemon=True).start()
threading.Thread(target=process_message_queue, daemon=True).start()

# ============== FLASK ROUTES ==============

@app.route('/')
def index():
    return render_template_string(HTML_PAGE)

# --- UPTIMEROBOT PING ROUTE ---
@app.route('/ping')
def ping():
    """Lightweight route for UptimeRobot to keep the server awake 24/7"""
    return "OK", 200

@app.route('/status')
def status():
    return jsonify(WHATSAPP_STATUS)

@app.route('/debug')
def debug_screen():
    """Shows the actual live screenshot of the cloud browser"""
    global DRIVER
    if DRIVER:
        try:
            screenshot = DRIVER.get_screenshot_as_png()
            return send_file(io.BytesIO(screenshot), mimetype='image/png')
        except Exception as e:
            return f"Error taking screenshot: {e}"
    # Transparent 1x1 pixel if driver not ready
    return send_file(io.BytesIO(b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'), mimetype='image/png')

@app.route('/send-otp', methods=['POST'])
def send_otp():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    
    if not phone or len(phone) != 10:
        return jsonify({"success": False, "error": "Invalid phone number"}), 400
    
    if not WHATSAPP_STATUS["connected"]:
        return jsonify({"success": False, "error": "Admin WhatsApp is Offline."}), 503
    
    otp = phone[-6:]
    OTP_STORE[phone] = {"otp": otp, "expires_at": time.time() + 300}
    
    message = f"""🔐 *Solor Energy Verification*

Your OTP is: *{otp}*
📱 Number: +91 {phone}

⚠️ Please do not share this OTP with anyone. Team Solor Energy never asks for your OTP.

_Valid for 5 minutes_"""
    
    MESSAGE_QUEUE.append({"phone": phone, "message": message})
    return jsonify({"success": True, "message": "OTP queued for sending"})

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    data = request.get_json()
    phone = data.get('phone', '').strip()
    otp = data.get('otp', '').strip()
    
    if phone not in OTP_STORE:
        return jsonify({"success": False, "error": "OTP not found or expired"}), 404
        
    record = OTP_STORE[phone]
    
    if time.time() > record["expires_at"]:
        del OTP_STORE[phone]
        return jsonify({"success": False, "error": "OTP expired"}), 400
        
    if record["otp"] == otp:
        del OTP_STORE[phone]
        return jsonify({"success": True, "message": "Verified"})
    else:
        return jsonify({"success": False, "error": "Invalid OTP"}), 400

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)