import os
import time
import json
import threading
from flask import Flask, render_template_string, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

app = Flask(__name__)

# --- GLOBAL VARIABLES FOR QUEUE & CACHE ---
driver = None
pan_cache = {}          # Instant results ke liye memory
ticket_counter = 0      # Ticket number generate karne ke liye
queue_list = []         # Line jisme tickets khadi hongi: [{'ticket_id': 'TKT-1', 'pan': 'MMNP...'}, ...]
results_db = {}         # Har ticket ka live status: {'TKT-1': {'status': 'WAITING', 'data': None, 'error': None}}

def start_persistent_browser():
    """Browser ko ek hi baar start karega"""
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
    """Yeh robot hamesha chalega aur line (queue) mein lage PAN ko search karega"""
    global driver, queue_list, results_db, pan_cache
    
    while True:
        if len(queue_list) > 0:
            # Line mein sabse aage khade insaan (index 0) ko bulao
            current_task = queue_list[0]
            t_id = current_task['ticket_id']
            pan_number = current_task['pan']
            
            # Status update karo ki "Processing" chal rahi hai
            results_db[t_id]['status'] = 'PROCESSING'
            print(f"⚙️ Processing {t_id} for PAN: {pan_number}")

            try:
                wait = WebDriverWait(driver, 10)
                
                if "login" in driver.current_url:
                    results_db[t_id]['error'] = "Session expired! Naye cookies update karein."
                else:
                    # PAN enter karne ka process
                    pan_input = wait.until(EC.presence_of_element_located((
                        By.XPATH, "//input[contains(@name, 'pan') or contains(@class, 'pan') or contains(@id, 'pan')]"
                    )))

                    pan_input.send_keys(Keys.CONTROL + "a")
                    pan_input.send_keys(Keys.BACKSPACE)
                    time.sleep(0.2)
                    pan_input.send_keys(pan_number)
                    
                    # API Trigger
                    driver.execute_script("arguments[0].dispatchEvent(new Event('change', { bubbles: true })); arguments[0].blur();", pan_input)

                    extracted_data = None
                    start_time = time.time()
                    
                    # 6 seconds tak wait
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

                    # Result Save karna
                    if extracted_data:
                        results_db[t_id]['data'] = extracted_data
                        pan_cache[pan_number] = extracted_data # Cache mein daal do future ke liye
                    else:
                        results_db[t_id]['error'] = "Data fetch nahi ho paya ya PAN invalid hai."

            except Exception as e:
                results_db[t_id]['error'] = str(e)

            # Kaam khatam, status DONE karo aur line (queue) se bahar nikal do
            results_db[t_id]['status'] = 'DONE'
            queue_list.pop(0)
            
        else:
            # Agar line khali hai toh 1 second aaram karo
            time.sleep(1)


# --- HTML FRONTEND (WITH LIVE POLLING) ---
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Instant PAN Lookup</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f0f4f8; text-align: center; padding: 40px; }
        .box { background: white; padding: 30px; border-radius: 12px; display: inline-block; box-shadow: 0 4px 15px rgba(0,0,0,0.1); width: 460px; position: relative; }
        input { padding: 12px; width: 85%; border: 2px solid #ccc; border-radius: 6px; text-transform: uppercase; font-size: 18px; text-align: center; font-weight: bold; letter-spacing: 2px; }
        input:focus { border-color: #009F69; outline: none; }
        button { padding: 12px 28px; background: #009F69; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; font-weight: bold; margin-top: 15px; transition: 0.3s; }
        button:hover:not(:disabled) { background: #007D64; }
        button:disabled { background: #cccccc; cursor: not-allowed; }
        
        #statusBox { margin-top: 20px; font-weight: bold; color: #d9534f; display: none; background: #f9f2f2; padding: 10px; border-radius: 6px; }
        #result { margin-top: 20px; text-align: left; background: #eef9e3; padding: 15px; border-radius: 6px; display: none; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
        
        .creator-signature { margin-top: 35px; font-size: 13px; color: #888; font-weight: 600; }
        .creator-signature span { color: #e25555; font-size: 15px; }
    </style>
</head>
<body>

    <div class="box">
        <h2>Instant PAN Verification</h2>
        <input type="text" id="panInput" placeholder="ENTER PAN" maxlength="10" autocomplete="off">
        <br>
        <button id="searchBtn" onclick="requestSearch()">Search Details</button>
        
        <!-- Live Queue Status Dikhane ke liye -->
        <div id="statusBox"></div>
        <div id="result"></div>
        
        <div class="creator-signature">
            This Tool Created by Ankit Rathore <span>❤️</span>
        </div>
    </div>

    <script>
        let pollInterval = null;

        async function requestSearch() {
            let pan = document.getElementById('panInput').value.trim().toUpperCase();
            let resultDiv = document.getElementById('result');
            let statusBox = document.getElementById('statusBox');
            let btn = document.getElementById('searchBtn');
            
            if(!pan || pan.length !== 10) {
                alert("Kripya 10 digit ka valid PAN number enter karein!");
                return;
            }

            // Button Lock
            btn.disabled = true;
            btn.innerText = "Requesting... ⏳";
            resultDiv.style.display = "none";
            statusBox.style.display = "block";
            statusBox.innerHTML = "Submitting request...";

            let formData = new FormData();
            formData.append('pan', pan);

            try {
                let response = await fetch('/enqueue', {
                    method: 'POST',
                    body: formData
                });
                let data = await response.json();

                // Agar Instant Cache Hit hua
                if(data.status === "DONE") {
                    showFinalResult(data);
                } else if(data.ticket_id) {
                    // Agar Queue mein laga
                    statusBox.innerHTML = `🎫 Ticket: <b>${data.ticket_id}</b> | 🚶 Line mein lag gaye hain...`;
                    // Har 2 second mein status check karo
                    pollInterval = setInterval(() => checkStatus(data.ticket_id), 2000);
                }

            } catch (err) {
                statusBox.innerHTML = "Server error while requesting.";
                btn.disabled = false;
                btn.innerText = "Search Details";
            }
        }

        async function checkStatus(ticketId) {
            let statusBox = document.getElementById('statusBox');
            
            try {
                let res = await fetch(`/status/${ticketId}`);
                let data = await res.json();

                if (data.status === "WAITING") {
                    statusBox.innerHTML = `🎫 Ticket: <b>${ticketId}</b> | 🚶 Waiting Number: <b>${data.position}</b>`;
                } else if (data.status === "PROCESSING") {
                    statusBox.style.color = "#009F69";
                    statusBox.innerHTML = `🎫 Ticket: <b>${ticketId}</b> | ⚙️ Processing your PAN... Please wait!`;
                } else if (data.status === "DONE") {
                    clearInterval(pollInterval);
                    showFinalResult(data);
                }

            } catch(e) {
                console.log("Polling error...");
            }
        }

        function showFinalResult(data) {
            let resultDiv = document.getElementById('result');
            let statusBox = document.getElementById('statusBox');
            let btn = document.getElementById('searchBtn');

            statusBox.style.display = "none";
            resultDiv.style.display = "block";
            
            if(data.data) {
                resultDiv.innerHTML = JSON.stringify(data.data, null, 4);
            } else if (data.error) {
                resultDiv.innerHTML = `<span style="color:red">Error: ${data.error}</span>`;
            }

            btn.disabled = false;
            btn.innerText = "Search Details";
        }
    </script>

</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/enqueue', methods=['POST'])
def enqueue_task():
    """Naya PAN aane par usko Ticket dega ya instant cache se result dega"""
    global ticket_counter, queue_list, results_db, pan_cache
    
    pan_number = request.form.get('pan', '').strip().upper()
    if not pan_number:
        return jsonify({"error": "PAN missing"})

    # 1. CACHE CHECK (Ultra Fast)
    if pan_number in pan_cache:
        print(f"⚡ CACHE HIT for {pan_number}")
        return jsonify({"status": "DONE", "data": pan_cache[pan_number]})

    # 2. QUEUE MEIN LAGANA
    ticket_counter += 1
    t_id = f"TKT-{ticket_counter}"
    
    results_db[t_id] = {'status': 'WAITING', 'data': None, 'error': None}
    queue_list.append({'ticket_id': t_id, 'pan': pan_number})
    
    print(f"🎟️ Ticket {t_id} generated for {pan_number}")
    return jsonify({"ticket_id": t_id, "status": "QUEUED"})

@app.route('/status/<ticket_id>', methods=['GET'])
def check_status(ticket_id):
    """Frontend is URL ko call karega apna live waiting number dekhne ke liye"""
    global queue_list, results_db
    
    if ticket_id not in results_db:
        return jsonify({"error": "Invalid Ticket ID"})
        
    info = results_db[ticket_id]
    
    # Agar Wait kar raha hai toh Line ka number calculate karo
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
    # Flask server start hone se pehle Browser aur Worker Thread start karo
    start_persistent_browser()
    
    worker_thread = threading.Thread(target=background_queue_worker, daemon=True)
    worker_thread.start()
    
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))