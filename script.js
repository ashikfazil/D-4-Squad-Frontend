document.addEventListener('DOMContentLoaded', () => {

    const NAV_ITEMS = document.querySelectorAll('.nav-item');
    const VIEWS = document.querySelectorAll('.view');
    const mainContent = document.querySelector('.main-content');
    const addAssetForm = document.getElementById('addAssetForm');
    
    // Cash Wallet Modal
    const addCashModal = document.getElementById('addCashModal');
    const addCashForm = document.getElementById('addCashForm');
    const addCashBtn = document.getElementById('addCashBtn');
    const closeAddCashModalBtn = document.getElementById('closeAddCashModal');
    const cancelAddCashBtn = document.getElementById('cancelAddCash');
    const cashBalanceEl = document.getElementById('cash-balance');
    let currentCashBalance = 0;

    // Sell Asset Modal
    const sellAssetModal = document.getElementById('sellAssetModal');
    const sellAssetForm = document.getElementById('sellAssetForm');
    const closeSellModalBtn = document.getElementById('closeSellModal');
    const cancelSellModalBtn = document.getElementById('cancelSellModal');
    const sellAssetSymbolEl = document.getElementById('sellAssetSymbol');
    const sellQuantityInput = document.getElementById('sellQuantity');
    const sellAssetIdInput = document.getElementById('sellAssetId');


    const totalPortfolioValueEl = document.getElementById('total-portfolio-value');
    const totalAssetsCountEl = document.getElementById('total-assets-count');
    const totalGainLossEl = document.getElementById('total-gain-loss');
    
    const tableBodies = {
        stocks: document.getElementById('stocks-table-body'),
        bonds: document.getElementById('bonds-table-body'),
        commodities: document.getElementById('commodities-table-body')
    };

    const commodityMap = { "Gold": "GC=F", "Silver": "SI=F", "Crude Oil": "CL=F", "Natural Gas": "NG=F", "Copper": "HG=F", "Corn": "ZC=F", "Wheat": "ZW=F", "Soybeans": "ZS=F" };

    const stockSymbolInput1 = document.getElementById('stockSymbolInput1');
    const stockSymbolInput2 = document.getElementById('stockSymbolInput2');
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

    const emailReportBtn = document.getElementById('emailReportBtn');
    
    let portfolioAssets = [];
    let allocationPieChart;
    let stockPerformanceChart; 
    let categoryValueChart;

    const subtitles = { 'dashboard': "Welcome back! Here's your portfolio overview", 'stocks': 'Manage your stock holdings', 'bonds': 'Manage your bond holdings', 'commodities': 'Manage your commodity holdings', 'comparison': 'Compare historical performance of assets', 'history': 'Review your transaction history', 'add-asset': 'Add a new investment to your portfolio' };

    const fetchAndDisplayWalletBalance = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/wallet');
            if (!response.ok) throw new Error('Failed to fetch balance');
            const data = await response.json();
            currentCashBalance = parseFloat(data.balance);
            cashBalanceEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(currentCashBalance);
        } catch (error) { console.error('Error fetching wallet balance:', error); cashBalanceEl.textContent = 'Error'; }
    };

    const toggleAssetFormFields = () => {
        const selectedCategory = assetCategorySelect.value;
        stockBondFields.style.display = selectedCategory === 'commodities' ? 'none' : 'block';
        commodityFields.style.display = selectedCategory === 'commodities' ? 'block' : 'none';
        document.getElementById('assetName').required = selectedCategory !== 'commodities';
        document.getElementById('assetSymbol').required = selectedCategory !== 'commodities';
        commodityTypeSelect.required = selectedCategory === 'commodities';
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
        document.getElementById(`${viewId}-view`)?.classList.add('active');
        document.querySelector(`.nav-item[data-view="${viewId}"]`)?.classList.add('active');
        const pageTitle = document.querySelector('.page-title');
        const pageSubtitle = document.querySelector('.page-subtitle');
        const targetNavItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (pageTitle && pageSubtitle && targetNavItem) {
            pageTitle.textContent = targetNavItem.querySelector('span').textContent;
            pageSubtitle.textContent = subtitles[viewId] || '';
        }
        if (viewId === 'history') fetchAndRenderTransactions();
    };

    NAV_ITEMS.forEach(item => item.addEventListener('click', () => showView(item.getAttribute('data-view'))));

    const initializeCharts = () => {
        const allocationCtx = document.getElementById('allocationChart')?.getContext('2d');
        if (allocationCtx) {
            allocationPieChart = new Chart(allocationCtx, { type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#0d9488', '#f59e0b', '#10b981', '#6b7280'], borderColor: '#ffffff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c.raw)}` } } } } });
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

    const fetchAndRenderCategoryValueData = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/historical-value-by-category');
            if (!response.ok) throw new Error('Failed to fetch historical category value');
            const data = await response.json();
    
            const labels = Object.keys(data);
            const stocksData = labels.map(date => data[date].stocks);
            const bondsData = labels.map(date => data[date].bonds);
            const commoditiesData = labels.map(date => data[date].commodities);
    
            if (categoryValueChart) {
                categoryValueChart.data.labels = labels;
                categoryValueChart.data.datasets[0].data = stocksData;
                categoryValueChart.data.datasets[1].data = bondsData;
                categoryValueChart.data.datasets[2].data = commoditiesData;
                categoryValueChart.update();
            }
        } catch (error) {
            console.error('Error rendering category value chart:', error);
        }
    };

    const initializePerformanceChart = () => {
        const ctx = document.getElementById('stockPerformanceChart')?.getContext('2d');
        if (!ctx) return;
        stockPerformanceChart = new Chart(ctx, {
            type: 'line',
            data: {
                datasets: [{
                    label: 'Asset 1 (USD)',
                    data: [],
                    borderColor: 'var(--primary-color)',
                    backgroundColor: 'rgba(13, 148, 136, 0.1)',
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.1,
                    fill: true
                }, {
                    label: 'Asset 2 (USD)',
                    data: [],
                    borderColor: 'var(--secondary-color)',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    pointRadius: 1,
                    tension: 0.1,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: { type: 'time', time: { unit: 'day' }, title: { display: true, text: 'Date' } },
                    y: { title: { display: true, text: 'Closing Price ($)' } }
                },
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                }
            }
        });
        performanceChartContainer.style.display = 'none';
    };

    const updateDashboard = (liveDataMap) => {
        if (!totalPortfolioValueEl) return;
        let totalAssetsMarketValue = 0, totalAssetsCostBasis = 0;
        const allocation = { stocks: 0, bonds: 0, commodities: 0, cash: currentCashBalance };
        
        portfolioAssets.forEach(asset => {
            const averagePrice = (asset.shares > 0) ? (asset.price / asset.shares) : 0;
            const livePrice = liveDataMap.get(asset.symbol) || averagePrice;
            const marketValue = asset.shares * livePrice;
            totalAssetsMarketValue += marketValue;
            
            totalAssetsCostBasis += asset.price; 
            
            if (allocation.hasOwnProperty(asset.category)) {
                allocation[asset.category] += marketValue;
            }
        });
    
        const grandTotalPortfolioValue = totalAssetsMarketValue + currentCashBalance;
        const totalGainLoss = totalAssetsMarketValue - totalAssetsCostBasis;
    
        totalPortfolioValueEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(grandTotalPortfolioValue);
        totalAssetsCountEl.textContent = portfolioAssets.length;
        totalGainLossEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalGainLoss);
        totalGainLossEl.className = totalGainLoss >= 0 ? 'positive' : 'negative';
        
        if (allocationPieChart) {
            allocationPieChart.data.labels = Object.keys(allocation).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            allocationPieChart.data.datasets[0].data = Object.values(allocation);
            allocationPieChart.update();
        }
    };
    
    const renderCategoryTable = (assets, tableBody, liveDataMap) => {
        tableBody.innerHTML = ''; // Clear previous content
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2rem;">No assets in this category.</td></tr>`;
            return;
        }
    
        assets.forEach(asset => {
            const averagePurchasePrice = (asset.shares > 0) ? (asset.price / asset.shares) : 0;
            const livePrice = liveDataMap.get(asset.symbol) || averagePurchasePrice;
            const marketValue = asset.shares * livePrice;
            const gainLoss = marketValue - asset.price;
            
            const gainLossClass = gainLoss >= 0 ? 'positive' : 'negative';
            const arrowClass = gainLoss >= 0 ? 'fa-arrow-up' : 'fa-arrow-down';
            const gainLossHTML = `<div class="${gainLossClass}" style="display:flex; align-items:center; gap: 0.5rem;"><i class="fas ${arrowClass}"></i><span>$${gainLoss.toFixed(2)}</span></div>`;
    
            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Asset"><strong>${asset.symbol}</strong><br><small>${asset.name}</small></td>
                <td data-label="Shares">${asset.shares.toFixed(2)}</td>
                <td data-label="Price">$${averagePurchasePrice.toFixed(2)}</td>
                <td data-label="Current Price">$${livePrice.toFixed(2)}</td>
                <td data-label="Market Value">$${marketValue.toFixed(2)}</td>
                <td data-label="Gain/Loss">${gainLossHTML}</td>
                <td data-label="Actions"><button title="Delete" class="delete-btn" data-asset-id="${asset.id}"><i class="fas fa-trash"></i></button></td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    const fetchAndRenderData = async () => {
        try {
            await fetchAndDisplayWalletBalance();
            const response = await fetch('http://localhost:3000/api/assets');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            portfolioAssets = await response.json();

            portfolioAssets.forEach(asset => {
                asset.category = asset.category?.toLowerCase();
            });

            const allSymbols = [...new Set(portfolioAssets.map(a => a.symbol))];
            const pricePromises = allSymbols.map(symbol => 
                fetch(`http://localhost:3000/api/current-price/${symbol}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => ({ symbol, currentPrice: data?.currentPrice }))
            );
            const liveDataResults = await Promise.all(pricePromises);
            const liveDataMap = new Map(liveDataResults.filter(d => d && d.currentPrice !== null).map(d => [d.symbol, d.currentPrice]));
            
            updateDashboard(liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'stocks'), tableBodies.stocks, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'bonds'), tableBodies.bonds, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'commodities'), tableBodies.commodities, liveDataMap);
        } catch (error) { 
            console.error('Failed to fetch and render data:', error); 
        }
    };

    const fetchAndRenderTransactions = async () => {
        const tbody = document.getElementById('transaction-table-body');
        try {
            const response = await fetch('http://localhost:3000/api/transactions');
            const transactions = await response.json();
            tbody.innerHTML = transactions.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:1rem;">No transactions found.</td></tr>` : '';
            if(transactions.length === 0) return;
            const capitalize = (s) => s.charAt(0).toUpperCase() + s.slice(1);
            transactions.forEach(tx => {
                tbody.innerHTML += `<tr>
                    <td data-label="Name">${capitalize(tx.name)}</td>
                    <td data-label="Category">${capitalize(tx.category)}</td>
                    <td data-label="Type" class="${tx.transaction_type === 'buy' ? 'transaction-type-buy' : 'transaction-type-sell'}">${capitalize(tx.transaction_type)}</td>
                    <td data-label="Price">$${parseFloat(tx.price).toFixed(2)}</td>
                    <td data-label="Quantity">${tx.quantity}</td>
                    <td data-label="Date">${new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                </tr>`;
            });
        } catch (error) { console.error('Error loading transactions:', error); tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1rem;">Error loading data.</td></tr>`; }
    };

    const fetchAndRenderPerformanceData = async () => {
        const symbol1 = stockSymbolInput1.value.trim().toUpperCase();
        const symbol2 = stockSymbolInput2.value.trim().toUpperCase();

        if (!symbol1 || !symbol2) {
            alert('Please enter two asset symbols for comparison.');
            return;
        }
        
        const range = document.querySelector('#comparison-view .range-btn.active')?.dataset.range || '30d';
        
        const buildUrl = (symbol) => {
            let url = `http://localhost:3000/api/historical-data/${symbol}?range=${range}`;
            if (range === 'custom') {
                if (!startDateInput.value) return null;
                url += `&startDate=${startDateInput.value}`;
                if (endDateInput.value) url += `&endDate=${endDateInput.value}`;
            }
            return url;
        };
        
        const url1 = buildUrl(symbol1);
        const url2 = buildUrl(symbol2);

        if (range === 'custom' && (!url1 || !url2)) {
            alert('Please select a start date for custom range comparison.');
            return;
        }

        try {
            const [response1, response2] = await Promise.all([fetch(url1), fetch(url2)]);
            if (!response1.ok || !response2.ok) {
                const err1 = !response1.ok ? await response1.json() : null;
                const err2 = !response2.ok ? await response2.json() : null;
                let errorMsg = "Could not fetch data.\n";
                if (err1) errorMsg += `Symbol 1 (${symbol1}): ${err1.error}\n`;
                if (err2) errorMsg += `Symbol 2 (${symbol2}): ${err2.error}`;
                throw new Error(errorMsg);
            }
            const [data1, data2] = await Promise.all([response1.json(), response2.json()]);

            if (data1.length === 0 || data2.length === 0) {
                alert('No historical data found for one or both symbols in the selected range.');
                return;
            }

            stockPerformanceChart.data.datasets[0].label = `${symbol1} Price (USD)`;
            stockPerformanceChart.data.datasets[0].data = data1;
            stockPerformanceChart.data.datasets[1].label = `${symbol2} Price (USD)`;
            stockPerformanceChart.data.datasets[1].data = data2;
            stockPerformanceChart.update();
            performanceChartContainer.style.display = 'block';

        } catch (error) {
            console.error('Error fetching performance data:', error);
            alert(`Error: ${error.message}`);
        }
    };

    const assetSymbolInput = document.getElementById('assetSymbol');
    if (assetSymbolInput) {
        assetSymbolInput.addEventListener('blur', async () => {
            const symbol = assetSymbolInput.value.trim().toUpperCase();
            const assetNameInput = document.getElementById('assetName');
            const symbolErrorEl = document.getElementById('assetSymbolError');
            
            assetNameInput.value = '';
            symbolErrorEl.textContent = '';
    
            if (!symbol || assetCategorySelect.value === 'commodities') return;
    
            try {
                const response = await fetch(`http://localhost:3000/api/validate-ticker/${symbol}`);
                const data = await response.json();
                if (response.ok) {
                    assetNameInput.value = data.name;
                } else {
                    symbolErrorEl.textContent = data.error;
                }
            } catch (error) {
                symbolErrorEl.textContent = 'Error validating symbol.';
                console.error('Validation request failed:', error);
            }
        });
    }

    if (addAssetForm) {
        addAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const symbolErrorEl = document.getElementById('assetSymbolError');
            const dateErrorEl = document.getElementById('purchaseDateError');
            symbolErrorEl.textContent = '';
            dateErrorEl.textContent = '';
            
            let isValid = true;
            const shares = parseFloat(document.getElementById('shares').value);
            const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
            
            if (shares * purchasePrice > currentCashBalance) {
                alert(`Insufficient funds. Purchase cost: $${(shares * purchasePrice).toFixed(2)}, Your balance: $${currentCashBalance.toFixed(2)}.`);
                return;
            }

            const purchaseDate = new Date(document.getElementById('purchaseDate').value);
            const today = new Date();
            today.setHours(23, 59, 59, 999); 
            if (purchaseDate > today) {
                dateErrorEl.textContent = 'Date cannot be in the future.';
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
                if (!assetName) {
                    try {
                        const response = await fetch(`http://localhost:3000/api/validate-ticker/${assetSymbol}`);
                        if (!response.ok) { const err = await response.json(); symbolErrorEl.textContent = err.error; isValid = false; }
                        else { const data = await response.json(); assetName = data.name; document.getElementById('assetName').value = assetName; }
                    } catch(err) {
                        symbolErrorEl.textContent = "Could not validate symbol."; isValid = false;
                    }
                }
            }
            if (!isValid) return;

            try {
                const response = await fetch('http://localhost:3000/api/add-asset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetName, assetSymbol, shares, purchasePrice, purchaseDate: document.getElementById('purchaseDate').value, category }) });
                if (!response.ok) { const err = await response.json(); throw new Error(err.error || "Server Error"); }
                addAssetForm.reset();
                toggleAssetFormFields();
                showView(category);
                await fetchAndRenderData();
                await fetchAndRenderCategoryValueData();
            } catch (error) { alert(`Error adding asset: ${error.message}`); }
        });
    }

    const openAddCashModal = () => { addCashModal.style.display = 'flex'; setTimeout(() => addCashModal.classList.add('active'), 10); };
    const closeAddCashModal = () => { addCashModal.classList.remove('active'); setTimeout(() => { addCashModal.style.display = 'none'; }, 300); };
    if (addCashBtn) addCashBtn.addEventListener('click', openAddCashModal);
    if (closeAddCashModalBtn) closeAddCashModalBtn.addEventListener('click', closeAddCashModal);
    if (cancelAddCashBtn) cancelAddCashBtn.addEventListener('click', closeAddCashModal);
    
    if (addCashForm) {
        addCashForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const amount = parseFloat(document.getElementById('addCashAmount').value);
            if (isNaN(amount) || amount <= 0) { alert('Please enter a valid amount.'); return; }
            try {
                await fetch('http://localhost:3000/api/wallet/add', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount }) });
                closeAddCashModal();
                await fetchAndDisplayWalletBalance();
                document.getElementById('addCashAmount').value = '';
            } catch (error) { alert('Failed to add funds.'); }
        });
    }

    // --- Sell Asset Modal Logic ---
    const openSellModal = (asset) => {
        sellAssetSymbolEl.textContent = asset.symbol;
        sellAssetIdInput.value = asset.id;
        sellQuantityInput.max = asset.shares;
        sellQuantityInput.placeholder = `Max: ${asset.shares.toFixed(2)}`;
        sellAssetModal.style.display = 'flex';
        setTimeout(() => sellAssetModal.classList.add('active'), 10);
    };

    const closeSellModal = () => {
        sellAssetModal.classList.remove('active');
        setTimeout(() => { 
            sellAssetModal.style.display = 'none'; 
            sellAssetForm.reset();
        }, 300);
    };

    if (closeSellModalBtn) closeSellModalBtn.addEventListener('click', closeSellModal);
    if (cancelSellModalBtn) cancelSellModalBtn.addEventListener('click', closeSellModal);

    if (sellAssetForm) {
        sellAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const assetId = sellAssetIdInput.value;
            const asset = portfolioAssets.find(a => a.id == assetId);
            const volumeSold = parseFloat(sellQuantityInput.value);
            const sellPrice = parseFloat(document.getElementById('sellPrice').value);

            if (!asset || isNaN(volumeSold) || isNaN(sellPrice) || volumeSold <= 0 || sellPrice <= 0) {
                alert("Please enter a valid quantity and selling price.");
                return;
            }

            if (volumeSold > asset.shares) {
                alert(`Invalid quantity. You can only sell up to ${asset.shares.toFixed(2)} shares.`);
                return;
            }

            try {
                // FIXED: Changed endpoint to be an absolute URL
                const response = await fetch(`http://localhost:3000/api/sell-asset/${assetId}`, { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ volumeSold, sellPrice })
                });

                if (!response.ok) {
                    const err = await response.json(); 
                    throw new Error(err.error || 'Failed to sell asset.');
                }
                
                await response.json();

                closeSellModal();
                await fetchAndRenderData();
                await fetchAndRenderCategoryValueData();

            } catch (error) {
                alert(`Error: ${error.message}`);
                console.error('Error selling asset:', error);
            }
        });
    }


    if (mainContent) {
        mainContent.addEventListener('click', async (e) => {
            const deleteButton = e.target.closest('.delete-btn');
            if (deleteButton) {
                const assetId = deleteButton.getAttribute('data-asset-id');
                const asset = portfolioAssets.find(a => a.id == assetId);
                if (asset) {
                    openSellModal(asset);
                }
            }
        });
    }

    if (getPerformanceBtn) getPerformanceBtn.addEventListener('click', fetchAndRenderPerformanceData);
    rangeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
            const parentSelector = e.target.closest('.range-selector');
            if(!parentSelector) return;
    
            parentSelector.querySelectorAll('.range-btn').forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            const parentView = button.closest('.view');
            const customDateEl = parentView.querySelector('.custom-date-range');
            if(customDateEl) {
                customDateEl.style.display = button.dataset.range === 'custom' ? 'flex' : 'none';
            }
        });
    });

    if (assetCategorySelect) assetCategorySelect.addEventListener('change', toggleAssetFormFields);

    if (emailReportBtn) {
        emailReportBtn.addEventListener('click', async () => {
            const email = prompt("Please enter your email address to receive the weekly performance report:");
            if (!email || !email.includes('@')) {
                alert("A valid email address is required.");
                return;
            }
            emailReportBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            emailReportBtn.disabled = true;

            try {
                const response = await fetch('http://localhost:3000/api/portfolio/send-weekly-report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email }) });
                if (!response.ok) {
                    const errorResult = await response.json();
                    throw new Error(errorResult.error || 'Server returned an error.');
                }
                const result = await response.json();
                alert(result.message);
            } catch (error) {
                console.error('Error sending weekly report:', error);
                alert(`Could not send report: ${error.message}`);
            } finally {
                emailReportBtn.innerHTML = '<i class="fas fa-chart-bar"></i>';
                emailReportBtn.disabled = false;
            }
        });
    }

    initializeCharts();
    initializePerformanceChart();
    initializeCategoryValueChart();
    populateCommoditySelect();
    toggleAssetFormFields();
    fetchAndRenderData();
    fetchAndRenderCategoryValueData();
});