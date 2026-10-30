class LruCache {
    constructor(limit) {
        this.limit = Math.max(1, Number(limit) || 1);
        this.map = new Map();
    }

    has(key) {
        return this.map.has(key);
    }

    get(key) {
        if (!this.map.has(key)) return undefined;
        const value = this.map.get(key);
        this.map.delete(key);
        this.map.set(key, value);
        return value;
    }

    set(key, value) {
        if (this.map.has(key)) this.map.delete(key);
        this.map.set(key, value);
        while (this.map.size > this.limit) {
            this.map.delete(this.map.keys().next().value);
        }
        return this;
    }

    clear() {
        this.map.clear();
    }

    get size() {
        return this.map.size;
    }
}

module.exports = { LruCache };
