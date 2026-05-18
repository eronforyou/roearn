(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    const storageCheck = await api.storage.local.get(['checkCart']);
    
    if (storageCheck.checkCart !== true) {
        return;
    }

    const storage = await api.storage.local.get(['cartMigrated', 'roearnCart']);
    
    if (storage.cartMigrated === true) {
        return;
    }

    const cartKey = Object.keys(localStorage)
        .find(key => key.startsWith("Roblox.AvatarMarketplace.Cart:"));
    
    if (!cartKey) {
        await api.storage.local.set({ cartMigrated: true });
        return;
    }

    const robloxCart = JSON.parse(localStorage.getItem(cartKey));
    
    if (!robloxCart || !robloxCart.items || robloxCart.items.length === 0) {
        await api.storage.local.set({ cartMigrated: true });
        return;
    }

    try {
        const existingStorage = await api.storage.local.get(['roearnCart']);
        const cart = existingStorage.roearnCart || [];
        
        const userResponse = await fetch('https://users.roblox.com/v1/users/authenticated', {
            credentials: 'include'
        });
        const userData = await userResponse.json();
        const userId = String(userData.id);
        
        for (const robloxItem of robloxCart.items) {
            const itemId = robloxItem.itemId;
            const itemDetails = robloxCart.itemDetails[itemId];
            
            if (!itemDetails) {
                continue;
            }
            
            const alreadyInCart = cart.some(item => String(item.assetId) === String(itemId));
            
            if (alreadyInCart) {
                continue;
            }
            
            const isBundle = itemDetails.itemType === 'Bundle';
            const itemType = isBundle ? 'Bundle' : 'Asset';
            
            let itemPrice = null;
            let cashbackAmount = 0;
            let assetType = null;
            let itemName = itemDetails.name || 'Unknown Item';
            let itemThumbnail = '';
            
            try {
                const response = await fetch(
                    `https://catalog.roblox.com/v1/catalog/items/${itemId}/details?itemType=${itemType}`,
                    { credentials: 'include' }
                );
                const data = await response.json();
                
                if (data.priceStatus !== 'Off Sale' && data.lowestPrice !== undefined && data.lowestPrice !== null) {
                    assetType = data.assetType;
                    itemName = data.name || itemName;
                    itemPrice = data.lowestPrice;
                    
                    let cashbackRate = 0.10;
                    let minPrice = 20;
                    
                    const isLimitedItem = data.itemRestrictions && data.itemRestrictions.length > 0;
                    const isRobloxCreated = data.creatorTargetId === 1;
                    const hasLimitedRestriction = data.itemRestrictions && 
                        data.itemRestrictions.some(restriction => restriction.includes('Limited'));
                    const hasCollectibleRestriction = data.itemRestrictions && 
                        data.itemRestrictions.includes('Collectible');
                    const isLiveItem = data.itemRestrictions && 
                        data.itemRestrictions.includes('Live');
                    
                    if (isRobloxCreated && (hasLimitedRestriction || hasCollectibleRestriction)) {
                        continue;
                    }
                    
                    if (data.isOffSale === true) {
                        continue;
                    }
                    
                    if (data.saleLocationType && data.saleLocationType !== 'ShopAndAllExperiences') {
                        continue;
                    }
                    
                    if (isLiveItem) {
                        cashbackRate = 0.10;
                        minPrice = 20;
                    } else if (isLimitedItem) {
                        const unitsAvailable = data.unitsAvailableForConsumption || 0;
                        if (unitsAvailable === 0) {
                            cashbackRate = 0.05;
                            minPrice = 20;
                        }
                    }
                    
                    if (!isLiveItem && (assetType === 2 || assetType === 11 || assetType === 12)) {
                        cashbackRate = 0.05;
                        minPrice = 40;
                    }
                    
                    if (itemPrice < minPrice) {
                        continue;
                    }
                    
                    const percentage = itemPrice * cashbackRate;
                    const baseAmount = Math.max(percentage, 2);
                    cashbackAmount = Math.floor(baseAmount * 0.70);
                }
            } catch (error) {
                continue;
            }
            
            if (itemPrice === null) {
                continue;
            }
            
            try {
                let thumbnailUrl;
                if (isBundle) {
                    thumbnailUrl = `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${itemId}&format=png&isCircular=false&size=420x420`;
                } else {
                    thumbnailUrl = `https://thumbnails.roblox.com/v1/assets?assetIds=${itemId}&format=png&isCircular=false&size=420x420`;
                }
                
                const thumbnailResponse = await fetch(thumbnailUrl);
                const thumbnailData = await thumbnailResponse.json();
                
                if (thumbnailData.data && thumbnailData.data.length > 0 && thumbnailData.data[0].imageUrl) {
                    itemThumbnail = thumbnailData.data[0].imageUrl;
                }
            } catch (error) {
            }
            
            if (!itemThumbnail) {
                continue;
            }
            
            const cartItem = {
                assetId: String(itemId),
                assetName: itemName,
                assetPrice: itemPrice,
                assetType: isBundle ? 'bundle' : 'accessory',
                earnAmount: cashbackAmount,
                thumbnail: itemThumbnail,
                userId: userId
            };
            
            cart.push(cartItem);
        }

        await api.storage.local.set({ 
            roearnCart: cart,
            cartMigrated: true 
        });
        
    } catch (error) {
        await api.storage.local.set({ cartMigrated: true });
    }
})();