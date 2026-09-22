let modelPromise = null;

function getModel() {
    if (!modelPromise) {
        const modelUrl = chrome.runtime.getURL('assets/model/model.json');
        modelPromise = nsfwjs.load(modelUrl).catch(error => {
            modelPromise = null;
            throw error;
        });
    }
    return modelPromise;
}

async function classifyUrl(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Image fetch failed');
    const blob = await response.blob();
    if (!blob.type.startsWith('image/')) throw new Error('Response is not an image');

    const bitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = 224;
    canvas.height = 224;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, 224, 224);
    bitmap.close();

    const model = await getModel();
    return model.classify(canvas);
}

const port = chrome.runtime.connect({ name: 'classifier' });
port.onMessage.addListener(message => {
    if (!message || message.type !== 'classify') return;
    classifyUrl(message.url)
        .then(predictions => port.postMessage({ id: message.id, predictions }))
        .catch(error => port.postMessage({ id: message.id, error: error.message || 'Classification failed' }));
});
