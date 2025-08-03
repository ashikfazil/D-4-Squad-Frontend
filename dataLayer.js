'use strict';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'n3u3da!',
    database: process.env.DB_NAME || 'project',
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
    try {
        const assetId = await addAssetToDB(name, shortForm, price, volume, category, createdAt);
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
export async function deleteAsset(assetId, volumeSold) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [assetRows] = await conn.execute(
            'SELECT name, shortForm, price, volume, category, createdAt FROM assets WHERE Asset_id = ?',
            [assetId]
        );

        if (assetRows.length === 0) {
            console.log(`Asset with Asset_id ${assetId} not found.`);
            return { status: 'not_found' };
        }

        const asset = assetRows[0];
        const currentVolume = asset.volume;

        if (currentVolume < volumeSold) {
            console.log(`Insufficient volume. Available: ${currentVolume}`);
            return { status: 'insufficient_volume', currentVolume };
        }

        if (currentVolume === volumeSold) {
            await conn.execute('DELETE FROM assets WHERE Asset_id = ?', [assetId]);
            console.log(`Asset ${assetId} fully sold and deleted.`);
        } else {
            const newVolume = currentVolume - volumeSold;
            await conn.execute('UPDATE assets SET volume = ? WHERE Asset_id = ?', [newVolume, assetId]);
            console.log(`Asset ${assetId} updated. Remaining volume: ${newVolume}`);
        }

        await addTransaction(asset.name, asset.category, asset.price, asset.createdAt, volumeSold, 'sell');

        return { status: currentVolume === volumeSold ? 'deleted' : 'updated', id: assetId };
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
        const [rows] = await conn.execute(`SELECT * FROM transactions ORDER BY date DESC`);
        return rows;
    } catch (err) {
        console.error("Error fetching transactions:", err);
        throw err;
    } finally {
        await conn.end();
    }
}
