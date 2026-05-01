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
# ChromeDriverManager ki ab zarurat nahi hai is method mein
from selenium.webdriver.common.by import By

# ==================== CREDENTIALS ====================
GEMINI_API_KEY = "AIzaSyBCCLrI980bUCzu59w354-1PxWbNs0IJSk"
INSTA_USER = "jai_siya_ram_63"
INSTA_PASS = "Ankit6430"

SUPABASE_URL = "https://gjtryzfzennstnqhafcw.supabase.co"
SUPABASE_KEY = "sb_publishable_pWkPwVuA7eXcA2KpLwPAoA_GfrFrOni"
TABLE_NAME = "instagram_sessions"

SESSION_DIR = os.path.abspath("insta_profile")
SESSION_ZIP = "session.zip"
# Render par download kiya gaya chrome path
CHROME_BINARY = "/opt/render/project/src/.render/chrome/opt/google/chrome/google-chrome"

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# ==================== SYNC LOGIC ====================

def sync_from_supabase():
    print("🔄 Cloud se session download...")
    try:
        res = supabase.table(TABLE_NAME).select("session_data").eq("id", 1).execute()
        if res.data:
            b64_data = res.data[0]['session_data']
            with open(SESSION_ZIP, "wb") as f:
                f.write(base64.b64decode(b64_data))
            if os.path.exists(SESSION_DIR):
                import shutil
                shutil.rmtree(SESSION_DIR)
            with zipfile.ZipFile(SESSION_ZIP, 'r') as zip_ref:
                zip_ref.extractall(SESSION_DIR)
            print("✅ Session Ready.")
            return True
    except Exception as e: print(f"⚠️ Sync Error: {e}")
    return False

def sync_to_supabase():
    print("📤 Cloud par session save...")
    try:
        with zipfile.ZipFile(SESSION_ZIP, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(SESSION_DIR):
                for file in files:
                    zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), SESSION_DIR))
        with open(SESSION_ZIP, "rb") as f:
            b64_str = base64.b64encode(f.read()).decode('utf-8')
        supabase.table(TABLE_NAME).upsert({"id": 1, "session_data": b64_str}).execute()
        print("✅ Sync Success.")
    except Exception as e: print(f"⚠️ Sync Save Error: {e}")

# ==================== BOT LOGIC ====================

def run_bot():
    sync_from_supabase()
    
    options = Options()
    if os.path.exists(CHROME_BINARY):
        options.binary_location = CHROME_BINARY
        print("✅ Using custom Chrome binary")

    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-data-dir={SESSION_DIR}")
    
    # Version mismatch se bachne ke liye ye line zaruri hai
    options.add_argument("--remote-debugging-port=9222") 
    
    mobile = {"deviceName": "iPhone 12 Pro"}
    options.add_experimental_option("mobileEmulation", mobile)

    # UPDATED: Direct webdriver initialization
    print("🚀 Initializing Driver...")
    try:
        # Service() bina path ke latest installed driver use karega
        driver = webdriver.Chrome(options=options)
    except Exception as e:
        print(f"Driver init fail, trying fallback: {e}")
        # Agar fail ho toh system default try karein
        driver = webdriver.Chrome(options=options)

    try:
        driver.get("https://www.instagram.com/")
        time.sleep(10)

        if len(driver.find_elements(By.NAME, "username")) > 0:
            print("🔑 Logging in...")
            driver.find_element(By.NAME, "username").send_keys(INSTA_USER)
            driver.find_element(By.NAME, "password").send_keys(INSTA_PASS)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            time.sleep(15)

        # Gemini/Post Logic (Wahi purana)
        print("📸 Working on post...")
        # ... (Aapka posting ka baki code yahan) ...
        print("✅ Task finished.")

    except Exception as e: print(f"❌ Bot Error: {e}")
    finally:
        driver.quit()
        sync_to_supabase()

if __name__ == "__main__":
    run_bot()