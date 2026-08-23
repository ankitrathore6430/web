import os
import time
import json
from flask import Flask, render_template_string, request, jsonify
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

app = Flask(__name__)

# Global driver variable
driver = None

def init_driver_with_session():
    global driver
    if driver is None:
        options = Options()
        options.add_argument('--headless=new')  # Render ke liye headless zaroori hai
        options.add_argument('--no-sandbox')
        options.add_argument('--disable-dev-shm-usage')
        options.add_argument('--window-size=1920,1080')
        options.add_argument('user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36')
        options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
        
        service = Service(ChromeDriverManager().install())
        driver = webdriver.Chrome(service=service, options=options)
        
        # GitHub repo me rakhi cookies.json aur storage.json ko load karna
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
            print("✅ Session Loaded from GitHub files successfully!")
        except Exception as e:
            print(f"⚠️ Session load karte waqt error aaya: {e}")
            
    return driver

# Single file ke andar HTML UI
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>PAN Details Lookup Portal</title>
    <style>
        body { font-family: Arial, sans-serif; background: #f4f7f6; text-align: center; padding: 50px; }
        .box { background: white; padding: 30px; border-radius: 10px; display: inline-block; box-shadow: 0px 4px 10px rgba(0,0,0,0.1); width: 450px; }
        input { padding: 12px; width: 80%; margin-bottom: 15px; border: 1px solid #ccc; border-radius: 5px; text-transform: uppercase; font-size: 16px; text-align: center; }
        button { padding: 12px 25px; background: #009F69; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 16px; font-weight: bold; }
        button:hover { background: #007D64; }
        #result { margin-top: 20px; text-align: left; background: #eef9e3; padding: 15px; border-radius: 5px; word-break: break-all; display: none; max-height: 300px; overflow-y: auto; font-family: monospace; }
    </style>
</head>
<body>

    <div class="box">
        <h2>PAN Verification Portal</h2>
        <input type="text" id="panInput" placeholder="Enter PAN (e.g. MMNPK7854H)" maxlength="10">
        <br>
        <button onclick="searchPan()">Search Details</button>
        
        <div id="result"></div>
    </div>

    <script>
        async function searchPan() {
            let pan = document.getElementById('panInput').value.trim();
            let resultDiv = document.getElementById('result');
            
            if(!pan) {
                alert("Pehle PAN number dalein!");
                return;
            }

            resultDiv.style.display = "block";
            resultDiv.innerHTML = "Searching... Please wait ⏳";

            let formData = new FormData();
            formData.append('pan', pan);

            try {
                let response = await fetch('/search', {
                    method: 'POST',
                    body: formData
                });

                let data = await response.json();
                resultDiv.innerHTML = "<pre>" + JSON.stringify(data, null, 4) + "</pre>";
            } catch (err) {
                resultDiv.innerHTML = "Error connecting to server.";
            }
        }
    </script>

</body>
</html>
"""

@app.route('/')
index():
    return render_template_string(HTML_TEMPLATE)

@app.route('/search', methods=['POST'])
def search_pan():
    pan_number = request.form.get('pan', '').strip().upper()
    if not pan_number:
        return jsonify({"error": "PAN number zaroori hai!"})

    drv = init_driver_with_session()
    wait = WebDriverWait(drv, 15)

    try:
        # Apply page par navigate karna
        drv.get("https://turtlemintloans.com/products/personal-loan/customer/MULTI/apply")
        time.sleep(3)

        # Agar session expire hua ho aur login page khul jaye
        if "login" in drv.current_url:
            return jsonify({"error": "Session expired! GitHub par rakhi cookies/storage purani ho gayi hain. Naya login karke update karein."})

        # PAN input karna aur TAB dabana
        pan_input = wait.until(EC.presence_of_element_located((By.XPATH, "//input[contains(@name, 'pan') or contains(@class, 'pan') or contains(@id, 'pan')]")))
        pan_input.send_keys(Keys.CONTROL + "a")
        pan_input.send_keys(Keys.DELETE)
        pan_input.send_keys(pan_number)
        
        time.sleep(1)
        pan_input.send_keys(Keys.TAB) 
        time.sleep(5)  # API response aane ka wait

        # Performance logs se data intercept karna
        logs = drv.get_log("performance")
        extracted_data = None

        for entry in logs:
            log = json.loads(entry["message"])["message"]
            if log["method"] == "Network.responseReceived":
                response = log["params"]["response"]
                url = response["url"]
                request_id = log["params"]["requestId"]
                
                if "existing-lead-by-pan" in url.lower() and pan_number.lower() in url.lower():
                    try:
                        body = drv.execute_cdp_cmd('Network.getResponseBody', {'requestId': request_id})
                        extracted_data = json.loads(body['body'])
                        break
                    except Exception as e:
                        print(f"Error reading body: {e}")

        if extracted_data:
            return jsonify(extracted_data)
        else:
            return jsonify({"error": "Is PAN ke liye koi details nahi mili ya API fail ho gayi."})

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
