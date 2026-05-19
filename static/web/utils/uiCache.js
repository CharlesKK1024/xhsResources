(function () {
    'use strict';

    var MEMORY = new Map();
    var STORAGE_PREFIX = 'xhs_ui_cache:';
    var DEFAULT_MAX_PERSIST_BYTES = 120 * 1024;

    function now() {
        return Date.now();
    }

    function getStorageKey(key) {
        return STORAGE_PREFIX + key;
    }

    function readStorage(key) {
        try {
            var raw = localStorage.getItem(getStorageKey(key));
            if (!raw) return null;
            var parsed = JSON.parse(raw);
            if (!parsed || typeof parsed !== 'object' || !('ts' in parsed)) return null;
            return parsed;
        } catch (e) {
            return null;
        }
    }

    function writeStorage(key, entry, maxPersistBytes) {
        try {
            var raw = JSON.stringify(entry);
            if (raw.length > (maxPersistBytes || DEFAULT_MAX_PERSIST_BYTES)) return false;
            localStorage.setItem(getStorageKey(key), raw);
            return true;
        } catch (e) {
            return false;
        }
    }

    function getEntry(key) {
        if (!key) return null;
        if (MEMORY.has(key)) return MEMORY.get(key);

        var stored = readStorage(key);
        if (stored) MEMORY.set(key, stored);
        return stored;
    }

    function isStale(entry, maxAgeMs) {
        if (!entry) return true;
        if (!maxAgeMs || maxAgeMs <= 0) return false;
        return (now() - entry.ts) > maxAgeMs;
    }

    function peek(key, maxAgeMs) {
        var entry = getEntry(key);
        if (!entry) return null;
        return {
            data: entry.data,
            ts: entry.ts,
            stale: isStale(entry, maxAgeMs),
        };
    }

    function get(key, maxAgeMs) {
        var entry = peek(key, maxAgeMs);
        if (!entry || entry.stale) return null;
        return entry.data;
    }

    function set(key, data, options) {
        if (!key) return;

        options = options || {};
        var entry = { data: data, ts: now() };
        MEMORY.set(key, entry);

        if (options.persist === false) {
            try {
                localStorage.removeItem(getStorageKey(key));
            } catch (e) {}
            return;
        }

        writeStorage(key, entry, options.maxPersistBytes);
    }

    function remove(key) {
        if (!key) return;
        MEMORY.delete(key);
        try {
            localStorage.removeItem(getStorageKey(key));
        } catch (e) {}
    }

    function removePrefix(prefix) {
        if (!prefix) return;

        MEMORY.forEach(function (_, key) {
            if (key.indexOf(prefix) === 0) MEMORY.delete(key);
        });

        try {
            for (var i = localStorage.length - 1; i >= 0; i--) {
                var storageKey = localStorage.key(i);
                if (storageKey && storageKey.indexOf(STORAGE_PREFIX + prefix) === 0) {
                    localStorage.removeItem(storageKey);
                }
            }
        } catch (e) {}
    }

    window.XHSUICache = {
        peek: peek,
        get: get,
        set: set,
        remove: remove,
        removePrefix: removePrefix,
    };
})();
