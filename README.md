# 📈 AssetFlow - Full-Stack Portfolio Tracker

**AssetFlow** is a dynamic, single-page web application designed for comprehensive personal investment tracking. It features a responsive frontend built with JavaScript that communicates with a Node.js backend to provide real-time asset valuation, historical performance analysis, and complete transaction management.

---

## ✨ Key Features

- **💼 Live Dashboard**  
  At-a-glance overview of:
  - Total Portfolio Value
  - Total Assets Count
  - Real-time calculation of Total Gain/Loss

- **📊 Real-Time Price Updates**  
  Fetches and displays current market prices for all assets, ensuring valuations are always up-to-date.

- **🧁 Dynamic Asset Allocation**  
  A Pie chart visualizes portfolio distribution across Stocks, Bonds, and Commodities.

- **📈 Historical Performance Analysis**  
  Generate interactive line charts for any asset over 1W, 1M, 1Y, or custom ranges.

- **🔧 Robust Asset Management**  
  - Add assets with real-time ticker validation and cash balance check  
  - Sell assets with automatic update to holdings and wallet  
  - Manage cash wallet and track transaction history

- **📋 Categorized Views**  
  Organized tables for Stocks, Bonds, and Commodities holdings.

---

## 🚀 Tech Stack

| Area      | Technology |
|-----------|------------|
| Backend   | Node.js, Express.js, `mysql2`, `dotenv` |
|  API      | `yahoo-finance2`
| Frontend  | JavaScript (ES6+), HTML5, CSS3, Chart.js |
| Database  | MySQL |

---

## 🔧 Setup & Installation

### 🛠️ Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher  
- [MySQL](https://www.mysql.com/) installed and running

---

### 1️⃣ Backend Setup

#### A. Clone & Install:

```bash
# Navigate to backend directory
cd /path/to/backend

# Install dependencies
npm install express mysql2 promise dotenv yahoo-finance2 cors


#### B. Environment Variables
Create a .env file in the backend root directory



#### 🗃️ Database Schema
Run the following SQL in your MySQL server:

CREATE DATABASE IF NOT EXISTS project;
USE project;

CREATE TABLE wallet (
  id INT AUTO_INCREMENT PRIMARY KEY,
  balance DECIMAL(15, 2) NOT NULL DEFAULT 0.00
);

INSERT INTO wallet (balance) VALUES (10000.00);

CREATE TABLE assets (
  Asset_id INT AUTO_INCREMENT PRIMARY KEY,
  Name VARCHAR(255) NOT NULL,
  shortForm VARCHAR(20) NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  volume DECIMAL(20, 8) NOT NULL,
  category VARCHAR(50),
  createdAt DATE,
  UNIQUE KEY `symbol_category` (shortForm, category)
);

CREATE TABLE transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  transaction_type ENUM('buy', 'sell') NOT NULL,
  price DECIMAL(15, 4) NOT NULL,
  date DATETIME,
  quantity DECIMAL(20, 8) NOT NULL
);


🏃‍♂️ Running the Application
Start Backend:

node server.js
# Runs at http://localhost:3000
Serve Frontend:
Option 1: Live Server (VS Code)
Install the Live Server extension and right-click index.html → "Open with Live Server".

Option 2: Node.js serve

npm install -g serve
cd /path/to/frontend
serve .
🌐 API Endpoints
Method	Endpoint	Description
GET	/api/wallet	Get current cash wallet balance
POST	/api/wallet/add	Add funds to cash wallet
GET	/api/assets	Get all portfolio assets
GET	/api/transactions	View all transaction history
POST	/api/add-asset	Add asset and log buy transaction
DELETE	/api/delete-asset/:id	Sell asset and update holdings/cash
GET	/api/current-price/:symbol	Get live market price
GET	/api/validate-ticker/:symbol	Validate asset ticker
GET	/api/historical-data/:symbol	Fetch historical data for charting
