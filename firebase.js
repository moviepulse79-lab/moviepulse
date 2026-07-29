import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDEXUiLXQvM4Z1aN1H_6CR5WMMxfcrsPY0",
  authDomain: "moviepulse-21121.firebaseapp.com",
  projectId: "moviepulse-21121",
  storageBucket: "moviepulse-21121.firebasestorage.app",
  messagingSenderId: "394594918212",
  appId: "1:394594918212:web:6017455852a7abfd198111"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);

export { db };
