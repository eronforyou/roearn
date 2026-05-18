(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    (function injectHideCSS() {
        if (document.head) {
            const style = document.createElement('style');
            style.id = 'roearn-panel-hide-style';
            style.textContent = `
                #header-menu-icon {
                    display: none !important;
                }
                #roproThemeFrame {
                    display: none !important;
                }
                #content {
                    visibility: hidden !important;
                }
                #content.roearn-panel-ready {
                    visibility: visible !important;
                }
                    
            `;
            document.head.appendChild(style);
        } else {
            const headObserver = new MutationObserver(() => {
                if (document.head) {
                    headObserver.disconnect();
                    const style = document.createElement('style');
                    style.id = 'roearn-panel-hide-style';
                    style.textContent = `
                        #roproThemeFrame {
                            display: none !important;
                        }
                        #header-menu-icon {
                            display: none !important;
                        }
                        #content {
                            visibility: hidden !important;
                        }
                        #content.roearn-panel-ready {
                            visibility: visible !important;
                        }
                    `;
                    document.head.appendChild(style);
                }
            });
            headObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
    })();

    let cachedMessages = null;
    let messagesPromise = null;
    let cachedLocale = 'en';

    const localeMapping = {
        'en_us': 'en',
        'id_id': 'id',
        'de_de': 'de',
        'es_es': 'es',
        'fr_fr': 'fr',
        'it_it': 'it',
        'pl_pl': 'pl',
        'pt_br': 'pt_BR',
        'vi_vn': 'vi',
        'tr_tr': 'tr',
        'th_th': 'th',
        'zh_cn': 'zh_CN',
        'zh_tw': 'zh_TW',
        'ja_jp': 'ja',
        'ko_kr': 'ko',
        'ar_001': 'ar'
    };



    async function loadMessages() {
        if (cachedMessages) return cachedMessages;
        if (messagesPromise) return messagesPromise;
        
        messagesPromise = (async () => {
            let locale = 'en';
            
            try {
                const result = await api.storage.local.get(['userLocale']);
                locale = result.userLocale || 'en';
            } catch (e) {}

            cachedLocale = locale;
            
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

    let inviteBonusAmount = 15;

    async function loadInviteBonus() {
        return new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_INVITE_BONUS' },
                (response) => {
                    if (response && response.success) {
                        inviteBonusAmount = response.amount;
                    }
                    resolve();
                }
            );
        });
    }

    const localizationReady = loadMessages();
    await localizationReady;

    await loadInviteBonus();

    let countdownData = { countdownUIEnabled: false, timeRemainingSeconds: 0 };

    async function loadCountdownStatus() {
        return new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_COUNTDOWN' },
                (response) => {
                    if (response && response.success) {
                        countdownData = response;
                    }
                    resolve();
                }
            );
        });
    }

    await loadCountdownStatus();

    const setTitle = () => {
        document.title = getMessage("dashboardPageTitle");
    };

    setTitle();

    const spamInterval = setInterval(setTitle, 1);
    setTimeout(() => clearInterval(spamInterval), 1000);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTitle();
        });
    }

    window.addEventListener('load', () => {
        setTitle();
    });
    
    let cachedBalance = null;
    let cachedUserData = null;

    function userIdToReferralCode(userId) {
        const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
        const base = alphabet.length;
        let num = parseInt(userId);
        
        if (num === 0) return 'A';
        
        num = num + 1;
        
        let result = '';
        while (num > 0) {
            num = num - 1;
            result = alphabet[num % base] + result;
            num = Math.floor(num / base);
        }
        
        return result;
    }
    
    async function getAuthenticatedUser() {
        if (cachedUserData) {
            return cachedUserData;
        }

        try {
            const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
                credentials: 'include'
            });
            
            if (response.status === 401) {
                window.location.href = 'https://www.roblox.com/login?returnUrl=https%3A%2F%2Fwww.roblox.com%2Froearn';
                return null;
            }
            
            if (!response.ok) {
                return null;
            }
            
            const data = await response.json();
            cachedUserData = {
                id: data.id,
                name: data.name
            };
            return cachedUserData;
        } catch (error) {
            return null;
        }
    }

    async function getBalance(userId) {
        return new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_BALANCE', userId: userId },
                (response) => {
                    if (response && response.success) {
                        resolve(response.balance);
                    } else {
                        resolve(0);
                    }
                }
            );
        });
    }
    async function refreshBalance() {
        const userData = await getAuthenticatedUser();
        
        if (userData) {
            const newBalance = await getBalance(userData.id);
            cachedBalance = newBalance;
            
            const balanceAmountElement = document.querySelector('.roearn-balance-amount');
            if (balanceAmountElement) {
                balanceAmountElement.innerHTML = `
                    <span class="icon-robux-16x16" style="margin-top: 6px; margin-right: 6px;"></span>
                    ${newBalance.toLocaleString()}
                `;
            }
        }
    }

    window.addEventListener('roearn:refetchBalance', async () => {
        await refreshBalance();
    });

    async function createReferralVerificationGamepass() {
        try {
            const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
                credentials: 'include'
            });
            
            if (!userResponse.ok) {
                return { success: false, error: getMessage("errorAuthFailed") };
            }
            
            let userData;
            try {
                userData = await userResponse.json();
            } catch (jsonError) {
                return { success: false, error: getMessage("errorAuthRetry") };
            }
            
            const userId = userData.id;
            
            const inventoryUrl = `https://inventory.roblox.com/v1/users/${userId}/places/inventory?cursor=&itemsPerPage=100&placesTab=Created`;
            const inventoryResponse = await fetch(inventoryUrl, {
                credentials: 'include'
            });
            
            if (!inventoryResponse.ok) {
                return { success: false, error: getMessage("errorFetchGames") };
            }
            
            let inventoryData;
            try {
                inventoryData = await inventoryResponse.json();
            } catch (jsonError) {
                return { success: false, error: getMessage("errorFetchGamesRetry") };
            }
            
            if (!inventoryData.data || inventoryData.data.length === 0) {
                return { success: false, error: getMessage("errorNoGames") };
            }
            
            const firstGame = inventoryData.data[0];
            const gameData = {
                universeId: firstGame.universeId,
                placeId: firstGame.placeId,
                userId: userId
            };
            
            const xsrfResponse = await fetch('https://auth.roblox.com/v2/login', {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({})
            });
            
            const xsrfToken = xsrfResponse.headers.get('x-csrf-token');
            
            if (!xsrfToken) {
                return { success: false, error: getMessage("errorSecurityToken") };
            }
            
            const referralDescription = 'Do NOT create this gamepass manually. Anyone telling you to do so is trying to steal your referral. This gamepass was created automatically. If someone tells you to change your gamepass description to this, you are being scammed—do not listen to them.';
            
            const formData = new FormData();
            formData.append('name', 'Referral');
            formData.append('description', referralDescription);
            
            const gamepassResponse = await fetch(`https://apis.roblox.com/game-passes/v1/universes/${gameData.universeId}/game-passes`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'x-csrf-token': xsrfToken
                },
                body: formData
            });
            
            let gamepassData;
            try {
                gamepassData = await gamepassResponse.json();
            } catch (jsonError) {
                return { success: false, error: getMessage("errorCreateGamepass") };
            }
            
            if (gamepassResponse.status === 200) {
                const gamePassId = gamepassData.gamePassId;
                
                const detailsFormData = new FormData();
                detailsFormData.append('name', 'Referral');
                detailsFormData.append('description', referralDescription);

                const detailsResponse = await fetch(`https://apis.roblox.com/game-passes/v1/universes/${gameData.universeId}/game-passes/${gamePassId}`, {
                    method: 'PATCH',
                    credentials: 'include',
                    headers: {
                        'x-csrf-token': xsrfToken
                    },
                    body: detailsFormData
                });
                
                if (detailsResponse.status !== 200 && detailsResponse.status !== 204) {
                    let detailsResponseData;
                    try {
                        detailsResponseData = await detailsResponse.json();
                    } catch (jsonError) {
                        return { success: false, error: getMessage("errorUpdateGamepass") };
                    }
                    
                    const isInternalError = detailsResponseData.errorCode === 'InternalError';
                    const isOnSaleLimitReached = detailsResponseData.errorCode === 'BadRequest' &&
                                                detailsResponseData.field === 'isForSale';

                    if (isInternalError || isOnSaleLimitReached) {
                        let existingGamepass = null;
                        let cursor = null;
                        
                        while (!existingGamepass) {
                            const cursorParam = cursor ? `&cursor=${cursor}` : '';
                            const existingGamepassesResponse = await fetch(`https://apis.roblox.com/game-passes/v1/game-passes/universes/${gameData.universeId}/creator?count=100${cursorParam}`, {
                                credentials: 'include'
                            });
                            
                            if (!existingGamepassesResponse.ok) {
                                return { success: false, error: getMessage("errorFetchGamepasses") };
                            }
                            
                            let existingGamepassesData;
                            try {
                                existingGamepassesData = await existingGamepassesResponse.json();
                            } catch (jsonError) {
                                return { success: false, error: getMessage("errorFetchGamepasses") };
                            }
                            
                            existingGamepass = existingGamepassesData.gamePasses.find(gp => gp.isForSale === true);

                            if (existingGamepass) {
                                break;
                            }
                            
                            if (existingGamepassesData.cursor) {
                                cursor = existingGamepassesData.cursor;
                            } else {
                                break;
                            }
                        }
                        
                        if (!existingGamepass) {
                            return { success: false, error: getMessage("errorNoGamepasses") };
                        }
                        
                        const reusedGamePassId = existingGamepass.gamePassId;
                        
                        const reusedDetailsFormData = new FormData();
                        reusedDetailsFormData.append('name', 'Referral');
                        reusedDetailsFormData.append('description', referralDescription);

                        const reusedDetailsResponse = await fetch(`https://apis.roblox.com/game-passes/v1/universes/${gameData.universeId}/game-passes/${reusedGamePassId}`, {
                            method: 'PATCH',
                            credentials: 'include',
                            headers: {
                                'x-csrf-token': xsrfToken
                            },
                            body: detailsFormData
                        });
                        
                        if (reusedDetailsResponse.status !== 200 && reusedDetailsResponse.status !== 204) {
                            return { success: false, error: getMessage("errorUpdateVerification") };
                        }
                        
                        return {
                            success: true,
                            gamePassId: reusedGamePassId,
                            userId: gameData.userId
                        };
                    } else {
                        return { success: false, error: getMessage("errorUpdateGamepass") };
                    }
                }
                
                return {
                    success: true,
                    gamePassId: gamePassId,
                    userId: gameData.userId
                };
                
            } else {
                return { success: false, error: getMessage("errorCreateGamepass") };
            }
            
        } catch (error) {
            return { success: false, error: getMessage("errorUnexpected") };
        }
    }

    function injectHideCSS() {
        if (document.head) {
            const style = document.createElement('style');
            style.id = 'roearn-panel-hide-style';
            style.textContent = `
                @keyframes discordFadeOut {
                    from {
                        opacity: 1;
                        transform: scale(1);
                    }
                    to {
                        opacity: 0;
                        transform: scale(0.8);
                    }
                }

                .roearn-timeframe-countdown {
                    position: absolute;
                    top: -49px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    padding: 10px 24px;
                    border-radius: 25px;
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
                    z-index: 10;
                    font-size: 15px;
                    font-weight: 700;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    white-space: nowrap;
                }

                .dark-theme .roearn-timeframe-countdown {
                    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.3);
                }

                .roearn-countdown-content {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: white;
                    font-size: 12px;
                    font-weight: 600;
                    white-space: nowrap;
                }

                .roearn-countdown-timer {
                    font-family: 'Courier New', monospace;
                    font-weight: 700;
                    color: white;
                    font-size: 12px;
                }

                .dark-theme .roearn-countdown-timer {
                    color: #ffffff;
                }

                .roearn-discord-button a {
                    color: white;
                    font-weight: bold;
                    border-radius: 8px;
                    display: inline-flex;
                    align-items: center;
                    padding: 10px 15px;
                    background-color: #7289da;
                    text-decoration: none;
                    transition: background-color 0.2s, transform 0.2s;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
                    white-space: nowrap;
                }

                .roearn-discord-button a:hover {
                    background-color: #6a7fc9;
                }

                .roearn-discord-icon {
                    width: 25px;
                    height: 25px;
                    margin-right: 15px;
                    flex-shrink: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .roearn-discord-icon svg {
                    fill: white;
                    width: 100%;
                    height: 100%;
                }
           
                #content {
                    visibility: hidden !important;
                }
                #content.roearn-panel-ready {
                    visibility: visible !important;
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
                
                @keyframes spin {
                    from {
                        transform: rotate(0deg);
                    }
                    to {
                        transform: rotate(360deg);
                    }
                }

                .roearn-reload-icon {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    transition: opacity 0.2s;
                    opacity: 0.6;
                }
                
                .roearn-reload-icon:hover {
                    opacity: 1;
                }
                
                .roearn-reload-icon.spinning {
                    animation: spin 0.6s linear;
                }
                
                .roearn-reload-icon svg {
                    width: 100%;
                    height: 100%;
                    fill: #393b3d;
                }
                
                .dark-theme .roearn-reload-icon svg {
                    fill: #ffffff;
                }
                
                .roearn-panel-container {
                    max-width: 1200px;
                    margin: 0 auto;
                    padding: 40px 20px;
                    font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    position: relative;
                    z-index: 1;
                }
                
                .roearn-page-background {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    pointer-events: none;
                    z-index: 0;
                }
                
                .roearn-panel-container > * {
                    position: relative;
                    z-index: 1;
                }
                
                .roearn-panel-container > * {
                    position: relative;
                    z-index: 1;
                }
                
                .roearn-floating-coin {
                    position: absolute;
                    opacity: 0;
                    pointer-events: none;
                    animation: coinEntrance 1.2s ease-out forwards, float 6s ease-in-out infinite;
                    animation-delay: var(--entrance-delay, 0s), calc(var(--entrance-delay, 0s) + 1.2s);
                    transform: scale(var(--coin-scale, 1));
                    transform-origin: center center;
                }
                
                .roearn-floating-coin.gradient-1 {
                    filter: brightness(0) saturate(100%) invert(71%) sepia(48%) saturate(1290%) hue-rotate(181deg) brightness(103%) contrast(101%) drop-shadow(0 0 12px rgba(107, 181, 255, 0.6));
                }
                
                .roearn-floating-coin.gradient-2 {
                    filter: brightness(0) saturate(100%) invert(56%) sepia(60%) saturate(2384%) hue-rotate(225deg) brightness(101%) contrast(101%) drop-shadow(0 0 12px rgba(166, 107, 255, 0.6));
                }
                
                .roearn-floating-coin.gradient-3 {
                    filter: brightness(0) saturate(100%) invert(63%) sepia(72%) saturate(2548%) hue-rotate(261deg) brightness(102%) contrast(101%) drop-shadow(0 0 12px rgba(214, 107, 255, 0.6));
                }
                
                .roearn-floating-coin.gradient-4 {
                    filter: brightness(0) saturate(100%) invert(65%) sepia(77%) saturate(2701%) hue-rotate(302deg) brightness(101%) contrast(101%) drop-shadow(0 0 12px rgba(255, 107, 189, 0.6));
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
                
                .roearn-panel-header {
                    text-align: center;
                    margin-bottom: 50px;
                }
                
                .roearn-panel-title {
                    font-size: 48px;
                    font-weight: bold;
                    margin-bottom: 10px;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-panel-title {
                    color: #ffffff;
                }
                
                .roearn-panel-subtitle {
                    font-size: 19px;
                    color: #606162;
                }
                
                .dark-theme .roearn-panel-subtitle {
                    color: #d1d1d1;
                }
                
                .roearn-balance-section {
                    background: white;
                    border-radius: 12px;
                    padding: 15px 20px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    position: relative;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: auto;
                    max-height: 250px;
                }
                
                .dark-theme .roearn-balance-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-balance-label {
                    font-size: 26px;
                    font-weight: bold;
                    color: #393b3d;
                    margin-bottom: 5px;
                    text-align: center;
                }
                
                .dark-theme .roearn-balance-label {
                    color: #ffffff;
                }
                
                .dark-theme .roearn-balance-label[style*="color: #00a82d"] {
                    color: #00a82d !important;
                }
                
                .dark-theme .roearn-success-message {
                    color: #ffffff !important;
                }

                
                .roearn-balance-amount {
                    font-size: 56px;
                    font-weight: bold;
                    text-align: center;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 12px;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-balance-amount {
                    color: #ffffff;
                }
                
                .roearn-balance-amount .icon-robux-16x16 {
                    transform: scale(2.5);
                    image-rendering: -webkit-optimize-contrast;
                    image-rendering: crisp-edges;
                }
                
                .dark-theme .roearn-balance-amount .icon-robux-16x16 {
                    filter: brightness(0) invert(1);
                }
                
                .roearn-withdraw-button {
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    display: block;
                    padding: 0;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    height: 52px;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 20px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-withdraw-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-withdraw-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                
                .roearn-error-message {
                    color: #dc3545;
                    font-size: 14px;
                    margin-top: 12px;
                    text-align: center;
                    opacity: 0;
                    max-height: 0;
                    overflow: hidden;
                    transition: opacity 0.3s ease-out, max-height 0.3s ease-out;
                    position: absolute;
                    bottom: 20px;
                    left: 0;
                    right: 0;
                    width: 100%;
                }
                
                .roearn-error-message.show {
                    opacity: 1;
                    max-height: 100px;
                }
                
                .roearn-error-message a {
                    color: #dc3545;
                    text-decoration: underline;
                }
                
                .dark-theme .roearn-error-message {
                    color: #ff6b6b;
                }
                
                .dark-theme .roearn-error-message a {
                    color: #ff6b6b;
                }
                
                @keyframes fadeIn {
                    from {
                        opacity: 0;
                        transform: translateY(-5px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
                .roearn-two-column {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-bottom: 40px;
                    align-items: start;
                }
                
                @media (max-width: 900px) {
                    .roearn-two-column {
                        grid-template-columns: 1fr;
                    }
                }
                
                .roearn-balance-section {
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    position: relative;
                    overflow: hidden;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    min-height: 300px;
                    opacity: 1 !important;
                }

                .roearn-extras-card {
                    overflow: visible !important;
                    min-height: unset !important;
                    align-items: stretch !important;
                    justify-content: flex-start !important;
                    padding: 24px 30px !important;
                }
                
                .dark-theme .roearn-balance-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }
                
                .roearn-referral-section {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    opacity: 1 !important;
                    position: relative;
                    height: 677.49px;
                    overflow: visible;
                    display: flex;
                    flex-direction: column;
                }

                .roearn-extras-section {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    opacity: 1 !important;
                    position: relative;
                    overflow: visible;
                    height: 347.49px;
                    display: flex;
                    flex-direction: column;
                }

                .roearn-extras-section .roearn-extras-label {
                    color: #393b3d;
                    font-size: 16.5px;
                }

                .roearn-extras-section .roearn-extras-desc {
                    color: #606162;
                }

                .roearn-extras-section .roearn-extras-divider {
                    border-top-color: #e5e7eb !important;
                }

                .dark-theme .roearn-extras-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }

                .dark-theme .roearn-extras-section .roearn-extras-label {
                    color: #ffffff;
                }

                .dark-theme .roearn-extras-section .roearn-extras-desc {
                    color: #9ca3af;
                }

                .dark-theme .roearn-extras-section .roearn-extras-divider {
                    border-top-color: #3e4041 !important;
                }

                .roearn-two-column {
                    align-items: stretch;
                }

                .dark-theme .roearn-referral-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }
                
                .roearn-referral-list-section {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    opacity: 1 !important;
                    position: relative;
                    overflow: hidden;
                    margin-top: 0;
                }
                
                .roearn-two-column.has-referrals {
                    margin-bottom: 0;
                }
                
                .roearn-referral-list-section {
                    border-top-left-radius: 0;
                    border-top-right-radius: 0;
                }
                
                .roearn-referral-section.has-referrals {
                    border-bottom-left-radius: 0;
                    border-bottom-right-radius: 0;
                    margin-bottom: 0;
                }
                
                .dark-theme .roearn-referral-list-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }

                .dark-theme .roearn-referral-section {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                    opacity: 1 !important;
                }
                                
                .roearn-section-title {
                    font-size: 26px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-section-title {
                    color: #ffffff;
                }
                
                .roearn-referral-code-container {
                    background: #f8f8f8;
                    border-radius: 8px;
                    padding: 20px;
                    margin-bottom: 25px;
                    text-align: center;
                }
                
                .dark-theme .roearn-referral-code-container {
                    background: #2e3031;
                }
                
                .roearn-referral-code-label {
                    font-size: 14px;
                    color: #606162;
                    margin-bottom: 10px;
                }
                
                .dark-theme .roearn-referral-code-label {
                    color: #d1d1d1;
                }
                
                .roearn-referral-code {
                    font-size: 28px;
                    font-weight: bold;
                    color: #393b3d;
                    letter-spacing: 2px;
                    font-family: 'Courier New', monospace;
                }
                
                .dark-theme .roearn-referral-code {
                    color: #ffffff;
                }
                
                .roearn-referral-copy-button {
                    width: 100%;
                    padding: 12px;
                    margin-top: 15px;
                    background: #00a82d;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: transform 0.2s;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                }
                
                .roearn-referral-copy-button:hover {
                    transform: translateY(-1px);
                }
                
                .roearn-referral-stats {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 20px;
                    margin-bottom: 25px;
                }
                
                .roearn-referral-stat {
                    text-align: center;
                }
                
                .roearn-referral-stat-value {
                    font-size: 32px;
                    font-weight: bold;
                    color: #393b3d;
                    margin-bottom: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 5px;
                }
                
                .dark-theme .roearn-referral-stat-value {
                    color: #ffffff;
                }
                
                .roearn-referral-stat-label {
                    font-size: 14px;
                    color: #606162;
                }
                
                .dark-theme .roearn-referral-stat-label {
                    color: #ffffff;
                }
                
                .roearn-referral-description {
                    padding: 20px;
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.1), rgba(255, 107, 189, 0.1));
                    border-radius: 8px;
                    text-align: left;
                    font-size: 15px;
                    line-height: 1.6;
                    color: #393b3d;
                    position: relative;
                }
                
                .dark-theme .roearn-referral-description {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.05), rgba(255, 107, 189, 0.05));
                    color: #d1d1d1;
                }
                
                .roearn-referral-highlight {
                    font-weight: bold;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                }
                
                .roearn-view-referrals-button {
                    width: 100%;
                    padding: 14px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-view-referrals-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-referral-list-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    margin-top: 10px;
                }
                
                .roearn-sort-dropdown {
                    background: #f8f8f8;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    padding: 8px 12px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #393b3d;
                    cursor: pointer;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                .dark-theme .roearn-sort-dropdown {
                    background: #2e3031;
                    border-color: #3e4041;
                    color: #ffffff;
                }
                
                .roearn-sort-dropdown:hover {
                    border-color: rgb(166, 107, 255);
                }
                
               .roearn-referral-list-container {
                    max-height: 175px;
                    overflow-y: auto;
                    margin-bottom: 20px;
                    padding-right: 8px;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar {
                    width: 8px;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar-track {
                    background: #f1f1f1;
                    border-radius: 4px;
                }
                
                .dark-theme .roearn-referral-list-container::-webkit-scrollbar-track {
                    background: #2e3031;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar-thumb {
                    background: #888;
                    border-radius: 4px;
                }
                
                .roearn-referral-list-container::-webkit-scrollbar-thumb:hover {
                    background: #555;
                }
                
                .roearn-referral-item {
                    background: #f8f8f8;
                    border-radius: 8px;
                    padding: 15px 20px;
                    margin-bottom: 12px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }

                .dark-theme .roearn-referral-item {
                    background: #2e3031;
                }
                
                .roearn-referral-avatar {
                    width: 50px;
                    height: 50px;
                    border-radius: 50%;
                    object-fit: cover;
                    cursor: pointer;
                    transition: transform 0.2s;
                    flex-shrink: 0;
                }
                
                .roearn-referral-avatar:hover {
                    transform: scale(1.1);
                }
                
                .roearn-referral-item-info {
                    display: flex;
                    flex-direction: column;
                    gap: 4px;
                    flex: 1;
                    min-width: 0;
                }
                
                .roearn-referral-item-username {
                    font-size: 16px;
                    font-weight: bold;
                    color: #393b3d;
                    cursor: pointer;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .dark-theme .roearn-referral-item-username {
                    color: #ffffff;
                }
                                
                .roearn-referral-item-displayname {
                    font-size: 14px;
                    color: #606162;
                    white-space: nowrap;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
                
                .dark-theme .roearn-referral-item-displayname {
                    color: #d1d1d1;
                }
                
                .roearn-referral-item-timestamp {
                    font-size: 13px;
                    color: #606162;
                    margin-left: auto;
                    white-space: nowrap;
                    flex-shrink: 0;
                }
                
                .dark-theme .roearn-referral-item-timestamp {
                    color: #d1d1d1;
                }

                .roearn-referral-alt-tag {
                    font-size: 13px;
                    font-weight: 600;
                    color: #b45309;
                    background: #fef3c7;
                    border-radius: 6px;
                    padding: 3px 9px;
                    margin-left: auto;
                    flex-shrink: 0;
                    white-space: nowrap;
                    cursor: default;
                }

                .dark-theme .roearn-referral-alt-tag {
                    color: #fbbf24;
                    background: rgba(251, 191, 36, 0.12);
                }

                .roearn-alt-tooltip {
                    display: none;
                    position: fixed;
                    width: 286px;
                    background: #1e2022;
                    color: #e5e7eb;
                    font-size: 15px;
                    font-weight: 400;
                    line-height: 1.5;
                    border-radius: 8px;
                    padding: 12px 16px;
                    box-shadow: 0 4px 16px rgba(0,0,0,0.35);
                    z-index: 99999;
                    pointer-events: none;
                    white-space: normal;
                    text-align: left;
                }

                .roearn-alt-tooltip::after {
                    content: '';
                    position: absolute;
                    top: 100%;
                    right: 14px;
                    border: 8px solid transparent;
                    border-top-color: #1e2022;
                }

                .roearn-pending-notice {
                    text-align: center;
                    font-size: 14.5px;
                    color: #393b3d;
                    margin-top: 12px;
                    font-weight: 600;
                    opacity: 0;
                    max-height: 0;
                    overflow: hidden;
                    transition: opacity 0.3s ease-out, max-height 0.3s ease-out;
                }

                .roearn-pending-notice.show {
                    opacity: 1;
                    max-height: 50px;
                }

                .dark-theme .roearn-pending-notice {
                    color: #ffffff;
                }
                
                .roearn-referral-loading {
                    text-align: center;
                    padding: 40px;
                    color: #606162;
                    font-size: 16px;
                }
                
                .dark-theme .roearn-referral-loading {
                    color: #d1d1d1;
                }
                
                .roearn-play-button {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 100;
                    transition: transform 0.2s, opacity 0.3s ease;
                    filter: drop-shadow(0 4px 20px rgba(0, 0, 0, 0.5));
                }

                .roearn-play-button.roearn-controls-hidden {
                    opacity: 0;
                    pointer-events: none;
                }

                .roearn-play-button svg {
                    fill: url(#playGradient);
                }

                .roearn-play-button:hover {
                    transform: translate(-50%, -50%) scale(1.1);
                }

                .roearn-video-controls {
                    position: absolute;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: linear-gradient(transparent, rgba(0, 0, 0, 0.8));
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    z-index: 100;
                    user-select: none;
                    -webkit-user-select: none;
                    opacity: 1;
                    transition: opacity 0.3s ease;
                }

                .roearn-video-controls.roearn-controls-hidden {
                    opacity: 0;
                }

                .roearn-control-btn {
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    opacity: 0.9;
                    transition: opacity 0.2s;
                }

                .roearn-control-btn:hover {
                    opacity: 1;
                }

                .roearn-time-display {
                    color: white;
                    font-size: 13px;
                    font-weight: 500;
                    min-width: 90px;
                }

                .roearn-progress-container {
                    flex: 1;
                }

                .roearn-progress-bar {
                    height: 6px;
                    background: rgba(255, 255, 255, 0.3);
                    border-radius: 3px;
                    cursor: pointer;
                    position: relative;
                }

                .roearn-progress-fill {
                    height: 100%;
                    background: white;
                    border-radius: 3px;
                    width: 0%;
                    transition: width 0.1s;
                }

                .roearn-progress-bar:hover .roearn-progress-fill {
                    background: rgb(166, 107, 255);
                }
                .roearn-back-button {
                    position: absolute;
                    top: 30px;
                    left: 30px;
                    background: #6c757d;
                    color: white;
                    border: none;
                    border-radius: 6px;
                    padding: 8px 16px;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: background 0.2s, transform 0.2s;
                }

                .roearn-referral-announcement {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    padding: 12px 16px;
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.1), rgba(255, 107, 189, 0.1));
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    color: #393b3d;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    z-index: 10;
                }

                .dark-theme .roearn-referral-announcement {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.05), rgba(255, 107, 189, 0.05));
                    color: #d1d1d1;
                }

                .roearn-referral-announcement-icon {
                    font-size: 16px;
                }

                .roearn-referral-section > .roearn-reload-icon {
                    display: none !important;
                }

                .roearn-back-button:hover {
                    background: #5a6268;
                    transform: translateY(-1px);
                }
                
                .roearn-modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    width: 100vw;
                    height: 100vh;
                    background: rgba(0, 0, 0, 0.7);
                    z-index: 10000;
                    opacity: 0;
                    transition: opacity 0.3s;
                }
                
                .roearn-modal-overlay.show {
                    opacity: 1;
                }
                
                .roearn-modal {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%) scale(0.9);
                    background: white;
                    border-radius: 12px;
                    padding: 40px;
                    max-width: 500px;
                    width: 90%;
                    transition: transform 0.3s;
                }
                
                .dark-theme .roearn-modal {
                    background: #232527;
                }
                
                .roearn-modal-overlay.show .roearn-modal {
                    transform: translate(-50%, -50%) scale(1);
                }
                
                .roearn-modal-title {
                    font-size: 28px;
                    font-weight: bold;
                    margin-bottom: 20px;
                    text-align: center;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-modal-title {
                    color: #bdbebe;
                }
                
                .roearn-modal-content {
                    margin-bottom: 30px;
                    text-align: center;
                }
                
                .roearn-modal-balance {
                    font-size: 42px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 10px;
                    margin: 20px 0;
                    color: #393b3d;
                }
                
                .dark-theme .roearn-modal-balance {
                    color: #bdbebe;
                }
                
                .roearn-modal-balance .icon-robux-16x16 {
                    transform: scale(2);
                }
                
                .roearn-modal-text {
                    font-size: 16px;
                    color: #606162;
                    line-height: 1.6;
                }
                
                .dark-theme .roearn-modal-text {
                    color: #949596;
                }
                
                .roearn-modal-buttons {
                    display: flex;
                    gap: 15px;
                }
                
                .roearn-modal-button {
                    flex: 1;
                    padding: 14px;
                    border: none;
                    border-radius: 8px;
                    font-weight: bold;
                    font-size: 16px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-modal-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-modal-button-confirm {
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.5) 0px 1px 2px;
                }
                
                .roearn-modal-button-cancel {
                    background: #6c757d;
                    color: white;
                }
                
                .roearn-modal-button-cancel:hover {
                    background: #5a6268;
                }
                
                .roearn-onboarding-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 30px;
                    margin-top: 30px;
                    align-items: start;
                }
                
                @media (max-width: 1000px) {
                    .roearn-onboarding-container {
                        grid-template-columns: 1fr;
                    }
                }
                
                .roearn-onboarding-video-section {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .roearn-onboarding-video-container {
                    user-select: none;
                    -webkit-user-select: none;
                    width: 100%;
                    max-width: 640px;
                    position: relative;
                    padding-bottom: 56.25%;
                    height: 0;
                    overflow: hidden;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                    background: #000;
                }
                                
                .roearn-onboarding-video {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    border-radius: 12px;
                }
                
                .roearn-referral-entry-card {
                    background: white;
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                }
                
                .dark-theme .roearn-referral-entry-card {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-referral-entry-title {
                    font-size: 28px;
                    font-weight: bold;
                    color: #393b3d;
                    margin-bottom: 15px;
                }
                
                .dark-theme .roearn-referral-entry-title {
                    color: #ffffff;
                }
                
                .roearn-referral-entry-description {
                    font-size: 16px;
                    color: #606162;
                    margin-bottom: 30px;
                }
                
                .dark-theme .roearn-referral-entry-description {
                    color: #d1d1d1;
                }
                
                .roearn-referral-input-container {
                    margin-bottom: 30px;
                    position: relative;
                }
                
                .roearn-referral-input {
                    width: 100%;
                    max-width: 400px;
                    padding: 15px 60px 15px 20px;
                    font-size: 20px;
                    border: 2px solid #e0e0e0;
                    border-radius: 8px;
                    text-align: center;
                    font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    font-weight: 700;
                    outline: none;
                    transition: border-color 0.2s;
                    background: #f5f5f5;
                }

                .roearn-referral-input::placeholder {
                    text-align: center;
                }
                
                .roearn-referral-input-error {
                    border-color: #dc3545 !important;
                }
                
                .roearn-referral-error {
                    color: #dc3545;
                    font-size: 14px;
                    margin-top: 8px;
                    opacity: 0;
                    transition: opacity 0.2s;
                    position: absolute;
                    left: 50%;
                    transform: translateX(-50%);
                    white-space: nowrap;
                }
                
                .roearn-referral-error.show {
                    opacity: 1;
                }
                
                .roearn-referral-input:focus {
                    border-color: rgb(166, 107, 255);
                }
                
                .dark-theme .roearn-referral-input {
                    background: #2e3031;
                    border-color: #3e4041;
                    color: #ffffff;
                }
                
                .dark-theme .roearn-referral-input:focus {
                    border-color: rgb(166, 107, 255);
                }
                
                .roearn-referral-button-container {
                    display: flex;
                    gap: 15px;
                    justify-content: center;
                }
                
                .roearn-referral-continue-button {
                    padding: 14px 40px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-referral-continue-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-referral-skip-button {
                    padding: 14px 40px;
                    background: #6c757d;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s, background 0.2s;
                }
                
                .roearn-referral-skip-button:hover {
                    background: #5a6268;
                    transform: translateY(-2px);
                }
                    
                .roearn-agreement-continue-button {
                    width: 100%;
                    max-width: 400px;
                    margin: 0 auto;
                    display: block;
                    padding: 14px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                }

                .roearn-agreement-continue-button:hover {
                    transform: translateY(-2px);
                }

                .roearn-agreement-continue-button:disabled {
                    cursor: not-allowed;
                    opacity: 0.7;
                }
                
                .roearn-start-button-container {
                    display: flex;
                    justify-content: center;
                    margin-top: 30px;
                }
                
                .roearn-start-button {
                    padding: 16px 50px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 20px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-start-button:hover {
                    transform: translateY(-2px);
                }
                
                .roearn-tutorial-slide {
                    background: white;
                    border-radius: 12px;
                    padding: 0;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    margin-top: 30px;
                    overflow: hidden;
                    max-width: 1100px;
                    margin-left: auto;
                    margin-right: auto;
                    min-height: 500px;
                }
                
                .dark-theme .roearn-tutorial-slide {
                    background: #232527;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-tutorial-content-side {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.08), rgba(255, 107, 189, 0.08));
                    padding: 50px 40px;
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    gap: 30px;
                    position: relative;
                }
                
                .dark-theme .roearn-balance-section div[style*="color: #393b3d"] {
                    color: #ffffff !important;
                }

                .dark-theme .roearn-balance-section div[style*="color: #606162"] {
                    color: #d1d1d1 !important;
                }

                .dark-theme .roearn-tutorial-content-side {
                    background: linear-gradient(135deg, rgba(107, 181, 255, 0.05), rgba(255, 107, 189, 0.05));
                }
                
                .roearn-tutorial-content-side::before {
                    content: '';
                    position: absolute;
                    left: 0;
                    top: 0;
                    bottom: 0;
                    width: 4px;
                    background: linear-gradient(180deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189));
                }
                
                .roearn-tutorial-text {
                    font-size: 18px;
                    line-height: 1.8;
                    color: #393b3d;
                    text-align: center;
                    max-width: 400px;
                }
                
                .dark-theme .roearn-tutorial-text {
                    color: #d1d1d1;
                }
                
                .roearn-tutorial-image-column {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    align-items: center;
                    width: 100%;
                }
                
                .roearn-tutorial-image-container {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 40px;
                    width: 100%;
                    height: 100%;
                    background: #fafafa;
                }
                
                .dark-theme .roearn-tutorial-image-container {
                    background: #1a1b1c;
                }
                
                .roearn-tutorial-image {
                    max-width: 100%;
                    max-height: 100%;
                    width: auto;
                    height: auto;
                    object-fit: contain;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
                }
                
                .dark-theme .roearn-tutorial-image {
                    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
                }
                
                .roearn-tutorial-continue-button {
                    padding: 14px 40px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-tutorial-continue-button {
                    padding: 14px 40px;
                    background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                    border: none;
                    border-radius: 8px;
                    color: white;
                    text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                    font-weight: bold;
                    font-size: 18px;
                    cursor: pointer;
                    transition: transform 0.2s;
                }
                
                .roearn-tutorial-continue-button:hover {
                    transform: translateY(-2px);
                }
                
                @media (max-width: 900px) {
                    .roearn-tutorial-slide {
                        grid-template-columns: 1fr;
                        gap: 30px;
                    }
                    
                    .roearn-tutorial-image-container {
                        order: -1;
                    }
                }

                /* ═══════════════════════════════════════════════════════
                   MOBILE DASHBOARD — applied via .roearn-mobile class
                   set in JS only when UA matches iPhone/iPad/iPod/Android
                   Desktop layout is completely unaffected by these rules.
                   ═══════════════════════════════════════════════════════ */

                .roearn-mobile {
                    padding: 12px !important;
                    max-width: 100% !important;
                    box-sizing: border-box !important;
                    overflow-x: hidden !important;
                    margin: 0 !important;
                }

                .roearn-mobile .roearn-panel-header {
                    text-align: center !important;
                    margin-bottom: 20px !important;
                    padding: 0 4px !important;
                }

                .roearn-mobile .roearn-panel-title {
                    font-size: 26px !important;
                    margin-bottom: 6px !important;
                }

                .roearn-mobile .roearn-panel-subtitle {
                    font-size: 13px !important;
                    line-height: 1.4 !important;
                }

                .roearn-mobile .roearn-two-column {
                    display: flex !important;
                    flex-direction: column !important;
                    gap: 12px !important;
                    margin-bottom: 12px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                }

                .roearn-mobile .roearn-two-column > div {
                    width: 100% !important;
                    box-sizing: border-box !important;
                }

                .roearn-mobile .roearn-balance-section {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 20px !important;
                    border-radius: 12px !important;
                    min-height: unset !important;
                    max-height: unset !important;
                    margin-bottom: 12px !important;
                }

                .roearn-mobile .roearn-balance-amount {
                    font-size: 48px !important;
                }

                .roearn-mobile .roearn-balance-label {
                    font-size: 18px !important;
                }

                .roearn-mobile .roearn-extras-section {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 20px !important;
                    border-radius: 12px !important;
                    margin-top: 0 !important;
                    height: unset !important;
                    min-height: unset !important;
                }

                .roearn-mobile .roearn-referral-section {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 20px !important;
                    border-radius: 12px !important;
                    height: unset !important;
                    min-height: unset !important;
                }

                .roearn-mobile .roearn-referral-list-section {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 20px !important;
                    border-radius: 12px !important;
                }

                .roearn-mobile-ext-section {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    margin-top: 12px !important;
                }

                .roearn-mobile-ext-section > div {
                    width: 100% !important;
                    box-sizing: border-box !important;
                    padding: 20px !important;
                    border-radius: 12px !important;
                }
            `;
            document.head.appendChild(style);
            return true;
        }
        return false;
    }

    if (!injectHideCSS()) {
        const headObserver = new MutationObserver(() => {
            if (injectHideCSS()) {
                headObserver.disconnect();
            }
        });
        headObserver.observe(document.documentElement, {
            childList: true,
            subtree: true
        });
    }

    let globalPrefetchedData = null;

    async function prefetchAllData() {        
        const userData = await getAuthenticatedUser();
        if (!userData) {
            return null;
        }

        const [balance, withdrawalBalance, referralStats, videoData] = await Promise.all([
            getBalance(userData.id),
            new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_BALANCE', userId: userData.id },
                    (response) => resolve(response?.success ? response.balance : 0)
                );
            }),
            new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_REFERRAL_STATS', userId: userData.id },
                    (response) => {
                        if (response?.success) {
                            resolve({
                                totalEarnings: response.totalEarnings,
                                totalReferrals: response.totalReferrals
                            });
                        } else {
                            resolve({ totalEarnings: 0, totalReferrals: 0 });
                        }
                    }
                );
            }),
            new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_VIDEO_SUBMISSIONS', userId: userData.id },
                    (response) => {
                        if (response?.status === 'ok') {
                            resolve({
                                submissions: response.submissions || [],
                                totalEarnedRobux: response.total_earned_robux || 0,
                                totalPaidViews: response.total_paid_views || 0
                            });
                        } else {
                            resolve({ submissions: [], totalEarnedRobux: 0, totalPaidViews: 0 });
                        }
                    }
                );
            })
        ]);

        cachedBalance = balance;

        const rejectedCountKey = `rejectedVideoCount_${userData.id}`;
        const currentRejectedCount = (videoData.submissions || []).filter(s => s.status === 'rejected').length;
        const storedRejectedData = await new Promise((resolve) => {
            api.storage.local.get([rejectedCountKey], (r) => resolve(r));
        });
        const previousRejectedCount = storedRejectedData[rejectedCountKey] !== undefined
            ? storedRejectedData[rejectedCountKey]
            : 0;
        api.storage.local.set({ [rejectedCountKey]: currentRejectedCount });

        const rejectionIncreased = currentRejectedCount > previousRejectedCount;

        const hasReferral = await new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'HAS_REFERRAL', userId: userData.id },
                (response) => resolve(response?.success ? response.hasReferral : false)
            );
        });

        const result = {
            userData,
            balance,
            withdrawalBalance,
            referralStats,
            referralCode: userIdToReferralCode(userData.id),
            hasReferral,
            videoSubmissions: videoData.submissions,
            videoTotalEarned: videoData.totalEarnedRobux,
            videoTotalViews: videoData.totalPaidViews,
            rejectionIncreased
        };

        if (referralStats.totalReferrals >= 1) {
            const referralList = await new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_REFERRAL_LIST', userId: userData.id },
                    (response) => resolve(response?.success ? response.referrals : [])
                );
            });

            if (referralList.length > 0) {
                const userIds = referralList.map(r => parseInt(r.userId));
                const [userDataList, thumbnails] = await Promise.all([
                    fetchUserData(userIds),
                    fetchAvatarThumbnails(userIds)
                ]);

                result.referralData = {
                    referralList,
                    userDataList,
                    thumbnails
                };
            }
        }

        return result;
    }
        

        async function fetchUserData(userIds) {
            const batchSize = 100;
            const batches = [];
            
            for (let i = 0; i < userIds.length; i += batchSize) {
                batches.push(userIds.slice(i, i + batchSize));
            }
            
            const allUserData = [];
            
            for (const batch of batches) {
                try {
                    const response = await fetch('https://users.roblox.com/v1/users', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            userIds: batch,
                            excludeBannedUsers: false
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        allUserData.push(...data.data);
                    }
                } catch (error) {
                }
            }
            
            return allUserData;
        }

        async function fetchAvatarThumbnails(userIds) {
            const batchSize = 90;
            const batches = [];
            
            for (let i = 0; i < userIds.length; i += batchSize) {
                batches.push(userIds.slice(i, i + batchSize));
            }
            
            const allThumbnails = {};
            
            for (const batch of batches) {
                try {
                    const payload = batch.map(userId => ({
                        requestId: `${userId}:undefined:AvatarHeadshot:150x150:webp:regular:0`,
                        type: "AvatarHeadShot",
                        targetId: userId,
                        format: "webp",
                        size: "150x150"
                    }));
                    
                    const response = await fetch('https://thumbnails.roblox.com/v1/batch', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify(payload)
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        data.data.forEach(item => {
                            allThumbnails[item.targetId] = item.imageUrl;
                        });
                    }
                } catch (error) {
                }
            }
            
            return allThumbnails;
    }
        
    let openExtensionWatermarkGuide = null;

    async function createRoEarnPanel() {
        const prefetchedData = globalPrefetchedData;
        let prefetchedReferralData = prefetchedData?.referralData || null;

        let countdownData = { countdownUIEnabled: false, timeRemainingSeconds: 0 };
        
        countdownData = await new Promise((resolve) => {
            api.runtime.sendMessage(
                { type: 'GET_COUNTDOWN' },
                (response) => {
                    if (response && response.success) {
                        resolve(response);
                    } else {
                        resolve({ countdownUIEnabled: false, timeRemainingSeconds: 0 });
                    }
                }
            );
        });

        const tutorialCompleted = await new Promise((resolve) => {
            api.storage.local.get(['tutorialCompleted'], (result) => {
                resolve(result.tutorialCompleted === true);
            });
        });

        let showContentCreatorUI = await new Promise((resolve) => {
            api.storage.local.get(['showContentCreatorUI', 'hasWithdrawn'], (result) => {
                resolve(result.showContentCreatorUI === true || result.hasWithdrawn === true);
            });
        });

        if (prefetchedData && prefetchedData.referralStats.totalReferrals >= 1) {
            showContentCreatorUI = true;
            if (!await new Promise((resolve) => {
                api.storage.local.get(['showContentCreatorUI'], (result) => {
                    resolve(result.showContentCreatorUI === true);
                });
            })) {
                api.storage.local.set({ showContentCreatorUI: true });
            }
        }
        
        const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && window.innerWidth < 480;

        const panel = document.createElement('div');
        panel.className = 'roearn-panel-container';
        if (isMobileDevice) panel.classList.add('roearn-mobile');

        
        if (!tutorialCompleted) {
            const userData = await getAuthenticatedUser();
            let userHasReferral = false;
            if (userData) {
                userHasReferral = await new Promise((resolve) => {
                    api.runtime.sendMessage(
                        { type: 'HAS_REFERRAL', userId: userData.id },
                        (response) => resolve(response?.success ? response.hasReferral : false)
                    );
                });
            }

            if (userHasReferral) {
                await new Promise((resolve) => api.storage.local.set({ tutorialCompleted: true }, resolve));
                
                const content = await waitForContent();
                content.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 400px;"><span class="spinner spinner-default"></span></div>';
                content.classList.add('roearn-panel-ready');
                
                globalPrefetchedData = await prefetchAllData();
                const panel = await createRoEarnPanel();
                content.innerHTML = '';
                content.appendChild(panel);
                return panel;
            }

            const header = document.createElement('div');
            header.className = 'roearn-panel-header';
            header.innerHTML = `
                <div class="roearn-panel-title">${getMessage("welcomeTitle")}</div>
                <div class="roearn-panel-subtitle">${getMessage("welcomeSubtitle")}</div>
            `;
            
            const onboardingContainer = document.createElement('div');
            onboardingContainer.className = 'roearn-onboarding-container';
            
            const videoSection = document.createElement('div');
            videoSection.className = 'roearn-onboarding-video-section';
            
            const videoContainer = document.createElement('div');
            videoContainer.className = 'roearn-onboarding-video-container';

            const video = document.createElement('video');
            video.className = 'roearn-onboarding-video';
            video.src = `https://roearn-videos.store/${cachedLocale}.mp4`;
            video.playsInline = true;
            video.preload = 'auto';
            video.disablePictureInPicture = true;
            video.controlsList = 'nodownload noplaybackrate nofullscreen';
            video.oncontextmenu = (e) => e.preventDefault();

            const playButton = document.createElement('div');
            playButton.className = 'roearn-play-button';
            playButton.innerHTML = `
                <svg width="120" height="120" viewBox="0 0 24 24">
                    <defs>
                        <linearGradient id="playGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" style="stop-color:rgb(107, 181, 255)"/>
                            <stop offset="33%" style="stop-color:rgb(166, 107, 255)"/>
                            <stop offset="66%" style="stop-color:rgb(214, 107, 255)"/>
                            <stop offset="100%" style="stop-color:rgb(255, 107, 189)"/>
                        </linearGradient>
                    </defs>
                    <path d="M8 5v14l11-7z" fill="url(#playGradient)"/>
                </svg>
            `;

            const controls = document.createElement('div');
            controls.className = 'roearn-video-controls';

            const playPauseBtn = document.createElement('div');
            playPauseBtn.className = 'roearn-control-btn';
            playPauseBtn.innerHTML = `
                <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="white">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <svg class="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="white" style="display:none;">
                    <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
            `;

            const timeDisplay = document.createElement('div');
            timeDisplay.className = 'roearn-time-display';
            timeDisplay.textContent = '0:00 / 0:00';

            const progressContainer = document.createElement('div');
            progressContainer.className = 'roearn-progress-container';

            const progressBar = document.createElement('div');
            progressBar.className = 'roearn-progress-bar';

            const progressFill = document.createElement('div');
            progressFill.className = 'roearn-progress-fill';

            progressBar.appendChild(progressFill);
            progressContainer.appendChild(progressBar);

            controls.appendChild(playPauseBtn);
            controls.appendChild(timeDisplay);
            controls.appendChild(progressContainer);

            function formatTime(seconds) {
                const mins = Math.floor(seconds / 60);
                const secs = Math.floor(seconds % 60);
                return `${mins}:${secs.toString().padStart(2, '0')}`;
            }

            function updatePlayPauseIcons(playing) {
                playPauseBtn.querySelector('.play-icon').style.display = playing ? 'none' : 'block';
                playPauseBtn.querySelector('.pause-icon').style.display = playing ? 'block' : 'none';
            }

            let isDragging = false;
            let isHovering = false;
            let hasPlayed = false;

            function showControls() {
                controls.classList.remove('roearn-controls-hidden');
            }

            function hideControls() {
                controls.classList.add('roearn-controls-hidden');
            }

            function showPlayButton() {
                playButton.classList.remove('roearn-controls-hidden');
            }

            function hidePlayButton() {
                playButton.classList.add('roearn-controls-hidden');
            }

            function tryPlay() {
                if (video.readyState < 2) {
                    video.load();
                }
                video.play().catch(() => {
                    video.load();
                    video.play().catch(() => {});
                });
            }

            playButton.addEventListener('click', tryPlay);

            playPauseBtn.addEventListener('click', () => {
                if (video.paused) {
                    tryPlay();
                } else {
                    video.pause();
                }
            });

            video.addEventListener('click', () => {
                if (video.paused) {
                    tryPlay();
                } else {
                    video.pause();
                }
            });

            video.addEventListener('play', () => {
                hasPlayed = true;
                updatePlayPauseIcons(true);
                hidePlayButton();
                if (!isHovering) {
                    hideControls();
                }
            });

            video.addEventListener('pause', () => {
                updatePlayPauseIcons(false);
                showControls();
            });

            video.addEventListener('ended', () => {
                hasPlayed = false;
                updatePlayPauseIcons(false);
                showPlayButton();
                showControls();
            });

            video.addEventListener('error', () => {
                video.load();
            });

            video.addEventListener('stalled', () => {
                const currentTime = video.currentTime;
                video.load();
                video.currentTime = currentTime;
                if (hasPlayed && !video.paused) {
                    video.play().catch(() => {});
                }
            });

            video.addEventListener('timeupdate', () => {
                if (!video.duration || !isFinite(video.duration)) return;
                const percent = (video.currentTime / video.duration) * 100;
                progressFill.style.width = `${percent}%`;
                timeDisplay.textContent = `${formatTime(video.currentTime)} / ${formatTime(video.duration || 0)}`;
            });

            videoContainer.addEventListener('mouseenter', () => {
                isHovering = true;
                showControls();
            });

            videoContainer.addEventListener('mouseleave', () => {
                isHovering = false;
                if (!video.paused) {
                    hideControls();
                }
            });

            function seek(e) {
                if (!video.duration || !isFinite(video.duration)) return;
                const rect = progressBar.getBoundingClientRect();
                const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                video.currentTime = percent * video.duration;
                progressFill.style.width = `${percent * 100}%`;
            }

            progressBar.addEventListener('mousedown', (e) => {
                isDragging = true;
                seek(e);
            });

            document.addEventListener('mousemove', (e) => {
                if (isDragging) {
                    seek(e);
                }
            });

            document.addEventListener('mouseup', () => {
                isDragging = false;
            });

            videoContainer.appendChild(video);
            videoContainer.appendChild(playButton);
            videoContainer.appendChild(controls);
            videoSection.appendChild(videoContainer);
            
            const referralCard = document.createElement('div');
            referralCard.className = 'roearn-referral-entry-card';
            
            const referralTitle = document.createElement('div');
            referralTitle.className = 'roearn-referral-entry-title';
            referralTitle.textContent = getMessage("referralEntryTitle");

            const referralDescription = document.createElement('div');
            referralDescription.className = 'roearn-referral-entry-description';
            referralDescription.textContent = getMessage("referralEntryDescription");
                        
            const referralInputContainer = document.createElement('div');
            referralInputContainer.className = 'roearn-referral-input-container';
            
            const inputWrapper = document.createElement('div');
            inputWrapper.style.cssText = 'width: 100%; max-width: 400px; margin: 0 auto; position: relative;';

            const inputInnerWrapper = document.createElement('div');
            inputInnerWrapper.style.cssText = 'position: relative;';

            const referralInput = document.createElement('input');
            referralInput.type = 'text';
            referralInput.className = 'roearn-referral-input';
            referralInput.placeholder = getMessage("referralInputPlaceholder");
            referralInput.maxLength = 10;
            referralInput.style.paddingRight = '60px';
            referralInput.style.paddingLeft = '60px';

            const avatarContainer = document.createElement('div');
            avatarContainer.style.cssText = `
                position: absolute;
                right: 10px;
                top: 50%;
                transform: translateY(-50%);
                width: 40px;
                height: 40px;
                border-radius: 50%;
                overflow: hidden;
                background: #e0e0e0;
                display: none;
                border: 2px solid #fff;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            `;

            const avatarImg = document.createElement('img');
            avatarImg.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
            avatarContainer.appendChild(avatarImg);

            const usernameDisplay = document.createElement('div');
            usernameDisplay.style.cssText = `
                text-align: center;
                font-size: 14px;
                font-weight: 600;
                color: #606162;
                position: absolute;
                left: 0;
                right: 0;
                top: 100%;
                margin-top: 8px;
                opacity: 0;
                visibility: hidden;
                transition: opacity 0.2s, visibility 0.2s;
            `;

            inputInnerWrapper.appendChild(referralInput);
            inputInnerWrapper.appendChild(avatarContainer);
            inputWrapper.appendChild(inputInnerWrapper);
            inputWrapper.appendChild(usernameDisplay);

            const errorMessage = document.createElement('div');
            errorMessage.className = 'roearn-referral-error';
            errorMessage.textContent = getMessage("errorInvalidReferralCode");
            
            function referralCodeToUserId(code) {
                const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
                const base = alphabet.length;
                let result = 0;
                
                for (let char of code) {
                    if (!alphabet.includes(char)) {
                        return null;
                    }
                }
                
                for (let i = 0; i < code.length; i++) {
                    result = result * base + alphabet.indexOf(code[i]) + 1;
                }
                
                return result - 1;
            }
            
            function validateReferralCode(code) {
                if (!code || code.trim() === '') {
                    return true;
                }
                
                const userId = referralCodeToUserId(code.toUpperCase());
                return userId !== null && userId >= 0;
            }
            
            referralInput.addEventListener('input', async () => {
                const code = referralInput.value.trim().toUpperCase();
                referralInput.value = code;
                
                if (code === '') {
                    referralInput.classList.remove('roearn-referral-input-error');
                    errorMessage.classList.remove('show');
                    avatarContainer.style.display = 'none';
                    usernameDisplay.style.opacity = '0';
                    usernameDisplay.style.visibility = 'hidden';
                    startButton.disabled = false;
                    startButton.style.opacity = '';
                    startButton.style.width = '';
                    startButton.style.height = '';
                    startButton.textContent = getMessage("startButton");
                } else if (!validateReferralCode(code)) {
                    referralInput.classList.add('roearn-referral-input-error');
                    errorMessage.textContent = getMessage("errorInvalidReferralCode");
                    errorMessage.classList.add('show');
                    avatarContainer.style.display = 'none';
                    usernameDisplay.style.opacity = '0';
                    usernameDisplay.style.visibility = 'hidden';
                    startButton.disabled = true;
                    startButton.style.opacity = '0.7';
                } else {
                    const referredUserId = referralCodeToUserId(code);
                    const currentUser = await getAuthenticatedUser();
                    
                    if (currentUser && referredUserId === currentUser.id) {
                        referralInput.classList.add('roearn-referral-input-error');
                        errorMessage.textContent = getMessage("errorOwnReferralCode");
                        errorMessage.classList.add('show');
                        avatarContainer.style.display = 'none';
                        usernameDisplay.style.opacity = '0';
                        usernameDisplay.style.visibility = 'hidden';
                        startButton.disabled = true;
                        startButton.style.opacity = '0.7';
                    } else {
                        referralInput.classList.remove('roearn-referral-input-error');
                        errorMessage.classList.remove('show');
                        startButton.disabled = false;
                        startButton.style.opacity = '';
                        startButton.style.width = '';
                        startButton.style.height = '';
                        startButton.textContent = getMessage("startButton");
                        
                        const userId = referralCodeToUserId(code);
                        try {
                            const [thumbnailResponse, userResponse] = await Promise.all([
                                fetch(`https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`),
                                fetch(`https://users.roblox.com/v1/users/${userId}`)
                            ]);
                            
                            const thumbnailData = await thumbnailResponse.json();
                            const userData = await userResponse.json();
                            
                            if (thumbnailData.data && thumbnailData.data.length > 0) {
                                avatarImg.src = thumbnailData.data[0].imageUrl;
                                avatarContainer.style.display = 'block';
                            }
                            
                            if (userData.displayName && userData.name) {
                                usernameDisplay.textContent = `${userData.displayName} (@${userData.name})`;
                                usernameDisplay.style.opacity = '1';
                                usernameDisplay.style.visibility = 'visible';
                            }
                        } catch (error) {
                            avatarContainer.style.display = 'none';
                            usernameDisplay.style.opacity = '0';
                            usernameDisplay.style.visibility = 'hidden';
                        }
                    }
                }
            });

            
            referralInputContainer.appendChild(inputWrapper);
            referralInputContainer.appendChild(errorMessage);

            const startButtonContainer = document.createElement('div');
            startButtonContainer.className = 'roearn-start-button-container';

            const startButton = document.createElement('button');
            startButton.className = 'roearn-start-button';
            startButton.textContent = getMessage("startButton");

            startButtonContainer.appendChild(startButton);
            
            const optionalText = document.createElement('div');
            optionalText.style.cssText = `
                text-align: center;
                font-size: 21px;
                font-weight: 600;
                color: #606162;
                margin-top: 30px;
                letter-spacing: 0.5px;
            `;
            optionalText.textContent = getMessage("optionalLabel");

            referralCard.appendChild(referralTitle);
            referralCard.appendChild(referralDescription);
            referralCard.appendChild(referralInputContainer);
            referralCard.appendChild(optionalText);
            
            if (!userHasReferral) {
                onboardingContainer.appendChild(videoSection);
                onboardingContainer.appendChild(referralCard);
            } else {
                onboardingContainer.style.gridTemplateColumns = '1fr';
                onboardingContainer.style.placeItems = 'center';
                videoSection.style.width = '100%';
                videoSection.style.maxWidth = '640px';
                onboardingContainer.appendChild(videoSection);
            }
            
            startButton.addEventListener('click', async () => {
                const code = userHasReferral ? '' : (referralInput.value.trim().toUpperCase() || 'BELUEGEE');
                
                const buttonWidth = startButton.offsetWidth;
                const buttonHeight = startButton.offsetHeight;
                startButton.style.width = buttonWidth + 'px';
                startButton.style.height = buttonHeight + 'px';
                startButton.disabled = true;
                startButton.textContent = getMessage("loadingText");
                startButton.style.opacity = '0.7';
                
                if (code && !validateReferralCode(code)) {
                    referralInput.classList.add('roearn-referral-input-error');
                    errorMessage.classList.add('show');
                    startButton.textContent = getMessage("startButton");
                    return;
                }
                
                const storageData = { tutorialCompleted: true };
                
                if (code && !userHasReferral) {
                    const gamepassResult = await createReferralVerificationGamepass();
                    
                    if (!gamepassResult.success) {
                        errorMessage.textContent = gamepassResult.error;
                        errorMessage.classList.add('show');
                        referralInput.classList.add('roearn-referral-input-error');
                        
                        startButton.disabled = false;
                        startButton.style.opacity = '';
                        startButton.style.width = '';
                        startButton.style.height = '';
                        startButton.textContent = getMessage("startButton");
                        return;
                    }
                    
                    const referralResult = await new Promise((resolve) => {
                        api.runtime.sendMessage({
                            type: 'SET_REFERRAL',
                            userId: gamepassResult.userId,
                            referralCode: code,
                            gamepassId: gamepassResult.gamePassId
                        }, (response) => {
                            if (response && response.success) {
                                resolve({ success: true });
                            } else {
                                resolve({ success: false, error: response?.error });
                            }
                        });
                    });
                    
                    if (!referralResult.success) {
                        let errorText = getMessage("errorSetReferralFailed");
                        if (referralResult.error === 'referral_already_set') {
                            errorText = getMessage("errorReferralAlreadyUsed");
                        } else if (referralResult.error === 'invalid_referral_code') {
                            errorText = getMessage("errorInvalidReferralCodeRetry");
                        } else if (referralResult.error === 'cannot_refer_yourself') {
                            errorText = getMessage("errorOwnReferralCode");
                        } else if (referralResult.error === 'wrong_creator' || referralResult.error === 'wrong_name' || referralResult.error === 'wrong_description') {
                            errorText = getMessage("errorVerificationFailed");
                        } else {
                            errorText += referralResult.error || getMessage("errorPleaseTryAgain");
                        }
                        
                        errorMessage.textContent = errorText;
                        errorMessage.classList.add('show');
                        referralInput.classList.add('roearn-referral-input-error');
                        
                        startButton.disabled = false;
                        startButton.style.opacity = '';
                        startButton.style.width = '';
                        startButton.style.height = '';
                        startButton.textContent = getMessage("startButton");
                        return;
                    }
                }
                
                await new Promise((resolve) => {
                    api.storage.local.set(storageData, resolve);
                });

                const oldBalance = globalPrefetchedData?.balance || 0;

                globalPrefetchedData = await prefetchAllData();
                
                const content = document.getElementById('content');
                const newPanel = await createRoEarnPanel();
                
                content.innerHTML = '';
                content.appendChild(newPanel);

                if (code && globalPrefetchedData.balance > oldBalance) {
                    const bonusPrompt = document.createElement('div');
                    bonusPrompt.className = 'roearn-bonus-prompt';
                    bonusPrompt.innerHTML = `
                        <div class="roearn-bonus-close">✕</div>
                        <div class="roearn-bonus-icon">🎉</div>
                        <div class="roearn-bonus-text">
                            ${getMessage("bonusAddedText")}
                        </div>
                    `;
                    
                    const bonusStyle = document.createElement('style');
                    bonusStyle.textContent = `
                        .roearn-bonus-prompt {
                            position: fixed;
                            bottom: 20px;
                            right: 20px;
                            background: white;
                            border-radius: 14px;
                            padding: 24px;
                            padding-right: 40px;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                            z-index: 10000;
                            max-width: 320px;
                            font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            animation: bonusSlideIn 0.3s ease-out;
                        }
                        
                        .dark-theme .roearn-bonus-prompt {
                            background: #232527;
                            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
                        }
                        
                        @keyframes bonusSlideIn {
                            from {
                                transform: translateX(400px);
                                opacity: 0;
                            }
                            to {
                                transform: translateX(0);
                                opacity: 1;
                            }
                        }
                        
                        .roearn-bonus-close {
                            position: absolute;
                            top: 12px;
                            right: 14px;
                            font-size: 18px;
                            color: #999;
                            cursor: pointer;
                            transition: color 0.2s;
                        }
                        
                        .roearn-bonus-close:hover {
                            color: #666;
                        }
                        
                        .dark-theme .roearn-bonus-close {
                            color: #666;
                        }
                        
                        .dark-theme .roearn-bonus-close:hover {
                            color: #999;
                        }
                        
                        .roearn-bonus-icon {
                            font-size: 32px;
                            text-align: center;
                            margin-bottom: 12px;
                        }
                        
                        .roearn-bonus-text {
                            font-size: 16px;
                            font-weight: 600;
                            color: #393b3d;
                            text-align: center;
                            line-height: 1.4;
                        }
                        
                        .dark-theme .roearn-bonus-text {
                            color: #ffffff;
                        }
                    `;
                    document.head.appendChild(bonusStyle);
                    
                    document.body.appendChild(bonusPrompt);
                    
                    bonusPrompt.querySelector('.roearn-bonus-close').addEventListener('click', () => {
                        bonusPrompt.style.animation = 'bonusSlideIn 0.3s ease-in reverse';
                        setTimeout(() => {
                            bonusPrompt.remove();
                        }, 300);
                    });
                    
                    setTimeout(() => {
                        if (bonusPrompt.parentNode) {
                            bonusPrompt.style.animation = 'bonusSlideIn 0.3s ease-in reverse';
                            setTimeout(() => {
                                bonusPrompt.remove();
                            }, 300);
                        }
                    }, 10000);
                }
            });
            
            panel.appendChild(header);
            
            panel.appendChild(onboardingContainer);
            panel.appendChild(startButtonContainer);
            
            setTimeout(() => {
                prefetchAllData().then(data => {
                    globalPrefetchedData = data;
                });
            }, 2000);
            
            return panel;
        }
        
        const balance = prefetchedData.balance;
        const userData = prefetchedData.userData;
        const referralCode = prefetchedData.referralCode;
        const referralEarnings = prefetchedData.referralStats.totalEarnings;
        const referralUsers = prefetchedData.referralStats.totalReferrals;
        if (referralUsers >= 1) {
            if (!showContentCreatorUI) {
                api.storage.local.set({ showContentCreatorUI: true });
            }
        }

        const prefetchedSubmissionsForCreator = prefetchedData?.videoSubmissions || [];
        const isCreatorMode = prefetchedSubmissionsForCreator.some(s => s.status === 'approved');

        const header = document.createElement('div');
        header.className = 'roearn-panel-header';
        header.innerHTML = `
            <div class="roearn-panel-title">${getMessage("dashboardTitle")}</div>
            <div class="roearn-panel-subtitle">${getMessage("dashboardSubtitle")}</div>
        `;
        
        const twoColumn = document.createElement('div');
        twoColumn.className = 'roearn-two-column';
        
        const balanceSection = document.createElement('div');
        balanceSection.className = 'roearn-balance-section';
        balanceSection.innerHTML = `
            <div class="roearn-reload-icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                </svg>
            </div>
            <div class="roearn-balance-label">${getMessage("yourBalanceLabel")}</div>
            <div class="roearn-balance-amount">
                <span class="icon-robux-16x16" style="margin-top: 6px; margin-right: 6px;"></span>
                ${balance.toLocaleString()}
            </div>
            <button class="roearn-withdraw-button">${getMessage("withdrawButton")}</button>
            <div class="roearn-pending-notice"></div>
            <div class="roearn-error-message"></div>
        `;
        
        const reloadIcon = balanceSection.querySelector('.roearn-reload-icon');
        let isRefreshing = false;

        const pendingNotice = balanceSection.querySelector('.roearn-pending-notice');
        
        api.runtime.sendMessage(
            { type: 'GET_MANUAL_REVIEWAL', userId: userData.id },
            (response) => {
                if (response && response.success && response.pending && response.items) {
                    let totalPendingRobux = 0;
                    
                    response.items.forEach(item => {
                        const cashback = item.price * (item.withdrawPercent / 100);
                        if (cashback >= 2) {
                            totalPendingRobux += Math.floor(cashback * 0.7);
                        }
                    });
                    
                    if (totalPendingRobux > 0) {
                        pendingNotice.textContent = getMessage("pendingRobuxNotice").replace("X", totalPendingRobux);
                        pendingNotice.classList.add('show');
                    }
                    
                    if (response.items && response.items.length > 0) {
                        api.storage.local.set({ pendingTransactions: response.items });
                    } else {
                        api.storage.local.remove('pendingTransactions');
                    }
                } else {
                    api.storage.local.remove('pendingTransactions');
                }
            }
        );
        
        reloadIcon.addEventListener('click', async () => {
            if (isRefreshing) return;
            
            isRefreshing = true;
            reloadIcon.classList.add('spinning');
            
            await refreshBalance();
            
            api.runtime.sendMessage(
                { type: 'GET_MANUAL_REVIEWAL', userId: userData.id },
                (response) => {
                    if (response && response.success && response.pending && response.items) {
                        let totalPendingRobux = 0;
                        
                        response.items.forEach(item => {
                            const cashback = item.price * (item.withdrawPercent / 100);
                            if (cashback >= 2) {
                                totalPendingRobux += Math.floor(cashback * 0.7);
                            }
                        });
                        
                        if (totalPendingRobux > 0) {
                            pendingNotice.textContent = getMessage("pendingRobuxNotice").replace("X", totalPendingRobux);
                            pendingNotice.classList.add('show');
                        } else {
                            pendingNotice.classList.remove('show');
                        }
                    } else {
                        pendingNotice.classList.remove('show');
                    }
                }
            );
            
            setTimeout(() => {
                reloadIcon.classList.remove('spinning');
                isRefreshing = false;
                
                const errorMessage = balanceSection.querySelector('.roearn-error-message');
                if (errorMessage) {
                    errorMessage.classList.remove('show');
                    if (errorTimeout) {
                        clearTimeout(errorTimeout);
                    }
                }
            }, 600);
        });
        
        const withdrawButton = balanceSection.querySelector('.roearn-withdraw-button');
        const errorMessage = balanceSection.querySelector('.roearn-error-message');
        let errorTimeout = null;
        
        withdrawButton.addEventListener('click', async () => {
            if (errorTimeout) {
                clearTimeout(errorTimeout);
            }
            
            if (Number(cachedBalance) < 4) {
                errorMessage.textContent = getMessage("errorMinWithdrawal");
                errorMessage.classList.add('show');
                
                errorTimeout = setTimeout(() => {
                    errorMessage.classList.remove('show');
                }, 10000);
                return;
            }
            
            const hasWithdrawn = await new Promise((resolve) => {
                api.storage.local.get(['hasWithdrawn'], (result) => {
                    resolve(result.hasWithdrawn === true);
                });
            });
            
            if (!hasWithdrawn) {
                balanceSection.innerHTML = `
                    <div style="margin: 0 0 40px 0; font-size: 18px; line-height: 1.6; text-align: center; color: #606162;">
                        ${getMessage("withdrawalAgreementText") || "We will pay you the Robux by buying your gamepass. RoEarn automatically creates the gamepass for you, so you don't need to do anything."}
                    </div>
                    <button class="roearn-agreement-continue-button">
                        ${getMessage("continueButton") || "Continue"}
                    </button>
                `;
                
                const continueBtn = balanceSection.querySelector('.roearn-agreement-continue-button');
                continueBtn.addEventListener('click', async () => {
                    continueBtn.disabled = true;
                    continueBtn.textContent = getMessage("loadingText");
                    await new Promise((resolve) => {
                        api.storage.local.set({ hasWithdrawn: true }, resolve);
                    });
                    withdrawButton.click();
                });
                return;
            }
            
            withdrawButton.disabled = true;
            const originalText = withdrawButton.textContent;
            withdrawButton.textContent = getMessage("loadingText");
            
            try {
                const userData = await getAuthenticatedUser();
                if (!userData) {
                    throw new Error('Failed to get user data');
                }
                
                const withdrawalBalance = await new Promise((resolve) => {
                    api.runtime.sendMessage(
                        { type: 'GET_BALANCE', userId: userData.id },
                        (response) => {
                            if (response && response.success) {
                                resolve(response.balance);
                            } else {
                                resolve(0);
                            }
                        }
                    );
                });
                
                if (withdrawalBalance < 1) {
                    errorMessage.textContent = getMessage("errorMinWithdrawal");
                    errorMessage.classList.add('show');
                    
                    errorTimeout = setTimeout(() => {
                        errorMessage.classList.remove('show');
                    }, 10000);
                    
                    withdrawButton.disabled = false;
                    withdrawButton.textContent = originalText;
                    return;
                }

                errorMessage.classList.remove('show');
                
                window.dispatchEvent(new CustomEvent('roearn:initiateWithdrawal', {
                    detail: JSON.stringify({
                        gamepassPrice: withdrawalBalance
                    })
                }));
                
                const handleWithdrawalResult = (event) => {
                    const result = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
                    
                    if (result.success) {
                        api.storage.local.get(['hasReviewed'], (storageResult) => {
                            if (storageResult.hasReviewed !== true) {
                                api.storage.local.set({ showReviewPrompt: true }, () => {
                                });
                            }
                        });
                        
                        balanceSection.innerHTML = `
                            <div class="roearn-balance-label" style="color: #00a82d; margin-bottom: 20px;">
                                ${getMessage("withdrawalSuccessTitle")}
                            </div>
                            <div class="roearn-success-message" style="font-size: 17px; color: #393b3d; text-align: center; line-height: 1.6; margin-bottom: 30px; max-width: 450px; font-weight: 500;">
                                ${getMessage("withdrawalSuccessMessage")}
                            </div>
                            <button class="roearn-withdraw-button" disabled style="opacity: 0.7; cursor: not-allowed;">
                                ${getMessage("viewTransactionsCountdown", ["45"])}
                            </button>
                        `;
                        
                        let countdown = 45;
                        const transactionButton = balanceSection.querySelector('.roearn-withdraw-button');
                        
                        const countdownInterval = setInterval(() => {
                            countdown--;
                            transactionButton.textContent = getMessage("viewTransactionsCountdown", [countdown.toString()]);
                            
                            if (countdown <= 0) {
                                clearInterval(countdownInterval);
                                transactionButton.textContent = getMessage("viewTransactionsButton");
                                transactionButton.disabled = false;
                                transactionButton.style.opacity = '1';
                                transactionButton.style.cursor = 'pointer';
                                
                                transactionButton.addEventListener('click', () => {
                                    window.location.href = 'https://www.roblox.com/transactions';
                                });
                            }
                        }, 1000);
                        
                    } else {
                        errorMessage.innerHTML = result.error || getMessage("errorDiscordSupport", ["834"]);
                        errorMessage.classList.add('show');
                        
                        withdrawButton.disabled = false;
                        withdrawButton.textContent = originalText;
                    }
                    
                    window.removeEventListener('roearn:withdrawalInitiated', handleWithdrawalResult);
                };
                
                window.addEventListener('roearn:withdrawalInitiated', handleWithdrawalResult);
                
            } catch (error) {
                errorMessage.innerHTML = getMessage("errorDiscordSupport", ["695"]);
                errorMessage.classList.add('show');
                
                withdrawButton.disabled = false;
                withdrawButton.textContent = originalText;
            }
        });
        
        const referralSection = document.createElement('div');
        referralSection.className = 'roearn-referral-section';
        referralSection.style.position = 'relative';

        if (referralUsers >= 1) {
            referralSection.classList.add('roearn-referral-compact');
        }

        const referralReloadIcon = document.createElement('div');
        referralReloadIcon.className = 'roearn-reload-icon';
        referralReloadIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
                <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
        `;
        referralSection.appendChild(referralReloadIcon);

        let isRefreshingReferrals = false;

        referralReloadIcon.addEventListener('click', async () => {
            if (isRefreshingReferrals) return;
            
            isRefreshingReferrals = true;
            referralReloadIcon.classList.add('spinning');
            
            const newStats = await new Promise((resolve) => {
                api.runtime.sendMessage(
                    { type: 'GET_REFERRAL_STATS', userId: userData.id },
                    (response) => {
                        if (response?.success) {
                            resolve({
                                totalEarnings: response.totalEarnings,
                                totalReferrals: response.totalReferrals
                            });
                        } else {
                            resolve({ totalEarnings: 0, totalReferrals: 0 });
                        }
                    }
                );
            });
            
            const statValues = referralSection.querySelectorAll('.roearn-referral-stat-value');
            if (statValues.length >= 2) {
                statValues[0].innerHTML = `
                    <span class="icon-robux-16x16" style="margin-top: 3px; margin-right: -1px;"></span>${newStats.totalEarnings.toLocaleString()}
                `;
                statValues[1].textContent = newStats.totalReferrals;
            }
            
            if (newStats.totalReferrals >= 1) {
                const referralList = await new Promise((resolve) => {
                    api.runtime.sendMessage(
                        { type: 'GET_REFERRAL_LIST', userId: userData.id },
                        (response) => resolve(response?.success ? response.referrals : [])
                    );
                });
                
                if (referralList.length > 0) {
                    const userIds = referralList.map(r => parseInt(r.userId));
                    const [userDataList, thumbnails] = await Promise.all([
                        fetchUserData(userIds),
                        fetchAvatarThumbnails(userIds)
                    ]);
                    
                    let listContainer = referralSection.querySelector('.roearn-referral-list-container');
                    let listTitle = referralSection.querySelector('.roearn-section-title:last-of-type');
                    
                    if (!listContainer) {
                        const description = referralSection.querySelector('.roearn-referral-description');
                        if (description) {
                            description.remove();
                        }
                        
                        const newListTitle = document.createElement('div');
                        newListTitle.className = 'roearn-section-title';
                        newListTitle.textContent = getMessage("yourReferralsTitle");
                        newListTitle.style.marginTop = '30px';
                        newListTitle.style.marginBottom = '20px';
                        
                        listContainer = document.createElement('div');
                        listContainer.className = 'roearn-referral-list-container';
                        
                        referralSection.appendChild(newListTitle);
                        referralSection.appendChild(listContainer);
                    }
                    
                    listContainer.innerHTML = '';
                    
                    const sortedList = [...referralList].sort((a, b) => {
                        const dateA = new Date(a.joinedAt);
                        const dateB = new Date(b.joinedAt);
                        return dateB - dateA;
                    });
                    
                    const userDataMap = {};
                    userDataList.forEach(user => {
                        userDataMap[user.id] = user;
                    });
                    
                    sortedList.forEach(referral => {
                        const odslajf = parseInt(referral.userId);
                        const user = userDataMap[odslajf];
                        const avatarUrl = thumbnails[odslajf] || 'https://tr.rbxcdn.com/180DAY-a17918617b20ac9c39b305241f23e58a/150/150/AvatarHeadshot/Png';
                        
                        const referralItem = document.createElement('div');
                        referralItem.className = 'roearn-referral-item';
                        
                        const avatar = document.createElement('img');
                        avatar.className = 'roearn-referral-avatar';
                        avatar.src = avatarUrl;
                        avatar.alt = user ? user.name : 'User';
                        avatar.addEventListener('click', () => {
                            window.open(`https://www.roblox.com/users/${odslajf}/profile`, '_blank');
                        });
                        
                        const infoDiv = document.createElement('div');
                        infoDiv.className = 'roearn-referral-item-info';
                        
                        const username = document.createElement('div');
                        username.className = 'roearn-referral-item-username';
                        username.textContent = user ? user.displayName : `User ${odslajf}`;
                        username.addEventListener('click', () => {
                            window.open(`https://www.roblox.com/users/${odslajf}/profile`, '_blank');
                        });
                        
                        const displayName = document.createElement('div');
                        displayName.className = 'roearn-referral-item-displayname';
                        displayName.textContent = user ? `@${user.name}` : '@Unknown';
                        
                        infoDiv.appendChild(username);
                        infoDiv.appendChild(displayName);
                        
                        const timestamp = document.createElement('div');
                        timestamp.className = 'roearn-referral-item-timestamp';
                        timestamp.style.display = 'none';
                        const dateOnly = referral.joinedAt.split(' at ')[0];
                        timestamp.textContent = dateOnly;
                        
                        if (referral.bonusGiven === false) {
                            const altTag = document.createElement('div');
                            altTag.className = 'roearn-referral-alt-tag';
                            altTag.textContent = getMessage("altDetectedText");
                            const altTooltip = document.createElement('div');
                            altTooltip.className = 'roearn-alt-tooltip';
                            altTooltip.textContent = getMessage("s_alt_tooltip");
                            document.body.appendChild(altTooltip);
                            const hideAltTooltip1 = () => { altTooltip.style.display = 'none'; };
                            altTag.addEventListener('mouseenter', () => {
                                const r = altTag.getBoundingClientRect();
                                altTooltip.style.display = 'block';
                                const tw = altTooltip.offsetWidth;
                                altTooltip.style.top = (r.top - altTooltip.offsetHeight - 8) + 'px';
                                altTooltip.style.left = (r.right - tw) + 'px';
                                window.addEventListener('scroll', hideAltTooltip1, { capture: true, once: true });
                            });
                            altTag.addEventListener('mouseleave', () => {
                                hideAltTooltip1();
                                window.removeEventListener('scroll', hideAltTooltip1, true);
                            });
                            referralItem.appendChild(avatar);
                            referralItem.appendChild(infoDiv);
                            referralItem.appendChild(altTag);
                            referralItem.appendChild(timestamp);
                        } else {
                            referralItem.appendChild(avatar);
                            referralItem.appendChild(infoDiv);
                            referralItem.appendChild(timestamp);
                        }
                        
                        listContainer.appendChild(referralItem);
                    });
                }
            }
            
            setTimeout(() => {
                referralReloadIcon.classList.remove('spinning');
                isRefreshingReferrals = false;
            }, 600);
        });
        
        function createReferralMainView() {
            const localeShareMap = {
                'en': ['x', 'facebook'],
                'id': ['telegram', 'facebook'],
                'de': ['telegram', 'x'],
                'es': ['x', 'telegram'],
                'fr': ['x', 'telegram'],
                'it': ['telegram', 'x'],
                'pl': ['facebook', 'telegram'],
                'pt_BR': ['telegram', 'x'],
                'vi': ['facebook', 'telegram'],
                'tr': ['telegram', 'x'],
                'th': ['facebook', 'telegram'],
                'zh_CN': [],
                'zh_TW': ['x', 'telegram'],
                'ja': ['x', 'telegram'],
                'ko': [],
                'ar': ['telegram', 'facebook']
            };

            const shareButtons = {
                whatsapp: () => {
                    const btn = document.createElement('div');
                    btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgb(37,211,102);border-radius:6px;color:white;font-weight:700;font-size:14px;cursor:pointer;padding:8px 20px;font-family:inherit;white-space:nowrap;`;
                    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/></svg> ${getMessage('shareOnWhatsApp')}`;
                    btn.addEventListener('click', () => window.open(`https://wa.me/?text=${encodeURIComponent(getMessage('shareTextWhatsApp', referralCode))}`, '_blank'));
                    return btn;
                },
                x: () => {
                    const btn = document.createElement('div');
                    btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgb(24,24,24);border-radius:6px;color:white;font-weight:700;font-size:14px;cursor:pointer;padding:8px 20px;font-family:inherit;white-space:nowrap;`;
                    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M14.234 10.162 22.977 0h-2.072l-7.591 8.824L7.251 0H.258l9.168 13.343L.258 24H2.33l8.016-9.318L16.749 24h6.993zm-2.837 3.299-.929-1.329L3.076 1.56h3.182l5.965 8.532.929 1.329 7.754 11.09h-3.182z"/></svg> ${getMessage('shareOnX')}`;
                    btn.addEventListener('click', () => window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(getMessage('shareTextX', referralCode))}`, '_blank'));
                    return btn;
                },
                facebook: () => {
                    const btn = document.createElement('div');
                    btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgb(24,90,189);border-radius:6px;color:white;font-weight:700;font-size:14px;cursor:pointer;padding:8px 20px;font-family:inherit;white-space:nowrap;`;
                    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z"/></svg> ${getMessage('shareOnFacebook')}`;
                    btn.addEventListener('click', () => window.open(`https://www.facebook.com/sharer/sharer.php?u=https%3A%2F%2Fchromewebstore.google.com%2Fdetail%2Froearn-cashback-on-roblox%2Ffooenmopnfaejehogdbmegaleanpdcea%3Futm_campaign%3Dfacebook`, '_blank'));
                    return btn;
                },
                telegram: () => {
                    const btn = document.createElement('div');
                    btn.style.cssText = `display:inline-flex;align-items:center;justify-content:center;gap:8px;background:rgb(33,150,243);border-radius:6px;color:white;font-weight:700;font-size:14px;cursor:pointer;padding:8px 20px;font-family:inherit;white-space:nowrap;`;
                    btn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="white"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg> ${getMessage('shareOnTelegram')}`;
                    btn.addEventListener('click', () => window.open(`https://t.me/share/url?url=${encodeURIComponent('https://chromewebstore.google.com/detail/roearn-cashback-on-roblox/fooenmopnfaejehogdbmegaleanpdcea?utm_campaign=telegram')}&text=${encodeURIComponent(getMessage('shareTextTelegram', referralCode))}`, '_blank'));
                    return btn;
                }
            };

            const container = document.createElement('div');
            
            const referralTitleRow = document.createElement('div');
            referralTitleRow.style.cssText = isMobileDevice
                ? `display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;margin-bottom:20px;text-align:center;`
                : `display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;`;

            const referralTitle = document.createElement('div');
            referralTitle.className = 'roearn-section-title';
            referralTitle.style.position = 'relative';
            referralTitle.style.marginBottom = '0';
            referralTitle.textContent = getMessage("referralProgramTitle");

            const mappedLocale = localeMapping[cachedLocale.toLowerCase()] || cachedLocale.toLowerCase().split('_')[0] || 'en';
            const shareOrder = localeShareMap[mappedLocale] || localeShareMap[mappedLocale.split('_')[0]] || localeShareMap['en'];

            const allShareButtons = [
                ...(isMobileDevice ? ['whatsapp'] : []),
                ...shareOrder.filter(k => k !== 'whatsapp'),
                ...['x','facebook','telegram'].filter(k => !shareOrder.includes(k) && k !== 'whatsapp')
            ];

            const socialCarousel = document.createElement('div');
            socialCarousel.style.cssText = `display:flex;align-items:center;gap:6px;`;

            const prevArrow = document.createElement('button');
            prevArrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 18l-6-6 6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            prevArrow.style.cssText = `background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;color:#606162;transition:color 0.2s;flex-shrink:0;`;
            prevArrow.addEventListener('mouseenter', () => prevArrow.style.color = '#393b3d');
            prevArrow.addEventListener('mouseleave', () => prevArrow.style.color = '#606162');

            const nextArrow = document.createElement('button');
            nextArrow.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M9 18l6-6-6-6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
            nextArrow.style.cssText = `background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;color:#606162;transition:color 0.2s;flex-shrink:0;`;
            nextArrow.addEventListener('mouseenter', () => nextArrow.style.color = '#393b3d');
            nextArrow.addEventListener('mouseleave', () => nextArrow.style.color = '#606162');

            const carouselSlot = document.createElement('div');
            carouselSlot.style.cssText = `overflow:hidden;min-width:180px;width:auto;`;

            let currentShareIndex = 0;

            function renderCarouselButton(index) {
                const key = allShareButtons[index];
                const btn = shareButtons[key]();
                btn.style.width = '100%';
                btn.style.padding = '8px 6px';
                btn.style.justifyContent = 'center';
                btn.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
                return btn;
            }

            function showShareButton(index, direction) {
                const incoming = renderCarouselButton(index);
                incoming.style.opacity = '0';
                incoming.style.transform = direction === 1 ? 'translateX(20px)' : 'translateX(-20px)';
                carouselSlot.innerHTML = '';
                carouselSlot.appendChild(incoming);
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        incoming.style.opacity = '1';
                        incoming.style.transform = 'translateX(0)';
                    });
                });
            }

            showShareButton(0, 1);

            let autoRotateInterval = setInterval(() => {
                currentShareIndex = (currentShareIndex + 1) % allShareButtons.length;
                showShareButton(currentShareIndex, 1);
            }, 8000);

            prevArrow.addEventListener('click', () => {
                clearInterval(autoRotateInterval);
                currentShareIndex = (currentShareIndex - 1 + allShareButtons.length) % allShareButtons.length;
                showShareButton(currentShareIndex, -1);
                autoRotateInterval = setInterval(() => {
                    currentShareIndex = (currentShareIndex + 1) % allShareButtons.length;
                    showShareButton(currentShareIndex, 1);
                }, 8000);
            });

            nextArrow.addEventListener('click', () => {
                clearInterval(autoRotateInterval);
                currentShareIndex = (currentShareIndex + 1) % allShareButtons.length;
                showShareButton(currentShareIndex, 1);
                autoRotateInterval = setInterval(() => {
                    currentShareIndex = (currentShareIndex + 1) % allShareButtons.length;
                    showShareButton(currentShareIndex, 1);
                }, 8000);
            });

            carouselSlot.addEventListener('mouseenter', () => { clearInterval(autoRotateInterval); });
            carouselSlot.addEventListener('mouseleave', () => {
                autoRotateInterval = setInterval(() => {
                    currentShareIndex = (currentShareIndex + 1) % allShareButtons.length;
                    showShareButton(currentShareIndex, 1);
                }, 8000);
            });

            socialCarousel.appendChild(prevArrow);
            socialCarousel.appendChild(carouselSlot);
            socialCarousel.appendChild(nextArrow);

            referralTitleRow.appendChild(referralTitle);
            referralTitleRow.appendChild(socialCarousel);

            if (countdownData.countdownUIEnabled && countdownData.timeRemainingSeconds > 0) {
                const countdownContainer = document.createElement('div');
                countdownContainer.className = 'roearn-timeframe-countdown';
                referralTitle.appendChild(countdownContainer);
                
                let remainingSeconds = countdownData.timeRemainingSeconds;
                
                function updateCountdown() {
                    if (remainingSeconds <= 0) {
                        countdownContainer.style.display = 'none';
                        return;
                    }
                    
                    const days = Math.floor(remainingSeconds / 86400);
                    const hours = Math.floor((remainingSeconds % 86400) / 3600);
                    const minutes = Math.floor((remainingSeconds % 3600) / 60);
                    
                    if (days === 0 && hours === 0 && minutes === 0) {
                        countdownContainer.style.display = 'none';
                        return;
                    }
                    
                    let displayText = getMessage('countdownPrefix', [inviteBonusAmount.toString()]);
                    
                    if (days > 0) {
                        displayText += `${days} ${getMessage(days === 1 ? 'countdownDay' : 'countdownDays')}`;
                    } else if (hours > 0) {
                        displayText += `${hours} ${getMessage(hours === 1 ? 'countdownHour' : 'countdownHours')}`;
                    } else {
                        displayText += `${minutes} ${getMessage(minutes === 1 ? 'countdownMinute' : 'countdownMinutes')}`;
                    }
                    
                    displayText += ')';
                    
                    countdownContainer.textContent = displayText;
                    remainingSeconds--;
                }
                
                updateCountdown();
                const countdownInterval = setInterval(updateCountdown, 1000);
            }

            const referralCodeContainer = document.createElement('div');
            referralCodeContainer.className = 'roearn-referral-code-container';
            referralCodeContainer.innerHTML = `
                <div class="roearn-referral-code-label">${getMessage("yourReferralCodeLabel")}</div>
            `;
            
            const codeRow = document.createElement('div');
            codeRow.style.cssText = `
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 15px;
            `;
            
            const codeText = document.createElement('div');
            codeText.className = 'roearn-referral-code';
            codeText.textContent = referralCode;
            
            const copyCodeButton = document.createElement('button');
            copyCodeButton.textContent = getMessage("copyButton");
            copyCodeButton.style.cssText = `
                background: #00a82d;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: transform 0.2s;
                text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                padding: 8px 20px;
            `;
            
            copyCodeButton.addEventListener('mouseenter', () => {
                copyCodeButton.style.transform = 'translateY(-1px)';
            });
            
            copyCodeButton.addEventListener('mouseleave', () => {
                copyCodeButton.style.transform = 'translateY(0)';
            });
            
            let copyTimeout = null;
            copyCodeButton.addEventListener('click', () => {
                const originalText = getMessage("copyButton");
                
                if (copyTimeout) {
                    clearTimeout(copyTimeout);
                }
                
                api.storage.local.set({ showContentCreatorUI: true });
                
                navigator.clipboard.writeText(referralCode).then(() => {
                    copyCodeButton.textContent = getMessage("copiedButton");
                    copyTimeout = setTimeout(() => {
                        copyCodeButton.textContent = originalText;
                    }, 2000);
                });
            });

            codeRow.appendChild(codeText);
            codeRow.appendChild(copyCodeButton);
            referralCodeContainer.appendChild(codeRow);

            const copyLinkButton = document.createElement('button');
            copyLinkButton.textContent = getMessage("copyExtensionLink");
            copyLinkButton.style.cssText = `
                background: #6c757d;
                border: none;
                border-radius: 6px;
                color: white;
                font-weight: bold;
                font-size: 14px;
                cursor: pointer;
                transition: transform 0.2s, background 0.2s;
                text-shadow: rgba(0, 0, 0, 0.2) 0px 1px 2px;
                padding: 8px 20px;
                margin-top: 15px;
            `;

            copyLinkButton.addEventListener('mouseenter', () => {
                copyLinkButton.style.transform = 'translateY(-1px)';
                copyLinkButton.style.background = '#5a6268';
            });

            copyLinkButton.addEventListener('mouseleave', () => {
                copyLinkButton.style.transform = 'translateY(0)';
                copyLinkButton.style.background = '#6c757d';
            });

            let copyLinkTimeout = null;
            copyLinkButton.addEventListener('click', () => {
                const originalText = getMessage("copyExtensionLink");
                
                if (copyLinkTimeout) {
                    clearTimeout(copyLinkTimeout);
                }
                
                navigator.clipboard.writeText('https://chromewebstore.google.com/detail/roearn-cashback-on-roblox/fooenmopnfaejehogdbmegaleanpdcea?utm_campaign=copy').then(() => {
                    copyLinkButton.textContent = getMessage("copiedButton");
                    copyLinkTimeout = setTimeout(() => {
                        copyLinkButton.textContent = originalText;
                    }, 2000);
                });
            });

            copyLinkButton.style.marginTop = '12px';
            copyLinkButton.style.display = 'block';
            copyLinkButton.style.marginLeft = 'auto';
            copyLinkButton.style.marginRight = 'auto';
            referralCodeContainer.appendChild(copyLinkButton);
            
            const referralStats = document.createElement('div');
            referralStats.className = 'roearn-referral-stats';
            referralStats.innerHTML = `
                <div class="roearn-referral-stat">
                    <div class="roearn-referral-stat-value">
                        <span class="icon-robux-16x16" style="margin-top: 3px; margin-right: -1px;"></span>${referralEarnings.toLocaleString()}
                    </div>
                    <div class="roearn-referral-stat-label">${getMessage("totalEarnedLabel")}</div>
                </div>
                <div class="roearn-referral-stat">
                    <div class="roearn-referral-stat-value">${referralUsers}</div>
                    <div class="roearn-referral-stat-label">${getMessage("referralsLabel")}</div>
                </div>
            `;
            
            container.appendChild(referralTitleRow);
            container.appendChild(referralCodeContainer);
            container.appendChild(referralStats);
            
            if (referralUsers === 0) {
                const referralDescription = document.createElement('div');
                referralDescription.className = 'roearn-referral-description';
                referralDescription.style.marginTop = '20px';
                const rawDesc = getMessage("referralDescription").replaceAll('15', inviteBonusAmount.toString());
                const secondBreak = rawDesc.indexOf('<br><br>', rawDesc.indexOf('<br><br>') + 1);
                referralDescription.innerHTML = secondBreak !== -1 ? rawDesc.substring(0, secondBreak) : rawDesc;
                container.appendChild(referralDescription);

                const invitesStubTitle = document.createElement('div');
                invitesStubTitle.className = 'roearn-section-title';
                invitesStubTitle.style.cssText = 'margin-top: 24px; margin-bottom: 10px; font-size: 18px;';
                invitesStubTitle.textContent = getMessage("s_your_invites_title");

                const invitesStub = document.createElement('div');
                invitesStub.style.cssText = `
                    padding: 16px 20px;
                    border-radius: 8px;
                    border: 1.5px dashed rgba(0,0,0,0.1);
                    text-align: center;
                    font-size: 13px;
                    color: #9ca3af;
                    line-height: 1.5;
                `;
                invitesStub.textContent = getMessage("s_invites_empty");

                container.appendChild(invitesStubTitle);
                container.appendChild(invitesStub);
                container.style.display = 'flex';
                container.style.flexDirection = 'column';
                container.style.height = '100%';
            }
            
            return container;
        }
        
        const mainView = createReferralMainView();
        referralSection.appendChild(mainView);
        
        if (referralUsers >= 1 && prefetchedReferralData) {
            const listTitle = document.createElement('div');
            listTitle.className = 'roearn-section-title';
            listTitle.textContent = getMessage("yourReferralsTitle");
            listTitle.style.marginTop = '30px';
            listTitle.style.marginBottom = '20px';
            
            const listContainer = document.createElement('div');
            listContainer.className = 'roearn-referral-list-container';
            
            const sortedList = [...prefetchedReferralData.referralList].sort((a, b) => {
                const dateA = new Date(a.joinedAt);
                const dateB = new Date(b.joinedAt);
                return dateB - dateA;
            });
            
            const userDataMap = {};
            prefetchedReferralData.userDataList.forEach(user => {
                userDataMap[user.id] = user;
            });
            
            sortedList.forEach(referral => {
                const userId = parseInt(referral.userId);
                const user = userDataMap[userId];
                const avatarUrl = prefetchedReferralData.thumbnails[userId] || `https://www.roblox.com/headshot-thumbnail/image?userId=${userId}&width=150&height=150&format=png`;
                
                const referralItem = document.createElement('div');
                referralItem.className = 'roearn-referral-item';
                
                const avatar = document.createElement('img');
                avatar.className = 'roearn-referral-avatar';
                avatar.src = avatarUrl;
                avatar.alt = user ? user.name : 'User';
                avatar.addEventListener('click', () => {
                    window.open(`https://www.roblox.com/users/${userId}/profile`, '_blank');
                });
                
                const infoDiv = document.createElement('div');
                infoDiv.className = 'roearn-referral-item-info';
                
                const username = document.createElement('div');
                username.className = 'roearn-referral-item-username';
                username.textContent = user ? user.displayName : `User ${userId}`;
                username.addEventListener('click', () => {
                    window.open(`https://www.roblox.com/users/${userId}/profile`, '_blank');
                });
                
                const displayName = document.createElement('div');
                displayName.className = 'roearn-referral-item-displayname';
                displayName.textContent = user ? `@${user.name}` : '@Unknown';
                
                infoDiv.appendChild(username);
                infoDiv.appendChild(displayName);
                
                const timestamp = document.createElement('div');
                timestamp.className = 'roearn-referral-item-timestamp';
                timestamp.style.display = 'none';
                const dateOnly = referral.joinedAt.split(' at ')[0];
                timestamp.textContent = dateOnly;
                
                if (referral.bonusGiven === false) {
                    const altTag = document.createElement('div');
                    altTag.className = 'roearn-referral-alt-tag';
                    altTag.textContent = getMessage("altDetectedText");
                    const altTooltip = document.createElement('div');
                    altTooltip.className = 'roearn-alt-tooltip';
                    altTooltip.textContent = getMessage("s_alt_tooltip");
                    document.body.appendChild(altTooltip);
                    const hideAltTooltip2 = () => { altTooltip.style.display = 'none'; };
                    altTag.addEventListener('mouseenter', () => {
                        const r = altTag.getBoundingClientRect();
                        altTooltip.style.display = 'block';
                        const tw = altTooltip.offsetWidth;
                        altTooltip.style.top = (r.top - altTooltip.offsetHeight - 8) + 'px';
                        altTooltip.style.left = (r.right - tw) + 'px';
                        window.addEventListener('scroll', hideAltTooltip2, { capture: true, once: true });
                    });
                    altTag.addEventListener('mouseleave', () => {
                        hideAltTooltip2();
                        window.removeEventListener('scroll', hideAltTooltip2, true);
                    });
                    referralItem.appendChild(avatar);
                    referralItem.appendChild(infoDiv);
                    referralItem.appendChild(altTag);
                    referralItem.appendChild(timestamp);
                } else {
                    referralItem.appendChild(avatar);
                    referralItem.appendChild(infoDiv);
                    referralItem.appendChild(timestamp);
                }
                
                listContainer.appendChild(referralItem);
            });
            
            referralSection.appendChild(listTitle);
            referralSection.appendChild(listContainer);
        }
        


        const leftColumnWrapper = document.createElement('div');
        leftColumnWrapper.style.display = 'flex';
        leftColumnWrapper.style.flexDirection = 'column';
        leftColumnWrapper.appendChild(balanceSection);

        const _rbxBodyPanel = document.getElementById('rbx-body');
        const isDark = _rbxBodyPanel && _rbxBodyPanel.classList.contains('dark-theme');

        const isNarrow = isMobileDevice || window.innerWidth < 500;

        const extrasSection = document.createElement('div');
        extrasSection.className = 'roearn-extras-section';
        extrasSection.style.marginTop = '30px';

        extrasSection.innerHTML = `
            <div style="padding: 4px 0 0 0;">
                <div style="margin-bottom: 18px; text-align: center;">
                    <div style="font-size: 26px; font-weight: 700;" class="roearn-extras-label">${getMessage("s_extras_title")}</div>
                </div>

                <!-- Row 3: Subscribe to YouTube -->
                <div style="padding-top: 14px; padding-bottom: 14px; ${isNarrow ? 'display: flex; flex-direction: column; gap: 8px;' : 'display: flex; align-items: center; gap: 12px;'}" class="roearn-extras-divider">
                    ${isNarrow ? `<div style="font-weight: 600;" class="roearn-extras-label">${getMessage("dashboard_subscribe_label")}</div>` : ''}
                    <div style="flex: 1; ${isNarrow ? 'display: flex; align-items: center; gap: 12px;' : ''}">
                        ${isNarrow ? '' : `<div style="font-weight: 600;" class="roearn-extras-label">${getMessage("dashboard_subscribe_label")}</div>`}
                        <div style="font-size: 12px; ${isNarrow ? '' : 'margin-top: 3px;'} line-height: 1.5; flex: 1;" class="roearn-extras-desc">${getMessage("dashboard_subscribe_desc")}</div>
                        ${isNarrow ? `
                        <div id="roearn-subscribe-arrow" style="display: flex; align-items: center; flex-shrink: 0;">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg">
                                <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <a id="roearn-subscribe-link" data-href="https://roearn.io/youtube" style="cursor:pointer;flex-shrink:0;width:110px;display:inline-flex;align-items:center;justify-content:center;gap:7px;background:linear-gradient(135deg,#ff1a1a 0%,#cc0000 100%);color:white;font-size:13px;font-weight:600;padding:8px 0;border-radius:6px;text-decoration:none;white-space:nowrap;transition:transform 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            ${getMessage("dashboard_subscribe_btn")}
                        </a>` : ''}
                    </div>
                    ${isNarrow ? '' : `
                    <div id="roearn-subscribe-arrow" style="display: flex; align-items: center; flex-shrink: 0;">
                        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg">
                            <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <a id="roearn-subscribe-link" data-href="https://roearn.io/youtube" style="cursor: pointer;
                        flex-shrink: 0;
                        width: 110px;
                        display: inline-flex;
                        align-items: center;
                        justify-content: center;
                        gap: 7px;
                        background: linear-gradient(135deg, #ff1a1a 0%, #cc0000 100%);
                        color: white;
                        font-size: 13px;
                        font-weight: 600;
                        padding: 8px 0;
                        border-radius: 6px;
                        text-decoration: none;
                        white-space: nowrap;
                        transition: transform 0.15s ease;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
                            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                        </svg>
                        ${getMessage("dashboard_subscribe_btn")}
                    </a>`}
                </div>

                <!-- Row 4: Get Paid to Make Videos -->
                <div style="border-top: 1px solid #e5e7eb; padding-top: 14px; padding-bottom: 14px;" class="roearn-extras-divider">
                    ${isNarrow ? `<div style="font-weight: 600; margin-bottom: 8px;" class="roearn-extras-label">${getMessage('creator_earn_title')}</div>` : ''}
                    <div style="display: flex; align-items: center; gap: 12px;">
                        ${isNarrow ? '' : `<div style="flex: 1;">
                            <div style="font-weight: 600;" class="roearn-extras-label">${getMessage('creator_earn_title')}</div>`}
                        <div style="${isNarrow ? 'flex: 1;' : ''} font-size: 12px; ${isNarrow ? '' : 'margin-top: 3px;'} line-height: 1.5;" class="roearn-extras-desc">
                            ${getMessage('creator_earn_subtitle_pre')} <span class="icon-robux-16x16" style="display: inline-block; vertical-align: middle;"></span> ${getMessage('creator_earn_subtitle_post')}
                        </div>
                        ${isNarrow ? '' : '</div>'}
                        <div id="roearn-creator-arrow" style="display: flex; align-items: center; flex-shrink: 0;">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg">
                                <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <button id="roearn-creator-get-started" style="
                            flex-shrink: 0;
                            width: 110px;
                            background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                            animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                            border: none;
                            color: white;
                            font-size: 13px;
                            font-weight: 700;
                            padding: 8px 0;
                            border-radius: 8px;
                            cursor: pointer;
                            white-space: nowrap;
                            text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                            transition: transform 0.15s ease;
                        " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("dashboard_yt_get_started")}</button>
                    </div>

                    <!-- Submit area -->
                    ${isNarrow ? `
                    <div style="margin-top: 12px; display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; align-items: center; gap: 8px;">
                            <div style="display: flex; align-items: center; gap: 2px; flex-shrink: 0; background: ${isDark ? '#2a2c2e' : '#f0f0f0'}; border-radius: 8px; padding: 3px;">
                                <span id="roearn-platform-yt" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#ff0000;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;pointer-events:none;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                                </span>
                                <span id="roearn-platform-tt" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#010101;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;pointer-events:none;"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                                </span>
                            </div>
                            <input id="roearn-yt-submit-input" type="text" placeholder="${getMessage('creator_url_placeholder')}" style="flex:1;min-width:0;padding:6px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:12px;font-family:inherit;outline:none;background:transparent;color:inherit;transition:border-color 0.15s ease;" onfocus="this.style.borderColor='#a855f7'" onblur="this.style.borderColor='#d1d5db'">
                        </div>
                        <div style="display: flex; gap: 8px;">
                            <button id="roearn-yt-submit-btn" style="flex:1;padding:8px 14px;border-radius:8px;border:none;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0%/200% 100%;animation:6s ease-in-out 0s infinite normal none running rainbow-flow;color:white;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;transition:transform 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("yt_submit_btn")}</button>
                            <button id="roearn-yt-history-btn" style="display:none;flex:1;background:none;border:1px solid #d1d5db;border-radius:8px;padding:8px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:inherit;white-space:nowrap;transition:transform 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("yt_view_submissions_btn")}</button>
                        </div>
                    </div>
                    ` : `
                    <div style="display: flex; align-items: center; gap: 8px; margin-top: 12px;">
                        <div style="display: flex; align-items: center; gap: 2px; flex-shrink: 0; background: ${isDark ? '#2a2c2e' : '#f0f0f0'}; border-radius: 8px; padding: 3px;">
                            <span id="roearn-platform-yt" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#ff0000;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;pointer-events:none;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                            </span>
                            <span id="roearn-platform-tt" style="display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:6px;background:#010101;">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;pointer-events:none;"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                            </span>
                        </div>
                        <input id="roearn-yt-submit-input" type="text" placeholder="${getMessage('creator_url_placeholder')}" style="flex:1;min-width:0;padding:6px 10px;border-radius:8px;border:1px solid #d1d5db;font-size:12px;font-family:inherit;outline:none;background:transparent;color:inherit;transition:border-color 0.15s ease;" onfocus="this.style.borderColor='#a855f7'" onblur="this.style.borderColor='#d1d5db'">
                        <button id="roearn-yt-submit-btn" style="flex-shrink:0;padding:6px 14px;border-radius:8px;border:none;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0%/200% 100%;animation:6s ease-in-out 0s infinite normal none running rainbow-flow;color:white;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;transition:transform 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("yt_submit_btn")}</button>
                        <button id="roearn-yt-history-btn" style="display:none;flex-shrink:0;background:none;border:1px solid #d1d5db;border-radius:8px;padding:6px 14px;font-size:12px;font-weight:600;cursor:pointer;font-family:inherit;color:inherit;white-space:nowrap;transition:transform 0.15s ease;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("yt_view_submissions_btn")}</button>
                    </div>
                    `}
                    <div id="roearn-yt-submit-msg" style="font-size: 11px; margin-top: 4px; min-height: 14px;" class="roearn-extras-desc"></div>
                    <div id="roearn-yt-pending-list" style="display:none; margin-top: 6px;"></div>
                </div>

            </div>
        `;

        const ytSubmitBtn = extrasSection.querySelector('#roearn-yt-submit-btn');
        const ytSubmitInput = extrasSection.querySelector('#roearn-yt-submit-input');
        const ytSubmitMsg = extrasSection.querySelector('#roearn-yt-submit-msg');
        const ytPendingList = extrasSection.querySelector('#roearn-yt-pending-list');
        const ytHistoryBtn = extrasSection.querySelector('#roearn-yt-history-btn');

        const prefetchedSubmissions = prefetchedData?.videoSubmissions || [];
        if (prefetchedSubmissions.length > 0 && ytHistoryBtn) {
            ytHistoryBtn.style.display = 'inline-block';
        }

        function openSubmissionsHistoryModal(submissions) {
            const existingOverlay = document.getElementById('roearn-yt-history-overlay');
            if (existingOverlay) existingOverlay.remove();

            const rbxBodyCheck = document.getElementById('rbx-body');
            const isDark = rbxBodyCheck && rbxBodyCheck.classList.contains('dark-theme');

            const overlay = document.createElement('div');
            overlay.id = 'roearn-yt-history-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.75); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                padding: 3vh 20px; box-sizing: border-box;
            `;

            const popup = document.createElement('div');
            popup.style.cssText = `
                background: ${isDark ? '#232527' : 'white'};
                border-radius: 16px;
                padding: 0;
                width: 620px;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                box-sizing: border-box;
                flex-shrink: 0;
                display: flex;
                flex-direction: column;
                overflow: hidden;
            `;

            function scalePopup() {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const popupH = popup.scrollHeight || 600;
                const scaleX = (vw * 0.92) / 620;
                const scaleY = (vh * 0.92) / popupH;
                const scale = Math.min(1.25, scaleX, scaleY);
                popup.style.transform = `scale(${scale})`;
                popup.style.transformOrigin = 'center center';
            }

            const statusConfig = {
                pending:  { color: '#f59e0b', label: getMessage("yt_status_in_review"),  dot: '#f59e0b', tagColor: '#b45309',  tagBg: '#fef3c7',   tagBgDark: 'rgba(245,158,11,0.15)'  },
                approved: { color: '#22c55e', label: getMessage("yt_status_paid"),        dot: '#22c55e', tagColor: '#15803d',  tagBg: '#dcfce7',   tagBgDark: 'rgba(34,197,94,0.15)'   },
                rejected: { color: '#ef4444', label: getMessage("yt_status_rejected"),    dot: '#ef4444', tagColor: '#b91c1c',  tagBg: '#fee2e2',   tagBgDark: 'rgba(239,68,68,0.15)'   },
            };

            function formatDate(iso) {
                try {
                    const d = new Date(iso);
                    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
                } catch { return ''; }
            }

            function buildRows(subs) {
                if (!subs.length) {
                    return `<div style="text-align:center; padding: 32px 0; color: ${isDark ? '#9ca3af' : '#9ca3af'}; font-size: 14px;">${getMessage("yt_no_submissions")}</div>`;
                }
                return subs.map((s, i) => {
                    const cfg = statusConfig[s.status] || statusConfig.pending;
                    const videoId   = s.video_id || '';
                    const platform  = s.platform || 'youtube';
                    const isTikTok  = platform === 'tiktok';
                    const isShort   = s.video_type === 'short';
                    const isPhoto   = isTikTok && (s.is_photo === true);

                    let thumb = '';
                    if (!isTikTok && videoId) {
                        thumb = isShort
                            ? `https://i.ytimg.com/vi/${videoId}/oar2.jpg`
                            : `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
                    }

                    const thumbW = isShort ? '45px' : '80px';
                    const thumbH = isShort ? '80px' : '45px';

                    const videoLink = s.video_url || '#';
                    const dateStr   = formatDate(s.submitted_at);

                    const platformBadge = isTikTok
                        ? `<span style="display:inline-flex;align-items:center;gap:3px;background:#010101;color:white;font-size:9px;font-weight:700;border-radius:4px;padding:2px 6px;flex-shrink:0;letter-spacing:0.3px;">
                               <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.76a4.85 4.85 0 0 1-1.01-.07z"/></svg>
                               TikTok
                           </span>`
                        : `<span style="display:inline-flex;align-items:center;gap:3px;background:#ff0000;color:white;font-size:9px;font-weight:700;border-radius:4px;padding:2px 6px;flex-shrink:0;letter-spacing:0.3px;">
                               <svg width="8" height="8" viewBox="0 0 24 24" fill="white"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                               YouTube
                           </span>`;

                    return `
                        <div style="
                            display: flex; align-items: center; gap: 12px;
                            padding: 10px 12px;
                            border-radius: 10px;
                            background: ${isDark ? '#2a2c2e' : '#f4f5f6'};
                            margin-bottom: 8px;
                            box-sizing: border-box;
                        ">
                            ${thumb ? `
                            <a href="${videoLink}" target="_blank" style="flex-shrink:0; display:block; border-radius:6px; overflow:hidden; width:${thumbW}; height:${thumbH}; line-height:0;">
                                <img src="${thumb}" style="width:${thumbW}; height:${thumbH}; object-fit:cover; display:block;" loading="lazy">
                            </a>` : ''}
                            <div style="flex:1; min-width:0;">
                                <div style="display:flex;align-items:center;gap:5px;margin-bottom:3px;">
                                    ${platformBadge}
                                    <a href="${videoLink}" target="_blank" style="
                                            font-size: 12px; font-weight: 600;
                                            color: ${isDark ? '#e5e7eb' : '#393b3d'};
                                            text-decoration: none;
                                            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
                                            min-width:0;
                                        " onmouseover="this.style.textDecoration='underline'" onmouseout="this.style.textDecoration='none'">${s.video_title || videoLink}</a>
                                </div>
                                <div style="font-size: 11px; color: ${isDark ? '#9ca3af' : '#9ca3af'};">
                                    ${dateStr}
                                </div>
                            </div>
                            <div class="roearn-yt-status-tag" data-status="${s.status}" style="
                                flex-shrink: 0;
                                font-size: 11px; font-weight: 700;
                                color: ${isDark ? cfg.tagColor : cfg.tagColor};
                                background: ${isDark ? cfg.tagBgDark : cfg.tagBg};
                                border-radius: 6px; padding: 3px 9px;
                                white-space: nowrap; cursor: default;
                            ">${cfg.label}</div>
                        </div>`;
                }).join('');
            }

            const statsApproved = submissions.filter(s => s.status === 'approved').length;
            const statsPending  = submissions.filter(s => s.status === 'pending').length;
            const statsRejected = submissions.filter(s => s.status === 'rejected').length;

            popup.innerHTML = `
                <div style="padding:32px 32px 28px 32px;display:flex;flex-direction:column;flex:1;overflow:hidden;">
                <button id="roearn-yt-history-close" style="
                    position: absolute; top: 20px; right: 20px;
                    background: none; border: none; font-size: 28px; cursor: pointer;
                    color: #9ca3af; line-height: 1; padding: 0;
                ">×</button>

                <div style="margin-bottom: 18px; flex-shrink: 0;">
                    <div style="font-size: 22px; font-weight: 700; color: ${isDark ? '#ffffff' : '#393b3d'}; margin-bottom: 10px; text-align: center;">${getMessage("yt_modal_title")}</div>
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 8px; padding: 8px 14px; flex: 1; min-width: 80px; text-align: center;">
                            <div style="font-size: 18px; font-weight: 700; color: ${isDark ? '#fff' : '#393b3d'};">${submissions.length}</div>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 1px;">${getMessage("yt_stat_total")}</div>
                        </div>
                        <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 8px; padding: 8px 14px; flex: 1; min-width: 80px; text-align: center;">
                            <div style="font-size: 18px; font-weight: 700; color: #22c55e;">${statsApproved}</div>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 1px;">${getMessage("yt_status_paid")}</div>
                        </div>
                        <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 8px; padding: 8px 14px; flex: 1; min-width: 80px; text-align: center;">
                            <div style="font-size: 18px; font-weight: 700; color: #f59e0b;">${statsPending}</div>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 1px;">${getMessage("yt_status_in_review")}</div>
                        </div>
                        <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 8px; padding: 8px 14px; flex: 1; min-width: 80px; text-align: center;">
                            <div style="font-size: 18px; font-weight: 700; color: #ef4444;">${statsRejected}</div>
                            <div style="font-size: 11px; color: #9ca3af; margin-top: 1px;">${getMessage("yt_status_rejected")}</div>
                        </div>
                    </div>
                </div>

                <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px; flex-shrink: 0;">
                    <div style="font-size: 12px; font-weight: 700; color: #9ca3af; text-transform: uppercase; letter-spacing: 0.6px;">${getMessage("yt_videos_label")}</div>
                </div>

                <div id="roearn-yt-history-list" class="roearn-yt-history-list">
                    ${buildRows([...submissions].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)))}
                </div>

                <!-- Disclaimer -->
                <div style="margin-top: 14px; flex-shrink: 0; background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 12px; padding: 12px 16px;">
                    <div style="font-size: 12px; color: ${isDark ? '#d1d1d1' : '#606162'};">⚠️ ${getMessage('wm_disclaimer')}</div>
                </div>

                <!-- Watermark notice -->
                <div style="margin-top: 10px; flex-shrink: 0; background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 12px; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; gap: 14px;">
                    <div style="font-size: 12px; color: ${isDark ? '#d1d1d1' : '#606162'}; line-height: 1.5;">
                        ${getMessage('wm_watermark_notice')}
                    </div>
                    <div style="display: flex; align-items: center; gap: 12px; flex-shrink: 0;">
                        <div id="roearn-yt-wm-arrow" style="display: none; align-items: center;">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg" style="animation: roearn-arrow-bounce 1.8s ease-in-out infinite;">
                                <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <button id="roearn-yt-history-quality-btn" style="
                            padding: 7px 14px;
                            border-radius: 8px;
                            border: none;
                            background: linear-gradient(90deg, rgb(107,181,255), rgb(166,107,255), rgb(214,107,255), rgb(255,107,189), rgb(214,107,255), rgb(166,107,255), rgb(107,181,255)) 0% 0% / 200% 100%;
                            animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                            color: white;
                            font-size: 11px;
                            font-weight: 700;
                            cursor: pointer;
                            white-space: nowrap;
                            font-family: inherit;
                            text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                            transition: transform 0.15s ease;
                        " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage('wm_save_btn_view')}</button>
                    </div>
                </div>
                </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            const ytTooltipEl = document.createElement('div');
            ytTooltipEl.className = 'roearn-alt-tooltip roearn-yt-status-tooltip';
            ytTooltipEl.style.width = '312px';
            document.body.appendChild(ytTooltipEl);

            const rule1Text = getMessage('dashboard_creator_rule1');
            const rule2Text = getMessage('dashboard_creator_rule2');
            const rule3Text = getMessage('dashboard_creator_rule3');

            const ytStatusTooltips = {
                pending:  getMessage('yt_tooltip_pending'),
                approved: getMessage('yt_tooltip_approved'),
                rejected: `${getMessage('yt_tooltip_rejected')}\n\n${getMessage('dashboard_creator_rules')}\n• ${rule1Text}\n• ${rule2Text}\n• ${rule3Text}\n• ${getMessage('wm_tooltip_watermark_rule')}`
            };

            function positionYtTooltip(tag) {
                const r = tag.getBoundingClientRect();
                ytTooltipEl.style.display = 'block';
                const tw = ytTooltipEl.offsetWidth;
                ytTooltipEl.style.top = (r.top - ytTooltipEl.offsetHeight - 8) + 'px';
                ytTooltipEl.style.left = Math.max(8, r.right - tw) + 'px';
            }

            const hideYtTooltip = () => { ytTooltipEl.style.display = 'none'; };

            popup.querySelectorAll('.roearn-yt-status-tag').forEach(tag => {
                const status = tag.dataset.status;
                const tipText = ytStatusTooltips[status] || '';
                if (!tipText) return;
                tag.addEventListener('mouseenter', () => {
                    ytTooltipEl.innerHTML = '';
                    if (status === 'rejected') {
                        const lines = tipText.split('\n');
                        lines.forEach((line, i) => {
                            if (!line.trim()) return;
                            const el = document.createElement('div');
                            if (i === 0) {
                                el.style.cssText = 'margin-bottom: 8px;';
                                el.textContent = line;
                            } else if (line === getMessage('dashboard_creator_rules')) {
                                el.style.cssText = 'font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; margin-bottom: 5px; margin-top: 2px;';
                                el.textContent = line;
                            } else {
                                el.style.cssText = 'display: flex; gap: 6px; align-items: flex-start; margin-bottom: 3px; font-size: 11px;';
                                el.innerHTML = '<span style="color:#9ca3af; flex-shrink:0;">•</span><span>' + line.replace(/^• /, '') + '</span>';
                            }
                            ytTooltipEl.appendChild(el);
                        });
                    } else {
                        ytTooltipEl.textContent = tipText;
                    }
                    positionYtTooltip(tag);
                    window.addEventListener('scroll', hideYtTooltip, { capture: true, once: true });
                });
                tag.addEventListener('mouseleave', () => {
                    hideYtTooltip();
                    window.removeEventListener('scroll', hideYtTooltip, true);
                });
            });

            const overlayMaskStyle2 = document.createElement('style');
            overlayMaskStyle2.id = 'roearn-overlay-mask';
            overlayMaskStyle2.textContent = [
                '.roearn-balance-section,',
                '.roearn-referral-section,',
                '.roearn-extras-section,',
                '.roearn-referral-list-section { box-shadow: none !important; }',
                '.roearn-yt-history-list {',
                '    max-height: 175px; overflow-y: auto; flex: 1;',
                '    overflow-y: overlay;',
                '}',
                '.roearn-yt-history-list::-webkit-scrollbar { width: 8px; }',
                '.roearn-yt-history-list::-webkit-scrollbar-track {',
                '    background: ' + (isDark ? '#2e3031' : '#f1f1f1') + '; border-radius: 4px;',
                '}',
                '.roearn-yt-history-list::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }',
                '.roearn-yt-history-list::-webkit-scrollbar-thumb:hover { background: #555; }',
            ].join('\n');
            document.head.appendChild(overlayMaskStyle2);

            requestAnimationFrame(() => {
                scalePopup();
                window.addEventListener('resize', scalePopup);
            });

            function closeHistoryOverlay() {
                window.removeEventListener('resize', scalePopup);
                overlay.remove();
                ytTooltipEl.remove();
                const mask = document.getElementById('roearn-overlay-mask');
                if (mask) mask.remove();
            }

            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeHistoryOverlay(); });
            popup.querySelector('#roearn-yt-history-close').addEventListener('click', closeHistoryOverlay);
            const ytWmArrow = popup.querySelector('#roearn-yt-wm-arrow');
            api.storage.local.get(['watermarkTabSeen'], (result) => {
                if (result.watermarkTabSeen !== true && ytWmArrow) {
                    ytWmArrow.style.display = 'flex';
                }
            });

            popup.querySelector('#roearn-yt-history-quality-btn').addEventListener('click', () => {
                if (ytWmArrow) ytWmArrow.style.display = 'none';
                api.storage.local.set({ watermarkTabSeen: true });
                openQualityGuide(popup.firstElementChild, closeHistoryOverlay, scalePopup, isDark);
            });


        }

        if (ytHistoryBtn) {
            ytHistoryBtn.addEventListener('click', () => {
                openSubmissionsHistoryModal(liveSubmissions);
            });
        }

        function setYtMsg(text, isError) {
            ytSubmitMsg.style.color = isError ? '#ef4444' : '#22c55e';
            ytSubmitMsg.textContent = text;
        }

        function getSubmitError(platform, errKey, extras) {
            const isYT = platform === 'youtube';
            const isTT = platform === 'tiktok';
            switch (errKey) {
                case 'missing_fields':
                    return getMessage('submit_err_missing_fields');
                case 'not_a_video_url':
                    return getMessage('submit_err_not_a_video_url');
                case 'youtube_channel_url':
                    return getMessage('submit_err_youtube_channel_url');
                case 'tiktok_profile_url':
                    return getMessage('submit_err_tiktok_profile_url');
                case 'tiktok_no_video_id':
                    return getMessage('submit_err_tiktok_no_video_id');
                case 'invalid_url':
                    if (isYT) return getMessage('submit_err_invalid_url_yt');
                    if (isTT) return getMessage('submit_err_invalid_url_tt');
                    return getMessage('submit_err_invalid_url');
                case 'video_not_found':
                    if (isYT) return getMessage('submit_err_video_not_found_yt');
                    if (isTT) return getMessage('submit_err_video_not_found_tt');
                    return getMessage('submit_err_video_not_found');
                case 'youtube_fetch_failed':
                    return getMessage('submit_err_yt_fetch_failed');
                case 'tiktok_fetch_failed':
                    return getMessage('submit_err_tt_fetch_failed');
                case 'username_not_in_description':
                    if (isYT) return getMessage('submit_err_username_not_in_desc_yt', [extras?.username || '']);
                    if (isTT) return getMessage('submit_err_username_not_in_desc_tt', [extras?.username || '']);
                    return getMessage('submit_err_username_not_in_desc');
                case 'insufficient_views':
                    return getMessage('submit_err_insufficient_views', [extras?.need || '1,000', extras?.have || '0']);
                case 'already_submitted':
                    if (isYT) return getMessage('submit_err_already_submitted_yt');
                    if (isTT) return getMessage('submit_err_already_submitted_tt');
                    return getMessage('submit_err_already_submitted');
                case 'db_error':
                    return getMessage('submit_err_db_error');
                case 'network_error':
                    return getMessage('submit_err_network_error');
                case 'auth_failed':
                    return getMessage('submit_err_auth_failed');
                default:
                    return getMessage('submit_err_default');
            }
        }

        let liveSubmissions = [...prefetchedSubmissions];

        async function loadYtSubmissions(userId) {
            api.runtime.sendMessage({ type: 'GET_VIDEO_SUBMISSIONS', userId }, (resp) => {
                if (!resp || resp.status !== 'ok') return;
                liveSubmissions = resp.submissions || [];
                if (ytHistoryBtn) {
                    ytHistoryBtn.style.display = liveSubmissions.length > 0 ? 'inline-block' : 'none';
                }
            });
        }

        function showVideoSubmitAgreement(onAgreed) {
            const existingAgreement = document.getElementById('roearn-submit-agreement-overlay');
            if (existingAgreement) existingAgreement.remove();

            const rbxBodyCheck = document.getElementById('rbx-body');
            const isDarkAg = rbxBodyCheck && rbxBodyCheck.classList.contains('dark-theme');

            const overlay = document.createElement('div');
            overlay.id = 'roearn-submit-agreement-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.75); z-index: 10001;
                display: flex; align-items: center; justify-content: center;
                padding: 3vh 20px; box-sizing: border-box;
            `;

            const popup = document.createElement('div');
            popup.style.cssText = `
                background: ${isDarkAg ? '#232527' : 'white'};
                border-radius: 16px;
                padding: 36px 36px 32px 36px;
                width: 520px;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                box-sizing: border-box;
                flex-shrink: 0;
            `;

            function scaleAgreementPopup() {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const popupH = popup.scrollHeight || 400;
                const scaleX = (vw * 0.92) / 520;
                const scaleY = (vh * 0.92) / popupH;
                const scale = Math.min(1.25, scaleX, scaleY);
                popup.style.transform = `scale(${scale})`;
                popup.style.transformOrigin = 'center center';
            }

            requestAnimationFrame(() => {
                scaleAgreementPopup();
                window.addEventListener('resize', scaleAgreementPopup);
            });

            popup.innerHTML = `
                <button id="roearn-agreement-close" style="
                    position: absolute; top: 16px; right: 20px;
                    background: none; border: none; font-size: 28px; cursor: pointer;
                    color: #9ca3af; line-height: 1; padding: 0;
                ">×</button>

                <div style="margin-bottom: 22px;">
                    <div style="font-size: 22px; font-weight: 700; color: ${isDarkAg ? '#ffffff' : '#393b3d'}; margin-bottom: 10px; text-align: center;">${getMessage("dashboard_submit_agreement_title")}</div>
                    <div style="font-size: 14px; color: ${isDarkAg ? '#d1d1d1' : '#606162'}; line-height: 1.7; text-align: center;">
                        ${getMessage("dashboard_submit_agreement_body")}
                    </div>
                </div>

                <div style="display: flex; gap: 10px;">
                    <button id="roearn-agreement-cancel" style="
                        flex: 1;
                        padding: 12px;
                        border-radius: 10px;
                        border: 1px solid ${isDarkAg ? '#444648' : '#d1d5db'};
                        background: transparent;
                        color: ${isDarkAg ? '#9ca3af' : '#606162'};
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: inherit;
                        transition: transform 0.15s ease;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("dashboard_submit_agreement_cancel")}</button>
                    <button id="roearn-agreement-confirm" style="
                        flex: 1;
                        padding: 12px;
                        border-radius: 10px;
                        border: none;
                        background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                        animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                        color: white;
                        font-size: 14px;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: inherit;
                        text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                        transition: transform 0.15s ease;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("dashboard_submit_agreement_confirm")}</button>
                </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            requestAnimationFrame(scaleAgreementPopup);

            function closeAgreement() {
                window.removeEventListener('resize', scaleAgreementPopup);
                overlay.remove();
            }

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeAgreement();
            });

            popup.querySelector('#roearn-agreement-close').addEventListener('click', closeAgreement);
            popup.querySelector('#roearn-agreement-cancel').addEventListener('click', closeAgreement);

            popup.querySelector('#roearn-agreement-confirm').addEventListener('click', () => {
                api.storage.local.set({ videoSubmitAgreed: true });
                closeAgreement();
                onAgreed();
            });
        }

        function showViewsSnapshotAgreement(onAgreed) {
            const existingSnap = document.getElementById('roearn-views-snapshot-overlay');
            if (existingSnap) existingSnap.remove();

            const rbxBodyCheck = document.getElementById('rbx-body');
            const isDarkSnap = rbxBodyCheck && rbxBodyCheck.classList.contains('dark-theme');

            const overlay = document.createElement('div');
            overlay.id = 'roearn-views-snapshot-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.75); z-index: 10002;
                display: flex; align-items: center; justify-content: center;
                padding: 3vh 20px; box-sizing: border-box;
            `;

            const popup = document.createElement('div');
            popup.style.cssText = `
                background: ${isDarkSnap ? '#232527' : 'white'};
                border-radius: 16px;
                padding: 36px 36px 32px 36px;
                width: 520px;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                box-sizing: border-box;
                flex-shrink: 0;
            `;

            function scaleSnapshotPopup() {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const popupH = popup.scrollHeight || 380;
                const scaleX = (vw * 0.92) / 520;
                const scaleY = (vh * 0.92) / popupH;
                const scale = Math.min(1.25, scaleX, scaleY);
                popup.style.transform = `scale(${scale})`;
                popup.style.transformOrigin = 'center center';
            }

            requestAnimationFrame(() => {
                scaleSnapshotPopup();
                window.addEventListener('resize', scaleSnapshotPopup);
            });

            popup.innerHTML = `
                <button id="roearn-snapshot-close" style="
                    position: absolute; top: 16px; right: 20px;
                    background: none; border: none; font-size: 28px; cursor: pointer;
                    color: #9ca3af; line-height: 1; padding: 0;
                ">×</button>

                <div style="text-align: center; margin-bottom: 10px;">
                    <div style="font-size: 22px; font-weight: 700; color: ${isDarkSnap ? '#ffffff' : '#393b3d'}; margin-bottom: 14px;">${getMessage("creator_snapshot_title")}</div>
                    <div style="font-size: 14px; color: ${isDarkSnap ? '#d1d1d1' : '#606162'}; line-height: 1.75; text-align: left;">
                        <p style="margin: 0 0 12px 0;">${getMessage("creator_snapshot_body1")}</p>
                        <p style="margin: 0; color: ${isDarkSnap ? '#a3a3a3' : '#888'};">${getMessage("creator_snapshot_body2")}</p>
                    </div>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 24px;">
                    <button id="roearn-snapshot-cancel" style="
                        flex: 1;
                        padding: 12px;
                        border-radius: 10px;
                        border: 1px solid ${isDarkSnap ? '#444648' : '#d1d5db'};
                        background: transparent;
                        color: ${isDarkSnap ? '#9ca3af' : '#606162'};
                        font-size: 14px;
                        font-weight: 600;
                        cursor: pointer;
                        font-family: inherit;
                        transition: transform 0.15s ease;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("creator_snapshot_not_yet")}</button>
                    <button id="roearn-snapshot-confirm" style="
                        flex: 1;
                        padding: 12px;
                        border-radius: 10px;
                        border: none;
                        background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
                        animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                        color: white;
                        font-size: 14px;
                        font-weight: 700;
                        cursor: pointer;
                        font-family: inherit;
                        text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                        transition: transform 0.15s ease;
                    " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage("creator_snapshot_submit_now")}</button>
                </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            requestAnimationFrame(scaleSnapshotPopup);

            function closeSnapshot() {
                window.removeEventListener('resize', scaleSnapshotPopup);
                overlay.remove();
            }

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeSnapshot();
            });

            popup.querySelector('#roearn-snapshot-close').addEventListener('click', closeSnapshot);
            popup.querySelector('#roearn-snapshot-cancel').addEventListener('click', closeSnapshot);

            popup.querySelector('#roearn-snapshot-confirm').addEventListener('click', () => {
                api.storage.local.set({ viewsSnapshotAgreed: true });
                closeSnapshot();
                onAgreed();
            });
        }

        if (ytSubmitBtn) {
            ytSubmitBtn.addEventListener('click', async () => {
                const url = ytSubmitInput.value.trim();

                if (!url) {
                    setYtMsg(getSubmitError('any', 'missing_fields'), true);
                    return;
                }

                const isYouTube = url.includes('youtube.com') || url.includes('youtu.be');
                const isTikTok  = url.includes('tiktok.com') || url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com');
                const platform  = isYouTube ? 'youtube' : (isTikTok ? 'tiktok' : null);

                if (!platform) {
                    setYtMsg(getSubmitError('any', 'not_a_video_url'), true);
                    return;
                }

                if (isYouTube) {
                    if (/youtube\.com\/@/.test(url) || /youtube\.com\/channel\//.test(url) || /youtube\.com\/c\//.test(url) || /youtube\.com\/user\//.test(url)) {
                        setYtMsg(getSubmitError('youtube', 'youtube_channel_url'), true);
                        return;
                    }
                    const hasVideoParam = /[?&]v=/.test(url) || /youtu\.be\//.test(url) || /\/shorts\//.test(url) || /\/live\//.test(url) || /\/embed\//.test(url);
                    if (!hasVideoParam) {
                        setYtMsg(getSubmitError('youtube', 'invalid_url'), true);
                        return;
                    }
                }

                const isShortLink = isTikTok && (url.includes('vm.tiktok.com') || url.includes('vt.tiktok.com'));
                if (isTikTok) {
                    if (/tiktok\.com\/@[^/]+\/?(\?.*)?$/.test(url)) {
                        setYtMsg(getSubmitError('tiktok', 'tiktok_profile_url'), true);
                        return;
                    }
                    if (!isShortLink && !/\/(?:video|photo)\/\d+/.test(url)) {
                        setYtMsg(getSubmitError('tiktok', 'tiktok_no_video_id'), true);
                        return;
                    }
                }

                const [agreed, snapshotAgreed] = await new Promise((resolve) => {
                    api.storage.local.get(['videoSubmitAgreed', 'viewsSnapshotAgreed'], (result) => {
                        resolve([result.videoSubmitAgreed === true, result.viewsSnapshotAgreed === true]);
                    });
                });

                const doSubmit = () => {
                    ytSubmitBtn.disabled = true;
                    ytSubmitBtn.textContent = '...';
                    setYtMsg('', false);

                    getAuthenticatedUser().then((userData) => {
                        if (!userData) {
                            setYtMsg(getSubmitError(platform, 'auth_failed'), true);
                            ytSubmitBtn.disabled = false;
                            ytSubmitBtn.textContent = getMessage("yt_submit_btn");
                            return;
                        }

                        const msgType = isYouTube ? 'SUBMIT_VIDEO' : 'SUBMIT_TIKTOK';

                        api.runtime.sendMessage({
                            type: msgType,
                            userId: userData.id,
                            robloxUsername: userData.name,
                            videoUrl: url
                        }, (resp) => {
                            ytSubmitBtn.disabled = false;
                            ytSubmitBtn.textContent = getMessage("yt_submit_btn");

                            if (!resp || resp.status !== 'ok') {
                                const errKey = resp?.error || 'internal_error';

                                if (errKey === 'username_not_in_description') {
                                    setYtMsg(getSubmitError(platform, 'username_not_in_description', { username: userData.name }), true);
                                } else if (errKey === 'insufficient_views') {
                                    const have = (resp.view_count != null) ? Number(resp.view_count).toLocaleString() : '0';
                                    const need = (resp.min_views  != null) ? Number(resp.min_views).toLocaleString()  : '1,000';
                                    setYtMsg(getSubmitError(platform, 'insufficient_views', { have, need }), true);
                                } else {
                                    setYtMsg(getSubmitError(platform, errKey), true);
                                }
                                return;
                            }

                            setYtMsg(getMessage("yt_submit_success"), false);
                            ytSubmitInput.value = '';
                            api.runtime.sendMessage({ type: 'GET_VIDEO_SUBMISSIONS', userId: userData.id }, (r) => {
                                if (r?.status === 'ok') liveSubmissions = r.submissions || [];
                                if (ytHistoryBtn) ytHistoryBtn.style.display = 'inline-block';
                            });
                        });
                    });
                };

                if (!agreed) {
                    showVideoSubmitAgreement(() => { showViewsSnapshotAgreement(doSubmit); });
                } else if (!snapshotAgreed) {
                    showViewsSnapshotAgreement(doSubmit);
                } else {
                    doSubmit();
                }
            });

            (async () => {
                const userData = await getAuthenticatedUser();
                if (userData) loadYtSubmissions(userData.id);
            })();
        }

        function openQualityGuide(targetEl, closeFn, scalePopupFn, isDarkMode, initialTab) {
            api.storage.local.set({ watermarkTabSeen: true });
            closeFn();

            openExtensionWatermarkGuide('roearn', 'RoEarn Video Watermark', null, null, 'watermarkTabSeen');
        }
        openExtensionWatermarkGuide = function(extName, title, imageUrl, watermarkFileUrl, seenKey) {
            const rbxBodyCheck = document.getElementById('rbx-body');
            const isDark = rbxBodyCheck && rbxBodyCheck.classList.contains('dark-theme');

            api.storage.local.set({ [seenKey]: true });
            const arrowEl = document.getElementById('roearn-ext-wm-arrow-' + extName);
            if (arrowEl) arrowEl.style.display = 'none';

            const existingOverlay = document.getElementById('roearn-ext-wm-overlay');
            if (existingOverlay) existingOverlay.remove();

            const overlay = document.createElement('div');
            overlay.id = 'roearn-ext-wm-overlay';
            overlay.style.cssText = [
                'position:fixed;top:0;left:0;width:100%;height:100%;',
                'background:rgba(0,0,0,0.75);z-index:10001;',
                'display:flex;align-items:center;justify-content:center;',
                'padding:3vh 20px;box-sizing:border-box;',
                "font-family:'HCo Gotham SSm',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
            ].join('');

            const popup = document.createElement('div');
            popup.style.cssText = [
                'background:' + (isDark ? '#232527' : 'white') + ';',
                'border-radius:16px;padding:36px 36px 32px 36px;',
                'width:684px;box-sizing:border-box;',
                'position:relative;flex-shrink:0;'
            ].join('');

            const extConfigs = {
                roearn:   { label: 'RoEarn',   title: 'RoEarn Video Watermark',   seenKey: 'watermarkTabSeen', imgFile: 'watermark_example1', dlFile: 'watermark_roearn'         },
                roexport: { label: 'RoExport', title: 'RoExport Video Watermark', seenKey: 'roexportWmSeen',  imgFile: 'watermark_example3', dlFile: 'watermark_roexport'  },
                roregion: { label: 'RoRegion', title: 'RoRegion Video Watermark', seenKey: 'roregionWmSeen',  imgFile: 'watermark_example2', dlFile: 'watermark_roregion'  },
            };
            let currentExt = extName;

            function getAssetUrl(file) { return api.runtime.getURL('icons/' + file + '.png'); }

            if (!document.getElementById('roearn-wm-arrow-style')) {
                const wmArrowStyle = document.createElement('style');
                wmArrowStyle.id = 'roearn-wm-arrow-style';
                wmArrowStyle.textContent = `
                    @keyframes roearn-arrow-bounce-right {
                        0%   { transform: translateX(0px); }
                        50%  { transform: translateX(7px); }
                        100% { transform: translateX(0px); }
                    }
                    @keyframes roearn-arrow-bounce-left {
                        0%   { transform: translateX(0px); }
                        50%  { transform: translateX(-7px); }
                        100% { transform: translateX(0px); }
                    }
                    .roearn-wm-arrow-left  { animation: roearn-arrow-bounce-right 1.8s ease-in-out infinite; }
                    .roearn-wm-arrow-right { animation: roearn-arrow-bounce-left  1.8s ease-in-out infinite; }
                `;
                document.head.appendChild(wmArrowStyle);
            }

            if (!document.getElementById('roearn-wm-fade-style')) {
                const fadeStyle = document.createElement('style');
                fadeStyle.id = 'roearn-wm-fade-style';
                fadeStyle.textContent = `
                    #roearn-ext-wm-body {
                        transition: opacity 0.18s ease;
                    }
                    #roearn-ext-wm-body.roearn-fading {
                        opacity: 0;
                    }
                    .roearn-ext-tab {
                        font-size: 11px; font-weight: 700; cursor: pointer;
                        padding: 5px 12px; border-radius: 6px; border: none;
                        font-family: inherit; transition: background 0.15s ease, color 0.15s ease;
                        white-space: nowrap;
                    }
                `;
                document.head.appendChild(fadeStyle);
            }

            function renderTabBar() {
                const tabBar = popup.querySelector('#roearn-ext-tab-bar');
                if (!tabBar) return;
                ['roearn','roexport','roregion'].forEach(key => {
                    const btn = tabBar.querySelector(`[data-ext="${key}"]`);
                    if (!btn) return;
                    const isActive = key === currentExt;
                    btn.style.background = isActive
                        ? (isDark ? '#3a3c3e' : '#e0e1e2')
                        : 'transparent';
                    btn.style.color = isActive
                        ? (isDark ? '#ffffff' : '#393b3d')
                        : (isDark ? '#9ca3af' : '#9ca3af');
                });
            }

            function switchTo(extKey) {
                if (extKey === currentExt) return;
                const body = popup.querySelector('#roearn-ext-wm-body');
                if (!body) { currentExt = extKey; renderPopup(); return; }
                body.classList.add('roearn-fading');
                setTimeout(() => {
                    currentExt = extKey;
                    renderBody();
                    renderTabBar();
                    body.classList.remove('roearn-fading');
                }, 180);
            }

            function buildTabBar() {
                if (!isCreatorMode) return '';
                return `
                    <div id="roearn-ext-tab-bar" style="
                        position:absolute;top:14px;left:16px;z-index:2;
                        display:inline-flex;align-items:center;gap:2px;
                        background:${isDark ? '#2a2c2e' : '#f0f1f2'};
                        border-radius:7px;padding:2px;
                        transform:scale(0.85);transform-origin:top left;
                    ">
                        <button class="roearn-ext-tab" data-ext="roearn">RoEarn</button>
                        <button class="roearn-ext-tab" data-ext="roexport">RoExport</button>
                        <button class="roearn-ext-tab" data-ext="roregion">RoRegion</button>
                    </div>
                `;
            }

            function renderBody() {
                const cfg = extConfigs[currentExt];
                const curImg  = getAssetUrl(cfg.imgFile);
                const curFile = getAssetUrl(cfg.dlFile);
                const body = popup.querySelector('#roearn-ext-wm-body');
                if (!body) return;

                body.innerHTML = `
                    <div style="text-align:center;margin-bottom:16px;">
                        <div style="font-size:24px;font-weight:700;color:${isDark ? '#ffffff' : '#393b3d'};margin-bottom:6px;line-height:1.3;">${cfg.title}</div>
                        <div style="font-size:12px;color:${isDark ? '#9ca3af' : '#606162'};line-height:1.6;">${getMessage('wm_popup_subtitle')}</div>
                    </div>

                    <div style="display:flex;gap:16px;align-items:stretch;">
                        <div style="flex-shrink:0;display:flex;flex-direction:column;gap:6px;width:170px;">
                            <div style="aspect-ratio:9/16;overflow:hidden;background:#111;position:relative;border-radius:10px;">
                                <img src="${curImg}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="eager">
                                <div style="position:absolute;top:8px;left:8px;z-index:1;"><span style="display:inline-block;font-size:7px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:0.8px;background:#555;border-radius:3px;padding:2px 6px;">${getMessage('wm_example_label')}</span></div>
                            </div>
                            <div style="text-align:center;font-size:10px;font-weight:600;color:#9ca3af;">${getMessage('wm_how_it_should_look')}</div>
                        </div>

                        <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:12px;">
                            <div style="background:${isDark ? '#2a2c2e' : '#f4f5f6'};border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:9px;">
                                <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#9ca3af;">${getMessage('wm_requirements_label')}</div>
                                <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.55;"><span style="color:#22c55e;font-weight:700;flex-shrink:0;margin-top:1px;">✓</span><span>${getMessage('wm_req1')}</span></div>
                                <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.55;"><span style="color:#22c55e;font-weight:700;flex-shrink:0;margin-top:1px;">✓</span><span>${getMessage('wm_req2')}</span></div>
                                <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.55;"><span style="color:#e53535;font-weight:700;flex-shrink:0;margin-top:1px;">✕</span><span>${getMessage('wm_req3')}</span></div>
                            </div>

                            <div style="background:${isDark ? '#2a2c2e' : '#f4f5f6'};border-radius:10px;padding:18px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;text-align:center;flex:1;">
                                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#9ca3af;">${getMessage('wm_download_label')}</div>
                                    <div style="font-size:12px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.6;">${getMessage('wm_save_desc')}</div>
                                    <button id="roearn-ext-save-wm-btn" data-wm-url="${curFile}" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 24px;border-radius:8px;border:none;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;transition:transform 0.15s ease;white-space:nowrap;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'"><svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"><path d="M7 1v8M7 9l-2.5-2.5M7 9l2.5-2.5M1.5 12.5h11" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>${getMessage('wm_save_btn')}</button>
                                </div>
                        </div>
                    </div>
                `;

                const saveBtn = body.querySelector('#roearn-ext-save-wm-btn');
                if (saveBtn) {
                    saveBtn.addEventListener('click', async () => {
                        const url = saveBtn.dataset.wmUrl;
                        try {
                            const resp = await fetch(url);
                            const blob = await resp.blob();
                            const blobUrl = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = blobUrl; a.download = url.split('/').pop() || 'watermark.png';
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                            setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
                        } catch (e) {
                            const a = document.createElement('a');
                            a.href = url; a.download = url.split('/').pop() || 'watermark.png';
                            document.body.appendChild(a); a.click(); document.body.removeChild(a);
                        }
                    });
                }

            }

            function renderPopup() {
                popup.innerHTML = `
                    <button id="roearn-ext-wm-close" style="position:absolute;top:16px;right:18px;background:none;border:none;font-size:26px;cursor:pointer;color:#9ca3af;line-height:1;padding:0;z-index:1;">×</button>
                    ${buildTabBar()}
                    <div id="roearn-ext-wm-body"></div>
                `;

                popup.querySelector('#roearn-ext-wm-close').addEventListener('click', closeExtPopup);

                if (isCreatorMode) {
                    popup.querySelectorAll('.roearn-ext-tab').forEach(btn => {
                        btn.addEventListener('click', () => switchTo(btn.dataset.ext));
                    });
                    renderTabBar();
                }

                renderBody();

            }

            function scaleExtPopup() {
                const vw = window.innerWidth, vh = window.innerHeight;
                const scaleX = (vw * 0.92) / 684;
                const scaleY = (vh * 0.92) / (popup.scrollHeight || 520);
                const scale  = Math.min(1.3, scaleX, scaleY);
                popup.style.transform = `scale(${scale})`;
                popup.style.transformOrigin = 'center center';
            }

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            renderPopup();
            requestAnimationFrame(scaleExtPopup);
            window.addEventListener('resize', scaleExtPopup);

            overlay.addEventListener('click', (e) => { if (e.target === overlay) closeExtPopup(); });

            function closeExtPopup() {
                window.removeEventListener('resize', scaleExtPopup);
                overlay.remove();
            }
        }

        const getStartedBtn = extrasSection.querySelector('#roearn-creator-get-started');

        getStartedBtn.addEventListener('click', () => {
            const creatorArrowEl = extrasSection.querySelector('#roearn-creator-arrow');
            if (creatorArrowEl) creatorArrowEl.style.display = 'none';
            api.storage.local.set({ creatorArrowDismissed: true });

            const existingOverlay = document.getElementById('roearn-creator-popup-overlay');
            if (existingOverlay) existingOverlay.remove();

            const overlay = document.createElement('div');
            overlay.id = 'roearn-creator-popup-overlay';
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.75); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                padding: 3vh 20px; box-sizing: border-box;
            `;

            const popup = document.createElement('div');
            const rbxBodyCheck = document.getElementById('rbx-body');
            const isDark = rbxBodyCheck && rbxBodyCheck.classList.contains('dark-theme');
            popup.style.cssText = `
                background: ${isDark ? '#232527' : 'white'};
                border-radius: 16px;
                padding: 0;
                width: 684px;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                position: relative;
                box-sizing: border-box;
                flex-shrink: 0;
                overflow: hidden;
            `;

            function scalePopup() {
                const vw = window.innerWidth;
                const vh = window.innerHeight;
                const popupH = popup.scrollHeight || 700;
                const scaleX = (vw * 0.92) / 684;
                const scaleY = (vh * 0.92) / popupH;
                const scale = Math.min(1.25, scaleX, scaleY);
                popup.style.transform = `scale(${scale})`;
                popup.style.transformOrigin = 'center center';
            }

            requestAnimationFrame(() => {
                scalePopup();
                window.addEventListener('resize', scalePopup);
            });

            const isWin11 = (() => {
                try {
                    if (navigator.userAgentData?.platform === 'Windows') return true;
                } catch(e) {}
                return /Windows NT 10\.0/.test(navigator.userAgent) && /Win64/.test(navigator.userAgent);
            })();

            const capcutUrl = api.runtime.getURL('icons/capcut.png');
            const snippingUrl = api.runtime.getURL('icons/snipping-tool.png');

            popup.innerHTML = `
                <div style="padding:36px 36px 32px 36px;position:relative;">
                <button id="roearn-creator-popup-close" style="
                    position: absolute; top: 20px; right: 20px;
                    background: none; border: none; font-size: 28px; cursor: pointer;
                    color: #9ca3af; line-height: 1; padding: 0;
                ">×</button>

                <div style="text-align: center; margin-bottom: 22px;">
                    <div style="font-size: 26px; font-weight: 700; color: ${isDark ? '#ffffff' : '#393b3d'}; margin-bottom: 10px;">${getMessage("dashboard_creator_title")}</div>
                    <div style="font-size: 14px; color: ${isDark ? '#d1d1d1' : '#606162'}; line-height: 1.7;">
                        ${getMessage("dashboard_creator_desc")}
                    </div>
                </div>

                <!-- Rates: full-width two columns -->
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                    <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 14px;">
                        <div style="font-size: 22px; font-weight: 700; color: ${isDark ? '#ffffff' : '#393b3d'}; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <span class="icon-robux-16x16" style="display:inline-block; margin-top: 1px;"></span>300
                        </div>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: ${isDark ? '#ffffff' : '#393b3d'};">${getMessage('creator_rate_shorts_label')}</div>
                            <div style="font-size: 11px; color: ${isDark ? '#9ca3af' : '#606162'}; margin-top: 1px;">${getMessage("dashboard_creator_per_views")}</div>
                        </div>
                    </div>
                    <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 12px; padding: 16px; display: flex; align-items: center; gap: 14px;">
                        <div style="font-size: 22px; font-weight: 700; color: ${isDark ? '#ffffff' : '#393b3d'}; display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
                            <span class="icon-robux-16x16" style="display:inline-block; margin-top: 1px;"></span>1,000
                        </div>
                        <div>
                            <div style="font-size: 13px; font-weight: 600; color: ${isDark ? '#ffffff' : '#393b3d'};">${getMessage('creator_rate_longform_label')}</div>
                            <div style="font-size: 11px; color: ${isDark ? '#9ca3af' : '#606162'}; margin-top: 1px;">${getMessage("dashboard_creator_per_views")}</div>
                        </div>
                    </div>
                </div>

                <!-- Rules: full-width -->
                <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 12px; padding: 14px 18px; margin-bottom: 12px;">
                    <div style="font-size: 12px; font-weight: 700; color: ${isDark ? '#9ca3af' : '#9ca3af'}; text-transform: uppercase; letter-spacing: 0.6px; margin-bottom: 10px;">${getMessage("dashboard_creator_rules")}</div>
                    <div style="display: flex; flex-direction: column; gap: 6px;">
                        <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: ${isDark ? '#d1d1d1' : '#606162'};">
                            <span style="color: #22c55e; font-weight: 700; flex-shrink: 0; margin-top: 1px;">✓</span>
                            <span>${getMessage('creator_rule1_full')}</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: ${isDark ? '#d1d1d1' : '#606162'};">
                            <span style="color: #22c55e; font-weight: 700; flex-shrink: 0; margin-top: 1px;">✓</span>
                            <span>${getMessage('creator_rule2_full')}</span>
                        </div>
                        <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: ${isDark ? '#d1d1d1' : '#606162'};">
                            <span style="color: #22c55e; font-weight: 700; flex-shrink: 0; margin-top: 1px;">✓</span>
                            <span>${getMessage('creator_rule3_full')}</span>
                        </div>
                        <div id="roearn-wm-rule-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                            <div style="display: flex; align-items: flex-start; gap: 8px; font-size: 13px; color: ${isDark ? '#d1d1d1' : '#606162'}; flex: 1; min-width: 0;">
                                <span style="color: #22c55e; font-weight: 700; flex-shrink: 0; margin-top: 1px;">✓</span>
                                <span>${getMessage('creator_rule4_full')}</span>
                            </div>
                            <div style="display: flex; align-items: center; flex-shrink: 0; gap: 12px;">
                                <div style="display: flex; align-items: center; flex-shrink: 0; animation: roearn-arrow-bounce 1.8s ease-in-out infinite;">
                                    <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg">
                                        <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                                    </svg>
                                </div>
                                <button id="roearn-creator-watermark-rule-btn" style="
                                    flex-shrink: 0; padding: 7px 14px; border-radius: 8px; border: none;
                                    background: linear-gradient(90deg, rgb(107,181,255), rgb(166,107,255), rgb(214,107,255), rgb(255,107,189), rgb(214,107,255), rgb(166,107,255), rgb(107,181,255)) 0% 0% / 200% 100%;
                                    animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                                    color: white;
                                    font-size: 11px; font-weight: 700; cursor: pointer;
                                    font-family: inherit; white-space: nowrap;
                                    text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                                    transition: transform 0.15s ease;
                                " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">${getMessage('wm_save_btn_view')}</button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Disclaimer -->
                <div style="background: ${isDark ? '#2a2c2e' : '#f4f5f6'}; border-radius: 12px; padding: 14px 18px; margin-bottom: 10px;">
                    <div style="font-size: 13px; color: ${isDark ? '#d1d1d1' : '#606162'};">⚠️ ${getMessage('wm_disclaimer')}</div>
                </div>
                </div>
            `;

            overlay.appendChild(popup);
            document.body.appendChild(overlay);

            const overlayMaskStyle = document.createElement('style');
            overlayMaskStyle.id = 'roearn-overlay-mask';
            overlayMaskStyle.textContent = `
                .roearn-balance-section,
                .roearn-referral-section,
                .roearn-extras-section,
                .roearn-referral-list-section {
                    box-shadow: none !important;
                }
            `;
            document.head.appendChild(overlayMaskStyle);

            requestAnimationFrame(scalePopup);

            function closeOverlay() {
                window.removeEventListener('resize', scalePopup);
                overlay.remove();
                const mask = document.getElementById('roearn-overlay-mask');
                if (mask) mask.remove();
            }

            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeOverlay();
            });
            popup.querySelector('#roearn-creator-popup-close').addEventListener('click', closeOverlay);

            popup.querySelector('#roearn-creator-watermark-rule-btn').addEventListener('click', () => {
                api.storage.local.set({ watermarkTabSeen: true });
                openQualityGuide(popup.firstElementChild, closeOverlay, scalePopup, isDark, 'watermark');
            });

        });

        const subscribeArrow = extrasSection.querySelector('#roearn-subscribe-arrow');
        const subscribeLink = extrasSection.querySelector('#roearn-subscribe-link');

        if (!document.getElementById('roearn-arrow-bounce-style')) {
            const arrowStyle = document.createElement('style');
            arrowStyle.id = 'roearn-arrow-bounce-style';
            arrowStyle.textContent = `
                @keyframes roearn-arrow-bounce {
                    0%   { transform: translateX(0px); }
                    50%  { transform: translateX(8px); }
                    100% { transform: translateX(0px); }
                }
                #roearn-subscribe-arrow {
                    animation: roearn-arrow-bounce 1.8s ease-in-out infinite;
                }
                .roearn-subscribe-arrow-svg path {
                    stroke: #606162;
                }
                .dark-theme .roearn-subscribe-arrow-svg path {
                    stroke: #9ca3af;
                }
            `;
            document.head.appendChild(arrowStyle);
        }

        if (subscribeArrow) {
            subscribeArrow.style.display = 'none';
            api.storage.local.get(['subscribeArrowDismissed'], (result) => {
                if (result.subscribeArrowDismissed !== true) {
                    subscribeArrow.style.display = 'flex';
                }
            });
        }

        if (subscribeLink) {
            subscribeLink.addEventListener('click', () => {
                if (subscribeArrow) {
                    subscribeArrow.style.display = 'none';
                }
                api.storage.local.set({ subscribeArrowDismissed: true });
                window.open(subscribeLink.dataset.href, '_blank');
            });
        }

        const creatorArrow = extrasSection.querySelector('#roearn-creator-arrow');

        if (!document.getElementById('roearn-creator-arrow-style')) {
            const creatorArrowStyle = document.createElement('style');
            creatorArrowStyle.id = 'roearn-creator-arrow-style';
            creatorArrowStyle.textContent = `
                #roearn-creator-arrow {
                    animation: roearn-arrow-bounce 1.8s ease-in-out infinite;
                }
            `;
            document.head.appendChild(creatorArrowStyle);
        }

        if (creatorArrow) {
            creatorArrow.style.display = 'none';
            api.storage.local.get(['creatorArrowDismissed'], (result) => {
                if (result.creatorArrowDismissed !== true) {
                    creatorArrow.style.display = 'flex';
                }
            });
        }

        leftColumnWrapper.appendChild(extrasSection);

        twoColumn.appendChild(leftColumnWrapper);
        twoColumn.appendChild(referralSection);

        panel.appendChild(header);

        panel.appendChild(twoColumn);

        const rbxBodyExt = document.getElementById('rbx-body');
        const isDarkExt = rbxBodyExt && rbxBodyExt.classList.contains('dark-theme');

        const isMobileDevice_ext = isMobileDevice;

        const isFirefox = /Firefox\//i.test(navigator.userAgent);

        const extensionsSection = document.createElement('div');
        extensionsSection.style.cssText = `margin-top: -10px; width: 100%; box-sizing: border-box; align-self: stretch;`;
        if (isMobileDevice) extensionsSection.classList.add('roearn-mobile-ext-section');

        if (isCreatorMode) {
            extensionsSection.innerHTML = `
                <div style="
                    background: ${isDarkExt ? '#232527' : 'white'};
                    border-radius: 12px;
                    padding: 30px;
                    box-shadow: 0 2px 8px rgba(0,0,0,${isDarkExt ? '0.3' : '0.1'});
                    width: 100%;
                    box-sizing: border-box;
                ">
                    <div style="margin-bottom: 24px;">
                        <div style="font-size: 26px; font-weight: 700; color: ${isDarkExt ? '#ffffff' : '#393b3d'}; margin-bottom: 6px;">${getMessage("creator_section_title")}</div>
                        <div style="font-size: 14px; color: ${isDarkExt ? '#d1d1d1' : '#606162'};">${getMessage("creator_section_desc")}</div>
                    </div>
                    <div style="display: grid; grid-template-columns: ${isMobileDevice ? '1fr' : '340px 1fr'}; gap: 24px; align-items: stretch;">

                        ${isMobileDevice ? '' : `
                        <!-- LEFT: analytics panel — fills full height, desktop only -->
                        <div style="
                            background: ${isDarkExt ? '#2a2c2e' : '#f4f5f6'};
                            border-radius: 10px;
                            padding: 24px;
                            display: flex;
                            flex-direction: column;
                            gap: 14px;
                        ">
                            <div style="font-size: 11px; font-weight: 700; color: ${isDarkExt ? '#9ca3af' : '#606162'}; text-transform: uppercase; letter-spacing: 0.7px; margin-bottom: 4px;">${getMessage("creator_stats_header")}</div>

                            <div style="background: ${isDarkExt ? '#232527' : 'white'}; border-radius: 10px; padding: 18px 20px; flex: 1;">
                                <div style="font-size: 11px; color: ${isDarkExt ? '#9ca3af' : '#606162'}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${getMessage("creator_stat_earned")}</div>
                                <div style="display: flex; align-items: center; gap: 8px; font-size: 32px; font-weight: 700; color: ${isDarkExt ? '#ffffff' : '#393b3d'}; line-height: 1;">
                                    <span class="icon-robux-16x16" style="display:inline-block; margin-top: 2px; margin-right: 0px; flex-shrink:0; transform: scale(1.2); transform-origin: center;"></span>${(prefetchedData?.videoTotalEarned || 0).toLocaleString()}
                                </div>
                            </div>

                            <div style="background: ${isDarkExt ? '#232527' : 'white'}; border-radius: 10px; padding: 18px 20px; flex: 1;">
                                <div style="font-size: 11px; color: ${isDarkExt ? '#9ca3af' : '#606162'}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${getMessage("creator_stat_views")}</div>
                                <div style="font-size: 32px; font-weight: 700; color: ${isDarkExt ? '#ffffff' : '#393b3d'}; line-height: 1;">${(prefetchedData?.videoTotalViews || 0).toLocaleString()}</div>
                            </div>

                            <div style="background: ${isDarkExt ? '#232527' : 'white'}; border-radius: 10px; padding: 18px 20px; flex: 1;">
                                <div style="font-size: 11px; color: ${isDarkExt ? '#9ca3af' : '#606162'}; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">${getMessage("creator_stat_approved")}</div>
                                <div style="font-size: 32px; font-weight: 700; color: ${isDarkExt ? '#ffffff' : '#393b3d'}; line-height: 1;">${prefetchedSubmissionsForCreator.filter(s => s.status === 'approved').length}</div>
                            </div>
                        </div>
                        `}

                        <!-- RIGHT: extension cards stacked -->
                        <div id="roearn-creator-extensions-col" style="display: flex; flex-direction: column; gap: 14px;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 2px;">
                                <div style="font-size: 14px; font-weight: 700; color: ${isDarkExt ? '#9ca3af' : '#606162'}; text-transform: uppercase; letter-spacing: 0.7px;">${getMessage("creator_also_make_label")}</div>
                                <span style="font-size: 13px; font-weight: 700; color: ${isDarkExt ? '#9ca3af' : '#606162'}; background: ${isDarkExt ? '#333537' : '#e9eaeb'}; padding: 2px 8px; border-radius: 20px; text-transform: uppercase; letter-spacing: 0.5px;">${getMessage("creator_optional_badge")}</span>
                            </div>
                            <div style="font-size: 12px; color: ${isDarkExt ? '#9ca3af' : '#606162'}; line-height: 1.5; margin-top: -6px; margin-bottom: 4px;">${getMessage("creator_primary_ext_desc")}</div>
                            <div id="roearn-creator-ext-inner" style="display: flex; flex-direction: column; gap: 14px;"></div>
                            <div style="
                                display: flex; align-items: flex-start; gap: 12px;
                                background: ${isDarkExt ? 'rgba(239,68,68,0.12)' : 'rgba(239,68,68,0.07)'};
                                border: 1px solid ${isDarkExt ? 'rgba(239,68,68,0.3)' : 'rgba(239,68,68,0.2)'};
                                border-radius: 10px; padding: 14px 16px; margin-top: 2px;
                            ">
                                <span style="font-size:16px;flex-shrink:0;margin-top:1px;">⚠️</span>
                                <div style="font-size:12px;color:${isDarkExt ? '#fca5a5' : '#b91c1c'};line-height:1.6;">
                                    ${getMessage("creator_video_requirement")}
                                </div>
                            </div>
                        </div>

                    </div>
                </div>
            `;
        } else if (!isFirefox) {
            extensionsSection.innerHTML = `
            <div style="
                background: ${isDarkExt ? '#232527' : 'white'};
                border-radius: 12px;
                padding: 30px;
                box-shadow: 0 2px 8px rgba(0,0,0,${isDarkExt ? '0.3' : '0.1'});
            ">
                <div style="margin-bottom: 18px;">
                    <div style="font-size: 26px; font-weight: 700; color: ${isDarkExt ? '#ffffff' : '#393b3d'};">${getMessage("dashboard_other_extensions")}</div>
                </div>
                <style>
                    #roearn-roexport-card {
                        background: ${isDarkExt ? '#2a2c2e' : '#f4f5f6'};
                        border-radius: 10px;
                        padding: 18px;
                        display: flex;
                        flex-wrap: wrap;
                        gap: 20px;
                        align-items: flex-start;
                        cursor: pointer;
                        transition: transform 0.15s ease;
                    }
                    #roearn-roexport-card:hover { transform: translateY(-2px); }
                    #roearn-roexport-thumb-wrap {
                        position: relative;
                        flex-shrink: 0;
                        width: 300px;
                        height: 188px;
                        border-radius: 8px;
                        overflow: hidden;
                        background: #1a1a1a;
                    }
                    @media (max-width: 600px) {
                        #roearn-roexport-card { flex-direction: column; }
                        #roearn-roexport-thumb-wrap {
                            width: 100%;
                            height: auto;
                            aspect-ratio: 16 / 10;
                        }
                    }
                </style>
                <div id="roearn-roexport-card" onclick="window.open('https://roearn.io/open/re-dashboard','_blank')">
                    <div id="roearn-roexport-thumb-wrap">
                        <img id="roearn-roexport-thumb" src="https://lh3.googleusercontent.com/Bwtn92BiUQfsoGS9P7x5jpi4O_8MNiClRl_QsnfmKOIlJN9_KJiik6WJtSy9pTTUWDLkM2Jp6rPb6b9VHBTqmUXFXw=s1600-w1600-h1000"
                            style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">
                        <div id="roearn-roexport-dots" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:2;">
                            <div class="roearn-roexport-dot" data-idx="0" style="width:6px;height:6px;border-radius:50%;background:white;opacity:1;cursor:pointer;flex-shrink:0;"></div>
                            <div class="roearn-roexport-dot" data-idx="1" style="width:6px;height:6px;border-radius:50%;background:white;opacity:0.4;cursor:pointer;flex-shrink:0;"></div>
                        </div>
                        <button id="roearn-roexport-prev" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;color:white;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.2s;padding:0;line-height:1;" onmouseover="this.style.background='rgba(0,0,0,0.75)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">&lsaquo;</button>
                        <button id="roearn-roexport-next" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;color:white;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.2s;padding:0;line-height:1;" onmouseover="this.style.background='rgba(0,0,0,0.75)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">&rsaquo;</button>
                    </div>
                    <div style="flex:1;min-width:0;text-align:left;">
                        <div style="font-size:17px;font-weight:700;color:${isDarkExt ? '#ffffff' : '#393b3d'};margin-bottom:5px;">${getMessage("dashboard_roexport_name")}</div>
                        <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;font-weight:500;">${getMessage("dashboard_roexport_tagline")}</div>
                        <div style="font-size:13px;color:${isDarkExt ? '#d1d1d1' : '#606162'};line-height:1.65;margin-bottom:14px;">
                            ${getMessage("dashboard_roexport_desc", [isDarkExt ? '#ffffff' : '#393b3d'])}
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;">
                            <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 9px;border-radius:20px;">${getMessage("dashboard_roexport_pill1")}</span>
                            <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 9px;border-radius:20px;">${getMessage("dashboard_roexport_pill2")}</span>
                            <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 9px;border-radius:20px;">${getMessage("dashboard_roexport_pill3")}</span>
                        </div>
                        <a href="https://roearn.io/open/re-dashboard" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;justify-content:center;padding:0 16px;height:36px;border:none;border-radius:8px;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:bold;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;text-decoration:none;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">${getMessage("dashboard_roexport_cta")}</a>
                    </div>
                </div>
            </div>
        `;
        }

        if (isCreatorMode || !isFirefox) {
        if (isCreatorMode) {
            const roexportCreatorWrapper = document.createElement('div');
            roexportCreatorWrapper.innerHTML = `
                <style>
                    #roearn-roexport-card {
                        background: ${isDarkExt ? '#2a2c2e' : '#f4f5f6'};
                        border-radius: 10px;
                        padding: 16px;
                        display: flex;
                        gap: 16px;
                        align-items: center;
                        cursor: pointer;
                        transition: transform 0.15s ease;
                    }
                    #roearn-roexport-card:hover { transform: translateY(-2px); }
                    #roearn-roexport-thumb-wrap {
                        position: relative;
                        flex-shrink: 0;
                        width: 160px;
                        height: 100px;
                        border-radius: 8px;
                        overflow: hidden;
                        background: #1a1a1a;
                    }
                    @media (max-width: 600px) {
                        #roearn-roexport-card { flex-direction: column; }
                        #roearn-roexport-thumb-wrap { width: 100%; height: auto; aspect-ratio: 16 / 10; }
                    }
                </style>
                <div id="roearn-roexport-card" onclick="window.open('https://roearn.io/open/re-dashboard','_blank')" style="position:relative;">
                    <div id="roearn-roexport-thumb-wrap">
                        <img id="roearn-roexport-thumb" src="https://lh3.googleusercontent.com/Bwtn92BiUQfsoGS9P7x5jpi4O_8MNiClRl_QsnfmKOIlJN9_KJiik6WJtSy9pTTUWDLkM2Jp6rPb6b9VHBTqmUXFXw=s1600-w1600-h1000"
                            style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">
                        <div id="roearn-roexport-dots" style="position:absolute;bottom:6px;left:50%;transform:translateX(-50%);display:flex;gap:4px;z-index:2;">
                            <div class="roearn-roexport-dot" data-idx="0" style="width:5px;height:5px;border-radius:50%;background:white;opacity:1;cursor:pointer;flex-shrink:0;"></div>
                            <div class="roearn-roexport-dot" data-idx="1" style="width:5px;height:5px;border-radius:50%;background:white;opacity:0.4;cursor:pointer;flex-shrink:0;"></div>
                        </div>
                        <button id="roearn-roexport-prev" style="position:absolute;left:4px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;color:white;font-size:14px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.2s;padding:0;line-height:1;" onmouseover="this.style.background='rgba(0,0,0,0.75)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">&#8249;</button>
                        <button id="roearn-roexport-next" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:20px;height:20px;cursor:pointer;color:white;font-size:14px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.2s;padding:0;line-height:1;" onmouseover="this.style.background='rgba(0,0,0,0.75)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">&#8250;</button>
                    </div>
                    <div style="flex:1;min-width:0;text-align:left;">
                        <div style="font-size:16px;font-weight:700;color:${isDarkExt ? '#ffffff' : '#393b3d'};margin-bottom:3px;">${getMessage("dashboard_roexport_name")}</div>
                        <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;font-weight:500;">${getMessage("dashboard_roexport_tagline")}</div>
                        <div style="display:flex;flex-wrap:wrap;gap:5px;">
                            <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 8px;border-radius:20px;">${getMessage("dashboard_roexport_pill1")}</span>
                            <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 8px;border-radius:20px;">${getMessage("dashboard_roexport_pill3")}</span>
                        </div>
                    </div>
                    ${!isMobileDevice ? `
                    <div style="position:absolute;right:18px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:12px;">
                        <div id="roearn-ext-wm-arrow-roexport" style="display:none;align-items:center;">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg" style="animation:roearn-arrow-bounce 1.8s ease-in-out infinite;">
                                <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <button id="roearn-roexport-wm-btn" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;justify-content:center;padding:0 16px;height:36px;border:none;border-radius:8px;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:bold;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;cursor:pointer;transition:transform 0.15s ease;white-space:nowrap;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">${getMessage('wm_save_btn_view')}</button>
                    </div>
                    ` : `
                    <button id="roearn-roexport-wm-btn" onclick="event.stopPropagation()" style="display:flex;align-items:center;justify-content:center;width:100%;padding:10px 0;border:none;border-radius:8px;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:bold;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;cursor:pointer;transition:transform 0.15s ease;white-space:nowrap;margin-top:4px;">${getMessage('wm_save_btn_view')}</button>
                    `}
                </div>
            `;
            const creatorExtInner = extensionsSection.querySelector('#roearn-creator-ext-inner');
            if (creatorExtInner) creatorExtInner.insertBefore(roexportCreatorWrapper, creatorExtInner.firstChild);

            const roexportWmBtn = extensionsSection.querySelector('#roearn-roexport-wm-btn');
            if (roexportWmBtn) {
                const roexportWmImageUrl = api.runtime.getURL('icons/watermark_example3.png');
                const roexportWmFileUrl  = api.runtime.getURL('icons/watermark_example3.png');
                roexportWmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openExtensionWatermarkGuide('roexport', 'RoExport Video Watermark', roexportWmImageUrl, roexportWmFileUrl, 'roexportWmSeen');
                });
                const roexportArrow = extensionsSection.querySelector('#roearn-ext-wm-arrow-roexport');
                api.storage.local.get(['roexportWmSeen'], (result) => {
                    if (result.roexportWmSeen !== true && roexportArrow) roexportArrow.style.display = 'flex';
                });
            }
        }

        const roexportThumbs = [
            'https://lh3.googleusercontent.com/Bwtn92BiUQfsoGS9P7x5jpi4O_8MNiClRl_QsnfmKOIlJN9_KJiik6WJtSy9pTTUWDLkM2Jp6rPb6b9VHBTqmUXFXw=s1600-w1600-h1000',
            'https://lh3.googleusercontent.com/SzJz9YgoRgwi7jpLH4L1zm-EPc84c8XlXfkSqCSBBt-uQfmdDf2OcB5mG6-9BBxcO-JsNOI2jewmR5a3JGMnCkBP-Ls=s1600-w1600-h1000'
        ];
        let roexportIdx = 0;

        function roexportGoTo(idx) {
            const next = (idx + roexportThumbs.length) % roexportThumbs.length;
            if (next === roexportIdx) return;
            roexportIdx = next;
            const thumbEl = extensionsSection.querySelector('#roearn-roexport-thumb');
            if (thumbEl) thumbEl.src = roexportThumbs[roexportIdx];
            extensionsSection.querySelectorAll('.roearn-roexport-dot').forEach((d, i) => {
                d.style.opacity = i === roexportIdx ? '1' : '0.4';
            });
        }

        const roexportPrevBtn = extensionsSection.querySelector('#roearn-roexport-prev');
        const roexportNextBtn = extensionsSection.querySelector('#roearn-roexport-next');
        if (roexportPrevBtn) roexportPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); roexportGoTo(roexportIdx - 1); });
        if (roexportNextBtn) roexportNextBtn.addEventListener('click', (e) => { e.stopPropagation(); roexportGoTo(roexportIdx + 1); });
        extensionsSection.querySelectorAll('.roearn-roexport-dot').forEach((dot) => {
            dot.addEventListener('click', (e) => { e.stopPropagation(); roexportGoTo(parseInt(dot.dataset.idx)); });
        });

        let roexportTimer = setInterval(() => roexportGoTo(roexportIdx + 1), 10000);
        const roexportCard = extensionsSection.querySelector('#roearn-roexport-card');
        if (roexportCard) {
            roexportCard.addEventListener('mouseenter', () => clearInterval(roexportTimer));
            roexportCard.addEventListener('mouseleave', () => { roexportTimer = setInterval(() => roexportGoTo(roexportIdx + 1), 10000); });
        }

        function markRoExportInstalled() {
            const card = extensionsSection.querySelector('#roearn-roexport-card');
            if (!card || card.dataset.roexportInstalled) return;
            card.dataset.roexportInstalled = '1';

            card.removeAttribute('onclick');
            card.style.cursor = 'default';

            const ctaLink = card.querySelector('a[href*="re-dashboard"]');
            const contentDiv = card.querySelector('div[style*="flex:1"]');
            if (ctaLink) {
                ctaLink.remove();
            }
            if (!isCreatorMode && contentDiv) {
                const installedLabel = document.createElement('div');
                installedLabel.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #22c55e;
                    margin-top: 4px;
                `;
                installedLabel.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
                        <circle cx="7.5" cy="7.5" r="7.5" fill="#22c55e"/>
                        <path d="M4 7.5L6.5 10L11 5.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${getMessage("dashboard_roexport_installed") || "You already have this installed"}
                `;
                contentDiv.appendChild(installedLabel);
            }
        }

        if (document.getElementById('nav-roexport')) {
            markRoExportInstalled();
        } else {
            const roexportInstallObserver = new MutationObserver(() => {
                if (document.getElementById('nav-roexport')) {
                    roexportInstallObserver.disconnect();
                    markRoExportInstalled();
                }
            });
            roexportInstallObserver.observe(document.documentElement, { childList: true, subtree: true });
        }

        const roregionCardHTML = `
            <style>
                #roearn-roregion-card {
                    background: ${isDarkExt ? '#2a2c2e' : '#f4f5f6'};
                    border-radius: 10px;
                    padding: 18px;
                    display: flex;
                    flex-wrap: nowrap;
                    gap: 20px;
                    align-items: center;
                    cursor: pointer;
                    transition: transform 0.15s ease;
                    margin-top: 16px;
                }
                #roearn-roregion-card:hover { transform: translateY(-2px); }
                #roearn-roregion-thumb-wrap {
                    position: relative;
                    flex-shrink: 0;
                    width: 300px;
                    max-width: 300px;
                    height: 188px;
                    border-radius: 8px;
                    overflow: hidden;
                    background: #1a1a1a;
                }
                @media (max-width: 600px) {
                    #roearn-roregion-card { flex-direction: column; }
                    #roearn-roregion-thumb-wrap {
                        width: 100%;
                        height: auto;
                        aspect-ratio: 16 / 10;
                    }
                }
            </style>
            <div id="roearn-roregion-card" onclick="window.open('https://roearn.io/open/rr-dashboard','_blank')">
                <div id="roearn-roregion-thumb-wrap">
                    <img id="roearn-roregion-thumb" src="https://lh3.googleusercontent.com/x11D6IYg_TenT4hdnm7LR-jGjoTKY0pGbgDVmK0cMI68Fkt0IQt57x8LWnIDgj1Vr8dSHZANcdBgf8YqJYAcLHwEBw=s800-w800-h500"
                        style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;">
                    <div id="roearn-roregion-dots" style="position:absolute;bottom:8px;left:50%;transform:translateX(-50%);display:flex;gap:5px;z-index:2;">
                        <div class="roearn-roregion-dot" data-idx="0" style="width:6px;height:6px;border-radius:50%;background:white;opacity:1;cursor:pointer;flex-shrink:0;"></div>
                        <div class="roearn-roregion-dot" data-idx="1" style="width:6px;height:6px;border-radius:50%;background:white;opacity:0.4;cursor:pointer;flex-shrink:0;"></div>
                    </div>
                    <button id="roearn-roregion-prev" style="position:absolute;left:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;color:white;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.2s;padding:0;line-height:1;" onmouseover="this.style.background='rgba(0,0,0,0.75)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">&#8249;</button>
                    <button id="roearn-roregion-next" style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:rgba(0,0,0,0.5);border:none;border-radius:50%;width:26px;height:26px;cursor:pointer;color:white;font-size:16px;display:flex;align-items:center;justify-content:center;z-index:2;transition:background 0.2s;padding:0;line-height:1;" onmouseover="this.style.background='rgba(0,0,0,0.75)'" onmouseout="this.style.background='rgba(0,0,0,0.5)'">&#8250;</button>
                </div>
                <div style="flex:1;min-width:0;text-align:left;">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px;flex-wrap:wrap;">
                        <span style="font-size:17px;font-weight:700;color:${isDarkExt ? '#ffffff' : '#393b3d'};">RoRegion</span>
                    </div>
                    <div style="font-size:12px;color:#9ca3af;margin-bottom:10px;font-weight:500;">${getMessage("dashboard_roregion_subtitle")}</div>
                    <div style="font-size:13px;color:${isDarkExt ? '#d1d1d1' : '#606162'};line-height:1.65;margin-bottom:14px;">
                        ${getMessage("dashboard_roregion_description")}
                    </div>
                    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:${isCreatorMode ? '0' : '16px'};">
                        <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 9px;border-radius:20px;">${getMessage("dashboard_roregion_tag_nolag")}</span>
                        <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 9px;border-radius:20px;">${getMessage("dashboard_roregion_tag_ping")}</span>
                        <span style="font-size:11px;font-weight:600;color:${isDarkExt ? '#d1d1d1' : '#606162'};background:${isDarkExt ? '#333537' : '#e9eaeb'};padding:3px 9px;border-radius:20px;">${getMessage("dashboard_roregion_tag_gameplay")}</span>
                    </div>
                    ${!isCreatorMode ? `<a href="https://roearn.io/open/rr-dashboard" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;justify-content:center;padding:0 16px;height:36px;border:none;border-radius:8px;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:bold;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;text-decoration:none;cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">${getMessage("dashboard_roexport_cta") || "Get Extension"}</a>` : ''}
                </div>
            </div>
        `;

        const roregionWrapper = document.createElement('div');
        roregionWrapper.style.cssText = 'width: 100%; min-width: 0;';
        roregionWrapper.innerHTML = roregionCardHTML;
        const roregionAppendTarget = isCreatorMode
            ? extensionsSection.querySelector('#roearn-creator-ext-inner')
            : extensionsSection.querySelector('div');
        if (roregionAppendTarget) roregionAppendTarget.appendChild(roregionWrapper);

        if (isCreatorMode) {
            const roregionCard = extensionsSection.querySelector('#roearn-roregion-card');
            if (roregionCard) {
                roregionCard.style.cssText = `
                    background: ${isDarkExt ? '#2a2c2e' : '#f4f5f6'};
                    border-radius: 10px; padding: 16px;
                    display: flex; ${isMobileDevice ? 'flex-direction: column; flex-wrap: wrap;' : 'flex-direction: row; flex-wrap: nowrap;'} gap: 16px; align-items: ${isMobileDevice ? 'flex-start' : 'center'};
                    cursor: pointer; transition: transform 0.15s ease; margin-top: 0; position: relative;
                `;
                const thumbWrap = roregionCard.querySelector('#roearn-roregion-thumb-wrap');
                if (thumbWrap) {
                    if (isMobileDevice) {
                        thumbWrap.style.cssText = `
                            position: relative; flex-shrink: 0;
                            width: 100%; height: auto; aspect-ratio: 16 / 10;
                            border-radius: 8px; overflow: hidden; background: #1a1a1a;
                        `;
                    } else {
                        thumbWrap.style.cssText = `
                            position: relative; flex-shrink: 0;
                            width: 160px; height: 100px;
                            border-radius: 8px; overflow: hidden; background: #1a1a1a;
                        `;
                    }
                }
                const descEl = roregionCard.querySelector('div[style*="line-height:1.65"]');
                if (descEl) descEl.remove();

                if (!isMobileDevice) {
                    const wmBtnWrap = document.createElement('div');
                    wmBtnWrap.style.cssText = 'position:absolute;right:18px;top:50%;transform:translateY(-50%);display:flex;align-items:center;gap:12px;';
                    wmBtnWrap.innerHTML = `
                        <div id="roearn-ext-wm-arrow-roregion" style="display:none;align-items:center;">
                            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg" style="animation:roearn-arrow-bounce 1.8s ease-in-out infinite;">
                                <path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <button id="roearn-roregion-wm-btn" style="display:inline-flex;align-items:center;justify-content:center;padding:0 16px;height:36px;border:none;border-radius:8px;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:bold;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;cursor:pointer;transition:transform 0.15s ease;white-space:nowrap;" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">${getMessage('wm_save_btn_view')}</button>
                    `;
                    roregionCard.appendChild(wmBtnWrap);
                } else {
                    const wmBtnMobile = document.createElement('button');
                    wmBtnMobile.id = 'roearn-roregion-wm-btn';
                    wmBtnMobile.style.cssText = 'display:flex;align-items:center;justify-content:center;width:100%;padding:10px 0;border:none;border-radius:8px;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:bold;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0px 1px 2px;cursor:pointer;transition:transform 0.15s ease;white-space:nowrap;margin-top:4px;';
                    wmBtnMobile.textContent = getMessage('wm_save_btn_view');
                    wmBtnMobile.addEventListener('click', (e) => e.stopPropagation());
                    roregionCard.appendChild(wmBtnMobile);
                }
            }
        }

        const roregionThumbs = [
            'https://lh3.googleusercontent.com/x11D6IYg_TenT4hdnm7LR-jGjoTKY0pGbgDVmK0cMI68Fkt0IQt57x8LWnIDgj1Vr8dSHZANcdBgf8YqJYAcLHwEBw=s800-w800-h500',
            'https://lh3.googleusercontent.com/v7dA6gC0e7U38L1-zFsBOK4raur_hOLeOLGXBih_Tl9IMlJQoX2y25xGbrLJuFwaM2HVl_jPhyA__554r6HX_CiZrg=s800-w800-h500'
        ];
        let roregionIdx = 0;

        function roregionGoTo(idx) {
            const next = (idx + roregionThumbs.length) % roregionThumbs.length;
            if (next === roregionIdx) return;
            roregionIdx = next;
            extensionsSection.querySelector('#roearn-roregion-thumb').src = roregionThumbs[roregionIdx];
            extensionsSection.querySelectorAll('.roearn-roregion-dot').forEach((d, i) => {
                d.style.opacity = i === roregionIdx ? '1' : '0.4';
            });
        }

        extensionsSection.querySelector('#roearn-roregion-prev').addEventListener('click', (e) => { e.stopPropagation(); roregionGoTo(roregionIdx - 1); });
        extensionsSection.querySelector('#roearn-roregion-next').addEventListener('click', (e) => { e.stopPropagation(); roregionGoTo(roregionIdx + 1); });
        extensionsSection.querySelectorAll('.roearn-roregion-dot').forEach((dot) => {
            dot.addEventListener('click', (e) => { e.stopPropagation(); roregionGoTo(parseInt(dot.dataset.idx)); });
        });

        let roregionTimer = setInterval(() => roregionGoTo(roregionIdx + 1), 10000);
        const roregionCard = extensionsSection.querySelector('#roearn-roregion-card');
        roregionCard.addEventListener('mouseenter', () => clearInterval(roregionTimer));
        roregionCard.addEventListener('mouseleave', () => { roregionTimer = setInterval(() => roregionGoTo(roregionIdx + 1), 10000); });

        function markRoRegionInstalled() {
            const card = extensionsSection.querySelector('#roearn-roregion-card');
            if (!card || card.dataset.roregionInstalled) return;
            card.dataset.roregionInstalled = '1';

            card.removeAttribute('onclick');
            card.style.cursor = 'default';
            card.style.transition = 'none';
            card.addEventListener('mouseenter', () => { card.style.transform = 'none'; }, true);
            card.style.transform = 'none';

            const ctaLink = card.querySelector('a[href*="rr-dashboard"]');
            const contentDiv = card.querySelector('div[style*="flex:1"]');
            if (ctaLink) {
                ctaLink.remove();
            }
            if (!isCreatorMode && contentDiv) {
                const installedLabel = document.createElement('div');
                installedLabel.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 13px;
                    font-weight: 600;
                    color: #22c55e;
                    margin-top: 4px;
                `;
                installedLabel.innerHTML = `
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;">
                        <circle cx="7.5" cy="7.5" r="7.5" fill="#22c55e"/>
                        <path d="M4 7.5L6.5 10L11 5.5" stroke="white" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                    ${getMessage("dashboard_roexport_installed") || "You already have this installed"}
                `;
                contentDiv.appendChild(installedLabel);
            }
        }

        if (isCreatorMode) {
            const roregionWmBtn = extensionsSection.querySelector('#roearn-roregion-wm-btn');
            if (roregionWmBtn) {
                const roregionWmImageUrl = api.runtime.getURL('icons/watermark_example2.png');
                const roregionWmFileUrl  = api.runtime.getURL('icons/watermark_example2.png');
                roregionWmBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openExtensionWatermarkGuide('roregion', 'RoRegion Video Watermark', roregionWmImageUrl, roregionWmFileUrl, 'roregionWmSeen');
                });
                const roregionArrow = extensionsSection.querySelector('#roearn-ext-wm-arrow-roregion');
                api.storage.local.get(['roregionWmSeen'], (result) => {
                    if (result.roregionWmSeen !== true && roregionArrow) roregionArrow.style.display = 'flex';
                });
            }
        }

        if (document.getElementById('nav-roregion')) {
            markRoRegionInstalled();
        } else {
            const roregionInstallObserver = new MutationObserver(() => {
                if (document.getElementById('nav-roregion')) {
                    roregionInstallObserver.disconnect();
                    markRoRegionInstalled();
                }
            });
            roregionInstallObserver.observe(document.documentElement, { childList: true, subtree: true });
        }
        }


        if (isCreatorMode || (!isMobileDevice && !isFirefox)) {
            if (isMobileDevice && isCreatorMode) {
                twoColumn.insertBefore(extensionsSection, referralSection);
            } else {
                panel.appendChild(extensionsSection);
            }
        }

        return panel;
    }
    
    function waitForContent() {
        return new Promise((resolve) => {
            const content = document.getElementById('content');
            if (content) {
                resolve(content);
                return;
            }
            
            const observer = new MutationObserver(() => {
                const content = document.getElementById('content');
                if (content) {
                    observer.disconnect();
                    resolve(content);
                }
            });
            
            observer.observe(document.documentElement, {
                childList: true,
                subtree: true
            });
        });
    }
    
    async function init() {
        await localizationReady;
        
        const content = await waitForContent();
        
        const pageBackground = document.createElement('div');
        pageBackground.className = 'roearn-page-background';
        
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
            coin.className = `icon-robux-16x16 roearn-floating-coin ${pos.gradient}`;
            coin.style.left = pos.left;
            coin.style.top = pos.top;
            coin.style.setProperty('--coin-scale', pos.scale);
            coin.style.setProperty('--entrance-delay', `${index * 0.03}s`);
            coin.style.animationDelay = pos.delay;
            pageBackground.appendChild(coin);
        });
        
        document.body.appendChild(pageBackground);
        
        const tutorialCompleted = await new Promise((resolve) => {
            api.storage.local.get(['tutorialCompleted'], (result) => {
                resolve(result.tutorialCompleted === true);
            });
        });
        
        if (!tutorialCompleted) {
            content.innerHTML = '';
            content.classList.add('roearn-panel-ready');
            const panel = await createRoEarnPanel();
            content.appendChild(panel);
        } else {
            content.innerHTML = '<div style="display: flex; justify-content: center; align-items: center; min-height: 400px;"><span class="spinner spinner-default"></span></div>';
            content.classList.add('roearn-panel-ready');
            
            globalPrefetchedData = await prefetchAllData();
            const panel = await createRoEarnPanel();
            content.innerHTML = '';
            content.appendChild(panel);

            const needsWatermarkIntro = await new Promise((resolve) => {
                api.storage.local.get(['watermarkTabSeen'], (result) => {
                    if (result.watermarkTabSeen === true) { resolve(false); return; }
                    const subs = globalPrefetchedData?.videoSubmissions || [];
                    resolve(subs.length >= 1);
                });
            });

            if (globalPrefetchedData && globalPrefetchedData.rejectionIncreased) {
                showRejectionNotice(needsWatermarkIntro ? showWatermarkIntroOverlay : null);
            } else if (needsWatermarkIntro) {
                showWatermarkIntroOverlay();
            }
        }
    }

    function showRejectionNotice(onCloseFn) {
        const rbxBody = document.getElementById('rbx-body');
        const isDark = rbxBody && rbxBody.classList.contains('dark-theme');

        const overlay = document.createElement('div');
        overlay.id = 'roearn-rejection-overlay';
        overlay.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.75); z-index: 99999;
            display: flex; align-items: center; justify-content: center;
            padding: 3vh 20px; box-sizing: border-box;
            font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        `;

        const popup = document.createElement('div');
        popup.style.cssText = `
            background: ${isDark ? '#232527' : 'white'};
            border-radius: 16px;
            padding: 36px 36px 32px 36px;
            width: 480px;
            box-sizing: border-box;
            position: relative;
            flex-shrink: 0;
        `;

        popup.innerHTML = `
            <div style="text-align: center; margin-bottom: 22px;">
                <div style="font-size: 40px; margin-bottom: 14px;">⚠️</div>
                <div style="font-size: 20px; font-weight: 700; color: ${isDark ? '#ffffff' : '#393b3d'}; margin-bottom: 12px; line-height: 1.3;">
                    ${getMessage('wm_rejection_title')}
                </div>
                <div style="font-size: 14px; color: ${isDark ? '#d1d1d1' : '#606162'}; line-height: 1.75;">
                    ${getMessage('wm_rejection_body')}
                </div>
            </div>
            <button id="roearn-rejection-dismiss" style="
                width: 100%;
                padding: 13px;
                border-radius: 10px;
                border: none;
                background: linear-gradient(90deg, rgb(107,181,255), rgb(166,107,255), rgb(214,107,255), rgb(255,107,189), rgb(214,107,255), rgb(166,107,255), rgb(107,181,255)) 0% 0% / 200% 100%;
                animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
                color: white;
                font-size: 14px;
                font-weight: 700;
                cursor: pointer;
                font-family: inherit;
                text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                transition: transform 0.15s ease;
            " onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='translateY(0)'">
                ${getMessage('wm_rejection_btn')}
            </button>
            <div style="margin-top: 10px; text-align: center;">
                <button id="roearn-rejection-close-text" style="
                    background: none; border: none; cursor: pointer;
                    font-size: 12px; color: ${isDark ? '#9ca3af' : '#9ca3af'};
                    font-family: inherit; padding: 4px 8px;
                    transition: color 0.15s ease;
                " onmouseover="this.style.color='${isDark ? '#d1d1d1' : '#606162'}'" onmouseout="this.style.color='#9ca3af'">
                    ${getMessage('wm_rejection_dismiss_btn')}
                </button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        function scaleRejection() {
            const vw = window.innerWidth;
            const vh = window.innerHeight;
            const popupH = popup.scrollHeight || 340;
            const scaleX = (vw * 0.92) / 480;
            const scaleY = (vh * 0.92) / popupH;
            const scale = Math.min(1.25, scaleX, scaleY);
            popup.style.transform = `scale(${scale})`;
            popup.style.transformOrigin = 'center center';
        }
        requestAnimationFrame(() => {
            scaleRejection();
            window.addEventListener('resize', scaleRejection);
        });

        function closeRejection() {
            window.removeEventListener('resize', scaleRejection);
            overlay.remove();
            if (typeof onCloseFn === 'function') onCloseFn();
        }

        popup.querySelector('#roearn-rejection-dismiss').addEventListener('click', () => {
            closeRejection();
            openExtensionWatermarkGuide('roearn', 'RoEarn Video Watermark', null, null, 'watermarkTabSeen');
        });

        popup.querySelector('#roearn-rejection-close-text').addEventListener('click', closeRejection);
    }
        
    function showWatermarkIntroOverlay() {
        const rbxBody = document.getElementById('rbx-body');
        const isDark = rbxBody && rbxBody.classList.contains('dark-theme');

        api.storage.local.set({ watermarkTabSeen: true });

        const overlay = document.createElement('div');
        overlay.id = 'roearn-wm-intro-overlay';
        overlay.style.cssText = [
            'position:fixed;top:0;left:0;width:100%;height:100%;',
            'background:rgba(0,0,0,0.75);z-index:99998;',
            'display:flex;align-items:center;justify-content:center;',
            'padding:3vh 20px;box-sizing:border-box;',
            "font-family:'HCo Gotham SSm',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"
        ].join('');

        const popup = document.createElement('div');
        popup.style.cssText = [
            'background:' + (isDark ? '#232527' : 'white') + ';',
            'border-radius:16px;padding:36px 36px 32px 36px;',
            'width:520px;box-sizing:border-box;',
            'position:relative;flex-shrink:0;'
        ].join('');

        const watermarkUrl    = api.runtime.getURL('icons/watermark_roearn.png');
        const exampleWithWmUrl = api.runtime.getURL('icons/watermark_example1.png');

        popup.innerHTML = `
            <div style="text-align:center;margin-bottom:18px;">
                <div style="font-size:24px;font-weight:700;color:${isDark ? '#ffffff' : '#393b3d'};margin-bottom:6px;line-height:1.3;">
                    ${getMessage('wm_intro_title')}
                </div>
                <div style="font-size:12px;color:${isDark ? '#9ca3af' : '#606162'};line-height:1.6;">
                    ${getMessage('wm_intro_subtitle')}
                </div>
            </div>

            <div style="display:flex;gap:14px;align-items:stretch;margin-bottom:18px;">
                <div style="flex-shrink:0;width:110px;display:flex;flex-direction:column;gap:5px;">
                    <div style="aspect-ratio:9/16;overflow:hidden;background:#111;position:relative;border-radius:10px;flex:1;">
                        <img src="${exampleWithWmUrl}" style="width:100%;height:100%;object-fit:cover;display:block;" loading="eager">
                        <div style="position:absolute;top:7px;left:7px;z-index:1;"><span style="font-size:7px;font-weight:800;color:white;text-transform:uppercase;letter-spacing:0.8px;background:#555;border-radius:3px;padding:2px 5px;">${getMessage('wm_example_label')}</span></div>
                    </div>
                    <div style="text-align:center;font-size:10px;font-weight:600;color:#9ca3af;">${getMessage('wm_how_it_should_look')}</div>
                </div>
                <div style="flex:1;min-width:0;background:${isDark ? '#2a2c2e' : '#f4f5f6'};border-radius:10px;padding:12px 13px;display:flex;flex-direction:column;gap:8px;">
                    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.7px;color:#9ca3af;">${getMessage('wm_intro_what_to_do')}</div>
                    <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.5;"><span style="color:#22c55e;font-weight:700;flex-shrink:0;margin-top:1px;">✓</span><span>${getMessage('wm_intro_req1')}</span></div>
                    <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.5;"><span style="color:#22c55e;font-weight:700;flex-shrink:0;margin-top:1px;">✓</span><span>${getMessage('wm_intro_req2')}</span></div>
                    <div style="display:flex;align-items:flex-start;gap:6px;font-size:11px;color:${isDark ? '#d1d1d1' : '#606162'};line-height:1.5;"><span style="color:#e53535;font-weight:700;flex-shrink:0;margin-top:1px;">✕</span><span>${getMessage('wm_intro_rejected')}</span></div>
                </div>
            </div>

            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;">
                <div class="roearn-wm-arrow-left" style="display:flex;align-items:center;flex-shrink:0;"><svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg"><path d="M4 18 H28 M20 10 L30 18 L20 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
                <button id="roearn-intro-save-btn" data-wm-url="${watermarkUrl}" style="display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:9px 20px;border-radius:8px;border:none;background:linear-gradient(90deg,rgb(107,181,255),rgb(166,107,255),rgb(214,107,255),rgb(255,107,189),rgb(214,107,255),rgb(166,107,255),rgb(107,181,255)) 0% 0% / 200% 100%;animation:rainbow-flow 6s ease-in-out infinite;color:white;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;text-shadow:rgba(0,0,0,0.2) 0 1px 2px;transition:transform 0.15s ease;white-space:nowrap;" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform='none'">
                    <svg width="12" height="12" viewBox="0 0 14 14" fill="none" style="flex-shrink:0;"><path d="M7 1v8M7 9l-2.5-2.5M7 9l2.5-2.5M1.5 12.5h11" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
                    ${getMessage('wm_save_btn')}
                </button>
                <div class="roearn-wm-arrow-right" style="display:flex;align-items:center;flex-shrink:0;"><svg width="22" height="22" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" class="roearn-subscribe-arrow-svg"><path d="M32 18 H8 M16 10 L6 18 L16 26" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
            </div>

            <div style="text-align:center;">
                <button id="roearn-intro-dismiss" style="background:none;border:none;cursor:pointer;font-size:12px;color:${isDark ? '#9ca3af' : '#9ca3af'};font-family:inherit;padding:4px 10px;transition:color 0.15s ease;" onmouseover="this.style.color='${isDark ? '#d1d1d1' : '#606162'}'" onmouseout="this.style.color='#9ca3af'">${getMessage('wm_dismiss_btn')}</button>
            </div>
        `;

        overlay.appendChild(popup);
        document.body.appendChild(overlay);

        function scaleIntroPopup() {
            const vw = window.innerWidth, vh = window.innerHeight;
            const scaleX = (vw * 0.92) / 520;
            const scaleY = (vh * 0.92) / (popup.scrollHeight || 440);
            const scale  = Math.min(1.25, scaleX, scaleY);
            popup.style.transform = `scale(${scale})`;
            popup.style.transformOrigin = 'center center';
        }
        requestAnimationFrame(() => { scaleIntroPopup(); window.addEventListener('resize', scaleIntroPopup); });

        function closeIntro() {
            window.removeEventListener('resize', scaleIntroPopup);
            overlay.remove();
        }

        popup.querySelector('#roearn-intro-dismiss').addEventListener('click', closeIntro);

        popup.querySelector('#roearn-intro-save-btn').addEventListener('click', async () => {
            const url = popup.querySelector('#roearn-intro-save-btn').dataset.wmUrl;
            try {
                const resp = await fetch(url);
                const blob = await resp.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl; a.download = 'roearn_watermark.png';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
                setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
            } catch (e) {
                const a = document.createElement('a');
                a.href = url; a.download = 'roearn_watermark.png';
                document.body.appendChild(a); a.click(); document.body.removeChild(a);
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    
})();