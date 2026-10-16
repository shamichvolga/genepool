export const Logger = {
    events: [],
    maxEvents: 50,
    recentEvents: [], // Буфер для последних 5 событий
    sessionID: Date.now(),

    init() {
        this.events = [];
        this.recentEvents = [];
        
        // Клики по всему документу (делегирование)
        document.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                this.logEvent('button_click', e.target.id || e.target.innerText, {});
            }
            this.logEvent('click', e.target.tagName || 'unknown', { x: e.clientX, y: e.clientY });
        });

        // Перехват выбора swimbot через делегирование (если есть кнопки или элементы выбора)
        document.addEventListener('mousedown', (e) => {
            if (e.target.matches('[onclick*="genePool.setSelectedSwimbotID"]')) {
                this.logEvent('select_swimbot', 'UI', {});
            }
        });

        // Перехват ошибок
        window.onerror = (msg, url, line, col, error) => {
            const context = {
                url, line, col,
                stack: error?.stack,
                recentEvents: [...this.recentEvents],
                state: typeof genePool !== 'undefined' ? { swimbotCount: genePool.getNumSwimbots() } : null
            };
            this.logEvent('error', msg, context);
        };

        window.onunhandledrejection = (event) => {
            this.logEvent('promise_error', 'unhandled', { reason: event.reason, recentEvents: [...this.recentEvents] });
        };

        // Периодическая выгрузка (каждые 30 сек)
        setInterval(() => this.downloadLog(), 30000);
    },

    logEvent(type, target, extra) {
        const entry = {
            timestamp: Date.now(),
            type,
            target,
            extra,
            swimbotCount: typeof genePool !== 'undefined' ? genePool.getNumSwimbots() : 0
        };

        this.events.push(entry);
        
        // Обновляем буфер последних 5 событий
        this.recentEvents.push(entry);
        if (this.recentEvents.length > 5) this.recentEvents.shift();

        if (this.events.length >= this.maxEvents) {
            this.downloadLog();
        }
    },

    downloadLog() {
        if (this.events.length === 0) return;

        const data = {
            session: this.sessionID,
            generatedAt: Date.now(),
            logs: this.events
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `genepool_log_${this.sessionID}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        // Очистка логов после выгрузки
        this.events = [];
    }
};

