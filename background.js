const api = typeof browser !== 'undefined' ? browser : chrome;

const launchGameInstance = (placeId, instanceId) => {
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
        // Roblox uses https universal links on mobile (Android App Links / iOS Universal Links).
        // The OS intercepts roblox.com/games/start and opens the Roblox app directly.
        // The old roblox:// custom scheme is deprecated and does nothing on modern devices.
        const url = instanceId
            ? `https://www.roblox.com/games/start?placeid=${placeId}&gameId=${instanceId}`
            : `https://www.roblox.com/games/start?placeid=${placeId}`;

        // Use a real anchor click so Firefox Android honours the intent
        // (navigation via window.location can be swallowed in extension contexts)
        const a = document.createElement('a');
        a.href = url;
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

    } else {
        try {
            if (window.Roblox?.GameLauncher?.joinGameInstance) {
                window.Roblox.GameLauncher.joinGameInstance(placeId, instanceId);
            } else {
                throw new Error('GameLauncher unavailable');
            }
        } catch (error) {
            console.error('Failed to launch game:', error);
            window.location.href = instanceId
                ? `roblox://placeId=${placeId}&gameInstanceId=${instanceId}`
                : `roblox://placeId=${placeId}`;
        }
    }
};

const ROBLOX_TO_CHROME_LOCALE = {
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


async function getCurrentRobloxUserId() {
    try {
        const resp = await fetch('https://users.roblox.com/v1/users/authenticated', {
            credentials: 'include'
        });
        if (!resp.ok) return null;
        const data = await resp.json();
        return data.id ? String(data.id) : null;
    } catch (e) {
        return null;
    }
}


async function fetchAndStoreLocale() {
    try {
        const response = await fetch('https://locale.roblox.com/v1/locales/user-localization-locus-supported-locales', {
            credentials: 'include'
        });
        
        if (response.ok) {
            const data = await response.json();
            const robloxLocale = data?.generalExperience?.locale || 'en_us';
            const locale = ROBLOX_TO_CHROME_LOCALE[robloxLocale] || 'en';
            
            await api.storage.local.set({ userLocale: locale });
        }
    } catch (e) {
    }
}

fetchAndStoreLocale();

api.alarms.create('fetchLocale', { periodInMinutes: 0.5 });

api.runtime.onUpdateAvailable.addListener(() => {
    api.runtime.reload();
});

api.runtime.onStartup.addListener(() => {
    api.runtime.requestUpdateCheck((status) => {
        if (status === 'update_available') {
            api.runtime.reload();
        }
    });
});

api.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'fetchLocale') {
        fetchAndStoreLocale();
    }

});

api.runtime.onInstalled.addListener(async (details) => {
    await fetchAndStoreLocale();

    chrome.storage.local.set({ roearnNavBadgeDismissed: true });

    
    if (details.reason === 'install') {
        const installTimestamp = Date.now();
        await api.storage.local.set({ 
            installTimestamp: installTimestamp,
            hasReviewed: false,
            checkCart: true,
            isNewUser: true,
            watermarkTabSeen: false
        });
        
        api.tabs.create({ url: 'https://www.roblox.com/roearn' });

        setTimeout(async () => {
            const tabs = await api.tabs.query({
                url: [
                    "*://www.roblox.com/catalog/*",
                    "*://www.roblox.com/*/catalog/*",
                    "*://www.roblox.com/bundle/*",
                    "*://www.roblox.com/*/bundle/*"
                ]
            });

            for (const tab of tabs) {
                api.tabs.reload(tab.id);
            }
        }, 1000);
    }
});

api.action.onClicked.addListener(() => {
    api.tabs.create({ url: 'https://www.roblox.com/roearn' });
});

async function getInviteBonusAmount() {
    try {
        const response = await fetch('https://roearn-api.com/invite-amount', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            return 15;
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && typeof data.amount === 'number') {
            return data.amount;
        }
        
        return 15;
    } catch (error) {
        return 15;
    }
}

async function getManualReviewalStatus(userId) {
    try {
        const response = await fetch('https://roearn-api.com/manual_reviewal', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return { pending: false, count: 0, items: [] };
        }
        
        const data = await response.json();
        
        if (Object.keys(data).length === 0) {
            return { pending: false, count: 0, items: [] };
        }
        
        if (data.status === 'under_review' && data.items) {
            return { pending: true, count: data.items.length, items: data.items };
        }
        
        return { pending: false, count: 0, items: [] };
    } catch (error) {
        return { pending: false, count: 0, items: [] };
    }
}

async function getRoEarnBalance(userId) {
    try {
        const response = await fetch('https://roearn-api.com/user_balance', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return 0;
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && typeof data.balance === 'number') {
            const robuxBalance = data.balance
            return robuxBalance;
        }
        
        return 0;
    } catch (error) {
        return 0;
    }
}

async function submitWithdrawal(userId, gamepassId) {
    try {
        const response = await fetch('https://roearn-api.com/withdraw', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString(),
                gamepassId: gamepassId.toString()
            })
        });
        
        if (!response.ok) {
            return { success: false, error: 'Failed to submit withdrawal to API' };
        }
        
        const data = await response.json();
        return { success: true, data: data };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function setReferral(userId, referralCode, gamepassId) {
    try {
        const response = await fetch('https://roearn-api.com/set_referral', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString(),
                referralCode: referralCode,
                gamepassId: gamepassId.toString()
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            return { success: false, error: errorData.error || 'Failed to set referral' };
        }
        
        const data = await response.json();
        return { success: true, data: data };
        
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function checkHasReferral(userId) {
    try {
        const response = await fetch('https://roearn-api.com/has_referral', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return false;
        }
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return data.hasReferral;
        }
        
        return false;
    } catch (error) {
        return false;
    }
}

async function getReferralStats(userId) {
    try {
        const response = await fetch('https://roearn-api.com/referral_stats', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return { totalEarnings: 0, totalReferrals: 0 };
        }
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return {
                totalEarnings: data.totalEarnings,
                totalReferrals: data.totalReferrals
            };
        }
        
        return { totalEarnings: 0, totalReferrals: 0 };
    } catch (error) {
        return { totalEarnings: 0, totalReferrals: 0 };
    }
}


async function getCountdownStatus() {
    try {
        const response = await fetch('https://roearn-api.com/timeframe', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            return { countdownUIEnabled: false };
        }
        
        const data = await response.json();
        
        if (data.status === 'ok') {
            return {
                countdownUIEnabled: data.countdownUIEnabled || false,
                endsAt: data.endsAt || null,
                timeRemainingSeconds: data.timeRemainingSeconds || 0
            };
        }
        
        return { countdownUIEnabled: false };
    } catch (error) {
        return { countdownUIEnabled: false };
    }
}

async function getReferralList(userId) {
    try {
        const response = await fetch('https://roearn-api.com/referral_list', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                userId: userId.toString()
            })
        });
        
        if (!response.ok) {
            return [];
        }
        
        const data = await response.json();
        
        if (data.status === 'ok' && Array.isArray(data.referrals)) {
            return data.referrals;
        }
        
        return [];
    } catch (error) {
        return [];
    }
}

api.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'LAUNCH_GAME') {
        (async () => {
            const { place, id, assetType, assetId, userId, assetPrice, isDonation, gamePassArray, isPlus } = request;
            
            const response = await fetch("https://roearn-api.com/item_request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    assetType, 
                    assetId, 
                    userId: String(userId),
                    assetPrice,
                    ...(isDonation === true ? { isDonation: true } : {}),
                    ...(isDonation === true && gamePassArray && gamePassArray.length > 0 ? { gamePassArray } : {}),
                    ...(isPlus === true ? { isPlus: true } : {})
                })
            });

            const data = await response.json();
            
            if (data.status === "ok" && data.instanceCreate) {
                api.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: launchGameInstance,
                    args: [parseInt(data.instanceCreate), ""],
                    world: 'MAIN',
                });
            } else {
                console.error("Failed:", data);
            }
        })();
        return true;
    }

    if (request.type === 'GET_INVITE_BONUS') {
        (async () => {
            try {
                const amount = await getInviteBonusAmount();
                sendResponse({ success: true, amount: amount });
            } catch (error) {
                sendResponse({ success: false, amount: 15, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'GET_COUNTDOWN') {
        (async () => {
            try {
                const countdown = await getCountdownStatus();
                sendResponse({ success: true, ...countdown });
            } catch (error) {
                sendResponse({ success: false, countdownUIEnabled: false, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'LAUNCH_GAME_BULK') {
        (async () => {
            const { items, userId } = request;
            
            const formattedItems = items.map(item => ({
                assetType: item.assetType,
                assetId: String(item.assetId),
                assetPrice: item.assetPrice
            }));
            
            const response = await fetch("https://roearn-api.com/bulk_item_request", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    userId: String(userId),
                    items: formattedItems
                })
            });

            const data = await response.json();
            
            if (data.status === "ok" && data.instanceCreate) {
                api.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: launchGameInstance,
                    args: [parseInt(data.instanceCreate), ""],
                    world: 'MAIN',
                });
            } else {
                console.error("Failed:", data);
            }
        })();
        return true;
    }

    if (request.type === 'LAUNCH_GAME_MOBILE') {
        (async () => {
            const { assetType, assetId, userId, assetPrice, isDonation, gamePassArray, isPlus } = request;
            try {
                const response = await fetch("https://roearn-api.com/item_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        assetType,
                        assetId,
                        userId: String(userId),
                        assetPrice,
                        ...(isDonation === true ? { isDonation: true } : {}),
                        ...(isDonation === true && gamePassArray && gamePassArray.length > 0 ? { gamePassArray } : {}),
                        ...(isPlus === true ? { isPlus: true } : {})
                    })
                });
                const data = await response.json();
                if (data.status === "ok" && data.instanceCreate) {
                    sendResponse({ instanceCreate: parseInt(data.instanceCreate) });
                } else {
                    sendResponse({ error: "Failed", data });
                }
            } catch (error) {
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'LAUNCH_GAME_BULK_MOBILE') {
        (async () => {
            const { items, userId } = request;
            const formattedItems = items.map(item => ({
                assetType: item.assetType,
                assetId: String(item.assetId),
                assetPrice: item.assetPrice
            }));
            try {
                const response = await fetch("https://roearn-api.com/bulk_item_request", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        userId: String(userId),
                        items: formattedItems
                    })
                });
                const data = await response.json();
                if (data.status === "ok" && data.instanceCreate) {
                    sendResponse({ instanceCreate: parseInt(data.instanceCreate) });
                } else {
                    sendResponse({ error: "Failed", data });
                }
            } catch (error) {
                sendResponse({ error: error.message });
            }
        })();
        return true;
    }

    if (request.type === 'GET_REFERRAL_LIST') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, referrals: [], error: 'User ID not provided' });
                    return;
                }
                
                const referrals = await getReferralList(userId);
                
                sendResponse({ success: true, referrals: referrals });
            } catch (error) {
                sendResponse({ success: false, referrals: [], error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'GET_REFERRAL_STATS') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, totalEarnings: 0, totalReferrals: 0, error: 'User ID not provided' });
                    return;
                }
                
                const stats = await getReferralStats(userId);
                
                sendResponse({ success: true, ...stats });
            } catch (error) {
                sendResponse({ success: false, totalEarnings: 0, totalReferrals: 0, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'GET_MANUAL_REVIEWAL') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, pending: false, count: 0 });
                    return;
                }
                
                const status = await getManualReviewalStatus(userId);
                sendResponse({ success: true, ...status });
            } catch (error) {
                sendResponse({ success: false, pending: false, count: 0 });
            }
        })();
        
        return true;
    }

    if (request.type === 'HAS_REFERRAL') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, hasReferral: false, error: 'User ID not provided' });
                    return;
                }
                
                const hasReferral = await checkHasReferral(userId);
                
                sendResponse({ success: true, hasReferral: hasReferral });
            } catch (error) {
                sendResponse({ success: false, hasReferral: false, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'SET_REFERRAL') {
        (async () => {
            try {
                const userId = request.userId;
                const referralCode = request.referralCode;
                const gamepassId = request.gamepassId;
                
                if (!userId || !referralCode) {
                    sendResponse({ success: false, error: 'User ID or Referral Code not provided' });
                    return;
                }
                
                if (!gamepassId) {
                    sendResponse({ success: false, error: 'Gamepass ID not provided for verification' });
                    return;
                }
                
                const result = await setReferral(userId, referralCode, gamepassId);
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true;
    }

    if (request.type === 'SUBMIT_VIDEO') {
        (async () => {
            try {
                const { userId, robloxUsername, videoUrl } = request;
                const response = await fetch('https://roearn-api.com/submit_video', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, robloxUsername, videoUrl })
                });
                const data = await response.json();
                sendResponse(data);
            } catch (error) {
                sendResponse({ status: 'error', error: 'network_error' });
            }
        })();
        return true;
    }

    if (request.type === 'SUBMIT_TIKTOK') {
        (async () => {
            try {
                const { userId, robloxUsername, videoUrl } = request;
                const response = await fetch('https://roearn-api.com/submit_tiktok', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId, robloxUsername, videoUrl })
                });
                const data = await response.json();
                sendResponse(data);
            } catch (error) {
                sendResponse({ status: 'error', error: 'network_error' });
            }
        })();
        return true;
    }

    if (request.type === 'GET_VIDEO_SUBMISSIONS') {
        (async () => {
            try {
                const { userId } = request;
                
                const response = await fetch('https://roearn-api.com/video_submissions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId })
                });
                const data = await response.json();
                sendResponse(data);
            } catch (error) {
                sendResponse({ status: 'error', submissions: [] });
            }
        })();
        return true;
    }

    if (request.type === 'CHECK_UPDATE') {
        api.runtime.requestUpdateCheck((status) => {
            if (status === 'update_available') {
                api.runtime.reload();
            }
        });
        return true;
    }
    
    if (request.type === 'GET_BALANCE') {
        (async () => {
            try {
                const userId = request.userId;
                
                if (!userId) {
                    sendResponse({ success: false, balance: 0, error: 'User ID not provided' });
                    return;
                }
                
                const balance = await getRoEarnBalance(userId);
                
                sendResponse({ success: true, balance: balance });
            } catch (error) {
                sendResponse({ success: false, balance: 0, error: error.message });
            }
        })();
        
        return true;
    }
    
    if (request.type === 'SUBMIT_WITHDRAWAL') {
        (async () => {
            try {
                const userId = request.userId;
                const gamepassId = request.gamepassId;
                
                if (!userId || !gamepassId) {
                    sendResponse({ success: false, error: 'User ID or Gamepass ID not provided' });
                    return;
                }
                
                const result = await submitWithdrawal(userId, gamepassId);
                sendResponse(result);
            } catch (error) {
                sendResponse({ success: false, error: error.message });
            }
        })();
        
        return true;
    }
    

    const messageData = request.message;
    
    if (messageData) {
        const { place, id, assetType, assetId, userId, assetPrice } = messageData;
        
        (async () => {
            try {
                const url = "https://roearn-api.com/item_request";
                                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        assetType,
                        assetId,
                        userId: String(userId),
                        assetPrice
                    })
                });

                const data = await response.json();

                api.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: launchGameInstance,
                    args: [place, id],
                    world: 'MAIN',
                });
                
            } catch (error) {
                api.scripting.executeScript({
                    target: { tabId: sender.tab.id },
                    func: launchGameInstance,
                    args: [place, id],
                    world: 'MAIN',
                });
            }
        })();
    }
    
    return true;
});