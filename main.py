import os
import time
import zipfile
import base64
import requests
import google.generativeai as genai
from supabase import create_client, Client
from selenium import webdriver
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

# ==================== CREDENTIALS ====================
GEMINI_API_KEY = "AIzaSyBCCLrI980bUCzu59w354-1PxWbNs0IJSk"
INSTA_USER = "jai_siya_ram_63"
INSTA_PASS = "Ankit6430"

SUPABASE_URL = "https://gjtryzfzennstnqhafcw.supabase.co"
SUPABASE_KEY = "sb_publishable_pWkPwVuA7eXcA2KpLwPAoA_GfrFrOni"
TABLE_NAME = "instagram_sessions"

SESSION_DIR = os.path.abspath("insta_profile")
SESSION_ZIP = "session.zip"
CHROME_BINARY = "/opt/render/project/src/.render/chrome/opt/google/chrome/google-chrome"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# --- Keep Alive Server for Render ---
class SimpleServer(BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(200)
        self.end_headers()
        self.wfile.write(b"Instagram Bot is Active")

def start_keep_alive():
    port = int(os.environ.get("PORT", 10000))
    server = HTTPServer(('0.0.0.0', port), SimpleServer)
    print(f"📡 Port {port} par server active hai")
    server.serve_forever()

# ==================== SYNC LOGIC ====================

def sync_from_supabase():
    print("🔄 Supabase se session download ho raha hai...")
    try:
        res = supabase.table(TABLE_NAME).select("session_data").eq("id", 1).execute()
        if res.data and len(res.data) > 0:
            b64_data = res.data[0]['session_data']
            with open(SESSION_ZIP, "wb") as f:
                f.write(base64.b64decode(b64_data))
            if os.path.exists(SESSION_DIR):
                import shutil
                shutil.rmtree(SESSION_DIR)
            with zipfile.ZipFile(SESSION_ZIP, 'r') as zip_ref:
                zip_ref.extractall(SESSION_DIR)
            print("✅ Session mil gaya aur extract ho gaya.")
            return True
        print("ℹ️ Pehle se koi session nahi hai.")
    except Exception as e: print(f"⚠️ Sync Error: {e}")
    return False

def sync_to_supabase():
    print("📤 Session save ho raha hai cloud par...")
    try:
        if not os.path.exists(SESSION_DIR): return
        with zipfile.ZipFile(SESSION_ZIP, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(SESSION_DIR):
                for file in files:
                    zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), SESSION_DIR))
        with open(SESSION_ZIP, "rb") as f:
            b64_str = base64.b64encode(f.read()).decode('utf-8')
        supabase.table(TABLE_NAME).upsert({"id": 1, "session_data": b64_str}).execute()
        print("✅ Cloud sync complete.")
    except Exception as e: print(f"⚠️ Cloud Save Error: {e}")

# ==================== BOT EXECUTION ====================

def run_bot():
    sync_from_supabase()
    
    options = Options()
    if os.path.exists(CHROME_BINARY):
        options.binary_location = CHROME_BINARY
        print("✅ Custom Chrome binary found.")

    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-data-dir={SESSION_DIR}")
    
    mobile = {"deviceName": "iPhone 12 Pro"}
    options.add_experimental_option("mobileEmulation", mobile)

    driver = webdriver.Chrome(options=options)

    try:
        driver.get("https://www.instagram.com/")
        time.sleep(12)

        # Login Logic
        if len(driver.find_elements(By.NAME, "username")) > 0:
            print("🔑 Logging in...")
            driver.find_element(By.NAME, "username").send_keys(INSTA_USER)
            driver.find_element(By.NAME, "password").send_keys(INSTA_PASS)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            time.sleep(15)

        # AI Image Generation
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content("Generate a unique detailed prompt for a spiritual Indian divine art in 4k.")
        prompt = response.text.strip()
        
        img_url = f"https://pollinations.ai/p/{prompt.replace(' ', '_')}?width=1080&height=1080&nologo=true"
        with open("post.jpg", "wb") as f: f.write(requests.get(img_url).content)
        print(f"🎨 Image Ready: {prompt[:50]}...")

        # Posting Process
        print("📸 Posting on Instagram...")
        driver.find_element(By.XPATH, "//*[@aria-label='New Post']").click()
        time.sleep(5)
        driver.find_element(By.XPATH, "//input[@type='file']").send_keys(os.path.abspath("post.jpg"))
        time.sleep(8)
        
        # Click Next, Next, Share
        for step in ["Next", "Next", "Share"]:
            try:
                btn = driver.find_element(By.XPATH, f"//button[contains(text(), '{step}')]")
                btn.click()
                time.sleep(6)
            except: pass
            
        print("🚀 DONE! Instagram Post Uploaded.")

    except Exception as e: print(f"❌ Error: {e}")
    finally:
        driver.quit()
        sync_to_supabase()

if __name__ == "__main__":
    # Start the keep-alive server in background
    threading.Thread(target=start_keep_alive, daemon=True).start()
    
    # Run the bot loop (Har 6 ghante mein ek baar)
    while True:
        run_bot()
        print("💤 Sleeping for 6 hours...")
        time.sleep(21600) # 6 hours sleep