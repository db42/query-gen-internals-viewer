// IndexedDB configuration
const DB_NAME = 'ViewerDB';
const DB_VERSION = 1;
const STORE_NAME = 'traceData';

async function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => {
            reject(new Error('Failed to open database'));
        };
        
        request.onsuccess = (event) => {
            resolve(event.target.result);
        };
        
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
}

async function getTraceById(traceId) {
    if (!traceId) {
        console.error('No trace ID provided');
        return null;
    }

    try {
        const db = await initDB();
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(traceId);
            
            request.onerror = () => {
                reject(new Error('Failed to read trace data'));
            };
            
            request.onsuccess = () => {
                resolve(request.result?.data || null);
            };
        });
    } catch (error) {
        console.error('Error accessing IndexedDB:', error);
        return null;
    }
}

// Utility function to get URL parameters
function getUrlParameter(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}