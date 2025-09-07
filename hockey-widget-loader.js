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
    ]).then(initializeWidget);
    
    function initializeWidget() {
        const config = window.getHockeyWidgetConfig(widgetType);
        if (config) {
            window.initHockeyWidget(containerId, config);
        }
    }
    
    function loadScript(src) {
        return new Promise((resolve) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }
    
    function loadCSS(href) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = href;
        document.head.appendChild(link);
    }
})();
