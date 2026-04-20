// firebase-messaging-sw.js

// Firebase ki required libraries import kar rahe hain (Version 9 compat)
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Aapka Solor Energy ka Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyA3pH_dnb6_--wRoDSuoj-TAudsmJ7D4R0",
    authDomain: "solor-energy.firebaseapp.com",
    projectId: "solor-energy",
    storageBucket: "solor-energy.firebasestorage.app",
    messagingSenderId: "772737546715",
    appId: "1:772737546715:web:3736545b464523bdc04ffe"
};

// Firebase initialize karna
firebase.initializeApp(firebaseConfig);

// Messaging service start karna
const messaging = firebase.messaging();

// Background me notification receive karne ka code
messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message received: ', payload);
    
    // Notification ka title aur body set karna
    const notificationTitle = payload.notification.title || "Solor Energy";
    const notificationOptions = {
        body: payload.notification.body || "Aapke liye ek naya update hai.",
        // Aap yahan apne app ke logo/icon ka URL daal sakte hain
        icon: 'https://cdn-icons-png.flaticon.com/512/3073/3073354.png' 
    };

    // User ke screen par notification show karna
    return self.registration.showNotification(notificationTitle, notificationOptions);
});
