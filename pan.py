import os
import time
import json
import threading
from flask import Flask, render_template_string, request, jsonify, session
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

app = Flask(__name__)
app.secret_key = "ankit_secure_secret_key_here"  # Flask session management ke liye

# --- CONFIGURABLE PASSWORD ---
CORRECT_PASSWORD = "ankit123"  # 🔐 Aap yahan apna password badal sakte hain!

# --- GLOBAL VARIABLES FOR QUEUE & CACHE ---
driver = None
pan_cache = {}          
ticket_counter = 0      
queue_list = []         
results_db = {}         

def start_persistent_browser():
    global driver
    options = Options()
    options.add_argument('--headless=new')
    options.add_argument('--no-sandbox')
    options.add_argument('--disable-dev-shm-usage')
    options.add_argument('--disable-gpu')
    options.add_argument('--window-size=1920,1080')
    options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36')
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
    
    driver = webdriver.Chrome(options=options)
    
    try:
        driver.get("https://turtlemintloans.com/404")
        if os.path.exists("cookies.json"):
            with open("cookies.json", "r") as f:
                for cookie in json.load(f):
                    driver.add_cookie(cookie)
        
        if os.path.exists("storage.json"):
            with open("storage.json", "r") as f:
                storages = json.load(f)
                for key, value in storages.get("local", {}).items():
                    driver.execute_script("window.localStorage.setItem(arguments[0], arguments[1]);", key, value)
                for key, value in storages.get("session", {}).items():
                    driver.execute_script("window.sessionStorage.setItem(arguments[0], arguments[1]);", key, value)
    except Exception as e:
        print(f"Session load warning: {e}")

    driver.get("https://turtlemintloans.com/products/personal-loan/customer/MULTI/apply")
    time.sleep(3)
    print("🚀 Browser Ready! Starting Queue Worker...")

def background_queue_worker():
    global driver, queue_list, results_db, pan_cache
    
    while True:
        if len(queue_list) > 0:
            current_task = queue_list[0]
            t_id = current_task['ticket_id']
            pan_number = current_task['pan']
            
            results_db[t_id]['status'] = 'PROCESSING'

            try:
                wait = WebDriverWait(driver, 10)
                if "login" in driver.current_url:
                    results_db[t_id]['error'] = "Session expired! Naye cookies update karein."
                else:
                    pan_input = wait.until(EC.presence_of_element_located((
                        By.XPATH, "//input[contains(@name, 'pan') or contains(@class, 'pan') or contains(@id, 'pan')]"
                    )))

                    pan_input.send_keys(Keys.CONTROL + "a")
                    pan_input.send_keys(Keys.BACKSPACE)
                    time.sleep(0.2)
                    pan_input.send_keys(pan_number)
                    
                    driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true })); arguments[0].blur();", pan_input)

                    extracted_data = None
                    start_time = time.time()
                    
                    while time.time() - start_time < 6:
                        logs = driver.get_log("performance")
                        for entry in logs:
                            log = json.loads(entry["message"])["message"]
                            if log["method"] == "Network.responseReceived":
                                response = log["params"]["response"]
                                url = response["url"]
                                req_id = log["params"]["requestId"]
                                
                                if "existing-lead-by-pan" in url.lower() and pan_number.lower() in url.lower():
                                    try:
                                        body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': req_id})
                                        extracted_data = json.loads(body['body'])
                                        break
                                    except:
                                        pass
                        if extracted_data:
                            break
                        time.sleep(0.3)

                    if extracted_data:
                        results_db[t_id]['data'] = extracted_data
                        pan_cache[pan_number] = extracted_data
                    else:
                        results_db[t_id]['error'] = "Data fetch nahi ho paya ya PAN invalid hai."

            except Exception as e:
                results_db[t_id]['error'] = str(e)

            results_db[t_id]['status'] = 'DONE'
            queue_list.pop(0)
            
        else:
            time.sleep(1)


# --- PREMIUM HTML FRONTEND WITH LOCK SCREEN ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Enterprise PAN API - Secure</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <style>
        * { box-sizing: border-box; font-family: 'Poppins', sans-serif; }
        body { margin: 0; background: #f3f4f6; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
        
        .premium-container {
            background: #ffffff;
            width: 100%;
            max-width: 480px;
            padding: 40px 30px;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.08);
            text-align: center;
            border: 1px solid #eaebed;
        }

        .header h2 { margin: 0; font-size: 24px; color: #1e293b; font-weight: 700; letter-spacing: -0.5px; }
        .header p { color: #64748b; font-size: 14px; margin-top: 5px; margin-bottom: 30px; }

        .input-group { position: relative; margin-bottom: 20px; }
        .input-group input {
            width: 100%;
            padding: 16px 20px;
            font-size: 18px;
            border: 2px solid #e2e8f0;
            border-radius: 12px;
            font-weight: 600;
            color: #0f172a;
            text-align: center;
            transition: all 0.3s ease;
            outline: none;
        }
        .input-group input.pan-box { text-transform: uppercase; letter-spacing: 2px; }
        .input-group input:focus { border-color: #2563eb; box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.1); }
        .input-group input::placeholder { color: #94a3b8; font-weight: 400; letter-spacing: 1px; }

        button {
            width: 100%;
            padding: 16px;
            background: #2563eb;
            color: white;
            border: none;
            border-radius: 12px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            box-shadow: 0 4px 12px rgba(37, 99, 235, 0.2);
        }
        button:hover:not(:disabled) { background: #1d4ed8; transform: translateY(-2px); box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3); }
        button:disabled { background: #94a3b8; cursor: not-allowed; transform: none; box-shadow: none; }

        /* Lock Screen Container */
        #lockScreen { display: block; }
        #appScreen { display: none; }
        
        .error-msg { color: #ef4444; font-size: 13px; font-weight: 500; margin-top: -10px; margin-bottom: 15px; display: none; }

        /* Status Banner */
        .status-banner { margin-top: 25px; padding: 15px; border-radius: 10px; font-size: 14px; font-weight: 500; display: none; transition: all 0.3s; }
        .status-waiting { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
        .status-processing { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }

        /* Result Card */
        .result-card {
            margin-top: 25px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px;
            padding: 20px; text-align: left; display: none; position: relative;
            box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
            animation: fadeIn 0.4s ease;
        }
        
        .badge-valid { display: inline-block; background: #10b981; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
        .badge-invalid { display: inline-block; background: #ef4444; color: white; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; margin-bottom: 15px; }
        .cache-badge { position: absolute; top: 15px; right: 15px; background: #fef08a; color: #854d0e; font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 6px; display: flex; align-items: center; gap: 4px;}
        
        .detail-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #cbd5e1; font-size: 14px; }
        .detail-row:last-child { border-bottom: none; }
        .detail-row span { color: #64748b; }
        .detail-row strong { color: #0f172a; font-weight: 600; }

        .signature { margin-top: 40px; font-size: 13px; color: #94a3b8; font-weight: 500; }
        .signature span { color: #1e293b; font-weight: 600; }
        .signature .heart { color: #ef4444; font-size: 14px; display: inline-block; animation: heartbeat 1.5s infinite; }

        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.2); } }
    </style>
</head>
<body>

    <div class="premium-container">
        
        <!-- 🔐 LOCK SCREEN VIEW -->
        <div id="lockScreen">
            <div class="header">
                <h2>🔒 Restricted Access</h2>
                <p>Enter screen password to continue</p>
            </div>
            <div class="input-group">
                <input type="password" id="passInput" placeholder="Enter Password" autocomplete="off">
            </div>
            <div id="passError" class="error-msg">Incorrect password. Try again!</div>
            <button onclick="verifyPassword()">Unlock Portal</button>
        </div>

        <!-- 🚀 MAIN APP VIEW -->
        <div id="appScreen">
            <div class="header">
                <h2>PAN Verification API</h2>
                <p>Fast & Secure Enterprise Lookup</p>
            </div>
            
            <div class="input-group">
                <input type="text" id="panInput" class="pan-box" placeholder="ENTER PAN NUMBER" maxlength="10" autocomplete="off">
            </div>
            
            <button id="searchBtn" onclick="requestSearch()">Verify PAN Details</button>
            
            <div id="statusBox" class="status-banner"></div>
            <div id="resultCard" class="result-card"></div>
        </div>
        
        <div class="signature">
            Designed & Engineered by <span>Ankit Rathore</span> <span class="heart">❤️</span>
        </div>
    </div>

    <script>
        // Page load hone par check karo kya pehle se unlocked hai
        window.onload = function() {
            if(sessionStorage.getItem("portal_unlocked") === "true") {
                document.getElementById('lockScreen').style.display = "none";
                document.getElementById('appScreen').style.display = "block";
            }
        }

        async function verifyPassword() {
            let pass = document.getElementById('passInput').value.trim();
            let errDiv = document.getElementById('passError');

            let formData = new FormData();
            formData.append('password', pass);

            try {
                let res = await fetch('/login', { method: 'POST', body: formData });
                let data = await res.json();

                if(data.success) {
                    sessionStorage.setItem("portal_unlocked", "true");
                    document.getElementById('lockScreen').style.display = "none";
                    document.getElementById('appScreen').style.display = "block";
                } else {
                    errDiv.style.display = "block";
                }
            } catch(e) {
                alert("Server error during login.");
            }
        }

        let pollInterval = null;

        async function requestSearch() {
            let pan = document.getElementById('panInput').value.trim().toUpperCase();
            let resultCard = document.getElementById('resultCard');
            let statusBox = document.getElementById('statusBox');
            let btn = document.getElementById('searchBtn');
            
            if(!pan || pan.length !== 10) {
                alert("Please enter a valid 10-digit PAN.");
                return;
            }

            btn.disabled = true;
            btn.innerText = "Connecting to Server... ⏳";
            resultCard.style.display = "none";
            
            statusBox.className = "status-banner status-waiting";
            statusBox.style.display = "block";
            statusBox.innerHTML = "Submitting secure request...";

            let formData = new FormData();
            formData.append('pan', pan);

            try {
                let response = await fetch('/enqueue', { method: 'POST', body: formData });
                let data = await response.json();

                if(data.unauthorized) {
                    alert("Session timed out. Please unlock again.");
                    sessionStorage.removeItem("portal_unlocked");
                    location.reload();
                    return;
                }

                if(data.status === "DONE") {
                    showFinalResult(data.data, true);
                } else if(data.ticket_id) {
                    statusBox.innerHTML = `🎫 Ticket: <b>${data.ticket_id}</b> <br> 🚶 Added to Queue...`;
                    pollInterval = setInterval(() => checkStatus(data.ticket_id), 2000);
                }
            } catch (err) {
                statusBox.innerHTML = "Network connection failed.";
                btn.disabled = false;
                btn.innerText = "Verify PAN Details";
            }
        }

        async function checkStatus(ticketId) {
            let statusBox = document.getElementById('statusBox');
            
            try {
                let res = await fetch(`/status/${ticketId}`);
                let data = await res.json();

                if (data.status === "WAITING") {
                    statusBox.className = "status-banner status-waiting";
                    statusBox.innerHTML = `🎫 Ticket: <b>${ticketId}</b> <br> 🚶 Queue Position: <b>${data.position}</b>`;
                } else if (data.status === "PROCESSING") {
                    statusBox.className = "status-banner status-processing";
                    statusBox.innerHTML = `🎫 Ticket: <b>${ticketId}</b> <br> ⚡ Validating via API...`;
                } else if (data.status === "DONE") {
                    clearInterval(pollInterval);
                    showFinalResult(data.data, false, data.error);
                }
            } catch(e) { console.log("Polling error..."); }
        }

        function showFinalResult(apiData, isCached = false, errorMsg = null) {
            let resultCard = document.getElementById('resultCard');
            let statusBox = document.getElementById('statusBox');
            let btn = document.getElementById('searchBtn');

            statusBox.style.display = "none";
            resultCard.style.display = "block";
            
            if (apiData && apiData.data) {
                let details = apiData.data;
                let statusBadgeClass = details.panStatus === 'VALID' ? 'badge-valid' : 'badge-invalid';
                
                let middleNameRow = (details.middleName && details.middleName.trim() !== "") 
                    ? `<div class="detail-row"><span>Middle Name</span> <strong>${details.middleName}</strong></div>` 
                    : '';

                resultCard.innerHTML = `
                    ${isCached ? '<div class="cache-badge">⚡ Instant Hit</div>' : ''}
                    <div class="${statusBadgeClass}">${details.panStatus || 'UNKNOWN'}</div>
                    <div class="detail-row"><span>Full Name</span> <strong>${details.customerName || '-'}</strong></div>
                    <div class="detail-row"><span>First Name</span> <strong>${details.firstName || '-'}</strong></div>
                    ${middleNameRow}
                    <div class="detail-row"><span>Last Name</span> <strong>${details.lastName || '-'}</strong></div>
                    <div class="detail-row"><span>DOB</span> <strong>${details.dob || '-'}</strong></div>
                `;
            } else if (errorMsg) {
                resultCard.innerHTML = `<div style="color:#ef4444; font-weight:500; font-size:14px; text-align:center;">❌ ${errorMsg}</div>`;
            } else {
                resultCard.innerHTML = `<div style="color:#ef4444; font-weight:500; font-size:14px; text-align:center;">❌ Invalid PAN or Data not found.</div>`;
            }

            btn.disabled = false;
            btn.innerText = "Verify Another PAN";
        }
    </script>
</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/login', methods=['POST'])
def login():
    password = request.form.get('password', '')
    if password == CORRECT_PASSWORD:
        session['authenticated'] = True
        return jsonify({"success": True})
    return jsonify({"success": False})

@app.route('/enqueue', methods=['POST'])
def enqueue_task():
    global ticket_counter, queue_list, results_db, pan_cache
    
    # Backend Security Check
    if not session.get('authenticated'):
        return jsonify({"unauthorized": True})
    
    pan_number = request.form.get('pan', '').strip().upper()
    if not pan_number:
        return jsonify({"error": "PAN missing"})

    if pan_number in pan_cache:
        print(f"⚡ CACHE HIT for {pan_number}")
        return jsonify({"status": "DONE", "data": pan_cache[pan_number], "cached": True})

    ticket_counter += 1
    t_id = f"TKT-{ticket_counter}"
    
    results_db[t_id] = {'status': 'WAITING', 'data': None, 'error': None}
    queue_list.append({'ticket_id': t_id, 'pan': pan_number})
    
    return jsonify({"ticket_id": t_id, "status": "QUEUED"})

@app.route('/status/<ticket_id>', methods=['GET'])
def check_status(ticket_id):
    global queue_list, results_db
    
    if not session.get('authenticated'):
        return jsonify({"error": "Unauthorized"})
        
    if ticket_id not in results_db:
        return jsonify({"error": "Invalid Ticket ID"})
        
    info = results_db[ticket_id]
    
    if info['status'] == 'WAITING':
        position = 0
        for index, item in enumerate(queue_list):
            if item['ticket_id'] == ticket_id:
                position = index + 1
                break
        return jsonify({"status": "WAITING", "position": position})
        
    elif info['status'] == 'PROCESSING':
        return jsonify({"status": "PROCESSING"})
        
    elif info['status'] == 'DONE':
        return jsonify({
            "status": "DONE",
            "data": info['data'],
            "error": info['error']
        })

if __name__ == '__main__':
    start_persistent_browser()
    worker_thread = threading.Thread(target=background_queue_worker, daemon=True)
    worker_thread.start()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))