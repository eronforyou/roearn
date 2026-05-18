(async function () {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    // ── Localization ──────────────────────────────────────────────────────────
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
        if (!cachedMessages || !cachedMessages[key]) return key;
        let message = cachedMessages[key].message;
        if (substitutions) {
            const subs = Array.isArray(substitutions) ? substitutions : [substitutions];
            subs.forEach((sub, index) => {
                message = message.replace(new RegExp(`\\$${index + 1}`, 'g'), sub);
            });
        }
        return message;
    }

    await loadMessages();
    // ─────────────────────────────────────────────────────────────────────────

    const _href = window.location.href;
    const isOnPlusPage  = _href.includes('/plus');
    const isOnRobuxPage = _href.includes('upgrades/robux');
    const isOnOtherPage = !isOnPlusPage && !isOnRobuxPage;

    if (!isOnPlusPage && !isOnRobuxPage && !isOnOtherPage) return;

    const NOTICE_ID        = 'roearn-rbxplus-notice';
    const STYLE_ID         = 'roearn-rbxplus-style';
    const CARD_TAG_CLASS   = 'roearn-rbxplus-card-tag';
    const SUB_BTN_ID       = 'roearn-rbxplus-sub-btn';

    const SUBSCRIBED_CLASS = 'text-body-medium content-emphasis';
    const SUBSCRIBED_REGEX = /Subscribed since/i;

    const UNSUB_LABEL_CLASS = 'text-label-large content-emphasis text-no-wrap';
    const SUBSCRIBE_EARN_AMOUNT = '50';

    function isSubscribed() {
        return !!(
            document.querySelector('.icon-regular-calendar') ||
            document.querySelector('[data-testid="subscription-discount-card"]')
        );
    }

    function isUnsubscribed() {
        const candidates = document.querySelectorAll('span');
        for (const el of candidates) {
            if (UNSUB_LABEL_CLASS.trim().split(' ').every(c => el.classList.contains(c))) return true;
        }
        return false;
    }

    function findContentColumn() {
        const headings = document.querySelectorAll('h1');
        for (const h1 of headings) {
            let el = h1.parentElement;
            while (el && el !== document.body) {
                if (el.classList.contains('width-full')) return el;
                el = el.parentElement;
            }
        }
        return null;
    }

    function injectStyles() {
        if (document.getElementById(STYLE_ID)) return;
        const style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = `
            @keyframes roearn-arrow-bounce {
                0%   { transform: translateX(0px); }
                50%  { transform: translateX(8px); }
                100% { transform: translateX(0px); }
            }
            .roearn-rbxplus-arrow {
                display: inline-flex;
                align-items: center;
                pointer-events: none;
                flex-shrink: 0;
            }
            .roearn-rbxplus-arrow path { stroke: #606162; }
            .dark-theme .roearn-rbxplus-arrow path { stroke: #9ca3af; }
                0%   { background-position: 0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            @keyframes roearn-rbxplus-rainbow {
                0%   { background-position: 0% 50%; }
                50%  { background-position: 100% 50%; }
                100% { background-position: 0% 50%; }
            }
            #roearn-rbxplus-notice {
                position: relative;
                z-index: 10;
                width: 100%;
                box-sizing: border-box;
                border-radius: 14px;
                padding: 16px 20px;
                margin-bottom: 24px;
                background: linear-gradient(
                    135deg,
                    rgb(107, 181, 255),
                    rgb(166, 107, 255),
                    rgb(214, 107, 255),
                    rgb(255, 107, 189),
                    rgb(214, 107, 255),
                    rgb(166, 107, 255),
                    rgb(107, 181, 255)
                );
                background-size: 300% 300%;
                animation: roearn-rbxplus-shimmer 6s ease-in-out infinite;
                box-shadow: 0 4px 24px rgba(166, 107, 255, 0.35);
            }
            #roearn-rbxplus-notice .roearn-rbxplus-title {
                font-size: 15px;
                font-weight: 800;
                color: white;
                line-height: 1.3;
                margin-bottom: 5px;
            }
            #roearn-rbxplus-notice .roearn-rbxplus-body {
                font-size: 12.5px;
                font-weight: 500;
                color: rgba(255, 255, 255, 0.93);
                line-height: 1.6;
            }
            #roearn-rbxplus-sub-btn,
            .roearn-rbxplus-sub-btn-instance {
                position: relative;
                z-index: 10;
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: fit-content;
                height: 52px;
                padding: 0 20px;
                border: none;
                border-radius: 8px;
                font-size: 15px;
                font-weight: 700;
                color: white;
                cursor: pointer;
                white-space: nowrap;
                background: linear-gradient(90deg,
                    #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff
                );
                background-size: 200% 100%;
                animation: roearn-rbxplus-rainbow 6s ease-in-out infinite;
                box-shadow: 0 4px 16px rgba(166, 107, 255, 0.4);
                text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
            }
            #roearn-rbxplus-sub-btn .roearn-sub-robux-icon {
                display: inline-block;
                vertical-align: middle;
                margin-left: 2px;
                margin-right: 0px;
                filter: brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0,0,0,0.5)) drop-shadow(0 0 8px rgba(0,0,0,0.3));
            }
        `;
        document.head.appendChild(style);
    }


    // body copy now comes from localization (plus_body_copy)

    function injectSubscribedNotice(column) {
        if (document.getElementById(NOTICE_ID)) return;
        injectStyles();

        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.innerHTML = `
            <div class="roearn-rbxplus-title">${getMessage('plus_subscribed_title')}</div>
            <div class="roearn-rbxplus-body">${getMessage('plus_body_copy')}</div>
        `;

        column.insertBefore(notice, column.firstChild);
    }

    function injectUnsubscribedNotice(column) {
        if (document.getElementById(NOTICE_ID)) return;
        injectStyles();

        const notice = document.createElement('div');
        notice.id = NOTICE_ID;
        notice.innerHTML = `
            <div class="roearn-rbxplus-title">${getMessage('plus_unsubscribed_title')}</div>
            <div class="roearn-rbxplus-body">${getMessage('plus_body_copy')}</div>
        `;

        column.insertBefore(notice, column.firstChild);
    }


    function injectSubscribeButton() {
        if (document.getElementById(SUB_BTN_ID)) return;

        const allOriginalBtns = document.querySelectorAll('a[href*="paymentmethods"][href*="subscription"]');
        if (!allOriginalBtns.length) return;

        allOriginalBtns.forEach((originalBtn, index) => {
            if (originalBtn.dataset.roearnReplaced) return;
            originalBtn.dataset.roearnReplaced = 'true';

            const isMobileDock = !!(originalBtn.closest('[data-testid="purchase-subscribe-dock"]'));

            const robuxIconEl = document.createElement('span');
            robuxIconEl.className = 'icon-robux-16x16';
            robuxIconEl.style.display = 'inline-block';
            robuxIconEl.style.marginLeft = '2px';
            robuxIconEl.style.marginRight = '0px';
            robuxIconEl.style.filter = 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))';

            const btn = document.createElement('button');
            if (index === 0) btn.id = SUB_BTN_ID;
            btn.className = 'roearn-rbxplus-sub-btn-instance';
            btn.type = 'button';

            {
                const plusBtnLabel = getMessage('plus_subscribe_btn', [SUBSCRIBE_EARN_AMOUNT]);
                const splitIdx = plusBtnLabel.indexOf(SUBSCRIBE_EARN_AMOUNT);
                if (splitIdx !== -1) {
                    btn.appendChild(document.createTextNode(plusBtnLabel.slice(0, splitIdx)));
                    btn.appendChild(robuxIconEl);
                    btn.appendChild(document.createTextNode(plusBtnLabel.slice(splitIdx)));
                } else {
                    btn.appendChild(document.createTextNode(plusBtnLabel));
                }
            }

            if (isMobileDock) {
                btn.style.cssText = `
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    width: 100%;
                    height: ${originalBtn.offsetHeight || 44}px;
                    padding: 0 20px;
                    border: none;
                    border-radius: 8px;
                    font-size: 15px;
                    font-weight: 700;
                    color: white;
                    cursor: pointer;
                    white-space: nowrap;
                    background: linear-gradient(90deg, #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff);
                    background-size: 200% 100%;
                    animation: roearn-rbxplus-rainbow 6s ease-in-out infinite;
                    box-shadow: 0 4px 16px rgba(166, 107, 255, 0.4);
                    text-shadow: rgba(0,0,0,0.2) 0px 1px 2px;
                    box-sizing: border-box;
                `;
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();

                const btnWidth  = btn.offsetWidth;
                const btnHeight = btn.offsetHeight;

                const joinBtn = document.createElement('button');
                joinBtn.type = 'button';
                joinBtn.className = 'btn-common-play-game-lg btn-primary-md';
                joinBtn.id = index === 0 ? 'roearn-rbxplus-join-btn' : `roearn-rbxplus-join-btn-${index}`;
                joinBtn.innerHTML = '<span class="icon-common-play"></span>';
                joinBtn.style.cssText = `
                    width: ${isMobileDock ? '100%' : btnWidth + 'px'};
                    height: ${btnHeight}px;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    ${isMobileDock ? 'box-sizing: border-box;' : ''}
                `;

                const getUserId = () => new Promise(resolve => {
                    api.storage.local.get(['roearnUserId', 'userId'], result => {
                        resolve(result.roearnUserId || result.userId || null);
                    });
                });

                joinBtn.addEventListener('click', async () => {
                    const userId = await getUserId();
                    const ua = navigator.userAgent;
                    const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);

                    if (isMobileUA) {
                        api.runtime.sendMessage({
                            type: 'LAUNCH_GAME_MOBILE',
                            assetType: 'plus_subscription',
                            assetId: '0',
                            assetPrice: 0,
                            userId: userId ? String(userId) : null,
                            isPlus: true
                        }, (response) => {
                            if (response && response.instanceCreate) {
                                const joinAttemptId = crypto.randomUUID();
                                const inner = encodeURIComponent(
                                    `https://www.roblox.com/games/start?placeid=${response.instanceCreate}&joinAttemptId=${joinAttemptId}`
                                );
                                window.location.href = `https://ro.blox.com/Ebh5?is_retargeting=false&pid=experiencestart_mobileweb&af_dp=${inner}&af_web_dp=${inner}&deep_link_value=${inner}`;
                            }
                        });
                    } else {
                        api.runtime.sendMessage({
                            type: 'LAUNCH_GAME',
                            assetType: 'plus_subscription',
                            assetId: '0',
                            assetPrice: 0,
                            userId: userId ? String(userId) : null,
                            isPlus: true
                        });
                    }
                });

                if (isMobileDock) {
                    btn.replaceWith(joinBtn);
                } else {
                    const wrapper = document.createElement('div');
                    wrapper.id = 'roearn-rbxplus-join-wrap';
                    wrapper.style.cssText = `position: relative; display: inline-block; width: ${btnWidth}px; height: ${btnHeight}px;`;

                    const arrowEl = document.createElement('div');
                    arrowEl.style.cssText = `
                        position: absolute;
                        right: calc(100% + 12px);
                        top: 0;
                        bottom: 0;
                        margin: auto 0;
                        height: 36px;
                        display: flex;
                        align-items: center;
                        pointer-events: none;
                        animation: roearn-arrow-bounce 1.8s ease-in-out infinite;
                    `;
                    arrowEl.innerHTML = `<svg width="36" height="36" viewBox="0 0 36 36" fill="none"><path d="M4 18 H28 M20 10 L30 18 L20 26" stroke="#606162" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

                    wrapper.appendChild(arrowEl);
                    wrapper.appendChild(joinBtn);
                    btn.replaceWith(wrapper);
                }
            });

            originalBtn.style.display = 'none';
            originalBtn.insertAdjacentElement('beforebegin', btn);
        });
    }


    function injectRobuxPageRedirect() {
        const priceBtns = document.querySelectorAll('a[href*="paymentmethods"][href*="ctx=subscription"][href*="RobloxPlus"]');
        priceBtns.forEach(btn => {
            if (btn.dataset.roearnRedirected) return;
            btn.dataset.roearnRedirected = 'true';
            btn.href = '/plus';
        });
        return !!priceBtns.length;
    }


    function injectGlobalSubscribeReplacement() {

        const popupBtns = document.querySelectorAll(
            'a[href*="paymentmethods"][href*="subscription"][href*="RobloxPlus"]:not([data-roearn-replaced])'
        );
        if (!popupBtns.length) return false;

        injectStyles();

        popupBtns.forEach(originalBtn => {
            if (originalBtn.dataset.roearnReplaced) return;
            originalBtn.dataset.roearnReplaced = 'true';

            const robuxIconEl = document.createElement('span');
            robuxIconEl.className = 'icon-robux-16x16';
            robuxIconEl.style.display = 'inline-block';
            robuxIconEl.style.marginLeft = '2px';
            robuxIconEl.style.marginRight = '0px';
            robuxIconEl.style.filter = 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2))';

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'roearn-rbxplus-sub-btn-instance';
            btn.style.width = '100%';
            {
                const plusBtnLabel = getMessage('plus_subscribe_btn', [SUBSCRIBE_EARN_AMOUNT]);
                const splitIdx = plusBtnLabel.indexOf(SUBSCRIBE_EARN_AMOUNT);
                if (splitIdx !== -1) {
                    btn.appendChild(document.createTextNode(plusBtnLabel.slice(0, splitIdx)));
                    btn.appendChild(robuxIconEl);
                    btn.appendChild(document.createTextNode(plusBtnLabel.slice(splitIdx)));
                } else {
                    btn.appendChild(document.createTextNode(plusBtnLabel));
                }
            }

            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = '/plus';
            });

            originalBtn.style.display = 'none';
            originalBtn.insertAdjacentElement('beforebegin', btn);
        });
        return true;
    }

    function tryInject() {
        if (isOnPlusPage) {
            const column = findContentColumn();
            if (!column) return false;

            if (isSubscribed()) {
                injectSubscribedNotice(column);
                return true;
            }

            if (isUnsubscribed()) {
                injectUnsubscribedNotice(column);
                injectSubscribeButton();
                return true;
            }

            return false;
        }

        if (isOnRobuxPage) {
            return injectRobuxPageRedirect();
        }

        if (isOnOtherPage) {
            return injectGlobalSubscribeReplacement();
        }

        return false;
    }

    if (!tryInject()) {
        const observer = new MutationObserver(() => {
            if (tryInject()) {
                if (!isOnOtherPage) observer.disconnect();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
        if (!isOnOtherPage) setTimeout(() => observer.disconnect(), 30000);
    }

})();