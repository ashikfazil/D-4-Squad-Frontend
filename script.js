
document.addEventListener('DOMContentLoaded', () => {

    const NAV_ITEMS = document.querySelectorAll('.nav-item');
    const VIEWS = document.querySelectorAll('.view');

    // --- Chart Colors ---
    const chartColors = {
        primary: 'rgba(99, 102, 241, 0.8)',
        primaryLight: 'rgba(99, 102, 241, 0.2)',
        secondary: 'rgba(245, 158, 11, 0.8)',
        success: 'rgba(16, 185, 129, 0.8)',
        danger: 'rgba(239, 68, 68, 0.8)',
        grid: 'rgba(0, 0, 0, 0.1)',
        text: '#212529',
        textSecondary: '#6c757d'
    };
    
    // --- Sample Data ---
    let portfolioAssets = [
        { symbol: 'AAPL', name: 'Apple Inc.', shares: 10, price: 172.25, purchasePrice: 150.25 },
        { symbol: 'TSLA', name: 'Tesla, Inc.', shares: 5, price: 177.48, purchasePrice: 245.80 },
        { symbol: 'MSFT', name: 'Microsoft Corp.', shares: 8, price: 427.56, purchasePrice: 400.00 },
        { symbol: 'GOOGL', name: 'Alphabet Inc.', shares: 12, price: 176.63, purchasePrice: 155.50 },
        { symbol: 'AMZN', name: 'Amazon.com, Inc.', shares: 7, price: 184.67, purchasePrice: 180.10 },
    ];

    // --- Navigation ---
    window.showView = (viewId) => {
        // Hide all views
        VIEWS.forEach(view => view.classList.remove('active'));
        // Deactivate all nav items
        NAV_ITEMS.forEach(item => item.classList.remove('active'));

        // Show the target view
        const targetView = document.getElementById(`${viewId}-view`);
        if (targetView) {
            targetView.classList.add('active');
        }

        // Activate the target nav item
        const targetNavItem = document.querySelector(`.nav-item[data-view="${viewId}"]`);
        if (targetNavItem) {
            targetNavItem.classList.add('active');
        }

        // Update header title
        const pageTitle = document.querySelector('.page-title');
        const pageSubtitle = document.querySelector('.page-subtitle');
        if (pageTitle && pageSubtitle && targetNavItem) {
            const viewName = targetNavItem.querySelector('span').textContent;
            pageTitle.textContent = viewName;
            const subtitles = {
                'Dashboard': "Welcome back! Here's your portfolio overview",
                'Portfolio': 'Manage your investment holdings',
                'Performance': 'Detailed analysis of your portfolio performance',
                'Add Asset': 'Add a new investment to your portfolio'
            };
            pageSubtitle.textContent = subtitles[viewName] || '';
        }
    };

    NAV_ITEMS.forEach(item => {
        item.addEventListener('click', () => {
            const viewId = item.getAttribute('data-view');
            showView(viewId);
        });
    });

    // --- Portfolio Table ---
    const renderPortfolioTable = () => {
        const tableBody = document.getElementById('portfolio-table-body');
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        let totalMarketValue = portfolioAssets.reduce((sum, asset) => sum + (asset.shares * asset.price), 0);

        portfolioAssets.forEach(asset => {
            const marketValue = asset.shares * asset.price;
            const gainLoss = marketValue - (asset.shares * asset.purchasePrice);
            const allocation = totalMarketValue > 0 ? (marketValue / totalMarketValue) * 100 : 0;
            const gainLossClass = gainLoss >= 0 ? 'positive' : 'negative';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td data-label="Asset"><strong>${asset.symbol}</strong><br><small>${asset.name}</small></td>
                <td data-label="Shares">${asset.shares.toFixed(2)}</td>
                <td data-label="Price">$${asset.price.toFixed(2)}</td>
                <td data-label="Market Value">$${marketValue.toFixed(2)}</td>
                <td data-label="Gain/Loss" class="${gainLossClass}">$${gainLoss.toFixed(2)}</td>
                <td data-label="Allocation">${allocation.toFixed(2)}%</td>
                <td data-label="Actions">
                    <button title="Edit"><i class="fas fa-pencil-alt"></i></button>
                    <button title="Delete"><i class="fas fa-trash"></i></button>
                </td>
            `;
            tableBody.appendChild(row);
        });
    };
    
    // --- Add Asset Form ---
    const addAssetForm = document.getElementById('addAssetForm');
    if (addAssetForm) {
        addAssetForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const newAsset = {
                symbol: document.getElementById('assetSymbol').value.toUpperCase(),
                name: document.getElementById('assetName').value,
                shares: parseFloat(document.getElementById('shares').value),
                purchasePrice: parseFloat(document.getElementById('purchasePrice').value),
                price: parseFloat(document.getElementById('purchasePrice').value) // Assume current price is purchase price for simplicity
            };
            portfolioAssets.push(newAsset);
            renderPortfolioTable();
            addAssetForm.reset();
            showView('portfolio');
        });
    }

    // --- Chart.js Setup ---
    const setupCharts = () => {
        Chart.defaults.color = chartColors.textSecondary;
        Chart.defaults.borderColor = chartColors.grid;
        Chart.defaults.plugins.legend.labels.boxWidth = 12;
        Chart.defaults.plugins.legend.labels.padding = 15;
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.font.weight = 500;


        // Performance Chart (Dashboard)
        const perfCtx = document.getElementById('performanceChart')?.getContext('2d');
        if (perfCtx) {
            new Chart(perfCtx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                    datasets: [{
                        label: 'Portfolio Value',
                        data: [110000, 112000, 118000, 115000, 122000, 121000, 125430],
                        borderColor: chartColors.primary,
                        backgroundColor: chartColors.primaryLight,
                        fill: true,
                        tension: 0.4,
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { ticks: { color: chartColors.textSecondary } },
                        x: { ticks: { color: chartColors.textSecondary } }
                    }
                }
            });
        }
        
        // Allocation Chart (Dashboard)
        const allocCtx = document.getElementById('allocationChart')?.getContext('2d');
        if (allocCtx) {
            new Chart(allocCtx, {
                type: 'doughnut',
                data: {
                    labels: ['Stocks', 'ETFs', 'Crypto', 'Bonds'],
                    datasets: [{
                        data: [65, 15, 10, 10],
                        backgroundColor: [chartColors.primary, chartColors.success, chartColors.secondary, 'rgba(108, 117, 125, 0.8)'],
                        borderWidth: 0,
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    cutout: '70%', 
                    plugins: { 
                        legend: { 
                            position: 'bottom',
                            labels: {
                                color: chartColors.textSecondary
                            } 
                        } 
                    } 
                }
            });
        }
        
        // Historical Performance Chart (Performance)
        const histCtx = document.getElementById('historicalChart')?.getContext('2d');
        if (histCtx) {
             new Chart(histCtx, {
                type: 'bar',
                data: {
                    labels: ['2020', '2021', '2022', '2023'],
                    datasets: [{
                        label: 'Annual Return',
                        data: [15.2, 22.5, -8.3, 18.5],
                        backgroundColor: (context) => {
                            const value = context.dataset.data[context.dataIndex];
                            return value >= 0 ? chartColors.success : chartColors.danger;
                        },
                         borderRadius: 4,
                    }]
                },
                options: { 
                    responsive: true, 
                    maintainAspectRatio: false, 
                    plugins: { legend: { display: false } }, 
                    scales: { 
                        y: { 
                            beginAtZero: true, 
                            ticks: { color: chartColors.textSecondary } 
                        },
                        x: { ticks: { color: chartColors.textSecondary } } 
                    } 
                }
            });
        }
        
        // Risk vs Return Chart (Performance)
        const riskCtx = document.getElementById('riskReturnChart')?.getContext('2d');
        if (riskCtx) {
            new Chart(riskCtx, {
                type: 'bubble',
                data: {
                    datasets: portfolioAssets.map(a => ({
                        label: a.symbol,
                        data: [{
                            x: Math.random() * 20 + 5, // mock volatility
                            y: (a.price / a.purchasePrice - 1) * 100, // mock return
                            r: Math.sqrt(a.shares * a.price) / 10 // mock market value
                        }],
                        backgroundColor: `hsla(${Math.random() * 360}, 70%, 60%, 0.7)`
                    }))
                },
                 options: { 
                     responsive: true, 
                     maintainAspectRatio: false, 
                     plugins: { legend: { display: false } }, 
                     scales: {
                        x: { 
                            title: { display: true, text: 'Volatility (%)', color: chartColors.text },
                            ticks: { color: chartColors.textSecondary }
                        },
                        y: { 
                            title: { display: true, text: 'Return (%)', color: chartColors.text },
                            ticks: { color: chartColors.textSecondary }
                        }
                    }
                }
            });
        }
    };

    // --- Initial Load ---
    renderPortfolioTable();
    setupCharts();
});
