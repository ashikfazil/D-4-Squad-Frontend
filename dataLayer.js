'use strict';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import yahooFinance from "yahoo-finance2";
import { sendLowBalanceWarningEmail } from './utils/email.js'; // Assuming you have a utils folder

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'n3u3da!',
    database: process.env.DB_NAME || 'project',
};

export async function getWeeklyReportData() {
    console.log("Gathering data for weekly performance report...");
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [assets] = await conn.execute(`SELECT Name as name, shortForm as symbol, volume as shares FROM assets`);
        const [walletRows] = await conn.execute('SELECT balance FROM wallet LIMIT 1');
        const cashBalance = walletRows.length > 0 ? parseFloat(walletRows[0].balance) : 0;

        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 8);

        const dailyValues = new Map();
        for (let i = 0; i < 7; i++) {
            const date = new Date();
            date.setDate(endDate.getDate() - i);
            dailyValues.set(date.toISOString().split('T')[0], cashBalance);
        }

        const historicalPromises = assets.map(asset =>
            yahooFinance.historical(asset.symbol, { period1: startDate, period2: endDate })
                .catch(() => {
                    console.warn(`Could not fetch historical data for symbol: ${asset.symbol}`);
                    return [];
                })
        );
        
        const historicalResults = await Promise.all(historicalPromises);
        
        assets.forEach((asset, index) => {
            const history = historicalResults[index];
            for (const day of history) {
                const dateStr = day.date.toISOString().split('T')[0];
                if (dailyValues.has(dateStr)) {
                    const dailyAssetValue = day.close * asset.shares;
                    dailyValues.set(dateStr, dailyValues.get(dateStr) + dailyAssetValue);
                }
            }
        });

        const weeklyPerformance = Array.from(dailyValues.entries())
            .map(([date, value]) => ({ date, value }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        const pricePromises = assets.map(asset => yahooFinance.quote(asset.symbol).catch(() => null));
        const quotes = await Promise.all(pricePromises);
        
        const currentHoldings = assets.map((asset, index) => {
            const livePrice = quotes[index]?.regularMarketPrice || 0;
            return {
                name: asset.name,
                symbol: asset.symbol,
                shares: asset.shares,
                marketValue: livePrice * asset.shares,
            };
        });

        return { weeklyPerformance, currentHoldings };

    } catch (error) {
        console.error("Error generating weekly report data:", error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function getCashBalance() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await conn.execute('SELECT balance FROM wallet ORDER BY id LIMIT 1');
        return rows.length > 0 ? rows[0].balance : 0;
    } catch (error) {
        console.error('Error fetching cash balance:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function updateCashBalance(amount) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const query = 'UPDATE wallet SET balance = ? WHERE id = (SELECT id FROM (SELECT id FROM wallet ORDER BY id LIMIT 1) as w)';
        const [result] = await conn.execute(query, [amount]);
        return result;
    } catch (error) {
        console.error('Error updating cash balance:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function getAllAssets() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await conn.execute(
            `SELECT Asset_id as id, Name as name, shortForm as symbol, price, volume as shares, createdAt as purchaseDate, category FROM assets`
        );
        return rows;
    } catch (error) {
        console.error('Error fetching all assets:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

async function addTransaction(name, category, type, price, date, quantity, conn) {
    try {
        const query = `
            INSERT INTO transactions (name, category, transaction_type, price, date, quantity)   
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await conn.execute(query, [name, category, type, price, date, quantity]);
        console.log(`Transaction (${type}) added successfully, ID:`, result.insertId);
        return result.insertId;
    } catch (error) {
        console.error('Error adding transaction:', error);
        throw error;
    }
}

export async function addAsset(name, shortForm, price, volume, category, createdAt) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        await conn.beginTransaction();
        const totalCost = price * volume;

        // Fetch the balance AND the user's email for the potential alert
        const [walletRows] = await conn.execute('SELECT balance, user_email, id FROM wallet ORDER BY id LIMIT 1 FOR UPDATE');

        if (walletRows.length === 0 || parseFloat(walletRows[0].balance) < totalCost) {
            await conn.rollback();
            throw new Error('Insufficient funds to complete purchase.');
        }
        
        const newBalance = parseFloat(walletRows[0].balance) - totalCost;
        await conn.execute('UPDATE wallet SET balance = ? WHERE id = ?', [newBalance, walletRows[0].id]);

        const assetQuery = `INSERT INTO assets (Name, shortForm, price, volume, category, createdAt) VALUES (?, ?, ?, ?, ?, ?)`;
        const [assetResult] = await conn.execute(assetQuery, [name, shortForm, price, volume, category, createdAt]);
        const assetId = assetResult.insertId;

        const transactionId = await addTransaction(name, category, 'buy', price, createdAt, volume, conn);
        
        await conn.commit();
        console.log('Asset purchased and wallet updated successfully.');

        // === NEW LOGIC BLOCK: CHECK BALANCE AND SEND ALERT IF NEEDED ===
        const lowBalanceThreshold = 500;
        const userEmail = walletRows[0].user_email;

        if (newBalance < lowBalanceThreshold && userEmail) {
            console.log(`New balance of ${newBalance} is below threshold of ${lowBalanceThreshold}. Triggering alert.`);
            // We send the alert *after* the transaction is committed.
            // We use a .catch here so a failed email doesn't crash the user's experience.
            sendLowBalanceWarningEmail(userEmail, newBalance, lowBalanceThreshold)
                .catch(err => console.error("Alert email failed to send, but purchase was successful:", err));
        }
        // === END OF NEW LOGIC BLOCK ===

        return { assetId, transactionId };
    } catch (error) {
        await conn.rollback();
        console.error('Error during asset and transaction handling:', error);
        throw error;
    } finally {
        await conn.end();
    }
}
export async function deleteAsset(assetId, volumeSold) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        await conn.beginTransaction();
        const [assetRows] = await conn.execute('SELECT * FROM assets WHERE Asset_id = ? FOR UPDATE', [assetId]);
        if (assetRows.length === 0) {
            await conn.rollback();
            return { status: 'not_found' };
        }

        const asset = { ...assetRows[0], symbol: assetRows[0].shortForm, shares: assetRows[0].volume };
        if (asset.shares < volumeSold) {
            await conn.rollback();
            return { status: 'insufficient_volume', currentVolume: asset.shares };
        }

        const quote = await yahooFinance.quote(asset.symbol);
        const currentSellPrice = quote.regularMarketPrice;
        const totalSaleValue = currentSellPrice * volumeSold;
        
        const [walletRows] = await conn.execute('SELECT balance, id FROM wallet ORDER BY id LIMIT 1 FOR UPDATE');
        const newBalance = parseFloat(walletRows[0].balance) + totalSaleValue;
        await conn.execute('UPDATE wallet SET balance = ? WHERE id = ?', [newBalance, walletRows[0].id]);

        const newVolume = asset.shares - volumeSold;
        if (newVolume === 0) {
            await conn.execute('DELETE FROM assets WHERE Asset_id = ?', [assetId]);
        } else {
            await conn.execute('UPDATE assets SET volume = ? WHERE Asset_id = ?', [newVolume, assetId]);
        }
        
        await addTransaction(asset.Name, asset.category, 'sell', currentSellPrice, new Date(), volumeSold, conn);
        
        await conn.commit();
        return { status: newVolume === 0 ? 'deleted' : 'updated', id: assetId };
    } catch (error) {
        await conn.rollback();
        console.error('Error processing asset sell:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function getAllTransactions() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await conn.execute(`SELECT * FROM transactions ORDER BY date DESC`);
        return rows;
    } catch (err) {
        console.error("Error fetching transactions:", err);
        throw err;
    } finally {
        await conn.end();
    }
}