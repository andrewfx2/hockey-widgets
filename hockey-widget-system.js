// hockey-widget-system.js - Complete widget engine
class HockeyCardWidget {
    constructor(containerId, config) {
        this.containerId = containerId;
        this.config = {
            // Default configuration
            tableName: '',
            title: '',
            description: '',
            imageUrl: '',
            supabaseUrl: 'https://lwuwdvnyclgaogkqemxt.supabase.co',
            supabaseKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3dXdkdm55Y2xnYW9na3FlbXh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU4MjY3MDQsImV4cCI6MjA3MTQwMjcwNH0.n4aCBlmHiI0g51xwUQMVB6h4YmAKesZ1ZFL2ZX3755U',
            itemsPerPage: 200,
            defaultGroupBy: 'team',
            ...config
        };
        
        // Application state
        this.ITEMS_PER_PAGE = this.config.itemsPerPage;
        this.currentPage = 1;
        this.allData = [];
        this.filteredData = [];
        this.groupedData = {};
        this.currentGroupBy = this.config.defaultGroupBy;
        this.expandedGroups = new Set();
        this.isMobile = window.innerWidth <= 767;
        
        this.init();
    }
    
    async init() {
        this.renderHTML();
        this.setupEventListeners();
        await this.loadSupabaseData();
    }
    
    renderHTML() {
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with ID '${this.containerId}' not found`);
            return;
        }
        
        container.className = 'hockey-widget';
        container.innerHTML = `
            <!-- Header Section -->
            <div class="header-section">
                <div class="product-header">
                    <div class="product-image" id="productImage-${this.containerId}">
                        <img src="${this.config.imageUrl}" alt="${this.config.title}">
                    </div>
                    <div class="product-info">
                        <h1 id="collectionTitle-${this.containerId}">${this.config.title}</h1>
                        <p>${this.config.description}</p>
                    </div>
                </div>
            </div>

            <div class="main-container">
                <div class="controls-container">
                    <div class="search-section">
                        <input type="text" id="searchInput-${this.containerId}" class="search-input" placeholder="Search cards...">
                    </div>
                    
                    <button class="filter-toggle" onclick="window.HockeyWidgets['${this.containerId}'].toggleFilters()">Filters & Actions</button>
                    
                    <div class="filter-section" id="filterSection-${this.containerId}">
                        <select id="teamFilter-${this.containerId}" class="filter-select">
                            <option value="">All Teams</option>
                        </select>
                        <select id="setFilter-${this.containerId}" class="filter-select">
                            <option value="">All Sets</option>
                        </select>
                        <select id="typeFilter-${this.containerId}" class="filter-select">
                            <option value="">All Types</option>
                            <option value="rookie">Rookies Only</option>
                            <option value="auto">Autos Only</option>
                            <option value="mem">Memorabilia Only</option>
                            <option value="serial">Serial # Only</option>
                        </select>
                    </div>

                    <div class="group-by-section">
                        <select id="groupBySelect-${this.containerId}" class="group-by-select" onchange="window.HockeyWidgets['${this.containerId}'].changeGroupBy()">
                            <option value="team">Group by Team</option>
                            <option value="player">Group by Player</option>
                            <option value="set">Group by Set</option>
                        </select>
                    </div>

                    <div class="action-buttons">
                        <button class="btn btn-secondary" onclick="window.HockeyWidgets['${this.containerId}'].loadSupabaseData()">Refresh</button>
                    </div>
                </div>

                <div id="statsContainer-${this.containerId}" class="stats-container" style="display: none;">
                    <span id="cardStats-${this.containerId}">Loading statistics...</span>
                </div>
                
                <div id="loading-${this.containerId}" class="loading">Loading your collection...</div>
                <div id="error-${this.containerId}" class="error" style="display: none;"></div>

                <div id="accordionContainer-${this.containerId}" class="accordion-container" style="display: none;"></div>

                <div id="paginationContainer-${this.containerId}" class="pagination-container" style="display: none;">
                    <div class="pagination-info" id="paginationInfo-${this.containerId}">
                        Showing 0-0 of 0 entries
                    </div>
                    <div class="pagination-controls">
                        <button class="pagination-btn" id="prevBtn-${this.containerId}" onclick="window.HockeyWidgets['${this.containerId}'].changePage(-1)">← Prev</button>
                        <select class="page-select" id="pageSelect-${this.containerId}" onchange="window.HockeyWidgets['${this.containerId}'].goToPage(this.value)">
                            <option value="1">Page 1</option>
                        </select>
                        <button class="pagination-btn" id="nextBtn-${this.containerId}" onclick="window.HockeyWidgets['${this.containerId}'].changePage(1)">Next →</button>
                    </div>
                </div>
            </div>
        `;
    }
    
    // OPTIMIZED DEBOUNCE FUNCTION
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                // Use requestAnimationFrame for smoother updates
                requestAnimationFrame(() => func.apply(this, args));
            };
            clearTimeout(timeout);
            // Faster response on mobile
            timeout = setTimeout(later, this.isMobile ? 150 : wait);
        };
    }

    // Toggle filters on mobile
    toggleFilters() {
        const filterSection = document.getElementById(`filterSection-${this.containerId}`);
        filterSection.classList.toggle('open');
    }

    // Load ALL data from Supabase
    async loadAllCards() {
        let allCards = [];
        let offset = 0;
        const limit = 1000;
        let hasMore = true;

        while (hasMore) {
            const response = await fetch(`${this.config.supabaseUrl}/rest/v1/${this.config.tableName}?limit=${limit}&offset=${offset}`, {
                headers: {
                    'apikey': this.config.supabaseKey,
                    'Authorization': `Bearer ${this.config.supabaseKey}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            const batch = await response.json();
            allCards.push(...batch);

            hasMore = batch.length === limit;
            offset += limit;

            if (offset > 50000) break;
        }

        return allCards;
    }

    // Update statistics
    updateStats() {
        if (this.filteredData.length === 0) return;
        
        const total = this.filteredData.length;
        
        const rookies = this.filteredData.filter(card => {
            const rookie = card['Rookie'];
            return rookie && rookie.toString().trim() !== '' && rookie.toString().trim() !== '0' && rookie.toString().toLowerCase() !== 'no';
        }).length;
        
        const autos = this.filteredData.filter(card => {
            const auto = card['Auto'];
            return auto && auto.toString().trim() !== '' && auto.toString().trim() !== '0' && auto.toString().toLowerCase() !== 'no';
        }).length;
        
        const mems = this.filteredData.filter(card => {
            const mem = card['Mem'];
            return mem && mem.toString().trim() !== '' && mem.toString().trim() !== '0' && mem.toString().toLowerCase() !== 'no';
        }).length;
        
        const serialed = this.filteredData.filter(card => {
            const serial = card["Serial #'d"];
            return serial && serial.toString().trim() !== '' && serial.toString().trim() !== '0';
        }).length;
        
        const statsText = `${total} Cards • ${rookies} Rookies • ${autos} Autos • ${mems} Memorabilia • ${serialed} Serial #`;
        document.getElementById(`cardStats-${this.containerId}`).textContent = statsText;
        document.getElementById(`statsContainer-${this.containerId}`).style.display = 'block';
    }

    // Update filter dropdowns
    updateFilters() {
        const teams = [...new Set(this.allData.map(card => card['Team Name']).filter(Boolean))].sort();
        const sets = [...new Set(this.allData.map(card => card['Set Name']).filter(Boolean))].sort();
        
        const teamFilter = document.getElementById(`teamFilter-${this.containerId}`);
        const setFilter = document.getElementById(`setFilter-${this.containerId}`);
        
        teamFilter.innerHTML = '<option value="">All Teams</option>';
        setFilter.innerHTML = '<option value="">All Sets</option>';
        
        teams.forEach(team => {
            const option = document.createElement('option');
            option.value = team;
            option.textContent = team;
            teamFilter.appendChild(option);
        });
        
        sets.forEach(set => {
            const option = document.createElement('option');
            option.value = set;
            option.textContent = set;
            setFilter.appendChild(option);
        });
    }

    // OPTIMIZED Apply filters function
    applyFilters() {
        const searchTerm = document.getElementById(`searchInput-${this.containerId}`).value.toLowerCase();
        const teamFilter = document.getElementById(`teamFilter-${this.containerId}`).value;
        const setFilter = document.getElementById(`setFilter-${this.containerId}`).value;
        const typeFilter = document.getElementById(`typeFilter-${this.containerId}`).value;

        this.filteredData = this.allData.filter(card => {
            if (searchTerm) {
                const searchableText = [
                    card['Set Name'] || '',
                    card['Card'] || '',
                    card['Description'] || '',
                    card['Team City'] || '',
                    card['Team Name'] || '',
                    card['Rookie'] || '',
                    card['Auto'] || '',
                    card['Mem'] || '',
                    card["Serial #'d"] || '',
                    card["SP's"] || '',
                    card['Odds'] || '',
                    card['Point'] || ''
                ].join(' ').toLowerCase();
                
                if (!searchableText.includes(searchTerm)) {
                    return false;
                }
            }
            
            if (teamFilter && card['Team Name'] !== teamFilter) {
                return false;
            }
            
            if (setFilter && card['Set Name'] !== setFilter) {
                return false;
            }
            
            if (typeFilter) {
                switch (typeFilter) {
                    case 'rookie':
                        const rookie = card['Rookie'];
                        if (!rookie || rookie.toString().trim() === '' || rookie.toString().trim() === '0' || rookie.toString().toLowerCase() === 'no') return false;
                        break;
                    case 'auto':
                        const auto = card['Auto'];
                        if (!auto || auto.toString().trim() === '' || auto.toString().trim() === '0' || auto.toString().toLowerCase() === 'no') return false;
                        break;
                    case 'mem':
                        const mem = card['Mem'];
                        if (!mem || mem.toString().trim() === '' || mem.toString().trim() === '0' || mem.toString().toLowerCase() === 'no') return false;
                        break;
                    case 'serial':
                        const serial = card["Serial #'d"];
                        if (!serial || serial.toString().trim() === '' || serial.toString().trim() === '0') return false;
                        break;
                }
            }
            
            return true;
        });

        this.currentPage = 1;
        this.groupData();
        this.displayPage();
        this.updateStats();
    }

    // Group data by selected criteria and sort within groups
    groupData() {
        this.groupedData = {};
        
        this.filteredData.forEach(card => {
            let groupKey = '';
            
            switch (this.currentGroupBy) {
                case 'set':
                    groupKey = card['Set Name'] || 'Unknown Set';
                    break;
                case 'team':
                    groupKey = card['Team Name'] || 'Unknown Team';
                    break;
                case 'player':
                    groupKey = card['Description'] || 'Unknown Player';
                    break;
            }
            
            if (!this.groupedData[groupKey]) {
                this.groupedData[groupKey] = [];
            }
            this.groupedData[groupKey].push(card);
        });
        
        // Sort cards within each group alphabetically by player name (Description)
        Object.keys(this.groupedData).forEach(groupKey => {
            this.groupedData[groupKey].sort((a, b) => {
                const nameA = (a['Description'] || '').toLowerCase();
                const nameB = (b['Description'] || '').toLowerCase();
                return nameA.localeCompare(nameB);
            });
        });
    }

    // Change grouping
    changeGroupBy() {
        this.currentGroupBy = document.getElementById(`groupBySelect-${this.containerId}`).value;
        this.expandedGroups.clear();
        this.groupData();
        this.displayPage();
    }

    // Create accordion group
    createAccordionGroup(groupName, cards) {
        const groupDiv = document.createElement('div');
        const isExpanded = this.expandedGroups.has(groupName);
        
        groupDiv.className = 'accordion-group';
        groupDiv.setAttribute('data-group-name', groupName);
        groupDiv.setAttribute('data-card-count', cards.length);
        
        let contentHTML;
        if (this.isMobile && !isExpanded) {
            contentHTML = '<div class="lazy-loading" style="padding: 20px; text-align: center; color: #888;">Click to load cards...</div>';
        } else {
            contentHTML = cards.map(card => this.createCardListItem(card)).join('');
        }
        
        groupDiv.innerHTML = `
            <div class="accordion-header ${isExpanded ? 'active' : ''}" onclick="window.HockeyWidgets['${this.containerId}'].toggleAccordionGroup('${groupName.replace(/'/g, "\\'")}')">
                <div class="accordion-title">
                    ${groupName}
                    <span class="accordion-count">${cards.length}</span>
                </div>
                <span class="accordion-icon">${isExpanded ? '▲' : '▼'}</span>
            </div>
            <div class="accordion-content ${isExpanded ? 'open' : ''}" style="max-height: ${isExpanded ? 'none' : '0px'}">
                <div class="accordion-cards">
                    ${contentHTML}
                </div>
            </div>
        `;
        
        return groupDiv;
    }

    // Create card list item with set name visible
    createCardListItem(card) {
        const badges = [];
        
        if (card['Rookie'] && card['Rookie'].toString().trim() !== '' && card['Rookie'].toString().trim() !== '0' && card['Rookie'].toString().toLowerCase() !== 'no') {
            badges.push(`<span class="badge badge-rookie">${card['Rookie']}</span>`);
        }
        
        if (card['Auto'] && card['Auto'].toString().trim() !== '' && card['Auto'].toString().trim() !== '0' && card['Auto'].toString().toLowerCase() !== 'no') {
            badges.push(`<span class="badge badge-auto">${card['Auto']}</span>`);
        }
        
        if (card['Mem'] && card['Mem'].toString().trim() !== '' && card['Mem'].toString().trim() !== '0' && card['Mem'].toString().toLowerCase() !== 'no') {
            badges.push(`<span class="badge badge-mem">${card['Mem']}</span>`);
        }
        
        if (card["Serial #'d"] && card["Serial #'d"].toString().trim() !== '' && card["Serial #'d"].toString().trim() !== '0') {
            badges.push(`<span class="badge badge-serial">${card["Serial #'d"]}</span>`);
        }
        
        if (card['Point'] && card['Point'].toString().trim() !== '' && card['Point'].toString().trim() !== '0') {
            badges.push(`<span class="badge badge-point">${card['Point']} pts</span>`);
        }

        const cardId = `card_${Math.random().toString(36).substr(2, 9)}`;
        
        let cardTitle = '';
        let cardSubtitle = '';
        
        if (this.currentGroupBy === 'team') {
            cardTitle = `${card['Description'] || ''}`.trim();
            cardSubtitle = card['Set Name'] || '';
        } else if (this.currentGroupBy === 'player') {
            cardTitle = `${card['Set Name'] || ''}`.trim();
            cardSubtitle = `${card['Team City'] || ''} ${card['Team Name'] || ''}`.trim();
        } else {
            cardTitle = `${card['Description'] || ''}`.trim();
            cardSubtitle = `${card['Team City'] || ''} ${card['Team Name'] || ''}`.trim();
        }
        
        return `
            <div class="card-list-item" onclick="window.HockeyWidgets['${this.containerId}'].toggleCardDetails('${cardId}')">
                <div class="card-list-main">
                    <div class="card-list-info">
                        <div class="card-list-title">${cardTitle}</div>
                        <div class="card-list-subtitle">${cardSubtitle}</div>
                    </div>
                    <div class="card-list-badges">
                        ${badges.join('')}
                    </div>
                </div>
            </div>
            <div class="card-list-details" id="${cardId}">
                <div class="detail-grid">
                    <div class="detail-item">
                        <span class="detail-label">Set:</span>
                        <span class="detail-value">${card['Set Name'] || ''}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Card #:</span>
                        <span class="detail-value">${card['Card'] || ''}</span>
                    </div>
                    ${card["SP's"] && card["SP's"].toString().trim() !== '' ? `
                    <div class="detail-item">
                        <span class="detail-label">SP's:</span>
                        <span class="detail-value">${card["SP's"]}</span>
                    </div>
                    ` : ''}
                    ${card['Odds'] && card['Odds'].toString().trim() !== '' ? `
                    <div class="detail-item">
                        <span class="detail-label">Odds:</span>
                        <span class="detail-value">${card['Odds']}</span>
                    </div>
                    ` : ''}
                    ${this.currentGroupBy !== 'team' ? `
                    <div class="detail-item">
                        <span class="detail-label">Team:</span>
                        <span class="detail-value">${card['Team City'] || ''} ${card['Team Name'] || ''}</span>
                    </div>
                    ` : ''}
                    ${this.currentGroupBy !== 'player' ? `
                    <div class="detail-item">
                        <span class="detail-label">Player:</span>
                        <span class="detail-value">${card['Description'] || ''}</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    }

    // Toggle accordion group
    toggleAccordionGroup(groupName) {
        const groupElement = document.querySelector(`[data-group-name="${groupName}"]`);
        const header = groupElement.querySelector('.accordion-header');
        const content = groupElement.querySelector('.accordion-content');
        const cardsContainer = content.querySelector('.accordion-cards');
        const icon = header.querySelector('.accordion-icon');
        
        header.style.background = 'linear-gradient(135deg, #004400 0%, #006600 100%)';
        
        requestAnimationFrame(() => {
            if (this.expandedGroups.has(groupName)) {
                this.expandedGroups.delete(groupName);
                header.classList.remove('active');
                content.classList.remove('open');
                
                if (this.isMobile) {
                    content.style.maxHeight = '0px';
                    content.style.overflow = 'hidden';
                } else {
                    content.style.maxHeight = '0px';
                    content.style.overflow = 'hidden';
                }
                
                icon.textContent = '▼';
            } else {
                this.expandedGroups.add(groupName);
                header.classList.add('active');
                content.classList.add('open');
                
                if (this.isMobile) {
                    content.style.maxHeight = 'none';
                    content.style.height = 'auto';
                    content.style.overflow = 'visible';
                } else {
                    content.style.maxHeight = 'none';
                    content.style.overflow = 'visible';
                }
                
                icon.textContent = '▲';
                
                const lazyLoader = cardsContainer.querySelector('.lazy-loading');
                if (lazyLoader && this.isMobile) {
                    const cards = this.groupedData[groupName];
                    lazyLoader.style.color = '#00ff00';
                    lazyLoader.textContent = 'Loading cards...';
                    
                    requestAnimationFrame(() => {
                        cardsContainer.innerHTML = cards.map(card => this.createCardListItem(card)).join('');
                        content.style.maxHeight = 'none';
                        content.style.height = 'auto';
                        content.style.overflow = 'visible';
                    });
                }
            }
            
            setTimeout(() => {
                header.style.background = '';
            }, 100);
        });
    }

    // Toggle card details
    toggleCardDetails(cardId) {
        const details = document.getElementById(cardId);
        const cardItem = details.previousElementSibling;
        const isOpen = details.classList.contains('open');
        
        // Close all other card details in this widget
        document.querySelectorAll(`#${this.containerId} .card-list-details`).forEach(detail => {
            detail.classList.remove('open');
        });
        document.querySelectorAll(`#${this.containerId} .card-list-item`).forEach(item => {
            item.classList.remove('expanded');
        });
        
        // Toggle this card
        if (!isOpen) {
            cardItem.classList.add('expanded');
            details.classList.add('open');
        }
    }

    // Display current page with batch DOM operations
    displayPage() {
        const accordionContainer = document.getElementById(`accordionContainer-${this.containerId}`);
        const groupNames = Object.keys(this.groupedData).sort();
        
        accordionContainer.innerHTML = '';

        if (groupNames.length === 0) {
            accordionContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #cccccc;">No cards found matching your filters.</div>';
            document.getElementById(`paginationContainer-${this.containerId}`).style.display = 'none';
            return;
        }

        const fragment = document.createDocumentFragment();
        
        groupNames.forEach(groupName => {
            const cards = this.groupedData[groupName];
            const groupElement = this.createAccordionGroup(groupName, cards);
            fragment.appendChild(groupElement);
        });
        
        accordionContainer.appendChild(fragment);
        this.updatePagination();
    }

    updatePagination() {
        const totalItems = this.filteredData.length;
        const totalGroups = Object.keys(this.groupedData).length;
        
        document.getElementById(`paginationInfo-${this.containerId}`).textContent = 
            `Showing ${totalGroups} groups (${totalItems} cards total)`;

        document.getElementById(`paginationContainer-${this.containerId}`).style.display = 'none';
    }

    changePage(direction) {
        // Not used in accordion view
    }

    goToPage(pageNumber) {
        // Not used in accordion view
    }

    // Show error message
    showError(message) {
        const errorDiv = document.getElementById(`error-${this.containerId}`);
        errorDiv.innerHTML = message;
        errorDiv.style.display = 'block';
    }

    // Load data from Supabase
    async loadSupabaseData() {
        const loading = document.getElementById(`loading-${this.containerId}`);
        const error = document.getElementById(`error-${this.containerId}`);
        const accordionContainer = document.getElementById(`accordionContainer-${this.containerId}`);

        loading.style.display = 'block';
        error.style.display = 'none';
        accordionContainer.style.display = 'none';
        document.getElementById(`statsContainer-${this.containerId}`).style.display = 'none';

        try {
            const data = await this.loadAllCards();

            this.allData = data;
            this.filteredData = [...this.allData];

            this.currentPage = 1;
            this.updateFilters();
            this.groupData();
            
            requestAnimationFrame(() => {
                this.displayPage();
                this.updateStats();
                
                loading.style.display = 'none';
                accordionContainer.style.display = 'flex';
            });

        } catch (err) {
            console.error('Error loading Supabase data:', err);
            loading.style.display = 'none';
            this.showError(`<strong>Error loading data:</strong><br>${err.message}`);
        }
    }

    // Setup event listeners
    setupEventListeners() {
        const searchInput = document.getElementById(`searchInput-${this.containerId}`);
        const teamFilter = document.getElementById(`teamFilter-${this.containerId}`);
        const setFilter = document.getElementById(`setFilter-${this.containerId}`);
        const typeFilter = document.getElementById(`typeFilter-${this.containerId}`);
        
        // Debounced search
        const debouncedSearch = this.debounce(() => this.applyFilters(), 200);
        
        searchInput.addEventListener('input', (e) => {
            e.target.style.borderColor = '#00aa00';
            debouncedSearch();
            setTimeout(() => {
                e.target.style.borderColor = '#008800';
            }, 200);
        });
        
        [teamFilter, setFilter, typeFilter].forEach(filter => {
            filter.addEventListener('change', (e) => {
                e.target.style.borderColor = '#00cc00';
                this.applyFilters();
                
                setTimeout(() => {
                    e.target.style.borderColor = '#008800';
                }, 300);
            });
            
            filter.addEventListener('focus', (e) => {
                e.target.style.borderColor = '#00ff00';
            });
            
            filter.addEventListener('blur', (e) => {
                e.target.style.borderColor = '#008800';
            });
        });
    }
}

// Global registry for widget instances
window.HockeyWidgets = window.HockeyWidgets || {};

// Easy initialization function
window.initHockeyWidget = function(containerId, config) {
    window.HockeyWidgets[containerId] = new HockeyCardWidget(containerId, config);
    return window.HockeyWidgets[containerId];
};
