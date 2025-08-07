import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import yahooFinance from 'yahoo-finance2';

// Cleaned up imports
import { 
    addAsset, 
    deleteAsset, 
    getAllAssets, 
    getAllTransactions, 
    getCashBalance, 
    updateCashBalance,
    getWeeklyReportData
} from './dataLayer.js';

import { 
    sendWeeklyReportEmail
} from './utils/email.js'; // Assuming you have a utils folder

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());


// === WEEKLY REPORT ENDPOINT (Correctly Placed at the top level) ===
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


// --- All Other Existing API Endpoints ---

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
        res.status(200).json({ currentPrice: result.regularMarketPrice });
    } catch (error) {
        res.status(404).json({ error: `Could not fetch current price for symbol ${symbol}.` });
    }
});

app.get('/api/validate-ticker/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const result = await yahooFinance.quote(symbol);
        res.status(200).json({ isValid: true, name: result.longName || result.shortName });
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
        const newAsset = await addAsset(assetName, assetSymbol, purchasePrice, shares, category, purchaseDate);
        res.status(201).json({ message: 'Asset added successfully', assetId: newAsset.assetId });
    } catch (error) {
        if (error.message.includes('Insufficient funds')) {
            return res.status(400).json({ error: error.message });
        }
        res.status(500).json({ error: 'Failed to add asset' });
    }
});

app.delete('/api/delete-asset/:id', async (req, res) => {
    const assetId = req.params.id;
    const { volumeSold } = req.body;
    try {
        const result = await deleteAsset(assetId, parseFloat(volumeSold));
        if (result.status === 'not_found') return res.status(404).json({ error: 'Asset not found' });
        if (result.status === 'insufficient_volume') return res.status(400).json({ error: `Insufficient volume.` });
        res.status(200).json({ message: `Asset ${result.status} successfully`, data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process asset deletion' });
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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});