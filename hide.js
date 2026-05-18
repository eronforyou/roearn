(async function() {
    const HIDE_TEXT = 'Purchase';

    const GAME_CARD_SELECTORS = [
        'li.game-card.game-tile',
        'div.grid-item-container.game-card-container'
    ].join(', ');

    const css = `
        .game-card-hidden-by-filter {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            position: absolute !important;
            width: 0 !important;
            height: 0 !important;
            overflow: hidden !important;
            margin: 0 !important;
            padding: 0 !important;
            border: 0 !important;
        }
    `;

    function injectCSS() {
        if (document.head) {
            const style = document.createElement('style');
            style.textContent = css;
            document.head.appendChild(style);
            return true;
        }
        return false;
    }

    if (!injectCSS()) {
        const headObserver = new MutationObserver(() => {
            if (injectCSS()) {
                headObserver.disconnect();
            }
        });
        headObserver.observe(document.documentElement, { childList: true, subtree: true });
    }

    function checkAndHide(element) {
        if (!element || element.classList.contains('game-card-hidden-by-filter')) return;
        
        if (element.matches && element.matches(GAME_CARD_SELECTORS)) {
            const nameElement = element.querySelector('.game-card-name, .game-name-title');
            const imgElement = element.querySelector('img[alt], img[title]');
            const linkElement = element.querySelector('a[href*="Purchase-Hub"]');
            
            let shouldHide = false;
            
            if (nameElement && nameElement.textContent.includes(HIDE_TEXT)) {
                shouldHide = true;
            }
            if (imgElement && (imgElement.alt?.includes(HIDE_TEXT) || imgElement.title?.includes(HIDE_TEXT))) {
                shouldHide = true;
            }
            if (linkElement) {
                shouldHide = true;
            }
            
            if (shouldHide) {
                element.classList.add('game-card-hidden-by-filter');
            }
        }
    }

    function processExisting() {
        document.querySelectorAll(GAME_CARD_SELECTORS).forEach(checkAndHide);
    }

    const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== Node.ELEMENT_NODE) continue;
                
                checkAndHide(node);
                
                if (node.querySelectorAll) {
                    node.querySelectorAll(GAME_CARD_SELECTORS).forEach(checkAndHide);
                }
            }
            
            if (mutation.type === 'characterData' || mutation.type === 'attributes') {
                const target = mutation.target.nodeType === Node.ELEMENT_NODE 
                    ? mutation.target 
                    : mutation.target.parentElement;
                if (target) {
                    const gameCard = target.closest(GAME_CARD_SELECTORS);
                    if (gameCard) checkAndHide(gameCard);
                }
            }
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true,
        attributeFilter: ['alt', 'title']
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', processExisting);
    } else {
        processExisting();
    }
    window.addEventListener('load', processExisting);

    setInterval(processExisting, 1000);
})();