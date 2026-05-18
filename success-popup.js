(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

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
                message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
            });
        }
        
        return message;
    }

    const localizationReady = loadMessages();
    await localizationReady;

    let hasSuccess = false;

    if (window.location.href.includes('/games/') && window.location.href.includes('?success#!/')) {
        hasSuccess = true;
    } else {
        const urlParams = new URLSearchParams(window.location.search);
        hasSuccess = urlParams.has('success');
    }
    
    if (!hasSuccess) {
        return;
    }
    
    const assetDetails = sessionStorage.getItem('roearn_purchase_details');
    if (!assetDetails) {
        return;
    }
    
    const { assetName, earnAmount, assetPrice } = JSON.parse(assetDetails);
    
    sessionStorage.removeItem('roearn_purchase_details');
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => init(assetName, earnAmount, assetPrice));
    } else {
        init(assetName, earnAmount, assetPrice);
    }
    
    function init(assetName, earnAmount, assetPrice) {
        function formatNumber(num) {
            return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
        
        const formattedEarnAmount = formatNumber(earnAmount);
        const formattedAssetPrice = formatNumber(assetPrice);
        
        const style = document.createElement('style');
        style.id = 'roearn-success-popup-styles';
        style.textContent = `
            @keyframes roearn-popup-fade-in {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }
            
            @keyframes roearn-popup-scale-in {
                from {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
            }
            
            @keyframes roearn-popup-fade-out {
                from {
                    opacity: 1;
                }
                to {
                    opacity: 0;
                }
            }
            
            @keyframes roearn-popup-scale-out {
                from {
                    opacity: 1;
                    transform: translate(-50%, -50%) scale(1);
                }
                to {
                    opacity: 0;
                    transform: translate(-50%, -50%) scale(0.9);
                }
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
            
            .roearn-success-overlay {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.5);
                z-index: 10000;
                animation: roearn-popup-fade-in 0.2s ease-out;
            }
            
            .roearn-success-overlay.closing {
                animation: roearn-popup-fade-out 0.2s ease-out;
            }
            
            .roearn-success-popup {
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background: white;
                border-radius: 12px;
                padding: 24px;
                max-width: 500px;
                width: calc(100% - 40px);
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                z-index: 10001;
                animation: roearn-popup-scale-in 0.2s ease-out;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            }
            
            .dark-theme .roearn-success-popup {
                background: #232527;
            }
            
            .roearn-success-popup.closing {
                animation: roearn-popup-scale-out 0.2s ease-out;
            }
            
            .roearn-success-popup-header {
                display: flex;
                justify-content: space-between;
                align-items: flex-start;
                margin-bottom: 16px;
            }
            
            .roearn-success-popup-title {
                font-size: 24px;
                font-weight: bold;
                color: #393b3d;
                margin: 0;
                padding-top: 4px;
            }
            
            .dark-theme .roearn-success-popup-title {
                color: #ffffff;
            }
            
            .roearn-success-popup-close {
                background: none;
                border: none;
                font-size: 36px;
                color: #606162;
                cursor: pointer;
                padding: 0;
                width: 36px;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                margin: -4px -4px 0 0;
                flex-shrink: 0;
            }
            
            .dark-theme .roearn-success-popup-close {
                color: #d1d1d1;
            }
            
            .roearn-success-popup-close:hover {
                color: #393b3d;
            }
            
            .dark-theme .roearn-success-popup-close:hover {
                color: #ffffff;
            }
            
            .roearn-success-popup-message {
                color: #393b3d;
                margin-bottom: 16px;
                font-size: 16px;
                line-height: 1.6;
            }
            
            .dark-theme .roearn-success-popup-message {
                color: #d1d1d1;
            }
            
            .roearn-success-popup-message .font-bold {
                font-weight: 700;
            }
            
            .roearn-success-popup-message .icon-robux-16x16 {
                display: inline-block;
                vertical-align: middle;
                margin: 0 -2px 0 0;
            }
            
            .roearn-success-popup-message .text-robux {
                font-weight: 700;
            }
            
            .roearn-success-popup-cashback {
                color: #393b3d;
                margin-bottom: 20px;
                font-size: 16px;
            }
            
            .dark-theme .roearn-success-popup-cashback {
                color: #d1d1d1;
            }
            
            .roearn-success-popup-cashback .icon-robux-16x16 {
                display: inline-block;
                vertical-align: middle;
                margin: 0 -2px 0 0;
            }
            
            .roearn-success-popup-cashback .text-robux {
                font-weight: 700;
            }
            
            .roearn-success-popup-buttons {
                display: flex;
                gap: 12px;
                justify-content: stretch;
            }
            
            .roearn-success-popup-btn {
                flex: 1;
                padding: 14px 24px;
                border-radius: 8px;
                font-size: 20px;
                font-weight: 600;
                text-decoration: none;
                text-align: center;
                cursor: pointer;
                border: none;
                transition: transform 0.1s;
                display: block;
            }
            
            .roearn-success-popup-btn:hover {
                transform: translateY(-1px);
            }
            
            .roearn-success-popup-btn-balance {
                background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                color: white;
                text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.2);
            }
            
            .roearn-success-popup-btn-customize {
                background: #e0e0e0;
                color: #393b3d;
            }
            
            .dark-theme .roearn-success-popup-btn-customize {
                background: #393b3d;
                color: #ffffff;
            }
        `;
        
        const existingStyle = document.getElementById('roearn-success-popup-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        document.head.appendChild(style);
        
        const isCatalogPage = window.location.href.toLowerCase().includes('catalog') || 
                             window.location.href.toLowerCase().includes('bundle');
        
        const assetNameHtml = `<span class="font-bold">${assetName}</span>`;
        const priceHtml = `<span class="icon-robux-16x16" style="margin-top: -3px;"></span> <span class="text-robux" style="margin-left: -2px;">${formattedAssetPrice}</span>`;
        const earnAmountHtml = `<span class="icon-robux-16x16" style="margin-top: -3px;"></span> <span class="text-robux" style="margin-left: -2px;">${formattedEarnAmount}</span>`;
        
        const messageText = getMessage("successPopupMessage", [assetNameHtml, priceHtml]);
        const cashbackText = getMessage("successPopupCashback", [earnAmountHtml]);
        
        const secondButton = isCatalogPage 
            ? `<a href="https://www.roblox.com/my/avatar" class="roearn-success-popup-btn roearn-success-popup-btn-customize">${getMessage("successPopupCustomizeBtn")}</a>`
            : `<button class="roearn-success-popup-btn roearn-success-popup-btn-customize" id="roearn-continue-btn">${getMessage("successPopupContinueBtn")}</button>`;
        
        const popupHTML = `
            <div class="roearn-success-overlay" id="roearn-success-overlay"></div>
            <div class="roearn-success-popup" id="roearn-success-popup">
                <div class="roearn-success-popup-header">
                    <h2 class="roearn-success-popup-title">${getMessage("successPopupTitle")}</h2>
                    <button class="roearn-success-popup-close" id="roearn-success-close">×</button>
                </div>
                <div class="roearn-success-popup-message">
                    ${messageText}
                </div>
                <div class="roearn-success-popup-cashback">
                    ${cashbackText}
                </div>
                <div class="roearn-success-popup-buttons">
                    <a href="https://www.roblox.com/roearn" class="roearn-success-popup-btn roearn-success-popup-btn-balance">${getMessage("successPopupBalanceBtn")}</a>
                    ${secondButton}
                </div>
            </div>
        `;
        
        const container = document.createElement('div');
        container.innerHTML = popupHTML;
        document.body.appendChild(container);
        
        function closePopup() {
            const overlay = document.getElementById('roearn-success-overlay');
            const popup = document.getElementById('roearn-success-popup');
            
            if (overlay && popup) {
                overlay.classList.add('closing');
                popup.classList.add('closing');
                
                setTimeout(() => {
                    container.remove();
                    if (window.location.href.includes('/games/') && window.location.href.includes('?success#!/')) {
                        const cleanUrl = window.location.href.replace('?success#!/', '#!/');
                        window.history.replaceState({}, '', cleanUrl);
                    } else {
                        const url = new URL(window.location);
                        url.searchParams.delete('success');
                        window.history.replaceState({}, '', url);
                    }
                }, 200);
            }
        }
        
        document.getElementById('roearn-success-overlay').addEventListener('click', closePopup);
        document.getElementById('roearn-success-close').addEventListener('click', closePopup);
        
        const continueBtn = document.getElementById('roearn-continue-btn');
        if (continueBtn) {
            continueBtn.addEventListener('click', closePopup);
        }
    }
})();