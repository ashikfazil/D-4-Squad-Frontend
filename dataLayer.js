'use strict';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import yahooFinance from "yahoo-finance2";
dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'n3u3da!',
    database: process.env.DB_NAME || 'project',
};

// --- NEW: WALLET FUNCTIONS ---
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

// GET ALL ASSETS
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

// INTERNAL: ADD ASSET
async function addAssetToDB(name, shortForm, price, volume, category, createdAt) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const query = `
            INSERT INTO assets (Name, shortForm, price, volume, category, createdAt)   
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await conn.execute(query, [name, shortForm, price, volume, category, createdAt]);
        console.log('Asset added successfully, ID:', result.insertId);
        return result.insertId;
    } catch (error) {
        console.error('Error adding asset:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

// ADD TRANSACTION (buy or sell)
async function addTransaction(name, category, price, date, quantity, type) {
    const conn = await mysql.createConnection(dbConfig);
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
    } finally {
        await conn.end();
    }
}

// PUBLIC: ADD ASSET + BUY TRANSACTION
export async function addAsset(name, shortForm, price, volume, category, createdAt) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        await conn.beginTransaction();
        const totalCost = price * volume;
        const [walletRows] = await conn.execute('SELECT balance, id FROM wallet ORDER BY id LIMIT 1 FOR UPDATE');

        const currentBalance = parseFloat(walletRows[0].balance);

        if (walletRows.length === 0 || currentBalance < totalCost) {
            await conn.rollback();
            throw new Error('Insufficient funds to complete purchase.');
        }
        
        const newBalance = currentBalance - totalCost;
        await conn.execute('UPDATE wallet SET balance = ? WHERE id = ?', [newBalance, walletRows[0].id]);

        const assetQuery = `
            INSERT INTO assets (Name, shortForm, price, volume, category, createdAt)   
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [assetResult] = await conn.execute(assetQuery, [name, shortForm, price, volume, category, createdAt]);
        const assetId = assetResult.insertId;

        const transactionQuery = `
            INSERT INTO transactions (name, category, transaction_type, price, date, quantity)   
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [transactionResult] = await conn.execute(transactionQuery, [name, category, 'buy', price, createdAt, volume]);
        const transactionId = transactionResult.insertId;
        
        await conn.commit();
        console.log('Asset purchased and wallet updated successfully.');
        return { assetId, transactionId };
    } catch (error) {
        await conn.rollback();
        console.error('Error during asset and transaction handling:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

// REMOVED: The entire updateAsset function is gone.

// PUBLIC: DELETE OR REDUCE ASSET + RECORD SELL TRANSACTION
export async function deleteAsset(assetId, volumeSold) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        await conn.beginTransaction();

        const [assetRows] = await conn.execute(
            'SELECT Asset_id, name, shortForm as symbol, volume, category FROM assets WHERE Asset_id = ? FOR UPDATE',
            [assetId]
        );

        if (assetRows.length === 0) {
            await conn.rollback();
            return { status: 'not_found' };
        }

        const asset = assetRows[0];
        const currentVolume = asset.volume;

        if (currentVolume < volumeSold) {
            await conn.rollback();
            return { status: 'insufficient_volume', currentVolume };
        }

        let currentSellPrice;
        try {
            const quote = await yahooFinance.quote(asset.symbol);
            if (!quote || typeof quote.regularMarketPrice !== 'number') {
                throw new Error(`No valid market price found for ${asset.symbol}`);
            }
            currentSellPrice = quote.regularMarketPrice;
        } catch (yahooError) {
            console.error('Yahoo Finance API error:', yahooError);
            throw new Error(`Could not retrieve current market price for ${asset.symbol}.`);
        }
        
        const totalSaleValue = currentSellPrice * volumeSold;
        const [walletRows] = await conn.execute('SELECT balance, id FROM wallet ORDER BY id LIMIT 1 FOR UPDATE');
        
        const newBalance = parseFloat(walletRows[0].balance) + totalSaleValue;

        await conn.execute('UPDATE wallet SET balance = ? WHERE id = ?', [newBalance, walletRows[0].id]);

        const newVolume = currentVolume - volumeSold;
        if (newVolume === 0) {
            await conn.execute('DELETE FROM assets WHERE Asset_id = ?', [assetId]);
        } else {
            await conn.execute('UPDATE assets SET volume = ? WHERE Asset_id = ?', [newVolume, assetId]);
        }

        await addTransaction(asset.name, asset.category, currentSellPrice, new Date(), volumeSold, 'sell');
        
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