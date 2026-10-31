-- ================================================================
-- ☕ Velvet & Bean Café Management System
-- Database Schema, Triggers, Views & Seed Data (MySQL 8.0)
-- 3NF Relational Architecture
-- ================================================================

CREATE DATABASE IF NOT EXISTS cafe_management;
USE cafe_management;

-- ----------------------------------------------------------------
-- 1. DROP EXISTING OBJECTS (CLEAN SLATE)
-- ----------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_calc_orderitem_subtotal;
DROP TRIGGER IF EXISTS trg_recalc_orderitem_subtotal;
DROP TRIGGER IF EXISTS trg_update_order_total_insert;
DROP TRIGGER IF EXISTS trg_update_order_total_delete;
DROP TRIGGER IF EXISTS trg_deduct_inventory_stock;
DROP TRIGGER IF EXISTS trg_sync_table_reservation;
DROP TRIGGER IF EXISTS trg_generate_payment_txn;
-- Drops for User Authentication & Audit Triggers
DROP TRIGGER IF EXISTS trg_users_before_insert;
DROP TRIGGER IF EXISTS trg_users_after_insert_log;
DROP TRIGGER IF EXISTS trg_users_after_update_log;

DROP VIEW IF EXISTS v_low_stock;
DROP VIEW IF EXISTS v_bestselling_items;
DROP VIEW IF EXISTS v_order_details;
DROP VIEW IF EXISTS v_active_menu;

DROP TABLE IF EXISTS payment;
DROP TABLE IF EXISTS bill;
DROP TABLE IF EXISTS order_item;
DROP TABLE IF EXISTS `order`;
DROP TABLE IF EXISTS reservation;
DROP TABLE IF EXISTS inventory;
DROP TABLE IF EXISTS menu_items;
DROP TABLE IF EXISTS `table`;
DROP TABLE IF EXISTS staff;
DROP TABLE IF EXISTS customers;
-- Drops for User Authentication & Activity Tables
DROP TABLE IF EXISTS user_activity_logs;
DROP TABLE IF EXISTS users;

-- ----------------------------------------------------------------
-- ----------------------------------------------------------------
-- 2. CREATE ENTITY TABLES (3NF RELATIONAL ARCHITECTURE)
-- ----------------------------------------------------------------

-- ================================================================
-- Table 1: CUSTOMERS
-- Layman Explanation:
-- Stores café patrons and guests for CRM and loyalty tracking.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Customer_ID):
--   The unique identity number (1, 2, 3...) for each customer. No two customers
--   can share the same Customer_ID, and it cannot be blank (NOT NULL).
-- • ENGINE=InnoDB:
--   The storage engine powering this table. InnoDB guarantees ACID compliance
--   (Atomicity, Consistency, Isolation, Durability), supports row-level locking
--   so multiple customers can place orders simultaneously without delay, and provides
--   automatic crash recovery if power fails.
-- • DEFAULT CHARSET=utf8mb4:
--   Multi-byte UTF-8 encoding supporting all international languages, Indian regional
--   scripts, and modern emojis (☕, 🥐, 🎉) without data corruption.
-- • COLLATE=utf8mb4_unicode_ci:
--   Collation determines string comparison and sorting rules. The '_ci' stands for
--   Case-Insensitive (e.g. searching 'Ravi' matches 'ravi' or 'RAVI').
-- ================================================================
CREATE TABLE customers (
  Customer_ID INT NOT NULL AUTO_INCREMENT,
  Customer_Name VARCHAR(150) NOT NULL,
  Phone VARCHAR(20) DEFAULT NULL,
  Email VARCHAR(100) DEFAULT NULL,
  Address VARCHAR(255) DEFAULT NULL,
  Join_Date DATE DEFAULT NULL,
  PRIMARY KEY (Customer_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 2: STAFF
-- Layman Explanation:
-- Stores employees (Baristas, Waiters, Chefs, Managers, Cashiers).
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Staff_ID): Unique employee identification badge number.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Ensures employee records are ACID transaction safe and Unicode friendly.
-- ================================================================
CREATE TABLE staff (
  Staff_ID INT NOT NULL AUTO_INCREMENT,
  Staff_Name VARCHAR(150) NOT NULL,
  Role VARCHAR(50) DEFAULT NULL,
  Phone VARCHAR(15) DEFAULT NULL,
  Email VARCHAR(100) DEFAULT NULL,
  Join_Date DATE DEFAULT NULL,
  PRIMARY KEY (Staff_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 3: TABLE
-- Layman Explanation:
-- Stores the physical dining tables and seating capacity across café floor zones.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Table_ID): Unique identifier for each dining table.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Enforces reliable state updates when tables switch between 'Available' and 'Occupied'.
-- ================================================================
CREATE TABLE `table` (
  Table_ID INT NOT NULL AUTO_INCREMENT,
  Table_Number INT NOT NULL,
  Capacity INT DEFAULT NULL,
  Location VARCHAR(100) DEFAULT NULL,
  Status VARCHAR(30) DEFAULT 'Available',
  PRIMARY KEY (Table_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 4: MENU_ITEMS
-- Layman Explanation:
-- Stores all delicious food and drink offerings with categories, prices,
-- appetizing descriptions, and high-resolution photo paths.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Item_ID): Unique product code for each dish or beverage.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Provides fast index reads and transactional integrity for menu management.
-- ================================================================
CREATE TABLE menu_items (
  Item_ID INT NOT NULL AUTO_INCREMENT,
  Item_Name VARCHAR(150) NOT NULL,
  Category VARCHAR(100) DEFAULT NULL,
  Price DECIMAL(12,2) DEFAULT NULL,
  Image_URL VARCHAR(255) DEFAULT '/images/coffees/cappuccino.jpg',
  Description VARCHAR(255) DEFAULT '',
  Is_Active TINYINT(1) DEFAULT 1,
  PRIMARY KEY (Item_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 5: INVENTORY
-- Layman Explanation:
-- Kitchen stock tracker for ingredients and portions.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Inventory_ID): Unique inventory item tracking row.
-- • KEY (Item_ID) [Secondary Index]:
--   Builds a high-speed lookup index on Item_ID so the kitchen can instantly find stock.
-- • EXTERNAL / FOREIGN KEY (Item_ID) REFERENCES menu_items(Item_ID):
--   Connects this stock record to the corresponding dish in the menu.
--   'ON DELETE SET NULL': If a menu item is discontinued, the stock record is preserved
--   with Item_ID set to NULL rather than deleting kitchen historical audit logs.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Supports atomic stock decrements and prevents race conditions during busy order rushes.
-- ================================================================
CREATE TABLE inventory (
  Inventory_ID INT NOT NULL AUTO_INCREMENT,
  Item_ID INT DEFAULT NULL,
  Quantity_Stock DECIMAL(10,2) DEFAULT 0.00,
  Unit VARCHAR(30) DEFAULT 'units',
  Reorder_Level DECIMAL(10,2) DEFAULT 10.00,
  Last_Updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (Inventory_ID),
  KEY (Item_ID),
  CONSTRAINT inventory_ibfk_1 FOREIGN KEY (Item_ID) REFERENCES menu_items (Item_ID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 6: ORDER
-- Layman Explanation:
-- The central transaction entity. Stores each customer's visit and order header.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Order_ID): Unique order invoice number.
-- • KEY (Customer_ID) & KEY (Staff_ID) [Secondary Indexes]:
--   Accelerates queries searching for "all orders placed by Customer X" or "handled by Server Y".
-- • TWO EXTERNAL / FOREIGN KEYS:
--   1. Customer_ID (references customers table):
--      Connects the order to the registered customer who ordered. If customer is deleted,
--      ON DELETE SET NULL preserves the order for financial revenue accounting.
--   2. Staff_ID (references staff table):
--      Connects the order to the employee (waiter/barista) who served the table,
--      allowing calculation of staff productivity and commission.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Ensures ACID safety: order totals and line items remain perfectly balanced.
-- ================================================================
CREATE TABLE `order` (
  Order_ID INT NOT NULL AUTO_INCREMENT,
  Order_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
  Status VARCHAR(30) DEFAULT 'Completed',
  Total_Amount DECIMAL(10,2) DEFAULT 0.00,
  Order_Type VARCHAR(50) DEFAULT 'Dine-In',
  Customer_ID INT DEFAULT NULL,
  Staff_ID INT DEFAULT NULL,
  PRIMARY KEY (Order_ID),
  KEY (Customer_ID),
  KEY (Staff_ID),
  CONSTRAINT order_ibfk_1 FOREIGN KEY (Customer_ID) REFERENCES customers (Customer_ID) ON DELETE SET NULL,
  CONSTRAINT order_ibfk_2 FOREIGN KEY (Staff_ID) REFERENCES staff (Staff_ID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 7: ORDER_ITEM
-- Layman Explanation:
-- Stores individual line items inside an order (e.g., 2 Cappuccinos, 1 Panini).
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Order_Item_ID): Unique row key for this specific line item.
-- • KEY (Order_ID) & KEY (Item_ID) [Secondary Indexes]:
--   Enables lightning-fast calculations of order subtotals and bestseller reports.
-- • TWO EXTERNAL / FOREIGN KEYS:
--   1. Order_ID (references order table):
--      Ties this item to its parent order. 'ON DELETE CASCADE' means if an order is cancelled
--      or deleted, all its individual line items are automatically cleaned up!
--   2. Item_ID (references menu_items table):
--      Identifies which exact food dish or coffee was ordered.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Guarantees that database triggers (which calculate SubTotal and deduct inventory)
--   run in an atomic, crash-proof transaction.
-- ================================================================
CREATE TABLE order_item (
  Order_Item_ID INT NOT NULL AUTO_INCREMENT,
  Order_ID INT DEFAULT NULL,
  Item_ID INT DEFAULT NULL,
  Quantity INT DEFAULT 1,
  Unit_Price DECIMAL(10,2) DEFAULT NULL,
  SubTotal DECIMAL(10,2) DEFAULT NULL,
  PRIMARY KEY (Order_Item_ID),
  KEY (Order_ID),
  KEY (Item_ID),
  CONSTRAINT order_item_ibfk_1 FOREIGN KEY (Order_ID) REFERENCES `order` (Order_ID) ON DELETE CASCADE,
  CONSTRAINT order_item_ibfk_2 FOREIGN KEY (Item_ID) REFERENCES menu_items (Item_ID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 8: BILL
-- Layman Explanation:
-- Official tax invoice containing net subtotal, 5% GST tax, and grand total.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Bill_ID): Official invoice receipt number.
-- • KEY (Order_ID) [Secondary Index]: Fast lookup to find the bill for any order.
-- • EXTERNAL / FOREIGN KEY (Order_ID) REFERENCES `order`(Order_ID):
--   Ties the financial invoice to the specific food order.
--   'ON DELETE CASCADE': Automatically deletes the bill if the order is removed.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Guarantees tax compliance and immutable audit logging.
-- ================================================================
CREATE TABLE bill (
  Bill_ID INT NOT NULL AUTO_INCREMENT,
  Order_ID INT DEFAULT NULL,
  Bill_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
  Sub_Total DECIMAL(10,2) DEFAULT 0.00,
  Tax_Amount DECIMAL(10,2) DEFAULT 0.00,
  Total_Amount DECIMAL(10,2) DEFAULT 0.00,
  PRIMARY KEY (Bill_ID),
  KEY (Order_ID),
  CONSTRAINT bill_ibfk_1 FOREIGN KEY (Order_ID) REFERENCES `order` (Order_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 9: PAYMENT
-- Layman Explanation:
-- Records payment settlement (Cash, UPI, Credit Card) and tracking reference codes.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Payment_ID): Unique transaction reference ID in the café ledger.
-- • KEY (Bill_ID) [Secondary Index]: Fast lookup for payment verification against a bill.
-- • EXTERNAL / FOREIGN KEY (Bill_ID) REFERENCES bill(Bill_ID):
--   Ties payment to the corresponding bill invoice.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   ACID safety guarantees no double-spending or corrupted transactions.
-- ================================================================
CREATE TABLE payment (
  Payment_ID INT NOT NULL AUTO_INCREMENT,
  Bill_ID INT DEFAULT NULL,
  Payment_Date DATETIME DEFAULT CURRENT_TIMESTAMP,
  Amount_Paid DECIMAL(10,2) DEFAULT NULL,
  Payment_Method VARCHAR(50) DEFAULT 'Cash',
  Payment_Status VARCHAR(30) DEFAULT 'Completed',
  Transaction_ref VARCHAR(100) DEFAULT NULL,
  PRIMARY KEY (Payment_ID),
  KEY (Bill_ID),
  CONSTRAINT payment_ibfk_1 FOREIGN KEY (Bill_ID) REFERENCES bill (Bill_ID) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 10: RESERVATION
-- Layman Explanation:
-- Dining table reservation book for customer bookings.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Reservation_ID): Unique booking reservation number.
-- • KEY (Customer_ID) & KEY (Table_ID) [Secondary Indexes]:
--   Enables quick filtering by guest name or specific table schedule.
-- • TWO EXTERNAL / FOREIGN KEYS:
--   1. Customer_ID (references customers table): Connects booking to the customer.
--   2. Table_ID (references table table): Connects booking to the reserved table.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Allows database triggers to seamlessly lock and mark tables as 'Reserved'.
-- ================================================================
CREATE TABLE reservation (
  Reservation_ID INT NOT NULL AUTO_INCREMENT,
  Customer_ID INT DEFAULT NULL,
  Table_ID INT DEFAULT NULL,
  Res_Date DATE DEFAULT NULL,
  Res_Time TIME DEFAULT NULL,
  No_of_People INT DEFAULT 2,
  Status VARCHAR(30) DEFAULT 'Confirmed',
  PRIMARY KEY (Reservation_ID),
  KEY (Customer_ID),
  KEY (Table_ID),
  CONSTRAINT reservation_ibfk_1 FOREIGN KEY (Customer_ID) REFERENCES customers (Customer_ID) ON DELETE SET NULL,
  CONSTRAINT reservation_ibfk_2 FOREIGN KEY (Table_ID) REFERENCES `table` (Table_ID) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 11: USERS (Authentication & Role Management)
-- Layman Explanation:
-- Stores credentials and permission roles for user authentication.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (User_ID): Unique user identity number.
-- • UNIQUE KEY (Username) & UNIQUE KEY (Email):
--   Guarantees no two users can ever register with the same username or email address.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Guarantees secure credential persistence and case-insensitive username comparison.
-- ================================================================
CREATE TABLE users (
  User_ID INT NOT NULL AUTO_INCREMENT,
  Username VARCHAR(50) NOT NULL UNIQUE,
  Full_Name VARCHAR(150) NOT NULL,
  Email VARCHAR(100) NOT NULL UNIQUE,
  Password VARCHAR(255) NOT NULL,
  Role VARCHAR(30) DEFAULT 'Staff',
  Created_At DATETIME DEFAULT CURRENT_TIMESTAMP,
  Last_Login DATETIME DEFAULT NULL,
  PRIMARY KEY (User_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ================================================================
-- Table 12: USER_ACTIVITY_LOGS (Security & Audit Trail)
-- Layman Explanation:
-- Digital security logbook where MySQL database triggers record every registration and login.
--
-- KEY CONCEPTS EXPLAINED:
-- • PRIMARY KEY (Log_ID): Unique sequential audit record number.
-- • KEY (User_ID) [External Key Reference]: Connects log entry to the user account.
-- • ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci:
--   Guarantees immutable and tamper-proof audit trails.
-- ================================================================
CREATE TABLE user_activity_logs (
  Log_ID INT NOT NULL AUTO_INCREMENT,
  User_ID INT DEFAULT NULL,
  Username VARCHAR(50) DEFAULT NULL,
  Action_Type VARCHAR(50) NOT NULL, -- e.g., 'REGISTRATION', 'LOGIN', 'LOGOUT'
  Action_Details VARCHAR(255) DEFAULT NULL, -- Friendly description of the event
  Log_Time DATETIME DEFAULT CURRENT_TIMESTAMP, -- Exact timestamp of the event
  PRIMARY KEY (Log_ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ----------------------------------------------------------------
-- 3. AUTOMATIC DATABASE TRIGGERS (ACID INTEGRITY & AUDIT AUTOMATION)
-- ----------------------------------------------------------------
DELIMITER $$

-- Trigger 1: Auto-calculate SubTotal on line item insertion
CREATE TRIGGER trg_calc_orderitem_subtotal
BEFORE INSERT ON order_item
FOR EACH ROW
BEGIN
    IF NEW.Unit_Price IS NULL OR NEW.Unit_Price = 0 THEN
        SET NEW.Unit_Price = (SELECT Price FROM menu_items WHERE Item_ID = NEW.Item_ID);
    END IF;
    SET NEW.SubTotal = NEW.Quantity * NEW.Unit_Price;
END$$

-- Trigger 2: Recalculate SubTotal on line item update
CREATE TRIGGER trg_recalc_orderitem_subtotal
BEFORE UPDATE ON order_item
FOR EACH ROW
BEGIN
    IF NEW.Unit_Price IS NULL OR NEW.Unit_Price = 0 THEN
        SET NEW.Unit_Price = (SELECT Price FROM menu_items WHERE Item_ID = NEW.Item_ID);
    END IF;
    SET NEW.SubTotal = NEW.Quantity * NEW.Unit_Price;
END$$

-- Trigger 3: Automatically sum items and update parent Order Total_Amount
CREATE TRIGGER trg_update_order_total_insert
AFTER INSERT ON order_item
FOR EACH ROW
BEGIN
    UPDATE `order`
    SET Total_Amount = (SELECT COALESCE(SUM(SubTotal), 0) FROM order_item WHERE Order_ID = NEW.Order_ID)
    WHERE Order_ID = NEW.Order_ID;
END$$

-- Trigger 4: Recalculate Order Total_Amount on line item deletion
CREATE TRIGGER trg_update_order_total_delete
AFTER DELETE ON order_item
FOR EACH ROW
BEGIN
    UPDATE `order`
    SET Total_Amount = (SELECT COALESCE(SUM(SubTotal), 0) FROM order_item WHERE Order_ID = OLD.Order_ID)
    WHERE Order_ID = OLD.Order_ID;
END$$

-- Trigger 5: Automatically deduct stock from Inventory
CREATE TRIGGER trg_deduct_inventory_stock
AFTER INSERT ON order_item
FOR EACH ROW
BEGIN
    UPDATE inventory
    SET Quantity_Stock = GREATEST(0, Quantity_Stock - NEW.Quantity),
        Last_Updated = NOW()
    WHERE Item_ID = NEW.Item_ID;
END$$

-- Trigger 6: Mark table as Reserved when reservation confirmed
CREATE TRIGGER trg_sync_table_reservation
AFTER INSERT ON reservation
FOR EACH ROW
BEGIN
    IF NEW.Status = 'Confirmed' OR NEW.Status = 'Pending' THEN
        UPDATE `table`
        SET Status = 'Reserved'
        WHERE Table_ID = NEW.Table_ID;
    END IF;
END$$

-- Trigger 7: Generate unique tracking transaction reference code
CREATE TRIGGER trg_generate_payment_txn
BEFORE INSERT ON payment
FOR EACH ROW
BEGIN
    IF NEW.Transaction_ref IS NULL OR TRIM(NEW.Transaction_ref) = '' THEN
        SET NEW.Transaction_ref = CONCAT('TXN-', UPPER(COALESCE(NEW.Payment_Method, 'PAY')), '-', FLOOR(100000 + (RAND() * 900000)));
    END IF;
END$$

-- ================================================================
-- Trigger 8: Clean & Sanitize User Inputs Before Inserting
-- Layman Explanation:
-- Think of this trigger as a helpful receptionist checking a form before filing it.
-- - If someone typed spaces around their username (like "  john  "), it trims them to "john".
-- - It turns the email into all lowercase ("John@Cafe.com" -> "john@cafe.com") so searching is easy.
-- - If no role was specified, it automatically sets the role to 'Staff' by default.
-- ================================================================
CREATE TRIGGER trg_users_before_insert
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    -- Trim extra white spaces from username
    SET NEW.Username = TRIM(NEW.Username);
    -- Convert email to lowercase so case-insensitive matching works reliably
    SET NEW.Email = LOWER(TRIM(NEW.Email));
    -- Assign default role 'Staff' if left blank
    IF NEW.Role IS NULL OR TRIM(NEW.Role) = '' THEN
        SET NEW.Role = 'Staff';
    END IF;
END$$

-- ================================================================
-- Trigger 9: Automatic Registration Audit Logger
-- Layman Explanation:
-- The moment a new person completes registration and their record enters
-- the 'users' table, MySQL automatically triggers this action.
-- It writes an entry in the 'user_activity_logs' security table saying:
-- "New user account created: [Full Name] as [Role] at [Time]".
-- No human or backend developer has to remember to write this log — the database does it on its own!
-- ================================================================
CREATE TRIGGER trg_users_after_insert_log
AFTER INSERT ON users
FOR EACH ROW
BEGIN
    INSERT INTO user_activity_logs (User_ID, Username, Action_Type, Action_Details, Log_Time)
    VALUES (NEW.User_ID, NEW.Username, 'REGISTRATION', CONCAT('New user account registered: ', NEW.Full_Name, ' (Role: ', NEW.Role, ')'), NOW());
END$$

-- ================================================================
-- Trigger 10: Automatic Login Activity Logger
-- Layman Explanation:
-- When a user logs in, the backend updates their 'Last_Login' timestamp.
-- This trigger catches that update and automatically writes an entry in 'user_activity_logs'.
-- It distinguishes whether it's their very first login ever or a returning login.
-- ================================================================
CREATE TRIGGER trg_users_after_update_log
AFTER UPDATE ON users
FOR EACH ROW
BEGIN
    -- If this is the user's first time logging in (Last_Login was previously NULL)
    IF OLD.Last_Login IS NULL AND NEW.Last_Login IS NOT NULL THEN
        INSERT INTO user_activity_logs (User_ID, Username, Action_Type, Action_Details, Log_Time)
        VALUES (NEW.User_ID, NEW.Username, 'LOGIN', 'User logged into system for the very first time', NOW());
    -- If this is a repeat login (Last_Login timestamp changed)
    ELSEIF NEW.Last_Login <> OLD.Last_Login THEN
        INSERT INTO user_activity_logs (User_ID, Username, Action_Type, Action_Details, Log_Time)
        VALUES (NEW.User_ID, NEW.Username, 'LOGIN', CONCAT('User signed in successfully at ', NOW()), NOW());
    END IF;
END$$

DELIMITER ;

-- ----------------------------------------------------------------
-- 4. ANALYTICAL DATABASE VIEWS
-- ----------------------------------------------------------------

-- ================================================================
-- 4. ANALYTICAL DATABASE VIEWS
-- Layman Explanation:
-- A VIEW is a saved virtual window or calculated query.
-- Instead of typing complex JOINs every single time, we create a VIEW
-- so frontend and backend can query it like a regular table.
-- ================================================================

-- View 1: v_active_menu (Menu Items with Live Kitchen Stock Status)
-- Layman Explanation of COALESCE:
-- COALESCE(i.Quantity_Stock, 0) acts as an "if-null safety net".
-- If a menu item has no inventory record yet (NULL), COALESCE smoothly converts
-- it to 0 so the menu doesn't show a blank void or trigger NaN calculation crashes.
CREATE OR REPLACE VIEW v_active_menu AS
SELECT 
    m.Item_ID,
    m.Item_Name,
    m.Category,
    m.Price,
    m.Is_Active,
    COALESCE(m.Image_URL, '/images/coffees/cappuccino.jpg') AS Image_URL,
    COALESCE(m.Description, 'Velvet & Bean handcrafted specialty recipe') AS Description,
    COALESCE(i.Quantity_Stock, 0) AS Stock_Quantity,
    COALESCE(i.Unit, 'Portions') AS Unit,
    COALESCE(i.Reorder_Level, 10) AS Reorder_Level,
    CASE 
        WHEN i.Quantity_Stock IS NULL OR i.Quantity_Stock = 0 THEN 'Out of Stock'
        WHEN i.Quantity_Stock <= i.Reorder_Level THEN 'Low Stock'
        ELSE 'In Stock'
    END AS Stock_Status
FROM menu_items m
LEFT JOIN inventory i ON m.Item_ID = i.Item_ID;

CREATE OR REPLACE VIEW v_order_details AS
SELECT 
    o.Order_ID,
    o.Order_Date,
    o.Order_Type,
    o.Status AS Order_Status,
    o.Total_Amount AS Order_Total,
    c.Customer_ID,
    c.Customer_Name,
    c.Phone AS Customer_Phone,
    s.Staff_ID,
    s.Staff_Name,
    s.Role AS Staff_Role,
    b.Bill_ID,
    b.Sub_Total,
    b.Tax_Amount,
    b.Total_Amount AS Bill_Total,
    p.Payment_ID,
    p.Payment_Method,
    p.Payment_Status,
    p.Transaction_ref
FROM `order` o
LEFT JOIN customers c ON o.Customer_ID = c.Customer_ID
LEFT JOIN staff s ON o.Staff_ID = s.Staff_ID
LEFT JOIN bill b ON o.Order_ID = b.Order_ID
LEFT JOIN payment p ON b.Bill_ID = p.Bill_ID;

CREATE OR REPLACE VIEW v_bestselling_items AS
SELECT 
    m.Item_ID,
    m.Item_Name,
    m.Category,
    m.Price,
    COALESCE(SUM(oi.Quantity), 0) AS Total_Quantity_Sold,
    COALESCE(SUM(oi.SubTotal), 0) AS Total_Revenue
FROM menu_items m
LEFT JOIN order_item oi ON m.Item_ID = oi.Item_ID
GROUP BY m.Item_ID, m.Item_Name, m.Category, m.Price
ORDER BY Total_Quantity_Sold DESC;

CREATE OR REPLACE VIEW v_low_stock AS
SELECT 
    i.Inventory_ID,
    m.Item_ID,
    m.Item_Name,
    m.Category,
    i.Quantity_Stock,
    i.Unit,
    i.Reorder_Level,
    i.Last_Updated
FROM inventory i
JOIN menu_items m ON i.Item_ID = m.Item_ID
WHERE i.Quantity_Stock <= i.Reorder_Level;

-- ----------------------------------------------------------------
-- 5. REALISTIC SEED DATA (ACADEMIC / FACULTY DEMONSTRATION)
-- ----------------------------------------------------------------

-- Seed Customers
INSERT INTO customers (Customer_ID, Customer_Name, Phone, Email, Address, Join_Date) VALUES
(1, 'Ravi Kumar', '9876543210', 'ravi.kumar@gmail.com', '12 MG Road, Bangalore', '2025-01-15'),
(2, 'Sneha Reddy', '9876543211', 'sneha.reddy@gmail.com', '45 Jubilee Hills, Hyderabad', '2025-02-10'),
(3, 'Arjun Nair', '9876543212', 'arjun.nair@gmail.com', '78 Marine Drive, Kochi', '2025-03-05'),
(4, 'Priya Sharma', '9876543213', 'priya.sharma@gmail.com', '23 Park Street, Kolkata', '2025-03-20'),
(5, 'Vikram Singh', '9876543214', 'vikram.singh@gmail.com', '56 Civil Lines, Delhi', '2025-04-12'),
(6, 'Anjali Mehta', '9876543215', 'anjali.mehta@gmail.com', '89 SG Highway, Ahmedabad', '2025-05-01'),
(7, 'Karthik Iyer', '9876543216', 'karthik.iyer@gmail.com', '34 Anna Salai, Chennai', '2025-05-18'),
(8, 'Divya Pillai', '9876543217', 'divya.pillai@gmail.com', '67 FC Road, Pune', '2025-06-09'),
(9, 'Rohan Das', '9876543218', 'rohan.das@gmail.com', '90 Salt Lake, Kolkata', '2025-07-02'),
(10, 'Neha Gupta', '9876543219', 'neha.gupta@gmail.com', '15 Banjara Hills, Hyderabad', '2025-07-25');

-- Seed Staff
INSERT INTO staff (Staff_ID, Staff_Name, Role, Phone, Email, Join_Date) VALUES
(1, 'Suresh Rao', 'Manager', '9123456780', 'suresh.rao@cafe.com', '2024-01-10'),
(2, 'Meena Iyer', 'Waiter', '9123456781', 'meena.iyer@cafe.com', '2024-02-15'),
(3, 'Ajay Verma', 'Chef', '9123456782', 'ajay.verma@cafe.com', '2024-03-01'),
(4, 'Pooja Nair', 'Waiter', '9123456783', 'pooja.nair@cafe.com', '2024-03-22'),
(5, 'Ramesh Babu', 'Cashier', '9123456784', 'ramesh.babu@cafe.com', '2024-04-18'),
(6, 'Kavya Menon', 'Waiter', '9123456785', 'kavya.menon@cafe.com', '2024-05-05'),
(7, 'Sanjay Patil', 'Chef', '9123456786', 'sanjay.patil@cafe.com', '2024-06-11'),
(8, 'Lakshmi Prasad', 'Manager', '9123456787', 'lakshmi.prasad@cafe.com', '2024-07-08'),
(9, 'Deepak Joshi', 'Waiter', '9123456788', 'deepak.joshi@cafe.com', '2024-08-14'),
(10, 'Nisha Kapoor', 'Cashier', '9123456789', 'nisha.kapoor@cafe.com', '2024-09-02');

-- Seed Tables
INSERT INTO `table` (Table_ID, Table_Number, Capacity, Location, Status) VALUES
(1, 1, 2, 'Indoor Cozy Corner', 'Available'),
(2, 2, 4, 'Indoor Central', 'Available'),
(3, 3, 4, 'Outdoor Garden Patio', 'Available'),
(4, 4, 2, 'Window View', 'Available'),
(5, 5, 6, 'Balcony Terrace', 'Available'),
(6, 6, 8, 'Indoor VIP Booth', 'Occupied'),
(7, 7, 4, 'Outdoor Espresso Bar', 'Available');

-- Seed Menu Items (All 5 Categories: Coffees, Pastas, Sandwiches, Cookies, Eatables)
INSERT INTO menu_items (Item_ID, Item_Name, Category, Price, Image_URL, Description, Is_Active) VALUES
(1, 'Butter Croissant', 'Eatables', 95.00, '/images/eatables/butter_croissant.jpg', 'Flaky, golden French croissant layered with European cultured butter', 1),
(2, 'Penne Arrabbiata', 'Pasta', 210.00, '/images/pasta/penne_arrabbiata.jpg', 'Artisanal penne tossed in spicy tomato sauce, fresh garlic and basil', 1),
(3, 'Creamy Alfredo Pasta', 'Pasta', 230.00, '/images/pasta/penne_arrabbiata.jpg', 'Silky fettuccine ribbons folded in rich parmesan and roasted garlic cream', 1),
(4, 'Classic Cappuccino', 'Coffees', 120.00, '/images/coffees/cappuccino.jpg', 'Full-bodied espresso crowned with silky microfoam and cocoa dusting', 1),
(5, 'Gourmet Grilled Panini', 'Sandwiches', 160.00, '/images/sandwiches/grilled_panini.jpg', 'Toasted sourdough with pesto, charred bell peppers, and melted mozzarella', 1),
(6, 'Iced Caramel Latte', 'Coffees', 130.00, '/images/coffees/iced_caramel_latte.jpg', 'Double espresso poured over cold milk and golden caramel drizzle', 1),
(7, 'Double Choco Chip Cookies', 'Cookies', 80.00, '/images/cookies/choco_chip_cookies.jpg', 'Freshly baked warm cookie packed with molten chocolate chips and sea salt', 1),
(8, 'Crispy Herb French Fries', 'Eatables', 100.00, '/images/eatables/butter_croissant.jpg', 'Golden potato fries seasoned with dried herbs and served with garlic mayo', 1),
(9, 'Toasted Garlic Focaccia', 'Eatables', 70.00, '/images/eatables/butter_croissant.jpg', 'Freshly baked focaccia bread brushed with roasted garlic and rosemary oil', 1),
(10, 'Choco Fudge Lava Brownie', 'Cookies', 110.00, '/images/cookies/choco_chip_cookies.jpg', 'Warm dark chocolate fudge cake with a rich molten chocolate center', 1);

-- Seed Inventory
INSERT INTO inventory (Inventory_ID, Item_ID, Quantity_Stock, Unit, Reorder_Level, Last_Updated) VALUES
(1, 1, 45.00, 'Portions', 15.00, NOW() - INTERVAL 2 DAY),
(2, 2, 30.00, 'Portions', 10.00, NOW() - INTERVAL 1 DAY),
(3, 3, 25.00, 'Portions', 8.00, NOW() - INTERVAL 1 DAY),
(4, 4, 85.00, 'Cups', 20.00, NOW() - INTERVAL 3 HOUR),
(5, 5, 12.00, 'Portions', 15.00, NOW() - INTERVAL 5 HOUR),
(6, 6, 60.00, 'Glasses', 15.00, NOW() - INTERVAL 4 HOUR),
(7, 7, 50.00, 'Pieces', 20.00, NOW() - INTERVAL 1 DAY),
(8, 8, 9.00, 'Portions', 12.00, NOW() - INTERVAL 2 HOUR),
(9, 9, 100.00, 'Pieces', 25.00, NOW() - INTERVAL 6 HOUR),
(10, 10, 0.00, 'Pieces', 10.00, NOW() - INTERVAL 12 HOUR);

-- Seed Past Orders
INSERT INTO `order` (Order_ID, Order_Date, Status, Total_Amount, Order_Type, Customer_ID, Staff_ID) VALUES
(1, NOW() - INTERVAL 5 DAY, 'Completed', 410.00, 'Dine-In', 1, 2),
(2, NOW() - INTERVAL 4 DAY, 'Completed', 270.00, 'Takeaway', 2, 4),
(3, NOW() - INTERVAL 3 DAY, 'Completed', 690.00, 'Dine-In', 3, 2),
(4, NOW() - INTERVAL 2 DAY, 'Completed', 240.00, 'Online Delivery', 4, 6),
(5, NOW() - INTERVAL 1 DAY, 'Completed', 490.00, 'Dine-In', 5, 4),
(6, NOW() - INTERVAL 12 HOUR, 'Completed', 330.00, 'Dine-In', 1, 2),
(7, NOW() - INTERVAL 6 HOUR, 'Completed', 150.00, 'Takeaway', 7, 6),
(8, NOW() - INTERVAL 2 HOUR, 'In-Progress', 370.00, 'Dine-In', 8, 4);

-- Seed Order Items
INSERT INTO order_item (Order_Item_ID, Order_ID, Item_ID, Quantity, Unit_Price, SubTotal) VALUES
(1, 1, 4, 2, 120.00, 240.00),
(2, 1, 8, 1, 100.00, 100.00),
(3, 1, 7, 1, 70.00, 70.00),
(4, 2, 5, 1, 150.00, 150.00),
(5, 2, 4, 1, 120.00, 120.00),
(6, 3, 2, 2, 220.00, 440.00),
(7, 3, 9, 3, 40.00, 120.00),
(8, 3, 6, 1, 130.00, 130.00),
(9, 4, 4, 2, 120.00, 240.00),
(10, 5, 3, 2, 180.00, 360.00),
(11, 5, 6, 1, 130.00, 130.00),
(12, 6, 1, 2, 90.00, 180.00),
(13, 6, 5, 1, 150.00, 150.00),
(14, 7, 5, 1, 150.00, 150.00),
(15, 8, 4, 2, 120.00, 240.00),
(16, 8, 6, 1, 130.00, 130.00);

-- Seed Bills (Net Sub_Total + 5% GST)
INSERT INTO bill (Bill_ID, Order_ID, Bill_Date, Sub_Total, Tax_Amount, Total_Amount) VALUES
(1, 1, NOW() - INTERVAL 5 DAY, 410.00, 20.50, 430.50),
(2, 2, NOW() - INTERVAL 4 DAY, 270.00, 13.50, 283.50),
(3, 3, NOW() - INTERVAL 3 DAY, 690.00, 34.50, 724.50),
(4, 4, NOW() - INTERVAL 2 DAY, 240.00, 12.00, 252.00),
(5, 5, NOW() - INTERVAL 1 DAY, 490.00, 24.50, 514.50),
(6, 6, NOW() - INTERVAL 12 HOUR, 330.00, 16.50, 346.50),
(7, 7, NOW() - INTERVAL 6 HOUR, 150.00, 7.50, 157.50),
(8, 8, NOW() - INTERVAL 2 HOUR, 370.00, 18.50, 388.50);

-- Seed Payments
INSERT INTO payment (Payment_ID, Bill_ID, Payment_Date, Amount_Paid, Payment_Method, Payment_Status, Transaction_ref) VALUES
(1, 1, NOW() - INTERVAL 5 DAY, 430.50, 'UPI', 'Completed', 'TXN-UPI-482910'),
(2, 2, NOW() - INTERVAL 4 DAY, 283.50, 'Card', 'Completed', 'TXN-CARD-883921'),
(3, 3, NOW() - INTERVAL 3 DAY, 724.50, 'Cash', 'Completed', 'TXN-CASH-194022'),
(4, 4, NOW() - INTERVAL 2 DAY, 252.00, 'UPI', 'Completed', 'TXN-UPI-339182'),
(5, 5, NOW() - INTERVAL 1 DAY, 514.50, 'Card', 'Completed', 'TXN-CARD-772183'),
(6, 6, NOW() - INTERVAL 12 HOUR, 346.50, 'UPI', 'Completed', 'TXN-UPI-625109'),
(7, 7, NOW() - INTERVAL 6 HOUR, 157.50, 'Cash', 'Completed', 'TXN-CASH-402914'),
(8, 8, NOW() - INTERVAL 2 HOUR, 388.50, 'UPI', 'Pending', 'TXN-UPI-991823');

-- Seed Reservations
INSERT INTO reservation (Reservation_ID, Customer_ID, Table_ID, Res_Date, Res_Time, No_of_People, Status) VALUES
(1, 2, 3, CURDATE() + INTERVAL 1 DAY, '19:00:00', 4, 'Confirmed'),
(2, 4, 1, CURDATE(), '20:30:00', 2, 'Confirmed'),
(3, 6, 5, CURDATE() + INTERVAL 2 DAY, '13:00:00', 6, 'Pending'),
(4, 9, 2, CURDATE() - INTERVAL 1 DAY, '18:00:00', 4, 'Completed');

-- ================================================================
-- 6. SEED DEFAULT USERS (Authentication Accounts)
-- Layman Explanation:
-- These pre-seeded accounts allow the system evaluator or teacher to log in
-- immediately without needing to manually register an account first.
-- Notice: When these rows are inserted, Trigger 9 will automatically
-- create audit log records in 'user_activity_logs'!
-- ================================================================
INSERT INTO users (User_ID, Username, Full_Name, Email, Password, Role, Created_At) VALUES
(1, 'admin', 'System Administrator', 'admin@velvetbean.com', 'admin123', 'Admin', NOW() - INTERVAL 10 DAY),
(2, 'barista', 'Aryan Sharma', 'aryan.barista@velvetbean.com', 'coffee123', 'Staff', NOW() - INTERVAL 7 DAY),
(3, 'manager', 'Pooja Verma', 'pooja.manager@velvetbean.com', 'manager123', 'Manager', NOW() - INTERVAL 5 DAY);

