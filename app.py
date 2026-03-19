import threading
import time
import smtplib
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from flask import Flask, render_template_string, request, jsonify

app = Flask(__name__)

# --- Global State ---
state = {"is_running": False, "logs": [], "stop": False}

def send_worker(accounts, leads, subject_template, html_body, attachment_data=None):
    global state
    acc_index = 0
    state["stop"] = False
    
    for i, lead in enumerate(leads):
        if state["stop"]: 
            state["logs"].insert(0, "🛑 Process stopped by user.")
            break
        
        sender = accounts[acc_index]
        lead_name = lead.get('name', 'Customer')
        lead_email = lead['email'].strip()

        subject = subject_template.replace("{name}", lead_name)
        final_body = html_body.replace("{name}", lead_name)

        try:
            # Port 587 (TLS) for better Cloud Compatibility
            server = smtplib.SMTP('smtp.gmail.com', 587)
            server.starttls()
            server.login(sender['email'].strip(), sender['pw'].strip())
            
            msg = MIMEMultipart()
            msg['From'] = f"Loan Services <{sender['email']}>"
            msg['To'] = lead_email
            msg['Subject'] = subject
            msg.attach(MIMEText(final_body, 'html'))
            
            if attachment_data:
                part = MIMEBase('application', 'octet-stream')
                part.set_payload(attachment_data['content'])
                encoders.encode_base64(part)
                part.add_header('Content-Disposition', f"attachment; filename={attachment_data['name']}")
                msg.attach(part)
            
            server.send_message(msg)
            server.quit()
            
            state["logs"].insert(0, f"✅ Sent: {lead_email} (via {sender['email']})")
            acc_index = (acc_index + 1) % len(accounts)
            time.sleep(60)
            
        except Exception as e:
            state["logs"].insert(0, f"❌ Error: {str(e)}")
            time.sleep(5)

    state["is_running"] = False
    state["logs"].insert(0, "🏁 Campaign Finished.")

# --- Professional UI with Database Storage ---
HTML_UI = """
<!DOCTYPE html>
<html>
<head>
    <title>Pro Mailer Studio v2</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <style>
        body { background: #f8f9fa; font-family: 'Inter', sans-serif; }
        .card { border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
        #editor { height: 250px; background: white; }
        .log-box { height: 200px; overflow-y: auto; background: #111; color: #0f0; padding: 15px; font-family: monospace; border-radius: 8px; font-size: 12px; }
        .acc-item { display: flex; justify-content: space-between; background: #e9ecef; padding: 5px 10px; margin-bottom: 5px; border-radius: 5px; font-size: 13px; }
    </style>
</head>
<body class="p-4">
    <div class="container-fluid">
        <h3 class="text-center mb-4 text-primary fw-bold">🚀 Advanced Email Marketing Studio</h3>
        
        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card p-3 mb-3">
                    <h6 class="fw-bold">📧 Manage Sender Accounts</h6>
                    <div class="input-group mb-2">
                        <input type="email" id="acc_email" class="form-control" placeholder="Gmail Address">
                        <input type="password" id="acc_pw" class="form-control" placeholder="App Password">
                        <button onclick="addAccount()" class="btn btn-primary">+</button>
                    </div>
                    <div id="accList" class="mt-2"></div>
                </div>

                <div class="card p-3">
                    <h6 class="fw-bold">👥 Target Leads (Email List)</h6>
                    <ul class="nav nav-tabs mb-2">
                        <li class="nav-item"><a class="nav-link active py-1" data-bs-toggle="tab" href="#pasteTab">Paste</a></li>
                        <li class="nav-item"><a class="nav-link py-1" data-bs-toggle="tab" href="#uploadTab">Upload</a></li>
                    </ul>
                    <div class="tab-content">
                        <div id="pasteTab" class="tab-pane fade show active">
                            <textarea id="leadsPaste" class="form-control" rows="5" placeholder="email:name (one per line)"></textarea>
                        </div>
                        <div id="uploadTab" class="tab-pane fade">
                            <input type="file" id="csvFile" class="form-control" accept=".csv">
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card p-3 mb-3">
                    <h6 class="fw-bold">✉️ Compose Campaign</h6>
                    <input type="text" id="subject" class="form-control mb-2" placeholder="Subject (Use {name} for personalization)">
                    <div id="editor"></div>
                    <div class="mt-3">
                        <label class="small fw-bold">Attach Media (Optional):</label>
                        <input type="file" id="mediaFile" class="form-control form-control-sm w-50">
                    </div>
                </div>
                
                <div class="d-flex gap-2 mb-3">
                    <button onclick="launch()" id="launchBtn" class="btn btn-success flex-grow-1 fw-bold py-2">START CAMPAIGN</button>
                    <button onclick="stop()" class="btn btn-danger px-4">STOP</button>
                </div>

                <div class="log-box" id="logs">Waiting for action...</div>
            </div>
        </div>
    </div>

    <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        var quill = new Quill('#editor', { theme: 'snow', modules: { toolbar: [['bold', 'italic'], ['link', 'image']] } });
        let savedAccounts = JSON.parse(localStorage.getItem('mailer_accs') || '[]');

        function updateAccUI() {
            const list = document.getElementById('accList');
            list.innerHTML = savedAccounts.map((a, i) => `
                <div class="acc-item">
                    <span>${a.email}</span>
                    <button onclick="deleteAccount(${i})" class="btn btn-sm text-danger p-0">✖</button>
                </div>
            `).join('');
            localStorage.setItem('mailer_accs', JSON.stringify(savedAccounts));
        }

        function addAccount() {
            const email = document.getElementById('acc_email').value;
            const pw = document.getElementById('acc_pw').value;
            if(email && pw) {
                savedAccounts.push({email, pw});
                updateAccUI();
                document.getElementById('acc_email').value = '';
                document.getElementById('acc_pw').value = '';
            }
        }

        function deleteAccount(i) { savedAccounts.splice(i, 1); updateAccUI(); }
        updateAccUI();

        async function launch() {
            let leads = [];
            const pasteData = document.getElementById('leadsPaste').value.trim();
            const fileInput = document.getElementById('csvFile').files[0];

            if (pasteData) {
                leads = pasteData.split('\\n').map(l => ({email: l.split(':')[0], name: l.split(':')[1] || 'Customer'}));
            } else if (fileInput) {
                const text = await fileInput.text();
                leads = text.split('\\n').slice(1).map(l => ({email: l.split(',')[0], name: l.split(',')[1] || 'Customer'}));
            }

            const media = document.getElementById('mediaFile').files[0];
            let attachment = null;
            if (media) {
                const buffer = await media.arrayBuffer();
                const base64Str = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                attachment = { name: media.name, content: base64Str };
            }

            const payload = {
                accounts: savedAccounts,
                leads: leads,
                subject: document.getElementById('subject').value,
                body: quill.root.innerHTML,
                attachment: attachment
            };

            fetch('/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
            document.getElementById('launchBtn').innerText = "Campaign Running...";
        }

        function stop() { fetch('/stop', {method: 'POST'}); location.reload(); }

        setInterval(() => {
            fetch('/logs').then(r => r.json()).then(d => { document.getElementById('logs').innerHTML = d.join('<br>'); });
        }, 3000);
    </script>
</body>
</html>
"""

@app.route('/')
def index(): return render_template_string(HTML_UI)

@app.route('/start', methods=['POST'])
def start_campaign():
    import base64
    data = request.json
    state["is_running"] = True
    attach = None
    if data.get('attachment'):
        attach = {'name': data['attachment']['name'], 'content': base64.b64decode(data['attachment']['content'])}
    threading.Thread(target=send_worker, args=(data['accounts'], data['leads'], data['subject'], data['body'], attach)).start()
    return jsonify({"status": "ok"})

@app.route('/stop', methods=['POST'])
def stop_campaign():
    state["stop"] = True
    return jsonify({"status": "ok"})

@app.route('/logs')
def get_logs(): return jsonify(state["logs"][:40])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
