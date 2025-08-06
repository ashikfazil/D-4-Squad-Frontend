document.addEventListener('DOMContentLoaded', () => {

    const NAV_ITEMS = document.querySelectorAll('.nav-item');
    const VIEWS = document.querySelectorAll('.view');
    const mainContent = document.querySelector('.main-content');
    const addAssetForm = document.getElementById('addAssetForm');

    // --- NEW: Cash Wallet Elements ---
    const addCashModal = document.getElementById('addCashModal');
    const addCashForm = document.getElementById('addCashForm');
    const addCashBtn = document.getElementById('addCashBtn');
    const closeAddCashModalBtn = document.getElementById('closeAddCashModal');
    const cancelAddCashBtn = document.getElementById('cancelAddCash');
    const cashBalanceEl = document.getElementById('cash-balance');
    let currentCashBalance = 0;
    let categoryValueChart;

    const totalPortfolioValueEl = document.getElementById('total-portfolio-value');
    const totalAssetsCountEl = document.getElementById('total-assets-count');
    const totalGainLossEl = document.getElementById('total-gain-loss');
    
    const tableBodies = {
        stocks: document.getElementById('stocks-table-body'),
        bonds: document.getElementById('bonds-table-body'),
        commodities: document.getElementById('commodities-table-body')
    };

    const commodityMap = {
        "Gold": "GC=F",
        "Silver": "SI=F",
        "Crude Oil": "CL=F",
        "Natural Gas": "NG=F",
        "Copper": "HG=F",
        "Corn": "ZC=F",
        "Wheat": "ZW=F",
        "Soybeans": "ZS=F"
    };

    const stockSymbolInput = document.getElementById('stockSymbolInput');
    const getPerformanceBtn = document.getElementById('getPerformanceBtn');
    const performanceChartContainer = document.querySelector('.performance-chart-container');
    const rangeButtons = document.querySelectorAll('.range-btn');
    const customDateRange = document.getElementById('customDateRange');
    const startDateInput = document.getElementById('startDateInput');
    const endDateInput = document.getElementById('endDateInput');
    
    // --- Comparison View Elements ---
    const getComparisonBtn = document.getElementById('getComparisonBtn');
    const comparisonChartContainer = document.getElementById('comparisonChartContainer');
    const comparisonSymbol1Input = document.getElementById('comparisonSymbol1');
    const comparisonSymbol2Input = document.getElementById('comparisonSymbol2');
    const comparisonChart1Title = document.getElementById('comparisonChart1Title');
    const comparisonChart2Title = document.getElementById('comparisonChart2Title');


    const assetCategorySelect = document.getElementById('assetCategory');
    const stockBondFields = document.getElementById('stock-bond-fields');
    const commodityFields = document.getElementById('commodity-fields');
    const commodityTypeSelect = document.getElementById('commodityType');

    let portfolioAssets = [];
    let allocationPieChart;
    let stockPerformanceChart;
    let comparisonChart1, comparisonChart2;


    const subtitles = {
        'dashboard': "Welcome back! Here's your portfolio overview",
        'stocks': 'Manage your stock holdings',
        'bonds': 'Manage your bond holdings',
        'commodities': 'Manage your commodity holdings',
        'performance': 'Analyze historical performance',
        'history': 'Review your transaction history',
        'add-asset': 'Add a new investment to your portfolio',
        'comparison': 'Compare the historical performance of two assets'
    };

    const fetchAndDisplayWalletBalance = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/wallet');
            if (!response.ok) throw new Error('Failed to fetch balance');
            const data = await response.json();
            currentCashBalance = parseFloat(data.balance);
            cashBalanceEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentCashBalance);
        } catch (error) {
            console.error('Error fetching wallet balance:', error);
            cashBalanceEl.textContent = 'Error';
        }
    };

    const toggleAssetFormFields = () => {
        const selectedCategory = assetCategorySelect.value;
        if (selectedCategory === 'commodities') {
            stockBondFields.style.display = 'none';
            commodityFields.style.display = 'block';
            document.getElementById('assetName').required = false;
            document.getElementById('assetSymbol').required = false;
            commodityTypeSelect.required = true;
        } else {
            stockBondFields.style.display = 'block';
            commodityFields.style.display = 'none';
            document.getElementById('assetName').required = true;
            document.getElementById('assetSymbol').required = true;
            commodityTypeSelect.required = false;
        }
    };
    const initializeCategoryValueChart = () => {
        const ctx = document.getElementById('categoryValueChart')?.getContext('2d');
        if (!ctx) return;
    
        categoryValueChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Stocks Value',
                        data: [],
                        borderColor: '#0d9488',
                        fill: false,
                    },
                    {
                        label: 'Bonds Value',
                        data: [],
                        borderColor: '#f59e0b',
                        fill: false,
                    },
                    {
                        label: 'Commodities Value',
                        data: [],
                        borderColor: '#10b981',
                        fill: false,
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        type: 'time',
                        time: {
                            unit: 'day'
                        }
                    },
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    };
    
    // Add this function to fetch and render the new chart's data
    const fetchAndRenderCategoryValueData = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/historical-value-by-category');
            if (!response.ok) throw new Error('Failed to fetch historical category value');
            const data = await response.json();
    
            const labels = Object.keys(data);
            const stocksData = labels.map(date => data[date].stocks);
            const bondsData = labels.map(date => data[date].bonds);
            const commoditiesData = labels.map(date => data[date].commodities);
    
            categoryValueChart.data.labels = labels;
            categoryValueChart.data.datasets[0].data = stocksData;
            categoryValueChart.data.datasets[1].data = bondsData;
            categoryValueChart.data.datasets[2].data = commoditiesData;
            categoryValueChart.update();
        } catch (error) {
            console.error('Error rendering category value chart:', error);
        }
    };
    const populateCommoditySelect = () => {
        commodityTypeSelect.innerHTML = ''; 
        for (const [name, symbol] of Object.entries(commodityMap)) {
            const option = document.createElement('option');
            option.value = symbol;
            option.textContent = name;
            commodityTypeSelect.appendChild(option);
        }
    };

    window.showView = (viewId) => {
        VIEWS.forEach(view => view.classList.remove('active'));
        NAV_ITEMS.forEach(item => item.classList.remove('active'));
        const targetView = document.getElementById(`${viewId}-view`);
        if (targetView) targetView.classList.add('active');
        const targetNavItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (targetNavItem) targetNavItem.classList.add('active');
        const pageTitle = document.querySelector('.page-title');
        const pageSubtitle = document.querySelector('.page-subtitle');
        if (pageTitle && pageSubtitle && targetNavItem) {
            pageTitle.textContent = targetNavItem.querySelector('span').textContent;
            pageSubtitle.textContent = subtitles[viewId] || '';
        }
        if (viewId === 'history') {
            fetchAndRenderTransactions();
        }
    };

    NAV_ITEMS.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            showView(viewId);
        });
    });

    const initializeCharts = () => {
        const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
        if (allocationCtx) {
            allocationPieChart = new Chart(allocationCtx, {
                type: 'pie',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Asset Allocation',
                        data: [],
                        backgroundColor: ['#0d9488', '#f59e0b', '#10b981', '#6b7280'],
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom' },
                        tooltip: {
                            callbacks: {
                                label: (c) => `${c.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c.raw)}`
                            }
                        }
                    }
                }
            });
        }
    };

    const initializePerformanceChart = () => {
        const ctx = document.getElementById('stockPerformanceChart')?.getContext('2d');
        if (!ctx) return;
        
        stockPerformanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Stock Price (USD)',
                    data: [],
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', adapters: { date: { id: 'date-fns' } }, time: { unit: 'day' }, title: { display: true, text: 'Date' } },
                    y: { title: { display: true, text: 'Closing Price ($)' } }
                },
                plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } }
            }
        });
        performanceChartContainer.style.display = 'none'; 
    };

    // --- MODIFIED: Updated initialization function for comparison charts ---
    const initializeComparisonCharts = () => {
        const chart1Ctx = document.getElementById('comparisonChart1')?.getContext('2d');
        const chart2Ctx = document.getElementById('comparisonChart2')?.getContext('2d');
        if (!chart1Ctx || !chart2Ctx) return;

        // More robust options to ensure correct rendering
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false, // This is crucial
            scales: {
                x: { 
                    type: 'time', 
                    time: { unit: 'day' }, 
                    title: { display: false } 
                },
                y: { 
                    title: { display: true, text: 'Price ($)' } 
                }
            },
            plugins: { 
                legend: { display: false },
                tooltip: { mode: 'index', intersect: false }
            }
        };

        const chartConfig = (label) => ({
            type: 'line',
            data: {
                datasets: [{
                    label: label,
                    data: [],
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.1,
                    fill: true,
                }]
            },
            options: chartOptions
        });

        comparisonChart1 = new Chart(chart1Ctx, chartConfig('Asset 1'));
        comparisonChart2 = new Chart(chart2Ctx, chartConfig('Asset 2'));
    };


    const updateDashboard = (liveDataMap) => {
        if (!totalPortfolioValueEl || !totalAssetsCountEl) return;
        
        let totalAssetsMarketValue = 0;
        let totalAssetsCostBasis = 0;
        const allocationForChart = { stocks: 0, bonds: 0, commodities: 0, cash: currentCashBalance }; 
        
        portfolioAssets.forEach(asset => {
            const livePrice = liveDataMap.get(asset.symbol) || asset.price;
            const assetMarketValue = asset.shares * livePrice;
            const assetCostBasis = asset.shares * asset.price;
            
            totalAssetsMarketValue += assetMarketValue;
            totalAssetsCostBasis += assetCostBasis;

            if (allocationForChart.hasOwnProperty(asset.category)) {
                allocationForChart[asset.category] += assetMarketValue;
            }
        });

        const grandTotalPortfolioValue = totalAssetsMarketValue + currentCashBalance;
        const totalAssetsGainLoss = totalAssetsMarketValue - totalAssetsCostBasis;

        totalPortfolioValueEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grandTotalPortfolioValue);
        totalAssetsCountEl.textContent = portfolioAssets.length;
        totalGainLossEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalAssetsGainLoss);
        totalGainLossEl.className = totalAssetsGainLoss >= 0 ? 'positive' : 'negative';

        if (allocationPieChart) {
            allocationPieChart.data.labels = Object.keys(allocationForChart).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            allocationPieChart.data.datasets[0].data = Object.values(allocationForChart);
            allocationPieChart.update();
        }
    };

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
            const gainLossClass = gainLoss >= 0 ? 'positive' : 'negative';
            const arrowClass = gainLoss >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            const gainLossHTML = `<div class="${gainLossClass}" style="display:flex; align-items:center; gap: 0.5rem;"><i class="fas ${arrowClass}"></i><span>$${gainLoss.toFixed(2)}</span></div>`;
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Asset"><strong>${asset.symbol}</strong><br><small>${asset.name}</small></td>
                <td data-label="Shares">${asset.shares.toFixed(2)}</td>
                <td data-label="Purchase Price">$${asset.price.toFixed(2)}</td>
                <td data-label="Current Price"><strong>$${livePrice.toFixed(2)}</strong></td>
                <td data-label="Market Value">$${marketValue.toFixed(2)}</td>
                <td data-label="Gain/Loss">${gainLossHTML}</td>
                <td data-label="Actions">
                    <button title="Delete" class="delete-btn" data-asset-id="${asset.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    const fetchAndRenderData = async () => {
        try {
            await Promise.all([
                fetchAndDisplayWalletBalance(),
                (async () => {
                    const response = await fetch('http://localhost:3000/api/assets');
                    if (!response.ok) throw new Error('Network response was not ok');
                    portfolioAssets = await response.json();

                    portfolioAssets.forEach(asset => {
                        if (asset.category) asset.category = asset.category.toLowerCase();
                    });

                    const allSymbols = [...new Set(portfolioAssets.map(a => a.symbol))];
                    const fetchPrice = (symbol) => 
                        fetch(`http://localhost:3000/api/current-price/${symbol}`)
                            .then(res => res.ok ? res.json() : null)
                            .then(data => ({ symbol, currentPrice: data ? data.currentPrice : null }))
                            .catch(() => ({ symbol, currentPrice: null }));

                    const pricePromises = allSymbols.map(symbol => fetchPrice(symbol));
                    const liveDataResults = await Promise.all(pricePromises);

                    const liveDataMap = new Map();
                    liveDataResults.forEach(d => {
                        if (d && d.currentPrice !== null) {
                            liveDataMap.set(d.symbol, d.currentPrice);
                        }
                    });

                    updateDashboard(liveDataMap);
                    renderCategoryTable(portfolioAssets.filter(a => a.category === 'stocks'), tableBodies.stocks, liveDataMap);
                    renderCategoryTable(portfolioAssets.filter(a => a.category === 'bonds'), tableBodies.bonds, liveDataMap);
                    renderCategoryTable(portfolioAssets.filter(a => a.category === 'commodities'), tableBodies.commodities, liveDataMap);
                })()
            ]);
        } catch (error) {
            console.error('Failed to fetch and render data:', error);
        }
    };

    const fetchAndRenderTransactions = async () => {
        const tbody = document.getElementById('transaction-table-body');
        try {
            const response = await fetch('http://localhost:3000/api/transactions');
            if (!response.ok) throw new Error('Failed to fetch transactions');
            const transactions = await response.json();
            tbody.innerHTML = '';
            if (transactions.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1rem;">No transactions found.</td></tr>`;
                return;
            }
            transactions.forEach(tx => {
                const formattedDate = new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td data-label="Name">${tx.name}</td>
                    <td data-label="Category">${tx.category.toLowerCase()}</td>
                    <td data-label="Type" class="${tx.transaction_type === 'buy' ? 'transaction-type-buy' : 'transaction-type-sell'}">${tx.transaction_type.toLowerCase()}</td>
                    <td data-label="Price">$${parseFloat(tx.price).toFixed(2)}</td>
                    <td data-label="Quantity">${tx.quantity}</td>
                    <td data-label="Date">${formattedDate}</td>
                `;
                tbody.appendChild(row);
            });
        } catch (error) {
            console.error('Error loading transactions:', error);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1rem;">Error loading data.</td></tr>`;
        }
    };

    const fetchAndRenderPerformanceData = async () => {
        const symbol = stockSymbolInput.value;
        if (!symbol) { alert('Please enter a stock symbol.'); return; }
        const activeRangeBtn = document.querySelector('.range-btn.active');
        const range = activeRangeBtn ? activeRangeBtn.dataset.range : 'custom';
        let url = `http://localhost:3000/api/historical-data/${symbol}?range=${range}`;
        if (range === 'custom') {
            const startDate = startDateInput.value;
            if (!startDate) { alert('Please select a start date for the custom range.'); return; }
            url += `&startDate=${startDate}`;
            if(endDateInput.value) url += `&endDate=${endDateInput.value}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) { const err = await response.json(); throw new Error(err.error || 'Failed to fetch data'); }
            const data = await response.json();
            if (data.length === 0) { alert('No historical data found for the selected symbol and range.'); performanceChartContainer.style.display = 'none'; return; }
            stockPerformanceChart.data.datasets[0].label = `${symbol.toUpperCase()} Price (USD)`;
            stockPerformanceChart.data.datasets[0].data = data;
            stockPerformanceChart.update();
            performanceChartContainer.style.display = 'block';
        } catch (error) {
            console.error('Error fetching performance data:', error);
            alert(`Error: ${error.message}`);
            performanceChartContainer.style.display = 'none';
        }
    };

    const fetchAndRenderComparisonData = async () => {
        const symbol1 = comparisonSymbol1Input.value.trim().toUpperCase();
        const symbol2 = comparisonSymbol2Input.value.trim().toUpperCase();

        if (!symbol1 || !symbol2) {
            alert('Please enter two asset tickers to compare.');
            return;
        }

        const activeRangeBtn = document.querySelector('#comparison-view .range-btn.active');
        const range = activeRangeBtn ? activeRangeBtn.dataset.range : '30d';

        const buildUrl = (symbol) => `http://localhost:3000/api/historical-data/${symbol}?range=${range}`;

        try {
            const [response1, response2] = await Promise.all([
                fetch(buildUrl(symbol1)),
                fetch(buildUrl(symbol2))
            ]);

            const data1 = response1.ok ? await response1.json() : null;
            const data2 = response2.ok ? await response2.json() : null;

            if (!data1 || !data2) {
                let errorMessage = '';
                if (!data1) errorMessage += `Could not fetch data for ${symbol1}. `;
                if (!data2) errorMessage += `Could not fetch data for ${symbol2}.`;
                throw new Error(errorMessage);
            }

            comparisonChart1Title.textContent = symbol1;
            comparisonChart1.data.datasets[0].data = data1;
            comparisonChart1.update();

            comparisonChart2Title.textContent = symbol2;
            comparisonChart2.data.datasets[0].data = data2;
            comparisonChart2.update();

            comparisonChartContainer.style.display = 'grid'; // Use grid to display side-by-side

        } catch (error) {
            console.error('Error fetching comparison data:', error);
            alert(`An error occurred: ${error.message}`);
            comparisonChartContainer.style.display = 'none';
        }
    };

    if (addAssetForm) {
        addAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const symbolErrorEl = document.getElementById('assetSymbolError');
            const dateErrorEl = document.getElementById('purchaseDateError');
            const sharesErrorEl = document.getElementById('sharesError');
            symbolErrorEl.textContent = ''; 
            dateErrorEl.textContent = '';
            sharesErrorEl.textContent = '';

            let isValid = true;
            
            const shares = parseFloat(document.getElementById('shares').value);
            const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
            const totalCost = shares * purchasePrice;

            if (totalCost > currentCashBalance) {
                alert(`Insufficient funds. Purchase cost: $${totalCost.toFixed(2)}, Your balance: $${currentCashBalance.toFixed(2)}.`);
                return;
            }

            if (isNaN(shares) || shares < 1) {
                sharesErrorEl.textContent = 'Quantity must be at least 1.';
                isValid = false;
            }

            const purchaseDate = new Date(document.getElementById('purchaseDate').value);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            if (purchaseDate > today) { 
                dateErrorEl.textContent = 'Purchase date cannot be in the future.'; 
                isValid = false; 
            }

            const category = assetCategorySelect.value;
            let assetSymbol, assetName;

            if (category === 'commodities') {
                assetSymbol = commodityTypeSelect.value;
                assetName = commodityTypeSelect.options[commodityTypeSelect.selectedIndex].text;
            } else {
                assetSymbol = document.getElementById('assetSymbol').value.toUpperCase();
                assetName = document.getElementById('assetName').value;
                if (!assetSymbol) { 
                    symbolErrorEl.textContent = "Symbol is required."; 
                    isValid = false; 
                }
                else if (category === 'stocks' || category === 'bonds') {
                    try {
                        const response = await fetch(`http://localhost:3000/api/validate-ticker/${assetSymbol}`);
                        if (!response.ok) { 
                            const err = await response.json(); 
                            symbolErrorEl.textContent = err.error || "Invalid ticker symbol."; 
                            isValid = false; 
                        }
                    } catch (error) { 
                        symbolErrorEl.textContent = "Could not validate symbol. Please try again."; 
                        isValid = false; 
                    }
                }
            }

            if (!isValid) return;

            const newAsset = { 
                assetName, 
                assetSymbol, 
                shares, 
                purchasePrice, 
                purchaseDate: document.getElementById('purchaseDate').value, 
                category 
            };
            try {
                const response = await fetch('http://localhost:3000/api/add-asset', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify(newAsset) 
                });

                if (!response.ok) {
                    const err = await response.json();
                    throw new Error(err.error || 'Server error on adding asset.');
                }

                addAssetForm.reset();
                toggleAssetFormFields();
                showView(newAsset.category);
                await fetchAndRenderData();
            } catch (error) { 
                console.error('Error adding asset:', error); 
                alert(`An error occurred while adding the asset: ${error.message}`); 
            }
        });
    }

    const openAddCashModal = () => {
        addCashModal.style.display = 'flex';
        setTimeout(() => addCashModal.classList.add('active'), 10);
    };

    const closeAddCashModal = () => {
        addCashModal.classList.remove('active');
        setTimeout(() => { addCashModal.style.display = 'none'; }, 300);
    };

    if (addCashBtn) addCashBtn.addEventListener('click', openAddCashModal);
    if (closeAddCashModalBtn) closeAddCashModalBtn.addEventListener('click', closeAddCashModal);
    if (cancelAddCashBtn) cancelAddCashBtn.addEventListener('click', closeAddCashModal);
    
    if (addCashForm) {
        addCashForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amountInput = document.getElementById('addCashAmount');
            const amount = parseFloat(amountInput.value);
            if (isNaN(amount) || amount <= 0) {
                alert('Please enter a valid positive amount.');
                return;
            }
            try {
                await fetch('http://localhost:3000/api/wallet/add', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ amount })
                });
                closeAddCashModal();
                await fetchAndDisplayWalletBalance();
                amountInput.value = '';
            } catch (error) {
                console.error('Error adding funds:', error);
                alert('Failed to add funds.');
            }
        });
    }

    if (mainContent) {
        mainContent.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                const assetId = deleteButton.getAttribute('data-asset-id');
                const asset = portfolioAssets.find(a => a.id == assetId);
                if (!asset) return;
                const sharesToSell = prompt(`How many shares of ${asset.symbol} to sell? (Max: ${asset.shares})`);
                if (sharesToSell === null || sharesToSell.trim() === '') return;
                const volumeSold = parseFloat(sharesToSell);
                if (isNaN(volumeSold) || volumeSold <= 0 || volumeSold > asset.shares) { 
                    alert(`Invalid input. Please enter a number between 0 and ${asset.shares}.`); 
                    return; 
                }
                try {
                    const response = await fetch(`http://localhost:3000/api/delete-asset/${assetId}`, { 
                        method: 'DELETE', 
                        headers: { 'Content-Type': 'application/json' }, 
                        body: JSON.stringify({ volumeSold }) 
                    });
                     if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.error);
                    }
                    await fetchAndRenderData();
                } catch (error) { 
                    alert(`Error: ${error.message}`);
                    console.error('Error selling asset:', error); 
                }
            }
        });
    }

    if (getPerformanceBtn) getPerformanceBtn.addEventListener('click', fetchAndRenderPerformanceData);
    
    rangeButtons.forEach(button => button.addEventListener('click', (e) => {
        const parentSelector = e.target.closest('.range-selector');
        if(!parentSelector) return;

        parentSelector.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
        button.classList.add('active');
        
        const parentView = button.closest('.view');
        const customDateEl = parentView.querySelector('.custom-date-range');
        if(customDateEl) {
            customDateEl.style.display = button.dataset.range === 'custom' ? 'flex' : 'none';
        }
    }));
    
    if (getComparisonBtn) {
        getComparisonBtn.addEventListener('click', fetchAndRenderComparisonData);
    }

    if (assetCategorySelect) assetCategorySelect.addEventListener('change', toggleAssetFormFields);

    // --- Initialize all charts on load ---
    initializeCharts();
    initializePerformanceChart();
    initializeComparisonCharts();
    initializeCategoryValueChart(); // Add this line
    populateCommoditySelect();
    toggleAssetFormFields();
    fetchAndRenderData();
    fetchAndRenderCategoryValueData();
});