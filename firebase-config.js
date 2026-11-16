(function () {
  'use strict';

  // =========================================================================
  // CONFIGURAZIONE FIREBASE (SOSTITUISCI I VALORI CON QUELLI DEL TUO PROGETTO)
  // =========================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyC7odD9lj009pNxo7ABaDd34-mL-EG1SR4",
    authDomain: "universum-online.firebaseapp.com",
    projectId: "universum-online",
    storageBucket: "universum-online.firebasestorage.app",
    messagingSenderId: "1040664766982",
    appId: "1:1040664766982:web:a2ff314468cf9b7d75b187"
  };

  if (typeof firebase === 'undefined') {
    console.warn('[Firebase] SDK Firebase non rilevato. Assicurati di aver incluso firebase-app-compat.js, firebase-auth-compat.js e firebase-firestore-compat.js in index.html.');
    window.fbAuth = null;
    window.fbDB = null;
    return;
  }

  const isPlaceholder = !firebaseConfig.apiKey || firebaseConfig.apiKey.startsWith('INCOLLA_QUI');
  if (isPlaceholder) {
    console.warn('[Firebase] Configurazione con segnaposto rilevata. Inserisci le chiavi reali in firebase-config.js per attivare il Multiplayer Online.');
  }

  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }

  window.fbAuth = firebase.auth();
  window.fbDB = firebase.firestore();
})();
