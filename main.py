import re
from pyrogram import Client, filters
from pyrogram.errors import SessionPasswordNeeded

# Telegram Official Android App Credentials
API_ID = 6
API_HASH = "eb06d4abfb49dc3eeb1aeb98ae0f581e"

# Aapka Bot Token
BOT_TOKEN = "8328669216:AAHPMCAVNRQQj95kIF0WSWmE7rmncuz8QvA"

# Main bot client
app = Client(
    "my_auto_login_bot", 
    api_id=API_ID, 
    api_hash=API_HASH, 
    bot_token=BOT_TOKEN
)

# Temporary dictionary (Database ki jagah)
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
    
    # --- STEP 1: Phone Number Handle Karna ---
    if step == "phone":
        phone = message.text
        
        # User client me official app jaisi device details daalna zaruri hai
        user_client = Client(
            f"session_{user_id}", 
            api_id=API_ID, 
            api_hash=API_HASH, 
            in_memory=True,
            device_model="Samsung Galaxy S23",
            system_version="Android 14",
            app_version="Telegram 10.6.1",
            lang_code="en"
        )
        await user_client.connect()
        
        try:
            sent_code = await user_client.send_code(phone)
            login_data[user_id] = {
                "step": "otp",
                "phone": phone,
                "phone_code_hash": sent_code.phone_code_hash,
                "user_client": user_client
            }
            await message.reply(
                "OTP bhej diya gaya hai! 📩\n\n"
                "Kripya OTP ko **HELLO** ke sath bhejen.\n"
                "Example: Agar OTP 12345 hai, toh **HELLO12345** likh kar bhejen."
            )
        except Exception as e:
            await message.reply(f"❌ Error aaya: {e}")
            login_data.pop(user_id, None)
            
    # --- STEP 2: OTP (Hello12345) Handle Karna ---
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
            await message.reply(f"Login Successful! ✅\n\nYeh raha aapka Session String (Ise secure rakhein):\n\n`{session_string}`")
            
            await user_client.disconnect()
            login_data.pop(user_id, None)
            
        except SessionPasswordNeeded:
            login_data[user_id]["step"] = "password"
            await message.reply("Is account par 2-Step Verification (Password) laga hai. 🔐\nKripya apna password bhejen:")
            
        except Exception as e:
            await message.reply(f"❌ Login failed: {e}")
            await user_client.disconnect()
            login_data.pop(user_id, None)

    # --- STEP 3: 2FA Password Handle Karna ---
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
    print("Bot is running...")
    app.run()