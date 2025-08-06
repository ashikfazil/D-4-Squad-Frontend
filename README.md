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

## 🖼️ Screenshots

> _(Add screenshots here)_

| Dashboard | Performance View |
|----------|------------------|
| ![Dashboard](./screenshots/dashboard.png) | ![Performance](./screenshots/performance.png) |

| Add Asset | Transaction History |
|----------|---------------------|
| ![Add Asset](./screenshots/add-asset.png) | ![Transactions](./screenshots/transaction-history.png) |

---

## 🚀 Tech Stack

| Area      | Technology |
|-----------|------------|
| Backend   | Node.js, Express.js, `mysql2`, `yahoo-finance2`, `dotenv` |
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
