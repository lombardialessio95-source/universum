// =========================================================
// UNIVERSUM - CONFIGURAZIONE FIREBASE (MULTIPLAYER)
// =========================================================

const firebaseConfig = {
  apiKey: "AIzaSyC7odD9lj009pNxo7ABaDd34-mL-EG1SR4",
  authDomain: "universum-online.firebaseapp.com",
  projectId: "universum-online",
  storageBucket: "universum-online.firebasestorage.app",
  messagingSenderId: "1040664766982",
  appId: "1:1040664766982:web:a2ff314468cf9b7d75b187"
};

if (typeof firebase !== "undefined") {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
  }
  window.fbAuth = firebase.auth();
  window.fbDB = firebase.firestore();
} else {
  console.error("SDK Firebase non caricato. Verifica i tag script in index.html.");
}
