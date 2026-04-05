// ==================== UPDATED AUTH LOGIC ====================
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('regName').value;
            const phone = document.getElementById('regPhone').value;
            const pass = document.getElementById('regPassword').value;
            const conf = document.getElementById('regConfirm').value;
            const ref = document.getElementById('regReferral').value.trim();

            if(pass !== conf) return showToast('Passwords do not match', 'error');
            if(phone.length !== 10) return showToast('Invalid phone number', 'error');

            showLoading('Sending WhatsApp OTP...');
            
            // Check if user exists
            const snap = await database.ref('users').orderByChild('phone').equalTo(phone).once('value');
            if(snap.exists()) { hideLoading(); return showToast('Phone already registered', 'error'); }

            generatedOTP = Math.floor(100000 + Math.random() * 900000);

            try {
                // Call Render API
                const response = await fetch(`${WA_API_URL}/send-otp?phone=${phone}&otp=${generatedOTP}&key=${WA_API_KEY}`, {
                    method: 'GET',
                    mode: 'cors',
                    cache: 'no-cache'
                });
                
                const result = await response.json();

                if(result.status === "success") {
                    tempUserData = { name, phone, pass, ref };
                    hideLoading();
                    document.getElementById('regStep1').classList.add('hidden');
                    document.getElementById('regStep2').classList.remove('hidden');
                    document.getElementById('otpPhoneDisplay').textContent = phone;
                } else {
                    throw new Error(result.message || "Failed to send");
                }
            } catch (err) {
                hideLoading();
                showToast('WhatsApp Server Offline. Link your number first.', 'error');
                console.error(err);
            }
        });