import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';

const firebaseConfig = {
  projectId: "imposing-scarab-qds98",
  appId: "1:797978938177:web:ae5a798f95c8d344deafc0",
  apiKey: "AIzaSyB5soEHJUzPvR0NK1_oSUMvt54RnYmWKQs",
  authDomain: "imposing-scarab-qds98.firebaseapp.com",
  storageBucket: "imposing-scarab-qds98.firebasestorage.app",
  messagingSenderId: "797978938177",
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "ai-studio-9e1dde61-a465-4835-995b-966f326732a2");
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { app, db, auth, googleProvider, signInWithPopup, signOut };
