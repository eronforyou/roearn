(function () {

  const api = typeof browser !== 'undefined' ? browser : chrome;

  const pathMatch = window.location.pathname.match(/\/(?:[a-z]{2}\/)?games\/(\d+)\//);
  if (!pathMatch) return;
  const placeId = pathMatch[1];

  let cachedMessages = null;
  let messagesPromise = null;

  function getExtensionUrl() {
    return new Promise((resolve) => {
      const check = () => {
        const el = document.getElementById('__roearn_extension_url__');
        if (el && el.dataset.url) {
          resolve(el.dataset.url);
        } else {
          setTimeout(check, 10);
        }
      };
      check();
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
        const res = await fetch(`${extensionUrl}_locales/${locale}/messages.json`);
        if (res.ok) {
          cachedMessages = await res.json();
          return cachedMessages;
        }
      } catch (e) {}

      const fallback = await fetch(`${extensionUrl}_locales/en/messages.json`);
      cachedMessages = await fallback.json();
      return cachedMessages;
    })();

    return messagesPromise;
  }

  function getMessage(key) {
    if (!cachedMessages || !cachedMessages[key]) return key;
    return cachedMessages[key].message || key;
  }

  async function getUniverseId(placeId) {
    const res = await fetch(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.universeId || null;
  }

  async function getGameGenre(universeId) {
    const res = await fetch(`https://games.roblox.com/v1/games?universeIds=${universeId}`, {
      credentials: 'include'
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.untranslated_genre_l1 || null;
  }

  function dismiss() {
    const overlay = document.getElementById('roearn-shopping-warning');
    if (overlay) overlay.remove();
    api.storage.local.set({ shoppingWarningShown: true });
  }

  function injectKeyframes() {
    if (document.getElementById('roearn-shopping-warning-css')) return;
    const style = document.createElement('style');
    style.id = 'roearn-shopping-warning-css';
    style.textContent = `
      @keyframes roearn-rainbow-flow-sw {
        0%   { background-position: 0% 50%; }
        50%  { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  function showWarning() {
    if (document.getElementById('roearn-shopping-warning')) return;
    injectKeyframes();

    const overlay = document.createElement('div');
    overlay.id = 'roearn-shopping-warning';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.55);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 16px;
      box-sizing: border-box;
    `;

    const modal = document.createElement('div');
    modal.style.cssText = `
      position: relative;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 28px 24px;
      max-width: 420px;
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
    `;

    const icon = document.createElement('img');
    icon.src = api.runtime.getURL('icons/icon-128.png');
    icon.style.cssText = 'width:48px;height:48px;display:block;';

    const title = document.createElement('p');
    title.textContent = getMessage('shoppingWarningTitle');
    title.style.cssText = `
      margin: 0;
      color: #e0e0e0;
      font-size: 17px;
      font-weight: 700;
      text-align: center;
      line-height: 1.3;
      font-family: sans-serif;
    `;

    const body = document.createElement('p');
    body.textContent = getMessage('shoppingWarningBody');
    body.style.cssText = `
      margin: 0;
      color: #999;
      font-size: 14px;
      text-align: center;
      line-height: 1.6;
      font-family: sans-serif;
    `;

    const closeBtn = document.createElement('a');
    closeBtn.textContent = getMessage('shoppingWarningCatalogBtn');
    closeBtn.href = 'https://www.roblox.com/catalog';
    closeBtn.style.cssText = `
      display: block;
      margin-top: 4px;
      background: linear-gradient(90deg, #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff);
      background-size: 200% 100%;
      animation: roearn-rainbow-flow-sw 6s ease-in-out infinite;
      color: white;
      font-size: 14px;
      font-weight: bold;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3);
      text-decoration: none;
      border: none;
      border-radius: 8px;
      padding: 13px 24px;
      text-align: center;
      width: 100%;
      box-sizing: border-box;
      font-family: sans-serif;
      cursor: pointer;
    `;
    closeBtn.addEventListener('click', dismiss);

    const dismissBtn = document.createElement('button');
    dismissBtn.textContent = getMessage('shoppingWarningDismiss');
    dismissBtn.style.cssText = `
      background: none;
      border: none;
      color: #555;
      font-size: 13px;
      font-family: sans-serif;
      cursor: pointer;
      padding: 0;
      margin-top: -4px;
    `;
    dismissBtn.addEventListener('mouseenter', () => { dismissBtn.style.color = '#888'; });
    dismissBtn.addEventListener('mouseleave', () => { dismissBtn.style.color = '#555'; });
    dismissBtn.addEventListener('click', dismiss);

    modal.appendChild(icon);
    modal.appendChild(title);
    modal.appendChild(body);
    modal.appendChild(closeBtn);
    modal.appendChild(dismissBtn);
    overlay.appendChild(modal);
    document.documentElement.appendChild(overlay);
  }

  async function init() {
    const universeId = await getUniverseId(placeId);
    if (!universeId) return;

    const genre = await getGameGenre(universeId);
    if (genre !== 'shopping') return;

    await loadMessages();
    showWarning();
  }

  init();

})();