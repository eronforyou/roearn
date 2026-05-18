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

  await loadMessages();

  const isMobileDevice = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) && window.innerWidth < 480;

  const CART_MAX_ITEMS = 30;

  let _cartLimitToastTimer = null;
  function showCartLimitToast() {
    const existing = document.getElementById('roearn-limit-toast');
    if (existing) { clearTimeout(_cartLimitToastTimer); existing.remove(); }

    if (!document.getElementById('roearn-limit-toast-kf')) {
      const kf = document.createElement('style');
      kf.id = 'roearn-limit-toast-kf';
      kf.textContent = `
        @keyframes roearn-toast-in  { from { opacity:0; transform:translateX(-50%) translateY(14px); } to { opacity:1; transform:translateX(-50%) translateY(0); } }
        @keyframes roearn-toast-out { from { opacity:1; transform:translateX(-50%) translateY(0); } to { opacity:0; transform:translateX(-50%) translateY(14px); } }
      `;
      (document.head || document.documentElement).appendChild(kf);
    }

    const toast = document.createElement('div');
    toast.id = 'roearn-limit-toast';
    toast.style.cssText = `
      position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%);
      z-index: 2147483647; background: #1a1a1a; border: 1px solid #333;
      border-radius: 14px; padding: 20px 24px; max-width: 380px;
      width: calc(100% - 40px); box-sizing: border-box;
      display: flex; flex-direction: column; align-items: center; gap: 10px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6); pointer-events: none;
      animation: roearn-toast-in 0.25s ease forwards; font-family: sans-serif;
    `;
    const title = document.createElement('p');
    title.textContent = getMessage('cartLimitTitleRecheck', [CART_MAX_ITEMS.toString()]);
    title.style.cssText = 'margin:0;color:#e0e0e0;font-size:15px;font-weight:700;text-align:center;line-height:1.3;';
    const body = document.createElement('p');
    body.textContent = getMessage('cartLimitBodyRecheck', [CART_MAX_ITEMS.toString()]);
    body.style.cssText = 'margin:0;color:#999;font-size:13px;text-align:center;line-height:1.6;';
    toast.appendChild(title);
    toast.appendChild(body);
    document.documentElement.appendChild(toast);
    _cartLimitToastTimer = setTimeout(() => {
      toast.style.animation = 'roearn-toast-out 0.2s ease forwards';
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 4500);
  }

  function shouldShowCart() {
    const href = location.href;
    return href.includes('/catalog') || href.includes('/bundles');
  }

  function isPcItemPage() {
    return isMobileDevice
  }

  async function getCart() {
    return new Promise((resolve) => {
      api.storage.local.get(['roearnCart'], (result) => {
        resolve(result.roearnCart || []);
      });
    });
  }

  async function saveCart(cart) {
    return new Promise((resolve) => {
      api.storage.local.set({ roearnCart: cart }, resolve);
    });
  }

  async function removeFromCart(assetId) {
    let cart = await getCart();
    cart = cart.filter(item => String(item.assetId) !== String(assetId));
    await saveCart(cart);
    await removeFromSelectionStates(assetId);
    window.dispatchEvent(new CustomEvent('roearn:cartUpdated', { detail: { cart } }));
    return cart;
  }

  async function getSelectionStates() {
    return new Promise((resolve) => {
      api.storage.local.get(['roearnSelectionStates'], (result) => {
        resolve(result.roearnSelectionStates || {});
      });
    });
  }

  async function saveSelectionStates(states) {
    return new Promise((resolve) => {
      api.storage.local.set({ roearnSelectionStates: states }, resolve);
    });
  }

  async function setItemSelectionState(assetId, isSelected) {
    const states = await getSelectionStates();
    states[String(assetId)] = isSelected;
    await saveSelectionStates(states);
  }

  async function removeFromSelectionStates(assetId) {
    const states = await getSelectionStates();
    delete states[String(assetId)];
    await saveSelectionStates(states);
  }

  function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  }

  const style = document.createElement('style');
  style.textContent = `
    /* Hide Roblox's shopping cart */
    .shopping-cart-btn-container {
      display: none !important;
    }
    
    /* Our cart icon */
    .roearn-navbar-cart {
      position: relative;
      cursor: pointer;
      padding: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    
    .roearn-navbar-cart.hidden {
      display: none !important;
    }
    
    .roearn-navbar-cart svg {
      width: 28px;
      height: 28px;
      fill: #606162;
      transition: fill 0.2s;
    }
    
    .dark-theme .roearn-navbar-cart svg {
      fill: #bdbebe;
    }
    
    .roearn-navbar-cart:hover svg,
    .roearn-navbar-cart.popup-open svg {
      fill: #393b3d;
    }
    
    .dark-theme .roearn-navbar-cart:hover svg,
    .dark-theme .roearn-navbar-cart.popup-open svg {
      fill: #ffffff;
    }
    
    .roearn-cart-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      min-width: 18px;
      height: 18px;
      padding: 0 5px;
      border-radius: 9px;
      background: linear-gradient(90deg, #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff);
      background-size: 200% 100%;
      animation: rainbow-flow 6s ease-in-out infinite;
      color: white;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
    }
    
    .roearn-cart-badge.hidden {
      display: none;
    }
    
    @keyframes rainbow-flow {
      0% { background-position: 0% 50%; }
      50% { background-position: 100% 50%; }
      100% { background-position: 0% 50%; }
    }
    
    /* Popup styles */
    .roearn-cart-popup-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 9998;
    }
    
    .roearn-cart-popup {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 10px;
      width: 416px;
      max-height: 650px;
      background: white;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      z-index: 9999;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      cursor: default;
    }
    
    .dark-theme .roearn-cart-popup {
      background: #232527;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    
    .roearn-cart-popup-header {
      padding: 21px;
      border-bottom: 1px solid #e0e0e0;
      font-size: 21px;
      font-weight: bold;
      color: #393b3d;
    }
    
    .dark-theme .roearn-cart-popup-header {
      border-bottom-color: #3d3d3d;
      color: #ffffff;
    }
    
    .roearn-cart-popup-items {
      flex: 1;
      overflow-y: auto;
      padding: 10px 0;
    }
    
    .roearn-cart-popup-empty {
      padding: 42px 21px;
      text-align: center;
      color: #666;
      font-size: 16px;
    }
    
    .dark-theme .roearn-cart-popup-empty {
      color: #aaa;
    }
    
    .roearn-cart-item {
      display: flex;
      align-items: center;
      padding: 16px 21px;
      gap: 16px;
      position: relative;
    }
    
    .roearn-cart-item:hover {
      background: #f5f5f5;
    }
    
    .dark-theme .roearn-cart-item:hover {
      background: #2d2f31;
    }
    
    .roearn-cart-item-checkbox {
      width: 18px;
      height: 18px;
      cursor: pointer;
      appearance: none;
      -webkit-appearance: none;
      border: 2px solid #ccc;
      border-radius: 4px;
      position: relative;
      flex-shrink: 0;
    }
    
    .roearn-cart-item-checkbox:checked {
      border: none;
      background: linear-gradient(90deg, #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff);
      background-size: 200% 100%;
      animation: rainbow-flow 6s ease-in-out infinite;
    }
    
    .roearn-cart-item-checkbox:checked::after {
      content: '';
      position: absolute;
      left: 50%;
      top: 45%;
      width: 5px;
      height: 10px;
      border: solid white;
      border-width: 0 2px 2px 0;
      transform: translate(-50%, -50%) rotate(45deg);
    }
    
    .dark-theme .roearn-cart-item-checkbox {
      border-color: #666;
    }
    
    .roearn-cart-item-thumb {
      width: 78px;
      height: 78px;
      border-radius: 10px;
      object-fit: cover;
      background: #f0f0f0;
    }
    
    .dark-theme .roearn-cart-item-thumb {
      background: #3d3d3d;
    }
    
    .roearn-cart-item-info {
      flex: 1;
      min-width: 0;
    }
    
    .roearn-cart-item-name {
      font-size: 18px;
      font-weight: 600;
      color: #393b3d;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      text-decoration: none;
      display: block;
      cursor: pointer;
    }
    
    .roearn-cart-item-name:hover {
      text-decoration: underline;
    }
    
    .dark-theme .roearn-cart-item-name {
      color: #ffffff;
    }
    
    .roearn-cart-item-price {
      font-size: 17px;
      color: #666;
      display: flex;
      align-items: center;
      margin-top: 5px;
    }
    
    .roearn-cart-item-price .icon-robux-16x16 {
      margin-right: 2px;
    }
    
    .dark-theme .roearn-cart-item-price {
      color: #aaa;
    }
    
    .roearn-cart-item-remove {
      width: 42px;
      height: 42px;
      border: none;
      background: none;
      cursor: pointer;
      color: #999;
      font-size: 31px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      transition: background 0.2s, color 0.2s;
    }
    
    .roearn-cart-item-remove:hover {
      background: #fee;
      color: #dc3545;
    }
    
    .dark-theme .roearn-cart-item-remove:hover {
      background: rgba(220, 53, 69, 0.2);
    }
    
    .roearn-cart-popup-footer {
      padding: 21px;
      border-top: 1px solid #e0e0e0;
    }
    
    .dark-theme .roearn-cart-popup-footer {
      border-top-color: #3d3d3d;
    }
    
    .roearn-cart-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      font-size: 18px;
      color: #393b3d;
    }
    
    .dark-theme .roearn-cart-total {
      color: #ffffff;
    }
    
    .roearn-cart-total-price {
      font-weight: bold;
      display: flex;
      align-items: center;
    }
    
    .roearn-cart-total-price .icon-robux-16x16 {
      margin-right: 2px;
    }
    
    .roearn-cart-buy-btn {
      width: 100%;
      height: 57px;
      border: none;
      border-radius: 10px;
      font-size: 21px;
      font-weight: bold;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(90deg, #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff);
      background-size: 200% 100%;
      animation: rainbow-flow 6s ease-in-out infinite;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .roearn-cart-buy-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .roearn-cart-buy-btn .icon-robux-16x16 {
      display: inline-block;
      margin-left: 2px;
      margin-right: 0px;
      filter: brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 8px rgba(0, 0, 0, 0.3));
    }

    /* ═══════════════════════════════════════════════════════
       MOBILE CART FAB + MODAL
       Only rendered when UA matches iPhone/iPad/iPod/Android
       Desktop layout is completely unaffected by these rules.
       ═══════════════════════════════════════════════════════ */

    .roearn-mobile-cart-fab {
      position: fixed;
      bottom: 24px;
      right: 20px;
      width: 62px;
      height: 62px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      background: linear-gradient(90deg, #6bb5ff, #a66bff, #d66bff, #ff6bbd, #d66bff, #a66bff, #6bb5ff);
      background-size: 200% 100%;
      animation: rainbow-flow 6s ease-in-out infinite;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 9990;
      transition: transform 0.15s ease;
    }

    .roearn-mobile-cart-fab:active {
      transform: scale(0.93);
    }

    .roearn-mobile-cart-fab svg {
      width: 30px;
      height: 30px;
      fill: white;
      filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
    }

    .roearn-mobile-cart-fab-badge {
      position: absolute;
      top: -2px;
      right: -2px;
      min-width: 20px;
      height: 20px;
      padding: 0 5px;
      border-radius: 10px;
      background: white;
      color: #a66bff;
      font-size: 12px;
      font-weight: bold;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25);
      border: 2px solid rgba(255,255,255,0.8);
    }

    .roearn-mobile-cart-fab-badge.hidden {
      display: none;
    }

    /* PC FAB modal — unconstrained width so item names never truncate */
    .roearn-pc-modal {
      width: max-content;
      max-width: 90vw;
    }

    .roearn-pc-modal .roearn-cart-item-name {
      white-space: normal;
      overflow: visible;
      text-overflow: unset;
    }

    .roearn-mobile-cart-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.6);
      z-index: 9995;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      box-sizing: border-box;
    }

    .roearn-mobile-cart-modal {
      width: 100%;
      max-width: 420px;
      max-height: 85vh;
      background: white;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.35);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .dark-theme .roearn-mobile-cart-modal {
      background: #232527;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.6);
    }
  `;
  document.head.appendChild(style);

  const cartSvg = `<svg viewBox="0 0 902.86 902.86" style="transform: scaleX(-1);"><path d="M671.504,577.829l110.485-432.609H902.86v-68H729.174L703.128,179.2L0,178.697l74.753,399.129h596.751V577.829z M685.766,247.188l-67.077,262.64H131.199L81.928,246.756L685.766,247.188z"/><path d="M578.418,825.641c59.961,0,108.743-48.783,108.743-108.744s-48.782-108.742-108.743-108.742H168.717 c-59.961,0-108.744,48.781-108.744,108.742s48.782,108.744,108.744,108.744c59.962,0,108.743-48.783,108.743-108.744 c0-14.4-2.821-28.152-7.927-40.742h208.069c-5.107,12.59-7.928,26.342-7.928,40.742 C469.675,776.858,518.457,825.641,578.418,825.641z M209.46,716.897c0,22.467-18.277,40.744-40.743,40.744 c-22.466,0-40.744-18.277-40.744-40.744c0-22.465,18.277-40.742,40.744-40.742C191.183,676.155,209.46,694.432,209.46,716.897z M619.162,716.897c0,22.467-18.277,40.744-40.743,40.744s-40.743-18.277-40.743-40.744c0-22.465,18.277-40.742,40.743-40.742 S619.162,694.432,619.162,716.897z"/></svg>`;

  let cartIconContainer = null;
  let badge = null;
  let popup = null;
  let overlay = null;
  let selectedItems = new Set();
  let isInitializing = false;

  let mobileFab = null;
  let mobileFabBadge = null;
  let mobileModal = null;
  let mobileModalOverlay = null;

  function createMobileFab() {
    mobileFab = document.createElement('button');
    mobileFab.className = 'roearn-mobile-cart-fab';
    if (!isMobileDevice) {
      mobileFab.classList.add('roearn-pc-fab');
    }
    mobileFab.innerHTML = cartSvg;

    mobileFabBadge = document.createElement('div');
    mobileFabBadge.className = 'roearn-mobile-cart-fab-badge hidden';
    mobileFabBadge.textContent = '0';
    mobileFab.appendChild(mobileFabBadge);

    mobileFab.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleMobileModal();
    });

    document.body.appendChild(mobileFab);
  }

  async function updateMobileBadge() {
    if (!mobileFabBadge) return;
    const cart = await getCart();
    const count = cart.length;
    mobileFabBadge.textContent = count.toString();
    if (count > 0) {
      mobileFabBadge.classList.remove('hidden');
    } else {
      mobileFabBadge.classList.add('hidden');
    }
  }

  function closeMobileModal() {
    if (mobileModal) { mobileModal.remove(); mobileModal = null; }
    if (mobileModalOverlay) { mobileModalOverlay.remove(); mobileModalOverlay = null; }
  }

  function destroyMobileFab() {
    closeMobileModal();
    if (mobileFab) { mobileFab.remove(); mobileFab = null; }
    mobileFabBadge = null;
  }

  async function openMobileModal() {
    const cart = await getCart();
    const selectionStates = await getSelectionStates();

    selectedItems = new Set();
    for (const item of cart) {
      const assetIdStr = String(item.assetId);
      if (selectionStates.hasOwnProperty(assetIdStr)) {
        if (selectionStates[assetIdStr] === true) selectedItems.add(item.assetId);
      } else {
        selectedItems.add(item.assetId);
        await setItemSelectionState(item.assetId, true);
      }
    }

    mobileModalOverlay = document.createElement('div');
    mobileModalOverlay.className = 'roearn-mobile-cart-modal-overlay';
    mobileModalOverlay.addEventListener('click', closeMobileModal);

    mobileModal = document.createElement('div');
    mobileModal.className = 'roearn-mobile-cart-modal' + (!isMobileDevice ? ' roearn-pc-modal' : '');
    mobileModal.addEventListener('click', (e) => e.stopPropagation());

    mobileModalOverlay.appendChild(mobileModal);
    document.body.appendChild(mobileModalOverlay);

    await renderMobileModalContent(cart);
  }

  async function renderMobileModalContent(cart) {
    if (!mobileModal) return;

    const totalItems = cart.filter(item => selectedItems.has(item.assetId)).length;
    const totalPrice = cart.filter(item => selectedItems.has(item.assetId)).reduce((sum, item) => sum + item.assetPrice, 0);
    const totalEarn = cart.filter(item => selectedItems.has(item.assetId)).reduce((sum, item) => sum + item.earnAmount, 0);

    const cartTitle = getMessage('cartTitle', cart.length.toString());
    const cartEmpty = getMessage('cartEmpty');
    const cartRemove = getMessage('cartRemove');
    const cartTotalText = totalItems === 1
      ? getMessage('cartTotal', totalItems.toString())
      : getMessage('cartTotalPlural', totalItems.toString());
    const buyBtnText = getMessage('catalogBuyBtn', `<span class="icon-robux-16x16"></span> ${formatNumber(totalEarn)}`);

    mobileModal.innerHTML = `
      <div class="roearn-cart-popup-header" style="display:flex;align-items:center;justify-content:space-between;padding-right:16px;">
        <span>${cartTitle}</span>
        <button style="background:none;border:none;font-size:26px;cursor:pointer;color:#9ca3af;line-height:1;padding:0;" id="roearn-mobile-modal-close">×</button>
      </div>
      <div class="roearn-cart-popup-items">
        ${cart.length === 0 ? `<div class="roearn-cart-popup-empty">${cartEmpty}</div>` : cart.map(item => {
          const itemUrl = item.assetType === 'bundle'
            ? `https://www.roblox.com/bundles/${item.assetId}/`
            : `https://www.roblox.com/catalog/${item.assetId}/`;
          return `
            <div class="roearn-cart-item" data-asset-id="${item.assetId}">
              <input type="checkbox" class="roearn-cart-item-checkbox" ${selectedItems.has(item.assetId) ? 'checked' : ''}>
              <img class="roearn-cart-item-thumb" src="${item.thumbnail}" alt="${item.assetName}">
              <div class="roearn-cart-item-info">
                <a href="${itemUrl}" class="roearn-cart-item-name" title="${item.assetName}">${item.assetName}</a>
                <div class="roearn-cart-item-price"><span class="icon-robux-16x16"></span> ${formatNumber(item.assetPrice)}</div>
              </div>
              <button class="roearn-cart-item-remove" title="${cartRemove}">×</button>
            </div>`;
        }).join('')}
      </div>
      <div class="roearn-cart-popup-footer">
        <div class="roearn-cart-total">
          <span>${cartTotalText}</span>
          <span class="roearn-cart-total-price"><span class="icon-robux-16x16"></span> ${formatNumber(totalPrice)}</span>
        </div>
        <button class="roearn-cart-buy-btn" ${totalItems === 0 ? 'disabled' : ''}>${buyBtnText}</button>
      </div>
    `;

    mobileModal.querySelector('#roearn-mobile-modal-close').addEventListener('click', closeMobileModal);

    mobileModal.querySelectorAll('.roearn-cart-item-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const assetId = e.target.closest('.roearn-cart-item').dataset.assetId;
        if (e.target.checked) {
          if (selectedItems.size >= CART_MAX_ITEMS) {
            e.target.checked = false;
            showCartLimitToast();
            return;
          }
          selectedItems.add(assetId);
        } else { selectedItems.delete(assetId); }
        await setItemSelectionState(assetId, e.target.checked);
        const currentCart = await getCart();
        await renderMobileModalContent(currentCart);
      });
    });

    mobileModal.querySelectorAll('.roearn-cart-item-name').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = link.getAttribute('href');
        closeMobileModal();
        window.location.href = url;
      });
    });

    mobileModal.querySelectorAll('.roearn-cart-item-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const assetId = e.target.closest('.roearn-cart-item').dataset.assetId;
        selectedItems.delete(assetId);
        const newCart = await removeFromCart(assetId);
        await renderMobileModalContent(newCart);
        await updateMobileBadge();
      });
    });

    mobileModal.querySelector('.roearn-cart-buy-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const itemsToBuy = cart.filter(item => selectedItems.has(item.assetId));
      if (itemsToBuy.length === 0) return;
      closeMobileModal();
      try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (err) {}
      window.dispatchEvent(new CustomEvent('roearn:showBulkCheckout', {
        detail: JSON.stringify({ items: itemsToBuy, userId: String(itemsToBuy[0].userId) })
      }));
    });
  }

  async function toggleMobileModal() {
    if (mobileModal) { closeMobileModal(); } else { await openMobileModal(); }
  }

  function createCartIcon() {
    cartIconContainer = document.createElement('div');
    cartIconContainer.className = 'roearn-navbar-cart';
    cartIconContainer.innerHTML = cartSvg;
    
    badge = document.createElement('div');
    badge.className = 'roearn-cart-badge hidden';
    badge.textContent = '0';
    cartIconContainer.appendChild(badge);
    
    cartIconContainer.addEventListener('click', (e) => {
      e.stopPropagation();
      togglePopup();
    });
    
    updateCartVisibility();
    
    return cartIconContainer;
  }

  function updateCartVisibility() {
    if (!cartIconContainer) return;
    
    if (shouldShowCart()) {
      cartIconContainer.classList.remove('hidden');
    } else {
      cartIconContainer.classList.add('hidden');
      closePopup();
    }
  }

  async function updateBadge() {
    const cart = await getCart();
    const count = cart.length;
    
    if (badge) {
      badge.textContent = count.toString();
      if (count > 0) {
        badge.classList.remove('hidden');
      } else {
        badge.classList.add('hidden');
      }
    }
  }

  async function togglePopup() {
    if (popup) {
      closePopup();
    } else {
      await openPopup();
    }
  }

  function closePopup() {
    if (popup) {
      popup.remove();
      popup = null;
    }
    if (overlay) {
      overlay.remove();
      overlay = null;
    }
    if (cartIconContainer) {
      cartIconContainer.classList.remove('popup-open');
    }
  }

  async function openPopup() {
    const cart = await getCart();
    
    const selectionStates = await getSelectionStates();
    
    selectedItems = new Set();
    for (const item of cart) {
      const assetIdStr = String(item.assetId);
      if (selectionStates.hasOwnProperty(assetIdStr)) {
        if (selectionStates[assetIdStr] === true) {
          selectedItems.add(item.assetId);
        }
      } else {
        selectedItems.add(item.assetId);
        await setItemSelectionState(item.assetId, true);
      }
    }
    
    if (cartIconContainer) {
      cartIconContainer.classList.add('popup-open');
    }
    
    overlay = document.createElement('div');
    overlay.className = 'roearn-cart-popup-overlay';
    overlay.addEventListener('click', closePopup);
    document.body.appendChild(overlay);
    
    popup = document.createElement('div');
    popup.className = 'roearn-cart-popup';
    
    await renderPopupContent(cart);
    
    cartIconContainer.appendChild(popup);
  }

  async function renderPopupContent(cart) {
    if (!popup) return;
    
    const totalItems = cart.filter(item => selectedItems.has(item.assetId)).length;
    const totalPrice = cart
      .filter(item => selectedItems.has(item.assetId))
      .reduce((sum, item) => sum + item.assetPrice, 0);
    const totalEarn = cart
      .filter(item => selectedItems.has(item.assetId))
      .reduce((sum, item) => sum + item.earnAmount, 0);
    
    const cartTitle = getMessage('cartTitle', cart.length.toString());
    const cartEmpty = getMessage('cartEmpty');
    const cartRemove = getMessage('cartRemove');
    const cartTotalText = totalItems === 1 
      ? getMessage('cartTotal', totalItems.toString())
      : getMessage('cartTotalPlural', totalItems.toString());
    const buyBtnText = getMessage('catalogBuyBtn', `<span class="icon-robux-16x16"></span> ${formatNumber(totalEarn)}`);
    
    popup.innerHTML = `
      <div class="roearn-cart-popup-header">
        ${cartTitle}
      </div>
      <div class="roearn-cart-popup-items">
        ${cart.length === 0 ? `
          <div class="roearn-cart-popup-empty">
            ${cartEmpty}
          </div>
        ` : cart.map(item => {
          const itemUrl = item.assetType === 'bundle' 
            ? `https://www.roblox.com/bundles/${item.assetId}/`
            : `https://www.roblox.com/catalog/${item.assetId}/`;
          return `
          <div class="roearn-cart-item" data-asset-id="${item.assetId}">
            <input type="checkbox" class="roearn-cart-item-checkbox" ${selectedItems.has(item.assetId) ? 'checked' : ''}>
            <img class="roearn-cart-item-thumb" src="${item.thumbnail}" alt="${item.assetName}">
            <div class="roearn-cart-item-info">
              <a href="${itemUrl}" class="roearn-cart-item-name" title="${item.assetName}">${item.assetName}</a>
              <div class="roearn-cart-item-price"><span class="icon-robux-16x16"></span> ${formatNumber(item.assetPrice)}</div>
            </div>
            <button class="roearn-cart-item-remove" title="${cartRemove}">×</button>
          </div>
        `}).join('')}
      </div>
      <div class="roearn-cart-popup-footer">
        <div class="roearn-cart-total">
          <span>${cartTotalText}</span>
          <span class="roearn-cart-total-price"><span class="icon-robux-16x16"></span> ${formatNumber(totalPrice)}</span>
        </div>
        <button class="roearn-cart-buy-btn" ${totalItems === 0 ? 'disabled' : ''}>${buyBtnText}</button>
      </div>
    `;
    
    popup.querySelectorAll('.roearn-cart-item-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', async (e) => {
        const assetId = e.target.closest('.roearn-cart-item').dataset.assetId;
        if (e.target.checked) {
          if (selectedItems.size >= CART_MAX_ITEMS) {
            e.target.checked = false;
            showCartLimitToast();
            return;
          }
          selectedItems.add(assetId);
        } else {
          selectedItems.delete(assetId);
        }
        await setItemSelectionState(assetId, e.target.checked);
        const currentCart = await getCart();
        await renderPopupContent(currentCart);
      });
    });
    
    popup.querySelectorAll('.roearn-cart-item-name').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const url = link.getAttribute('href');
        closePopup();
        window.location.href = url;
      });
    });
    
    popup.querySelectorAll('.roearn-cart-item-remove').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const assetId = e.target.closest('.roearn-cart-item').dataset.assetId;
        selectedItems.delete(assetId);
        const newCart = await removeFromCart(assetId);
        await renderPopupContent(newCart);
        await updateBadge();
      });
    });
    
    popup.querySelector('.roearn-cart-buy-btn')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      
      const itemsToBuy = cart.filter(item => selectedItems.has(item.assetId));
      if (itemsToBuy.length === 0) return;
      
      closePopup();
      
      try {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } catch (err) {}
      
      window.dispatchEvent(new CustomEvent('roearn:showBulkCheckout', {
        detail: JSON.stringify({
          items: itemsToBuy,
          userId: String(itemsToBuy[0].userId)
        })
      }));
    });
    
    popup.addEventListener('click', (e) => e.stopPropagation());
  }

  async function init() {
    if (isMobileDevice) {
      if (!shouldShowCart()) {
        destroyMobileFab();
        return;
      }
      if (mobileFab) return;
      createMobileFab();
      await updateMobileBadge();

      window.addEventListener('roearn:cartUpdated', async () => {
        await updateMobileBadge();
        if (mobileModal) {
          const cart = await getCart();
          await renderMobileModalContent(cart);
        }
      });

      window.addEventListener('roearn:removeFromCart', async (e) => {
        const { assetId, assetIds } = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
        if (assetIds && Array.isArray(assetIds)) {
          for (const id of assetIds) await removeFromCart(id);
        } else if (assetId) {
          await removeFromCart(assetId);
        }
        await updateMobileBadge();
        if (mobileModal) {
          const cart = await getCart();
          await renderMobileModalContent(cart);
        }
      });

      api.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.roearnCart) {
          updateMobileBadge();
          if (mobileModal) {
            getCart().then(cart => renderMobileModalContent(cart));
          }
        }
      });

      return;
    }

    if (isPcItemPage()) {
      destroyMobileFab();
      return;
    }
    if (!mobileFab && shouldShowCart()) {
      createMobileFab();
      await updateMobileBadge();

      window.addEventListener('roearn:cartUpdated', async () => {
        await updateMobileBadge();
        if (mobileModal) {
          const cart = await getCart();
          await renderMobileModalContent(cart);
        }
      });

      window.addEventListener('roearn:removeFromCart', async (e) => {
        const { assetId, assetIds } = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
        if (assetIds && Array.isArray(assetIds)) {
          for (const id of assetIds) await removeFromCart(id);
        } else if (assetId) {
          await removeFromCart(assetId);
        }
        await updateMobileBadge();
        if (mobileModal) {
          const cart = await getCart();
          await renderMobileModalContent(cart);
        }
      });

      api.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.roearnCart) {
          updateMobileBadge();
          if (mobileModal) {
            getCart().then(cart => renderMobileModalContent(cart));
          }
        }
      });
    }

    if (document.querySelector('.roearn-navbar-cart') || isInitializing) {
      return;
    }

    isInitializing = true;
    
    try {
      const waitForRight = () => {
        return new Promise((resolve) => {
          const checkElement = () => {
            const rightContainer = document.querySelector('.right');
            if (rightContainer) {
              resolve(rightContainer);
            } else {
              setTimeout(checkElement, 100);
            }
          };
          checkElement();
        });
      };
      
      const rightContainer = await waitForRight();
      
      if (document.querySelector('.roearn-navbar-cart')) {
        return;
      }
      
      const robloxCart = rightContainer.querySelector('.shopping-cart-btn-container');
      
      const ourCart = createCartIcon();
      
      if (robloxCart) {
        robloxCart.parentNode.insertBefore(ourCart, robloxCart);
      } else {
        rightContainer.insertBefore(ourCart, rightContainer.firstChild);
      }
    
    await updateBadge();
    
    window.addEventListener('roearn:cartUpdated', async () => {
      await updateBadge();
      if (popup) {
        const cart = await getCart();
        await renderPopupContent(cart);
      }
    });
    
    window.addEventListener('roearn:removeFromCart', async (e) => {
      const { assetId, assetIds } = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
      
      if (assetIds && Array.isArray(assetIds)) {
        for (const id of assetIds) {
          await removeFromCart(id);
        }
      }
      else if (assetId) {
        await removeFromCart(assetId);
      }
      
      await updateBadge();
      if (popup) {
        const cart = await getCart();
        await renderPopupContent(cart);
      }
    });
    
    api.storage.onChanged.addListener((changes, namespace) => {
      if (namespace === 'local' && changes.roearnCart) {
        updateBadge();
        if (popup) {
          getCart().then(cart => renderPopupContent(cart));
        }
      }
    });
    } finally {
      isInitializing = false;
    }
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;

      if (isMobileDevice) {
        if (shouldShowCart()) {
          closeMobileModal();
          if (!mobileFab) init();
        } else {
          destroyMobileFab();
        }
        return;
      }

      if (isPcItemPage() || !shouldShowCart()) {
        destroyMobileFab();
      } else {
        closeMobileModal();
      }

      updateCartVisibility();
      
      if (shouldShowCart()) {
        closePopup();
        
        const existingCart = document.querySelector('.roearn-navbar-cart');
        if (existingCart) {
          existingCart.remove();
        }
        
        cartIconContainer = null;
        badge = null;
        isInitializing = false;
        
        setTimeout(() => {
          init();
        }, 100);
      }
    }
  }).observe(document, { subtree: true, childList: true });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.addEventListener('roearn:fabDestroyed', () => {
    mobileFab = null;
    mobileFabBadge = null;
  });
})();