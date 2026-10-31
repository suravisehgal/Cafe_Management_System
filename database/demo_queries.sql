-- ================================================================
-- ☕ Velvet & Bean Café Management System
-- Faculty & Viva Demonstration Queries
-- ================================================================
USE cafe_management;

-- ----------------------------------------------------------------
-- Query 1: Top Spending Customers (JOIN + AGGREGATION)
-- Evaluates: Multi-table JOIN (customers, order, bill), SUM aggregation, ORDER BY
--
-- LAYMAN EXPLANATION OF KEY FUNCTIONS USED HERE:
-- • COALESCE(SUM(b.Total_Amount), 0):
--   Think of COALESCE like an "if-null safety net". If a customer has never made
--   a purchase yet, SUM() would return NULL (empty void), which causes math errors.
--   COALESCE checks the first value; if it is NULL, it substitutes the fallback '0'.
-- • LIMIT 5:
--   Tells MySQL: "Only fetch the top 5 records and stop searching". This prevents
--   loading thousands of unnecessary rows into memory, making queries lightning fast.
-- ----------------------------------------------------------------
SELECT 
    c.Customer_ID,
    c.Customer_Name,
    c.Phone,
    COUNT(DISTINCT o.Order_ID) AS Total_Orders_Placed,
    COALESCE(SUM(b.Total_Amount), 0) AS Total_Amount_Spent_INR
FROM customers c
JOIN `order` o ON c.Customer_ID = o.Customer_ID
JOIN bill b ON o.Order_ID = b.Order_ID
GROUP BY c.Customer_ID, c.Customer_Name, c.Phone
ORDER BY Total_Amount_Spent_INR DESC
LIMIT 5;

-- ----------------------------------------------------------------
-- Query 2: Bestselling Menu Items by Volume & Revenue
-- Evaluates: Analytical view querying or JOIN menu_items + order_item
-- ----------------------------------------------------------------
SELECT 
    m.Item_ID,
    m.Item_Name,
    m.Category,
    m.Price,
    COALESCE(SUM(oi.Quantity), 0) AS Units_Sold,
    COALESCE(SUM(oi.SubTotal), 0) AS Total_Revenue_Generated
FROM menu_items m
LEFT JOIN order_item oi ON m.Item_ID = oi.Item_ID
GROUP BY m.Item_ID, m.Item_Name, m.Category, m.Price
ORDER BY Units_Sold DESC, Total_Revenue_Generated DESC;

-- ----------------------------------------------------------------
-- Query 3: Low-Stock Inventory Alerts (Reorder Thresholds)
-- Evaluates: Filter condition against computed or linked threshold
-- ----------------------------------------------------------------
SELECT 
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
ORDER BY Shortage_Quantity DESC;

-- ----------------------------------------------------------------
-- Query 4: Staff Productivity (Orders Handled & Total Revenue)
-- Evaluates: Staff role filtering, COUNT, and SUM
-- ----------------------------------------------------------------
SELECT 
    s.Staff_ID,
    s.Staff_Name,
    s.Role,
    COUNT(o.Order_ID) AS Orders_Served,
    COALESCE(SUM(b.Total_Amount), 0) AS Total_Sales_Processed
FROM staff s
LEFT JOIN `order` o ON s.Staff_ID = o.Staff_ID
LEFT JOIN bill b ON o.Order_ID = b.Order_ID
GROUP BY s.Staff_ID, s.Staff_Name, s.Role
ORDER BY Orders_Served DESC;

-- ----------------------------------------------------------------
-- Query 5: Financial Summary — Net Subtotal, 5% GST, and Gross Total
-- Evaluates: Financial aggregations and tax accounting
-- ----------------------------------------------------------------
SELECT 
    COUNT(b.Bill_ID) AS Total_Bills_Issued,
    SUM(b.Sub_Total) AS Net_Sales_Revenue,
    SUM(b.Tax_Amount) AS Total_GST_Collected_5_Percent,
    SUM(b.Total_Amount) AS Gross_Revenue_INR,
    ROUND(AVG(b.Total_Amount), 2) AS Average_Ticket_Size
FROM bill b;

-- ----------------------------------------------------------------
-- Query 6: Payment Method Breakdown & Settlement Status
-- Evaluates: Categorical grouping and transaction validation
-- ----------------------------------------------------------------
SELECT 
    p.Payment_Method,
    COUNT(p.Payment_ID) AS Transaction_Count,
    SUM(p.Amount_Paid) AS Total_Settled_Amount,
    p.Payment_Status
FROM payment p
GROUP BY p.Payment_Method, p.Payment_Status
ORDER BY Total_Settled_Amount DESC;

-- ----------------------------------------------------------------
-- Query 7: Dining Table Utilization & Real-time Status
-- Evaluates: Real-time floor status, capacity aggregation
-- ----------------------------------------------------------------
SELECT 
    t.Location,
    COUNT(t.Table_ID) AS Total_Tables,
    SUM(t.Capacity) AS Total_Seating_Capacity,
    SUM(CASE WHEN t.Status = 'Available' THEN 1 ELSE 0 END) AS Available_Tables,
    SUM(CASE WHEN t.Status = 'Occupied' THEN 1 ELSE 0 END) AS Occupied_Tables,
    SUM(CASE WHEN t.Status = 'Reserved' THEN 1 ELSE 0 END) AS Reserved_Tables
FROM `table` t
GROUP BY t.Location;

-- ----------------------------------------------------------------
-- Query 8: Complete Order Receipt Drill-Down (Multi-Join)
-- Evaluates: Complex 5-table relational drill-down
-- ----------------------------------------------------------------
SELECT 
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
FROM `order` o
JOIN customers c ON o.Customer_ID = c.Customer_ID
JOIN staff s ON o.Staff_ID = s.Staff_ID
JOIN order_item oi ON o.Order_ID = oi.Order_ID
JOIN menu_items m ON oi.Item_ID = m.Item_ID
JOIN bill b ON o.Order_ID = b.Order_ID
JOIN payment p ON b.Bill_ID = p.Bill_ID
ORDER BY o.Order_ID DESC, oi.Order_Item_ID ASC
LIMIT 15;

-- ----------------------------------------------------------------
-- Query 9: User Accounts Directory & Role Authorization
-- Evaluates: Authentication credentials, roles, and last login tracking
-- Layman Explanation:
-- Shows all registered accounts in the cafe system and their last login status.
-- ----------------------------------------------------------------
SELECT 
    User_ID,
    Username,
    Full_Name,
    Email,
    Role,
    Created_At,
    COALESCE(Last_Login, 'Never Logged In') AS Last_Login_Status
FROM users
ORDER BY User_ID ASC;

-- ----------------------------------------------------------------
-- Query 10: Automatic Database Trigger Audit Trail (user_activity_logs)
-- Evaluates: Automated MySQL database triggers (AFTER INSERT & AFTER UPDATE)
-- Layman Explanation:
-- Displays the audit entries created automatically by MySQL database triggers
-- whenever someone registers an account or signs in.
-- ----------------------------------------------------------------
SELECT 
    l.Log_ID,
    l.User_ID,
    l.Username,
    l.Action_Type,
    l.Action_Details,
    l.Log_Time
FROM user_activity_logs l
ORDER BY l.Log_ID DESC
LIMIT 20;

