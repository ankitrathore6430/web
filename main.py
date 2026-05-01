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

# Render specific paths
SESSION_DIR = os.path.abspath("insta_profile")
SESSION_ZIP = "session.zip"
CHROME_BINARY = "/opt/render/project/src/.render/chrome/opt/google/chrome/google-chrome"

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
            print("✅ Session extracted locally.")
            return True
    except Exception as e: print(f"⚠️ Sync Fetch Error: {e}")
    return False

def sync_to_supabase():
    print("📤 Session sync ho raha hai Supabase par...")
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
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content("Give a highly detailed 1-sentence prompt for an AI image generator about spiritual Indian art or futuristic temples.")
        return response.text.strip()
    except:
        return "Beautiful futuristic Indian temple, digital art, 8k"

def download_ai_image(prompt):
    print(f"🎨 AI Image Generate ho rahi hai: {prompt}")
    img_url = f"https://pollinations.ai/p/{prompt.replace(' ', '_')}?width=1080&height=1080&nologo=true"
    r = requests.get(img_url)
    with open("upload.jpg", "wb") as f:
        f.write(r.content)
    return os.path.abspath("upload.jpg")

# ==================== MAIN BOT ====================

def run_bot():
    sync_from_supabase()
    
    options = Options()
    
    # Render environment settings
    if os.path.exists(CHROME_BINARY):
        options.binary_location = CHROME_BINARY
        print("✅ Custom Chrome Binary Found.")
    
    options.add_argument("--headless")
    options.add_argument("--no-sandbox")
    options.add_argument("--disable-dev-shm-usage")
    options.add_argument(f"--user-data-dir={SESSION_DIR}")
    
    # Mobile view is required for posting
    mobile = {"deviceName": "iPhone 12 Pro"}
    options.add_experimental_option("mobileEmulation", mobile)

    print("🚀 Browser start ho raha hai...")
    driver = webdriver.Chrome(service=Service(ChromeDriverManager().install()), options=options)

    try:
        driver.get("https://www.instagram.com/")
        time.sleep(10)

        # Login Check
        if len(driver.find_elements(By.NAME, "username")) > 0:
            print(f"🔑 Login needed for {INSTA_USER}...")
            driver.find_element(By.NAME, "username").send_keys(INSTA_USER)
            driver.find_element(By.NAME, "password").send_keys(INSTA_PASS)
            driver.find_element(By.XPATH, "//button[@type='submit']").click()
            time.sleep(15)

        # Post Process
        img_path = download_ai_image(generate_image_prompt())
        print("📸 Post upload process shuru...")
        
        driver.find_element(By.XPATH, "//*[@aria-label='New Post']").click()
        time.sleep(5)
        
        driver.find_element(By.XPATH, "//input[@type='file']").send_keys(img_path)
        time.sleep(8)
        
        for _ in range(2): # Click Next twice
            try:
                driver.find_element(By.XPATH, "//button[contains(text(), 'Next')]").click()
                time.sleep(5)
            except: pass
            
        driver.find_element(By.XPATH, "//button[contains(text(), 'Share')]").click()
        time.sleep(12)
        print("🚀 INSTAGRAM POST SUCCESSFUL!")

    except Exception as e:
        print(f"❌ Error: {e}")
    finally:
        driver.quit()
        sync_to_supabase()

if __name__ == "__main__":
    run_bot()