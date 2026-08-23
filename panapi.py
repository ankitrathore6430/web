import os
import json
import requests
from flask import Flask, render_template_string, request, jsonify

app = Flask(__name__)

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
        #result { margin-top: 20px; text-align: left; background: #eef9e3; padding: 15px; border-radius: 5px; word-break: break-all; display: none; max-height: 400px; overflow-y: auto; font-family: monospace; }
        .warning { background: #ffebeb; color: #d32f2f; padding: 10px; border-radius: 5px; margin-top: 10px; font-weight: bold; display: none;}
    </style>
</head>
<body>

    <div class="box">
        <h2>⚡ Fast API Verification</h2>
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
            resultDiv.className = "";
            resultDiv.innerHTML = "Fetching directly from API... ⚡";

            let formData = new FormData();
            formData.append('pan', pan);

            try {
                let response = await fetch('/search', {
                    method: 'POST',
                    body: formData
                });

                let data = await response.json();
                
                if (data.error) {
                    resultDiv.style.background = "#ffebeb";
                    resultDiv.innerHTML = "<b>⚠️ Error:</b><br>" + data.error;
                } else {
                    resultDiv.style.background = "#eef9e3";
                    resultDiv.innerHTML = "<pre>" + JSON.stringify(data, null, 4) + "</pre>";
                }
            } catch (err) {
                resultDiv.innerHTML = "Error connecting to server.";
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
    pan_number = request.form.get('pan', '').strip().upper()
    if not pan_number:
        return jsonify({"error": "PAN number zaroori hai!"})

    try:
        # 1. GitHub se uploaded cookies aur storage read karna
        if not os.path.exists("cookies.json") or not os.path.exists("storage.json"):
            return jsonify({"error": "Auth files (cookies.json ya storage.json) server par nahi hain!"})

        # Token Extract karna
        with open("storage.json", "r") as f:
            storage_data = json.load(f)
            # JSON format me stored string ko wapas dict banayenge
            token_str = storage_data.get("session", {}).get("accessToken", "{}")
            token_dict = json.loads(token_str)
            bearer_token = token_dict.get("access_token", "")

        # Cookies Extract karna
        cookies_dict = {}
        with open("cookies.json", "r") as f:
            cookies_list = json.load(f)
            for c in cookies_list:
                cookies_dict[c["name"]] = c["value"]

        if not bearer_token:
            return jsonify({"error": "storage.json ke andar access_token nahi mila!"})

        # 2. Direct API Hit (No Browser needed)
        api_url = f"https://turtlemintloans.com/api/minterprise/v1/products/personal-loan/leads/existing-lead-by-pan?pan={pan_number}"
        
        headers = {
            "Authorization": bearer_token,
            "Accept": "application/json, text/plain, */*",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36",
            "Referer": "https://turtlemintloans.com/products/personal-loan/customer/MULTI/apply",
            "Origin": "https://turtlemintloans.com"
        }

        # Matra 1-2 second me result wapas aayega
        response = requests.get(api_url, headers=headers, cookies=cookies_dict, timeout=10)

        # 3. Response Handle karna
        if response.status_code == 200:
            return jsonify(response.json())
        elif response.status_code in [401, 403]:
            return jsonify({"error": "API Token expire ho gaya hai! Kripya GitHub par manually naye cookies.json aur storage.json upload karein aur deploy karein."})
        elif response.status_code == 400:
            return jsonify({"error": "API ne 400 Bad Request diya. Ho sakta hai is PAN par lead banani baaki ho ya invalid ho.", "details": response.text})
        else:
            return jsonify({"error": f"Turtlemint API Error (Code: {response.status_code})", "details": response.text})

    except Exception as e:
        return jsonify({"error": str(e)})

if __name__ == '__main__':
    # Render cloud ke default port setup ke liye
    app.run(host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))
