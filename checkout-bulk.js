(function suppressRoPro() {
    const ROPRO_IDS = ['roproThemeFrame', 'roproThemeBackdropFrame'];
    const ROPRO_STYLE_ID = 'roearn-ropro-override';

    function buildRoProCSS() {
        return ROPRO_IDS.map(function(id) {
            return '#' + id + ' { display: none !important; visibility: hidden !important; pointer-events: none !important; width: 0 !important; height: 0 !important; }';
        }).join('\n');
    }

    function injectRoProStyles() {
        var el = document.querySelector('#' + ROPRO_STYLE_ID);
        var css = buildRoProCSS();
        if (el) { el.textContent = css; return; }
        el = document.createElement('style');
        el.id = ROPRO_STYLE_ID;
        el.textContent = css;
        (document.head || document.documentElement).appendChild(el);
    }

    function removeRoProOverlays() {
        ROPRO_IDS.forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.remove();
        });
    }

    var _roProObserver = null;

    function startRoProObserver() {
        if (_roProObserver) { _roProObserver.disconnect(); }
        _roProObserver = new MutationObserver(removeRoProOverlays);
        _roProObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    function activateRoPro() {
        injectRoProStyles();
        removeRoProOverlays();
        startRoProObserver();
    }

    if (document.head) {
        activateRoPro();
    } else {
        var headWait = new MutationObserver(function() {
            if (document.head) { headWait.disconnect(); activateRoPro(); }
        });
        headWait.observe(document.documentElement, { childList: true });
    }
})();

async function showRoEarnBulkCheckout(items, userId) {    
    let cachedMessages = null;
    let messagesPromise = null;

    function getExtensionUrl() {
        return new Promise((resolve) => {
            const checkElement = () => {
                const el = document.getElementById('__roearn_extension_url__');
                if (el && el.dataset.url) {
                    resolve(el.dataset.url);
                } else {
                    setTimeout(checkElement, 10);
                }
            };
            checkElement();
        });
    }

    function getUserLocale() {
        return new Promise((resolve) => {
            const el = document.getElementById('__roearn_user_locale__');
            if (el && el.dataset.locale) {
                resolve(el.dataset.locale);
            } else {
                resolve('en');
            }
        });
    }

    async function loadMessages() {
        if (cachedMessages) return cachedMessages;
        if (messagesPromise) return messagesPromise;
        
        messagesPromise = (async () => {
            const extensionUrl = await getExtensionUrl();
            const locale = await getUserLocale();
            
            try {
                const messagesUrl = `${extensionUrl}_locales/${locale}/messages.json`;
                const messagesResponse = await fetch(messagesUrl);
                if (messagesResponse.ok) {
                    cachedMessages = await messagesResponse.json();
                    return cachedMessages;
                }
            } catch (e) {}
            
            const fallbackUrl = `${extensionUrl}_locales/en/messages.json`;
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

    const setTitle = () => {
        document.title = getMessage("checkoutPageTitle");
    };
    
    if (document.title) {
        setTitle();
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setTitle);
    } else {
        setTitle();
    }
    
    function formatNumber(num) {
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }
    
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && window.innerWidth < 480;
    
    const totalEarnAmount = items.reduce((sum, item) => sum + item.earnAmount, 0);
    const totalAssetPrice = items.reduce((sum, item) => sum + item.assetPrice, 0);
    const formattedTotalEarn = formatNumber(totalEarnAmount);
    const formattedTotalPrice = formatNumber(totalAssetPrice);
    
    const itemHeight = 68;
    const headerFooterHeight = 92;
    const calculatedHeight = Math.min(456, Math.max(252, (items.length * itemHeight) + headerFooterHeight));
    
    async function getAuthenticatedUserId() {
        try {
            const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
                credentials: 'include'
            });
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();
            return data.id;
        } catch (error) {
            return null;
        }
    }
    
    async function checkItemOwnership(authUserId, assetId, assetType) {
        try {
            let apiUrl;
            
            if (assetType === 'gamepass') {
                apiUrl = `https://inventory.roblox.com/v1/users/${authUserId}/items/gamepass/${assetId}/is-owned`;
            } else if (assetType === 'bundle') {
                apiUrl = `https://inventory.roblox.com/v1/users/${authUserId}/items/bundle/${assetId}/is-owned`;
            } else {
                apiUrl = `https://inventory.roblox.com/v1/users/${authUserId}/items/asset/${assetId}/is-owned`;
            }
            
            const response = await fetch(apiUrl, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                return false;
            }
            
            const isOwned = await response.json();
            return isOwned === true;
        } catch (error) {
            return false;
        }
    }
    
    async function getInventoryCount(authUserId, assetId, assetType) {
        try {
            let apiUrl;
            
            if (assetType === 'bundle') {
                apiUrl = `https://inventory.roblox.com/v1/users/${authUserId}/items/Bundle/${assetId}`;
            } else if (assetType === 'gamepass') {
                const isOwned = await checkItemOwnership(authUserId, assetId, assetType);
                return isOwned ? 1 : 0;
            } else {
                apiUrl = `https://inventory.roblox.com/v1/users/${authUserId}/items/Asset/${assetId}`;
            }
            
            const response = await fetch(apiUrl, {
                credentials: 'include'
            });
            
            if (!response.ok) {
                return 0;
            }
            
            const data = await response.json();
            return data.data ? data.data.length : 0;
        } catch (error) {
            return 0;
        }
    }
    
    function handlePurchaseSuccess() {
        window.dispatchEvent(new CustomEvent('roearn:removeFromCart', {
            detail: JSON.stringify({ assetIds: items.map(item => item.assetId) })
        }));
        
        sessionStorage.setItem('roearn_purchase_details', JSON.stringify({
            assetName: `${items.length} item${items.length > 1 ? 's' : ''}`,
            earnAmount: totalEarnAmount,
            assetPrice: totalAssetPrice,
            isBulk: true,
            itemCount: items.length
        }));
        
        const currentUrl = window.location.href;
        let redirectUrl;
        
        if (currentUrl.includes('/games/') && currentUrl.includes('#!/')) {
            redirectUrl = currentUrl.replace('#!/', '?success#!/');
        } else {
            const baseUrl = currentUrl.split('?')[0].split('#')[0];
            redirectUrl = baseUrl + '?success';
        }
        
        window.location.href = redirectUrl;
    }

    let ownershipCheckInterval = null;
    let initialItemStates = {};

    async function startPurchaseMonitoring() {
        if (ownershipCheckInterval) {
            clearInterval(ownershipCheckInterval);
        }
        
        const authUserId = await getAuthenticatedUserId();
        
        if (!authUserId) {
            return;
        }
        
        for (const item of items) {
            const isOwned = await checkItemOwnership(authUserId, item.assetId, item.assetType);
            
            if (isOwned) {
                const count = await getInventoryCount(authUserId, item.assetId, item.assetType);
                initialItemStates[item.assetId] = {
                    alreadyOwned: true,
                    initialCount: count,
                    assetType: item.assetType
                };
            } else {
                initialItemStates[item.assetId] = {
                    alreadyOwned: false,
                    assetType: item.assetType
                };
            }
        }
        
        ownershipCheckInterval = setInterval(async () => {
            let anyNewPurchase = false;
            
            for (const item of items) {
                const state = initialItemStates[item.assetId];
                
                if (state.alreadyOwned) {
                    const currentCount = await getInventoryCount(authUserId, item.assetId, state.assetType);
                    if (currentCount > state.initialCount) {
                        anyNewPurchase = true;
                        break;
                    }
                } else {
                    const currentlyOwned = await checkItemOwnership(authUserId, item.assetId, state.assetType);
                    if (currentlyOwned) {
                        anyNewPurchase = true;
                        break;
                    }
                }
            }
            
            if (anyNewPurchase) {
                clearInterval(ownershipCheckInterval);
                ownershipCheckInterval = null;
                handlePurchaseSuccess();
            }
        }, 2000);
    }
    
    const rbxBody = document.getElementById('rbx-body');
    const isDarkTheme = rbxBody && rbxBody.classList.contains('dark-theme');
    
    const style = document.createElement('style');
    style.id = 'roearn-checkout-bulk-styles';
    style.textContent = `
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
        
        @keyframes float {
            0%, 100% {
                transform: translateY(0) rotate(0deg) scale(var(--coin-scale, 1));
            }
            25% {
                transform: translateY(-15px) rotate(5deg) scale(var(--coin-scale, 1));
            }
            50% {
                transform: translateY(-10px) rotate(-5deg) scale(var(--coin-scale, 1));
            }
            75% {
                transform: translateY(-20px) rotate(3deg) scale(var(--coin-scale, 1));
            }
        }
        
        @keyframes coinEntrance {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0) rotate(0deg);
            }
            60% {
                opacity: 0.3;
            }
            100% {
                opacity: 0.25;
                transform: translate(0, 0) scale(var(--coin-scale, 1)) rotate(0deg);
            }
        }
        
        @keyframes float-arrow {
            0%, 100% {
                transform: translateX(0);
            }
            50% {
                transform: translateX(10px);
            }
        }
        
        .roearn-checkout-page-background {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 0;
        }
        
        .roearn-checkout-floating-coin {
            position: absolute;
            opacity: 0;
            pointer-events: none;
            animation: coinEntrance 1.2s ease-out forwards, float 6s ease-in-out infinite;
            animation-delay: var(--entrance-delay, 0s), calc(var(--entrance-delay, 0s) + 1.2s);
            transform: scale(var(--coin-scale, 1));
            transform-origin: center center;
        }
        
        .roearn-checkout-floating-coin.gradient-1 {
            filter: brightness(0) saturate(100%) invert(71%) sepia(48%) saturate(1290%) hue-rotate(181deg) brightness(103%) contrast(101%) drop-shadow(0 0 12px rgba(107, 181, 255, 0.6));
        }
        
        .roearn-checkout-floating-coin.gradient-2 {
            filter: brightness(0) saturate(100%) invert(56%) sepia(60%) saturate(2384%) hue-rotate(225deg) brightness(101%) contrast(101%) drop-shadow(0 0 12px rgba(166, 107, 255, 0.6));
        }
        
        .roearn-checkout-floating-coin.gradient-3 {
            filter: brightness(0) saturate(100%) invert(63%) sepia(72%) saturate(2548%) hue-rotate(261deg) brightness(102%) contrast(101%) drop-shadow(0 0 12px rgba(214, 107, 255, 0.6));
        }
        
        .roearn-checkout-floating-coin.gradient-4 {
            filter: brightness(0) saturate(100%) invert(65%) sepia(77%) saturate(2701%) hue-rotate(302deg) brightness(101%) contrast(101%) drop-shadow(0 0 12px rgba(255, 107, 189, 0.6));
        }
        
        .roearn-checkout-container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 40px 20px;
            font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            position: relative;
            z-index: 1;
        }
        
        .roearn-checkout-header {
            text-align: center;
            margin-bottom: 40px;
        }
        
        .roearn-checkout-title {
            font-size: 48px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #393b3d;
        }
        
        .dark-theme .roearn-checkout-title {
            color: #ffffff;
        }
        
        .roearn-checkout-subtitle {
            font-size: 19px;
            color: #606162;
        }
        
        .dark-theme .roearn-checkout-subtitle {
            color: #d1d1d1;
        }
        
        .roearn-checkout-savings-badge {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
            animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
            padding: 12px 24px;
            border-radius: 50px;
            font-size: 22px;
            font-weight: bold;
            color: white;
            text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
            margin-top: 15px;
        }
        
        .roearn-checkout-savings-badge .icon-robux-16x16 {
            transform: scale(1.4);
            filter: brightness(0) invert(1) drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.2));
        }
        
        .roearn-checkout-content {
            display: grid;
            grid-template-columns: 380px 1fr;
            gap: 30px;
            margin-bottom: 30px;
            align-items: start;
        }
        
        @media (max-width: 900px) {
            .roearn-checkout-content {
                grid-template-columns: 1fr;
            }
        }
        
        .roearn-asset-card {
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            position: relative;
            height: ${calculatedHeight}px;
            display: flex;
            flex-direction: column;
        }
        
        .dark-theme .roearn-asset-card {
            background: #232527;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .roearn-bulk-items-header {
            font-size: 18px;
            font-weight: bold;
            color: #393b3d;
            padding: 20px 24px 16px 24px;
            border-bottom: 1px solid #e0e0e0;
            flex-shrink: 0;
        }
        
        .dark-theme .roearn-bulk-items-header {
            color: #ffffff;
            border-bottom-color: #3d3d3d;
        }
        
        .roearn-bulk-items-list {
            flex: 1;
            overflow-y: auto;
            padding: 8px 16px;
        }
        
        .roearn-bulk-items-list::-webkit-scrollbar {
            width: 6px;
        }
        
        .roearn-bulk-items-list::-webkit-scrollbar-track {
            background: transparent;
        }
        
        .roearn-bulk-items-list::-webkit-scrollbar-thumb {
            background: #ccc;
            border-radius: 3px;
        }
        
        .dark-theme .roearn-bulk-items-list::-webkit-scrollbar-thumb {
            background: #555;
        }
        
        .roearn-bulk-item {
            display: flex;
            align-items: center;
            padding: 8px 12px;
            gap: 12px;
            border-radius: 8px;
            margin-bottom: 4px;
            background: #f8f8f8;
        }
        
        .dark-theme .roearn-bulk-item {
            background: #2d2f31;
        }
        
        .roearn-bulk-item:last-child {
            margin-bottom: 0;
        }
        
        .roearn-bulk-item-thumb {
            width: 48px;
            height: 48px;
            border-radius: 6px;
            object-fit: cover;
            background: #e0e0e0;
            flex-shrink: 0;
        }
        
        .dark-theme .roearn-bulk-item-thumb {
            background: #3d3d3d;
        }
        
        .roearn-bulk-item-info {
            flex: 1;
            min-width: 0;
        }
        
        .roearn-bulk-item-name {
            font-size: 14px;
            font-weight: 600;
            color: #393b3d;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            margin-bottom: 4px;
        }
        
        .dark-theme .roearn-bulk-item-name {
            color: #ffffff;
        }
        
        .roearn-bulk-item-price {
            font-size: 13px;
            color: #666;
            display: flex;
            align-items: center;
        }
        
        .dark-theme .roearn-bulk-item-price {
            color: #aaa;
        }
        
        .roearn-bulk-item-price .icon-robux-16x16 {
            margin-right: 4px;
        }
        
        .roearn-bulk-total {
            padding: 12px 24px;
            border-top: 1px solid #e0e0e0;
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-shrink: 0;
        }
        
        .dark-theme .roearn-bulk-total {
            border-top-color: #3d3d3d;
        }
        
        .roearn-bulk-total-label {
            font-size: 15px;
            font-weight: 600;
            color: #393b3d;
        }
        
        .dark-theme .roearn-bulk-total-label {
            color: #ffffff;
        }
        
        .roearn-bulk-total-price {
            font-size: 16px;
            font-weight: bold;
            color: #393b3d;
            display: flex;
            align-items: center;
        }
        
        .dark-theme .roearn-bulk-total-price {
            color: #ffffff;
        }
        
        .roearn-bulk-total-price .icon-robux-16x16 {
            margin-right: 4px;
        }
        
        .roearn-instructions-card {
            background: white;
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        }
        
        .dark-theme .roearn-instructions-card {
            background: #232527;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .roearn-instructions-title {
            font-size: 26px;
            font-weight: bold;
            margin-bottom: 20px;
            color: #393b3d;
        }
        
        .dark-theme .roearn-instructions-title {
            color: #ffffff;
        }
        
        .roearn-checkout-step {
            display: flex;
            align-items: start;
            margin-bottom: 16px;
            color: #393b3d;
            font-size: 14px;
            line-height: 1.6;
        }
        
        .dark-theme .roearn-checkout-step {
            color: #d1d1d1;
        }
        
        .roearn-checkout-step:last-child {
            margin-bottom: 0;
        }
        
        .roearn-step-number {
            min-width: 28px;
            height: 28px;
            background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
            animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: 700;
            margin-right: 12px;
            font-size: 14px;
            color: white;
            text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
            flex-shrink: 0;
        }
        
        .roearn-step-content {
            flex: 1;
        }
        
        .roearn-asset-highlight {
            color: #393b3d;
            font-weight: 700;
        }
        
        .dark-theme .roearn-asset-highlight {
            color: #ffffff;
        }
        
        .roearn-cashback-highlight {
            color: #393b3d;
            font-weight: 700;
        }
        
        .dark-theme .roearn-cashback-highlight {
            color: #ffffff;
        }
        
        .roearn-cashback-highlight .icon-robux-16x16 {
            filter: brightness(0) saturate(100%);
        }
        
        .dark-theme .roearn-cashback-highlight .icon-robux-16x16 {
            filter: brightness(0) invert(1);
        }
        
        .roearn-arrow-pointer {
            position: absolute;
            right: calc(100% + 20px);
            animation: float-arrow 1.5s ease-in-out infinite;
            flex-shrink: 0;
        }
        
        .roearn-arrow-pointer svg {
            width: 80px;
            height: 80px;
            display: block;
        }
        
        .roearn-arrow-path {
            fill: url(#roearn-rainbow-gradient);
            filter: drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.3));
        }
        
        .roearn-play-button {
            width: 300px;
        }
        
        .roearn-play-button-section {
            display: flex;
            justify-content: center;
            align-items: center;
            margin-top: 25px;
            width: 100%;
        }
        
        .roearn-play-button-container {
            position: relative;
        }
        
        .roearn-auto-join-checkbox {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            margin-top: 16px;
            font-size: 14px;
            color: #393b3d;
            cursor: pointer;
            user-select: none;
        }
        
        .dark-theme .roearn-auto-join-checkbox {
            color: #d1d1d1;
        }
        
        .roearn-auto-join-checkbox input[type="checkbox"] {
            width: 20px;
            height: 20px;
            cursor: pointer;
            appearance: none;
            -webkit-appearance: none;
            -moz-appearance: none;
            background: white;
            border: 2px solid #c3c3c3;
            border-radius: 4px;
            position: relative;
            flex-shrink: 0;
        }
        
        .dark-theme .roearn-auto-join-checkbox input[type="checkbox"] {
            background: #393b3d;
            border-color: #606162;
        }
        
        .roearn-auto-join-checkbox input[type="checkbox"]:checked {
            background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
            animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
            border: none;
        }
        
        .roearn-auto-join-checkbox input[type="checkbox"]:checked::after {
            content: '✓';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 14px;
            font-weight: bold;
            text-shadow: 0px 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .roearn-auto-join-checkbox label {
            cursor: pointer;
            margin: 0;
        }

        /* ═══════════════════════════════════════════════════════
           MOBILE CHECKOUT BULK — applied via .roearn-mobile class
           set in JS only when UA matches iPhone/iPad/iPod/Android
           Desktop layout is completely unaffected by these rules.
           ═══════════════════════════════════════════════════════ */

        .roearn-mobile .roearn-checkout-container {
            padding: 20px 12px !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
            overflow-x: hidden !important;
        }

        .roearn-mobile .roearn-checkout-header {
            margin-bottom: 20px !important;
        }

        .roearn-mobile .roearn-checkout-title {
            font-size: 28px !important;
            margin-bottom: 6px !important;
        }

        .roearn-mobile .roearn-checkout-subtitle {
            font-size: 14px !important;
        }

        .roearn-mobile .roearn-checkout-savings-badge {
            font-size: 16px !important;
            padding: 9px 18px !important;
            margin-top: 10px !important;
        }

        .roearn-mobile .roearn-checkout-content {
            display: flex !important;
            flex-direction: column !important;
            gap: 0 !important;
        }

        .roearn-mobile .roearn-asset-card-desktop {
            display: none !important;
        }

        .roearn-mobile .roearn-arrow-pointer {
            display: none !important;
        }

        .roearn-mobile .roearn-play-button-section {
            margin-top: 16px !important;
        }

        .roearn-mobile .roearn-asset-card-mobile {
            display: flex !important;
        }

        .roearn-asset-card-mobile {
            display: none;
            flex-direction: column;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            margin-bottom: 16px;
            box-sizing: border-box;
            width: 100%;
        }

        .dark-theme .roearn-asset-card-mobile {
            background: #232527;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .roearn-bulk-mobile-header {
            font-size: 14px;
            font-weight: 700;
            color: #393b3d;
            padding: 12px 16px 8px 16px;
            border-bottom: 1px solid #e0e0e0;
        }

        .dark-theme .roearn-bulk-mobile-header {
            color: #ffffff;
            border-bottom-color: #3d3d3d;
        }

        .roearn-bulk-mobile-list {
            max-height: 180px;
            overflow-y: auto;
            padding: 6px 12px;
        }

        .roearn-bulk-mobile-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 6px 0;
            border-bottom: 1px solid #f0f0f0;
        }

        .dark-theme .roearn-bulk-mobile-item {
            border-bottom-color: #2e3031;
        }

        .roearn-bulk-mobile-item:last-child {
            border-bottom: none;
        }

        .roearn-bulk-mobile-thumb {
            width: 36px;
            height: 36px;
            border-radius: 6px;
            object-fit: cover;
            flex-shrink: 0;
            background: #e0e0e0;
        }

        .dark-theme .roearn-bulk-mobile-thumb {
            background: #3d3d3d;
        }

        .roearn-bulk-mobile-name {
            flex: 1;
            min-width: 0;
            font-size: 12px;
            font-weight: 600;
            color: #393b3d;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .dark-theme .roearn-bulk-mobile-name {
            color: #ffffff;
        }

        .roearn-bulk-mobile-price {
            display: flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            font-weight: 700;
            color: #606162;
            flex-shrink: 0;
        }

        .dark-theme .roearn-bulk-mobile-price {
            color: #aaa;
        }

        .roearn-bulk-mobile-total {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 10px 16px;
            border-top: 1px solid #e0e0e0;
            font-size: 13px;
            font-weight: 700;
            color: #393b3d;
        }

        .dark-theme .roearn-bulk-mobile-total {
            border-top-color: #3d3d3d;
            color: #ffffff;
        }

        .roearn-bulk-mobile-total-price {
            display: flex;
            align-items: center;
            gap: 3px;
        }
    `;
    
    const existingStyle = document.getElementById('roearn-checkout-bulk-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    document.head.appendChild(style);
    
    const itemsHtml = items.map(item => `
        <div class="roearn-bulk-item">
            <img class="roearn-bulk-item-thumb" src="${item.thumbnail}" alt="${item.assetName}">
            <div class="roearn-bulk-item-info">
                <div class="roearn-bulk-item-name" title="${item.assetName}">${item.assetName}</div>
                <div class="roearn-bulk-item-price"><span class="icon-robux-16x16"></span> ${formatNumber(item.assetPrice)}</div>
            </div>
        </div>
    `).join('');
    
    const cartHeaderText = getMessage('cartTitle', items.length.toString());
    const totalLabelText = getMessage('cartTotalLabel');
    const step2Text = items.length === 1
        ? getMessage('checkoutBulkStep2Single')
        : getMessage('checkoutBulkStep2', items.length.toString());


    const mobileItemsHtml = items.map(item => `
        <div class="roearn-bulk-mobile-item">
            <img class="roearn-bulk-mobile-thumb" src="${item.thumbnail}" alt="${item.assetName}">
            <div class="roearn-bulk-mobile-name" title="${item.assetName}">${item.assetName}</div>
            <div class="roearn-bulk-mobile-price"><span class="icon-robux-16x16"></span>${formatNumber(item.assetPrice)}</div>
        </div>
    `).join('');

    const newContent = `
        <div class="roearn-checkout-page-background"></div>
        <div class="roearn-checkout-container${isMobileDevice ? ' roearn-mobile' : ''}">
            <div class="roearn-checkout-header">
                <div class="roearn-checkout-title">${getMessage("checkoutTitle")}</div>
                <div class="roearn-checkout-subtitle">${getMessage("checkoutSubtitle")}</div>
                <div class="roearn-checkout-savings-badge">
                    <span class="icon-robux-16x16" style="margin-top: 2px;"></span>
                    <span>${getMessage("checkoutSaveBadge", [formattedTotalEarn])}</span>
                </div>
            </div>
            
            <div class="roearn-checkout-content">
                <div class="roearn-asset-card roearn-asset-card-desktop">
                    <div class="roearn-bulk-items-header">
                        ${cartHeaderText}
                    </div>
                    <div class="roearn-bulk-items-list">
                        ${itemsHtml}
                    </div>
                    <div class="roearn-bulk-total">
                        <span class="roearn-bulk-total-label">${totalLabelText}</span>
                        <span class="roearn-bulk-total-price"><span class="icon-robux-16x16"></span> ${formattedTotalPrice}</span>
                    </div>
                </div>
                
                <div>
                    <div class="roearn-asset-card-mobile">
                        <div class="roearn-bulk-mobile-header">${cartHeaderText}</div>
                        <div class="roearn-bulk-mobile-list">${mobileItemsHtml}</div>
                        <div class="roearn-bulk-mobile-total">
                            <span>${totalLabelText}</span>
                            <span class="roearn-bulk-mobile-total-price"><span class="icon-robux-16x16"></span>${formattedTotalPrice}</span>
                        </div>
                    </div>
                    <div class="roearn-instructions-card">
                        <div class="roearn-instructions-title">${getMessage("checkoutHowItWorks")}</div>
                        
                        <div class="roearn-checkout-step">
                            <div class="roearn-step-number">1</div>
                            <div class="roearn-step-content">
                                ${getMessage("checkoutStep1")}
                            </div>
                        </div>
                        
                        <div class="roearn-checkout-step">
                            <div class="roearn-step-number">2</div>
                            <div class="roearn-step-content">
                                ${step2Text}
                            </div>
                        </div>
                        
                        <div class="roearn-checkout-step">
                            <div class="roearn-step-number">3</div>
                            <div class="roearn-step-content">
                                ${getMessage("checkoutStep3", [`<span class="roearn-cashback-highlight"><span class="icon-robux-16x16" style="display: inline-block; margin-left: 0px; margin-right: -4.5px; margin-top: -2px;"></span> ${formattedTotalEarn}</span>`])}
                            </div>
                        </div>
                    </div>
                    
                    <div class="roearn-play-button-section">
                        <div class="roearn-play-button-container">
                            ${isMobileDevice ? '' : `<div class="roearn-arrow-pointer" style="margin-top: -10px;">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                                    <defs>
                                        <linearGradient id="roearn-rainbow-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                                            <stop offset="0%" style="stop-color:rgb(107, 181, 255)"></stop>
                                            <stop offset="20%" style="stop-color:rgb(166, 107, 255)"></stop>
                                            <stop offset="40%" style="stop-color:rgb(214, 107, 255)"></stop>
                                            <stop offset="60%" style="stop-color:rgb(255, 107, 189)"></stop>
                                            <stop offset="80%" style="stop-color:rgb(214, 107, 255)"></stop>
                                            <stop offset="100%" style="stop-color:rgb(107, 181, 255)"></stop>
                                            <animate attributeName="x1" values="0%;100%;0%" dur="3s" repeatCount="indefinite"></animate>
                                            <animate attributeName="x2" values="100%;200%;100%" dur="3s" repeatCount="indefinite"></animate>
                                        </linearGradient>
                                    </defs>
                                    <path class="roearn-arrow-path" d="m18.707 12.707-3 3a1 1 0 0 1-1.414-1.414L15.586 13H6a1 1 0 0 1 0-2h9.586l-1.293-1.293a1 1 0 0 1 1.414-1.414l3 3a1 1 0 0 1 0 1.414z" data-name="Right"/>
                                </svg>
                            </div>`}
                            <button type="button" class="btn-common-play-game-lg btn-primary-md roearn-play-button" id="roearn-play-btn">
                                <span class="icon-common-play"></span>
                            </button>
                            <div class="roearn-auto-join-checkbox">
                                <input type="checkbox" id="roearn-auto-join" />
                                <label for="roearn-auto-join">${getMessage("checkoutAutoJoin")}</label>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const contentElement = document.getElementById('content');
    if (contentElement) {
        contentElement.innerHTML = newContent;

        ['.roearn-mobile-cart-fab', '.roearn-mobile-cart-modal-overlay', '.roearn-mobile-cart-modal'].forEach(function(sel) {
            document.querySelectorAll(sel).forEach(function(el) { el.remove(); });
        });
        window.dispatchEvent(new CustomEvent('roearn:fabDestroyed'));
        
        const pageBackground = contentElement.querySelector('.roearn-checkout-page-background');
        const coinPositions = [
            { left: '2%', top: '5%', scale: '2', delay: '0s', gradient: 'gradient-1' },
            { left: '8%', top: '20%', scale: '2', delay: '0s', gradient: 'gradient-1' },
            { left: '18%', top: '65%', scale: '1.75', delay: '1s', gradient: 'gradient-2' },
            { left: '28%', top: '35%', scale: '1.6', delay: '2s', gradient: 'gradient-3' },
            { left: '38%', top: '75%', scale: '1.85', delay: '0.5s', gradient: 'gradient-4' },
            { left: '48%', top: '15%', scale: '1.7', delay: '1.5s', gradient: 'gradient-1' },
            { left: '58%', top: '80%', scale: '1.95', delay: '2.5s', gradient: 'gradient-2' },
            { left: '68%', top: '25%', scale: '1.8', delay: '3s', gradient: 'gradient-3' },
            { left: '78%', top: '60%', scale: '1.65', delay: '1.8s', gradient: 'gradient-4' },
            { left: '88%', top: '40%', scale: '1.9', delay: '2.2s', gradient: 'gradient-1' },
            { left: '15%', top: '50%', scale: '1.75', delay: '0.8s', gradient: 'gradient-2' },
            { left: '72%', top: '85%', scale: '1.6', delay: '3.5s', gradient: 'gradient-3' },
            { left: '92%', top: '75%', scale: '1.85', delay: '1.2s', gradient: 'gradient-4' },
            { left: '5%', top: '80%', scale: '1.7', delay: '2.8s', gradient: 'gradient-1' },
            { left: '50%', top: '50%', scale: '1.75', delay: '0.3s', gradient: 'gradient-2' },
            { left: '85%', top: '18%', scale: '1.6', delay: '3.2s', gradient: 'gradient-3' },
            { left: '12%', top: '30%', scale: '1.8', delay: '1.6s', gradient: 'gradient-4' },
            { left: '32%', top: '55%', scale: '1.7', delay: '2.3s', gradient: 'gradient-1' },
            { left: '42%', top: '10%', scale: '1.65', delay: '0.7s', gradient: 'gradient-2' },
            { left: '62%', top: '45%', scale: '1.9', delay: '3.1s', gradient: 'gradient-3' },
            { left: '82%', top: '70%', scale: '1.75', delay: '1.4s', gradient: 'gradient-4' },
            { left: '22%', top: '85%', scale: '1.8', delay: '2.6s', gradient: 'gradient-1' },
            { left: '52%', top: '30%', scale: '1.7', delay: '0.9s', gradient: 'gradient-2' },
            { left: '95%', top: '55%', scale: '1.85', delay: '2.1s', gradient: 'gradient-3' },
            { left: '3%', top: '40%', scale: '1.65', delay: '3.3s', gradient: 'gradient-4' },
            { left: '45%', top: '90%', scale: '1.75', delay: '1.1s', gradient: 'gradient-1' },
            { left: '65%', top: '12%', scale: '1.9', delay: '2.9s', gradient: 'gradient-2' },
            { left: '75%', top: '48%', scale: '1.7', delay: '0.4s', gradient: 'gradient-3' },
            { left: '35%', top: '22%', scale: '1.8', delay: '3.4s', gradient: 'gradient-4' },
            { left: '55%', top: '65%', scale: '1.65', delay: '1.7s', gradient: 'gradient-1' }
        ];
        
        coinPositions.forEach((pos, index) => {
            const coin = document.createElement('span');
            coin.className = `icon-robux-16x16 roearn-checkout-floating-coin ${pos.gradient}`;
            coin.style.left = pos.left;
            coin.style.top = pos.top;
            coin.style.setProperty('--coin-scale', pos.scale);
            coin.style.setProperty('--entrance-delay', `${index * 0.03}s`);
            coin.style.animationDelay = pos.delay;
            pageBackground.appendChild(coin);
        });
        
        const launchGame = () => {
            window.dispatchEvent(new CustomEvent('roearn:launchGameBulk', {
                detail: JSON.stringify({
                    items: items,
                    userId: userId
                })
            }));
            
            startPurchaseMonitoring();
        };
        
        const playBtn = document.getElementById('roearn-play-btn');
        const autoJoinCheckbox = document.getElementById('roearn-auto-join');
        
        if (playBtn) {
            playBtn.addEventListener('click', function() {
                launchGame();
            });
        }
        
        if (autoJoinCheckbox) {
            const savedState = localStorage.getItem('roEarnAutoJoin');
            
            if (savedState === 'true') {
                autoJoinCheckbox.checked = true;
                setTimeout(() => {
                    launchGame();
                }, 500);
            }
            
            autoJoinCheckbox.addEventListener('change', function() {
                localStorage.setItem('roEarnAutoJoin', this.checked);
            });
        }
    }
}

window.addEventListener('roearn:showBulkCheckout', function(event) {
    const { items, userId } = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    showRoEarnBulkCheckout(items, userId);
});