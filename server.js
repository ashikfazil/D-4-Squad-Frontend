import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { addAsset, deleteAsset, updateAsset, getAllAssets } from './dataLayer.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

async function getStockData(symbol) {
  const API_KEY = '';
  const url = `https://api.polygon.io/v2/aggs/ticker/${symbol.toUpperCase()}/prev?apiKey=${API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results && data.results.length > 0) {
      return { currentPrice: data.results[0].c };
    }
    return { error: "No data found for this symbol." };
  } catch (err) {
    return { error: "Error fetching data." };
  }
}

app.get('/api/assets', async (req, res) => {
    try {
        const assets = await getAllAssets();
        res.status(200).json(assets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch assets' });
    }
});

app.get('/api/stock-data/:symbol', async (req, res) => {
    const { symbol } = req.params;
    const data = await getStockData(symbol);
    if (data.error) {
        return res.status(404).json(data);
    }
    res.status(200).json(data);
});

app.post('/api/add-asset', async (req, res) => {
    const { assetName, assetSymbol, shares, purchasePrice, purchaseDate, category } = req.body;
    try {
        const newAssetId = await addAsset(assetName, assetSymbol, purchasePrice, shares, category, purchaseDate);
        res.status(201).json({ message: 'Asset added successfully', assetId: newAssetId });
    } catch (error) {
        res.status(500).json({ error: 'Failed to add asset' });
    }
});

app.put('/api/update-asset/:id', async (req, res) => {
    const assetId = req.params.id;
    const { name, shortForm, price, volume, category } = req.body;
    try {
        const updatedAsset = await updateAsset(assetId, name, shortForm, price, volume, category);
        if (!updatedAsset) {
            return res.status(404).json({ error: 'Asset not found' });
        }
        res.status(200).json({ message: 'Asset updated successfully', data: updatedAsset });
    } catch (error) {
        res.status(500).json({ error: 'Failed to update asset' });
    }
});

app.delete('/api/delete-asset/:id', async (req, res) => {
    const assetId = req.params.id;
    const { volumeSold } = req.body;
    if (!volumeSold || volumeSold <= 0) {
        return res.status(400).json({ error: 'Valid volume to sell must be provided.' });
    }
    try {
        const result = await deleteAsset(assetId, volumeSold);
        if (result.status === 'not_found') {
            return res.status(404).json({ error: 'Asset not found' });
        }
        if (result.status === 'insufficient_volume') {
            return res.status(400).json({ error: `Insufficient volume. Only ${result.currentVolume} units available.` });
        }
        res.status(200).json({ message: `Asset ${result.status} successfully`, data: result });
    } catch (error) {
        res.status(500).json({ error: 'Failed to process asset deletion' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});