const NSFW_CLASSES = new Set(['Porn', 'Hentai']);

function isNsfwPrediction(predictions, threshold) {
    const limit = Number(threshold);
    if (!Array.isArray(predictions) || !Number.isFinite(limit)) return false;

    return predictions.some(prediction =>
        NSFW_CLASSES.has(prediction && prediction.className) &&
        Number(prediction.probability) >= limit
    );
}

module.exports = {
    isNsfwPrediction
};
