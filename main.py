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
from webdriver_manager.chrome import ChromeDriverManager
from selenium.webdriver.common.by import By

# ==================== CREDENTIALS ====================
GEMINI_API_KEY = "AIzaSyBCCLrI980bUCzu59w354-1PxWbNs0IJSk"
INSTA_USER = "jai_siya_ram_63"
INSTA_PASS = "Ankit6430"

# Supabase Config
SUPABASE_URL = "https://gjtryzfzennstnqhafcw.supabase.co"
SUPABASE_KEY = "sb_publishable_pWkPwVuA7eXcA2KpLwPAoA_GfrFrOni"
TABLE_NAME = "instagram_sessions"

# Paths
SESSION_DIR = os.path.abspath("insta_profile")
SESSION_ZIP = "session.zip"

# Initialize Clients
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# ==================== SYNC LOGIC ====================

def sync_from_supabase():
    print("🔄 Cloud se session download ho raha hai...")
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
            print("✅ Session active!")
            return True
    except Exception as e: print(f"⚠️ Sync Fetch Error: {e}")
    return False

def sync_to_supabase():
    print("📤 Session Supabase par save ho raha hai...")
    try:
        with zipfile.ZipFile(SESSION_ZIP, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, _, files in os.walk(SESSION_DIR):
                for file in files:
                    zipf.write(os.path.join(root, file), os.path.relpath(os.path.join(root, file), SESSION_DIR))
        with open(SESSION_ZIP, "rb") as f:
            b64_str = base64.b64encode(f.read()).decode('utf-8')
        supabase.table(TABLE_NAME).upsert({"id": 1, "session_data": b64_str}).execute()
        print("✅ Cloud sync complete.")
    except Exception as e: print(f"⚠️ Sync Save Error: {e}")

# ==================== AI GENERATION ====================

def generate_image_prompt():
    # Gemini se ek creative prompt likhwana
    model = genai.GenerativeModel('gemini-pro')
    response = model.generate_content("Give a highly detailed 1-sentence prompt for an AI image generator about spiritual Indian art or futuristic temples.")
    return response.text if response.text else "Spiritual Indian temple in futuristic neon style"

def download_ai_image(prompt):
    print(f"🎨 Generating Image: {prompt}")
    # Pollinations ka use jo Gemini ke prompt ko image mein badal dega
    img_url = f"https://pollinations.ai/p/{prompt.replace(' ', '_')}?width=1080&height=1080&nologo=true"
    r = requests.get(img_url)
    with open("upload.jpg", "wb") as f:
        f.write(r.content)
    return os.path.abspath("upload.jpg")

# ==================== INSTAGRAM BOT ====================

def run_bot():
    sync_from_supabase()
    
    options = Options()
    if 'RENDER' in os.environ: options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-data-dir={SESSION_DIR}")
    
    # Mobile emulation to enable upload button
    mobile = {"deviceName": "iPhone 12 Pro"}
    options.add_experimental_option("mobileEmulation", mobile)

    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    try:
        driver.get("https://www.instagram.com/")
        time.sleep(10)

        # Login check
        if len(driver.find_elements(By.NAME, "username")) > 0:
            print("🔑 Logging in as", INSTA_USER)
            driver.find_element(By.NAME, "username").send_keys(INSTA_USER)
            driver.find_element(By.NAME, "password").send_keys(INSTA_PASS)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            time.sleep(15)

        # AI Image Process
        prompt = generate_image_prompt()
        img_path = download_ai_image(prompt)

        # Post Process
        print("📸 Posting...")
        driver.find_element(By.XPATH, "//*[@aria-label='New Post']").click()
        time.sleep(4)
        
        driver.find_element(By.XPATH, "//input[@type='file']").send_keys(img_path)
        time.sleep(6)
        
        # Click through Next/Share
        for _ in range(2):
            driver.find_element(By.XPATH, "//button[contains(text(), 'Next')]").click()
            time.sleep(4)
            
        driver.find_element(By.XPATH, "//button[contains(text(), 'Share')]").click()
        time.sleep(10)
        print("🚀 Instagram Post Success!")

    except Exception as e: print(f"❌ Error: {e}")
    finally:
        driver.quit()
        sync_to_supabase()

if __name__ == "__main__":
    run_bot()
