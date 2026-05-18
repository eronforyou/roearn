const CHECK_INTERVAL = 30 * 60 * 1000;

const lastCheck = localStorage.getItem('lastUpdateCheck');
const now = Date.now();

if (!lastCheck || now - lastCheck > CHECK_INTERVAL) {
  localStorage.setItem('lastUpdateCheck', now);
  chrome.runtime.sendMessage({ type: 'CHECK_UPDATE' });
}