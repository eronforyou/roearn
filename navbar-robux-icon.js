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

    async function modifyRobuxPopover() {
        const popover = document.getElementById('buy-robux-popover');
        if (!popover) {
            return;
        }

        if (popover.getAttribute('data-roearn-modified') === 'true') {
            return;
        }

        const menuList = popover.querySelector('#buy-robux-popover-menu');
        if (!menuList) {
            return;
        }

        const rbxBody = document.getElementById('rbx-body');
        const isDarkTheme = rbxBody && rbxBody.classList.contains('dark-theme');

        const roEarnLi = document.createElement('li');
        roEarnLi.className = 'rbx-menu-item-container';

        const roEarnLink = document.createElement('a');
        roEarnLink.className = 'rbx-menu-item';
        roEarnLink.href = '/roearn';
        roEarnLink.addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = 'https://www.roblox.com/roearn';
        });

        const contentSpan = document.createElement('span');
        contentSpan.style.display = 'flex';
        contentSpan.style.alignItems = 'center';
        contentSpan.style.gap = '8px';

        const roEarnIcon = document.createElement('img');
        roEarnIcon.src = api.runtime.getURL('icons/sidebar-icon.png');
        roEarnIcon.style.width = '28px';
        roEarnIcon.style.height = '28px';
        roEarnIcon.style.userSelect = 'none';
        roEarnIcon.style.webkitUserSelect = 'none';
        roEarnIcon.style.mozUserSelect = 'none';
        roEarnIcon.style.msUserSelect = 'none';
        roEarnIcon.style.pointerEvents = 'none';
        roEarnIcon.draggable = false;

        if (isDarkTheme) {
            roEarnIcon.style.filter = 'brightness(0) saturate(100%) invert(76%) sepia(0%) saturate(262%) hue-rotate(155deg) brightness(92%) contrast(87%)';
        } else {
            roEarnIcon.style.filter = 'brightness(0) saturate(100%) invert(50%) sepia(6%) saturate(378%) hue-rotate(155deg) brightness(93%) contrast(88%)';
        }

        const roEarnText = document.createElement('span');
        
        let messageText = getMessage("roEarnBalance");
        messageText = messageText.replace(":", "").replace(/\$\d+/g, "").replace(/\s*Robux\s*/gi, "").trim();
        roEarnText.textContent = messageText;

        contentSpan.appendChild(roEarnIcon);
        contentSpan.appendChild(roEarnText);
        roEarnLink.appendChild(contentSpan);
        roEarnLi.appendChild(roEarnLink);

        const firstMenuItem = menuList.querySelector('.rbx-menu-item-container');
        if (firstMenuItem) {
            menuList.insertBefore(roEarnLi, firstMenuItem);
        } else {
            menuList.appendChild(roEarnLi);
        }

        popover.setAttribute('data-roearn-modified', 'true');
    }

    function startObserving() {
        if (document.body) {
            const observer = new MutationObserver((mutations) => {
                modifyRobuxPopover();
            });

            observer.observe(document.body, {
                childList: true,
                subtree: true
            });

            modifyRobuxPopover();

        } else {
            setTimeout(startObserving, 10);
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', startObserving);
    } else {
        startObserving();
    }
})();