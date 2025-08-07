import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import yahooFinance from 'yahoo-finance2';

import { 
    addAsset, 
    deleteAsset, 
    getAllAssets, 
    getAllTransactions, 
    getCashBalance, 
    updateCashBalance,
    getWeeklyReportData
} from './dataLayer.js';

import { sendWeeklyReportEmail } from './utils/email.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/portfolio/send-weekly-report', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email address is required.' });
    }
    try {
        const reportData = await getWeeklyReportData();
        await sendWeeklyReportEmail(email, reportData);
        res.status(200).json({ message: 'Your performance report has been sent successfully!' });
    } catch (error) {
        console.error("Failed to generate or send weekly report:", error);
        res.status(500).json({ error: 'Failed to process your report request.' });
    }
});

app.get('/api/wallet', async (req, res) => {
    try {
        const balance = await getCashBalance();
        res.status(200).json({ balance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
});

app.post('/api/wallet/add', async (req, res) => {
    const { amount } = req.body;
    if (typeof amount !== 'number' || amount <= 0) {
        return res.status(400).json({ error: 'A valid positive amount is required.' });
    }
    try {
        const currentBalance = await getCashBalance();
        const newBalance = parseFloat(currentBalance) + amount;
        await updateCashBalance(newBalance);
        res.status(200).json({ message: 'Funds added successfully', newBalance });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add funds to wallet' });
    }
});

app.get('/api/current-price/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const result = await yahooFinance.quote(symbol);
        if (result && result.regularMarketPrice) {
            res.status(200).json({ currentPrice: result.regularMarketPrice });
        } else {
            throw new Error(`No market price data found for ${symbol}`);
        }
    } catch (error) {
        console.error(`Yahoo Finance price error for ${symbol}:`, error);
        res.status(404).json({ error: `Could not fetch current price for symbol ${symbol}.` });
    }
});

app.get('/api/validate-ticker/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const result = await yahooFinance.quote(symbol);
        if (result) {
            res.status(200).json({ isValid: true, name: result.longName || result.shortName });
        } else {
            throw new Error('Invalid ticker');
        }
    } catch (error) {
        res.status(404).json({ isValid: false, error: `'${symbol}' is not a valid ticker symbol.` });
    }
});

app.get('/api/historical-data/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const { range, startDate: startDateQuery, endDate: endDateQuery } = req.query;
    const endDate = endDateQuery ? new Date(endDateQuery) : new Date();
    let startDate = new Date();
    switch(range) {
        case '7d': startDate.setDate(endDate.getDate() - 7); break;
        case '30d': startDate.setMonth(endDate.getMonth() - 1); break;
        case '365d': startDate.setFullYear(endDate.getFullYear() - 1); break;
        case 'custom':
            if (!startDateQuery) return res.status(400).json({ error: 'A start date is required for a custom range.' });
            startDate = new Date(startDateQuery);
            break;
        default: startDate.setMonth(endDate.getMonth() - 1);
    }
    try {
        const result = await yahooFinance.historical(symbol.toUpperCase(), { period1: startDate, period2: endDate });
        const formattedData = result.map(item => ({ x: item.date, y: item.close.toFixed(2) }));
        res.status(200).json(formattedData);
    } catch (error) {
        res.status(404).json({ error: `Could not find historical data for "${symbol}".` });
    }
});

app.get('/api/assets', async (req, res) => {
    try {
        const assets = await getAllAssets();
        res.status(200).json(assets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

app.post('/api/add-asset', async (req, res) => {
    const { assetName, assetSymbol, shares, purchasePrice, purchaseDate, category } = req.body;
    try {
        const result = await addAsset(assetName, assetSymbol, purchasePrice, shares, category, purchaseDate);
        res.status(201).json(result);
    } catch (error) {
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to process asset purchase.' });
    }
});

// FIXED: Changed method from DELETE to POST for better compatibility
app.post('/api/sell-asset/:id', async (req, res) => {
    const assetId = req.params.id;
    const { volumeSold, sellPrice } = req.body;
    
    if (!volumeSold || volumeSold <= 0) {
        return res.status(400).json({ error: 'A valid quantity to sell must be provided.' });
    }
    if (sellPrice === undefined || sellPrice <= 0) {
        return res.status(400).json({ error: 'A valid selling price must be provided.' });
    }

    try {
        const result = await deleteAsset(assetId, parseFloat(volumeSold), parseFloat(sellPrice));
        if (result.status === 'not_found') return res.status(404).json({ error: 'Asset not found' });
        if (result.status === 'insufficient_volume') return res.status(400).json({ error: `Insufficient volume. Only ${result.currentVolume} units available.` });
        
        // Respond with a success message
        res.status(200).json({ message: `Asset ${result.status} successfully`, data: result });

    } catch (error) {
        console.error('Error in sell-asset route:', error);
        res.status(500).json({ error: 'Failed to process asset sale.' });
    }
});


app.get('/api/transactions', async (req, res) => {
    try {
        const transactions = await getAllTransactions();
        res.status(200).json(transactions);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch transaction history' });
    }
});

app.get('/api/historical-value-by-category', async (req, res) => {
    try {
        const transactions = await getAllTransactions();
        const assets = await getAllAssets();

        if (transactions.length === 0) {
            return res.status(200).json({});
        }

        transactions.sort((a, b) => new Date(a.date) - new Date(b.date));

        const dailyValues = {};

        const allSymbols = [...new Set(assets.map(a => a.symbol))];
        const priceCache = {};

        const pricePromises = allSymbols.map(async (symbol) => {
            try {
                const historicalPrices = await yahooFinance.historical(symbol, {
                    period1: '2020-01-01', 
                    interval: '1d'
                });
                priceCache[symbol] = {};
                historicalPrices.forEach(price => {
                    const dateStr = new Date(price.date).toISOString().split('T')[0];
                    priceCache[symbol][dateStr] = price.close;
                });
            } catch (error) {
                console.error(`Failed to fetch historical data for ${symbol}:`, error);
            }
        });

        await Promise.all(pricePromises);

        let portfolioState = {};

        const startDate = new Date(transactions[0]?.date || '2020-01-01');
        const endDate = new Date();

        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateStr = d.toISOString().split('T')[0];

            transactions.forEach(tx => {
                if (!tx.date) return;
                const txDateStr = new Date(tx.date).toISOString().split('T')[0];
                if (txDateStr === dateStr) {
                    const assetInfo = assets.find(a => a.name === tx.name);
                    if (!assetInfo) return;
                    const symbol = assetInfo.symbol;
                    if (!portfolioState[symbol]) {
                        portfolioState[symbol] = { quantity: 0, category: tx.category };
                    }
                    if (tx.transaction_type === 'buy') {
                        portfolioState[symbol].quantity += tx.quantity;
                    } else if (tx.transaction_type === 'sell') {
                        portfolioState[symbol].quantity -= tx.quantity;
                    }
                }
            });

            let dailyTotal = { stocks: 0, bonds: 0, commodities: 0 };
            for (const symbol in portfolioState) {
                const asset = portfolioState[symbol];
                const lastKnownPrice = priceCache[symbol]?.[Object.keys(priceCache[symbol] || {}).sort().pop()] || 0;
                const price = priceCache[symbol]?.[dateStr] || lastKnownPrice;
                const value = asset.quantity * price;
                if (asset.category && dailyTotal.hasOwnProperty(asset.category.toLowerCase())) {
                    dailyTotal[asset.category.toLowerCase()] += value;
                }
            }
            dailyValues[dateStr] = dailyTotal;
        }

        res.status(200).json(dailyValues);

    } catch (error) {
        console.error('Error fetching historical portfolio value by category:', error);
        res.status(500).json({ error: 'Failed to fetch historical portfolio value' });
    }
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});