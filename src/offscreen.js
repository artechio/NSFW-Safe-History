let modelPromise = null;

function getModel() {
    if (!modelPromise) {
        const modelUrl = chrome.runtime.getURL('assets/model/');
        modelPromise = nsfwjs.load(modelUrl, { size: 224 }).catch(error => {
            modelPromise = null;
            throw error;
        });
    }
    return modelPromise;
}

async function loadImageElement(url) {
    if (url.startsWith('data:image/')) {
        const image = new Image();
        await new Promise((resolve, reject) => {
            image.onload = resolve;
            image.onerror = () => reject(new Error('Data image failed to load'));
            image.src = url;
        });
        return image;
    }

    const response = await fetch(url, { credentials: 'omit', cache: 'force-cache' });
    if (!response.ok) throw new Error(`Image fetch failed (${response.status})`);
    const blob = await response.blob();
    if (blob.type && !blob.type.startsWith('image/') && blob.type !== 'application/octet-stream') {
        throw new Error(`Response is not an image (${blob.type || 'unknown'})`);
    }
    return createImageBitmap(blob);
}

async function classifyUrl(url) {
    const source = await loadImageElement(url);
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(source, 0, 0, 224, 224);
    if (typeof source.close === 'function') source.close();

    const model = await getModel();
    return model.classify(canvas, 5);
}

const port = chrome.runtime.connect({ name: 'classifier' });
port.onMessage.addListener(message => {
    if (!message || message.type !== 'classify') return;
    classifyUrl(message.url)
        .then(predictions => port.postMessage({ id: message.id, predictions }))
        .catch(error => port.postMessage({ id: message.id, error: error.message || 'Classification failed' }));
});
