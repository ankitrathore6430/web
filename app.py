import threading
import time
import smtplib
import base64
import socket
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
            # Fixing Network Unreachable by forcing IPv4 and adding timeout
            remote_host = "smtp.gmail.com"
            port = 587
            
            server = smtplib.SMTP(remote_host, port, timeout=30)
            server.set_debuglevel(1)
            server.ehlo()
            server.starttls() # Secure connection
            server.login(sender['email'].strip(), sender['pw'].strip())
            
            msg = MIMEMultipart()
            msg['From'] = f"Services <{sender['email']}>"
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
            time.sleep(60) # Anti-Spam Gap
            
        except Exception as e:
            state["logs"].insert(0, f"❌ Connection Error on {sender['email']}: {str(e)}")
            acc_index = (acc_index + 1) % len(accounts)
            time.sleep(10)

    state["is_running"] = False
    state["logs"].insert(0, "🏁 Campaign Finished.")

# --- UI with LocalStorage Database ---
HTML_UI = """
<!DOCTYPE html>
<html>
<head>
    <title>SaaS Mailer Studio</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <style>
        body { background: #f4f6f9; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .card { border: none; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
        #editor { height: 250px; background: white; }
        .log-box { height: 250px; overflow-y: auto; background: #1a1a1b; color: #00ff00; padding: 15px; font-family: monospace; border-radius: 8px; font-size: 12px; border: 1px solid #333; }
        .acc-item { display: flex; justify-content: space-between; background: #ffffff; padding: 8px 12px; margin-bottom: 8px; border-radius: 6px; border: 1px solid #ddd; align-items: center; }
        .btn-delete { color: #dc3545; cursor: pointer; font-weight: bold; }
    </style>
</head>
<body class="p-4">
    <div class="container-fluid">
        <h3 class="text-center mb-4 text-dark fw-bold">🚀 Enterprise Email Studio</h3>
        
        <div class="row g-4">
            <div class="col-lg-4">
                <div class="card p-3 mb-3">
                    <h6 class="fw-bold mb-3">🛡️ Saved Sender Accounts</h6>
                    <div class="mb-3">
                        <input type="email" id="acc_email" class="form-control mb-2" placeholder="Gmail Address">
                        <input type="password" id="acc_pw" class="form-control mb-2" placeholder="16-Digit App Password">
                        <button onclick="addAccount()" class="btn btn-dark w-100">Add & Save Account</button>
                    </div>
                    <div id="accList" style="max-height: 200px; overflow-y: auto;"></div>
                </div>

                <div class="card p-3">
                    <h6 class="fw-bold mb-3">👥 Lead Management</h6>
                    <ul class="nav nav-pills mb-3" id="pills-tab">
                        <li class="nav-item w-50"><button class="nav-link active w-100" data-bs-toggle="pill" data-bs-target="#p-paste">Paste List</button></li>
                        <li class="nav-item w-50"><button class="nav-link w-100" data-bs-toggle="pill" data-bs-target="#p-file">Upload CSV</button></li>
                    </ul>
                    <div class="tab-content">
                        <div class="tab-pane fade show active" id="p-paste">
                            <textarea id="leadsPaste" class="form-control" rows="6" placeholder="email:name (One per line)"></textarea>
                        </div>
                        <div class="tab-pane fade" id="p-file">
                            <input type="file" id="csvFile" class="form-control" accept=".csv">
                            <p class="small text-muted mt-2">Format: Column A (Email), Column B (Name)</p>
                        </div>
                    </div>
                </div>
            </div>

            <div class="col-lg-8">
                <div class="card p-3 mb-3">
                    <h6 class="fw-bold mb-3">✉️ Campaign Designer</h6>
                    <input type="text" id="subject" class="form-control mb-3" placeholder="Subject (Use {name} for personalization)">
                    <div id="editor"></div>
                    <div class="mt-3 d-flex align-items-center gap-3">
                        <label class="fw-bold small">Attachment:</label>
                        <input type="file" id="mediaFile" class="form-control form-control-sm w-50">
                    </div>
                </div>
                
                <div class="row g-2 mb-3">
                    <div class="col-9"><button onclick="launch()" id="launchBtn" class="btn btn-primary w-100 fw-bold py-2">START CAMPAIGN</button></div>
                    <div class="col-3"><button onclick="stop()" class="btn btn-outline-danger w-100 fw-bold py-2">STOP</button></div>
                </div>

                <div id="logs" class="log-box">Ready to launch...</div>
            </div>
        </div>
    </div>

    <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    
    <script>
        var quill = new Quill('#editor', { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], ['link', 'image', { 'list': 'ordered'}, { 'list': 'bullet' }]] } });
        let savedAccounts = JSON.parse(localStorage.getItem('pro_mailer_accs') || '[]');

        function updateAccUI() {
            const list = document.getElementById('accList');
            list.innerHTML = savedAccounts.map((a, i) => `
                <div class="acc-item">
                    <span><b>${i+1}.</b> ${a.email}</span>
                    <span onclick="deleteAccount(${i})" class="btn-delete">DELETE</span>
                </div>
            `).join('');
            localStorage.setItem('pro_mailer_accs', JSON.stringify(savedAccounts));
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
                leads = text.split('\\n').slice(1).map(l => {
                    const parts = l.split(',');
                    return {email: parts[0], name: parts[1] || 'Customer'};
                }).filter(l => l.email);
            }

            if(savedAccounts.length === 0 || leads.length === 0) { alert("Add accounts and leads first!"); return; }

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
            document.getElementById('launchBtn').innerText = "RUNNING...";
            document.getElementById('launchBtn').className = "btn btn-warning w-100 fw-bold py-2";
        }

        function stop() { fetch('/stop', {method: 'POST'}).then(() => location.reload()); }

        setInterval(() => {
            fetch('/logs').then(r => r.json()).then(d => { document.getElementById('logs').innerHTML = d.join('<br>'); });
        }, 2000);
    </script>
</body>
</html>
