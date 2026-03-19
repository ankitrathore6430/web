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

        # Content Formatting
        subject = subject_template.replace("{name}", lead_name)
        # HTML body mein name replace karna
        final_body = html_body.replace("{name}", lead_name)

        try:
            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
                server.login(sender['email'].strip(), sender['pw'].strip())
                
                msg = MIMEMultipart()
                msg['From'] = f"Loan Services <{sender['email']}>"
                msg['To'] = lead_email
                msg['Subject'] = subject
                
                # Professional HTML Body
                msg.attach(MIMEText(final_body, 'html'))
                
                if attachment_data:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(attachment_data['content'])
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f"attachment; filename={attachment_data['name']}")
                    msg.attach(part)
                
                server.send_message(msg)
            
            state["logs"].insert(0, f"✅ Sent to {lead_email} via {sender['email']}")
            acc_index = (acc_index + 1) % len(accounts)
            time.sleep(60) # Secure Cooldown for Gmail
            
        except Exception as e:
            state["logs"].insert(0, f"❌ Error on {lead_email}: {str(e)}")
            time.sleep(5)

    state["is_running"] = False
    state["logs"].insert(0, "🏁 Campaign Finished.")

# --- UI with Professional Editor (Quill.js) ---
HTML_UI = """
<!DOCTYPE html>
<html>
<head>
    <title>Professional Mailer Studio</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css">
    <link href="https://cdn.quilljs.com/1.3.6/quill.snow.css" rel="stylesheet">
    <style>
        body { background: #f0f2f5; padding-top: 20px; }
        .editor-container { background: white; border-radius: 8px; border: 1px solid #ccc; }
        #editor { height: 300px; font-size: 16px; }
        .log-box { height: 250px; overflow-y: auto; background: #1e1e1e; color: #00ff00; padding: 15px; font-family: monospace; border-radius: 8px; font-size: 12px; }
        .card-header { background: #0d6efd; color: white; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container pb-5">
        <div class="card shadow">
            <div class="card-header text-center">🚀 Professional Loan Marketing Studio</div>
            <div class="card-body">
                <div class="row g-4">
                    <div class="col-md-4">
                        <label class="fw-bold mb-1">1. Multi-Gmail Accounts</label>
                        <textarea id="accs" class="form-control mb-3" rows="4" placeholder="email:app_password (one per line)"></textarea>
                        
                        <label class="fw-bold mb-1">2. Upload Leads (CSV)</label>
                        <input type="file" id="csvFile" class="form-control mb-3" accept=".csv">
                        
                        <label class="fw-bold mb-1">3. Attach Media (PDF/Image)</label>
                        <input type="file" id="mediaFile" class="form-control mb-4">
                        
                        <button onclick="launch()" id="launchBtn" class="btn btn-primary w-100 btn-lg shadow">Launch Campaign</button>
                    </div>

                    <div class="col-md-8">
                        <label class="fw-bold mb-1">Email Subject</label>
                        <input type="text" id="subject" class="form-control mb-3" placeholder="Hi {name}, Special Offer for 40k+ salary!">
                        
                        <label class="fw-bold mb-1">Compose Email (Real Mail Experience)</label>
                        <div class="editor-container">
                            <div id="editor">
                                <p>Hi {name},</p>
                                <p>We have a special <b>Personal Loan</b> offer for you based on your corporate profile.</p>
                                <p>Benefits: <i>Zero Processing Fee</i> & Instant Disbursement.</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="mt-4">
                    <h6 class="fw-bold text-secondary">Live Transmission Logs:</h6>
                    <div id="logs" class="log-box">Waiting for instructions...</div>
                </div>
            </div>
        </div>
    </div>

    <script src="https://cdn.quilljs.com/1.3.6/quill.js"></script>
    <script>
        // Initialize Professional Editor
        var quill = new Quill('#editor', {
            theme: 'snow',
            modules: {
                toolbar: [
                    [{ 'header': [1, 2, false] }],
                    ['bold', 'italic', 'underline'],
                    [{'list': 'ordered'}, {'list': 'bullet'}],
                    ['link', 'clean']
                ]
            }
        });

        async function launch() {
            const csv = document.getElementById('csvFile').files[0];
            const media = document.getElementById('mediaFile').files[0];
            
            if(!csv) { alert("Please upload a CSV file!"); return; }

            const csvText = await csv.text();
            const leads = csvText.split('\\n').slice(1).map(line => ({email: line.split(',')[0], name: line.split(',')[1]})).filter(l => l.email);

            let attachment = null;
            if (media) {
                const buffer = await media.arrayBuffer();
                const base64Str = btoa(new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), ''));
                attachment = { name: media.name, content: base64Str };
            }

            const data = {
                accounts: document.getElementById('accs').value.trim().split('\\n').map(l => ({email: l.split(':')[0], pw: l.split(':')[1]})),
                leads: leads,
                subject: document.getElementById('subject').value,
                body: quill.root.innerHTML, // HTML from editor
                attachment: attachment
            };

            fetch('/start', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(data)});
            document.getElementById('launchBtn').innerText = "Running...";
        }

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
        attach = {
            'name': data['attachment']['name'],
            'content': base64.b64decode(data['attachment']['content'])
        }

    threading.Thread(target=send_worker, args=(data['accounts'], data['leads'], data['subject'], data['body'], attach)).start()
    return jsonify({"status": "ok"})

@app.route('/logs')
def get_logs(): return jsonify(state["logs"][:40])

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)
