// CORRECTION : "import" doit être en minuscules
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, increment, arrayUnion, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 1. CONFIGURATION FIREBASE (Vos clés sont bien intégrées)
const firebaseConfig = {
    apiKey: "AIzaSyAwSc_AfalR4oOxr2sjjVFFkk1DOFOvqac",
    authDomain: "cashmoney-app-f1da8.firebaseapp.com",
    projectId: "cashmoney-app-f1da8",
    storageBucket: "cashmoney-app-f1da8.firebasestorage.app",
    messagingSenderId: "49729997311",
    appId: "1:49729997311:web:edecf7413407e27d0c3fca",
    measurementId: "G-VPZTHX5RN1"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Email administrateur
const MY_ADMIN_EMAIL = "gedeon.yah45@gmail.com"; 

// --- AUTHENTIFICATION ---
window.toggleAuth = () => {
  document.getElementById('loginCard').classList.toggle('hidden');
  document.getElementById('registerCard').classList.toggle('hidden');
};

window.register = async () => {
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPass').value;
  const phone = document.getElementById('regPhone').value;

  const urlParams = new URLSearchParams(window.location.search);
  const referralId = urlParams.get('ref');

  if(!name || !email || !pass) return alert("Veuillez remplir les champs.");

  try {
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const newUserUid = res.user.uid;

    await setDoc(doc(db, "users", newUserUid), {
      fullName: name,
      email: email,
      phone: phone,
      balance: 0,
      referralCount: 0,
      referredBy: referralId || null,
      history: []
    });

    if (referralId) {
      const referrerRef = doc(db, "users", referralId);
      await updateDoc(referrerRef, {
        balance: increment(1100),
        referralCount: increment(1),
        history: arrayUnion({
          type: "Bonus Parrainage",
          amount: 1100,
          date: new Date().toLocaleDateString()
        })
      });
    }

    alert("Compte CA$HMONEY créé avec succès !");
  } catch (e) { 
    alert("Erreur d'inscription : " + e.message); 
  }
};

window.login = async () => {
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  try { 
    await signInWithEmailAndPassword(auth, email, pass); 
  } catch (e) { 
    alert("Erreur de connexion : " + e.message); 
  }
};

onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById('authSection').classList.add('hidden');
    document.getElementById('dashboardSection').classList.remove('hidden');
    document.getElementById('logoutBtn').classList.remove('hidden');
    loadUserData(user.uid);
    
    if(user.email === MY_ADMIN_EMAIL) {
      document.getElementById('adminSection').classList.remove('hidden');
      loadAdminData();
    }
  } else {
    document.getElementById('authSection').classList.remove('hidden');
    document.getElementById('dashboardSection').classList.add('hidden');
    document.getElementById('adminSection').classList.add('hidden');
    document.getElementById('logoutBtn').classList.add('hidden');
  }
});

// --- LOGIQUE UTILISATEUR ---
async function loadUserData(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (snap.exists()) {
    const data = snap.data();
    document.getElementById('userNameDisplay').innerText = data.fullName;
    document.getElementById('balanceDisplay').innerText = data.balance;
    document.getElementById('refCount').innerText = data.referralCount;
    
    const currentUrl = window.location.origin + window.location.pathname;
    document.getElementById('referralLink').innerText = `${currentUrl}?ref=${uid}`;

    if (data.referralCount >= 2) {
      const btn = document.getElementById('withdrawBtn');
      btn.disabled = false; 
      btn.style.backgroundColor = "#2563eb";
      btn.style.cursor = "pointer";
      document.getElementById('withdrawHint').innerText = "Retrait débloqué !";
      document.getElementById('withdrawHint').style.color = "green";
    }
  }
}

window.completeTask = async (taskId) => {
  const user = auth.currentUser;
  const userRef = doc(db, "users", user.uid);
  await updateDoc(userRef, { 
    balance: increment(50), 
    history: arrayUnion({ 
      type: "Mission " + taskId, 
      amount: 50, 
      date: new Date().toLocaleDateString() 
    }) 
  });
  alert("+50 FCFA crédités !"); 
  loadUserData(user.uid);
};

window.requestWithdrawal = async () => {
  const num = prompt("Entrez votre numéro Moov ou T-Money pour le retrait :");
  if (!num) return;
  
  const user = auth.currentUser;
  const userRef = doc(db, "users", user.uid);
  const snap = await getDoc(userRef);
  const bal = snap.data().balance;
  
  if (bal <= 0) return alert("Votre solde est vide.");

  await addDoc(collection(db, "withdrawals"), { 
    uid: user.uid, 
    userName: snap.data().fullName,
    amount: bal, 
    phone: num, 
    status: "En attente", 
    date: new Date().toISOString() 
  });

  await updateDoc(userRef, { balance: 0 });
  alert("Demande envoyée !"); 
  loadUserData(user.uid);
};

window.shareWhatsApp = () => {
  const link = document.getElementById('referralLink').innerText;
  const text = `Gagne de l'argent chaque jour sur CA$HMONEY ! Inscris-toi ici : ${link}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`);
};

// --- LOGIQUE ADMIN ---
async function loadAdminData() {
  try {
    const usersSnap = await getDocs(collection(db, "users"));
    let userHtml = "";
    usersSnap.forEach(d => { 
      const u = d.data(); 
      userHtml += `<tr><td>${u.fullName || 'Anonyme'}</td><td>${u.balance || 0} F</td></tr>`; 
    });
    document.getElementById('adminUserList').innerHTML = userHtml || "<tr><td colspan='2'>Aucun utilisateur</td></tr>";

    const q = query(collection(db, "withdrawals"), where("status", "==", "En attente"));
    const withdrawSnap = await getDocs(q);
    let wHtml = "";
    withdrawSnap.forEach(d => { 
      const w = d.data(); 
      wHtml += `<tr><td>${w.amount}F</td><td>${w.phone}</td><td><button onclick="approveW('${d.id}')" class="btn-validate">Valider</button></td></tr>`; 
    });
    document.getElementById('adminWithdrawList').innerHTML = wHtml || "<tr><td colspan='3'>Aucune demande</td></tr>";
  } catch (err) {
    console.error("Erreur Admin:", err);
  }
}

window.approveW = async (id) => {
  if(confirm("Confirmez-vous avoir payé cet utilisateur ?")) {
    await updateDoc(doc(db, "withdrawals", id), { status: "Payé" });
    alert("Retrait validé !"); 
    loadAdminData();
  }
};

window.showAdminTab = (t) => {
  document.getElementById('adminUsersTab').classList.toggle('hidden', t !== 'users');
  document.getElementById('adminWithdrawTab').classList.toggle('hidden', t !== 'withdrawals');
  document.getElementById('tabUsersBtn').classList.toggle('active', t === 'users');
  document.getElementById('tabWithdrawBtn').classList.toggle('active', t === 'withdrawals');
};

document.getElementById('logoutBtn').onclick = () => signOut(auth);
