(async function() {
    const api = typeof browser !== 'undefined' ? browser : chrome;

    const storage = await api.storage.local.get(['hasReviewed', 'installTimestamp']);

    if (storage.hasReviewed === true) return;

    if (!storage.installTimestamp) {
        await api.storage.local.set({ installTimestamp: Date.now() });
        return;
    }

    const requiredTimeMs = 7 * 24 * 60 * 60 * 1000;
    if (Date.now() - storage.installTimestamp < requiredTimeMs) return;

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

    const showReviewPrompt = () => {
        const reviewPrompt = document.createElement('div');
        reviewPrompt.className = 'roearn-review-prompt';
        reviewPrompt.innerHTML = `
            <div class="roearn-review-text">
                ${getMessage("reviewPromptText")}
            </div>
            <div class="roearn-review-stars">
                <span class="roearn-star" data-rating="1">★</span>
                <span class="roearn-star" data-rating="2">★</span>
                <span class="roearn-star" data-rating="3">★</span>
                <span class="roearn-star" data-rating="4">★</span>
                <span class="roearn-star" data-rating="5">★</span>
            </div>
        `;

        const style = document.createElement('style');
        style.textContent = `
            .roearn-review-prompt {
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: white;
                border-radius: 14px;
                padding: 24px;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                max-width: 456px;
                font-family: 'HCo Gotham SSm', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .dark-theme .roearn-review-prompt {
                background: #232527;
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
            }

            @keyframes slideIn {
                from { transform: translateX(480px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }

            .roearn-review-text {
                font-size: 18px;
                font-weight: 600;
                color: #393b3d;
                margin-bottom: 18px;
                text-align: center;
                line-height: 1.4;
            }

            .dark-theme .roearn-review-text {
                color: #ffffff;
            }

            .roearn-review-stars {
                display: flex;
                justify-content: center;
                gap: 10px;
            }

            .roearn-star {
                font-size: 38px;
                color: #d1d1d1;
                cursor: pointer;
                transition: color 0.2s;
                user-select: none;
            }

            .roearn-star.gold,
            .roearn-star:hover,
            .roearn-star.hover-active {
                color: #ffd700;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(reviewPrompt);

        const stars = reviewPrompt.querySelectorAll('.roearn-star');

        stars.forEach((star, index) => {
            star.addEventListener('mouseenter', () => {
                stars.forEach((s, i) => {
                    s.classList.toggle('hover-active', i <= index);
                });
            });

            star.addEventListener('click', () => {
                window.open('http://roearn.io/review', '_blank');
                reviewPrompt.style.animation = 'slideIn 0.3s ease-in reverse';
                setTimeout(() => reviewPrompt.remove(), 300);
                api.storage.local.set({ hasReviewed: true });
            });
        });

        reviewPrompt.querySelector('.roearn-review-stars').addEventListener('mouseleave', () => {
            stars.forEach(s => s.classList.remove('hover-active'));
        });
    };

    if (document.body) {
        showReviewPrompt();
    } else {
        const observer = new MutationObserver(() => {
            if (document.body) {
                observer.disconnect();
                showReviewPrompt();
            }
        });
        observer.observe(document.documentElement, { childList: true, subtree: true });
    }
})();