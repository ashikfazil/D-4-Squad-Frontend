document.addEventListener('DOMContentLoaded', () => {

    const NAV_ITEMS = document.querySelectorAll('.nav-item');
    const VIEWS = document.querySelectorAll('.view');
    const mainContent = document.querySelector('.main-content');
    const addAssetForm = document.getElementById('addAssetForm');
    
    const addCashModal = document.getElementById('addCashModal');
    const addCashForm = document.getElementById('addCashForm');
    const addCashBtn = document.getElementById('addCashBtn');
    const closeAddCashModalBtn = document.getElementById('closeAddCashModal');
    const cancelAddCashBtn = document.getElementById('cancelAddCash');
    const cashBalanceEl = document.getElementById('cash-balance');
    let currentCashBalance = 0;

    const totalPortfolioValueEl = document.getElementById('total-portfolio-value');
    const totalAssetsCountEl = document.getElementById('total-assets-count');
    const totalGainLossEl = document.getElementById('total-gain-loss');
    
    const tableBodies = {
        stocks: document.getElementById('stocks-table-body'),
        bonds: document.getElementById('bonds-table-body'),
        commodities: document.getElementById('commodities-table-body')
    };

    const commodityMap = { "Gold": "GC=F", "Silver": "SI=F", "Crude Oil": "CL=F", "Natural Gas": "NG=F", "Copper": "HG=F", "Corn": "ZC=F", "Wheat": "ZW=F", "Soybeans": "ZS=F" };

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

    const emailReportBtn = document.getElementById('emailReportBtn');

    let portfolioAssets = [];
    let allocationPieChart;
    let stockPerformanceChart; 

    const subtitles = { 'dashboard': "Welcome back! Here's your portfolio overview", 'stocks': 'Manage your stock holdings', 'bonds': 'Manage your bond holdings', 'commodities': 'Manage your commodity holdings', 'performance': 'Analyze historical performance', 'history': 'Review your transaction history', 'add-asset': 'Add a new investment to your portfolio' };

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
            allocationPieChart = new Chart(allocationCtx, { type: 'pie', data: { labels: [], datasets: [{ data: [], backgroundColor: ['#0d9488', '#f59e0b', '#10b981'], borderColor: '#ffffff', borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' }, tooltip: { callbacks: { label: (c) => `${c.label}: ${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(c.raw)}` } } } } });
        }
    };

    const initializePerformanceChart = () => {
        const ctx = document.getElementById('stockPerformanceChart')?.getContext('2d');
        if (!ctx) return;
        stockPerformanceChart = new Chart(ctx, { type: 'line', data: { datasets: [{ label: 'Stock Price (USD)', data: [], borderColor: 'var(--primary-color)', backgroundColor: 'rgba(13, 148, 136, 0.1)', borderWidth: 2, pointRadius: 1, tension: 0.1, fill: true }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'day' }, title: { display: true, text: 'Date' } }, y: { title: { display: true, text: 'Closing Price ($)' } } }, plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } } } });
        performanceChartContainer.style.display = 'none'; 
    };

    const updateDashboard = (liveDataMap) => {
        if (!totalPortfolioValueEl) return;
        let totalValue = 0, totalCost = 0;
        const allocation = { stocks: 0, bonds: 0, commodities: 0 };
        portfolioAssets.forEach(asset => {
            const livePrice = liveDataMap.get(asset.symbol) || asset.price;
            const marketValue = asset.shares * livePrice;
            totalValue += marketValue;
            totalCost += asset.shares * asset.price;
            if (allocation.hasOwnProperty(asset.category)) allocation[asset.category] += marketValue;
        });
        const gainLoss = totalValue - totalCost;
        totalPortfolioValueEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalValue);
        totalAssetsCountEl.textContent = portfolioAssets.length;
        totalGainLossEl.textContent = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(gainLoss);
        totalGainLossEl.className = gainLoss >= 0 ? 'positive' : 'negative';
        if (allocationPieChart) {
            allocationPieChart.data.labels = Object.keys(allocation).map(k => k.charAt(0).toUpperCase() + k.slice(1));
            allocationPieChart.data.datasets[0].data = Object.values(allocation);
            allocationPieChart.update();
        }
    };

    const renderCategoryTable = (assets, tableBody, liveDataMap) => {
        tableBody.innerHTML = assets.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:2rem;">No assets in this category.</td></tr>` : '';
        if(assets.length === 0) return;
        assets.forEach(asset => {
            const livePrice = liveDataMap.get(asset.symbol) || asset.price;
            const marketValue = asset.shares * livePrice;
            const gainLoss = marketValue - (asset.shares * asset.price);
            tableBody.innerHTML += `<tr>
                <td data-label="Asset"><strong>${asset.symbol}</strong><br><small>${asset.name}</small></td>
                <td data-label="Shares">${asset.shares.toFixed(2)}</td>
                <td data-label="Purchase Price">$${asset.price.toFixed(2)}</td>
                <td data-label="Current Price"><strong>$${livePrice.toFixed(2)}</strong></td>
                <td data-label="Market Value">$${marketValue.toFixed(2)}</td>
                <td data-label="Gain/Loss"><div class="${gainLoss >= 0 ? 'positive' : 'negative'}" style="display:flex; align-items:center; gap: 0.5rem;"><i class="fas ${gainLoss >= 0 ? 'fa-arrow-up' : 'fa-arrow-down'}"></i><span>$${gainLoss.toFixed(2)}</span></div></td>
                <td data-label="Actions"><button title="Delete" class="delete-btn" data-asset-id="${asset.id}"><i class="fas fa-trash"></i></button></td>
            </tr>`;
        });
    };
    
    const fetchAndRenderData = async () => {
        try {
            await fetchAndDisplayWalletBalance();
            const response = await fetch('http://localhost:3000/api/assets');
            portfolioAssets = await response.json();
            portfolioAssets.forEach(asset => asset.category = asset.category?.toLowerCase());
            const allSymbols = [...new Set(portfolioAssets.map(a => a.symbol))];
            const pricePromises = allSymbols.map(symbol => 
                fetch(`http://localhost:3000/api/current-price/${symbol}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => ({ symbol, currentPrice: data?.currentPrice }))
            );
            const liveDataResults = await Promise.all(pricePromises);
            const liveDataMap = new Map(liveDataResults.filter(d => d.currentPrice !== null).map(d => [d.symbol, d.currentPrice]));
            updateDashboard(liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'stocks'), tableBodies.stocks, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'bonds'), tableBodies.bonds, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'commodities'), tableBodies.commodities, liveDataMap);
        } catch (error) { console.error('Failed to fetch and render data:', error); }
    };

    const fetchAndRenderTransactions = async () => {
        const tbody = document.getElementById('transaction-table-body');
        try {
            const response = await fetch('http://localhost:3000/api/transactions');
            const transactions = await response.json();
            tbody.innerHTML = transactions.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:1rem;">No transactions found.</td></tr>` : '';
            if(transactions.length === 0) return;
            transactions.forEach(tx => {
                tbody.innerHTML += `<tr>
                    <td data-label="Name">${tx.name}</td>
                    <td data-label="Category">${tx.category.toLowerCase()}</td>
                    <td data-label="Type" class="${tx.transaction_type === 'buy' ? 'transaction-type-buy' : 'transaction-type-sell'}">${tx.transaction_type.toLowerCase()}</td>
                    <td data-label="Price">$${parseFloat(tx.price).toFixed(2)}</td>
                    <td data-label="Quantity">${tx.quantity}</td>
                    <td data-label="Date">${new Date(tx.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                </tr>`;
            });
        } catch (error) { console.error('Error loading transactions:', error); tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:1rem;">Error loading data.</td></tr>`; }
    };

    const fetchAndRenderPerformanceData = async () => {
        const symbol = stockSymbolInput.value;
        if (!symbol) { alert('Please enter a stock symbol.'); return; }
        const range = document.querySelector('.range-btn.active')?.dataset.range || '30d';
        let url = `http://localhost:3000/api/historical-data/${symbol}?range=${range}`;
        if (range === 'custom') {
            if (!startDateInput.value) { alert('Please select a start date.'); return; }
            url += `&startDate=${startDateInput.value}`;
            if(endDateInput.value) url += `&endDate=${endDateInput.value}`;
        }
        try {
            const response = await fetch(url);
            if (!response.ok) { const err = await response.json(); throw new Error(err.error); }
            const data = await response.json();
            if (data.length === 0) { alert('No historical data found.'); return; }
            stockPerformanceChart.data.datasets[0].label = `${symbol.toUpperCase()} Price (USD)`;
            stockPerformanceChart.data.datasets[0].data = data;
            stockPerformanceChart.update();
            performanceChartContainer.style.display = 'block';
        } catch (error) { console.error('Error fetching performance data:', error); alert(`Error: ${error.message}`); }
    };

    if (addAssetForm) {
        addAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const symbolErrorEl = document.getElementById('assetSymbolError');
            symbolErrorEl.textContent = '';
            let isValid = true;
            const shares = parseFloat(document.getElementById('shares').value);
            const purchasePrice = parseFloat(document.getElementById('purchasePrice').value);
            if (shares * purchasePrice > currentCashBalance) { alert(`Insufficient funds.`); return; }
            if (new Date(document.getElementById('purchaseDate').value) > new Date()) { document.getElementById('purchaseDateError').textContent = 'Date cannot be in the future.'; isValid = false; }
            
            const category = assetCategorySelect.value;
            let assetSymbol, assetName;
            if (category === 'commodities') {
                assetSymbol = commodityTypeSelect.value;
                assetName = commodityTypeSelect.options[commodityTypeSelect.selectedIndex].text;
            } else {
                assetSymbol = document.getElementById('assetSymbol').value.toUpperCase();
                assetName = document.getElementById('assetName').value;
                const response = await fetch(`http://localhost:3000/api/validate-ticker/${assetSymbol}`);
                if (!response.ok) { const err = await response.json(); symbolErrorEl.textContent = err.error; isValid = false; }
            }
            if (!isValid) return;

            try {
                const response = await fetch('http://localhost:3000/api/add-asset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assetName, assetSymbol, shares, purchasePrice, purchaseDate: document.getElementById('purchaseDate').value, category }) });
                if (!response.ok) { const err = await response.json(); throw new Error(err.error); }
                addAssetForm.reset();
                toggleAssetFormFields();
                showView(category);
                await fetchAndRenderData();
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

    if (mainContent) {
        mainContent.addEventListener('click', async (e) => {
            if (e.target.closest('.delete-btn')) {
                const assetId = e.target.closest('.delete-btn').getAttribute('data-asset-id');
                const asset = portfolioAssets.find(a => a.id == assetId);
                if (!asset) return;
                const sharesToSell = prompt(`How many shares of ${asset.symbol} to sell? (Max: ${asset.shares})`);
                if (sharesToSell === null) return;
                const volumeSold = parseFloat(sharesToSell);
                if (isNaN(volumeSold) || volumeSold <= 0 || volumeSold > asset.shares) { alert(`Invalid input.`); return; }
                try {
                    await fetch(`http://localhost:3000/api/delete-asset/${assetId}`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ volumeSold }) });
                    await fetchAndRenderData();
                } catch (error) { console.error('Error selling asset:', error); }
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
                const response = await fetch('http://localhost:3000/api/portfolio/send-weekly-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email: email })
                });

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
    populateCommoditySelect();
    toggleAssetFormFields();
    fetchAndRenderData();
});