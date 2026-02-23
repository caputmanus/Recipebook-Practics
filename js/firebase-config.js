import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBcECqBxffKx2carNinZ24N06HqRQbOK3g",
  authDomain: "recipebook-4c8b5.firebaseapp.com",
  projectId: "recipebook-4c8b5",
  storageBucket: "recipebook-4c8b5.firebasestorage.app",
  messagingSenderId: "100648185989",
  appId: "1:100648185989:web:06776dcc37b7907784f9ec",
  measurementId: "G-GNFRYYNQXS"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
