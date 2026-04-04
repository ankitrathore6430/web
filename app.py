#!/usr/bin/env python3
"""
SOLOR ENERGY - WhatsApp OTP Server (Link via Phone Number)
Session Saved Automatically!
"""

from flask import Flask, request, jsonify, render_template_string
from flask_cors import CORS
import threading
import time
import json
import os
import urllib.parse
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Global storage
OTP_STORE = {}
MESSAGE_QUEUE = []
WHATSAPP_STATUS = {"connected": False, "pairing_code": None, "status_msg": "Initializing..."}
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
        .form-group { margin-bottom: 20px; }
        label { display: block; margin-bottom: 8px; font-weight: 600; color: var(--dark); font-size: 14px; }
        .input-premium { width: 100%; padding: 16px 20px; border: 2px solid #e2e8f0; border-radius: 16px; font-size: 16px; transition: all 0.3s; }
        .input-premium:focus { outline: none; border-color: var(--primary); }
        .btn-main { width: 100%; padding: 18px; border-radius: 16px; border: none; font-size: 16px; font-weight: 700; cursor: pointer; transition: all 0.3s; color: white; display:flex; justify-content:center; gap:10px; align-items:center;}
        .btn-whatsapp { background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); }
        .hidden { display: none !important; }
        .status-badge { padding: 8px 16px; border-radius: 20px; font-size: 12px; font-weight: 600; }
        .status-connected { background: rgba(16, 185, 129, 0.1); color: var(--success); }
        .status-disconnected { background: rgba(239, 68, 68, 0.1); color: var(--danger); }
        .pairing-code-box { background: var(--dark); color: #00ff00; font-size: 32px; letter-spacing: 5px; text-align: center; padding: 20px; border-radius: 16px; font-weight: 800; margin: 20px 0;}
        .info-box { background: rgba(99, 102, 241, 0.1); border-left: 4px solid var(--primary); padding: 15px; border-radius: 0 12px 12px 0; margin-bottom: 20px; font-size: 13px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="card" style="display: flex; justify-content: space-between; align-items: center;">
            <div>
                <h2 style="margin: 0;"><i class="fab fa-whatsapp" style="color: #25D366;"></i> Admin WhatsApp</h2>
                <p style="margin: 0; font-size: 12px;" id="statusText">Initializing Server...</p>
            </div>
            <span id="statusBadge" class="status-badge status-disconnected">Checking...</span>
        </div>

        <!-- Login Section -->
        <div class="card" id="loginSection">
            <h3><i class="fas fa-link"></i> Link WhatsApp Number</h3>
            <div class="info-box">
                <i class="fas fa-info-circle"></i> Enter your WhatsApp number. We will generate an 8-digit code. Put that code in your phone to link.
            </div>
            
            <div id="numberInputArea">
                <div class="form-group">
                    <label>Your WhatsApp Number (Without +91)</label>
                    <input type="tel" class="input-premium" id="adminPhone" placeholder="Enter your 10 digit number" maxlength="10">
                </div>
                <button class="btn-main btn-whatsapp" onclick="requestPairingCode()" id="reqBtn">Get Pairing Code</button>
            </div>

            <div id="codeDisplayArea" class="hidden">
                <p style="text-align:center; font-weight:600;">Go to WhatsApp -> Linked Devices -> Link with Phone Number</p>
                <div class="pairing-code-box" id="pairingCodeDisplay">--------</div>
                <p style="text-align:center; color:var(--danger); font-size:12px;">Waiting for you to enter code in your phone...</p>
            </div>
        </div>

        <!-- Connected Section -->
        <div class="card hidden" id="connectedSection" style="text-align:center;">
            <div style="font-size: 60px; color: var(--success); margin-bottom: 20px;"><i class="fas fa-check-circle"></i></div>
            <h3>WhatsApp is Connected!</h3>
            <p>Session is saved. OTPs will be sent from this number automatically.</p>
            <div class="info-box" style="text-align:left;">
                <strong>API Endpoint:</strong> POST <code>/send-otp</code><br>
                <strong>Body:</strong> <code>{"phone": "USER_NUMBER"}</code>
            </div>
        </div>
    </div>

    <script>
        const API = window.location.origin;

        async function checkStatus() {
            try {
                const res = await fetch(API + '/status');
                const data = await res.json();
                
                const badge = document.getElementById('statusBadge');
                const sText = document.getElementById('statusText');
                
                sText.textContent = data.status_msg;

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
                    
                    if (data.pairing_code) {
                        document.getElementById('numberInputArea').classList.add('hidden');
                        document.getElementById('codeDisplayArea').classList.remove('hidden');
                        
                        // Format code (e.g., A1B2 C3D4)
                        let code = data.pairing_code;
                        if(code.length === 8) code = code.substring(0,4) + ' ' + code.substring(4,8);
                        document.getElementById('pairingCodeDisplay').textContent = code;
                    }
                }
            } catch (e) {
                console.error(e);
            }
        }

        async function requestPairingCode() {
            const phone = document.getElementById('adminPhone').value;
            if(phone.length !== 10) return alert('Enter valid 10 digit number');
            
            const btn = document.getElementById('reqBtn');
            btn.innerHTML = 'Generating Code... Please wait';
            btn.disabled = true;

            try {
                const res = await fetch(API + '/request-pairing', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ phone: phone })
                });
                const data = await res.json();
                if(!data.success) {
                    alert(data.error);
                    btn.innerHTML = 'Get Pairing Code';
                    btn.disabled = false;
                }
            } catch (e) {
                alert('Error: ' + e.message);
                btn.innerHTML = 'Get Pairing Code';
                btn.disabled = false;
            }
        }

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
        from selenium import webdriver
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.chrome.service import Service
        from webdriver_manager.chrome import ChromeDriverManager
        
        WHATSAPP_STATUS["status_msg"] = "Starting Chrome..."
        
        # Chrome Options
        chrome_options = Options()
        chrome_options.add_argument('--no-sandbox')
        chrome_options.add_argument('--disable-dev-shm-usage')
        chrome_options.add_argument('--headless') # Run in background
        chrome_options.add_argument('--disable-gpu')
        
        # SESSION SAVE TRICK: Store Chrome profile locally
        user_data_dir = os.path.join(os.getcwd(), 'whatsapp_session_data')
        chrome_options.add_argument(f'--user-data-dir={user_data_dir}')
        
        DRIVER = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=chrome_options)
        
        WHATSAPP_STATUS["status_msg"] = "Opening WhatsApp Web..."
        DRIVER.get('https://web.whatsapp.com')
        
        # Check if already logged in (by checking if chat list exists)
        try:
            WebDriverWait(DRIVER, 20).until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="chat-list"]')))
            WHATSAPP_STATUS["connected"] = True
            WHATSAPP_STATUS["status_msg"] = "Ready & Connected!"
            print("✅ Already Logged In! Session Loaded.")
        except:
            WHATSAPP_STATUS["connected"] = False
            WHATSAPP_STATUS["status_msg"] = "Waiting for Admin Login..."
            print("⏳ Need Login. Waiting for Pairing Request.")
            
    except Exception as e:
        print(f"❌ Browser Error: {e}")
        WHATSAPP_STATUS["status_msg"] = "Browser Error. Restart server."

def process_message_queue():
    """Background loop to send OTP messages one by one"""
    global DRIVER, WHATSAPP_STATUS
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.webdriver.common.keys import Keys

    while True:
        if WHATSAPP_STATUS["connected"] and DRIVER and len(MESSAGE_QUEUE) > 0:
            msg_task = MESSAGE_QUEUE.pop(0)
            phone = msg_task['phone']
            text = msg_task['message']
            
            try:
                # Open Direct Chat Link
                url = f"https://web.whatsapp.com/send?phone=91{phone}&text={urllib.parse.quote(text)}"
                DRIVER.get(url)
                
                # Wait for Send Button
                send_btn = WebDriverWait(DRIVER, 30).until(
                    EC.element_to_be_clickable((By.CSS_SELECTOR, '[data-testid="send"]'))
                )
                send_btn.click()
                time.sleep(3) # Wait for message to actually send
                print(f"✅ OTP Sent to {phone}")
                
            except Exception as e:
                print(f"❌ Failed to send OTP to {phone}: {e}")
                # Optional: Push back to queue if failed
                
        time.sleep(2) # Check queue every 2 seconds

# ============== FLASK ROUTES ==============

@app.route('/')
def index():
    return render_template_string(HTML_PAGE)

@app.route('/status')
def status():
    return jsonify(WHATSAPP_STATUS)

@app.route('/request-pairing', methods=['POST'])
def request_pairing():
    """Trigger WhatsApp Pairing Flow via Selenium"""
    global DRIVER, WHATSAPP_STATUS
    data = request.get_json()
    phone = data.get('phone', '').strip()
    
    if not phone or len(phone) != 10:
        return jsonify({"success": False, "error": "Invalid Phone"})
        
    if WHATSAPP_STATUS["connected"]:
        return jsonify({"success": False, "error": "Already connected"})

    try:
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        import time

        WHATSAPP_STATUS["status_msg"] = "Generating Code..."
        
        # 1. Click "Link with phone number"
        link_btn = WebDriverWait(DRIVER, 20).until(
            EC.element_to_be_clickable((By.XPATH, "//*[contains(text(), 'Link with phone number')]"))
        )
        link_btn.click()
        
        # 2. Enter Admin Phone Number
        phone_input = WebDriverWait(DRIVER, 10).until(
            EC.presence_of_element_located((By.XPATH, "//input[@type='text']"))
        )
        phone_input.send_keys(phone)
        
        # 3. Click Next
        next_btn = DRIVER.find_element(By.XPATH, "//*[contains(text(), 'Next')]")
        next_btn.click()
        
        # 4. Get the 8 Digit Code
        time.sleep(3) # Wait for code to generate
        code_container = WebDriverWait(DRIVER, 15).until(
            EC.presence_of_element_located((By.XPATH, "//*[@data-testid='linking-code-container']"))
        )
        
        pairing_code = code_container.text.replace('\n', '').replace(' ', '')
        WHATSAPP_STATUS["pairing_code"] = pairing_code
        WHATSAPP_STATUS["status_msg"] = "Waiting for phone confirmation..."
        
        # Background thread to check when user completes login on phone
        def wait_for_login():
            try:
                WebDriverWait(DRIVER, 120).until(EC.presence_of_element_located((By.CSS_SELECTOR, '[data-testid="chat-list"]')))
                WHATSAPP_STATUS["connected"] = True
                WHATSAPP_STATUS["pairing_code"] = None
                WHATSAPP_STATUS["status_msg"] = "Ready & Connected!"
            except:
                WHATSAPP_STATUS["pairing_code"] = None
                WHATSAPP_STATUS["status_msg"] = "Pairing Timeout. Refresh."
                DRIVER.get('https://web.whatsapp.com') # Reset
                
        threading.Thread(target=wait_for_login, daemon=True).start()

        return jsonify({"success": True, "message": "Code generated"})
        
    except Exception as e:
        print(f"Pairing error: {e}")
        return jsonify({"success": False, "error": "Failed to generate code. Refresh page and try again."})

@app.route('/send-otp', methods=['POST'])
def send_otp():
    """Website se API Call aayegi OTP bhejney ke liye"""
    data = request.get_json()
    phone = data.get('phone', '').strip()
    
    if not phone or len(phone) != 10:
        return jsonify({"success": False, "error": "Invalid phone number"}), 400
    
    if not WHATSAPP_STATUS["connected"]:
        return jsonify({"success": False, "error": "Admin WhatsApp is Offline."}), 503
    
    # Generate Last 6 digit OTP
    otp = phone[-6:]
    OTP_STORE[phone] = {"otp": otp, "expires_at": time.time() + 300}
    
    message = f"""🔐 *Solor Energy Verification*

Your OTP is: *{otp}*
📱 Number: +91 {phone}

⚠️ Please do not share this OTP with anyone. Team Solor Energy never asks for your OTP.

_Valid for 5 minutes_"""
    
    # Add to send queue
    MESSAGE_QUEUE.append({"phone": phone, "message": message})
    
    return jsonify({"success": True, "message": "OTP queued for sending"})

@app.route('/verify-otp', methods=['POST'])
def verify_otp():
    """Verify OTP endpoint"""
    data = request.get_json()
    phone = data.get('phone', '').strip()
    otp = data.get('otp', '').strip()
    
    if phone not in OTP_STORE:
        return jsonify({"success": False, "error": "OTP not found"}), 404
        
    record = OTP_STORE[phone]
    
    if time.time() > record["expires_at"]:
        del OTP_STORE[phone]
        return jsonify({"success": False, "error": "OTP expired"}), 400
        
    if record["otp"] == otp:
        del OTP_STORE[phone]
        return jsonify({"success": True, "message": "Verified"})
    else:
        return jsonify({"success": False, "error": "Invalid OTP"}), 400

# ============== STARTUP ==============

if __name__ == '__main__':
    # Start Chrome Browser Thread
    threading.Thread(target=init_whatsapp, daemon=True).start()
    # Start Background Message Sender Thread
    threading.Thread(target=process_message_queue, daemon=True).start()
    
    # Start Flask Server
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)