(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;
    
    const isOnDashboard = window.location.href.includes('/roearn');

    let cachedMessages = null;
    let messagesPromise = null;

    async function loadMessages() {
        if (cachedMessages) return cachedMessages;
        if (messagesPromise) return messagesPromise;
        
        messagesPromise = (async () => {
            let locale = 'en';
            
            try {
                const result = await api.storage.local.get(['userLocale']);
                locale = result.userLocale || 'en';
            } catch (e) {}
            
            try {
                const messagesUrl = api.runtime.getURL(`_locales/${locale}/messages.json`);
                const messagesResponse = await fetch(messagesUrl);
                if (messagesResponse.ok) {
                    cachedMessages = await messagesResponse.json();
                    return cachedMessages;
                }
            } catch (e) {}
            
            const fallbackUrl = api.runtime.getURL('_locales/en/messages.json');
            const fallbackResponse = await fetch(fallbackUrl);
            cachedMessages = await fallbackResponse.json();
            return cachedMessages;
        })();
        
        return messagesPromise;
    }

    function getMessage(key, substitutions) {
        if (!cachedMessages || !cachedMessages[key]) {
            return key;
        }
        
        let message = cachedMessages[key].message;
        
        if (substitutions) {
            const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
            subs.forEach((sub, index) => {
                message = message.replace(new RegExp(`\\${index + 1}`, 'g'), sub);
            });
        }
        
        return message;
    }

    const localizationReady = loadMessages();
    await localizationReady;

    function injectNotificationStyles() {
        if (document.getElementById('roearn-notification-styles')) return;
        
        const style = document.createElement('style');
        style.id = 'roearn-notification-styles';
        style.textContent = `
            .roearn-notification {
                position: fixed;
                right: 20px;
                bottom: 20px;
                background: white;
                border-radius: 14px;
                padding: 20px 24px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                max-width: 380px;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }
            
            .dark-theme .roearn-notification {
                background: #232527;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }
            
            .roearn-notification-header {
                margin-bottom: 12px;
            }
            
            .roearn-notification-title {
                font-size: 18px;
                font-weight: bold;
                color: #393b3d;
            }
            
            .dark-theme .roearn-notification-title {
                color: #ffffff;
            }
            
            .roearn-notification-text {
                font-size: 15px;
                color: #606162;
                line-height: 1.5;
                margin-bottom: 16px;
            }
            
            .dark-theme .roearn-notification-text {
                color: #d1d1d1;
            }
            
            .roearn-robux-amount {
                font-weight: bold;
            }
            
            .roearn-notification-actions {
                display: flex;
                gap: 10px;
            }
            
            .roearn-notification-btn {
                flex: 1;
                padding: 10px 16px;
                border: none;
                border-radius: 8px;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
            }
            
            .roearn-notification-btn:hover {
                transform: translateY(-1px);
            }
            
            .roearn-notification-btn-primary {
                background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                color: white;
                text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
            }

            @keyframes rainbow-flow {
                0% {
                    background-position: 0% 50%;
                }
                50% {
                    background-position: 100% 50%;
                }
                100% {
                    background-position: 0% 50%;
                }
            }
            
            .roearn-notification-btn-secondary {
                background: #6c757d;
                color: white;
            }
            
            .roearn-notification-btn-secondary:hover {
                background: #5a6268;
            }
        `;
        
        if (document.head) {
            document.head.appendChild(style);
        } else {
            const headObserver = new MutationObserver(() => {
                if (document.head) {
                    headObserver.disconnect();
                    document.head.appendChild(style);
                }
            });
            headObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    injectNotificationStyles();

    let currentNotification = null;
    let totalAccumulatedRobux = 0;
    let accumulatedAssetIds = [];

    function createNotification(robux, assetIds) {
        if (currentNotification) {
            const robuxAmountSpan = currentNotification.querySelector('.roearn-robux-amount');
            if (robuxAmountSpan) {
                robuxAmountSpan.textContent = robux.toLocaleString();
            }
            currentNotification.dataset.assetId = assetIds;
            return;
        }

        const notification = document.createElement('div');
        notification.className = 'roearn-notification';
        notification.dataset.assetId = assetIds;
        
        notification.innerHTML = `
            <div class="roearn-notification-header">
                <div class="roearn-notification-title">${getMessage("notificationTitle")}</div>
            </div>
            <div class="roearn-notification-text">
                <span class="roearn-robux-amount">${robux.toLocaleString()}</span> ${getMessage("notificationText")}
            </div>
            <div class="roearn-notification-actions">
                ${isOnDashboard ? 
                    `<button class="roearn-notification-btn roearn-notification-btn-secondary" data-action="dismiss">${getMessage("dismissButton")}</button>` :
                    `<button class="roearn-notification-btn roearn-notification-btn-secondary" data-action="dismiss">${getMessage("dismissButton")}</button>
                     <button class="roearn-notification-btn roearn-notification-btn-primary" data-action="view-balance">${getMessage("viewBalanceButton")}</button>`
                }
            </div>
        `;
        
        document.body.appendChild(notification);
        currentNotification = notification;
        
        const dismissBtn = notification.querySelector('[data-action="dismiss"]');
        const viewBalanceBtn = notification.querySelector('[data-action="view-balance"]');
        
        dismissBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            if (currentNotification) {
                currentNotification.remove();
                currentNotification = null;
            }
            
            api.storage.local.set({ activeNotifications: [] });
            totalAccumulatedRobux = 0;
            accumulatedAssetIds = [];
        });
        
        if (!isOnDashboard) {
            viewBalanceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const currentAssetIds = notification.dataset.assetId.split(',');
                
                api.storage.local.get(['pendingTransactions'], (result) => {
                    const pending = result.pendingTransactions || [];
                    const stillPending = pending.filter(p => !currentAssetIds.includes(String(p.assetId)));
                    api.storage.local.set({ pendingTransactions: stillPending });
                });
                
                api.storage.local.set({ activeNotifications: [] });
                totalAccumulatedRobux = 0;
                accumulatedAssetIds = [];
                
                removeNotification();
                
                window.location.href = 'https://www.roblox.com/roearn';
            });
        }
    }

    function removeNotification() {
        if (!currentNotification) return;
        
        api.storage.local.set({ activeNotifications: [] });
        
        currentNotification.remove();
        currentNotification = null;
    }

    function waitForBody(callback) {
        if (document.body) {
            callback();
        } else {
            const observer = new MutationObserver(() => {
                if (document.body) {
                    observer.disconnect();
                    callback();
                }
            });
            observer.observe(document.documentElement, { childList: true, subtree: true });
        }
    }

    waitForBody(() => {
        api.storage.local.get(['activeNotifications'], (result) => {
            const active = result.activeNotifications || [];
            if (active.length > 0) {
                const notification = active[0];
                totalAccumulatedRobux = notification.robux;
                accumulatedAssetIds = notification.assetId.split(',').map(id => String(id));
                createNotification(notification.robux, notification.assetId);
            }
        });

        startMonitoring();
    });

    let monitoringInterval = null;

    async function checkPendingTransactions() {
        const result = await api.storage.local.get(['pendingTransactions']);
        const pending = result.pendingTransactions || [];
        
        if (pending.length === 0) {
            if (monitoringInterval) {
                clearInterval(monitoringInterval);
                monitoringInterval = null;
            }
            return;
        }
        
        const userData = await fetch('https://users.roblox.com/v1/users/authenticated', {
            credentials: 'include'
        }).then(r => r.json()).catch(() => null);
        
        if (!userData || !userData.id) return;
        
        const response = await new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_MANUAL_REVIEWAL', userId: userData.id },
                (response) => resolve(response)
            );
        });
        
        const currentPending = response?.items || [];
        const currentPendingIds = currentPending.map(item => String(item.assetId));
        
        const approved = pending.filter(p => !currentPendingIds.includes(String(p.assetId)));
        
        if (approved.length > 0) {
            let batchRobux = 0;
            const batchAssetIds = [];
            
            approved.forEach(transaction => {
                const cashback = transaction.price * (transaction.withdrawPercent / 100);
                const robux = cashback >= 2 ? Math.floor(cashback * 0.7) : 0;
                
                if (robux > 0) {
                    batchRobux += robux;
                    batchAssetIds.push(String(transaction.assetId));
                }
            });
            
            if (batchRobux > 0 && batchAssetIds.length > 0) {
                totalAccumulatedRobux += batchRobux;
                accumulatedAssetIds.push(...batchAssetIds);
                
                const combinedAssetIds = accumulatedAssetIds.join(',');
                
                await api.storage.local.set({ 
                    activeNotifications: [{
                        assetId: combinedAssetIds,
                        robux: totalAccumulatedRobux
                    }]
                });
                
                createNotification(totalAccumulatedRobux, combinedAssetIds);
            }
            
            const stillPending = pending.filter(p => !approved.some(a => String(a.assetId) === String(p.assetId)));
            await api.storage.local.set({ pendingTransactions: stillPending });
            
            if (stillPending.length === 0 && monitoringInterval) {
                clearInterval(monitoringInterval);
                monitoringInterval = null;
            }
        }
    }

    function startMonitoring() {
        api.storage.local.get(['pendingTransactions'], (result) => {
            const pending = result.pendingTransactions || [];
            
            if (pending.length > 0 && !monitoringInterval) {
                checkPendingTransactions();
                monitoringInterval = setInterval(checkPendingTransactions, 10000);
            }
        });
    }

})();