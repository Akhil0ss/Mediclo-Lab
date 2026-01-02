import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    GoogleAuthProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    updateProfile
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { 
    getDatabase, 
    ref, 
    set, 
    get, 
    push, 
    update, 
    remove, 
    onValue, 
    query, 
    orderByChild, 
    equalTo 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyAech8GbR2PVC7QGTu9hH9fGeRI0zdSX3M",
  authDomain: "mediklo.firebaseapp.com",
  databaseURL: "https://mediklo-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "mediklo",
  storageBucket: "mediklo.firebasestorage.app",
  messagingSenderId: "669991204399",
  appId: "1:669991204399:web:61a91590b94764a1fe78da",
  measurementId: "G-JW6LDL7ET1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);
const googleProvider = new GoogleAuthProvider();

export { 
    auth, 
    database, 
    googleProvider, 
    signInWithPopup, 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut,
    updateProfile,
    ref, 
    set, 
    get, 
    push, 
    update, 
    remove, 
    onValue, 
    query, 
    orderByChild, 
    equalTo 
};
