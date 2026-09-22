document.addEventListener('DOMContentLoaded', () => {
    const excludeToggle = document.getElementById('excludeToggle');
    const excludeToggleLabel = document.getElementById('excludeToggleLabel');
    const blurToggle = document.getElementById('blurToggle');
    const clearHistory = document.getElementById('clearHistory');
    const openOptions = document.getElementById('openOptions');
    const versionBadge = document.getElementById('versionBadge');
    const rangeButtons = [...document.querySelectorAll('[data-range]')];
    let currentHost = '';
    let selectedRange = 'week';

    versionBadge.textContent = `v${chrome.runtime.getManifest().version}`;

    const rangeLabels = {
        today: 'پاک‌کردن امروز',
        week: 'پاک‌کردن این هفته',
        month: 'پاک‌کردن این ماه',
        all: 'پاک‌کردن کل تاریخچه'
    };

    function sendMessage(message) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage(message, response => {
                const err = chrome.runtime.lastError;
                if (err) reject(new Error(err.message));
                else resolve(response);
            });
        });
    }

    function showStatus(message, type) {
        const status = document.createElement('div');
        status.textContent = message;
        status.className = `status-message status-${type}`;
        document.body.appendChild(status);
        setTimeout(() => status.remove(), 3500);
    }

    function setExcludeLabel(active) {
        excludeToggleLabel.textContent = active
            ? 'پاک‌کردن هیستوری و بلور برای این سایت فعال است'
            : 'این سایت مستثنی شده است';
    }

    function setSelectedRange(range) {
        selectedRange = range;
        rangeButtons.forEach(button => {
            button.classList.toggle('is-selected', button.dataset.range === range);
        });
        clearHistory.disabled = false;
        clearHistory.querySelector('span').textContent = rangeLabels[range] || 'پاک‌کردن بازه انتخاب‌شده';
    }

    function setBusy(busy) {
        clearHistory.disabled = busy;
        rangeButtons.forEach(button => {
            button.disabled = busy;
        });
    }

    sendMessage({ action: 'GET_SETTINGS' }).then(settings => {
        if (!settings || settings.error) throw new Error('settings');
        blurToggle.checked = Boolean(settings.blurEnabled);
        setSelectedRange(settings.lastCleanRange || 'week');
        chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
            const tab = tabs && tabs[0];
            if (!tab || !tab.url) {
                excludeToggle.disabled = true;
                setExcludeLabel(false);
                return;
            }
            try {
                currentHost = new URL(tab.url).hostname;
            } catch (error) {
                excludeToggle.disabled = true;
                return;
            }
            const excluded = (settings.excludedSites || []).includes(currentHost);
            excludeToggle.checked = !excluded;
            setExcludeLabel(!excluded);
        });
    }).catch(() => showStatus('بارگذاری تنظیمات ممکن نبود', 'error'));

    rangeButtons.forEach(button => {
        button.addEventListener('click', () => setSelectedRange(button.dataset.range));
    });

    excludeToggle.addEventListener('change', () => {
        if (!currentHost) return;
        sendMessage({ action: 'GET_SETTINGS' }).then(settings => {
            const excluded = new Set(settings.excludedSites || []);
            if (excludeToggle.checked) excluded.delete(currentHost);
            else excluded.add(currentHost);
            return sendMessage({
                action: 'UPDATE_SETTINGS',
                settings: { excludedSites: [...excluded] }
            });
        }).then(() => {
            setExcludeLabel(excludeToggle.checked);
        }).catch(() => showStatus('به‌روزرسانی این سایت ممکن نبود', 'error'));
    });

    blurToggle.addEventListener('change', () => {
        sendMessage({
            action: 'UPDATE_SETTINGS',
            settings: { blurEnabled: blurToggle.checked }
        }).catch(() => showStatus('به‌روزرسانی بلور ممکن نبود', 'error'));
    });

    clearHistory.addEventListener('click', () => {
        if (!selectedRange) return;
        if (selectedRange === 'all') {
            const ok = window.confirm('کل هیستوری منطبق پاک شود؟ این کار قابل بازگشت نیست.');
            if (!ok) return;
        }

        setBusy(true);
        clearHistory.querySelector('span').textContent = 'در حال پاک‌کردن…';
        sendMessage({ action: 'CLEAR_HISTORY', range: selectedRange }).then(response => {
            if (!response || !response.ok) {
                showStatus('پاک‌کردن هیستوری ممکن نبود', 'error');
                return;
            }
            showStatus(`${response.deleted} مورد پاک شد`, 'success');
        }).catch(() => showStatus('پاک‌کردن هیستوری ممکن نبود', 'error'))
            .finally(() => {
                setBusy(false);
                setSelectedRange(selectedRange);
            });
    });

    openOptions.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });
});
