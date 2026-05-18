(function () {

  const api = typeof browser !== 'undefined' ? browser : chrome;

  let _cachedMessages = null;
  let _messagesPromise = null;

  async function _loadMessages() {
    if (_cachedMessages) return _cachedMessages;
    if (_messagesPromise) return _messagesPromise;
    _messagesPromise = (async () => {
      let locale = 'en';
      try {
        const result = await api.storage.local.get(['userLocale']);
        locale = result.userLocale || 'en';
      } catch (e) {}
      try {
        const url = api.runtime.getURL(`_locales/${locale}/messages.json`);
        const res = await fetch(url);
        if (res.ok) { _cachedMessages = await res.json(); return _cachedMessages; }
      } catch (e) {}
      const fallback = await fetch(api.runtime.getURL('_locales/en/messages.json'));
      _cachedMessages = await fallback.json();
      return _cachedMessages;
    })();
    return _messagesPromise;
  }

  function _getMessage(key) {
    if (!_cachedMessages || !_cachedMessages[key]) return key;
    return _cachedMessages[key].message || key;
  }

  const ONE_WEEK_MS        = 7 * 24 * 60 * 60 * 1000;
  const BTN_GRADIENT       = 'linear-gradient(135deg, #ff1a1a 0%, #cc0000 100%)';
  const BTN_GRADIENT_HOVER = 'linear-gradient(135deg, #ff3333 0%, #e60000 100%)';
  const YT_URL             = 'https://roearn.io/youtube';

  function _isNewUI() {
    return !!document.querySelector('div.left-nav ul.flex');
  }

  function _youtubeSvg(size) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" style="width:${size}px;height:${size}px;display:block;flex-shrink:0;pointer-events:none;user-select:none;fill:#fff;"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;
  }

  function _onButtonClicked(e) {
    e.preventDefault();
    window.open(YT_URL, '_blank');
    setTimeout(() => {
      const li = document.getElementById('nav-roearn-subscribe')?.closest('li');
      if (li) li.remove();
    }, 2000);
    api.storage.local.set({ sidebarSubscribeDismissed: true, subscribeArrowDismissed: true });
    if (_observer) {
      _observer.disconnect();
      _observer = null;
    }
  }

  function _buildButton() {
    const a = document.createElement('a');
    a.style.cursor = 'pointer';
    a.id   = 'nav-roearn-subscribe';
    a.addEventListener('click', _onButtonClicked);
    a.addEventListener('mouseenter', () => { a.style.background = BTN_GRADIENT_HOVER; });
    a.addEventListener('mouseleave', () => { a.style.background = BTN_GRADIENT; });
    return a;
  }

  function _createOldUIButton() {
    if (document.getElementById('nav-roearn-subscribe')) return true;

    const navList = document.querySelector('#navigation .left-col-list');
    if (!navList) return false;

    const premiumLi = navList.querySelector('li.rbx-upgrade-now');
    if (!premiumLi) return false;

    const a = _buildButton();
    a.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      background: ${BTN_GRADIENT};
      border-radius: 6px;
      padding: 8px 12px;
      box-sizing: border-box;
      width: 100%;
      text-decoration: none;
      transition: background 0.2s ease;
    `;

    const iconDiv = document.createElement('div');
    iconDiv.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-shrink:0;';
    iconDiv.innerHTML = _youtubeSvg(18);

    const span = document.createElement('span');
    span.title       = _getMessage('dashboard_subscribe_btn');
    span.textContent = _getMessage('dashboard_subscribe_btn');
    span.style.cssText = 'color:#fff;font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;line-height:1;';

    a.appendChild(iconDiv);
    a.appendChild(span);

    const li = document.createElement('li');
    li.appendChild(a);
    premiumLi.insertAdjacentElement('beforebegin', li);
    return true;
  }

  function _createNewUIButton() {
    if (document.getElementById('nav-roearn-subscribe')) return true;

    const navList = document.querySelector('div.left-nav ul.flex');
    if (!navList) return false;

    const giftCardIcon = navList.querySelector('.icon-regular-gift-card');
    if (!giftCardIcon) return false;
    const giftCardLi = giftCardIcon.closest('li');
    if (!giftCardLi) return false;

    const a = _buildButton();
    a.className = 'content-emphasis text-title-large flex items-center gap-small padding-left-xsmall padding-right-xxsmall radius-medium relative clip focus-visible:outline-focus';
    a.style.cssText = `
      background: ${BTN_GRADIENT};
      justify-content: center;
      gap: 6px;
      padding-top: 10px;
      padding-bottom: 10px;
      transition: background 0.2s ease;
    `;

    const iconWrapper = document.createElement('span');
    iconWrapper.style.cssText = 'display:flex;align-items:center;justify-content:center;flex-shrink:0;';
    iconWrapper.innerHTML = _youtubeSvg(18);

    const span = document.createElement('span');
    span.className   = 'min-width-0 text-truncate-end text-no-wrap';
    span.textContent = _getMessage('dashboard_subscribe_btn');
    span.style.cssText = 'color:#fff;line-height:1;';

    a.appendChild(iconWrapper);
    a.appendChild(span);

    const li = document.createElement('li');
    li.appendChild(a);
    giftCardLi.insertAdjacentElement('afterend', li);
    return true;
  }

  let _observer = null;

  function _tryCreate() {
    const done = _isNewUI() ? _createNewUIButton() : _createOldUIButton();
    if (done && _observer) {
      _observer.disconnect();
      _observer = null;
    }
  }

  function _startObserver() {
    if (_observer) return;
    _observer = new MutationObserver(_tryCreate);
    _observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  async function _init() {
    await _loadMessages();
    api.storage.local.get(['sidebarSubscribeDismissed', 'subscribeArrowDismissed', 'installTimestamp'], (result) => {
      if (result.sidebarSubscribeDismissed === true) return;
      if (result.subscribeArrowDismissed === true) return;

      const installTimestamp = result.installTimestamp;
      if (!installTimestamp) return;
      if (Date.now() - installTimestamp < ONE_WEEK_MS) return;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
          _tryCreate();
          if (!document.getElementById('nav-roearn-subscribe')) _startObserver();
        });
      } else {
        _tryCreate();
        if (!document.getElementById('nav-roearn-subscribe')) _startObserver();
      }
    });
  }

  _init();

})();