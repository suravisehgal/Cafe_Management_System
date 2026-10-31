// ================================================================
// ☕ Velvet & Bean Café Management System — Backend Express Server
// Full-Stack REST API Server with MySQL ACID Transactions
// ================================================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve Static Frontend Assets
app.use(express.static(path.join(__dirname, '../frontend')));

// ================================================================
// 1. HEALTH CHECK & SYSTEM DIAGNOSTICS
// ================================================================
app.get('/api/health', async (req, res) => {
  const dbStatus = await db.testConnection();
  res.json({
    status: dbStatus.ok ? 'online' : 'degraded',
    server: 'Velvet & Bean Café API Server (Node.js + Express)',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    database: {
      connected: dbStatus.ok,
      host: process.env.DB_HOST || '127.0.0.1',
      name: process.env.DB_NAME || 'cafe_management',
      message: dbStatus.message
    }
  });
});

// ================================================================
// 2. DASHBOARD KPI METRICS
// ================================================================
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    // Total Revenue & Bills count
    const [revenueRow] = await db.query(`
      SELECT 
        COALESCE(SUM(Total_Amount), 0) AS totalRevenue,
        COALESCE(SUM(Sub_Total), 0) AS netSales,
        COALESCE(SUM(Tax_Amount), 0) AS totalTax,
        COUNT(Bill_ID) AS totalBills
      FROM bill
    `);

    // Total Orders & Active Orders
    const [ordersRow] = await db.query(`
      SELECT 
        COUNT(Order_ID) AS totalOrders,
        SUM(CASE WHEN Status = 'In-Progress' OR Status = 'Pending' THEN 1 ELSE 0 END) AS activeOrders,
        SUM(CASE WHEN Status = 'Completed' THEN 1 ELSE 0 END) AS completedOrders
      FROM \`order\`
    `);

    // Inventory Alerts
    const [invRow] = await db.query(`
      SELECT 
        COUNT(Inventory_ID) AS totalStockItems,
        SUM(CASE WHEN Quantity_Stock <= Reorder_Level THEN 1 ELSE 0 END) AS lowStockCount,
        SUM(CASE WHEN Quantity_Stock = 0 THEN 1 ELSE 0 END) AS outOfStockCount
      FROM inventory
    `);

    // Customer & Table Counts
    const [custRow] = await db.query(`SELECT COUNT(Customer_ID) AS totalCustomers FROM customers`);
    const [tableRow] = await db.query(`
      SELECT 
        COUNT(Table_ID) AS totalTables,
        SUM(CASE WHEN Status = 'Available' THEN 1 ELSE 0 END) AS availableTables,
        SUM(CASE WHEN Status = 'Occupied' THEN 1 ELSE 0 END) AS occupiedTables,
        SUM(CASE WHEN Status = 'Reserved' THEN 1 ELSE 0 END) AS reservedTables
      FROM \`table\`
    `);

    // Top 5 Bestselling Items
    const bestsellers = await db.query(`
      SELECT 
        Item_ID,
        Item_Name,
        Category,
        Price,
        Total_Quantity_Sold,
        Total_Revenue
      FROM v_bestselling_items
      ORDER BY Total_Quantity_Sold DESC
      LIMIT 5
    `);

    // Recent 5 Orders
    const recentOrders = await db.query(`
      SELECT 
        o.Order_ID,
        o.Order_Date,
        o.Order_Type,
        o.Status,
        o.Total_Amount,
        c.Customer_Name,
        s.Staff_Name,
        b.Total_Amount AS Bill_Amount,
        p.Payment_Method,
        p.Payment_Status
      FROM \`order\` o
      LEFT JOIN customers c ON o.Customer_ID = c.Customer_ID
      LEFT JOIN staff s ON o.Staff_ID = s.Staff_ID
      LEFT JOIN bill b ON o.Order_ID = b.Order_ID
      LEFT JOIN payment p ON b.Bill_ID = p.Bill_ID
      ORDER BY o.Order_ID DESC
      LIMIT 5
    `);

    res.json({
      success: true,
      data: {
        financials: {
          totalRevenue: Number(revenueRow.totalRevenue || 0),
          netSales: Number(revenueRow.netSales || 0),
          totalTax: Number(revenueRow.totalTax || 0),
          totalBills: Number(revenueRow.totalBills || 0)
        },
        orders: {
          totalOrders: Number(ordersRow.totalOrders || 0),
          activeOrders: Number(ordersRow.activeOrders || 0),
          completedOrders: Number(ordersRow.completedOrders || 0)
        },
        inventory: {
          totalStockItems: Number(invRow.totalStockItems || 0),
          lowStockCount: Number(invRow.lowStockCount || 0),
          outOfStockCount: Number(invRow.outOfStockCount || 0)
        },
        customers: {
          totalCustomers: Number(custRow.totalCustomers || 0)
        },
        tables: {
          totalTables: Number(tableRow.totalTables || 0),
          available: Number(tableRow.availableTables || 0),
          occupied: Number(tableRow.occupiedTables || 0),
          reserved: Number(tableRow.reservedTables || 0)
        },
        bestsellers,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// 3. MENU MANAGEMENT
// ================================================================
app.get('/api/menu', async (req, res) => {
  try {
    const menuItems = await db.query(`
      SELECT 
        Item_ID,
        Item_Name,
        Category,
        Price,
        Is_Active,
        COALESCE(Image_URL, '/images/coffees/cappuccino.jpg') AS Image_URL,
        COALESCE(Description, 'Velvet & Bean handcrafted specialty recipe') AS Description,
        Stock_Quantity,
        Unit,
        Reorder_Level,
        Stock_Status
      FROM v_active_menu
      ORDER BY Category, Item_Name
    `);
    res.json({ success: true, data: menuItems });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/menu', async (req, res) => {
  const { Item_Name, Category, Price, Initial_Stock = 50, Unit = 'Portions', Reorder_Level = 10 } = req.body;
  if (!Item_Name || !Category || Price === undefined) {
    return res.status(400).json({ success: false, message: 'Item_Name, Category, and Price are required' });
  }

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();

    const [itemResult] = await conn.query(
      `INSERT INTO menu_items (Item_Name, Category, Price, Is_Active) VALUES (?, ?, ?, 1)`,
      [Item_Name, Category, Price]
    );

    const newItemId = itemResult.insertId;

    await conn.query(
      `INSERT INTO inventory (Item_ID, Quantity_Stock, Unit, Reorder_Level, Last_Updated) VALUES (?, ?, ?, ?, NOW())`,
      [newItemId, Initial_Stock, Unit, Reorder_Level]
    );

    await conn.commit();
    res.status(201).json({ success: true, message: 'Menu item created successfully', Item_ID: newItemId });
  } catch (error) {
    await conn.rollback();
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

app.put('/api/menu/:id', async (req, res) => {
  const itemId = req.params.id;
  const { Item_Name, Category, Price, Is_Active } = req.body;

  try {
    await db.query(
      `UPDATE menu_items SET Item_Name = COALESCE(?, Item_Name), Category = COALESCE(?, Category), Price = COALESCE(?, Price), Is_Active = COALESCE(?, Is_Active) WHERE Item_ID = ?`,
      [Item_Name, Category, Price, Is_Active, itemId]
    );
    res.json({ success: true, message: 'Menu item updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.delete('/api/menu/:id', async (req, res) => {
  const itemId = req.params.id;
  try {
    // Soft toggle or delete
    await db.query(`UPDATE menu_items SET Is_Active = CASE WHEN Is_Active = 1 THEN 0 ELSE 1 END WHERE Item_ID = ?`, [itemId]);
    res.json({ success: true, message: 'Menu item status toggled' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// 4. ORDERS & POINT OF SALE (POS) — ACID TRANSACTION
// ================================================================
app.get('/api/orders', async (req, res) => {
  try {
    const { search, status, type } = req.query;
    let sql = `
      SELECT 
        o.Order_ID,
        o.Order_Date,
        o.Order_Type,
        o.Status AS Order_Status,
        o.Total_Amount AS Order_Total,
        c.Customer_Name,
        c.Phone AS Customer_Phone,
        s.Staff_Name,
        b.Bill_ID,
        b.Sub_Total,
        b.Tax_Amount,
        b.Total_Amount AS Bill_Total,
        p.Payment_Method,
        p.Payment_Status,
        p.Transaction_ref,
        (SELECT COUNT(*) FROM order_item oi WHERE oi.Order_ID = o.Order_ID) AS Total_Items_Count
      FROM \`order\` o
      LEFT JOIN customers c ON o.Customer_ID = c.Customer_ID
      LEFT JOIN staff s ON o.Staff_ID = s.Staff_ID
      LEFT JOIN bill b ON o.Order_ID = b.Order_ID
      LEFT JOIN payment p ON b.Bill_ID = p.Bill_ID
      WHERE 1=1
    `;
    const params = [];

    if (status) {
      sql += ` AND o.Status = ?`;
      params.push(status);
    }
    if (type) {
      sql += ` AND o.Order_Type = ?`;
      params.push(type);
    }
    if (search) {
      sql += ` AND (c.Customer_Name LIKE ? OR p.Transaction_ref LIKE ? OR o.Order_ID = ?)`;
      params.push(`%${search}%`, `%${search}%`, search);
    }

    sql += ` ORDER BY o.Order_ID DESC LIMIT 100`;

    const orders = await db.query(sql, params);
    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/orders/:id', async (req, res) => {
  try {
    const orderId = req.params.id;

    // Header & Customer & Staff
    const [orderHeader] = await db.query(
      `SELECT 
        o.Order_ID,
        o.Order_Date,
        o.Order_Type,
        o.Status AS Order_Status,
        o.Total_Amount,
        c.Customer_ID,
        c.Customer_Name,
        c.Phone AS Customer_Phone,
        c.Email AS Customer_Email,
        s.Staff_ID,
        s.Staff_Name,
        s.Role AS Staff_Role,
        b.Bill_ID,
        b.Bill_Date,
        b.Sub_Total,
        b.Tax_Amount,
        b.Total_Amount AS Bill_Total,
        p.Payment_ID,
        p.Payment_Method,
        p.Payment_Status,
        p.Payment_Date,
        p.Transaction_ref
      FROM \`order\` o
      LEFT JOIN customers c ON o.Customer_ID = c.Customer_ID
      LEFT JOIN staff s ON o.Staff_ID = s.Staff_ID
      LEFT JOIN bill b ON o.Order_ID = b.Order_ID
      LEFT JOIN payment p ON b.Bill_ID = p.Bill_ID
      WHERE o.Order_ID = ?`,
      [orderId]
    );

    if (!orderHeader) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    // Line items
    const items = await db.query(
      `SELECT 
        oi.Order_Item_ID,
        oi.Item_ID,
        m.Item_Name,
        m.Category,
        oi.Quantity,
        oi.Unit_Price,
        oi.SubTotal
      FROM order_item oi
      JOIN menu_items m ON oi.Item_ID = m.Item_ID
      WHERE oi.Order_ID = ?
      ORDER BY oi.Order_Item_ID`,
      [orderId]
    );

    res.json({
      success: true,
      data: {
        ...orderHeader,
        items
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// CREATE NEW ORDER (Full ACID Transaction with 7 Database Triggers)
app.post('/api/orders', async (req, res) => {
  let {
    Customer_ID,
    Customer_Name,
    Customer_Phone,
    Staff_ID,
    Order_Type = 'Dine-In',
    Table_ID = null,
    Payment_Method = 'UPI',
    items = []
  } = req.body;

  if (!items || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Order must contain at least one item' });
  }

  const conn = await db.pool.getConnection();
  try {
    // 1. Begin ACID Transaction
    await conn.beginTransaction();

    // If Customer_Name is provided without Customer_ID, lookup existing customer by phone or register a guest record
    if (!Customer_ID && Customer_Name) {
      const [existingCust] = await conn.query('SELECT Customer_ID FROM customers WHERE Phone = ? LIMIT 1', [Customer_Phone || '']);
      if (existingCust.length > 0) {
        Customer_ID = existingCust[0].Customer_ID;
      } else {
        const [newCust] = await conn.query(
          'INSERT INTO customers (Customer_Name, Phone, Email, Address, Loyalty_Points) VALUES (?, ?, ?, ?, 10)',
          [Customer_Name, Customer_Phone || '9876543210', `${Customer_Name.toLowerCase().replace(/\\s+/g, '')}@guest.com`, 'Online Customer Order', 10]
        );
        Customer_ID = newCust.insertId;
      }
    }

    // 2. Insert Order Header (Triggers will automatically compute and update Total_Amount)
    const [orderInsert] = await conn.query(
      `INSERT INTO \`order\` (Order_Date, Status, Total_Amount, Order_Type, Customer_ID, Staff_ID)
       VALUES (NOW(), 'Completed', 0.00, ?, ?, ?)`,
      [Order_Type, Customer_ID || 1, Staff_ID || 2]
    );
    const orderId = orderInsert.insertId;

    // 3. Insert each Order Item (Triggers fire: trg_calc_orderitem_subtotal, trg_update_order_total_insert, trg_deduct_inventory_stock)
    for (const item of items) {
      await conn.query(
        `INSERT INTO order_item (Order_ID, Item_ID, Quantity, Unit_Price, SubTotal)
         VALUES (?, ?, ?, NULL, NULL)`,
        [orderId, item.Item_ID, item.Quantity || 1]
      );
    }

    // 4. Retrieve automatically updated Total_Amount from Order (calculated by triggers)
    const [updatedOrder] = await conn.query(
      `SELECT Total_Amount FROM \`order\` WHERE Order_ID = ?`,
      [orderId]
    );
    const subTotal = Number(updatedOrder[0]?.Total_Amount || 0);

    // 5. Calculate 5% GST & Grand Total
    const taxAmount = Number((subTotal * 0.05).toFixed(2));
    const grandTotal = Number((subTotal + taxAmount).toFixed(2));

    // 6. Generate Bill
    const [billInsert] = await conn.query(
      `INSERT INTO bill (Order_ID, Bill_Date, Sub_Total, Tax_Amount, Total_Amount)
       VALUES (?, NOW(), ?, ?, ?)`,
      [orderId, subTotal, taxAmount, grandTotal]
    );
    const billId = billInsert.insertId;

    // 7. Settle Payment (Trigger trg_generate_payment_txn automatically generates tracking ref if blank)
    const [paymentInsert] = await conn.query(
      `INSERT INTO payment (Bill_ID, Payment_Date, Amount_Paid, Payment_Method, Payment_Status, Transaction_ref)
       VALUES (?, NOW(), ?, ?, 'Completed', NULL)`,
      [billId, grandTotal, Payment_Method]
    );
    const paymentId = paymentInsert.insertId;

    // 8. If Dine-In Table specified, update table status to Occupied
    if (Table_ID) {
      await conn.query(`UPDATE \`table\` SET Status = 'Occupied' WHERE Table_ID = ?`, [Table_ID]);
    }

    // 9. Fetch generated Payment info (with Trigger-generated Transaction Reference)
    const [paymentRow] = await conn.query(
      `SELECT Transaction_ref FROM payment WHERE Payment_ID = ?`,
      [paymentId]
    );

    // 10. Commit ACID Transaction
    await conn.commit();

    res.status(201).json({
      success: true,
      message: `Order #${orderId} placed & Bill #${billId} generated!`,
      data: {
        orderId,
        billId,
        paymentId,
        subTotal,
        taxAmount,
        grandTotal,
        paymentMethod: Payment_Method,
        transactionRef: paymentRow[0]?.Transaction_ref
      }
    });
  } catch (error) {
    await conn.rollback();
    console.error('Error placing order:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    conn.release();
  }
});

// ================================================================
// 5. DINING TABLES & RESERVATIONS
// ================================================================
app.get('/api/tables', async (req, res) => {
  try {
    const tables = await db.query(`
      SELECT 
        Table_ID,
        Table_Number,
        Capacity,
        Location,
        Status
      FROM \`table\`
      ORDER BY Table_Number
    `);
    res.json({ success: true, data: tables });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.put('/api/tables/:id/status', async (req, res) => {
  const { Status } = req.body;
  try {
    await db.query(`UPDATE \`table\` SET Status = ? WHERE Table_ID = ?`, [Status, req.params.id]);
    res.json({ success: true, message: `Table status updated to ${Status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/tables', async (req, res) => {
  const { Table_Number, Capacity = 4, Location = 'Indoor', Status = 'Available' } = req.body;
  try {
    const [result] = await db.query(
      `INSERT INTO \`table\` (Table_Number, Capacity, Location, Status) VALUES (?, ?, ?, ?)`,
      [Table_Number, Capacity, Location, Status]
    );
    res.status(201).json({ success: true, Table_ID: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/reservations', async (req, res) => {
  try {
    const reservations = await db.query(`
      SELECT 
        r.Reservation_ID,
        r.Res_Date,
        r.Res_Time,
        r.No_of_People,
        r.Status,
        c.Customer_ID,
        c.Customer_Name,
        c.Phone AS Customer_Phone,
        t.Table_ID,
        t.Table_Number,
        t.Location AS Table_Location
      FROM reservation r
      LEFT JOIN customers c ON r.Customer_ID = c.Customer_ID
      LEFT JOIN \`table\` t ON r.Table_ID = t.Table_ID
      ORDER BY r.Res_Date DESC, r.Res_Time DESC
    `);
    res.json({ success: true, data: reservations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/reservations', async (req, res) => {
  let { Customer_ID, Customer_Name, Customer_Phone, Table_ID, Res_Date, Res_Time, No_of_People = 2, Status = 'Confirmed' } = req.body;
  try {
    // If Customer_Name provided without ID, lookup or create customer record
    if (!Customer_ID && Customer_Name) {
      const existingCust = await db.query('SELECT Customer_ID FROM customers WHERE Phone = ? LIMIT 1', [Customer_Phone || '']);
      if (existingCust && existingCust.length > 0) {
        Customer_ID = existingCust[0].Customer_ID;
      } else {
        const newCust = await db.query(
          'INSERT INTO customers (Customer_Name, Phone, Email, Address, Loyalty_Points) VALUES (?, ?, ?, ?, 10)',
          [Customer_Name, Customer_Phone || '9876543210', `${Customer_Name.toLowerCase().replace(/\\s+/g, '')}@guest.com`, 'Online Reservation', 10]
        );
        Customer_ID = newCust.insertId;
      }
    }

    // Auto-select best available table if Table_ID not explicitly specified
    if (!Table_ID) {
      const avail = await db.query(
        'SELECT Table_ID FROM `table` WHERE Status = "Available" AND Capacity >= ? ORDER BY Capacity ASC LIMIT 1',
        [No_of_People]
      );
      if (avail && avail.length > 0) {
        Table_ID = avail[0].Table_ID;
      } else {
        // Fallback to table 1
        Table_ID = 1;
      }
    }

    // Inserting reservation fires trg_sync_table_reservation to update table status!
    const result = await db.query(
      `INSERT INTO reservation (Customer_ID, Table_ID, Res_Date, Res_Time, No_of_People, Status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [Customer_ID || 1, Table_ID, Res_Date, Res_Time, No_of_People, Status]
    );
    res.status(201).json({ success: true, message: 'Reservation confirmed and table synced', Reservation_ID: result.insertId, Table_ID });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Customer live order tracker lookup by Order ID or Customer Phone
app.get('/api/orders/track/:query', async (req, res) => {
  const q = req.params.query;
  try {
    let rows;
    if (!isNaN(q)) {
      // Order ID or Phone number
      rows = await db.query(`
        SELECT 
          o.Order_ID, o.Order_Date, o.Status, o.Total_Amount, o.Order_Type,
          c.Customer_Name, c.Phone AS Customer_Phone,
          b.Bill_ID, b.Tax_Amount, b.Total_Amount AS Bill_Total,
          p.Payment_Method, p.Payment_Status
        FROM \`order\` o
        LEFT JOIN customers c ON o.Customer_ID = c.Customer_ID
        LEFT JOIN bill b ON o.Order_ID = b.Order_ID
        LEFT JOIN payment p ON b.Bill_ID = p.Bill_ID
        WHERE o.Order_ID = ? OR c.Phone = ?
        ORDER BY o.Order_Date DESC
        LIMIT 5
      `, [q, q]);
    } else {
      rows = await db.query(`
        SELECT 
          o.Order_ID, o.Order_Date, o.Status, o.Total_Amount, o.Order_Type,
          c.Customer_Name, c.Phone AS Customer_Phone,
          b.Bill_ID, b.Tax_Amount, b.Total_Amount AS Bill_Total,
          p.Payment_Method, p.Payment_Status
        FROM \`order\` o
        LEFT JOIN customers c ON o.Customer_ID = c.Customer_ID
        LEFT JOIN bill b ON o.Order_ID = b.Order_ID
        LEFT JOIN payment p ON b.Bill_ID = p.Bill_ID
        WHERE c.Customer_Name LIKE ?
        ORDER BY o.Order_Date DESC
        LIMIT 5
      `, [`%${q}%`]);
    }
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// 6. INVENTORY & STOCK TRACKER
// ================================================================
app.get('/api/inventory', async (req, res) => {
  try {
    const inventory = await db.query(`
      SELECT 
        i.Inventory_ID,
        i.Item_ID,
        m.Item_Name,
        m.Category,
        m.Price,
        i.Quantity_Stock,
        i.Unit,
        i.Reorder_Level,
        i.Last_Updated,
        CASE 
          WHEN i.Quantity_Stock = 0 THEN 'Out of Stock'
          WHEN i.Quantity_Stock <= i.Reorder_Level THEN 'Low Stock'
          ELSE 'In Stock'
        END AS Stock_Status
      FROM inventory i
      JOIN menu_items m ON i.Item_ID = m.Item_ID
      ORDER BY (i.Quantity_Stock <= i.Reorder_Level) DESC, i.Quantity_Stock ASC
    `);
    res.json({ success: true, data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/inventory/restock', async (req, res) => {
  const { Item_ID, Add_Quantity } = req.body;
  if (!Item_ID || !Add_Quantity || Number(Add_Quantity) <= 0) {
    return res.status(400).json({ success: false, message: 'Valid Item_ID and Add_Quantity required' });
  }

  try {
    await db.query(
      `UPDATE inventory 
       SET Quantity_Stock = Quantity_Stock + ?, Last_Updated = NOW() 
       WHERE Item_ID = ?`,
      [Number(Add_Quantity), Item_ID]
    );
    res.json({ success: true, message: `Restocked ${Add_Quantity} units successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// 7. CUSTOMERS & STAFF DIRECTORIES
// ================================================================
app.get('/api/customers', async (req, res) => {
  try {
    const customers = await db.query(`
      SELECT 
        c.Customer_ID,
        c.Customer_Name,
        c.Phone,
        c.Email,
        c.Address,
        c.Join_Date,
        COUNT(DISTINCT o.Order_ID) AS Total_Orders,
        COALESCE(SUM(b.Total_Amount), 0) AS Total_Spend
      FROM customers c
      LEFT JOIN \`order\` o ON c.Customer_ID = o.Customer_ID
      LEFT JOIN bill b ON o.Order_ID = b.Order_ID
      GROUP BY c.Customer_ID, c.Customer_Name, c.Phone, c.Email, c.Address, c.Join_Date
      ORDER BY Total_Spend DESC, c.Customer_ID ASC
    `);
    res.json({ success: true, data: customers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.post('/api/customers', async (req, res) => {
  const { Customer_Name, Phone, Email, Address } = req.body;
  if (!Customer_Name) {
    return res.status(400).json({ success: false, message: 'Customer_Name is required' });
  }

  try {
    const [result] = await db.query(
      `INSERT INTO customers (Customer_Name, Phone, Email, Address, Join_Date)
       VALUES (?, ?, ?, ?, CURDATE())`,
      [Customer_Name, Phone, Email, Address]
    );
    res.status(201).json({ success: true, Customer_ID: result.insertId });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/api/staff', async (req, res) => {
  try {
    const staff = await db.query(`
      SELECT 
        s.Staff_ID,
        s.Staff_Name,
        s.Role,
        s.Phone,
        s.Email,
        s.Join_Date,
        COUNT(o.Order_ID) AS Orders_Handled,
        COALESCE(SUM(b.Total_Amount), 0) AS Sales_Volume
      FROM staff s
      LEFT JOIN \`order\` o ON s.Staff_ID = o.Staff_ID
      LEFT JOIN bill b ON o.Order_ID = b.Order_ID
      GROUP BY s.Staff_ID, s.Staff_Name, s.Role, s.Phone, s.Email, s.Join_Date
      ORDER BY Orders_Handled DESC, s.Staff_ID ASC
    `);
    res.json({ success: true, data: staff });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// 7.5 USER AUTHENTICATION & ACCESS CONTROL (LOGIN & REGISTRATION)
// ================================================================

/**
 * Route: POST /api/auth/register
 * Layman Explanation:
 * When someone fills out the "Create Account" registration form on the website,
 * the frontend sends their username, full name, email, password, and role here.
 * 
 * Flow of this function:
 * 1. Read input data from req.body (what the user typed in HTML form).
 * 2. Validate: check if username, full name, email, and password were all supplied.
 * 3. Check MySQL: ensure nobody else has already registered with this username or email.
 * 4. INSERT into MySQL `users` table.
 *    *NOTE: The MySQL database trigger (trg_users_after_insert_log) automatically*
 *    *fires and creates an audit record in `user_activity_logs`!*
 * 5. Return success response to frontend with user details (excluding password).
 */
app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, fullName, email, password, role } = req.body;

    // Layman check: Did the user forget to fill any required box?
    if (!username || !fullName || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please fill in all required fields (Username, Full Name, Email, Password).'
      });
    }

    // Basic password check: password must be at least 4 characters
    if (password.trim().length < 4) {
      return res.status(400).json({
        success: false,
        message: 'Password is too short. Please choose a password with at least 4 characters.'
      });
    }

    // Layman check: Check if username or email is already taken in the database
    const existingUsers = await db.query(
      'SELECT User_ID, Username, Email FROM users WHERE LOWER(Username) = LOWER(?) OR LOWER(Email) = LOWER(?)',
      [username.trim(), email.trim()]
    );

    if (existingUsers.length > 0) {
      const match = existingUsers[0];
      const isUsernameDuplicate = match.Username.toLowerCase() === username.trim().toLowerCase();
      return res.status(409).json({
        success: false,
        message: isUsernameDuplicate
          ? `The username "${username}" is already taken. Please pick another one.`
          : `An account with email "${email}" is already registered. Please sign in instead.`
      });
    }

    // Insert user into MySQL database.
    // Notice: Triggers 'trg_users_before_insert' and 'trg_users_after_insert_log'
    // will automatically run in MySQL to clean inputs and write to the audit log!
    const result = await db.query(
      `INSERT INTO users (Username, Full_Name, Email, Password, Role)
       VALUES (?, ?, ?, ?, ?)`,
      [username.trim(), fullName.trim(), email.trim().toLowerCase(), password, role || 'Staff']
    );

    // Fetch newly created user info without password
    const [newUser] = await db.query(
      `SELECT User_ID, Username, Full_Name, Email, Role, Created_At FROM users WHERE User_ID = ?`,
      [result.insertId]
    );

    res.status(201).json({
      success: true,
      message: `Account registered successfully! Welcome to Velvet & Bean, ${newUser.Full_Name}.`,
      user: newUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while registering user: ' + error.message
    });
  }
});

/**
 * Route: POST /api/auth/login
 * Layman Explanation:
 * When a user enters their username/email and password on the Login form,
 * the frontend sends the credentials here.
 * 
 * Flow of this function:
 * 1. Find the user in MySQL by either username OR email.
 * 2. If no user found, tell the user in plain language.
 * 3. Compare passwords. If incorrect, reject with friendly message.
 * 4. If credentials match, update `Last_Login = NOW()` in MySQL.
 *    *NOTE: The MySQL database trigger (trg_users_after_update_log) automatically*
 *    *fires and logs this login event into `user_activity_logs`!*
 * 5. Return success and user profile details to the frontend.
 */
app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please enter both your Username/Email and Password.'
      });
    }

    // Search user by Username OR Email
    const users = await db.query(
      `SELECT User_ID, Username, Full_Name, Email, Password, Role, Created_At, Last_Login
       FROM users
       WHERE LOWER(Username) = LOWER(?) OR LOWER(Email) = LOWER(?)
       LIMIT 1`,
      [username.trim(), username.trim()]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'No account found with this username or email. Please check your spelling or register.'
      });
    }

    const user = users[0];

    // Password verification
    if (user.Password !== password) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect password. Please try again.'
      });
    }

    // Update Last_Login in database.
    // This will trigger 'trg_users_after_update_log' in MySQL automatically!
    await db.query(
      `UPDATE users SET Last_Login = NOW() WHERE User_ID = ?`,
      [user.User_ID]
    );

    // Create safe user object (remove sensitive password before sending over network)
    const safeUser = {
      userId: user.User_ID,
      username: user.Username,
      fullName: user.Full_Name,
      email: user.Email,
      role: user.Role,
      createdAt: user.Created_At,
      lastLogin: new Date().toISOString()
    };

    res.json({
      success: true,
      message: `Signed in successfully. Welcome back, ${user.Full_Name}!`,
      user: safeUser
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error while signing in: ' + error.message
    });
  }
});

/**
 * Route: GET /api/auth/users
 * Layman Explanation:
 * Provides a list of all registered accounts (without passwords)
 * so staff/admins can see who has an account in the cafe management system.
 */
app.get('/api/auth/users', async (req, res) => {
  try {
    const users = await db.query(`
      SELECT 
        User_ID,
        Username,
        Full_Name,
        Email,
        Role,
        Created_At,
        Last_Login
      FROM users
      ORDER BY User_ID ASC
    `);
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

/**
 * Route: GET /api/auth/logs
 * Layman Explanation:
 * Returns the latest 30 rows from the 'user_activity_logs' database table.
 * This directly demonstrates the automatic MySQL Triggers in real time to the teacher or examiner!
 */
app.get('/api/auth/logs', async (req, res) => {
  try {
    const logs = await db.query(`
      SELECT 
        Log_ID,
        User_ID,
        Username,
        Action_Type,
        Action_Details,
        Log_Time
      FROM user_activity_logs
      ORDER BY Log_ID DESC
      LIMIT 30
    `);
    res.json({ success: true, data: logs });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ================================================================
// 8. SQL DEMO LAB (FACULTY & VIVA PRESENTATION)
// ================================================================
const DEMO_QUERIES = [
  {
    id: 'top_customers',
    title: '1. Top 5 Highest Spending Customers',
    concept: 'Multi-table JOIN (customers, order, bill), SUM aggregation, ORDER BY',
    sql: `SELECT 
    c.Customer_ID,
    c.Customer_Name,
    c.Phone,
    COUNT(DISTINCT o.Order_ID) AS Total_Orders_Placed,
    COALESCE(SUM(b.Total_Amount), 0) AS Total_Amount_Spent_INR
FROM customers c
JOIN \`order\` o ON c.Customer_ID = o.Customer_ID
JOIN bill b ON o.Order_ID = b.Order_ID
GROUP BY c.Customer_ID, c.Customer_Name, c.Phone
ORDER BY Total_Amount_Spent_INR DESC
LIMIT 5;`
  },
  {
    id: 'bestselling_items',
    title: '2. Bestselling Menu Items by Units & Revenue',
    concept: 'Relational grouping, SUM aggregations, multi-column sorting',
    sql: `SELECT 
    m.Item_ID,
    m.Item_Name,
    m.Category,
    m.Price,
    COALESCE(SUM(oi.Quantity), 0) AS Units_Sold,
    COALESCE(SUM(oi.SubTotal), 0) AS Total_Revenue_Generated
FROM menu_items m
LEFT JOIN order_item oi ON m.Item_ID = oi.Item_ID
GROUP BY m.Item_ID, m.Item_Name, m.Category, m.Price
ORDER BY Units_Sold DESC, Total_Revenue_Generated DESC;`
  },
  {
    id: 'low_stock_shortage',
    title: '3. Low-Stock Inventory Alerts & Shortages',
    concept: 'Calculated expressions, WHERE threshold condition, JOIN inventory + menu',
    sql: `SELECT 
    i.Inventory_ID,
    m.Item_Name,
    m.Category,
    i.Quantity_Stock,
    i.Unit,
    i.Reorder_Level,
    (i.Reorder_Level - i.Quantity_Stock) AS Shortage_Quantity,
    i.Last_Updated
FROM inventory i
JOIN menu_items m ON i.Item_ID = m.Item_ID
WHERE i.Quantity_Stock <= i.Reorder_Level
ORDER BY Shortage_Quantity DESC;`
  },
  {
    id: 'staff_productivity',
    title: '4. Staff Productivity & Sales Volume Handled',
    concept: 'Employee performance analytics, multiple LEFT JOINs, COUNT and SUM',
    sql: `SELECT 
    s.Staff_ID,
    s.Staff_Name,
    s.Role,
    COUNT(o.Order_ID) AS Orders_Served,
    COALESCE(SUM(b.Total_Amount), 0) AS Total_Sales_Processed
FROM staff s
LEFT JOIN \`order\` o ON s.Staff_ID = o.Staff_ID
LEFT JOIN bill b ON o.Order_ID = b.Order_ID
GROUP BY s.Staff_ID, s.Staff_Name, s.Role
ORDER BY Orders_Served DESC;`
  },
  {
    id: 'financial_summary',
    title: '5. Financial Revenue Breakdown (Net, 5% GST, Gross)',
    concept: 'Financial audit report, tax compliance calculation, AVG ticket size',
    sql: `SELECT 
    COUNT(b.Bill_ID) AS Total_Bills_Issued,
    SUM(b.Sub_Total) AS Net_Sales_Revenue,
    SUM(b.Tax_Amount) AS Total_GST_Collected_5_Percent,
    SUM(b.Total_Amount) AS Gross_Revenue_INR,
    ROUND(AVG(b.Total_Amount), 2) AS Average_Ticket_Size
FROM bill b;`
  },
  {
    id: 'payment_methods',
    title: '6. Payment Method Breakdown & Settlements',
    concept: 'Financial transaction categorization, payment gateway verification',
    sql: `SELECT 
    p.Payment_Method,
    COUNT(p.Payment_ID) AS Transaction_Count,
    SUM(p.Amount_Paid) AS Total_Settled_Amount,
    p.Payment_Status
FROM payment p
GROUP BY p.Payment_Method, p.Payment_Status
ORDER BY Total_Settled_Amount DESC;`
  },
  {
    id: 'table_utilization',
    title: '7. Dining Floor Plan & Table Utilization',
    concept: 'Conditional CASE WHEN aggregations inside SUM, location grouping',
    sql: `SELECT 
    t.Location,
    COUNT(t.Table_ID) AS Total_Tables,
    SUM(t.Capacity) AS Total_Seating_Capacity,
    SUM(CASE WHEN t.Status = 'Available' THEN 1 ELSE 0 END) AS Available_Tables,
    SUM(CASE WHEN t.Status = 'Occupied' THEN 1 ELSE 0 END) AS Occupied_Tables,
    SUM(CASE WHEN t.Status = 'Reserved' THEN 1 ELSE 0 END) AS Reserved_Tables
FROM \`table\` t
GROUP BY t.Location;`
  },
  {
    id: 'receipt_drilldown',
    title: '8. Complete Order Receipt Drill-Down (5-Table JOIN)',
    concept: 'Enterprise 5-Table relational drill-down: order, customer, staff, items, bill, payment',
    sql: `SELECT 
    o.Order_ID,
    o.Order_Date,
    o.Order_Type,
    c.Customer_Name,
    s.Staff_Name AS Server_Name,
    m.Item_Name,
    oi.Quantity,
    oi.Unit_Price,
    oi.SubTotal AS Line_Item_Subtotal,
    b.Total_Amount AS Bill_Grand_Total,
    p.Payment_Method,
    p.Transaction_ref
FROM \`order\` o
JOIN customers c ON o.Customer_ID = c.Customer_ID
JOIN staff s ON o.Staff_ID = s.Staff_ID
JOIN order_item oi ON o.Order_ID = oi.Order_ID
JOIN menu_items m ON oi.Item_ID = m.Item_ID
JOIN bill b ON o.Order_ID = b.Order_ID
JOIN payment p ON b.Bill_ID = p.Bill_ID
ORDER BY o.Order_ID DESC, oi.Order_Item_ID ASC
LIMIT 15;`
  },
  {
    id: 'user_accounts_security',
    title: '9. User Accounts & Access Control Directory',
    concept: 'Authentication schema, role-based classification, account creation timestamps',
    sql: `SELECT 
    User_ID,
    Username,
    Full_Name,
    Email,
    Role,
    Created_At,
    COALESCE(Last_Login, 'Never Logged In') AS Last_Login_Status
FROM users
ORDER BY User_ID ASC;`
  },
  {
    id: 'database_trigger_audit_trail',
    title: '10. Live Database Trigger Audit Trail (user_activity_logs)',
    concept: 'Autonomous database triggers (AFTER INSERT & AFTER UPDATE on users), automated compliance logging',
    sql: `SELECT 
    l.Log_ID,
    l.User_ID,
    l.Username,
    l.Action_Type,
    l.Action_Details,
    l.Log_Time
FROM user_activity_logs l
ORDER BY l.Log_ID DESC
LIMIT 20;`
  }
];

app.get('/api/demo-queries', (req, res) => {
  res.json({ success: true, data: DEMO_QUERIES });
});

app.post('/api/demo-queries/run', async (req, res) => {
  const { queryId, customSql } = req.body;
  let sqlToRun = '';

  if (queryId) {
    const found = DEMO_QUERIES.find(q => q.id === queryId);
    if (!found) return res.status(404).json({ success: false, message: 'Preset query not found' });
    sqlToRun = found.sql;
  } else if (customSql) {
    // Only allow SELECT statements for safety
    if (!/^\s*SELECT/i.test(customSql.trim())) {
      return res.status(403).json({ success: false, message: 'Only SELECT queries can be executed in the Demo Lab' });
    }
    sqlToRun = customSql;
  } else {
    return res.status(400).json({ success: false, message: 'Either queryId or customSql is required' });
  }

  const startTime = Date.now();
  try {
    const rows = await db.query(sqlToRun);
    const durationMs = Date.now() - startTime;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    res.json({
      success: true,
      sql: sqlToRun,
      durationMs,
      rowCount: rows.length,
      columns,
      data: rows
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      sql: sqlToRun,
      message: error.message
    });
  }
});

// Fallback to SPA Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Start HTTP Server
app.listen(PORT, () => {
  console.log('================================================================');
  console.log('☕ CAFÉ MANAGEMENT SYSTEM — BACKEND API SERVER RUNNING');
  console.log(`📡 Local URL:   http://localhost:${PORT}`);
  console.log(`📊 API Health:  http://localhost:${PORT}/api/health`);
  console.log('================================================================');
});
