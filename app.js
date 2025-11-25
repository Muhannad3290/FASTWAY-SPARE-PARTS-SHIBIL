// Import Firebase modules
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, setLogLevel } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Global variables provided by the Canvas environment (assumed to be available in the global scope from index.html)
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let appInstance = null;
let db = null;
let auth = null;
let userId = null;
let isAuthReady = false;

// Constants for Firestore paths
const PUBLIC_COLLECTION_PATH = `/artifacts/${appId}/public/data/auto_parts`;

const App = {
    parts: [],
    filteredParts: [],
    searchQuery: '',
    currentEditId: null,
    
    /**
     * Initializes Firebase and sets up the authentication state listener.
     */
    async initFirebase() {
        try {
            // Set logging for debugging
            setLogLevel('Debug');
            
            appInstance = initializeApp(firebaseConfig);
            db = getFirestore(appInstance);
            auth = getAuth(appInstance);

            // --- BEGIN RESILIENT AUTHENTICATION LOGIC ---
            let authSuccessful = false;
            
            // 1. Attempt custom token sign-in first (if token is available)
            if (initialAuthToken) {
                try {
                    await signInWithCustomToken(auth, initialAuthToken);
                    authSuccessful = true;
                } catch (tokenError) {
                    console.warn("Custom token sign-in failed. Attempting anonymous sign-in instead. Error details:", tokenError.message);
                    // Do not throw here; continue to anonymous sign-in below.
                }
            }
            
            // 2. Fall back to anonymous sign-in if custom token failed or wasn't present
            if (!authSuccessful) {
                await signInAnonymously(auth);
            }
            // --- END RESILIENT AUTHENTICATION LOGIC ---


            // Listen for auth state changes (This will fire immediately after successful sign-in)
            onAuthStateChanged(auth, (user) => {
                if (user) {
                    userId = user.uid;
                    document.getElementById('user-id').textContent = userId;
                    isAuthReady = true;
                    this.setupRealtimeListener();
                } else {
                    // Should not happen if signInAnonymously is successful, but handles logout/failure
                    document.getElementById('user-id').textContent = 'Anonymous/Unknown';
                    isAuthReady = false;
                    this.renderParts([]); // Clear list on auth failure
                }
            });

        } catch (error) {
            // This block catches serious errors like Firebase initialization or final anonymous sign-in failure.
            this.showMessage(`Firebase initialization failed: ${error.message}`, 'error');
            console.error("Firebase init error:", error);
            document.getElementById('user-id').textContent = 'Error';
        }
    },

    /**
     * Sets up the real-time listener for the Firestore collection.
     */
    setupRealtimeListener() {
        if (!db || !isAuthReady) {
            console.warn("Firestore or Auth not ready. Skipping real-time listener setup.");
            return;
        }

        const partsCollection = collection(db, PUBLIC_COLLECTION_PATH);
        
        // Use onSnapshot for real-time updates
        onSnapshot(partsCollection, (snapshot) => {
            const newParts = [];
            snapshot.forEach(doc => {
                newParts.push({ id: doc.id, ...doc.data() });
            });
            this.parts = newParts;
            this.filterParts(); // Re-filter on any data change
            document.getElementById('loading-indicator').style.display = 'none';
        }, (error) => {
            this.showMessage(`Error fetching data: ${error.message}`, 'error');
            console.error("Firestore snapshot error:", error);
            document.getElementById('loading-indicator').textContent = 'Error loading data.';
        });
    },

    /**
     * Filters the parts based on the search query, now including new fields.
     */
    filterParts() {
        const query = this.searchQuery.toLowerCase().trim();
        if (!query) {
            this.filteredParts = [...this.parts];
        } else {
            this.filteredParts = this.parts.filter(part => 
                (part.name || '').toLowerCase().includes(query) || 
                (part.zorenNo || '').toLowerCase().includes(query) ||
                (part.oemNo || '').toLowerCase().includes(query) ||
                (part.applications || '').toLowerCase().includes(query) ||
                (part.carMaker || '').toLowerCase().includes(query)
            );
        }
        this.renderParts(this.filteredParts);
    },

    /**
     * Handles input from the search box.
     * @param {string} value - The current search input value.
     */
    handleSearch(value) {
        this.searchQuery = value;
        this.filterParts();
    },

    /**
     * Renders the list of parts cards, updated to display new fields and handle single result view.
     * @param {Array<Object>} partsToRender - Array of parts objects to display.
     */
    renderParts(partsToRender) {
        const list = document.getElementById('parts-list');
        list.innerHTML = ''; // Clear previous content

        if (partsToRender.length === 0) {
            list.innerHTML = `
                <div class="md:col-span-2 text-center p-12 bg-white rounded-xl shadow-inner text-gray-500">
                    <svg class="mx-auto w-16 h-16 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2m-7 13h5M10 17h4"></path></svg>
                    <p class="mt-4 text-xl font-semibold">No Parts Found</p>
                    <p class="mt-2 text-sm">Try a different search query or use the "Add New Part" button.</p>
                </div>
            `;
            return;
        }

        // Check for single result to apply special, separate styling
        const isSingleResult = partsToRender.length === 1;

        partsToRender.forEach(part => {
            // --- OEM TAGS GENERATION ---
            const oemTags = (part.oemNo || '')
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag)
                .map(tag => `<span class="inline-block bg-gray-200 text-gray-800 text-xs font-medium mr-1 mb-1 px-3 py-1 rounded-full whitespace-nowrap">${tag}</span>`)
                .join('');

            const oemDisplay = oemTags || '<span class="font-semibold text-gray-500">N/A</span>';
            // ---------------------------

            const card = document.createElement('div');
            
            let cardClasses = 'bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden border border-gray-100';

            if (isSingleResult) {
                // Apply prominent, full-width styling for the 'separate option' view
                cardClasses = 'md:col-span-2 bg-indigo-50 border-4 border-indigo-400/70 rounded-2xl shadow-2xl transition-all duration-300 overflow-hidden';
            }
            
            // Apply common classes to ensure grid flow is correct
            card.className = cardClasses;
            
            // Check if key data fields are missing
            const isMissing = !part.zorenNo || !part.oemNo || !part.applications || !part.carMaker || part.stock === 0 || part.price === 0;
            const missingTag = isMissing ? `<span class="inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full text-yellow-800 bg-yellow-100 ring-1 ring-yellow-500/10">Missing Data</span>` : '';
            
            card.innerHTML = `
                <div class="p-6">
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
                            <div class="flex flex-wrap gap-1">${oemDisplay}</div> 
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
                            <svg class="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-9-4l9-9m-3 9l9-9"></path></svg>
                            Edit
                        </button>
                        <button onclick="app.deletePart('${part.id}', '${part.name}')"
                                class="flex-1 px-4 py-2 bg-red-500 text-white font-semibold rounded-lg shadow-md hover:bg-red-600 transition duration-150 text-sm">
                            <svg class="inline-block w-4 h-4 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                            Delete
                        </button>
                    </div>
                </div>
            `;
            list.appendChild(card);
        });
    },

    /**
     * Shows a non-blocking message box at the bottom right.
     * @param {string} message - The message to display.
     * @param {('success'|'error')} type - The type of message.
     */
    showMessage(message, type = 'success') {
        const box = document.getElementById('message-box');
        const content = box.querySelector('div');
        
        // Set color based on type
        if (type === 'error') {
            content.className = 'bg-red-600 text-white p-4 rounded-lg shadow-xl font-semibold';
        } else {
            content.className = 'bg-green-600 text-white p-4 rounded-lg shadow-xl font-semibold';
        }

        content.textContent = message;
        box.classList.remove('opacity-0', 'pointer-events-none');
        box.classList.add('opacity-100');

        // Auto-hide after 4 seconds
        setTimeout(() => {
            box.classList.remove('opacity-100');
            box.classList.add('opacity-0', 'pointer-events-none');
        }, 4000);
    },

    // --- CRUD Operations ---

    /**
     * Opens the Add/Edit modal.
     * @param {string | null} partId - The ID of the part to edit, or null to add a new part.
     */
    openEditModal(partId) {
        this.currentEditId = partId;
        const modal = document.getElementById('edit-modal');
        const title = document.getElementById('edit-modal-title');
        const btn = document.getElementById('save-part-btn');
        const form = document.getElementById('part-form');
        form.reset();

        if (partId) {
            // Editing existing part
            const part = this.parts.find(p => p.id === partId);
            if (part) {
                title.textContent = `Edit Part: ${part.name}`;
                btn.textContent = 'Update Part';
                
                // Populate fields (they store comma-separated strings)
                document.getElementById('zoren-no').value = part.zorenNo || '';
                document.getElementById('oem-no').value = part.oemNo || '';
                document.getElementById('car-maker').value = part.carMaker || '';
                document.getElementById('applications').value = part.applications || '';
                
                // Populate existing fields
                document.getElementById('part-name').value = part.name || '';
                document.getElementById('part-description').value = part.description || '';
                document.getElementById('part-price').value = part.price || 0;
                document.getElementById('part-stock').value = part.stock || 0;
            }
        } else {
            // Adding new part
            title.textContent = 'Add New Part';
            btn.textContent = 'Save Part';
        }

        modal.classList.remove('hidden');
        setTimeout(() => modal.style.opacity = '1', 10); // Simple transition
    },

    /**
     * Closes the Add/Edit modal.
     */
    closeEditModal() {
        const modal = document.getElementById('edit-modal');
        modal.classList.add('hidden');
        this.currentEditId = null;
    },

    /**
     * Handles saving a part (both Add and Edit), updated to save new fields.
     * @param {Event} e - The form submit event.
     */
    async savePart(e) {
        e.preventDefault();
        if (!db || !userId) {
            this.showMessage("Authentication required to save data.", 'error');
            return;
        }

        // Data is retrieved as simple strings from the input fields
        const partData = {
            // New fields from user's request
            zorenNo: document.getElementById('zoren-no').value.trim(),
            oemNo: document.getElementById('oem-no').value.trim(),
            carMaker: document.getElementById('car-maker').value.trim(),
            applications: document.getElementById('applications').value.trim(),
            
            // Existing fields
            name: document.getElementById('part-name').value.trim(),
            description: document.getElementById('part-description').value.trim(),
            price: parseFloat(document.getElementById('part-price').value) || 0,
            stock: parseInt(document.getElementById('part-stock').value, 10) || 0,
            updatedAt: new Date().toISOString()
        };

        // Basic validation: Zoren No. and Name are required
        if (!partData.zorenNo || !partData.name) {
            this.showMessage("ZOREN NO. and Part Name are required.", 'error');
            return;
        }

        try {
            const partsCollection = collection(db, PUBLIC_COLLECTION_PATH);
            const action = this.currentEditId ? 'Updated' : 'Added';

            if (this.currentEditId) {
                // Update existing document
                const partRef = doc(db, PUBLIC_COLLECTION_PATH, this.currentEditId);
                await updateDoc(partRef, partData);
            } else {
                // Add new document
                partData.createdAt = new Date().toISOString();
                await addDoc(partsCollection, partData);
            }

            this.showMessage(`Part '${partData.name}' successfully ${action}.`, 'success');
            this.closeEditModal();

        } catch (error) {
            this.showMessage(`Failed to save part: ${error.message}`, 'error');
            console.error("Save/Update error:", error);
        }
    },

    /**
     * Deletes a part after confirmation.
     * @param {string} partId - The ID of the part to delete.
     * @param {string} partName - The name of the part for the message.
     */
    async deletePart(partId, partName) {
        if (!db || !userId) {
            this.showMessage("Authentication required to delete data.", 'error');
            return;
        }

        // Custom confirmation dialog replacement
        if (!window.confirm(`Are you sure you want to delete the part: ${partName}?`)) {
            return;
        }

        try {
            const partRef = doc(db, PUBLIC_COLLECTION_PATH, partId);
            await deleteDoc(partRef);
            this.showMessage(`Part '${partName}' successfully deleted.`, 'success');
        } catch (error) {
            this.showMessage(`Failed to delete part: ${error.message}`, 'error');
            console.error("Delete error:", error);
        }
    },

    // --- JSON Bulk Upload Operations ---

    /**
     * Opens the JSON bulk upload modal.
     */
    openJsonModal() {
        document.getElementById('json-modal').classList.remove('hidden');
        document.getElementById('json-status').style.display = 'none';
        document.getElementById('json-status').textContent = '';
    },

    /**
     * Closes the JSON bulk upload modal.
     */
    closeJsonModal() {
        document.getElementById('json-modal').classList.add('hidden');
    },
    
    /**
     * Clears the JSON input textarea.
     */
    clearJsonInput() {
        document.getElementById('json-input').value = '';
        document.getElementById('json-status').style.display = 'none';
    },

    /**
     * Loads and saves bulk data from the JSON textarea to Firestore, handling snake_case and arrays.
     */
    async loadBulkData() {
        if (!db || !userId) {
            this.showMessage("Authentication required to load bulk data.", 'error');
            return;
        }
        
        const jsonInput = document.getElementById('json-input').value.trim();
        const statusBox = document.getElementById('json-status');
        statusBox.style.display = 'block';

        if (!jsonInput) {
            statusBox.className = 'mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700';
            statusBox.textContent = 'Please paste JSON data into the box.';
            return;
        }

        let partsArray;
        try {
            partsArray = JSON.parse(jsonInput);
            if (!Array.isArray(partsArray)) {
                throw new Error('JSON is not a valid array.');
            }
        } catch (error) {
            statusBox.className = 'mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700';
            statusBox.textContent = `Error parsing JSON: ${error.message}`;
            return;
        }

        // Filter and validate the data, mapping snake_case input to camelCase storage
        const validParts = partsArray.filter((item, index) => {
            // REQUIREMENT: Must have zoren_no
            if (typeof item !== 'object' || !item.zoren_no) {
                console.error(`Invalid item at index ${index}: missing zoren_no.`, item);
                return false;
            }
            return true;
        }).map(item => {
            
            // Helper to convert array/string to comma-separated string for storage
            const cleanField = (value) => {
                if (Array.isArray(value)) {
                    return value.map(v => String(v).trim()).join(', ');
                }
                return String(value || '').trim();
            };

            return {
                // Map snake_case input to camelCase for storage
                zorenNo: cleanField(item.zoren_no),
                oemNo: cleanField(item.oem_no),
                carMaker: cleanField(item.car_maker),
                applications: cleanField(item.applications),
                
                // Part Name (use 'name' if provided, otherwise default to Zoren No.)
                name: cleanField(item.name || item.zoren_no),
                
                // Existing fields
                description: cleanField(item.description),
                price: parseFloat(item.price) || 0,
                stock: parseInt(item.stock, 10) || 0,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
        });

        if (validParts.length === 0) {
            statusBox.className = 'mt-4 p-3 rounded-lg text-sm bg-yellow-100 text-yellow-700';
            statusBox.textContent = 'No valid parts found in the input. Ensure each object has "zoren_no".';
            return;
        }
        
        let successCount = 0;
        let failedCount = 0;
        
        // Save valid parts to Firestore
        for (const part of validParts) {
            try {
                const partsCollection = collection(db, PUBLIC_COLLECTION_PATH);
                await addDoc(partsCollection, part);
                successCount++;
            } catch (error) {
                failedCount++;
                console.error(`Failed to save part ${part.zorenNo}:`, error);
            }
        }

        if (failedCount > 0) {
            this.showMessage(`Bulk load completed with ${successCount} successful saves and ${failedCount} failures. Check console for details.`, 'error');
            statusBox.className = 'mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700';
            statusBox.textContent = `Completed: ${successCount} parts saved, ${failedCount} failed.`;
        } else {
            this.showMessage(`${successCount} parts successfully loaded from JSON.`, 'success');
            statusBox.className = 'mt-4 p-3 rounded-lg text-sm bg-green-100 text-green-700';
            statusBox.textContent = `Success! ${successCount} parts saved.`;
        }
        
        // Clear input only on full success
        if (failedCount === 0) {
            document.getElementById('json-input').value = '';
            // Keep modal open to show status, or close it after a delay
            setTimeout(() => this.closeJsonModal(), 3000);
        }
    }
};

// Initialize the application when the window loads
window.app = App; // Make App methods globally accessible for HTML handlers
window.onload = () => {
    App.initFirebase();
};
