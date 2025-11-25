// Firebase imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ---- 🔑 REPLACE THIS WITH YOUR FIREBASE CONFIG ----
const firebaseConfig = {
    apiKey: "AIzaSyCZ1jrvtalcFwDHTicciBqSYErrQVaQXNU",
    authDomain: "shibily-ac48d.firebaseapp.com",
    projectId: "shibily-ac48d",
    storageBucket: "shibily-ac48d.firebasestorage.app",
    messagingSenderId: "55312642164",
    appId: "1:55312642164:web:ae54cb17f9436b28b96121"
  };
// -----------------------------------------------------

// Initialize Firebase
const appFirebase = initializeApp(firebaseConfig);
const auth = getAuth(appFirebase);
const db = getFirestore(appFirebase);
const PUBLIC_COLLECTION_PATH = "auto_parts";

export const app = {
    parts: [],
    filteredParts: [],
    searchQuery: '',
    currentEditId: null,
    
    initFirebase() {
        // Sign in anonymously
        signInAnonymously(auth).catch(err => console.error("Auth Error:", err));
        onAuthStateChanged(auth, (user) => {
            if (user) {
                document.getElementById('user-id').textContent = user.uid;
                this.setupRealtimeListener();
            } else {
                document.getElementById('user-id').textContent = "Anonymous";
            }
        });
    },

    setupRealtimeListener() {
        const partsCollection = collection(db, PUBLIC_COLLECTION_PATH);
        onSnapshot(partsCollection, snapshot => {
            const newParts = [];
            snapshot.forEach(doc => {
                newParts.push({ id: doc.id, ...doc.data() });
            });
            this.parts = newParts;
            this.filterParts();
            document.getElementById('loading-indicator').style.display = 'none';
        });
    },

    handleSearch(query) {
        this.searchQuery = query.toLowerCase().trim();
        this.filterParts();
    },

    filterParts() {
        if (!this.searchQuery) {
            this.filteredParts = [...this.parts];
        } else {
            this.filteredParts = this.parts.filter(p =>
                (p.name || '').toLowerCase().includes(this.searchQuery) ||
                (p.zorenNo || '').toLowerCase().includes(this.searchQuery) ||
                (p.oemNo || '').toLowerCase().includes(this.searchQuery) ||
                (p.applications || '').toLowerCase().includes(this.searchQuery) ||
                (p.carMaker || '').toLowerCase().includes(this.searchQuery)
            );
        }
        this.renderParts(this.filteredParts);
    },

    renderParts(parts) {
        const list = document.getElementById('parts-list');
        list.innerHTML = '';
        if (parts.length === 0) {
            list.innerHTML = `<div class="md:col-span-2 text-center p-12 bg-white rounded-xl shadow-inner text-gray-500">
                <p class="mt-4 text-xl font-semibold">No Parts Found</p>
            </div>`;
            return;
        }

        const isSingleResult = parts.length === 1;

        parts.forEach(part => {
            const oemTags = (part.oemNo || '').split(',').map(tag => tag.trim()).filter(Boolean)
                .map(tag => `<span class="inline-block bg-gray-200 text-gray-800 text-xs font-medium mr-1 mb-1 px-3 py-1 rounded-full whitespace-nowrap">${tag}</span>`).join('');

            const missingTag = (!part.zorenNo || !part.oemNo) ? `<span class="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full text-yellow-800 bg-yellow-100">Missing Data</span>` : '';

            const card = document.createElement('div');
            card.className = isSingleResult ? 'md:col-span-2 bg-indigo-50 border-4 border-indigo-400/70 rounded-2xl shadow-2xl p-6' : 'bg-white rounded-xl shadow-lg p-6 border border-gray-100';

            card.innerHTML = `
                <div class="flex justify-between items-start mb-4">
                    <div>
                        <h3 class="text-xl font-bold text-gray-900">${part.name || 'N/A'}</h3>
                        <p class="text-sm ${isSingleResult ? 'text-indigo-800 font-bold' : 'text-indigo-600 font-medium'}">ZOREN NO: #${part.zorenNo || 'N/A'}</p>
                    </div>
                    ${missingTag}
                </div>
                <div class="mb-4 p-4 rounded-lg ${isSingleResult ? 'bg-indigo-100/50' : 'bg-gray-50'} border border-gray-200">
                    <div class="mb-3 border-b border-gray-200 pb-2">
                        <span class="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">OEM NO:</span>
                        <div class="flex flex-wrap gap-1">${oemTags || '<span class="font-semibold text-gray-500">N/A</span>'}</div>
                    </div>
                    <div class="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                        <div class="font-medium text-gray-700">Car Maker:</div>
                        <div class="font-semibold text-right">${part.carMaker || 'N/A'}</div>
                    </div>
                </div>
                <div class="mb-4">
                    <span class="block text-xs font-medium text-gray-700 uppercase tracking-wider mb-1">Applications:</span>
                    <p class="text-sm text-gray-600 border-l-2 border-indigo-400 pl-3 italic break-words">${part.applications || 'No application data provided.'}</p>
                </div>
                <div class="grid grid-cols-2 gap-3 text-sm mb-6 pt-4 border-t border-gray-200">
                    <div class="font-medium text-gray-700">Price:</div>
                    <div class="font-bold text-green-700 text-right">$${(part.price || 0).toFixed(2)}</div>
                    <div class="font-medium text-gray-700">Stock:</div>
                    <div class="font-bold text-right ${part.stock > 10 ? 'text-green-600' : part.stock > 0 ? 'text-yellow-600' : 'text-red-600'}">${part.stock || 0} units</div>
                </div>
                <div class="flex gap-3">
                    <button onclick="app.openEditModal('${part.id}')"
                        class="flex-1 px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-600 transition duration-150 text-sm">
                        Edit
                    </button>
                    <button onclick="app.deletePart('${part.id}', '${part.name}')"
                        class="flex-1 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition duration-150 text-sm">
                        Delete
                    </button>
                </div>
            `;

            list.appendChild(card);
        });
    },

    showMessage(message, type='success') {
        const box = document.getElementById('message-box');
        const content = box.querySelector('div');
        content.className = type === 'error' ? 'bg-red-600 text-white p-4 rounded-lg shadow-xl font-semibold' : 'bg-green-600 text-white p-4 rounded-lg shadow-xl font-semibold';
        content.textContent = message;
        box.classList.remove('opacity-0', 'pointer-events-none');
        box.classList.add('opacity-100');
        setTimeout(() => box.classList.remove('opacity-100'), 4000);
    },

    // ------------------- CRUD -------------------

    async openEditModal(id) {
        alert("Edit/Add modal should be implemented here (like your original code).");
    },

    async deletePart(id, name) {
        if (!confirm(`Are you sure to delete ${name}?`)) return;
        await deleteDoc(doc(db, PUBLIC_COLLECTION_PATH, id));
        this.showMessage(`Part '${name}' deleted`, 'success');
    },

    openJsonModal() { alert("JSON bulk modal should be implemented here."); }

};

// Initialize
window.app = app;
window.onload = () => app.initFirebase();

