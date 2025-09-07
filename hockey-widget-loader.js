(function() {
    const script = document.currentScript;
    const widgetType = script.getAttribute('data-widget');
    const containerId = script.getAttribute('data-container');
    const baseUrl = 'https://andrewfx2.github.io/hockey-widgets';
    
    if (window.HockeyCardWidget) {
        initializeWidget();
        return;
    }
    
    Promise.all([
        loadScript(baseUrl + '/widget-configs.js'),
        loadScript(baseUrl + '/hockey-widget-system.js'),
        loadCSS(baseUrl + '/hockey-widget-styles.css')
    ]).then(initializeWidget)
      .catch(error => {
        console.error('Failed to load widget dependencies:', error);
      });
    
    function initializeWidget() {
        // Ensure DOM is ready before initializing
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', performInit);
        } else {
            // DOM is already ready, but wait one tick to ensure all scripts are processed
            setTimeout(performInit, 0);
        }
    }
    
    function performInit() {
        console.log('Initializing hockey widget:', widgetType, 'in container:', containerId);
        
        // Verify container exists
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID '${containerId}' not found`);
            return;
        }
        
        const config = window.getHockeyWidgetConfig(widgetType);
        if (config) {
            window.initHockeyWidget(containerId, config);
        } else {
            console.error(`No configuration found for widget type: ${widgetType}`);
        }
    }
    
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
            document.head.appendChild(script);
        });
    }
    
    function loadCSS(href) {
        return new Promise((resolve) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            link.onload = resolve;
            link.onerror = resolve; // Don't fail on CSS errors
            document.head.appendChild(link);
        });
    }
})();
