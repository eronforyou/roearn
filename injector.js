(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    const urlElement = document.createElement('div');
    urlElement.id = '__roearn_extension_url__';
    urlElement.style.display = 'none';
    urlElement.dataset.url = api.runtime.getURL('');
    (document.head || document.documentElement).appendChild(urlElement);

    const result = await api.storage.local.get(['userLocale']);
    const locale = result.userLocale || 'en';
    
    const localeElement = document.createElement('div');
    localeElement.id = '__roearn_user_locale__';
    localeElement.style.display = 'none';
    localeElement.dataset.locale = locale;
    (document.head || document.documentElement).appendChild(localeElement);

    const checkoutScript = document.createElement('script');
    checkoutScript.src = api.runtime.getURL('checkout.js');
    checkoutScript.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(checkoutScript);
    
    const checkoutBulkScript = document.createElement('script');
    checkoutBulkScript.src = api.runtime.getURL('checkout-bulk.js');
    checkoutBulkScript.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(checkoutBulkScript);
    
    const withdrawalScript = document.createElement('script');
    withdrawalScript.src = api.runtime.getURL('initiate-withdrawal.js');
    withdrawalScript.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(withdrawalScript);
})();

function buildMobileUrl(instanceCreate) {
    const joinAttemptId = crypto.randomUUID();
    const inner = encodeURIComponent(
        `https://www.roblox.com/games/start?placeid=${instanceCreate}&joinAttemptId=${joinAttemptId}`
    );
    return `https://ro.blox.com/Ebh5?is_retargeting=false&pid=experiencestart_mobileweb&af_dp=${inner}&af_web_dp=${inner}&deep_link_value=${inner}`;
}

window.addEventListener('roearn:launchGame', function(event) {
    const { assetId, assetType, userId, assetPrice, isDonation, gamePassArray } = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

    if (isMobile) {
        api.runtime.sendMessage({
            type: 'LAUNCH_GAME_MOBILE',
            assetId: assetId,
            assetType: assetType,
            userId: userId,
            assetPrice: assetPrice,
            ...(isDonation === true ? { isDonation: true } : {}),
            ...(isDonation === true && gamePassArray && gamePassArray.length > 0 ? { gamePassArray } : {})
        }, (response) => {
            if (response && response.instanceCreate) {
                window.location.href = buildMobileUrl(response.instanceCreate);
            }
        });
    } else {
        api.runtime.sendMessage({
            type: 'LAUNCH_GAME',
            assetId: assetId,
            assetType: assetType,
            userId: userId,
            assetPrice: assetPrice,
            ...(isDonation === true ? { isDonation: true } : {}),
            ...(isDonation === true && gamePassArray && gamePassArray.length > 0 ? { gamePassArray } : {})
        });
    }
});

window.addEventListener('roearn:launchGameBulk', function(event) {
    const { items, userId } = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    const ua = navigator.userAgent;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);

    const formattedItems = items.map(item => ({
        assetId: item.assetId,
        assetType: item.assetType,
        assetPrice: item.assetPrice
    }));

    if (isMobile) {
        api.runtime.sendMessage({
            type: 'LAUNCH_GAME_BULK_MOBILE',
            items: formattedItems,
            userId: userId
        }, (response) => {
            if (response && response.instanceCreate) {
                window.location.href = buildMobileUrl(response.instanceCreate);
            }
        });
    } else {
        api.runtime.sendMessage({
            type: 'LAUNCH_GAME_BULK',
            items: formattedItems,
            userId: userId
        });
    }
});

window.addEventListener('roearn:submitWithdrawalToAPI', function(event) {
    const { userId, gamepassId } = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    
    const api = typeof browser !== 'undefined' ? browser : chrome;
    api.runtime.sendMessage(
        {
            type: 'SUBMIT_WITHDRAWAL',
            userId: userId,
            gamepassId: gamepassId
        },
        (response) => {
            window.dispatchEvent(new CustomEvent('roearn:withdrawalAPIResponse', {
                detail: JSON.stringify(response)
            }));
        }
    );
});