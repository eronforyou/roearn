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

async function showRoEarnCheckout(thumbnail, assetName, assetId, assetType, userId, earnAmount, assetPrice) {
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
    
    function handlePurchaseSuccess() {
        window.dispatchEvent(new CustomEvent('roearn:removeFromCart', {
            detail: JSON.stringify({ assetId: assetId })
        }));
        
        sessionStorage.setItem('roearn_purchase_details', JSON.stringify({
            assetName: assetName,
            earnAmount: earnAmount,
            assetPrice: assetPrice
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
    
    async function getInventoryCount(authUserId, assetId, assetType) {
        try {
            let apiUrl;
            
            if (assetType === 'bundle') {
                apiUrl = `https://inventory.roblox.com/v1/users/${authUserId}/items/Bundle/${assetId}`;
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

    let ownershipCheckInterval = null;

    async function startPurchaseMonitoring() {
        if (ownershipCheckInterval) {
            clearInterval(ownershipCheckInterval);
        }
        
        const authUserId = await getAuthenticatedUserId();
        
        if (!authUserId) {
            return;
        }
        
        if (assetType === 'gamepass') {
            const initialOwnership = await checkItemOwnership(authUserId, assetId, assetType);
            if (initialOwnership) {
                handlePurchaseSuccess();
                return;
            }
            
            ownershipCheckInterval = setInterval(async () => {
                const isOwned = await checkItemOwnership(authUserId, assetId, assetType);
                
                if (isOwned) {
                    clearInterval(ownershipCheckInterval);
                    ownershipCheckInterval = null;
                    handlePurchaseSuccess();
                }
            }, 2000);
            return;
        }
        
        const alreadyOwned = await checkItemOwnership(authUserId, assetId, assetType);
        
        if (!alreadyOwned) {
            ownershipCheckInterval = setInterval(async () => {
                const isOwned = await checkItemOwnership(authUserId, assetId, assetType);
                
                if (isOwned) {
                    clearInterval(ownershipCheckInterval);
                    ownershipCheckInterval = null;
                    handlePurchaseSuccess();
                }
            }, 2000);
        } else {
            const initialCount = await getInventoryCount(authUserId, assetId, assetType);
            
            ownershipCheckInterval = setInterval(async () => {
                const currentCount = await getInventoryCount(authUserId, assetId, assetType);
                
                if (currentCount > initialCount) {
                    clearInterval(ownershipCheckInterval);
                    ownershipCheckInterval = null;
                    handlePurchaseSuccess();
                }
            }, 2000);
        }
    }
    
    const rbxBody = document.getElementById('rbx-body');
    const isDarkTheme = rbxBody && rbxBody.classList.contains('dark-theme');
    
    const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && window.innerWidth < 480;
    
    const formattedEarnAmount = formatNumber(earnAmount);
    const formattedAssetPrice = formatNumber(assetPrice);
    
    const style = document.createElement('style');
    style.id = 'roearn-checkout-styles';
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
        
        .dark-theme @keyframes coinEntrance {
            0% {
                opacity: 0;
                transform: translate(-50%, -50%) scale(0) rotate(0deg);
            }
            60% {
                opacity: 0.35;
            }
            100% {
                opacity: 0.3;
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
            padding: 30px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            text-align: center;
            position: relative;
        }
        
        .dark-theme .roearn-asset-card {
            background: #232527;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }
        
        .roearn-asset-image-container {
            position: relative;
            width: 100%;
            margin-bottom: 20px;
        }
        
        .roearn-asset-image-container.gamepass-container {
            width: 150px !important;
            height: 150px !important;
            margin-left: auto;
            margin-right: auto;
            margin-bottom: 20px;
            display: block;
            overflow: hidden;
            line-height: 0;
        }
        
        .roearn-asset-image-container.gamepass-container .roearn-asset-image {
            width: 150px !important;
            height: 150px !important;
            display: block;
            margin: 0 auto;
            object-fit: contain;
        }
        
        .roearn-asset-image {
            width: 100%;
            border-radius: 8px;
            object-fit: cover;
        }
        
        .roearn-price-badge {
            position: absolute;
            top: 12px;
            left: 12px;
            background: rgba(0, 0, 0, 0.7);
            border-radius: 8px;
            padding: 8px 12px;
            backdrop-filter: blur(10px);
            z-index: 10;
        }
        
        .roearn-price-badge .item-price-value {
            margin: 0;
            display: flex;
            align-items: center;
            gap: 4px;
        }
        
        .roearn-price-badge .icon-robux-16x16 {
            filter: brightness(0) invert(1);
            flex-shrink: 0;
            display: inline-block;
            margin-top: 1px;
            vertical-align: middle;
        }
        
        .roearn-price-badge .text-robux-lg {
            color: white;
            font-weight: 700;
            font-size: 18px;
            line-height: 1;
            display: inline-block;
            vertical-align: middle;
        }
        
        .roearn-asset-name {
            font-size: 24px;
            font-weight: bold;
            color: #393b3d;
            margin-bottom: 15px;
            line-height: 1.3;
            word-wrap: break-word;
        }
        
        .dark-theme .roearn-asset-name {
            color: #ffffff;
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
           MOBILE CHECKOUT — applied via .roearn-mobile class
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
            align-items: center;
            background: white;
            border-radius: 12px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            overflow: hidden;
            margin-bottom: 16px;
            height: 72px;
            box-sizing: border-box;
            width: 100%;
        }

        .dark-theme .roearn-asset-card-mobile {
            background: #232527;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        }

        .roearn-asset-card-mobile-info {
            min-width: 0;
            padding: 0 16px 0 14px;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 4px;
        }

        .roearn-asset-card-mobile-name {
            font-size: 13px;
            font-weight: 700;
            color: #393b3d;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.3;
            max-width: 220px;
        }

        .dark-theme .roearn-asset-card-mobile-name {
            color: #ffffff;
        }

        .roearn-asset-card-mobile-price {
            display: flex;
            align-items: center;
            gap: 4px;
            font-size: 13px;
            font-weight: 700;
            color: #393b3d;
            line-height: 1;
        }

        .dark-theme .roearn-asset-card-mobile-price {
            color: #d1d1d1;
        }

        .roearn-asset-card-mobile-price .icon-robux-16x16 {
            flex-shrink: 0;
            margin-top: 1px;
        }

        .dark-theme .roearn-asset-card-mobile-price .icon-robux-16x16 {
            filter: brightness(0) invert(1);
        }

        .roearn-asset-card-mobile-thumb {
            width: 72px;
            min-width: 72px;
            height: 72px;
            flex-shrink: 0;
            overflow: hidden;
            line-height: 0;
        }

        .roearn-asset-card-mobile-thumb img {
            width: 100%;
            height: 100%;
            object-fit: cover;
            display: block;
        }
    `;
    
    const existingStyle = document.getElementById('roearn-checkout-styles');
    if (existingStyle) {
        existingStyle.remove();
    }
    document.head.appendChild(style);

    const newContent = `
        <div class="roearn-checkout-page-background"></div>
        <div class="roearn-checkout-container${isMobileDevice ? ' roearn-mobile' : ''}">
            <div class="roearn-checkout-header">
                <div class="roearn-checkout-title">${getMessage("checkoutTitle")}</div>
                <div class="roearn-checkout-subtitle">${getMessage("checkoutSubtitle")}</div>
                <div class="roearn-checkout-savings-badge">
                    <span class="icon-robux-16x16" style="margin-top: 2px;"></span>
                    <span>${getMessage("checkoutSaveBadge", [formattedEarnAmount])}</span>
                </div>
            </div>
            
            <div class="roearn-checkout-content">
                <div class="roearn-asset-card roearn-asset-card-desktop">
                    <div class="roearn-price-badge">
                        <div class="item-price-value icon-text-wrapper clearfix icon-robux-price-container" style="margin-top: 3px;">
                            <span class="icon-robux-16x16" style="margin-top: -3px;"></span>
                            <span class="text-robux-lg">${formattedAssetPrice}</span>
                        </div>
                    </div>
                    <div class="roearn-asset-image-container${assetType === 'gamepass' ? ' gamepass-container' : ''}">
                        <img src="${thumbnail}" alt="${assetName}" class="roearn-asset-image">
                    </div>
                    <div class="roearn-asset-name">${assetName}</div>
                </div>
                
                <div>
                    <div class="roearn-asset-card-mobile">
                        <div class="roearn-asset-card-mobile-thumb">
                            <img src="${thumbnail}" alt="${assetName}">
                        </div>
                        <div class="roearn-asset-card-mobile-info">
                            <div class="roearn-asset-card-mobile-name">${assetName}</div>
                            <div class="roearn-asset-card-mobile-price">
                                <span class="icon-robux-16x16"></span>
                                <span>${formattedAssetPrice}</span>
                            </div>
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
                                ${getMessage("checkoutStep2", [`<span class="roearn-asset-highlight">${assetName}</span>`])}
                            </div>
                        </div>
                        
                        <div class="roearn-checkout-step">
                            <div class="roearn-step-number">3</div>
                            <div class="roearn-step-content">
                                ${getMessage("checkoutStep3", [`<span class="roearn-cashback-highlight"><span class="icon-robux-16x16" style="display: inline-block; margin-left: 0px; margin-right: -4.5px; margin-top: -2px;"></span> ${formattedEarnAmount}</span>`])}
                            </div>
                        </div>
                    </div>
                    
                    <div class="roearn-play-button-section">
                        <div class="roearn-play-button-container">
                            <div class="roearn-arrow-pointer" style="margin-top: -10px;">
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
                            </div>
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
            { left: '55%', top: '65%', scale: '1.65', delay: '1.7s', gradient: 'gradient-1' },
            { left: '90%', top: '28%', scale: '1.75', delay: '2.4s', gradient: 'gradient-2' },
            { left: '10%', top: '10%', scale: '1.8', delay: '1.3s', gradient: 'gradient-3' },
            { left: '25%', top: '70%', scale: '1.7', delay: '2.7s', gradient: 'gradient-4' },
            { left: '40%', top: '5%', scale: '1.9', delay: '0.6s', gradient: 'gradient-1' },
            { left: '60%', top: '95%', scale: '1.85', delay: '3.6s', gradient: 'gradient-2' },
            { left: '70%', top: '38%', scale: '1.75', delay: '1.9s', gradient: 'gradient-3' },
            { left: '80%', top: '8%', scale: '1.6', delay: '2.5s', gradient: 'gradient-4' },
            { left: '98%', top: '45%', scale: '1.7', delay: '0.2s', gradient: 'gradient-1' },
            { left: '7%', top: '58%', scale: '1.8', delay: '3.7s', gradient: 'gradient-2' },
            { left: '20%', top: '15%', scale: '1.65', delay: '1.5s', gradient: 'gradient-3' },
            { left: '33%', top: '88%', scale: '1.9', delay: '2.8s', gradient: 'gradient-4' },
            { left: '47%', top: '42%', scale: '1.75', delay: '0.9s', gradient: 'gradient-1' },
            { left: '63%', top: '68%', scale: '1.7', delay: '3.2s', gradient: 'gradient-2' },
            { left: '77%', top: '92%', scale: '1.85', delay: '1.7s', gradient: 'gradient-3' },
            { left: '87%', top: '52%', scale: '1.8', delay: '2.3s', gradient: 'gradient-4' },
            { left: '93%', top: '12%', scale: '1.6', delay: '0.8s', gradient: 'gradient-1' },
            { left: '4%', top: '72%', scale: '1.75', delay: '3.4s', gradient: 'gradient-2' },
            { left: '14%', top: '25%', scale: '1.9', delay: '1.4s', gradient: 'gradient-3' },
            { left: '27%', top: '48%', scale: '1.7', delay: '2.9s', gradient: 'gradient-4' },
            { left: '37%', top: '62%', scale: '1.65', delay: '0.5s', gradient: 'gradient-1' },
            { left: '53%', top: '78%', scale: '1.85', delay: '3.5s', gradient: 'gradient-2' },
            { left: '67%', top: '6%', scale: '1.8', delay: '1.8s', gradient: 'gradient-3' },
            { left: '73%', top: '35%', scale: '1.75', delay: '2.6s', gradient: 'gradient-4' },
            { left: '83%', top: '82%', scale: '1.7', delay: '0.4s', gradient: 'gradient-1' },
            { left: '96%', top: '65%', scale: '1.6', delay: '3.3s', gradient: 'gradient-2' },
            { left: '9%', top: '45%', scale: '1.9', delay: '1.6s', gradient: 'gradient-3' },
            { left: '24%', top: '92%', scale: '1.75', delay: '2.7s', gradient: 'gradient-4' },
            { left: '44%', top: '28%', scale: '1.85', delay: '0.7s', gradient: 'gradient-1' },
            { left: '56%', top: '58%', scale: '1.7', delay: '3.6s', gradient: 'gradient-2' },
            { left: '71%', top: '72%', scale: '1.65', delay: '1.2s', gradient: 'gradient-3' }
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
            window.dispatchEvent(new CustomEvent('roearn:launchGame', {
                detail: JSON.stringify({
                    assetId: assetId,
                    assetType: assetType,
                    userId: userId,
                    assetPrice: assetPrice
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

window.addEventListener('roearn:showCheckout', function(event) {
    const { thumbnail, assetName, assetId, assetType, userId, earnAmount, assetPrice } = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    showRoEarnCheckout(thumbnail, assetName, assetId, assetType, userId, earnAmount, assetPrice);
});