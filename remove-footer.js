function removeFooter() {
    const footer = document.getElementById('footer-container');
    
    if (footer) {
        footer.remove();
        return;
    }
    
    const footerObserver = new MutationObserver((mutations, obs) => {
        const footerElement = document.getElementById('footer-container');
        if (footerElement) {
            footerElement.remove();
            obs.disconnect();
        }
    });
    
    footerObserver.observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

removeFooter();