import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXM4yJgh9F7ajGQApB-Ux1itQ_3pkik_o",
  authDomain: "borsin-tenun-app.firebaseapp.com",
  projectId: "borsin-tenun-app",
  storageBucket: "borsin-tenun-app.firebasestorage.app",
  messagingSenderId: "718889934564",
  appId: "1:718889934564:web:c28a073e261d6783d096f1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
