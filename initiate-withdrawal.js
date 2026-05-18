async function initiateWithdrawal(gamepassPrice) {
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

    const getErrorMessage = (code) => {
        return getMessage("somethingWentWrong");
    };

    try {
        const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
            credentials: 'include'
        });
        
        if (!userResponse.ok) {
            return { success: false, error: getErrorMessage('271') };
        }
        
        let userData;
        try {
            userData = await userResponse.json();
        } catch (jsonError) {
            return { success: false, error: getErrorMessage('271') };
        }
        
        const userId = userData.id;
        
        const inventoryUrl = `https://inventory.roblox.com/v1/users/${userId}/places/inventory?cursor=&itemsPerPage=100&placesTab=Created`;
        const inventoryResponse = await fetch(inventoryUrl, {
            credentials: 'include'
        });
        
        if (!inventoryResponse.ok) {
            return { success: false, error: getErrorMessage('428') };
        }
        
        let inventoryData;
        try {
            inventoryData = await inventoryResponse.json();
        } catch (jsonError) {
            return { success: false, error: getErrorMessage('428') };
        }
        
        if (!inventoryData.data || inventoryData.data.length === 0) {
            return { success: false, error: getErrorMessage('912') };
        }

        const validGame = inventoryData.data.find(game => game.universeId != null);

        if (!validGame) {
            return { success: false, error: getErrorMessage('912') };
        }

        const gameData = {
            universeId: validGame.universeId,
            placeId: validGame.placeId,
            userId: userId
        };
        
        window.universeId = gameData.universeId;
        window.placeId = gameData.placeId;
        window.userId = gameData.userId;
        
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
            return { success: false, error: getErrorMessage('563') };
        }
        
        const formData = new FormData();
        formData.append('name', 'Purchase');
        formData.append('description', '');
        
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
            return { success: false, error: getErrorMessage('203') };
        }
        
        if (gamepassResponse.status === 200) {
            window.gamePassId = gamepassData.gamePassId;
            
            function getGamepassPrice(targetBalance) {
                const robloxRound = (x) => Math.floor(x + 0.5);
                
                if (targetBalance === 1) {
                    return 2;
                }
                
                let price = targetBalance;
                while (true) {
                    const afterTax = price * 0.7;
                    const received = robloxRound(afterTax);
                    
                    if (received >= targetBalance) {
                        return price;
                    }
                    price++;
                }
            }

            let adjustedPrice = getGamepassPrice(gamepassPrice);

            const detailsFormData = new FormData();
            detailsFormData.append('isForSale', 'true');
            detailsFormData.append('price', adjustedPrice.toString());
            detailsFormData.append('isRegionalPricingEnabled', 'false');

            const detailsResponse = await fetch(`https://apis.roblox.com/game-passes/v1/universes/${gameData.universeId}/game-passes/${gamepassData.gamePassId}`, {
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
                    return { success: false, error: getErrorMessage('752') };
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
                            return { success: false, error: getErrorMessage('147') };
                        }
                        
                        let existingGamepassesData;
                        try {
                            existingGamepassesData = await existingGamepassesResponse.json();
                        } catch (jsonError) {
                            return { success: false, error: getErrorMessage('147') };
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
                        return { success: false, error: getErrorMessage('589') };
                    }
                    
                    window.gamePassId = existingGamepass.gamePassId;
                    
                    const reusedDetailsFormData = new FormData();
                    reusedDetailsFormData.append('isForSale', 'true');
                    reusedDetailsFormData.append('price', adjustedPrice.toString());
                    reusedDetailsFormData.append('isRegionalPricingEnabled', 'false');

                    const reusedDetailsResponse = await fetch(`https://apis.roblox.com/game-passes/v1/universes/${gameData.universeId}/game-passes/${existingGamepass.gamePassId}`, {
                        method: 'PATCH',
                        credentials: 'include',
                        headers: {
                            'x-csrf-token': xsrfToken
                        },
                        body: reusedDetailsFormData
                    });
                    
                    if (reusedDetailsResponse.status !== 200 && reusedDetailsResponse.status !== 204) {
                        const reusedDetailsError = await reusedDetailsResponse.json();
                        return { success: false, error: getErrorMessage('346'), details: reusedDetailsError };
                    }
                } else {
                    return { success: false, error: getErrorMessage('752') };
                }
            }
            
            const withdrawalResult = await new Promise((resolve) => {
                window.dispatchEvent(new CustomEvent('roearn:submitWithdrawalToAPI', {
                    detail: JSON.stringify({
                        userId: gameData.userId,
                        gamepassId: window.gamePassId
                    })
                }));
                
                const handleResponse = (event) => {
                    const response = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
                    window.removeEventListener('roearn:withdrawalAPIResponse', handleResponse);
                    
                    if (response && response.success) {
                        resolve({ success: true, data: response.data });
                    } else {
                        resolve({ success: false, error: response?.error || 'Unknown error' });
                    }
                };
                
                window.addEventListener('roearn:withdrawalAPIResponse', handleResponse);
            });
            
            if (!withdrawalResult.success) {
                return {
                    success: false,
                    error: getErrorMessage('618'),
                    ...gameData,
                    gamePassId: window.gamePassId,
                    price: gamepassPrice
                };
            }
            
            window.dispatchEvent(new CustomEvent('roearn:refetchBalance'));
            
            return {
                success: true,
                ...gameData,
                gamePassId: window.gamePassId,
                price: gamepassPrice,
                withdrawalData: withdrawalResult.data
            };
            
        } else {
            return { success: false, error: getErrorMessage('203'), details: gamepassData };
        }
        
    } catch (error) {
        return { success: false, error: getErrorMessage('491') };
    }
}

window.addEventListener('roearn:initiateWithdrawal', async function(event) {
    const { gamepassPrice } = typeof event.detail === 'string' ? JSON.parse(event.detail) : event.detail;
    
    const result = await initiateWithdrawal(gamepassPrice);
    
    window.dispatchEvent(new CustomEvent('roearn:withdrawalInitiated', {
        detail: JSON.stringify(result)
    }));
});