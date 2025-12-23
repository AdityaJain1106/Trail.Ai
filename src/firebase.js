import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from "firebase/auth";

// 🔁 Paste YOUR config from Firebase console here:
const firebaseConfig = {
  apiKey: "AIzaSyDqQ7KVQpqJG42NE-48oLl_xvD2bgnjVGI",
  authDomain: "trial-0010.firebaseapp.com",
  projectId: "trial-0010",
  storageBucket: "trial-0010.firebasestorage.app",
  messagingSenderId: "243235933356",
  appId: "1:243235933356:web:027dd24a41fb9be23c2309",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

const db = getFirestore(app);


export {
  auth,
  provider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  db,
};
