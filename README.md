# ☕ Velvet & Bean Café Management System

A simple, fast, and faculty-ready **Full-Stack Café Management System** built with a clean **3-Part Architecture**:
1. **Frontend** (HTML5 + CSS3 + Vanilla JavaScript)
2. **Backend** (Node.js + Express)
3. **Database** (MySQL 8.0)

---

## 📖 What is this Project? (In Plain English)

Imagine you own a busy coffee shop called **Velvet & Bean Coffee Co.**:
- Customers walk in and order coffees, pastries, and sandwiches.
- You need to track dining tables (which table is free, occupied, or reserved).
- You need to bill customers with correct taxes (5% GST) and collect payments via Cash, UPI, or Card.
- You need to keep track of your kitchen ingredients (coffee beans, milk, cheese) and know when to restock before running out.

This project does all of that automatically. It connects a clean website directly to an official **MySQL Relational Database** using **Node.js**.

---

## 🏗️ The 3-Part Architecture

Everything in this project has been organized into **3 simple folders**:

```text
cafe management system/
│
├── 📂 frontend/        <-- PART 1: The Visual Website (What users see)
│   ├── index.html       • Clean web page layout with tabs (Dashboard, POS, Orders, Tables, etc.)
│   ├── style.css        • Warm coffee & cream aesthetic styling (responsive, no frameworks needed)
│   └── app.js           • Basic JavaScript that talks to the backend using fetch()
│
├── 📂 database/        <-- PART 2: The Permanent Memory (MySQL Database)
│   ├── cafe_management.sql  • 10 relational tables, 7 automatic triggers, views, seed data
│   └── demo_queries.sql     • Prewritten SQL queries for faculty presentations
│
├── 📂 backend/         <-- PART 3: The Brain (Node.js + Express Server)
│   ├── db.js            • MySQL connection pool (secure credentials from .env)
│   └── server.js        • Express server providing clean REST API routes (/api/orders, /api/menu, etc.)
│
├── .env                 • Database passwords & port configuration
├── package.json         • Node.js dependencies (express, mysql2, cors, dotenv)
└── README.md            • This friendly guide!
```

---

## 🔄 How the 3 Parts Work Together

Here is a simple example of what happens when a customer orders a Cappuccino:

1. **Frontend (`frontend/app.js`)**:
   - The cashier clicks **"Classic Cappuccino"** on the website and hits **"Place Order & Generate Bill"**.
   - The browser bundles this information and sends an HTTP `POST` request to the backend at `/api/orders`.

2. **Backend (`backend/server.js`)**:
   - Node.js receives the request.
   - It starts an **ACID Transaction** (all-or-nothing guarantee).
   - It fetches the official price of the Cappuccino directly from the database.
   - It inserts the order into the `ORDER` table, inserts the items into `ORDER_ITEM`, computes a 5% GST bill in `BILL`, and logs the settlement in `PAYMENT`.

3. **Database (`database/cafe_management.sql`)**:
   - When the line item is inserted, MySQL triggers fire automatically:
     - **Trigger 1** (`trg_calc_orderitem_subtotal`): Automatically multiplies `Quantity × Price` to compute `SubTotal`.
     - **Trigger 3** (`trg_update_order_total_insert`): Updates the total amount on the parent order header.
     - **Trigger 5** (`trg_deduct_inventory_stock`): Automatically subtracts the coffee beans from the `INVENTORY` table.
   - MySQL finishes the transaction safely, and Node.js sends back a success message: *"Order #16 created, Bill #16 generated!"*
   - The frontend immediately displays the bill and receipt on screen.

---

## 🗄️ The 10 Database Entities (Tables)

All 10 tables are designed in **Third Normal Form (3NF)** so there is zero duplicate or conflicting data:

| # | Table Name | Real-World Role |
|---|---|---|
| **1** | **`CUSTOMER`** | Stores customer names, phone numbers, emails, and addresses. |
| **2** | **`STAFF`** | Stores employees (Baristas, Chefs, Cashiers, Floor Managers) handling orders. |
| **3** | **`TABLE`** | Stores dining tables, seating capacity, locations, and real-time status. |
| **4** | **`MENU_ITEM`** | Stores all coffees, teas, pastries, and food items sold by the café. |
| **5** | **`ORDER`** | Stores the main order header (Date, Type, Status, Total Amount). |
| **6** | **`ORDER_ITEM`** | Stores individual items belonging to each order with quantities and prices. |
| **7** | **`BILL`** | Stores financial bills with Net Subtotal, 5% GST Tax, and Gross Total. |
| **8** | **`PAYMENT`** | Stores payment records settling bills (Cash, UPI, Card) with unique Txn IDs. |
| **9** | **`RESERVATION`** | Stores customer table reservations with date, arrival time, and party size. |
| **10** | **`INVENTORY`** | Tracks ingredient and product stock linked to menu items with reorder warnings. |

---

## ⚡ The 7 Basic Database Triggers

Triggers are automatic programs built directly into MySQL that run whenever data is added or changed:

1. **`trg_calc_orderitem_subtotal`** (`BEFORE INSERT on ORDER_ITEM`):
   Auto-calculates `SubTotal = Quantity × Price` so you never have arithmetic errors.
2. **`trg_recalc_orderitem_subtotal`** (`BEFORE UPDATE on ORDER_ITEM`):
   Recalculates the subtotal if a waiter updates an item's quantity.
3. **`trg_update_order_total_insert`** (`AFTER INSERT on ORDER_ITEM`):
   Automatically sums all item subtotals and updates `Total_Amount` in `ORDER`.
4. **`trg_update_order_total_delete`** (`AFTER DELETE on ORDER_ITEM`):
   Automatically reduces the order total if an item is cancelled or removed.
5. **`trg_deduct_inventory_stock`** (`AFTER INSERT on ORDER_ITEM`):
   Automatically subtracts the ordered quantity from stock in `INVENTORY`.
6. **`trg_sync_table_reservation`** (`AFTER INSERT on RESERVATION`):
   Automatically marks the table's status in `TABLE` as `'Reserved'` when a booking is confirmed.
7. **`trg_generate_payment_txn`** (`BEFORE INSERT on PAYMENT`):
   Automatically generates a standard tracking reference code (e.g. `TXN-UPI-482910`) if left blank.

---

## 🚀 How to Run the Project (Step-by-Step)

### Step 1: Initialize the MySQL Database
1. Open **MySQL Workbench** or your MySQL command line.
2. Open and execute the script:
   ```text
   database/cafe_management.sql
   ```
3. This creates the database `cafe_management`, all 10 tables, indexes, views, triggers, and realistic sample data.

### Step 2: Configure Database Password
Open the `.env` file in the project folder and make sure your MySQL password is correct:
```ini
PORT=3000
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mysql_password_here
DB_NAME=cafe_management
```

### Step 3: Start the Backend Server
Open your terminal (or PowerShell) in this folder and run:
```bash
npm start
```
You will see:
```text
================================================================
☕ CAFÉ MANAGEMENT SYSTEM — BACKEND API SERVER RUNNING
📡 Local URL: http://localhost:3000
📊 API Health: http://localhost:3000/api/health
================================================================
```

### Step 4: Open in Your Browser
Open your browser and navigate to:
```text
http://localhost:3000
```
That's it! You have a fully interactive Café Management System running live!

---

## 🎯 Key Features Available on the Website

- **📊 Dashboard**: Live KPI cards showing Total Revenue (₹), Active Orders, Menu Items, Low Stock count, and Bestseller rankings.
- **🛒 POS (Point of Sale)**: Interactive menu categories, cart calculation, customer selection, and live order placement.
- **📋 Orders & Bills**: Search past orders and click **"View Items"** to see complete receipts with item breakdowns and tax calculations.
- **☕ Menu Catalog**: View all items and active pricing.
- **🪑 Tables & Bookings**: Visual colored table cards (Available, Occupied, Reserved) and reservation forms.
- **📦 Inventory Tracker**: Live stock progress with badges highlighting items below their minimum reorder levels.
- **👥 Customer Directory**: Customer order history and lifetime spend in INR ₹.
- **⚡ SQL Demo Lab**: Interactive panel to select and run any of the prewritten faculty demonstration queries live against MySQL.
