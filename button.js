(function () {
    if (/Firefox\//i.test(navigator.userAgent)) return;

    const BTN_WRAPPER   = 'rrp-btn-wrapper';
    const BTN_ID        = 'rrp-our-play-btn';
    const MAIN_BTN_ID   = 'roregion-btn-wrapper';
    const STORE_URL     = 'https://roearn.io/open/play-btn/';
    const CONTAINER_ID  = 'game-details-play-button-container';

    const style = document.createElement('style');
    style.textContent = `.random-server-button{display:none!important;visibility:hidden!important;opacity:0!important;width:0!important;height:0!important;overflow:hidden!important;min-width:0!important;margin:0!important;padding:0!important;}#${BTN_WRAPPER}{display:inline-flex;align-items:stretch;gap:6px;vertical-align:middle;}#${BTN_ID}{background:#335fff!important;border:none!important;cursor:pointer!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;color:#fff!important;flex-shrink:0!important;box-shadow:none!important;transition:filter .15s ease!important;border-radius:6px!important;}#${BTN_ID}:hover{filter:brightness(1.12)!important;}#${BTN_ID}:active{filter:brightness(0.88)!important;}`;

    function appendStyle() { document.head.appendChild(style); }
    if (document.head) { appendStyle(); }
    else { new MutationObserver((_, o) => { if (document.head) { appendStyle(); o.disconnect(); } }).observe(document.documentElement, { childList: true }); }

    let btnAdded = false;

    function injectButton(container) {
        if (document.getElementById(BTN_WRAPPER) || btnAdded) return;
        const playBtn = container.querySelector('.btn-common-play-game-lg');
        if (!playBtn) return;
        btnAdded = true;

        setTimeout(() => {
            if (document.getElementById(MAIN_BTN_ID)) { btnAdded = false; return; }

            requestAnimationFrame(() => {
                if (document.getElementById(BTN_WRAPPER) || !playBtn.parentNode) { btnAdded = false; return; }

                const fullWidth  = playBtn.offsetWidth  || 300;
                const fullHeight = playBtn.offsetHeight || 48;
                const sliceWidth = Math.round(fullWidth * 0.30);

                playBtn.style.setProperty('width',       (fullWidth - sliceWidth - 6) + 'px', 'important');
                playBtn.style.setProperty('min-width',   '0', 'important');
                playBtn.style.setProperty('flex-shrink', '0', 'important');

                const iconSize = Math.round(fullHeight * 0.48);
                const btn = document.createElement('button');
                btn.id   = BTN_ID;
                btn.type = 'button';
                btn.style.cssText = `width:${sliceWidth}px;height:${fullHeight}px;`;
                btn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" width="${iconSize}" height="${iconSize}"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`;
                btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); window.open(STORE_URL, '_blank'); });

                const wrapper = document.createElement('span');
                wrapper.id = BTN_WRAPPER;
                playBtn.parentNode.insertBefore(wrapper, playBtn);
                wrapper.appendChild(playBtn);
                wrapper.appendChild(btn);
            });
        }, 100);
    }

    function init() {
        const existing = document.getElementById(CONTAINER_ID);
        if (existing) { injectButton(existing); if (btnAdded) return; }

        const observer = new MutationObserver(() => {
            const container = document.getElementById(CONTAINER_ID);
            if (!container) return;
            injectButton(container);
            if (btnAdded) observer.disconnect();
        });
        observer.observe(document.body, { childList: true, subtree: true });
        setTimeout(() => observer.disconnect(), 15000);
    }

    if (document.body) { init(); }
    else { new MutationObserver((_, o) => { if (document.body) { o.disconnect(); init(); } }).observe(document.documentElement, { childList: true }); }
})();