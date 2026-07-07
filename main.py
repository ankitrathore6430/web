import asyncio
import re
import os
import threading
from flask import Flask

# ==========================================
# 1. DUMMY WEB SERVER (Render Deploy Bypass)
# ==========================================
web_app = Flask(__name__)

@web_app.route('/')
def home():
    return "Telegram Bot is Running Successfully! 🚀"

def run_web_server():
    port = int(os.environ.get("PORT", 8080))
    web_app.run(host="0.0.0.0", port=port)

threading.Thread(target=run_web_server, daemon=True).start()


# ==========================================
# 2. BUG FIX FOR RENDER (Python 3.12+)
# ==========================================
try:
    asyncio.get_event_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

from pyrogram import Client, filters
from pyrogram.errors import SessionPasswordNeeded, FloodWait


# ==========================================
# 3. TELEGRAM BOT MAIN LOGIC
# ==========================================

# ⚠️ YAHAN APNA API ID AUR HASH DALEIN (my.telegram.org se)
API_ID = 12345678  # Ise Integer me likhein (Quotes me nahi)
API_HASH = "your_actual_api_hash_here"

BOT_TOKEN = "8328669216:AAHPMCAVNRQQj95kIF0WSWmE7rmncuz8QvA"

app = Client("my_auto_login_bot", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN)

login_data = {}

@app.on_message(filters.command("login") & filters.private)
async def login_start(client, message):
    user_id = message.from_user.id
    login_data[user_id] = {"step": "phone"}
    await message.reply("Kripya apna phone number country code ke sath bhejen\n(Jaise: +919876543210):")

@app.on_message(filters.text & filters.private)
async def process_login(client, message):
    user_id = message.from_user.id
    
    if user_id not in login_data:
        return
    
    step = login_data[user_id].get("step")
    
    if step == "phone":
        phone = message.text
        
        # Ab hum normal Custom API login use kar rahe hain (Device model hata diya)
        user_client = Client(
            f"session_{user_id}", 
            api_id=API_ID, 
            api_hash=API_HASH, 
            in_memory=True
        )
        await user_client.connect()
        
        try:
            # OTP bhejne ki koshish
            await message.reply("OTP bhej raha hu, kripya wait karein... ⏳")
            sent_code = await user_client.send_code(phone)
            
            login_data[user_id] = {
                "step": "otp",
                "phone": phone,
                "phone_code_hash": sent_code.phone_code_hash,
                "user_client": user_client
            }
            await message.reply(
                "✅ OTP aapke Telegram App par bhej diya gaya hai!\n\n"
                "Kripya OTP ko **HELLO** ke sath bhejen.\n"
                "Example: Agar OTP 12345 hai, toh **HELLO12345** likh kar bhejen."
            )
            
        except FloodWait as e:
            await message.reply(f"❌ Telegram ne is number par limit laga di hai. {e.value} seconds baad try karein.")
            login_data.pop(user_id, None)
            
        except Exception as e:
            await message.reply(f"❌ OTP bhejne me error aaya: {e}\n(Yeh error Telegram ki taraf se hai)")
            login_data.pop(user_id, None)
            
    elif step == "otp":
        user_client = login_data[user_id]["user_client"]
        phone = login_data[user_id]["phone"]
        phone_code_hash = login_data[user_id]["phone_code_hash"]
        
        extracted_numbers = re.findall(r'\d+', message.text)
        if not extracted_numbers:
            await message.reply("Galat format! Kripya HELLO ke sath OTP bhejen (Jaise: HELLO12345).")
            return
        
        otp_code = "".join(extracted_numbers)
        
        try:
            await user_client.sign_in(phone, phone_code_hash, otp_code)
            session_string = await user_client.export_session_string()
            await message.reply(f"Login Successful! ✅\n\nYeh raha aapka Session String:\n\n`{session_string}`")
            
            await user_client.disconnect()
            login_data.pop(user_id, None)
            
        except SessionPasswordNeeded:
            login_data[user_id]["step"] = "password"
            await message.reply("Is account par 2-Step Verification (Password) laga hai. 🔐\nKripya apna password bhejen:")
            
        except Exception as e:
            await message.reply(f"❌ Login failed: {e}")
            await user_client.disconnect()
            login_data.pop(user_id, None)

    elif step == "password":
        user_client = login_data[user_id]["user_client"]
        password = message.text
        
        try:
            await user_client.check_password(password)
            session_string = await user_client.export_session_string()
            await message.reply(f"Login Successful! ✅\n\nYeh raha aapka Session String:\n\n`{session_string}`")
            
            await user_client.disconnect()
            login_data.pop(user_id, None)
            
        except Exception as e:
            await message.reply(f"❌ Password galat hai ya error aaya: {e}")
            await user_client.disconnect()
            login_data.pop(user_id, None)

if __name__ == "__main__":
    print("Bot is ready!")
    app.run()