// hockey-widget-system.js - Complete widget engine with smart grouping and badge deduplication
// UPDATED: Added "All Cards" pagination functionality
class HockeyCardWidget {
    constructor(containerId, config) {
        console.log('Initializing hockey widget with container:', containerId);
        
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
        
        // Verify container exists
        const container = document.getElementById(this.containerId);
        if (!container) {
            console.error(`Container with ID '${this.containerId}' not found`);
            return;
        }
        
        this.init();
    }
    
    // Utility function to deduplicate badges
    deduplicateBadge(badgeValue) {
        if (!badgeValue || badgeValue.toString().trim() === '') return '';
        
        const value = badgeValue.toString().trim();
        
        // Split on common delimiters and get unique values
        const parts = value.split(/[-\/|,]/).map(part => part.trim()).filter(part => part !== '');
        const uniqueParts = [...new Set(parts)];
        
        // Return single value if all parts are the same, otherwise join with single delimiter
        return uniqueParts.length === 1 ? uniqueParts[0] : uniqueParts.join('-');
    }
    
    // Utility function to analyze card data for multiple entities
    analyzeCardData(card) {
        const teamName = card['Team Name'] || '';
        const description = card['Description'] || '';
        
        // Split teams and players on common delimiters
        const teams = teamName.split(/[\/|]/).map(t => t.trim()).filter(t => t !== '');
        const players = description.split(/[\/|]/).map(p => p.trim()).filter(p => p !== '');
        
        return {
            hasMultipleTeams: teams.length > 1,
            hasMultiplePlayers: players.length > 1,
            teams: teams,
            players: players,
            teamCount: teams.length,
            playerCount: players.length
        };
    }
    
    // Get display group key for a card
    getGroupKey(card, groupBy) {
        const analysis = this.analyzeCardData(card);
        
        switch (groupBy) {
            case 'all':
                return 'All Cards';
                
            case 'team':
                if (analysis.hasMultipleTeams) {
                    return `Multiple Teams (${analysis.teamCount})`;
                }
                return analysis.teams[0] || 'Unknown Team';
                
            case 'player':
                if (analysis.hasMultiplePlayers) {
                    return `Multiple Players (${analysis.playerCount})`;
                }
                return analysis.players[0] || 'Unknown Player';
                
            case 'set':
                return card['Set Name'] || 'Unknown Set';
                
            default:
                return 'Unknown';
        }
    }
    
    // Get display title for a card based on current grouping
    getCardDisplayTitle(card) {
        const analysis = this.analyzeCardData(card);
        
        switch (this.currentGroupBy) {
            case 'team':
                if (analysis.hasMultiplePlayers) {
                    // Show first 2 players + count of remaining
                    const firstTwo = analysis.players.slice(0, 2);
                    const remaining = analysis.playerCount - 2;
                    if (remaining > 0) {
                        return `${firstTwo.join(', ')} + ${remaining} more`;
                    } else {
                        return firstTwo.join(', ');
                    }
                }
                return analysis.players[0] || 'Unknown Player';
                
            case 'player':
                if (analysis.hasMultipleTeams) {
                    // Show first 2 teams + count of remaining
                    const firstTwo = analysis.teams.slice(0, 2);
                    const remaining = analysis.teamCount - 2;
                    if (remaining > 0) {
                        return `${firstTwo.join(', ')} + ${remaining} more`;
                    } else {
                        return firstTwo.join(', ');
                    }
                }
                return analysis.teams[0] || 'Unknown Team';
                
            case 'set':
                if (analysis.hasMultiplePlayers) {
                    // Show first 2 players + count of remaining
                    const firstTwo = analysis.players.slice(0, 2);
                    const remaining = analysis.playerCount - 2;
                    if (remaining > 0) {
                        return `${firstTwo.join(', ')} + ${remaining} more`;
                    } else {
                        return firstTwo.join(', ');
                    }
                }
                return analysis.players[0] || 'Unknown Player';
                
            default:
                return card['Description'] || 'Unknown';
        }
    }
    
    // Get display subtitle for a card based on current grouping
    getCardDisplaySubtitle(card) {
        const analysis = this.analyzeCardData(card);
        
        switch (this.currentGroupBy) {
            case 'team':
                return card['Set Name'] || '';
                
            case 'player':
                // ALWAYS show set name when grouped by player (like team grouping does)
                return card['Set Name'] || '';
                
            case 'set':
                if (analysis.hasMultipleTeams) {
                    return `${analysis.teamCount} Teams`;
                }
                return analysis.teams[0] || '';
                
            default:
                return '';
        }
    }
    
    async init() {
        console.log('Starting widget initialization...');
        this.renderHTML();
        
        // Wait for DOM to be updated - using working timing
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('Setting up event listeners...');
        this.setupEventListeners();
        
        console.log('Loading data...');
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
                            <option value="all">All Cards</option>
                        </select>
                    </div>

                    <div class="action-buttons">
                        <button class="btn btn-secondary" onclick="window.HockeyWidgets['${this.containerId}'].loadSupabaseData()">Reset</button>
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
        
        console.log('HTML rendered for container:', this.containerId);
    }
    
    // FIXED DEBOUNCE FUNCTION - solves the isMobile context issue
    debounce(func, wait) {
        let timeout;
        const widget = this; // Capture widget context
        const isMobile = this.isMobile; // Capture isMobile value
        
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                requestAnimationFrame(() => func.apply(widget, args));
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, isMobile ? 150 : wait);
        };
    }

    // Toggle filters on mobile
    toggleFilters() {
        const filterSection = document.getElementById(`filterSection-${this.containerId}`);
        if (filterSection) {
            filterSection.classList.toggle('open');
        }
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
        
        const statsElement = document.getElementById(`cardStats-${this.containerId}`);
        if (statsElement) {
            statsElement.textContent = statsText;
            document.getElementById(`statsContainer-${this.containerId}`).style.display = 'block';
        }
    }

    // Update filter dropdowns with cleaned individual team/set names
    updateFilters() {
        console.log('Updating filters with cleaned data...');
        
        // Extract and clean team names
        const allTeamNames = new Set();
        this.allData.forEach(card => {
            const teamName = card['Team Name'] || '';
            console.log('Processing team name:', teamName);
            
            if (teamName.trim()) {
                // Split on common delimiters and clean up
                const teams = teamName.split(/[\/|,]/)
                    .map(t => t.trim())
                    .filter(t => t !== '' && t.length > 0);
                
                teams.forEach(team => {
                    if (team && team.length > 0) {
                        allTeamNames.add(team);
                    }
                });
            }
        });
        
        // Convert to sorted array
        const teams = Array.from(allTeamNames).sort();
        console.log('Cleaned teams:', teams);
        
        // Extract and clean set names
        const allSetNames = new Set();
        this.allData.forEach(card => {
            const setName = card['Set Name'] || '';
            
            if (setName.trim()) {
                // Split on common delimiters and clean up  
                const sets = setName.split(/[\/|,]/)
                    .map(s => s.trim())
                    .filter(s => s !== '' && s.length > 0);
                
                sets.forEach(set => {
                    if (set && set.length > 0) {
                        allSetNames.add(set);
                    }
                });
            }
        });
        
        // Convert to sorted array
        const sets = Array.from(allSetNames).sort();
        console.log('Cleaned sets:', sets);
        
        const teamFilter = document.getElementById(`teamFilter-${this.containerId}`);
        const setFilter = document.getElementById(`setFilter-${this.containerId}`);
        
        if (teamFilter && setFilter) {
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
            
            console.log('Filter dropdowns updated successfully');
        } else {
            console.error('Filter dropdown elements not found');
        }
    }

    // Apply filters function - working Squarespace pattern
    applyFilters() {
        console.log('=== APPLYING FILTERS ===');
        
        const searchInput = document.getElementById(`searchInput-${this.containerId}`);
        const teamFilter = document.getElementById(`teamFilter-${this.containerId}`);
        const setFilter = document.getElementById(`setFilter-${this.containerId}`);
        const typeFilter = document.getElementById(`typeFilter-${this.containerId}`);
        
        if (!searchInput || !teamFilter || !setFilter || !typeFilter) {
            console.error('Filter elements not found during applyFilters');
            return;
        }

        const searchTerm = searchInput.value.toLowerCase().trim();
        const teamFilterValue = teamFilter.value;
        const setFilterValue = setFilter.value;
        const typeFilterValue = typeFilter.value;
        
        console.log('Filter values:', { searchTerm, teamFilterValue, setFilterValue, typeFilterValue });
        console.log('Total data to filter:', this.allData.length);

        this.filteredData = this.allData.filter(card => {
            // Search filter
            if (searchTerm) {
                const searchableText = [
                    card['Set Name'] || '',
                    card['Card'] || '',
                    card['Description'] || '',
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
            
            // Team filter - check if selected team is contained in the card's team name
            if (teamFilterValue) {
                const cardTeamName = card['Team Name'] || '';
                if (!cardTeamName.includes(teamFilterValue)) {
                    return false;
                }
            }
            
            // Set filter - check if selected set is contained in the card's set name
            if (setFilterValue) {
                const cardSetName = card['Set Name'] || '';
                if (!cardSetName.includes(setFilterValue)) {
                    return false;
                }
            }
            
            // Type filter
            if (typeFilterValue) {
                switch (typeFilterValue) {
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

        console.log('Filtered data length:', this.filteredData.length);
        
        this.currentPage = 1;
        this.groupData();
        this.displayPage();
        this.updateStats();
        
        console.log('=== FILTERS APPLIED ===');
    }

    // Group data by selected criteria and sort within groups
    groupData() {
        this.groupedData = {};
        
        this.filteredData.forEach(card => {
            const groupKey = this.getGroupKey(card, this.currentGroupBy);
            
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
        const groupBySelect = document.getElementById(`groupBySelect-${this.containerId}`);
        if (groupBySelect) {
            this.currentGroupBy = groupBySelect.value;
            this.expandedGroups.clear();
            this.currentPage = 1; // Reset to first page when changing grouping
            this.groupData();
            this.displayPage();
        }
    }

    // NEW: Display all cards with pagination (for "all" grouping option)
    displayAllCardsPaginated() {
        const accordionContainer = document.getElementById(`accordionContainer-${this.containerId}`);
        const paginationContainer = document.getElementById(`paginationContainer-${this.containerId}`);
        
        if (this.filteredData.length === 0) {
            accordionContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #cccccc;">No cards found matching your filters.</div>';
            paginationContainer.style.display = 'none';
            return;
        }
        
        // Calculate pagination
        const totalCards = this.filteredData.length;
        const totalPages = Math.ceil(totalCards / this.ITEMS_PER_PAGE);
        const startIndex = (this.currentPage - 1) * this.ITEMS_PER_PAGE;
        const endIndex = Math.min(startIndex + this.ITEMS_PER_PAGE, totalCards);
        const cardsToShow = this.filteredData.slice(startIndex, endIndex);
        
        // Create simple card list (no accordion grouping)
        accordionContainer.innerHTML = `
            <div class="all-cards-container">
                <div class="all-cards-header">
                    <h3>All Cards - Page ${this.currentPage} of ${totalPages}</h3>
                    <span class="cards-count">${totalCards} total cards</span>
                </div>
                <div class="all-cards-list">
                    ${cardsToShow.map(card => this.createSimpleCardListItem(card)).join('')}
                </div>
            </div>
        `;
        
        // Enable and update pagination
        this.updatePaginationForAll(totalCards, totalPages);
    }

    // NEW: Create simple card list item for "all cards" view
    createSimpleCardListItem(card) {
        const badges = [];
        
        // Existing badge logic
        if (card['Rookie'] && card['Rookie'].toString().trim() !== '' && card['Rookie'].toString().trim() !== '0' && card['Rookie'].toString().toLowerCase() !== 'no') {
            const rookieBadge = this.deduplicateBadge(card['Rookie']);
            if (rookieBadge) badges.push(`<span class="badge badge-rookie">${rookieBadge}</span>`);
        }
        
        if (card['Auto'] && card['Auto'].toString().trim() !== '' && card['Auto'].toString().trim() !== '0' && card['Auto'].toString().toLowerCase() !== 'no') {
            const autoBadge = this.deduplicateBadge(card['Auto']);
            if (autoBadge) badges.push(`<span class="badge badge-auto">${autoBadge}</span>`);
        }
        
        if (card['Mem'] && card['Mem'].toString().trim() !== '' && card['Mem'].toString().trim() !== '0' && card['Mem'].toString().toLowerCase() !== 'no') {
            const memBadge = this.deduplicateBadge(card['Mem']);
            if (memBadge) badges.push(`<span class="badge badge-mem">${memBadge}</span>`);
        }
        
        if (card["Serial #'d"] && card["Serial #'d"].toString().trim() !== '' && card["Serial #'d"].toString().trim() !== '0') {
            badges.push(`<span class="badge badge-serial">/${card["Serial #'d"]}</span>`);
        }
        
        if (card['Point'] && card['Point'].toString().trim() !== '' && card['Point'].toString().trim() !== '0') {
            badges.push(`<span class="badge badge-point">${card['Point']} pts</span>`);
        }

        const cardId = `card_${Math.random().toString(36).substr(2, 9)}`;
        
        // Use smart display logic instead of simple fields
        const cardTitle = this.getCardDisplayTitle(card);
        const cardSubtitle = this.getCardDisplaySubtitle(card);
        
        return `
            <div class="simple-card-item" onclick="window.HockeyWidgets['${this.containerId}'].toggleCardDetails('${cardId}')">
                <div class="simple-card-main">
                    <div class="simple-card-info">
                        <div class="simple-card-title">${cardTitle}</div>
                        <div class="simple-card-subtitle">${cardSubtitle}</div>
                    </div>
                    <div class="simple-card-badges">
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
                    <div class="detail-item">
                        <span class="detail-label">Team:</span>
                        <span class="detail-value">${card['Team Name'] || ''}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Player:</span>
                        <span class="detail-value">${card['Description'] || ''}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // NEW: Update pagination for "all cards" view
    updatePaginationForAll(totalCards, totalPages) {
        const paginationContainer = document.getElementById(`paginationContainer-${this.containerId}`);
        const paginationInfo = document.getElementById(`paginationInfo-${this.containerId}`);
        const prevBtn = document.getElementById(`prevBtn-${this.containerId}`);
        const nextBtn = document.getElementById(`nextBtn-${this.containerId}`);
        const pageSelect = document.getElementById(`pageSelect-${this.containerId}`);
        
        if (paginationInfo) {
            const startItem = (this.currentPage - 1) * this.ITEMS_PER_PAGE + 1;
            const endItem = Math.min(this.currentPage * this.ITEMS_PER_PAGE, totalCards);
            paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${totalCards} cards`;
        }
        
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
        
        if (pageSelect) {
            pageSelect.innerHTML = '';
            for (let i = 1; i <= totalPages; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `Page ${i}`;
                if (i === this.currentPage) option.selected = true;
                pageSelect.appendChild(option);
            }
        }
        
        paginationContainer.style.display = totalPages > 1 ? 'flex' : 'none';
    }

    // Create accordion group
    createAccordionGroup(groupName, cards) {
        const groupDiv = document.createElement('div');
        const isExpanded = this.expandedGroups.has(groupName);
        
        groupDiv.className = 'accordion-group';
        // Add special class for multiple entity groups
        if (groupName.startsWith('Multiple Teams') || groupName.startsWith('Multiple Players')) {
            groupDiv.classList.add('multiple-entities');
        }
        
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

    // Create card list item with smart titles and deduplicated badges
    createCardListItem(card) {
        const badges = [];
        
        // Deduplicated badge processing
        if (card['Rookie'] && card['Rookie'].toString().trim() !== '' && card['Rookie'].toString().trim() !== '0' && card['Rookie'].toString().toLowerCase() !== 'no') {
            const rookieBadge = this.deduplicateBadge(card['Rookie']);
            if (rookieBadge) badges.push(`<span class="badge badge-rookie">${rookieBadge}</span>`);
        }
        
        if (card['Auto'] && card['Auto'].toString().trim() !== '' && card['Auto'].toString().trim() !== '0' && card['Auto'].toString().toLowerCase() !== 'no') {
            const autoBadge = this.deduplicateBadge(card['Auto']);
            if (autoBadge) badges.push(`<span class="badge badge-auto">${autoBadge}</span>`);
        }
        
        if (card['Mem'] && card['Mem'].toString().trim() !== '' && card['Mem'].toString().trim() !== '0' && card['Mem'].toString().toLowerCase() !== 'no') {
            const memBadge = this.deduplicateBadge(card['Mem']);
            if (memBadge) badges.push(`<span class="badge badge-mem">${memBadge}</span>`);
        }
        
        if (card["Serial #'d"] && card["Serial #'d"].toString().trim() !== '' && card["Serial #'d"].toString().trim() !== '0') {
            badges.push(`<span class="badge badge-serial">/${card["Serial #'d"]}</span>`);
        }
        
        if (card['Point'] && card['Point'].toString().trim() !== '' && card['Point'].toString().trim() !== '0') {
            badges.push(`<span class="badge badge-point">${card['Point']} pts</span>`);
        }

        const cardId = `card_${Math.random().toString(36).substr(2, 9)}`;
        
        // Use smart display logic
        const cardTitle = this.getCardDisplayTitle(card);
        const cardSubtitle = this.getCardDisplaySubtitle(card);
        
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
                    <div class="detail-item">
                        <span class="detail-label">Team:</span>
                        <span class="detail-value">${card['Team Name'] || ''}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Player:</span>
                        <span class="detail-value">${card['Description'] || ''}</span>
                    </div>
                </div>
            </div>
        `;
    }

    // Toggle accordion group
    toggleAccordionGroup(groupName) {
        const groupElement = document.querySelector(`[data-group-name="${groupName}"]`);
        if (!groupElement) return;
        
        const header = groupElement.querySelector('.accordion-header');
        const content = groupElement.querySelector('.accordion-content');
        const cardsContainer = content.querySelector('.accordion-cards');
        const icon = header.querySelector('.accordion-icon');
        
        header.style.background = 'linear-gradient(135deg, #2d4a7c 0%, #3d5a8f 100%)';
        
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
                    lazyLoader.style.color = '#85c1e9';
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
        document.querySelectorAll(`#${this.containerId} .card-list-item, #${this.containerId} .simple-card-item`).forEach(item => {
            item.classList.remove('expanded');
        });
        
        // Toggle this card
        if (!isOpen) {
            cardItem.classList.add('expanded');
            details.classList.add('open');
        }
    }

    // UPDATED: Display current page with "all cards" handling
    displayPage() {
        const accordionContainer = document.getElementById(`accordionContainer-${this.containerId}`);
        if (!accordionContainer) return;
        
        // Special handling for "all cards" - use pagination instead of accordion
        if (this.currentGroupBy === 'all') {
            this.displayAllCardsPaginated();
            return;
        }
        
        const groupNames = Object.keys(this.groupedData);
        
        // Sort groups: regular groups first alphabetically, then multiple entity groups at the end
        const regularGroups = groupNames.filter(name => !name.startsWith('Multiple')).sort();
        const multipleGroups = groupNames.filter(name => name.startsWith('Multiple')).sort();
        const sortedGroupNames = [...regularGroups, ...multipleGroups];
        
        accordionContainer.innerHTML = '';

        if (sortedGroupNames.length === 0) {
            accordionContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #cccccc;">No cards found matching your filters.</div>';
            const paginationContainer = document.getElementById(`paginationContainer-${this.containerId}`);
            if (paginationContainer) {
                paginationContainer.style.display = 'none';
            }
            return;
        }

        const fragment = document.createDocumentFragment();
        
        sortedGroupNames.forEach(groupName => {
            const cards = this.groupedData[groupName];
            const groupElement = this.createAccordionGroup(groupName, cards);
            fragment.appendChild(groupElement);
        });
        
        accordionContainer.appendChild(fragment);
        this.updatePagination();
    }

    // UPDATED: Update pagination with "all cards" handling
    updatePagination() {
        // Hide pagination for accordion views (team, player, set groupings)
        const paginationContainer = document.getElementById(`paginationContainer-${this.containerId}`);
        if (paginationContainer && this.currentGroupBy !== 'all') {
            paginationContainer.style.display = 'none';
        }
        
        // Show pagination info for grouped views
        const totalItems = this.filteredData.length;
        const totalGroups = Object.keys(this.groupedData).length;
        
        const paginationInfo = document.getElementById(`paginationInfo-${this.containerId}`);
        if (paginationInfo && this.currentGroupBy !== 'all') {
            paginationInfo.textContent = `Showing ${totalGroups} groups (${totalItems} cards total)`;
        }
    }

    // UPDATED: Change page for "all cards" pagination
    changePage(direction) {
        if (this.currentGroupBy !== 'all') return; // Only works for "all cards" view
        
        const totalCards = this.filteredData.length;
        const totalPages = Math.ceil(totalCards / this.ITEMS_PER_PAGE);
        
        if (direction > 0 && this.currentPage < totalPages) {
            this.currentPage++;
        } else if (direction < 0 && this.currentPage > 1) {
            this.currentPage--;
        }
        
        this.displayPage();
    }

    // UPDATED: Go to specific page for "all cards" pagination
    goToPage(pageNumber) {
        if (this.currentGroupBy !== 'all') return; // Only works for "all cards" view
        
        const totalCards = this.filteredData.length;
        const totalPages = Math.ceil(totalCards / this.ITEMS_PER_PAGE);
        const page = parseInt(pageNumber);
        
        if (page >= 1 && page <= totalPages) {
            this.currentPage = page;
            this.displayPage();
        }
    }

    // Show error message
    showError(message) {
        const errorDiv = document.getElementById(`error-${this.containerId}`);
        if (errorDiv) {
            errorDiv.innerHTML = message;
            errorDiv.style.display = 'block';
        }
    }

    // Load data from Supabase
    async loadSupabaseData() {
        const loading = document.getElementById(`loading-${this.containerId}`);
        const error = document.getElementById(`error-${this.containerId}`);
        const accordionContainer = document.getElementById(`accordionContainer-${this.containerId}`);
        const statsContainer = document.getElementById(`statsContainer-${this.containerId}`);

        if (loading) loading.style.display = 'block';
        if (error) error.style.display = 'none';
        if (accordionContainer) accordionContainer.style.display = 'none';
        if (statsContainer) statsContainer.style.display = 'none';

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
                
                if (loading) loading.style.display = 'none';
                if (accordionContainer) accordionContainer.style.display = 'flex';
            });

        } catch (err) {
            console.error('Error loading Supabase data:', err);
            if (loading) loading.style.display = 'none';
            this.showError(`<strong>Error loading data:</strong><br>${err.message}`);
        }
    }

    // Setup event listeners using working Squarespace pattern
    setupEventListeners() {
        console.log('Setting up event listeners for container:', this.containerId);
        
        // Create debounced search function once (like working code)
        const debouncedSearch = this.debounce(() => {
            console.log('Debounced search executing...');
            this.applyFilters();
        }, 200);
        
        // Use retry mechanism to ensure elements exist
        const waitForElements = () => {
            const searchInput = document.getElementById(`searchInput-${this.containerId}`);
            const teamFilter = document.getElementById(`teamFilter-${this.containerId}`);
            const setFilter = document.getElementById(`setFilter-${this.containerId}`);
            const typeFilter = document.getElementById(`typeFilter-${this.containerId}`);
            
            if (!searchInput || !teamFilter || !setFilter || !typeFilter) {
                console.log('Elements not ready, retrying in 100ms...');
                setTimeout(waitForElements, 100);
                return;
            }
            
            console.log('All elements found, attaching listeners...');
            
            // Search input - exact pattern from working code
            searchInput.addEventListener('input', (e) => {
                console.log('Search input event:', e.target.value);
                e.target.style.borderColor = '#6bb6ff';
                debouncedSearch();
                setTimeout(() => {
                    e.target.style.borderColor = '#5dade2';
                }, 200);
            });
            
            // Filter dropdowns - exact pattern from working code  
            [teamFilter, setFilter, typeFilter].forEach(filter => {
                filter.addEventListener('change', (e) => {
                    console.log('Filter change event:', e.target.id, e.target.value);
                    e.target.style.borderColor = '#85c1e9';
                    this.applyFilters();
                    setTimeout(() => {
                        e.target.style.borderColor = '#5dade2';
                    }, 300);
                });
                
                filter.addEventListener('focus', (e) => {
                    e.target.style.borderColor = '#85c1e9';
                });
                
                filter.addEventListener('blur', (e) => {
                    e.target.style.borderColor = '#5dade2';
                });
            });
            
            console.log('Event listeners setup complete - search is working!');
        };
        
        // Start checking for elements
        waitForElements();
    }
    
    // Test function for debugging
    testSearch() {
        console.log('Testing search functionality...');
        const searchInput = document.getElementById(`searchInput-${this.containerId}`);
        if (searchInput) {
            console.log('Search input found, current value:', searchInput.value);
            // Manually trigger search
            this.applyFilters();
            console.log('Filter applied, filtered data length:', this.filteredData.length);
        } else {
            console.error('Search input not found!');
        }
    }
}

// Global registry for widget instances
window.HockeyWidgets = window.HockeyWidgets || {};

// Easy initialization function
window.initHockeyWidget = function(containerId, config) {
    console.log('Initializing hockey widget:', containerId);
    try {
        window.HockeyWidgets[containerId] = new HockeyCardWidget(containerId, config);
        return window.HockeyWidgets[containerId];
    } catch (error) {
        console.error('Error initializing hockey widget:', error);
        return null;
    }
};
