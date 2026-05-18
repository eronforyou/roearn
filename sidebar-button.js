(function() {
    let _cachedSidebarMsg = null;

    async function loadSidebarMessages() {
        if (_cachedSidebarMsg) return _cachedSidebarMsg;
        try {
            const { userLocale } = await new Promise(r => chrome.storage.local.get(['userLocale'], r));
            const locale = userLocale || 'en';
            try {
                const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
                const res = await fetch(url);
                if (res.ok) { _cachedSidebarMsg = await res.json(); return _cachedSidebarMsg; }
            } catch(e) {}
            const fallback = await fetch(chrome.runtime.getURL('_locales/en/messages.json'));
            _cachedSidebarMsg = await fallback.json();
        } catch(e) { _cachedSidebarMsg = {}; }
        return _cachedSidebarMsg;
    }

    function getSidebarMessage(key) {
        if (!_cachedSidebarMsg || !_cachedSidebarMsg[key]) return key;
        return _cachedSidebarMsg[key].message || key;
    }

    function isNewUI() {
        return !!document.querySelector('div.left-nav ul.flex');
    }

    function injectHideCSS() {
        if (document.getElementById('roearn-nav-style')) return true;
        if (!document.head) return false;

        const style = document.createElement('style');
        style.id = 'roearn-nav-style';
        style.textContent = `
            #navigation .left-col-list {
                visibility: hidden !important;
            }
            #navigation .left-col-list.roearn-ready {
                visibility: visible !important;
            }
        `;
        document.head.appendChild(style);
        return true;
    }

    function createOldUIButton() {
        if (document.getElementById('nav-roearn')) return;

        const navList = document.querySelector('#navigation .left-col-list');
        if (!navList) return;

        const rbxBody = document.getElementById('rbx-body');
        const isDarkTheme = rbxBody && rbxBody.classList.contains('dark-theme');

        const roEarnLi = document.createElement('li');
        const roEarnLink = document.createElement('a');
        roEarnLink.className = 'dynamic-overflow-container text-nav';
        roEarnLink.href = '/roearn';
        roEarnLink.id = 'nav-roearn';
        roEarnLink.target = '_self';

        const iconDiv = document.createElement('div');
        const iconImg = document.createElement('img');
        iconImg.src = chrome.runtime.getURL('icons/sidebar-icon.png');
        iconImg.style.width = '28px';
        iconImg.style.height = '28px';
        iconImg.style.transition = 'filter 0.2s ease';
        iconImg.style.userSelect = 'none';
        iconImg.style.webkitUserSelect = 'none';
        iconImg.style.mozUserSelect = 'none';
        iconImg.style.msUserSelect = 'none';
        iconImg.style.pointerEvents = 'none';
        iconImg.draggable = false;

        let defaultFilter, hoverFilter;

        if (isDarkTheme) {
            defaultFilter = 'brightness(0) saturate(100%) invert(76%) sepia(0%) saturate(262%) hue-rotate(155deg) brightness(92%) contrast(87%)';
            hoverFilter = 'brightness(0) invert(1)';
        } else {
            defaultFilter = 'brightness(0) saturate(100%) invert(50%) sepia(6%) saturate(378%) hue-rotate(155deg) brightness(93%) contrast(88%)';
            hoverFilter = 'brightness(0) saturate(100%) invert(22%) sepia(4%) saturate(686%) hue-rotate(155deg) brightness(95%) contrast(90%)';
        }

        iconImg.style.filter = defaultFilter;
        iconDiv.appendChild(iconImg);

        const textSpan = document.createElement('span');
        textSpan.className = 'font-header-2 dynamic-ellipsis-item';
        textSpan.title = 'RoEarn';
        textSpan.textContent = 'RoEarn';

        roEarnLink.addEventListener('mouseenter', function() { iconImg.style.filter = hoverFilter; });
        roEarnLink.addEventListener('mouseleave', function() { iconImg.style.filter = defaultFilter; });

        roEarnLink.appendChild(iconDiv);
        roEarnLink.appendChild(textSpan);

        const badgeWrapperOld = document.createElement('div');
        badgeWrapperOld.className = 'dynamic-width-item align-right';
        badgeWrapperOld.style.display = 'none';

        const badgeSpanOld = document.createElement('span');
        badgeSpanOld.className = 'notification-blue notification';

        badgeWrapperOld.appendChild(badgeSpanOld);
        roEarnLink.appendChild(badgeWrapperOld);

        loadSidebarMessages().then(() => {
            chrome.storage.local.get(['roearnNavBadgeDismissed'], function(result) {
                if (!result.roearnNavBadgeDismissed) {
                    badgeSpanOld.textContent = getSidebarMessage('sidebarNewText');
                    badgeWrapperOld.style.display = '';
                }
            });
        });

        roEarnLink.addEventListener('click', function() {
            chrome.storage.local.set({ roearnNavBadgeDismissed: true });
        });

        roEarnLi.appendChild(roEarnLink);
        navList.insertBefore(roEarnLi, navList.firstChild);
        navList.classList.add('roearn-ready');

        if (oldObserver) oldObserver.disconnect();
    }

    function isDarkModeNewUI() {
        const nav = document.querySelector('div.left-nav');
        if (!nav) return false;
        const bg = getComputedStyle(nav).backgroundColor;
        const match = bg.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
        if (match) {
            const brightness = (parseInt(match[1]) + parseInt(match[2]) + parseInt(match[3])) / 3;
            return brightness < 128;
        }
        return false;
    }

    function createNewUIButton() {
        const navList = document.querySelector('div.left-nav ul.flex');
        if (!navList) return;

        const profileAvatarEl = navList.querySelector('.radius-circle.clip.size-600');
        if (!profileAvatarEl) return;

        const profileLi = profileAvatarEl.closest('li');
        if (!profileLi) return;

        const existing = document.getElementById('nav-roearn');
        if (existing) {
            const existingLi = existing.closest('li');
            if (existingLi && existingLi.previousElementSibling !== profileLi) {
                existingLi.remove();
            } else {
                return;
            }
        }

        const isDark = isDarkModeNewUI();

        const roEarnLi = document.createElement('li');
        const roEarnLink = document.createElement('a');
        roEarnLink.href = '/roearn';
        roEarnLink.id = 'nav-roearn';
        roEarnLink.target = '_self';
        roEarnLink.className = 'content-emphasis text-title-large flex items-center gap-small padding-left-xsmall padding-right-xxsmall radius-medium relative clip group/interactable focus-visible:outline-focus disabled:outline-none';

        const hoverDiv = document.createElement('div');
        hoverDiv.setAttribute('role', 'presentation');
        hoverDiv.className = 'absolute inset-[0] transition-colors group-hover/interactable:bg-[var(--color-state-hover)] group-active/interactable:bg-[var(--color-state-press)] group-disabled/interactable:bg-none';

        const iconWrapper = document.createElement('span');
        iconWrapper.className = 'size-1000 grow-0 shrink-0 basis-auto flex justify-center items-center';

        const iconImg = document.createElement('img');
        iconImg.src = isDark
            ? chrome.runtime.getURL('icons/sidebar-icon-white.png')
            : chrome.runtime.getURL('icons/sidebar-icon.png');
        iconImg.style.width = '24px';
        iconImg.style.height = '24px';
        iconImg.style.transition = 'filter 0.2s ease';
        iconImg.style.userSelect = 'none';
        iconImg.style.pointerEvents = 'none';
        iconImg.draggable = false;

        const defaultFilter = isDark
            ? 'none'
            : 'brightness(0) saturate(100%) invert(30%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(60%) contrast(90%)';
        const hoverFilter = isDark
            ? 'none'
            : 'brightness(0) saturate(100%) invert(10%) sepia(0%) saturate(0%) hue-rotate(0deg) brightness(20%) contrast(90%)';

        iconImg.style.filter = defaultFilter;

        roEarnLink.addEventListener('mouseenter', function() { iconImg.style.filter = hoverFilter; });
        roEarnLink.addEventListener('mouseleave', function() { iconImg.style.filter = defaultFilter; });

        iconWrapper.appendChild(iconImg);

        const textSpan = document.createElement('span');
        textSpan.className = 'min-width-0 text-truncate-end text-no-wrap';
        textSpan.textContent = 'RoEarn';

        roEarnLink.appendChild(hoverDiv);
        roEarnLink.appendChild(iconWrapper);
        roEarnLink.appendChild(textSpan);

        const badgeWrapperNew = document.createElement('span');
        badgeWrapperNew.className = 'fill basis-auto padding-x-small flex justify-end items-center';
        badgeWrapperNew.style.display = 'none';

        const badgeInnerNew = document.createElement('div');
        badgeInnerNew.className = 'foundation-web-badge flex items-center radius-circle select-none height-600 gap-xsmall width-[fit-content] padding-x-small bg-system-contrast content-inverse-emphasis stroke-none';
        badgeInnerNew.style.borderColor = 'var(--light-mode-stroke-default)';

        const badgeTextNew = document.createElement('span');
        badgeTextNew.className = 'padding-y-xsmall text-no-wrap text-truncate-split text-label-small content-inverse-emphasis';

        badgeInnerNew.appendChild(badgeTextNew);
        badgeWrapperNew.appendChild(badgeInnerNew);
        roEarnLink.appendChild(badgeWrapperNew);

        loadSidebarMessages().then(() => {
            chrome.storage.local.get(['roearnNavBadgeDismissed'], function(result) {
                if (!result.roearnNavBadgeDismissed) {
                    badgeTextNew.textContent = getSidebarMessage('sidebarNewText');
                    badgeWrapperNew.style.display = '';
                }
            });
        });

        roEarnLink.addEventListener('click', function() {
            chrome.storage.local.set({ roearnNavBadgeDismissed: true });
        });

        roEarnLi.appendChild(roEarnLink);

        profileLi.insertAdjacentElement('afterend', roEarnLi);

        if (newObserver) newObserver.disconnect();
    }

    function createButton() {
        if (isNewUI()) {
            createNewUIButton();
        } else {
            if (!injectHideCSS()) {
                const headObserver = new MutationObserver(() => {
                    if (injectHideCSS()) headObserver.disconnect();
                });
                headObserver.observe(document.documentElement, { childList: true, subtree: true });
            }
            createOldUIButton();
        }
    }

    let oldObserver = new MutationObserver(() => createButton());
    let newObserver = new MutationObserver(() => createButton());

    oldObserver.observe(document.documentElement, { childList: true, subtree: true });
    newObserver.observe(document.documentElement, { childList: true, subtree: true });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createButton);
    } else {
        createButton();
    }
})();