document.addEventListener('DOMContentLoaded', () => {

    const NAV_ITEMS = document.querySelectorAll('.nav-item');
    const VIEWS = document.querySelectorAll('.view');
    const mainContent = document.querySelector('.main-content');
    const addAssetForm = document.getElementById('addAssetForm');
    
    // --- MODAL REFS ---
    const updateAssetModal = document.getElementById('updateAssetModal');
    const updateAssetForm = document.getElementById('updateAssetForm');
    const sellAssetModal = document.getElementById('sellAssetModal');
    const sellAssetForm = document.getElementById('sellAssetForm');
    document.querySelectorAll('[data-close-modal]').forEach(btn => {
        btn.addEventListener('click', () => closeAllModals());
    });

    const totalPortfolioValueEl = document.getElementById('total-portfolio-value');
    const totalAssetsCountEl = document.getElementById('total-assets-count');
    const totalGainLossEl = document.getElementById('total-gain-loss');
    
    const tableBodies = {
        stocks: document.getElementById('stocks-table-body'),
        bonds: document.getElementById('bonds-table-body'),
        commodities: document.getElementById('commodities-table-body')
    };

    const commodityMap = {
        "Gold": "GC=F", "Silver": "SI=F", "Crude Oil": "CL=F", "Natural Gas": "NG=F",
        "Copper": "HG=F", "Corn": "ZC=F", "Wheat": "ZW=F", "Soybeans": "ZS=F"
    };

    const stockSymbolInput = document.getElementById('stockSymbolInput');
    const getPerformanceBtn = document.getElementById('getPerformanceBtn');
    const performanceChartContainer = document.querySelector('.performance-chart-container');
    const rangeButtons = document.querySelectorAll('.range-btn');
    const customDateRange = document.getElementById('customDateRange');
    const startDateInput = document.getElementById('startDateInput');
    const endDateInput = document.getElementById('endDateInput');
    
    const assetCategorySelect = document.getElementById('assetCategory');
    const stockBondFields = document.getElementById('stock-bond-fields');
    const commodityFields = document.getElementById('commodity-fields');
    const commodityTypeSelect = document.getElementById('commodityType');

    let portfolioAssets = []; // This will hold the COMBINED assets
    let rawPortfolioAssets = []; // This will hold the raw assets from the DB
    let allocationPieChart, stockPerformanceChart;
    let categoryPerformanceCharts = {}; // To hold the new category charts

    const subtitles = {
        'dashboard': "Welcome back! Here's your portfolio overview", 'stocks': 'Manage your stock holdings',
        'bonds': 'Manage your bond holdings', 'commodities': 'Manage your commodity holdings',
        'performance': 'Analyze historical performance', 'history': 'Review your transaction history',
        'add-asset': 'Add a new investment to your portfolio'
    };

    const toggleAssetFormFields = () => { /* ... (no changes) ... */ };
    const populateCommoditySelect = () => { /* ... (no changes) ... */ };

    window.showView = (viewId) => { /* ... (no changes) ... */ };

    NAV_ITEMS.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            showView(viewId);
        });
    });

    // --- CHART INITIALIZATION ---
    const createLineChart = (canvasId) => {
        const ctx = document.getElementById(canvasId)?.getContext('2d');
        if (!ctx) return null;
        return new Chart(ctx, {
            type: 'line', data: { datasets: [{ data: [], borderWidth: 2, pointRadius: 0, tension: 0.1, fill: true }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', adapters: { date: { id: 'date-fns' } }, time: { unit: 'day' } },
                    y: { ticks: { callback: (v) => `$${v.toLocaleString()}` } }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
            }
        });
    };

    const initializeCharts = () => {
        // Allocation Pie Chart
        const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
        if (allocationCtx) {
            allocationPieChart = new Chart(allocationCtx, { /* ... (no changes) ... */ });
        }
        // Individual Performance Chart
        stockPerformanceChart = createLineChart('stockPerformanceChart');
        if (stockPerformanceChart) performanceChartContainer.style.display = 'none';

        // Category Performance Charts
        categoryPerformanceCharts.stocks = createLineChart('stocks-performance-chart');
        categoryPerformanceCharts.bonds = createLineChart('bonds-performance-chart');
        categoryPerformanceCharts.commodities = createLineChart('commodities-performance-chart');
    };
    
    // --- DATA PROCESSING ---
    const combineAssets = (assets) => {
        const combined = new Map();
        assets.forEach(asset => {
            const existing = combined.get(asset.symbol);
            if (existing) {
                const totalShares = existing.shares + asset.shares;
                const weightedCost = (existing.price * existing.shares) + (asset.price * asset.shares);
                existing.price = weightedCost / totalShares; // new avg price
                existing.shares = totalShares;
                existing.id = asset.id; // Keep the ID of the last raw asset for selling purposes
            } else {
                combined.set(asset.symbol, { ...asset });
            }
        });
        return Array.from(combined.values());
    };

    const updateDashboard = (liveDataMap) => {
        if (!totalPortfolioValueEl || !totalAssetsCountEl) return;
        let totalValue = 0, totalCost = 0;
        const allocation = { stocks: 0, bonds: 0, commodities: 0 };
        portfolioAssets.forEach(asset => {
            const livePrice = liveDataMap.get(asset.symbol) || asset.price;
            const marketValue = asset.shares * livePrice;
            const costBasis = asset.shares * asset.price;
            totalValue += marketValue;
            totalCost += costBasis;
            if (allocation.hasOwnProperty(asset.category)) {
                allocation[asset.category] += marketValue;
            }
        });
        const gainLoss = totalValue - totalCost;
        totalPortfolioValueEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
        totalAssetsCountEl.textContent = portfolioAssets.length; // Use combined length
        totalGainLossEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(gainLoss);
        totalGainLossEl.className = gainLoss >= 0 ? 'positive' : 'negative';
        if (allocationPieChart) {
            allocationPieChart.data.labels = Object.keys(allocation).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            allocationPieChart.data.datasets[0].data = Object.values(allocation);
            allocationPieChart.update();
        }
    };
    
    // --- RENDERING ---
    const renderCategoryTable = (assets, tableBody, liveDataMap) => {
        tableBody.innerHTML = '';
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;">No assets in this category.</td></tr>`;
            return;
        }
        assets.forEach(asset => {
            const livePrice = liveDataMap.get(asset.symbol) || asset.price;
            const marketValue = asset.shares * livePrice;
            const gainLoss = marketValue - (asset.shares * asset.price);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Asset"><strong>${asset.symbol}</strong><br><small>${asset.name}</small></td>
                <td data-label="Shares">${asset.shares.toFixed(2)}</td>
                <td data-label="Avg. Price">$${asset.price.toFixed(2)}</td>
                <td data-label="Current Price"><strong>$${livePrice.toFixed(2)}</strong></td>
                <td data-label="Market Value">$${marketValue.toFixed(2)}</td>
                <td data-label="Gain/Loss"><div class="${gainLoss >= 0 ? 'positive' : 'negative'}">$${gainLoss.toFixed(2)}</div></td>
                <td data-label="Actions">
                    <button title="Sell" class="sell-btn" data-asset-id="${asset.id}"><i class="fas fa-dollar-sign"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    const renderCategoryPerformanceChart = async (category, chart) => {
        const assetsInCategory = rawPortfolioAssets.filter(a => a.category === category);
        if (!chart || assetsInCategory.length === 0) return;
        
        try {
            const historicalDataPromises = assetsInCategory.map(asset => 
                fetch(`http://localhost:3000/api/historical-data/${asset.symbol}?range=365d`)
                    .then(res => res.ok ? res.json() : [])
            );
            const historicalDataArrays = await Promise.all(historicalDataPromises);
            
            const dailyTotals = new Map();
            historicalDataArrays.forEach((data, index) => {
                const asset = assetsInCategory[index];
                data.forEach(point => {
                    const date = new Date(point.x).setHours(0,0,0,0);
                    const value = point.y * asset.shares;
                    dailyTotals.set(date, (dailyTotals.get(date) || 0) + value);
                });
            });

            if(dailyTotals.size === 0) {
                 chart.canvas.style.display = 'none';
                 return;
            } else {
                 chart.canvas.style.display = 'block';
            }

            const chartData = Array.from(dailyTotals.entries())
                .map(([date, totalValue]) => ({ x: date, y: totalValue }))
                .sort((a, b) => a.x - b.x);

            chart.data.datasets[0].data = chartData;
            chart.data.datasets[0].label = `${category.charAt(0).toUpperCase() + category.slice(1)} Portfolio Value`;
            chart.data.datasets[0].borderColor = category === 'stocks' ? '#0d9488' : category === 'bonds' ? '#f59e0b' : '#10b981';
            chart.data.datasets[0].backgroundColor = category === 'stocks' ? 'rgba(13, 148, 136, 0.1)' : category === 'bonds' ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)';
            chart.update();
        } catch (error) {
            console.error(`Failed to render performance chart for ${category}:`, error);
        }
    };
    
    // --- DATA FETCHING ---
    const fetchAndRenderData = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/assets');
            if (!response.ok) throw new Error('Network response was not ok');
            rawPortfolioAssets = await response.json(); // Store raw data
            portfolioAssets = combineAssets(rawPortfolioAssets); // Process into combined assets

            portfolioAssets.forEach(asset => {
                if (asset.category) asset.category = asset.category.toLowerCase();
            });

            const allSymbols = [...new Set(portfolioAssets.map(a => a.symbol))];
            const fetchPrice = (symbol) => 
                fetch(`http://localhost:3000/api/current-price/${symbol}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => ({ symbol, currentPrice: data ? data.currentPrice : null }))
                    .catch(() => ({ symbol, currentPrice: null }));

            const liveDataResults = await Promise.all(allSymbols.map(symbol => fetchPrice(symbol)));
            const liveDataMap = new Map();
            liveDataResults.forEach(d => {
                if (d && d.currentPrice !== null) liveDataMap.set(d.symbol, d.currentPrice);
            });

            // Update UI
            updateDashboard(liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'stocks'), tableBodies.stocks, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'bonds'), tableBodies.bonds, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'commodities'), tableBodies.commodities, liveDataMap);

            // Render category charts
            renderCategoryPerformanceChart('stocks', categoryPerformanceCharts.stocks);
            renderCategoryPerformanceChart('bonds', categoryPerformanceCharts.bonds);
            renderCategoryPerformanceChart('commodities', categoryPerformanceCharts.commodities);

        } catch (error) {
            console.error('Failed to fetch and render data:', error);
        }
    };

    const fetchAndRenderTransactions = async () => { /* ... (no changes) ... */ };
    const fetchAndRenderPerformanceData = async () => { /* ... (no changes) ... */ };

    // --- FORM & MODAL HANDLING ---
    if (addAssetForm) {
        addAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            // ... (validation logic is the same) ...
            const newAsset = { /* ... */ };
            try {
                await fetch('http://localhost:3000/api/add-asset', { /* ... */ });
                addAssetForm.reset();
                toggleAssetFormFields();
                await fetchAndRenderData(); // Re-fetch all data
                showView(newAsset.category);
            } catch (error) { /* ... */ }
        });
    }
    
    const openModal = (modal) => {
        modal.style.display = 'flex';
        setTimeout(() => modal.classList.add('active'), 10);
    };

    const closeAllModals = () => {
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.classList.remove('active');
            setTimeout(() => { modal.style.display = 'none'; }, 300);
        });
    };

    const openSellModal = (asset) => {
        document.getElementById('sellAssetId').value = asset.id;
        document.getElementById('sell-asset-name').textContent = `Sell ${asset.name} (${asset.symbol})`;
        const sharesInput = document.getElementById('sellAssetShares');
        sharesInput.value = '';
        sharesInput.max = asset.shares;
        document.getElementById('max-shares-info').textContent = `Max: ${asset.shares.toFixed(4)}`;
        document.getElementById('sellAssetPrice').value = '';
        openModal(sellAssetModal);
    };

    if (sellAssetForm) {
        sellAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const assetId = document.getElementById('sellAssetId').value;
            const volumeSold = parseFloat(document.getElementById('sellAssetShares').value);
            const salePrice = parseFloat(document.getElementById('sellAssetPrice').value);
            const asset = portfolioAssets.find(a => a.id == assetId);
            
            if (!asset || isNaN(volumeSold) || isNaN(salePrice) || volumeSold <= 0 || salePrice <= 0 || volumeSold > asset.shares) {
                alert('Please enter a valid quantity and price.');
                return;
            }

            try {
                const response = await fetch(`http://localhost:3000/api/delete-asset/${assetId}`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ volumeSold, salePrice })
                });
                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Failed to sell asset.');
                }
                closeAllModals();
                await fetchAndRenderData();
            } catch (error) {
                console.error('Error selling asset:', error);
                alert(`Error: ${error.message}`);
            }
        });
    }

    if (mainContent) {
        mainContent.addEventListener('click', async (e) => {
            const sellButton = e.target.closest('.sell-btn');
            if (sellButton) {
                const assetId = sellButton.getAttribute('data-asset-id');
                const asset = portfolioAssets.find(a => a.id == assetId);
                if (asset) openSellModal(asset);
            }
        });
    }

    if (getPerformanceBtn) getPerformanceBtn.addEventListener('click', fetchAndRenderPerformanceData);
    rangeButtons.forEach(button => button.addEventListener('click', () => {
        rangeButtons.forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        customDateRange.style.display = button.dataset.range === 'custom' ? 'flex' : 'none';
    }));

    if (assetCategorySelect) assetCategorySelect.addEventListener('change', toggleAssetFormFields);

    initializeCharts();
    populateCommoditySelect();
    toggleAssetFormFields();
    fetchAndRenderData();
});