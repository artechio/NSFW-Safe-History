const DB_NAME = 'nsfw-safe-history';
const STORE = 'blocklist';
const DOMAINS_KEY = 'domains';

function openDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            if (!request.result.objectStoreNames.contains(STORE)) {
                request.result.createObjectStore(STORE);
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function readDomains() {
    return openDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(DOMAINS_KEY);
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error);
    }));
}

function writeDomains(domains) {
    return openDb().then(db => new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(domains, DOMAINS_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    }));
}

module.exports = {
    readDomains,
    writeDomains
};
