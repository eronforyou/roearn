(async function() {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  let cachedMessages = null;
  let messagesPromise = null;

  const CART_MAX_ITEMS = 30;

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

  async function isInCart(assetId) {
    const cart = await getCart();
    return cart.some(item => item.assetId === assetId);
  }

  async function addToCart(item) {
    const cart = await getCart();

    const enabledCount = await new Promise((resolve) => {
      api.storage.local.get(['roearnSelectionStates'], (result) => {
        const states = result.roearnSelectionStates || {};
        const count = Object.values(states).filter(v => v === true).length;
        resolve(count);
      });
    });

    const alreadyInCart = cart.some(i => i.assetId === item.assetId);
    if (!alreadyInCart && enabledCount >= CART_MAX_ITEMS) {
      showCartLimitToast();
      return cart;
    }

    if (!alreadyInCart) {
      cart.push(item);
      await saveCart(cart);
      const selected = await getSelectedItems();
      if (!selected.includes(item.assetId)) {
        selected.push(item.assetId);
        await saveSelectedItems(selected);
      }

      await new Promise((resolve) => {
        api.storage.local.get(['roearnSelectionStates'], (result) => {
          const states = result.roearnSelectionStates || {};
          states[String(item.assetId)] = true;
          api.storage.local.set({ roearnSelectionStates: states }, resolve);
        });
      });
      window.dispatchEvent(new CustomEvent('roearn:cartUpdated', { detail: { cart } }));
    }
    return cart;
  }

  async function getSelectedItems() {
    return new Promise((resolve) => {
      api.storage.local.get(['roearnSelectedItems'], (result) => {
        resolve(result.roearnSelectedItems || []);
      });
    });
  }

  async function saveSelectedItems(items) {
    return new Promise((resolve) => {
      api.storage.local.set({ roearnSelectedItems: Array.isArray(items) ? items : Array.from(items) }, resolve);
    });
  }

  async function removeFromCart(assetId) {
    let cart = await getCart();
    cart = cart.filter(item => item.assetId !== assetId);
    await saveCart(cart);
    const selected = await getSelectedItems();
    const filtered = selected.filter(id => id !== assetId);
    await saveSelectedItems(filtered);
    window.dispatchEvent(new CustomEvent('roearn:cartUpdated', { detail: { cart } }));
    return cart;
  }

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
  style.textContent = `
    @keyframes rainbow-flow {
      0% {
        background-position: 0% 50%;
      }
      50% {
        background-position: 100% 50%;
      }
      100% {
        background-position: 0% 50%;
      }
    }
    
    .btn-container:not([data-roearn-added="true"]) {
      display: none !important;
    }
    
    .btn-container[data-roearn-not-eligible="true"] {
      display: block !important;
    }
    
    .roearn-cart-button {
      height: 40px;
      padding: 0 20px;
      border: none;
      border-radius: 20px;
      font-size: 16px;
      font-weight: bold;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: #3d3d3d;
      color: white;
      white-space: nowrap;
    }
    
    .roearn-cart-button svg {
      fill: white;
      margin-top: -2px;
    }
    
    .dark-theme .roearn-cart-button {
      background: white;
      color: #272930;
    }
    
    .dark-theme .roearn-cart-button svg {
      fill: #272930;
    }
    
    .roearn-cart-container {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }
  `;
  document.head.appendChild(style);

  let _cartLimitToastTimer = null;

  function showCartLimitToast() {
    const existing = document.getElementById('roearn-limit-toast');
    if (existing) {
      clearTimeout(_cartLimitToastTimer);
      existing.remove();
    }

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
      position: fixed;
      bottom: 32px;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2147483647;
      background: #1a1a1a;
      border: 1px solid #333;
      border-radius: 14px;
      padding: 20px 24px;
      max-width: 380px;
      width: calc(100% - 40px);
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      box-shadow: 0 8px 40px rgba(0,0,0,0.6);
      pointer-events: none;
      animation: roearn-toast-in 0.25s ease forwards;
      font-family: sans-serif;
    `;

    const title = document.createElement('p');
    title.textContent = getMessage('cartLimitTitle', [CART_MAX_ITEMS.toString()]);
    title.style.cssText = `
      margin: 0;
      color: #e0e0e0;
      font-size: 15px;
      font-weight: 700;
      text-align: center;
      line-height: 1.3;
    `;

    const body = document.createElement('p');
    body.textContent = getMessage('cartLimitBody', [CART_MAX_ITEMS.toString()]);
    body.style.cssText = `
      margin: 0;
      color: #999;
      font-size: 13px;
      text-align: center;
      line-height: 1.6;
    `;

    toast.appendChild(title);
    toast.appendChild(body);
    document.documentElement.appendChild(toast);

    _cartLimitToastTimer = setTimeout(() => {
      toast.style.animation = 'roearn-toast-out 0.2s ease forwards';
      toast.addEventListener('animationend', () => toast.remove(), { once: true });
    }, 4500);
  }

function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function getAuthenticatedUserId() {
  try {
    const response = await fetch('https://users.roblox.com/v1/users/authenticated', {
      credentials: 'include'
    });
    
    if (!response.ok) {
      return null;
    }
    
    const data = await response.json();
    return data.id;
  } catch (error) {
    return null;
  }
}

function waitForElement(selector, signal = null) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Aborted'));
      return;
    }
    
    const element = document.querySelector(selector);
    if (element) {
      resolve(element);
      return;
    }

    const observer = new MutationObserver((mutations) => {
      const element = document.querySelector(selector);
      if (element) {
        observer.disconnect();
        resolve(element);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    if (signal) {
      signal.addEventListener('abort', () => {
        observer.disconnect();
        reject(new Error('Aborted'));
      });
    }
  });
}

let isAddingButton = false;
let currentAbortController = null;

async function duplicatePurchaseButton() {
  if (isAddingButton) {
    return;
  }
  
  try {
    isAddingButton = true;
    
    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;
    const catalogItemPattern = /^\/(?:[a-z]{2}\/)?catalog\/\d+\//;
    const bundlePattern = /^\/(?:[a-z]{2}\/)?bundles\/\d+\//;
    const isCatalogItem = catalogItemPattern.test(window.location.pathname);
    const isBundle = bundlePattern.test(window.location.pathname);
    
    if (!isCatalogItem && !isBundle) {
      return;
    }
    
    if (document.querySelector('.roearn-cashback-button') || 
        document.querySelector('.roearn-not-eligible') ||
        document.querySelector('.btn-container[data-roearn-added="true"]')) {
      return;
    }
    
    
    const catalogMatch = window.location.pathname.match(/^\/(?:[a-z]{2}\/)?catalog\/(\d+)\//);
    const bundleMatch = window.location.pathname.match(/^\/(?:[a-z]{2}\/)?bundles\/(\d+)\//);

    let itemId;
    if (catalogMatch) {
      itemId = catalogMatch[1];
    } else if (bundleMatch) {
      itemId = bundleMatch[1];
    } else {
      return;
    }
    const itemType = isBundle ? 'Bundle' : 'Asset';
    
    const userId = await getAuthenticatedUserId();
    if (!userId) {
      return;
    }
    
    let itemPrice = null;
    let cashbackAmount = 0;
    let assetType = null;
    let cashbackRate = 0.10;
    let minCashback = 2;
    let minPrice = 20;
    let itemName = 'Unknown Item';
    let itemThumbnail = '';
    let ineligibilityReason = null;
    
    try {
      const response = await fetch(`https://catalog.roblox.com/v1/catalog/items/${itemId}/details?itemType=${itemType}`, {
        credentials: 'include'
      });     
      
      const data = await response.json();

      if (data.isOffSale === true) {
          ineligibilityReason = 'off-sale';
          itemPrice = data.lowestPrice || data.price || 0;
      }
      
      if (data.priceStatus !== 'Off Sale' && data.lowestPrice !== undefined && data.lowestPrice !== null) {
        assetType = data.assetType;
        itemName = data.name || 'Unknown Item';

        
        const isLimitedItem = data.itemRestrictions && data.itemRestrictions.length > 0;
        
        const isRobloxCreated = data.creatorTargetId === 1;
        const hasLimitedRestriction = data.itemRestrictions && 
                                      data.itemRestrictions.some(restriction => 
                                        restriction.includes('Limited')
                                      );
        
        const hasCollectibleRestriction = data.itemRestrictions && 
                                          data.itemRestrictions.includes('Collectible');
        
        const isLiveItem = data.itemRestrictions && 
                           data.itemRestrictions.includes('Live');
        
        if (isRobloxCreated && (hasLimitedRestriction || hasCollectibleRestriction)) {
          ineligibilityReason = 'roblox-limited';
          itemPrice = data.lowestPrice || 0;
        } else if (isLiveItem) {
          itemPrice = data.lowestPrice;
          cashbackRate = 0.10;
          minPrice = 20;
        } else if (isLimitedItem) {
          itemPrice = data.lowestPrice;
          
          const unitsAvailable = data.unitsAvailableForConsumption || 0;
          if (unitsAvailable === 0) {
            cashbackRate = 0.05;
            minPrice = 20;
          }
        } else {
          itemPrice = data.lowestPrice;
        }
        
        if (!isLiveItem && (assetType === 2 || assetType === 11 || assetType === 12)) {
          cashbackRate = 0.05;
          minPrice = 40;
        }

        if (data.saleLocationType && data.saleLocationType !== 'ShopAndAllExperiences') {
          ineligibilityReason = 'not-in-game';
        }

        if (!ineligibilityReason) {
          const percentage = itemPrice * cashbackRate;
          const baseAmount = Math.max(percentage, 2);
          
          cashbackAmount = Math.floor(baseAmount * 0.70);
        }
      }
    } catch (error) {
      return;
    }
    
    try {
      let thumbnailUrl;
      if (isBundle) {
        thumbnailUrl = `https://thumbnails.roblox.com/v1/bundles/thumbnails?bundleIds=${itemId}&format=png&isCircular=false&size=420x420`;
      } else {
        thumbnailUrl = `https://thumbnails.roblox.com/v1/assets?assetIds=${itemId}&format=png&isCircular=false&size=420x420`;
      }
      
      const thumbnailResponse = await fetch(thumbnailUrl);
      const thumbnailData = await thumbnailResponse.json();
      
      if (thumbnailData.data && thumbnailData.data.length > 0 && thumbnailData.data[0].imageUrl) {
        itemThumbnail = thumbnailData.data[0].imageUrl;
      }
    } catch (error) {
    }
    
    if (itemPrice === null) {
      isAddingButton = false;
      return;
    }
    
    const isEligible = !ineligibilityReason && itemPrice >= minPrice;
    
    const btnContainer = await waitForElement('.btn-container', signal);

    const clonedContainer = btnContainer.cloneNode(true);
    
    clonedContainer.setAttribute('data-roearn-added', 'true');
    
    clonedContainer.style.marginBottom = '10px';
    
    const clonedButton = clonedContainer.querySelector('.PurchaseButton');
    if (clonedButton) {
      
      if (!isEligible) {
        btnContainer.setAttribute('data-roearn-not-eligible', 'true');
        
        const infoIcon = document.createElement('span');
        infoIcon.className = 'info-icon';
        infoIcon.textContent = 'i';
        infoIcon.style.cssText = `
          display: inline-block;
          margin-left: 8px;
          width: 18px;
          height: 18px;
          border: 2px solid white;
          border-radius: 50%;
          text-align: center;
          line-height: 14px;
          font-size: 13px;
          font-style: normal;
          font-weight: bold;
          vertical-align: baseline;
          position: relative;
          top: 0px;
          cursor: help;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
        `;
        
        const tooltipContainer = document.createElement('div');
        tooltipContainer.style.cssText = `
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          margin-bottom: 10px;
          z-index: 10000;
          pointer-events: none;
        `;
        
        const tooltip = document.createElement('div');
        tooltip.className = 'roearn-tooltip';
        
        if (ineligibilityReason === 'roblox-limited') {
          tooltip.textContent = getMessage("tooltipRobloxLimited");
        } else if (ineligibilityReason === 'not-in-game') {
          tooltip.textContent = getMessage("tooltipNotInGame");
        } else if (ineligibilityReason === 'off-sale') {
          tooltip.textContent = getMessage("tooltipOffSale");
        } else {
          tooltip.textContent = getMessage("tooltipPriceTooLow", [minPrice.toString()]);
        }
        
        tooltip.style.cssText = `
          visibility: hidden;
          opacity: 0;
          background-color: rgba(0, 0, 0, 0.9);
          color: white;
          padding: 10px 15px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: normal;
          white-space: normal;
          width: max-content;
          max-width: 300px;
          text-align: center;
          transition: opacity 0.2s, visibility 0.2s;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        
        const arrow = document.createElement('div');
        arrow.style.cssText = `
          position: absolute;
          bottom: -5px;
          left: 50%;
          transform: translateX(-50%);
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-top: 6px solid rgba(0, 0, 0, 0.9);
        `;
        tooltip.appendChild(arrow);
        tooltipContainer.appendChild(tooltip);
        
        infoIcon.addEventListener('mouseenter', () => {
          tooltip.style.visibility = 'visible';
          tooltip.style.opacity = '1';
          
          setTimeout(() => {
            const tooltipRect = tooltip.getBoundingClientRect();
            const containerRect = clonedButton.getBoundingClientRect();
            
            if (tooltipRect.left < 10) {
              tooltipContainer.style.left = `${10 - containerRect.left}px`;
              tooltipContainer.style.transform = 'none';
              arrow.style.left = `${containerRect.left + (containerRect.width / 2) - 10}px`;
            } else if (tooltipRect.right > window.innerWidth - 10) {
              tooltipContainer.style.left = 'auto';
              tooltipContainer.style.right = '10px';
              tooltipContainer.style.transform = 'none';
              arrow.style.left = 'auto';
              arrow.style.right = `${window.innerWidth - containerRect.right + (containerRect.width / 2) - 10}px`;
            }
          }, 0);
        });
        
        infoIcon.addEventListener('mouseleave', () => {
          tooltip.style.visibility = 'hidden';
          tooltip.style.opacity = '0';
        });
        
        clonedButton.textContent = getMessage("notEligibleForCashback") + ' ';
        clonedButton.appendChild(infoIcon);
        clonedButton.style.position = 'relative';
        clonedButton.appendChild(tooltipContainer);
        clonedButton.classList.add('roearn-not-eligible');
        
        clonedButton.style.background = '#6c757d';
        clonedButton.style.height = '52px';
        clonedButton.style.border = 'none';
        clonedButton.style.color = 'white';
        clonedButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5)';
        clonedButton.style.fontWeight = 'bold';
        clonedButton.style.cursor = 'not-allowed';
        clonedButton.style.display = 'flex';
        clonedButton.style.alignItems = 'center';
        clonedButton.style.justifyContent = 'center';
        
        clonedButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
        });
        
      } else {
        const originalIcon = document.querySelector('.icon-robux-16x16');
        const robuxIcon = originalIcon ? originalIcon.cloneNode(true) : document.createElement('span');
        if (originalIcon) {
          robuxIcon.style.display = 'inline-block';
          robuxIcon.style.marginLeft = '2px';
          robuxIcon.style.marginRight = '0px';
          robuxIcon.style.filter = 'brightness(0) invert(1) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5)) drop-shadow(0 0 8px rgba(0, 0, 0, 0.3))';
        }
        
        const formattedCashback = formatNumber(cashbackAmount);
        
        const rawTemplate = cachedMessages?.catalogBuyBtn?.message || "Buy with RoEarn (Earn $1)";
        const parts = rawTemplate.split("$1");
        
        clonedButton.textContent = '';
        clonedButton.appendChild(document.createTextNode(parts[0]));
        clonedButton.appendChild(robuxIcon);
        clonedButton.appendChild(document.createTextNode(" " + formattedCashback + (parts[1] || "")));
        clonedButton.classList.add('roearn-cashback-button');
        
        clonedButton.style.background = `linear-gradient(90deg, 
          #6bb5ff, 
          #a66bff, 
          #d66bff, 
          #ff6bbd,
          #d66bff,
          #a66bff,
          #6bb5ff
        )`;
        clonedButton.style.backgroundSize = '200% 100%';
        clonedButton.style.animation = 'rainbow-flow 6s ease-in-out infinite';
        clonedButton.style.height = '52px';
        clonedButton.style.border = 'none';
        clonedButton.style.color = 'white';
        clonedButton.style.textShadow = '0 1px 2px rgba(0, 0, 0, 0.5), 0 0 8px rgba(0, 0, 0, 0.3)';
        clonedButton.style.fontWeight = 'bold';
        clonedButton.style.display = 'flex';
        clonedButton.style.alignItems = 'center';
        clonedButton.style.justifyContent = 'center';
        clonedButton.style.fontSize = '20px';
        
        clonedButton.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          e.stopImmediatePropagation();
          
          try {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          } catch (err) {}
          
          if (!itemThumbnail) {
            return;
          }
          
          const finalAssetType = isBundle ? 'bundle' : 'accessory';
          
          window.dispatchEvent(new CustomEvent('roearn:showCheckout', {
            detail: JSON.stringify({
              thumbnail: itemThumbnail,
              assetName: itemName,
              assetId: itemId,
              assetType: finalAssetType,
              userId: String(userId),
              earnAmount: cashbackAmount,
              assetPrice: itemPrice
            })
          }));
        }, true);
      }
    }

    btnContainer.parentNode.insertBefore(clonedContainer, btnContainer);

    if (isEligible) {
      const cartWrapper = document.createElement('div');
      cartWrapper.className = 'roearn-cart-container';
      cartWrapper.setAttribute('data-roearn-added', 'true');
      
      const cartButton = document.createElement('button');
      cartButton.className = 'roearn-cart-button';
      cartButton.type = 'button';
      
      const cartSvg = `<svg width="20" height="20" viewBox="0 0 902.86 902.86" style="vertical-align: middle; transform: scaleX(-1);"><path d="M671.504,577.829l110.485-432.609H902.86v-68H729.174L703.128,179.2L0,178.697l74.753,399.129h596.751V577.829z M685.766,247.188l-67.077,262.64H131.199L81.928,246.756L685.766,247.188z"/><path d="M578.418,825.641c59.961,0,108.743-48.783,108.743-108.744s-48.782-108.742-108.743-108.742H168.717 c-59.961,0-108.744,48.781-108.744,108.742s48.782,108.744,108.744,108.744c59.962,0,108.743-48.783,108.743-108.744 c0-14.4-2.821-28.152-7.927-40.742h208.069c-5.107,12.59-7.928,26.342-7.928,40.742 C469.675,776.858,518.457,825.641,578.418,825.641z M209.46,716.897c0,22.467-18.277,40.744-40.743,40.744 c-22.466,0-40.744-18.277-40.744-40.744c0-22.465,18.277-40.742,40.744-40.742C191.183,676.155,209.46,694.432,209.46,716.897z M619.162,716.897c0,22.467-18.277,40.744-40.743,40.744s-40.743-18.277-40.743-40.744c0-22.465,18.277-40.742,40.743-40.742 S619.162,694.432,619.162,716.897z"/></svg>`;
      
      const itemData = {
        assetId: itemId,
        assetName: itemName,
        assetType: isBundle ? 'bundle' : 'accessory',
        assetPrice: itemPrice,
        earnAmount: cashbackAmount,
        thumbnail: itemThumbnail,
        userId: String(userId)
      };
      
      async function updateCartButtonState() {
        const inCart = await isInCart(itemId);
        if (inCart) {
          cartButton.innerHTML = `${getMessage('removeFromCart')}${cartSvg}`;
          cartButton.classList.add('in-cart');
        } else {
          cartButton.innerHTML = `${getMessage('addToCart')}${cartSvg}`;
          cartButton.classList.remove('in-cart');
        }
      }
      
      await updateCartButtonState();
      
      cartButton.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        const inCart = await isInCart(itemId);
        if (inCart) {
          await removeFromCart(itemId);
        } else {
          await addToCart(itemData);
        }
        await updateCartButtonState();
      });
      
      window.addEventListener('roearn:cartUpdated', updateCartButtonState);

      cartWrapper.appendChild(cartButton);
      btnContainer.parentNode.insertBefore(cartWrapper, btnContainer);
    }

    const cashbackButton = clonedContainer.querySelector('.roearn-cashback-button');
    if (cashbackButton) {
      setTimeout(() => {
        adjustButtonFontSize(cashbackButton);
      }, 100);
      window.addEventListener('resize', () => adjustButtonFontSize(cashbackButton));
    }

  } catch (error) {
  } finally {
    isAddingButton = false;
  }
}

function adjustButtonFontSize(button) {
  const measureSpan = document.createElement('span');
  measureSpan.style.visibility = 'hidden';
  measureSpan.style.position = 'absolute';
  measureSpan.style.whiteSpace = 'nowrap';
  measureSpan.style.fontWeight = 'bold';
  measureSpan.textContent = button.textContent;
  document.body.appendChild(measureSpan);
  
  const buttonWidth = button.offsetWidth;
  const padding = 48;
  const availableWidth = buttonWidth - padding;
    
  let fontSize = 20;
  measureSpan.style.fontSize = fontSize + 'px';
    
  while (measureSpan.offsetWidth > availableWidth && fontSize > 10) {
    fontSize -= 0.5;
    measureSpan.style.fontSize = fontSize + 'px';
  }
  
  button.style.fontSize = fontSize + 'px';
  document.body.removeChild(measureSpan);
}

duplicatePurchaseButton();

let lastUrl = location.href;
new MutationObserver(() => {
  const currentUrl = location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
    }
    
    isAddingButton = false;
    
    const existingContainer = document.querySelector('.btn-container[data-roearn-added="true"]');
    if (existingContainer && existingContainer.parentNode) {
      existingContainer.parentNode.removeChild(existingContainer);
    }
    
    const originalContainer = document.querySelector('.btn-container[data-roearn-not-eligible="true"]');
    if (originalContainer) {
      originalContainer.removeAttribute('data-roearn-not-eligible');
    }
    
    setTimeout(() => {
      duplicatePurchaseButton();
    }, 100);
  }
}).observe(document, { subtree: true, childList: true });
})();