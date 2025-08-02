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

export async function getAllAssets() {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [rows] = await conn.execute(
            'SELECT Asset_id as id, Name as name, shortForm as symbol, price, volume as shares, createdAt as purchaseDate, category FROM assets'
        );
        return rows;
    } catch (error) {
        console.error('Error fetching all assets:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function addAsset(name, shortForm, price, volume, category, createdAt) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const query = `
            INSERT INTO assets (Name, shortForm, price, volume, category, createdAt)   
            VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await conn.execute(query, [name, shortForm, price, volume, category, createdAt]);
        return result.insertId;
    } catch (error) {
        console.error('Error adding asset:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function updateAsset(assetId, name, shortForm, price, volume, category) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const query = `
            UPDATE assets
            SET Name = ?, shortForm = ?, price = ?, volume = ?, category = ?
            WHERE Asset_id = ?
        `;
        const [result] = await conn.execute(query, [name, shortForm, price, volume, category, assetId]);
        if (result.affectedRows === 0) {
            return null;
        }
        return { id: assetId, name, shortForm, price, volume, category };
    } catch (error) {
        console.error('Error updating asset:', error);
        throw error;
    } finally {
        await conn.end();
    }
}

export async function deleteAsset(assetId, volumeSold) {
    const conn = await mysql.createConnection(dbConfig);
    try {
        const [assetRows] = await conn.execute('SELECT volume FROM assets WHERE Asset_id = ?', [assetId]);

        if (assetRows.length === 0) {
            return { status: 'not_found' };
        }

        const currentVolume = assetRows[0].volume;

        if (currentVolume < volumeSold) {
            return { status: 'insufficient_volume', currentVolume };
        }

        if (currentVolume === volumeSold) {
            await conn.execute('DELETE FROM assets WHERE Asset_id = ?', [assetId]);
            return { status: 'deleted', id: assetId };
        } else {
            const newVolume = currentVolume - volumeSold;
            await conn.execute('UPDATE assets SET volume = ? WHERE Asset_id = ?', [newVolume, assetId]);
            return { status: 'updated', id: assetId, newVolume };
        }
    } catch (error) {
        console.error('Error processing asset deletion or update:', error);
        throw error;
    } finally {
        await conn.end();
    }
}