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

# Global variables for Speed & Stability
driver = None
driver_lock = threading.Lock()
pan_cache = {}  # 🚀 SMART CACHE: Ek baar search hua PAN yahan save ho jayega instant result ke liye

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
    print("🚀 Browser initialized and waiting for PAN searches.")

# HTML Frontend (With Anti-Spam Security & Ankit's Signature)
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
        #result { margin-top: 20px; text-align: left; background: #eef9e3; padding: 15px; border-radius: 6px; display: none; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
        .loader { color: #555; font-style: italic; }
        
        /* The Creator Signature */
        .creator-signature { margin-top: 35px; font-size: 13px; color: #888; font-weight: 600; }
        .creator-signature span { color: #e25555; font-size: 15px; }
    </style>
</head>
<body>

    <div class="box">
        <h2>Instant PAN Verification</h2>
        <input type="text" id="panInput" placeholder="ENTER PAN" maxlength="10" autocomplete="off">
        <br>
        <button id="searchBtn" onclick="searchPan()">Search Details</button>
        <div id="result"></div>
        
        <div class="creator-signature">
            This Tool Created by Ankit Rathore <span>❤️</span>
        </div>
    </div>

    <script>
        async function searchPan() {
            let pan = document.getElementById('panInput').value.trim().toUpperCase();
            let resultDiv = document.getElementById('result');
            let btn = document.getElementById('searchBtn');
            
            if(!pan || pan.length !== 10) {
                alert("Kripya 10 digit ka valid PAN number enter karein!");
                return;
            }

            // LEVEL 1 SECURITY: Button Disabled to prevent double click spam
            btn.disabled = true;
            btn.innerText = "Searching... ⏳";
            
            resultDiv.style.display = "block";
            resultDiv.innerHTML = "<span class='loader'>Fetching data from server...</span>";

            let formData = new FormData();
            formData.append('pan', pan);

            try {
                let response = await fetch('/search', {
                    method: 'POST',
                    body: formData
                });
                let data = await response.json();
                resultDiv.innerHTML = JSON.stringify(data, null, 4);
            } catch (err) {
                resultDiv.innerHTML = "Server connection error.";
            } finally {
                // Task complete hone ke baad button wapas normal
                btn.disabled = false;
                btn.innerText = "Search Details";
            }
        }
    </script>

</body>
</html>
"""

@app.route('/')
def index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/search', methods=['POST'])
def search_pan():
    global driver, pan_cache
    pan_number = request.form.get('pan', '').strip().upper()
    
    if not pan_number:
        return jsonify({"error": "PAN number zaroori hai!"})

    # LEVEL 2 SECURITY (SUPER FAST): Agar PAN pehle se Cache mein hai, toh instant result do (0.1s delay)
    if pan_number in pan_cache:
        print(f"⚡ INSTANT HIT: Returning cached result for {pan_number}")
        return jsonify(pan_cache[pan_number])

    # Agar naya PAN hai, toh systematically Queue mein lagao
    with driver_lock:
        if driver is None:
            start_persistent_browser()

        wait = WebDriverWait(driver, 10)

        try:
            if "login" in driver.current_url:
                return jsonify({"error": "Session expired! Naye cookies/storage update karein."})

            pan_input = wait.until(EC.presence_of_element_located((
                By.XPATH, "//input[contains(@name, 'pan') or contains(@class, 'pan') or contains(@id, 'pan')]"
            )))

            pan_input.send_keys(Keys.CONTROL + "a")
            pan_input.send_keys(Keys.BACKSPACE)
            time.sleep(0.2)

            pan_input.send_keys(pan_number)
            # Smart API trigger without pressing any Submit button
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
                        request_id = log["params"]["requestId"]
                        
                        if "existing-lead-by-pan" in url.lower() and pan_number.lower() in url.lower():
                            try:
                                body = driver.execute_cdp_cmd('Network.getResponseBody', {'requestId': request_id})
                                extracted_data = json.loads(body['body'])
                                break
                            except Exception:
                                pass
                if extracted_data:
                    break
                time.sleep(0.3)

            if extracted_data:
                # Result Cache mein save kar lo, taaki agli baar yahi aane par wait na karna pade
                pan_cache[pan_number] = extracted_data
                return jsonify(extracted_data)
            else:
                return jsonify({"error": "Data fetch nahi ho paya ya PAN invalid hai."})

        except Exception as e:
            return jsonify({"error": str(e)})

if __name__ == '__main__':
    start_persistent_browser()
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))