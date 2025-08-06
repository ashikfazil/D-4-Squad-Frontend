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

// --- WALLET FUNCTIONS (No changes here) ---
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

// GET ALL ASSETS (No changes here)
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

// ADD TRANSACTION (No changes here)
async function addTransaction(conn, name, category, price, date, quantity, type) {
    // Note: This function now accepts a connection object to be part of a larger transaction
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

// --- MODIFIED: The entire addAsset function is updated ---
// PUBLIC: ADD OR UPDATE ASSET + RECORD BUY TRANSACTION
export async function addAsset(name, shortForm, purchasePrice, purchaseVolume, category, purchaseDate) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        await conn.beginTransaction();

        // Step 1: Handle Wallet Balance
        const totalCost = purchasePrice * purchaseVolume;
        const [walletRows] = await conn.execute('SELECT balance, id FROM wallet ORDER BY id LIMIT 1 FOR UPDATE');
        const currentBalance = parseFloat(walletRows[0].balance);

        if (walletRows.length === 0 || currentBalance < totalCost) {
            await conn.rollback();
            throw new Error('Insufficient funds to complete purchase.');
        }
        
        const newWalletBalance = currentBalance - totalCost;
        await conn.execute('UPDATE wallet SET balance = ? WHERE id = ?', [newWalletBalance, walletRows[0].id]);

        // Step 2: Check if asset already exists
        const [existingAssets] = await conn.execute('SELECT * FROM assets WHERE shortForm = ? FOR UPDATE', [shortForm]);

        if (existingAssets.length > 0) {
            // --- Asset EXISTS: Update it ---
            const existingAsset = existingAssets[0];
            const oldVolume = parseFloat(existingAsset.volume);
            const oldPrice = parseFloat(existingAsset.price);

            const newTotalVolume = oldVolume + purchaseVolume;
            // Calculate the new weighted average price
            const newWeightedPrice = ((oldPrice * oldVolume) + (purchasePrice * purchaseVolume));

            const updateQuery = `
                UPDATE assets 
                SET volume = ?, price = ?, createdAt = ? 
                WHERE Asset_id = ?
            `;
            await conn.execute(updateQuery, [newTotalVolume, newWeightedPrice, purchaseDate, existingAsset.Asset_id]);
            console.log(`Asset ${shortForm} updated successfully.`);
        } else {
            // --- Asset is NEW: Insert it ---
            const insertQuery = `
                INSERT INTO assets (Name, shortForm, price, volume, category, createdAt)   
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            await conn.execute(insertQuery, [name, shortForm, purchasePrice, purchaseVolume, category, purchaseDate]);
            console.log(`Asset ${shortForm} added successfully.`);
        }

        // Step 3: ALWAYS record the new transaction
        await addTransaction(conn, name, category, purchasePrice, purchaseDate, purchaseVolume, 'buy');
        
        // Step 4: Commit all changes
        await conn.commit();
        return { message: 'Asset purchase processed successfully.' };

    } catch (error) {
        await conn.rollback(); // Rollback on any error
        console.error('Error during asset purchase process:', error);
        throw error;
    } finally {
        await conn.end();
    }
}


// PUBLIC: DELETE OR REDUCE ASSET (No changes needed here, logic is sound)
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
        const currentVolume = parseFloat(asset.volume);

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
        
        // Pass the connection to addTransaction
        await addTransaction(conn, asset.name, asset.category, currentSellPrice, new Date(), volumeSold, 'sell');
        
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