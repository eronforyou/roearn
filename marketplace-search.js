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

    const style = document.createElement('style');
    style.id = 'roearn-marketplace-styles';
    style.textContent = `
        .add-to-cart-btn-container {
            display: none !important;
        }

        @keyframes rainbow-flow {
            0%, 100% {
                background-position: 0% 50%;
            }
            50% {
                background-position: 100% 50%;
            }
        }
        
        .roearn-cashback-badge {
            position: absolute;
            top: 9.2px;
            left: 9.2px;
            background: linear-gradient(90deg, rgb(107, 181, 255), rgb(166, 107, 255), rgb(214, 107, 255), rgb(255, 107, 189), rgb(214, 107, 255), rgb(166, 107, 255), rgb(107, 181, 255)) 0% 0% / 200% 100%;
            animation: 6s ease-in-out 0s infinite normal none running rainbow-flow;
            padding: 4.6px 9.2px;
            border-radius: 4.6px;
            border: none;
            color: white;
            text-shadow: rgba(0, 0, 0, 0.5) 0px 1px 2px, rgba(0, 0, 0, 0.3) 0px 0px 8px;
            font-weight: bold;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 13.8px;
            z-index: 10;
            pointer-events: none;
            gap: 2.3px;
            line-height: 1.2;
        }
        
        .roearn-cashback-badge-content {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 2.3px;
            flex-wrap: wrap;
            overflow: visible;
        }
        
        .roearn-cashback-badge .icon-robux-16x16 {
            display: inline-block;
            margin-left: 2.3px;
            margin-right: 0px;
            filter: brightness(0) invert(1) drop-shadow(rgba(0, 0, 0, 0.5) 0px 1px 2px) drop-shadow(rgba(0, 0, 0, 0.3) 0px 0px 8px);
            width: 18.4px;
            height: 18.4px;
            image-rendering: -webkit-optimize-contrast;
            image-rendering: crisp-edges;
        }
    `;

    if (!document.getElementById('roearn-marketplace-styles')) {
        document.head.appendChild(style);
    }

    function shouldBeActive() {
        return window.location.href.includes('salesTypeFilter');
    }

    function getItemTypeFromURL(url) {
        if (!url) return null;
        
        const match = url.match(/\/(\w+)\/Webp\//);
        return match ? match[1] : null;
    }

    function getEarnPercentage(itemType, isLimited) {
        if (isLimited) {
            return 5;
        }
        
        if (!itemType) return 10;
        
        if (itemType === 'Pants' || itemType === 'Shirt' || itemType === 'Tshirt') {
            return 5;
        }
        
        if (itemType.includes('Accessory')) {
            return 10;
        }
        
        if (itemType.includes('Animation')) {
            return 10;
        }
        
        if (itemType === 'Hat' || itemType === 'Avatar' || itemType === 'Face' || itemType === 'Head') {
            return 10;
        }
        
        return 10;
    }

    function getMinimumPrice(itemType, isLimited) {
        if (isLimited) {
            return 40;
        }
        
        if (itemType === 'Pants' || itemType === 'Shirt' || itemType === 'Tshirt') {
            return 40;
        }
        
        return 20;
    }

    function formatEarnAmount(number) {
        if (number <= 9999) {
            return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        }
        
        if (number < 1000000) {
            const thousands = number / 1000;
            return thousands.toFixed(1).replace(/\.0$/, '') + 'K';
        }
        
        const millions = number / 1000000;
        return millions.toFixed(1).replace(/\.0$/, '') + 'M';
    }

    function waitForThumbnail(catalogItem, maxAttempts = 50, interval = 100) {
        return new Promise((resolve) => {
            let attempts = 0;
            
            const checkThumbnail = () => {
                const thumbnailImg = catalogItem.querySelector('.item-card-thumb-container img');
                const thumbnailSrc = thumbnailImg ? thumbnailImg.getAttribute('src') : null;
                
                if (thumbnailSrc && thumbnailSrc.trim() !== '') {
                    resolve(thumbnailSrc);
                    return;
                }
                
                attempts++;
                if (attempts >= maxAttempts) {
                    resolve(null);
                    return;
                }
                
                setTimeout(checkThumbnail, interval);
            };
            
            checkThumbnail();
        });
    }

    async function addRoEarnBadge(catalogItem) {
        if (catalogItem.hasAttribute('data-roearn-processed')) {
            return;
        }
        
        catalogItem.setAttribute('data-roearn-processed', 'true');
        
        const restrictionIcon = catalogItem.querySelector('.restriction-icon');
        const isLimited = restrictionIcon !== null;
        
        const isDynamic = restrictionIcon && restrictionIcon.className.toLowerCase().includes('dynamic');
        
        if (isLimited && !isDynamic) {
            const hasCreator = catalogItem.querySelector('.item-card-creator') !== null;
            if (!hasCreator) {
                return;
            }
        }
        
        const priceElement = catalogItem.querySelector('.item-card-price');
        if (!priceElement) {
            return;
        }
        
        const robuxTile = priceElement.querySelector('.text-robux-tile');
        if (!robuxTile) {
            return;
        }
        
        const priceText = robuxTile.textContent.trim().replace(/,/g, '');
        
        const priceNumber = parseInt(priceText, 10);
        if (isNaN(priceNumber)) {
            return;
        }
        
        const thumbContainer = catalogItem.querySelector('.item-card-thumb-container');
        if (!thumbContainer) {
            return;
        }
        
        const thumbnailSrc = await waitForThumbnail(catalogItem);
        
        if (!thumbnailSrc) {
            return;
        }
        
        const itemType = getItemTypeFromURL(thumbnailSrc);
        
        const minimumPrice = getMinimumPrice(itemType, isLimited);
        
        if (priceNumber < minimumPrice) {
            return;
        }
        
        let badgeContent;
        
        if (isLimited) {
            const earnAmount5 = Math.floor((priceNumber * 5 / 100) * 0.7);
            const earnAmount10 = Math.floor((priceNumber * 10 / 100) * 0.7);
            
            const formatted5 = formatEarnAmount(earnAmount5);
            const formatted10 = formatEarnAmount(earnAmount10);
            
            badgeContent = `<div class="roearn-cashback-badge-content">${getMessage("badgeEarn")} <span class="icon-robux-16x16"></span> ${formatted5} - ${formatted10}</div>`;
        } else {
            const earnPercentage = getEarnPercentage(itemType, false);
            const earnAmount = Math.floor((priceNumber * earnPercentage / 100) * 0.7);
            const formattedEarnAmount = formatEarnAmount(earnAmount);
            
            badgeContent = `<div class="roearn-cashback-badge-content">${getMessage("badgeEarn")} <span class="icon-robux-16x16"></span> ${formattedEarnAmount}</div>`;
        }
        
        const badge = document.createElement('div');
        badge.className = 'roearn-cashback-badge';
        badge.innerHTML = badgeContent;
        
        if (getComputedStyle(thumbContainer).position === 'static') {
            thumbContainer.style.position = 'relative';
        }
        
        thumbContainer.appendChild(badge);
    }

    function removeAllBadges() {
        const badges = document.querySelectorAll('.roearn-cashback-badge');
        badges.forEach(badge => badge.remove());
        
        const catalogItems = document.querySelectorAll('[data-roearn-processed]');
        catalogItems.forEach(item => item.removeAttribute('data-roearn-processed'));
    }

    function processAllCatalogItems() {
        if (!shouldBeActive()) {
            return;
        }
        
        const catalogItems = document.querySelectorAll('.catalog-item-container');
        catalogItems.forEach(item => {
            addRoEarnBadge(item);
        });
    }

    let catalogObserver = null;

    function startCatalogObserver() {
        if (catalogObserver) {
            return; 
        }
        
        catalogObserver = new MutationObserver((mutations) => {
            if (!shouldBeActive()) {
                return;
            }
            
            let shouldProcess = false;
            
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
                        if (node.classList && node.classList.contains('catalog-item-container')) {
                            shouldProcess = true;
                        } else if (node.querySelector && node.querySelector('.catalog-item-container')) {
                            shouldProcess = true;
                        }
                    }
                });
            });
            
            if (shouldProcess) {
                processAllCatalogItems();
            }
        });
        
        catalogObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    function stopCatalogObserver() {
        if (catalogObserver) {
            catalogObserver.disconnect();
            catalogObserver = null;
        }
    }

    function handleURLChange() {
        const isActive = shouldBeActive();
        
        if (isActive) {
            startCatalogObserver();
            processAllCatalogItems();
        } else {
            stopCatalogObserver();
            removeAllBadges();
        }
    }

    handleURLChange();

    let lastUrl = window.location.href;
    const urlObserver = new MutationObserver(() => {
        const currentUrl = window.location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            handleURLChange();
        }
    });

    urlObserver.observe(document, {
        subtree: true,
        childList: true
    });

    window.addEventListener('popstate', () => {
        handleURLChange();
    });

})();