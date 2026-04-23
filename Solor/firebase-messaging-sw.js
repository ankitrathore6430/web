importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// Initialize the Firebase app in the service worker
firebase.initializeApp({
    apiKey: "AIzaSyA3pH_dnb6_--wRoDSuoj-TAudsmJ7D4R0",
    authDomain: "solor-energy.firebaseapp.com",
    projectId: "solor-energy",
    storageBucket: "solor-energy.firebasestorage.app",
    messagingSenderId: "772737546715",
    appId: "1:772737546715:web:3736545b464523bdc04ffe"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/icon.png', // You can change this to your app icon path
        badge: '/icon.png'
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});