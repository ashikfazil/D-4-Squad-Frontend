document.addEventListener('DOMContentLoaded', () => {

    const NAV_ITEMS = document.querySelectorAll('.nav-item');
    const VIEWS = document.querySelectorAll('.view');
    const mainContent = document.querySelector('.main-content');
    const addAssetForm = document.getElementById('addAssetForm');
    
    const updateAssetModal = document.getElementById('updateAssetModal');
    const updateAssetForm = document.getElementById('updateAssetForm');
    const closeUpdateModalBtn = document.getElementById('closeUpdateModal');
    const cancelUpdateBtn = document.getElementById('cancelUpdate');

    const totalPortfolioValueEl = document.getElementById('total-portfolio-value');
    const totalAssetsCountEl = document.getElementById('total-assets-count');
    const totalGainLossEl = document.getElementById('total-gain-loss');
    
    const tableBodies = {
        stocks: document.getElementById('stocks-table-body'),
        bonds: document.getElementById('bonds-table-body'),
        commodities: document.getElementById('commodities-table-body')
    };
    
    let portfolioAssets = [];
    let allocationPieChart;

    const subtitles = {
        'dashboard': "Welcome back! Here's your portfolio overview",
        'stocks': 'Manage your stock holdings',
        'bonds': 'Manage your bond holdings',
        'commodities': 'Manage your commodity holdings',
        'history': 'Review your transaction history',
        'add-asset': 'Add a new investment to your portfolio'
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
                        backgroundColor: ['#0d9488', '#f59e0b', '#10b981'],
                        borderColor: '#ffffff',
                        borderWidth: 2
                    }]
                },
                options: {
                    responsive: true,
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

    const updateDashboard = (liveDataMap) => {
        if (!totalPortfolioValueEl || !totalAssetsCountEl) return;

        let totalValue = 0;
        let totalCost = 0;
        const allocation = { stocks: 0, bonds: 0, commodities: 0 };

        portfolioAssets.forEach(asset => {
            const livePrice = (asset.category === 'stocks' && liveDataMap.get(asset.symbol)) ? liveDataMap.get(asset.symbol) : asset.price;
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
        tableBody.innerHTML = '';
        if (assets.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;">No assets in this category.</td></tr>`;
            return;
        }

        assets.forEach(asset => {
            const isStock = asset.category === 'stocks';
            const livePrice = (isStock && liveDataMap.get(asset.symbol)) ? liveDataMap.get(asset.symbol) : asset.price;
            const marketValue = asset.shares * livePrice;
            const gainLoss = marketValue - (asset.shares * asset.price);
            
            const gainLossClass = gainLoss >= 0 ? 'positive' : 'negative';
            const arrow = isStock ? (gainLoss >= 0 ? 'fa-arrow-up' : 'fa-arrow-down') : '';

            const gainLossHTML = `
                <div class="${gainLossClass}" style="display:flex; align-items:center; gap: 0.5rem;">
                    ${isStock ? `<i class="fas ${arrow}"></i>` : ''}
                    <span>$${gainLoss.toFixed(2)}</span>
                </div>`;

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Asset"><strong>${asset.symbol}</strong><br><small>${asset.name}</small></td>
                <td data-label="Shares">${asset.shares.toFixed(2)}</td>
                <td data-label="Price">$${asset.price.toFixed(2)}</td>
                <td data-label="Market Value">$${marketValue.toFixed(2)}</td>
                <td data-label="Gain/Loss">${gainLossHTML}</td>
                <td data-label="Actions">
                    <button title="Edit" class="edit-btn" data-asset-id="${asset.id}"><i class="fas fa-pencil-alt"></i></button>
                    <button title="Delete" class="delete-btn" data-asset-id="${asset.id}"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    const fetchAndRenderData = async () => {
        try {
            const response = await fetch('http://localhost:3000/api/assets');
            if (!response.ok) throw new Error('Network response was not ok');
            portfolioAssets = await response.json();

            const stockSymbols = [...new Set(portfolioAssets.filter(a => a.category === 'stocks').map(a => a.symbol))];
            
            const liveDataPromises = stockSymbols.map(symbol => 
                fetch(`http://localhost:3000/api/stock-data/${symbol}`)
                    .then(res => res.json())
                    .then(data => ({ symbol, currentPrice: data.currentPrice }))
                    .catch(() => ({ symbol, currentPrice: null }))
            );

            const liveDataResults = await Promise.all(liveDataPromises);
            const liveDataMap = new Map(liveDataResults.map(d => [d.symbol, d.currentPrice]));

            updateDashboard(liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'stocks'), tableBodies.stocks, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'bonds'), tableBodies.bonds, liveDataMap);
            renderCategoryTable(portfolioAssets.filter(a => a.category === 'commodities'), tableBodies.commodities, liveDataMap);

        } catch (error) {
            console.error('Failed to fetch assets:', error);
        }
    };

    if (addAssetForm) {
        addAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const newAsset = {
                assetName: document.getElementById('assetName').value,
                assetSymbol: document.getElementById('assetSymbol').value.toUpperCase(),
                shares: parseFloat(document.getElementById('shares').value),
                purchasePrice: parseFloat(document.getElementById('purchasePrice').value),
                purchaseDate: document.getElementById('purchaseDate').value,
                category: document.getElementById('assetCategory').value
            };
            try {
                await fetch('http://localhost:3000/api/add-asset', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newAsset),
                });
                addAssetForm.reset();
                showView(newAsset.category); 
                await fetchAndRenderData();
            } catch (error) {
                console.error('Error adding asset:', error);
            }
        });
    }

    const openUpdateModal = (asset) => {
        document.getElementById('updateAssetId').value = asset.id;
        document.getElementById('updateAssetName').value = asset.name;
        document.getElementById('updateAssetSymbol').value = asset.symbol;
        document.getElementById('updateAssetVolume').value = asset.shares;
        document.getElementById('updateAssetPrice').value = asset.price;
        document.getElementById('updateAssetCategory').value = asset.category || 'stocks';
        updateAssetModal.style.display = 'flex';
        setTimeout(() => updateAssetModal.classList.add('active'), 10);
    };

    const closeUpdateModal = () => {
        updateAssetModal.classList.remove('active');
        setTimeout(() => { updateAssetModal.style.display = 'none'; }, 300);
    };

    if (updateAssetForm) {
        updateAssetForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const assetId = document.getElementById('updateAssetId').value;
            const updatedData = {
                name: document.getElementById('updateAssetName').value,
                shortForm: document.getElementById('updateAssetSymbol').value.toUpperCase(),
                volume: parseFloat(document.getElementById('updateAssetVolume').value),
                price: parseFloat(document.getElementById('updateAssetPrice').value),
                category: document.getElementById('updateAssetCategory').value
            };
            try {
                await fetch(`http://localhost:3000/api/update-asset/${assetId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(updatedData)
                });
                closeUpdateModal();
                await fetchAndRenderData();
            } catch (error) {
                console.error('Error updating asset:', error);
            }
        });
    }

    if(closeUpdateModalBtn) closeUpdateModalBtn.addEventListener('click', closeUpdateModal);
    if(cancelUpdateBtn) cancelUpdateBtn.addEventListener('click', closeUpdateModal);

    if (mainContent) {
        mainContent.addEventListener('click', async (e) => {
            const editButton = e.target.closest('.edit-btn');
            const deleteButton = e.target.closest('.delete-btn');
            if (editButton) {
                const assetId = editButton.getAttribute('data-asset-id');
                const asset = portfolioAssets.find(a => a.id == assetId);
                if (asset) openUpdateModal(asset);
            }
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
                    await fetch(`http://localhost:3000/api/delete-asset/${assetId}`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ volumeSold }),
                    });
                    await fetchAndRenderData();
                } catch (error) {
                    console.error('Error selling asset:', error);
                }
            }
        });
    }
    
    initializeCharts();
    fetchAndRenderData();
});