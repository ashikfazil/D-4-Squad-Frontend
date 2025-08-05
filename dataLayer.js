'use strict';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'n3u3da!',
    database: process.env.DB_NAME || 'financial_monitor',
};

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
            INSERT INTO transaction (name, category, transaction_type, price, date, quantity)   
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
    try {
        // Find if an asset with the same symbol already exists
        const conn = await mysql.createConnection(dbConfig);
        const [existing] = await conn.execute('SELECT * FROM assets WHERE shortForm = ?', [shortForm]);

        let assetId;
        if (existing.length > 0) {
            // Asset exists, update it
            const existingAsset = existing[0];
            const totalVolume = parseFloat(existingAsset.volume) + parseFloat(volume);
            const totalCost = (parseFloat(existingAsset.price) * parseFloat(existingAsset.volume)) + (parseFloat(price) * parseFloat(volume));
            const newAvgPrice = totalCost / totalVolume;

            await conn.execute('UPDATE assets SET volume = ?, price = ? WHERE Asset_id = ?', [totalVolume, newAvgPrice, existingAsset.Asset_id]);
            assetId = existingAsset.Asset_id;
        } else {
            // Asset doesn't exist, insert a new one
            const query = `INSERT INTO assets (Name, shortForm, price, volume, category, createdAt) VALUES (?, ?, ?, ?, ?, ?)`;
            const [result] = await conn.execute(query, [name, shortForm, price, volume, category, createdAt]);
            assetId = result.insertId;
        }
        await conn.end();
        
        // Always add a new 'buy' transaction regardless of whether the asset was new or updated
        const transactionId = await addTransaction(name, category, price, createdAt, volume, 'buy');
        return { assetId, transactionId };

    } catch (error) {
        console.error('Error during asset and transaction handling:', error);
        throw error;
    }
}

// PUBLIC: UPDATE ASSET
export async function updateAsset(assetId, name, shortForm, price, volume, category) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const query = `
            UPDATE assets
            SET Name = ?, shortForm = ?, price = ?, volume = ?, category = ?
            WHERE Asset_id = ?
        `;
        const [result] = await conn.execute(query, [name, shortForm, price, volume, category, assetId]);
        if (result.affectedRows === 0) return null;
        return { id: assetId, name, shortForm, price, volume, category };
    } catch (error) {
        console.error('Error updating asset:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

// PUBLIC: DELETE OR REDUCE ASSET + RECORD SELL TRANSACTION
export async function deleteAsset(assetId, volumeSold, salePrice) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [assetRows] = await conn.execute(
            'SELECT Asset_id, name, shortForm as symbol, volume, category FROM assets WHERE Asset_id = ?',
            [assetId]
        );

        if (assetRows.length === 0) {
            return { status: 'not_found' };
        }

        const asset = assetRows[0];
        const currentVolume = asset.volume;

        if (currentVolume < volumeSold) {
            return { status: 'insufficient_volume', currentVolume };
        }
        
        const newVolume = currentVolume - volumeSold;
        if (newVolume < 0.001) { // Use a small threshold to handle floating point inaccuracies
            await conn.execute('DELETE FROM assets WHERE Asset_id = ?', [assetId]);
        } else {
            await conn.execute('UPDATE assets SET volume = ? WHERE Asset_id = ?', [newVolume, assetId]);
        }

        // Record the transaction with the user-provided sale price
        await addTransaction(asset.name, asset.category, salePrice, new Date(), volumeSold, 'sell');

        return { status: newVolume < 0.001 ? 'deleted' : 'updated', id: assetId };
    } catch (error) {
        console.error('Error processing asset sell:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function getAllTransactions() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await conn.execute(`SELECT * FROM transaction ORDER BY date DESC`);
        return rows;
    } catch (err) {
        console.error("Error fetching transactions:", err);
        throw err;
    } finally {
        await conn.end();
    }
}