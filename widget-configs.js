const HOCKEY_WIDGET_CONFIGS = {
    'opc-2020-21': {
        tableName: 'O-Pee-Chee Hockey 2020-2021',
        title: 'O-Pee-Chee Hockey 2020-2021',
        description: 'Checklists are grouped by player, set or team. Use filters (Mem, Auto, Rookie, Set Type, Team) for advanced drilldowns.',
        imageUrl: 'https://images.squarespace-cdn.com/content/689a9743bddc666e1a33808c/043f6cc1-86fe-488d-ba78-3a1462f50084/55ea7ea7-cf77-437a-a511-669693a4e701.webp?content-type=image%2Fwebp',
        supabaseUrl: 'https://lwuwdvnyclgaogkqemxt.supabase.co',
        supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dXdkdm55Y2xnYW9na3FlbXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MjY3MDQsImV4cCI6MjA3MTQwMjcwNH0.n4aCBlmHiI0g51xwUQMVB6h4YmAKesZ1ZFL2ZX3755U',
        defaultGroupBy: 'team'
    }
    // Add more tables later
};

window.getHockeyWidgetConfig = function(configKey) {
    return HOCKEY_WIDGET_CONFIGS[configKey];
};
