// ================================================================
// ☕ Velvet & Bean Café Management System — Frontend JavaScript
// Interactive UI Controller, POS Cart Engine, & REST API Client
// ================================================================

// Global Application State
const state = {
  currentPortal: 'customer', // 'customer' (default public storefront) or 'management' (back-office)
  customerTab: 'menu',       // 'menu', 'reservation', 'track', 'about'
  customerCategory: 'all',   // 'all', 'coffees', 'pasta', 'sandwiches', 'cookies', 'eatables'
  customerSearch: '',
  customerCart: [],          // Array of { item: menuItem, quantity: number }
  customerOrderType: 'Dine-In',
  activeTab: 'dashboard',
  menuItems: [],
  cart: [], // Array of { item: menuItem, quantity: number } for POS
  customers: [],
  staff: [],
  tables: [],
  demoQueries: [],
  currentDemoQuery: null,
  currentUser: JSON.parse(localStorage.getItem('cafe_user') || 'null'), // Stored logged in user session
  authUsers: [], // Registered user accounts
  authLogs: [] // Live MySQL trigger audit logs
};

// API Base URL
const API_BASE = '/api';

// ================================================================
// 1. INITIALIZATION & ROUTING
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initCustomerEvents(); // Initialize customer storefront interactive controls
  initModals();
  initForms();
  initPosEvents();
  initSqlLabEvents();
  initAuthEvents(); // Initialize login/registration event triggers

  // Load Initial Data
  checkSystemHealth();
  updateAuthUI(); // Render logged-in user or guest button in header
  loadDashboardData();
  loadMenuData();
  loadCustomersData();
  loadStaffData();
  loadTablesData();
  loadDemoQueries();
  loadAuthUsers(); // Load registered users directory
  loadAuthLogs(); // Load MySQL trigger audit logs

  // Set default reservation date to today
  const resDateInput = document.getElementById('res-date');
  if (resDateInput) {
    resDateInput.value = new Date().toISOString().split('T')[0];
  }
  const custResDateInput = document.getElementById('cust-res-date');
  if (custResDateInput) {
    const today = new Date().toISOString().split('T')[0];
    custResDateInput.value = today;
    custResDateInput.min = today;
  }
});

// Tab Navigation
function initNavigation() {
  const navItems = document.querySelectorAll('.nav-item[data-tab]');
  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tab = item.getAttribute('data-tab');
      switchTab(tab);
    });
  });

  // Quick Action Buttons in Management Header
  document.getElementById('btn-quick-new-order')?.addEventListener('click', () => switchTab('pos'));
  document.getElementById('btn-quick-sql')?.addEventListener('click', () => switchTab('sql'));

  // Switch between Customer Storefront and Staff / Management Portal
  document.getElementById('btn-switch-to-management')?.addEventListener('click', () => switchPortal('management'));
  document.getElementById('btn-foot-management')?.addEventListener('click', () => switchPortal('management'));
  document.getElementById('btn-back-to-customer')?.addEventListener('click', () => switchPortal('customer'));
  document.getElementById('nav-item-customer-portal')?.addEventListener('click', () => switchPortal('customer'));
}

function switchTab(tabId) {
  state.activeTab = tabId;

  // Update Sidebar active state
  document.querySelectorAll('.nav-item[data-tab]').forEach(el => {
    el.classList.toggle('active', el.getAttribute('data-tab') === tabId);
  });

  // Update Page Viewport
  document.querySelectorAll('.view-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${tabId}`);
  });

  // Update Header Title
  const titles = {
    dashboard: 'Executive Dashboard',
    pos: 'Point of Sale (POS) Register',
    orders: 'Customer Orders & Financial Bills',
    menu: 'Artisanal Menu Catalog',
    tables: 'Dining Floor Plan & Reservations',
    inventory: 'Kitchen Inventory & Reorder Tracker',
    customers: 'Customer Directory & Spend History',
    staff: 'Café Staff & Service Team',
    auth: 'User Authentication & Access Control',
    sql: 'Faculty DBMS Demonstration Lab'
  };
  document.getElementById('header-page-title').textContent = titles[tabId] || 'Café Management System';

  // Lazy refresh data when switching tabs
  if (tabId === 'dashboard') loadDashboardData();
  if (tabId === 'pos') renderPosCatalog();
  if (tabId === 'orders') loadOrdersData();
  if (tabId === 'menu') loadMenuData();
  if (tabId === 'tables') { loadTablesData(); loadReservationsData(); }
  if (tabId === 'inventory') loadInventoryData();
  if (tabId === 'customers') loadCustomersData();
  if (tabId === 'staff') loadStaffData();
  if (tabId === 'auth') { loadAuthUsers(); loadAuthLogs(); }
  if (tabId === 'sql') loadDemoQueries();
}

// ================================================================
// 2. SYSTEM HEALTH CHECK
// ================================================================
async function checkSystemHealth() {
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');

    if (data.database && data.database.connected) {
      dot.style.background = 'var(--status-available)';
      dot.style.boxShadow = '0 0 10px var(--status-available)';
      text.textContent = 'MySQL: Online (3NF)';
    } else {
      dot.style.background = 'var(--status-occupied)';
      dot.style.boxShadow = '0 0 10px var(--status-occupied)';
      text.textContent = 'MySQL: Disconnected';
    }
  } catch (err) {
    const dot = document.getElementById('db-status-dot');
    const text = document.getElementById('db-status-text');
    dot.style.background = 'var(--status-occupied)';
    text.textContent = 'Backend Offline';
  }
}

// ================================================================
// 3. DASHBOARD METRICS
// ================================================================
async function loadDashboardData() {
  try {
    const res = await fetch(`${API_BASE}/dashboard/stats`);
    const json = await res.json();
    if (!json.success) return;

    const { financials, orders, inventory, tables, bestsellers, recentOrders } = json.data;

    // Update KPIs
    document.getElementById('kpi-revenue').textContent = `₹${financials.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    document.getElementById('kpi-tax-sub').textContent = `Net: ₹${financials.netSales.toFixed(0)} • GST: ₹${financials.totalTax.toFixed(0)}`;
    document.getElementById('kpi-orders').textContent = orders.totalOrders;
    document.getElementById('kpi-active-orders').textContent = orders.activeOrders;
    document.getElementById('kpi-low-stock').textContent = inventory.lowStockCount;
    document.getElementById('kpi-table-avail').textContent = `${tables.available} / ${tables.totalTables}`;

    // Update Low Stock badge on sidebar
    const lowStockCounter = document.getElementById('nav-lowstock-count');
    if (inventory.lowStockCount > 0) {
      lowStockCounter.textContent = inventory.lowStockCount;
      lowStockCounter.style.display = 'inline-block';
    } else {
      lowStockCounter.style.display = 'none';
    }

    // Render Bestsellers List
    const bestsellersContainer = document.getElementById('dashboard-bestsellers-list');
    if (bestsellers.length === 0) {
      bestsellersContainer.innerHTML = '<div style="color: var(--cream-dim); text-align: center; padding: 20px;">No sales logged yet.</div>';
    } else {
      bestsellersContainer.innerHTML = bestsellers.map((item, idx) => `
        <div class="bestseller-item">
          <div class="bestseller-rank">#${idx + 1}</div>
          <div class="bestseller-details">
            <div class="bestseller-name">${escapeHtml(item.Item_Name)}</div>
            <div class="bestseller-meta">${escapeHtml(item.Category)} • ₹${Number(item.Price).toFixed(2)}</div>
          </div>
          <div class="bestseller-sales">
            <div class="bestseller-revenue">₹${Number(item.Total_Revenue).toFixed(2)}</div>
            <div class="bestseller-units">${item.Total_Quantity_Sold} units sold</div>
          </div>
        </div>
      `).join('');
    }

    // Render Recent Orders Table
    const recentOrdersContainer = document.getElementById('dashboard-recent-orders');
    if (recentOrders.length === 0) {
      recentOrdersContainer.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--cream-dim);">No orders found.</td></tr>';
    } else {
      recentOrdersContainer.innerHTML = recentOrders.map(o => `
        <tr>
          <td><strong style="color: var(--coffee-accent);">#${o.Order_ID}</strong></td>
          <td>${escapeHtml(o.Customer_Name || 'Walk-In Guest')}</td>
          <td><span class="badge badge-coffee">${escapeHtml(o.Order_Type)}</span></td>
          <td><strong>₹${Number(o.Total_Amount).toFixed(2)}</strong></td>
          <td>
            <span class="badge ${o.Status === 'Completed' ? 'badge-completed' : 'badge-in-progress'}">
              ${escapeHtml(o.Status)}
            </span>
          </td>
          <td>
            <button class="quick-btn quick-btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="viewOrderReceipt(${o.Order_ID})">
              Receipt
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading dashboard:', err);
  }
}

// ================================================================
// 4. POINT OF SALE (POS) SYSTEM
// ================================================================
function initPosEvents() {
  // Category tabs click
  const catTabs = document.querySelectorAll('#pos-category-tabs .cat-tab');
  catTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      catTabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      renderPosCatalog();
    });
  });

  // Search input
  document.getElementById('pos-search-input')?.addEventListener('input', () => {
    renderPosCatalog();
  });

  // Order type change (toggle dining table selector)
  document.getElementById('cart-order-type')?.addEventListener('change', (e) => {
    const tableGroup = document.getElementById('cart-table-group');
    if (e.target.value === 'Dine-In') {
      tableGroup.style.display = 'block';
    } else {
      tableGroup.style.display = 'none';
    }
  });

  // Place order checkout button
  document.getElementById('btn-place-order')?.addEventListener('click', handlePlaceOrder);
}

async function loadMenuData() {
  try {
    const res = await fetch(`${API_BASE}/menu`);
    const json = await res.json();
    if (json.success) {
      state.menuItems = json.data;
      renderPosCatalog();
      renderMenuCatalogTable();
      renderCustomerMenu(); // Render rich visual customer menu cards
    }
  } catch (err) {
    console.error('Error loading menu:', err);
  }
}

function renderPosCatalog() {
  const grid = document.getElementById('pos-menu-grid');
  if (!grid) return;

  const activeCat = document.querySelector('#pos-category-tabs .cat-tab.active')?.getAttribute('data-category') || 'ALL';
  const searchTerm = (document.getElementById('pos-search-input')?.value || '').toLowerCase().trim();

  const filtered = state.menuItems.filter(item => {
    // Only show active items in POS
    if (!item.Is_Active) return false;
    // Category match
    const catMatch = (activeCat === 'ALL' || item.Category === activeCat);
    // Search match
    const searchMatch = !searchTerm || item.Item_Name.toLowerCase().includes(searchTerm) || item.Category.toLowerCase().includes(searchTerm);
    return catMatch && searchMatch;
  });

  if (filtered.length === 0) {
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--cream-dim); padding: 40px;">No matching menu items found.</div>';
    return;
  }

  grid.innerHTML = filtered.map(item => {
    const isOutOfStock = item.Stock_Status === 'Out of Stock' || item.Stock_Quantity <= 0;
    const isLowStock = item.Stock_Status === 'Low Stock';
    const badgeClass = isOutOfStock ? 'badge-out-of-stock' : (isLowStock ? 'badge-low-stock' : 'badge-in-stock');

    return `
      <div class="pos-item-card ${isOutOfStock ? 'out-of-stock' : ''}" onclick="addToCart(${item.Item_ID})">
        <div>
          <div class="pos-item-header">
            <span class="pos-item-category">${escapeHtml(item.Category)}</span>
            <span class="badge ${badgeClass}">${escapeHtml(item.Stock_Status)}</span>
          </div>
          <div class="pos-item-title">${escapeHtml(item.Item_Name)}</div>
          <div class="pos-item-stock-tag">${item.Stock_Quantity} ${escapeHtml(item.Unit || 'portions')} available</div>
        </div>
        <div class="pos-item-footer">
          <span class="pos-item-price">₹${Number(item.Price).toFixed(2)}</span>
          <button class="pos-add-btn" title="Add to Order">+</button>
        </div>
      </div>
    `;
  }).join('');
}

// Cart Management
function addToCart(itemId) {
  const item = state.menuItems.find(m => m.Item_ID === itemId);
  if (!item) return;

  if (item.Stock_Quantity <= 0) {
    showToast(`⚠️ ${item.Item_Name} is out of stock!`);
    return;
  }

  const existing = state.cart.find(c => c.item.Item_ID === itemId);
  if (existing) {
    if (existing.quantity >= item.Stock_Quantity) {
      showToast(`⚠️ Cannot order more than available stock (${item.Stock_Quantity})`);
      return;
    }
    existing.quantity += 1;
  } else {
    state.cart.push({ item, quantity: 1 });
  }

  updateCartUI();
  showToast(`Added ${item.Item_Name} to cart`);
}

function updateCartQuantity(itemId, delta) {
  const index = state.cart.findIndex(c => c.item.Item_ID === itemId);
  if (index === -1) return;

  const entry = state.cart[index];
  const newQty = entry.quantity + delta;

  if (newQty <= 0) {
    state.cart.splice(index, 1);
  } else {
    if (newQty > entry.item.Stock_Quantity) {
      showToast(`⚠️ Maximum available stock is ${entry.item.Stock_Quantity}`);
      return;
    }
    entry.quantity = newQty;
  }

  updateCartUI();
}

function updateCartUI() {
  const container = document.getElementById('cart-items-container');
  const badge = document.getElementById('cart-item-badge');
  const navBadge = document.getElementById('nav-cart-count');
  const btnPlaceOrder = document.getElementById('btn-place-order');

  const totalItemsCount = state.cart.reduce((sum, c) => sum + c.quantity, 0);
  badge.textContent = `${totalItemsCount} items`;
  navBadge.textContent = totalItemsCount;

  if (state.cart.length === 0) {
    container.innerHTML = '<div class="cart-empty-message">Your order cart is empty.<br>Click menu items on the left to add!</div>';
    document.getElementById('cart-subtotal').textContent = '₹0.00';
    document.getElementById('cart-tax').textContent = '₹0.00';
    document.getElementById('cart-grand-total').textContent = '₹0.00';
    btnPlaceOrder.disabled = true;
    return;
  }

  // Calculate Net Subtotal & 5% GST
  let subtotal = 0;
  container.innerHTML = state.cart.map(entry => {
    const lineTotal = entry.item.Price * entry.quantity;
    subtotal += lineTotal;

    return `
      <div class="cart-item-row">
        <div style="flex: 1; padding-right: 8px;">
          <div class="cart-item-title">${escapeHtml(entry.item.Item_Name)}</div>
          <div class="cart-item-unit-price">₹${Number(entry.item.Price).toFixed(2)} each</div>
        </div>
        <div class="cart-qty-controls">
          <button class="qty-btn" onclick="updateCartQuantity(${entry.item.Item_ID}, -1)">-</button>
          <span class="qty-val">${entry.quantity}</span>
          <button class="qty-btn" onclick="updateCartQuantity(${entry.item.Item_ID}, 1)">+</button>
        </div>
        <div class="cart-item-subtotal">₹${lineTotal.toFixed(2)}</div>
      </div>
    `;
  }).join('');

  const tax = Math.round(subtotal * 0.05 * 100) / 100;
  const grandTotal = subtotal + tax;

  document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('cart-tax').textContent = `₹${tax.toFixed(2)}`;
  document.getElementById('cart-grand-total').textContent = `₹${grandTotal.toFixed(2)}`;
  btnPlaceOrder.disabled = false;
}

// Submit Order (ACID Transaction)
async function handlePlaceOrder() {
  if (state.cart.length === 0) return;

  const btn = document.getElementById('btn-place-order');
  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span><span>Processing ACID Transaction...</span>';

  const customerId = document.getElementById('cart-customer-select').value;
  const staffId = document.getElementById('cart-staff-select').value;
  const orderType = document.getElementById('cart-order-type').value;
  const tableId = orderType === 'Dine-In' ? document.getElementById('cart-table-select').value : null;
  const paymentMethod = document.getElementById('cart-payment-method').value;

  const orderPayload = {
    Customer_ID: customerId ? parseInt(customerId) : null,
    Staff_ID: staffId ? parseInt(staffId) : null,
    Order_Type: orderType,
    Table_ID: tableId ? parseInt(tableId) : null,
    Payment_Method: paymentMethod,
    items: state.cart.map(c => ({
      Item_ID: c.item.Item_ID,
      Quantity: c.quantity
    }))
  };

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(orderPayload)
    });

    const json = await res.json();
    if (json.success) {
      showToast(`🎉 Order #${json.data.orderId} Placed & Bill Generated!`);

      // Reset cart
      state.cart = [];
      updateCartUI();

      // Refresh data
      loadDashboardData();
      loadMenuData();
      loadInventoryData();
      loadTablesData();

      // Open printable receipt modal!
      viewOrderReceipt(json.data.orderId);
    } else {
      showToast(`❌ Error placing order: ${json.message}`);
    }
  } catch (err) {
    showToast(`❌ Network error placing order: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>⚡</span><span>Place Order & Generate Bill</span>';
  }
}

// ================================================================
// 5. RECEIPT VIEWER (MODAL)
// ================================================================
async function viewOrderReceipt(orderId) {
  try {
    const res = await fetch(`${API_BASE}/orders/${orderId}`);
    const json = await res.json();
    if (!json.success) {
      showToast('❌ Order details not found');
      return;
    }

    const o = json.data;
    document.getElementById('rcpt-order-id').textContent = `#${o.Order_ID}`;
    document.getElementById('rcpt-date').textContent = new Date(o.Order_Date || Date.now()).toLocaleString('en-IN');
    document.getElementById('rcpt-customer').textContent = o.Customer_Name || 'Walk-In Guest';
    document.getElementById('rcpt-type').textContent = o.Order_Type || 'Dine-In';
    document.getElementById('rcpt-server').textContent = o.Staff_Name || 'Main Counter';
    document.getElementById('rcpt-txn').textContent = o.Transaction_ref || 'PENDING';

    const itemsBody = document.getElementById('rcpt-items-body');
    itemsBody.innerHTML = (o.items || []).map(it => `
      <tr>
        <td>${escapeHtml(it.Item_Name)}</td>
        <td style="text-align: center;">${it.Quantity}</td>
        <td style="text-align: right;">₹${Number(it.Unit_Price).toFixed(2)}</td>
        <td style="text-align: right;">₹${Number(it.SubTotal).toFixed(2)}</td>
      </tr>
    `).join('');

    const sub = Number(o.Sub_Total || o.Total_Amount || 0);
    const tax = Number(o.Tax_Amount || (sub * 0.05).toFixed(2));
    const grand = Number(o.Bill_Total || (sub + tax).toFixed(2));

    document.getElementById('rcpt-subtotal').textContent = `₹${sub.toFixed(2)}`;
    document.getElementById('rcpt-tax').textContent = `₹${tax.toFixed(2)}`;
    document.getElementById('rcpt-grand-total').textContent = `₹${grand.toFixed(2)}`;
    document.getElementById('rcpt-payment-mode').textContent = `${o.Payment_Method || 'UPI'} (${o.Payment_Status || 'Completed'})`;

    openModal('modal-receipt');
  } catch (err) {
    showToast(`❌ Error viewing receipt: ${err.message}`);
  }
}

// ================================================================
// 6. ORDERS & BILLS LIST
// ================================================================
async function loadOrdersData() {
  const search = document.getElementById('orders-search-input')?.value || '';
  const type = document.getElementById('orders-filter-type')?.value || '';

  const params = new URLSearchParams();
  if (search) params.append('search', search);
  if (type) params.append('type', type);

  try {
    const res = await fetch(`${API_BASE}/orders?${params.toString()}`);
    const json = await res.json();
    const tbody = document.getElementById('orders-table-body');

    if (!json.success || json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="12" style="text-align: center; color: var(--cream-dim);">No matching orders found.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(o => `
      <tr>
        <td><strong style="color: var(--coffee-accent);">#${o.Order_ID}</strong></td>
        <td>${new Date(o.Order_Date).toLocaleDateString('en-IN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
        <td><strong>${escapeHtml(o.Customer_Name || 'Guest')}</strong></td>
        <td>${escapeHtml(o.Staff_Name || '--')}</td>
        <td><span class="badge badge-coffee">${escapeHtml(o.Order_Type)}</span></td>
        <td>${o.Total_Items_Count || 1} items</td>
        <td>₹${Number(o.Sub_Total || o.Order_Total).toFixed(2)}</td>
        <td>₹${Number(o.Tax_Amount || 0).toFixed(2)}</td>
        <td><strong style="color: var(--crema);">₹${Number(o.Bill_Total || o.Order_Total).toFixed(2)}</strong></td>
        <td>
          <span style="font-size: 0.78rem;">${escapeHtml(o.Payment_Method || '--')}</span>
          <div style="font-size: 0.68rem; color: var(--cream-dim);">${escapeHtml(o.Transaction_ref || '')}</div>
        </td>
        <td>
          <span class="badge ${o.Order_Status === 'Completed' ? 'badge-completed' : 'badge-in-progress'}">
            ${escapeHtml(o.Order_Status)}
          </span>
        </td>
        <td>
          <button class="quick-btn quick-btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="viewOrderReceipt(${o.Order_ID})">
            Receipt
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading orders:', err);
  }
}

// ================================================================
// 7. MENU CATALOG VIEW
// ================================================================
function renderMenuCatalogTable() {
  const tbody = document.getElementById('menu-table-body');
  if (!tbody) return;

  if (state.menuItems.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--cream-dim);">No menu items found.</td></tr>';
    return;
  }

  tbody.innerHTML = state.menuItems.map(item => `
    <tr>
      <td><strong>#${item.Item_ID}</strong></td>
      <td><strong>${escapeHtml(item.Item_Name)}</strong></td>
      <td><span class="badge badge-coffee">${escapeHtml(item.Category)}</span></td>
      <td><strong>₹${Number(item.Price).toFixed(2)}</strong></td>
      <td>${item.Stock_Quantity} ${escapeHtml(item.Unit || 'portions')}</td>
      <td>
        <span class="badge ${item.Stock_Status === 'In Stock' ? 'badge-in-stock' : (item.Stock_Status === 'Low Stock' ? 'badge-low-stock' : 'badge-out-of-stock')}">
          ${escapeHtml(item.Stock_Status)}
        </span>
      </td>
      <td>
        <span class="badge ${item.Is_Active ? 'badge-available' : 'badge-occupied'}">
          ${item.Is_Active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td>
        <button class="quick-btn quick-btn-outline" style="padding: 4px 10px; font-size: 0.75rem;" onclick="toggleMenuItemActive(${item.Item_ID})">
          ${item.Is_Active ? 'Deactivate' : 'Activate'}
        </button>
      </td>
    </tr>
  `).join('');
}

async function toggleMenuItemActive(itemId) {
  try {
    const res = await fetch(`${API_BASE}/menu/${itemId}`, { method: 'DELETE' });
    const json = await res.json();
    if (json.success) {
      showToast('Menu item status updated');
      loadMenuData();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

// ================================================================
// 8. DINING TABLES & RESERVATIONS
// ================================================================
async function loadTablesData() {
  try {
    const res = await fetch(`${API_BASE}/tables`);
    const json = await res.json();
    if (!json.success) return;

    state.tables = json.data;

    // Populate Floor Plan Cards
    const grid = document.getElementById('tables-floor-grid');
    if (grid) {
      grid.innerHTML = state.tables.map(t => {
        const statusClass = `status-${t.Status.toLowerCase()}`;
        return `
          <div class="table-card ${statusClass}">
            <div>
              <div class="table-header">
                <span class="table-num">Table ${t.Table_Number}</span>
                <span class="badge badge-${t.Status.toLowerCase()}">${t.Status}</span>
              </div>
              <div class="table-location">📍 ${escapeHtml(t.Location || 'Main Hall')}</div>
              <div class="table-capacity-box">
                <span>👥 Seating: <strong>${t.Capacity} Guests</strong></span>
              </div>
            </div>
            <div class="table-actions">
              <button class="btn-table-action" onclick="setTableStatus(${t.Table_ID}, 'Available')">Available</button>
              <button class="btn-table-action" onclick="setTableStatus(${t.Table_ID}, 'Occupied')">Occupied</button>
              <button class="btn-table-action" onclick="setTableStatus(${t.Table_ID}, 'Reserved')">Reserved</button>
            </div>
          </div>
        `;
      }).join('');
    }

    // Populate dropdowns in POS cart and Bookings
    const cartSelect = document.getElementById('cart-table-select');
    if (cartSelect) {
      cartSelect.innerHTML = state.tables.map(t => `
        <option value="${t.Table_ID}">Table #${t.Table_Number} (${t.Location} • ${t.Status})</option>
      `).join('');
    }

    const resSelect = document.getElementById('res-table-select');
    if (resSelect) {
      resSelect.innerHTML = state.tables.map(t => `
        <option value="${t.Table_ID}">Table #${t.Table_Number} (${t.Capacity} seats • ${t.Location})</option>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading tables:', err);
  }
}

async function setTableStatus(tableId, status) {
  try {
    const res = await fetch(`${API_BASE}/tables/${tableId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ Status: status })
    });
    const json = await res.json();
    if (json.success) {
      showToast(`Table status set to ${status}`);
      loadTablesData();
      loadDashboardData();
    }
  } catch (err) {
    showToast(`Error: ${err.message}`);
  }
}

async function loadReservationsData() {
  try {
    const res = await fetch(`${API_BASE}/reservations`);
    const json = await res.json();
    const tbody = document.getElementById('reservations-table-body');
    if (!tbody || !json.success) return;

    if (json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--cream-dim);">No table reservations booked.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(r => `
      <tr>
        <td><strong>#RES-${r.Reservation_ID}</strong></td>
        <td><strong>${escapeHtml(r.Customer_Name || 'Guest')}</strong></td>
        <td>${escapeHtml(r.Customer_Phone || '--')}</td>
        <td><strong style="color: var(--coffee-accent);">Table #${r.Table_Number}</strong></td>
        <td>${escapeHtml(r.Table_Location || '--')}</td>
        <td>${r.Res_Date ? new Date(r.Res_Date).toLocaleDateString('en-IN') : '--'}</td>
        <td>${r.Res_Time || '--'}</td>
        <td>${r.No_of_People} Guests</td>
        <td><span class="badge badge-${(r.Status || 'confirmed').toLowerCase()}">${escapeHtml(r.Status)}</span></td>
      </tr>
    `).join('');
  } catch (err) {
    console.error('Error loading reservations:', err);
  }
}

// ================================================================
// 9. INVENTORY TRACKER
// ================================================================
async function loadInventoryData() {
  try {
    const res = await fetch(`${API_BASE}/inventory`);
    const json = await res.json();
    const tbody = document.getElementById('inventory-table-body');
    if (!tbody || !json.success) return;

    if (json.data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: var(--cream-dim);">No inventory items recorded.</td></tr>';
      return;
    }

    tbody.innerHTML = json.data.map(i => {
      const isLow = i.Quantity_Stock <= i.Reorder_Level;
      const isZero = i.Quantity_Stock <= 0;
      const shortage = isLow ? (i.Reorder_Level - i.Quantity_Stock) : 0;
      const statusClass = isZero ? 'badge-out-of-stock' : (isLow ? 'badge-low-stock' : 'badge-in-stock');

      return `
        <tr>
          <td><strong>#INV-${i.Inventory_ID}</strong></td>
          <td><strong>${escapeHtml(i.Item_Name)}</strong></td>
          <td><span class="badge badge-coffee">${escapeHtml(i.Category)}</span></td>
          <td><strong style="font-size: 1rem; color: ${isLow ? 'var(--status-occupied)' : 'var(--crema)'};">${i.Quantity_Stock}</strong> ${escapeHtml(i.Unit)}</td>
          <td>${i.Reorder_Level} ${escapeHtml(i.Unit)}</td>
          <td>${shortage > 0 ? `<span style="color: var(--status-occupied); font-weight:700;">-${shortage} ${escapeHtml(i.Unit)}</span>` : '--'}</td>
          <td><span class="badge ${statusClass}">${escapeHtml(i.Stock_Status)}</span></td>
          <td>${new Date(i.Last_Updated || Date.now()).toLocaleDateString('en-IN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}</td>
          <td>
            <button class="quick-btn quick-btn-primary" style="padding: 4px 12px; font-size: 0.75rem;" onclick="openRestockModal(${i.Item_ID}, '${escapeHtml(i.Item_Name)}')">
              Restock
            </button>
          </td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    console.error('Error loading inventory:', err);
  }
}

function openRestockModal(itemId, itemName) {
  document.getElementById('restock-item-id').value = itemId;
  document.getElementById('restock-item-name').textContent = itemName;
  document.getElementById('restock-quantity').value = 25;
  openModal('modal-restock');
}

// ================================================================
// 10. CUSTOMERS & STAFF DIRECTORIES
// ================================================================
async function loadCustomersData() {
  try {
    const res = await fetch(`${API_BASE}/customers`);
    const json = await res.json();
    if (!json.success) return;

    state.customers = json.data;

    // Populate Customers Directory Table
    const tbody = document.getElementById('customers-table-body');
    if (tbody) {
      if (state.customers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--cream-dim);">No registered customers.</td></tr>';
      } else {
        tbody.innerHTML = state.customers.map(c => `
          <tr>
            <td><strong>#CUST-${c.Customer_ID}</strong></td>
            <td><strong>${escapeHtml(c.Customer_Name)}</strong></td>
            <td>${escapeHtml(c.Phone || '--')}</td>
            <td>${escapeHtml(c.Email || '--')}</td>
            <td>${escapeHtml(c.Address || '--')}</td>
            <td>${c.Join_Date ? new Date(c.Join_Date).toLocaleDateString('en-IN') : '--'}</td>
            <td><span class="badge badge-coffee">${c.Total_Orders || 0} Orders</span></td>
            <td><strong style="color: var(--coffee-accent);">₹${Number(c.Total_Spend || 0).toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }
    }

    // Populate dropdowns in POS cart & Reservation
    const cartCustSelect = document.getElementById('cart-customer-select');
    if (cartCustSelect) {
      cartCustSelect.innerHTML = state.customers.map(c => `
        <option value="${c.Customer_ID}">${c.Customer_Name} (${c.Phone || 'Guest'})</option>
      `).join('');
    }

    const resCustSelect = document.getElementById('res-customer-select');
    if (resCustSelect) {
      resCustSelect.innerHTML = state.customers.map(c => `
        <option value="${c.Customer_ID}">${c.Customer_Name} (${c.Phone || '--'})</option>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading customers:', err);
  }
}

async function loadStaffData() {
  try {
    const res = await fetch(`${API_BASE}/staff`);
    const json = await res.json();
    if (!json.success) return;

    state.staff = json.data;

    const tbody = document.getElementById('staff-table-body');
    if (tbody) {
      if (state.staff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: var(--cream-dim);">No staff records found.</td></tr>';
      } else {
        tbody.innerHTML = state.staff.map(s => `
          <tr>
            <td><strong>#STF-${s.Staff_ID}</strong></td>
            <td><strong>${escapeHtml(s.Staff_Name)}</strong></td>
            <td><span class="badge badge-coffee">${escapeHtml(s.Role || 'Staff')}</span></td>
            <td>${escapeHtml(s.Phone || '--')}</td>
            <td>${escapeHtml(s.Email || '--')}</td>
            <td>${s.Join_Date ? new Date(s.Join_Date).toLocaleDateString('en-IN') : '--'}</td>
            <td>${s.Orders_Handled || 0} orders</td>
            <td><strong>₹${Number(s.Sales_Volume || 0).toFixed(2)}</strong></td>
          </tr>
        `).join('');
      }
    }

    // Populate POS Staff dropdown
    const cartStaffSelect = document.getElementById('cart-staff-select');
    if (cartStaffSelect) {
      cartStaffSelect.innerHTML = state.staff.map(s => `
        <option value="${s.Staff_ID}">${s.Staff_Name} (${s.Role || 'Staff'})</option>
      `).join('');
    }
  } catch (err) {
    console.error('Error loading staff:', err);
  }
}

// ================================================================
// 11. SQL DEMO LAB (FACULTY & VIVA PRESENTATION)
// ================================================================
async function loadDemoQueries() {
  try {
    const res = await fetch(`${API_BASE}/demo-queries`);
    const json = await res.json();
    if (!json.success) return;

    state.demoQueries = json.data;

    const select = document.getElementById('sql-preset-select');
    if (select) {
      select.innerHTML = state.demoQueries.map(q => `
        <option value="${q.id}">${escapeHtml(q.title)}</option>
      `).join('');

      // Select first query by default
      if (state.demoQueries.length > 0) {
        onDemoQuerySelected(state.demoQueries[0].id);
      }
    }
  } catch (err) {
    console.error('Error loading demo queries:', err);
  }
}

function initSqlLabEvents() {
  const select = document.getElementById('sql-preset-select');
  select?.addEventListener('change', (e) => {
    onDemoQuerySelected(e.target.value);
  });

  document.getElementById('btn-execute-sql')?.addEventListener('click', executeSqlLabQuery);

  document.getElementById('btn-copy-sql')?.addEventListener('click', () => {
    if (state.currentDemoQuery) {
      navigator.clipboard.writeText(state.currentDemoQuery.sql);
      showToast('📋 SQL Query copied to clipboard!');
    }
  });
}

function onDemoQuerySelected(queryId) {
  const found = state.demoQueries.find(q => q.id === queryId);
  if (!found) return;

  state.currentDemoQuery = found;
  document.getElementById('sql-concept-text').textContent = found.concept;
  document.getElementById('sql-code-display').textContent = found.sql;
}

async function executeSqlLabQuery() {
  if (!state.currentDemoQuery) return;

  const btn = document.getElementById('btn-execute-sql');
  const resultsContainer = document.getElementById('sql-results-table-container');
  const statsBadge = document.getElementById('sql-execution-stats');

  btn.disabled = true;
  btn.innerHTML = '<span>⏳</span><span>Executing Query against MySQL...</span>';
  resultsContainer.innerHTML = '<div style="text-align: center; color: var(--cream-dim); padding: 40px;">Query executing against MySQL 8.0...</div>';

  try {
    const res = await fetch(`${API_BASE}/demo-queries/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queryId: state.currentDemoQuery.id })
    });

    const json = await res.json();
    if (json.success) {
      statsBadge.style.display = 'inline-flex';
      document.getElementById('sql-timer').textContent = `${json.durationMs} ms`;
      document.getElementById('sql-row-count').textContent = json.rowCount;

      if (json.data.length === 0) {
        resultsContainer.innerHTML = '<div style="text-align: center; color: var(--cream-dim); padding: 30px;">Query executed successfully. 0 rows returned.</div>';
      } else {
        const columns = json.columns;
        const rowsHtml = json.data.map(row => `
          <tr>
            ${columns.map(col => `<td>${escapeHtml(String(row[col] !== null ? row[col] : 'NULL'))}</td>`).join('')}
          </tr>
        `).join('');

        resultsContainer.innerHTML = `
          <table class="custom-table">
            <thead>
              <tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        `;
      }
      showToast(`⚡ Query executed in ${json.durationMs}ms (${json.rowCount} rows)`);
    } else {
      resultsContainer.innerHTML = `<div style="padding: 20px; color: var(--status-occupied); background: rgba(231,111,81,0.1); border-radius: var(--radius-md);">
        <strong>SQL Error:</strong> ${escapeHtml(json.message)}
      </div>`;
    }
  } catch (err) {
    resultsContainer.innerHTML = `<div style="padding: 20px; color: var(--status-occupied);">Error: ${escapeHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>▶️</span><span>Execute Query Against MySQL</span>';
  }
}

// ================================================================
// 12. MODAL CONTROLLERS & FORM HANDLERS
// ================================================================
function initModals() {
  // Modal triggers
  document.getElementById('btn-open-add-menu-modal')?.addEventListener('click', () => openModal('modal-add-menu'));
  document.getElementById('btn-open-reservation-modal')?.addEventListener('click', () => openModal('modal-reserve'));
  document.getElementById('btn-open-add-customer-modal')?.addEventListener('click', () => openModal('modal-add-customer'));

  // Close when clicking backdrop
  document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) closeModal(backdrop.id);
    });
  });
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function initForms() {
  // Add Menu Item Form
  document.getElementById('btn-submit-add-menu')?.addEventListener('click', async () => {
    const name = document.getElementById('menu-item-name').value.trim();
    const category = document.getElementById('menu-item-category').value;
    const price = parseFloat(document.getElementById('menu-item-price').value);
    const stock = parseFloat(document.getElementById('menu-item-stock').value) || 50;
    const unit = document.getElementById('menu-item-unit').value.trim() || 'Portions';
    const reorder = parseFloat(document.getElementById('menu-item-reorder').value) || 10;

    if (!name || isNaN(price)) {
      showToast('⚠️ Please provide a valid Name and Price');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/menu`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Item_Name: name, Category: category, Price: price, Initial_Stock: stock, Unit: unit, Reorder_Level: reorder })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`🎉 "${name}" added to menu catalog!`);
        closeModal('modal-add-menu');
        document.getElementById('form-add-menu').reset();
        loadMenuData();
        loadDashboardData();
      } else {
        showToast(`Error: ${json.message}`);
      }
    } catch (err) {
      showToast(`Network Error: ${err.message}`);
    }
  });

  // Restock Inventory Form
  document.getElementById('btn-submit-restock')?.addEventListener('click', async () => {
    const itemId = document.getElementById('restock-item-id').value;
    const quantity = parseFloat(document.getElementById('restock-quantity').value);

    if (!itemId || isNaN(quantity) || quantity <= 0) {
      showToast('⚠️ Please enter a positive quantity');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/inventory/restock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Item_ID: parseInt(itemId), Add_Quantity: quantity })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`📦 Restocked ${quantity} units successfully!`);
        closeModal('modal-restock');
        loadInventoryData();
        loadMenuData();
        loadDashboardData();
      } else {
        showToast(`Error: ${json.message}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Table Reservation Form
  document.getElementById('btn-submit-reservation')?.addEventListener('click', async () => {
    const customerId = document.getElementById('res-customer-select').value;
    const tableId = document.getElementById('res-table-select').value;
    const guests = parseInt(document.getElementById('res-party-size').value) || 2;
    const resDate = document.getElementById('res-date').value;
    const resTime = document.getElementById('res-time').value;

    if (!customerId || !tableId || !resDate || !resTime) {
      showToast('⚠️ Please fill out all reservation fields');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          Customer_ID: parseInt(customerId),
          Table_ID: parseInt(tableId),
          Res_Date: resDate,
          Res_Time: resTime,
          No_of_People: guests,
          Status: 'Confirmed'
        })
      });
      const json = await res.json();
      if (json.success) {
        showToast('🎉 Table booking confirmed! Table marked as Reserved.');
        closeModal('modal-reserve');
        loadTablesData();
        loadReservationsData();
        loadDashboardData();
      } else {
        showToast(`Error: ${json.message}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Register Customer Form
  document.getElementById('btn-submit-add-customer')?.addEventListener('click', async () => {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const email = document.getElementById('cust-email').value.trim();
    const address = document.getElementById('cust-address').value.trim();

    if (!name) {
      showToast('⚠️ Customer name is required');
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ Customer_Name: name, Phone: phone, Email: email, Address: address })
      });
      const json = await res.json();
      if (json.success) {
        showToast(`🎉 Customer ${name} registered!`);
        closeModal('modal-add-customer');
        document.getElementById('form-add-customer').reset();
        loadCustomersData();
      } else {
        showToast(`Error: ${json.message}`);
      }
    } catch (err) {
      showToast(`Error: ${err.message}`);
    }
  });

  // Search in Orders View
  document.getElementById('orders-search-input')?.addEventListener('input', debounce(loadOrdersData, 300));
  document.getElementById('orders-filter-type')?.addEventListener('change', loadOrdersData);
}

// ================================================================
// 13. UTILITY HELPERS
// ================================================================
function showToast(message) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>☕</span><span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// ================================================================
// 14. USER AUTHENTICATION & ACCESS CONTROL (LOGIN, REGISTER & TRIGGERS)
// Layman Explanation:
// This section is the brain for user logins and registrations.
// It manages:
// 1. Event Triggers: Invisible watchers that react when you click a tab,
//    type a password, or submit a form.
// 2. Network Communication: Sends your username and password to the Node.js server.
// 3. MySQL Database Trigger Display: Reads the security audit log generated
//    by MySQL triggers and displays them live on screen.
// ================================================================

/**
 * Initializes all user interaction event triggers for Login and Registration.
 * Layman Metaphor:
 * Think of this function like wiring up buttons in an elevator.
 * When you press "Sign In", it shows the sign-in form.
 * When you type your password, it counts the characters and lights up a green check.
 */
function initAuthEvents() {
  // 1. Tab Switching Trigger (Sign In vs Create Account on page)
  const tabLogin = document.getElementById('auth-tab-login');
  const tabRegister = document.getElementById('auth-tab-register');
  const formLogin = document.getElementById('auth-form-login');
  const formRegister = document.getElementById('auth-form-register');
  const mainTitle = document.getElementById('auth-main-title');
  const mainSub = document.getElementById('auth-main-sub');

  tabLogin?.addEventListener('click', () => {
    tabLogin.classList.add('active');
    tabRegister?.classList.remove('active');
    formLogin?.classList.add('active');
    formRegister?.classList.remove('active');
    if (mainTitle) mainTitle.textContent = 'Café Access Control — Sign In';
    if (mainSub) mainSub.textContent = 'Enter your credentials to unlock management features.';
  });

  tabRegister?.addEventListener('click', () => {
    tabRegister.classList.add('active');
    tabLogin?.classList.remove('active');
    formRegister?.classList.add('active');
    formLogin?.classList.remove('active');
    if (mainTitle) mainTitle.textContent = 'Create New Café Staff Account';
    if (mainSub) mainSub.textContent = 'Fill in your details below to register a new user in the database.';
  });

  // 2. Tab Switching Trigger inside the global Modal Dialog
  const modalTabLogin = document.getElementById('modal-tab-login');
  const modalTabRegister = document.getElementById('modal-tab-register');
  const modalFormLogin = document.getElementById('modal-form-login');
  const modalFormRegister = document.getElementById('modal-form-register');

  modalTabLogin?.addEventListener('click', () => {
    modalTabLogin.classList.add('active');
    modalTabRegister?.classList.remove('active');
    if (modalFormLogin) modalFormLogin.style.display = 'flex';
    if (modalFormRegister) modalFormRegister.style.display = 'none';
  });

  modalTabRegister?.addEventListener('click', () => {
    modalTabRegister.classList.add('active');
    modalTabLogin?.classList.remove('active');
    if (modalFormLogin) modalFormLogin.style.display = 'none';
    if (modalFormRegister) modalFormRegister.style.display = 'flex';
  });

  // 3. Password Visibility Toggle Trigger (Show / Hide Password)
  // Layman Explanation: Changes the input type between "password" (dots) and "text" (visible letters).
  const toggleLoginPass = document.getElementById('btn-toggle-login-pass');
  const inputLoginPass = document.getElementById('login-input-pass');
  toggleLoginPass?.addEventListener('click', () => {
    if (inputLoginPass.type === 'password') {
      inputLoginPass.type = 'text';
      toggleLoginPass.textContent = '🙈 Hide';
    } else {
      inputLoginPass.type = 'password';
      toggleLoginPass.textContent = '👁️ Show';
    }
  });

  const toggleRegPass = document.getElementById('btn-toggle-reg-pass');
  const inputRegPass = document.getElementById('reg-input-pass');
  toggleRegPass?.addEventListener('click', () => {
    if (inputRegPass.type === 'password') {
      inputRegPass.type = 'text';
      toggleRegPass.textContent = '🙈 Hide';
    } else {
      inputRegPass.type = 'password';
      toggleRegPass.textContent = '👁️ Show';
    }
  });

  // 4. Quick-Fill Demo Credential Buttons (For Easy 1-Click Grading)
  document.getElementById('btn-fill-admin-creds')?.addEventListener('click', () => {
    document.getElementById('login-input-user').value = 'admin';
    document.getElementById('login-input-pass').value = 'admin123';
    showToast('Admin credentials filled (admin / admin123)');
  });

  document.getElementById('btn-fill-staff-creds')?.addEventListener('click', () => {
    document.getElementById('login-input-user').value = 'barista';
    document.getElementById('login-input-pass').value = 'coffee123';
    showToast('Staff credentials filled (barista / coffee123)');
  });

  document.getElementById('modal-btn-admin-fill')?.addEventListener('click', () => {
    document.getElementById('modal-login-user').value = 'admin';
    document.getElementById('modal-login-pass').value = 'admin123';
  });

  document.getElementById('modal-btn-staff-fill')?.addEventListener('click', () => {
    document.getElementById('modal-login-user').value = 'barista';
    document.getElementById('modal-login-pass').value = 'coffee123';
  });

  // 5. Basic Real-Time Validation Trigger (Watches keystrokes on Password input)
  // Layman Explanation: Fires automatically whenever the user presses a key in the password box.
  inputRegPass?.addEventListener('input', () => {
    const pwdDot = document.getElementById('reg-pwd-dot');
    const pwdMsg = document.getElementById('reg-pwd-msg');
    const val = inputRegPass.value.trim();

    if (val.length === 0) {
      if (pwdDot) pwdDot.style.background = 'var(--crema-muted)';
      if (pwdMsg) {
        pwdMsg.textContent = 'Password must be at least 4 characters';
        pwdMsg.style.color = 'var(--crema-muted)';
      }
    } else if (val.length < 4) {
      if (pwdDot) pwdDot.style.background = 'var(--status-occupied)';
      if (pwdMsg) {
        pwdMsg.textContent = `Too short (${val.length}/4 characters)`;
        pwdMsg.style.color = 'var(--status-occupied)';
      }
    } else {
      if (pwdDot) pwdDot.style.background = 'var(--status-available)';
      if (pwdMsg) {
        pwdMsg.textContent = '✓ Password strength: Good';
        pwdMsg.style.color = 'var(--status-available)';
      }
    }
  });

  // 6. Form Submission Triggers (Sign In Form)
  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-input-user').value.trim();
    const pass = document.getElementById('login-input-pass').value;
    await loginUser(user, pass);
  });

  modalFormLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('modal-login-user').value.trim();
    const pass = document.getElementById('modal-login-pass').value;
    await loginUser(user, pass);
    closeModal('modal-auth');
  });

  // 7. Form Submission Triggers (Registration Form)
  formRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      username: document.getElementById('reg-input-username').value.trim(),
      fullName: document.getElementById('reg-input-fullname').value.trim(),
      email: document.getElementById('reg-input-email').value.trim(),
      password: document.getElementById('reg-input-pass').value,
      role: document.getElementById('reg-input-role').value
    };
    await registerUser(formData);
  });

  modalFormRegister?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = {
      username: document.getElementById('modal-reg-user').value.trim(),
      fullName: document.getElementById('modal-reg-name').value.trim(),
      email: document.getElementById('modal-reg-email').value.trim(),
      password: document.getElementById('modal-reg-pass').value,
      role: document.getElementById('modal-reg-role').value
    };
    await registerUser(formData);
    closeModal('modal-auth');
  });

  // 8. Refresh Buttons for Trigger Logs and User Directory
  document.getElementById('btn-reload-auth-logs')?.addEventListener('click', () => {
    loadAuthLogs();
    showToast('Trigger audit logs refreshed from MySQL');
  });

  document.getElementById('btn-reload-auth-users')?.addEventListener('click', () => {
    loadAuthUsers();
    showToast('User accounts refreshed from MySQL');
  });
}

/**
 * Handles Logging in a user.
 * Layman Explanation:
 * 1. Takes username and password.
 * 2. Asks the Node.js backend to check the MySQL database.
 * 3. The backend updates Last_Login in MySQL, which causes MySQL trigger 'trg_users_after_update_log' to fire.
 * 4. We store the user's name in browser memory so they remain logged in.
 * 5. We update the screen and reload the trigger table so you can see the new login log!
 */
async function loginUser(username, password) {
  const submitBtn = document.getElementById('btn-do-login');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Verifying credentials...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Login failed. Please check your credentials.');
    }

    // Save session in state and localStorage
    state.currentUser = data.user;
    localStorage.setItem('cafe_user', JSON.stringify(data.user));

    showToast(data.message);
    updateAuthUI();
    loadAuthLogs(); // Show new trigger log immediately
    loadAuthUsers();

    // Clear password input for security
    const passInput = document.getElementById('login-input-pass');
    if (passInput) passInput.value = '';
  } catch (err) {
    showToast(`Login Error: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Sign In to System</span><span>➜</span>';
    }
  }
}

/**
 * Handles Registering a new account.
 * Layman Explanation:
 * 1. Packages the new user's username, name, email, password, and role into JSON.
 * 2. Sends it to the Node.js backend.
 * 3. Backend executes INSERT INTO users in MySQL.
 * 4. MySQL trigger 'trg_users_before_insert' automatically cleans the data.
 * 5. MySQL trigger 'trg_users_after_insert_log' automatically records the registration event in user_activity_logs.
 * 6. We log the user in automatically and refresh the tables so the new account and trigger log appear!
 */
async function registerUser(formData) {
  const submitBtn = document.getElementById('btn-do-register');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>Creating account in MySQL...</span>';
  }

  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Registration failed.');
    }

    showToast(data.message);

    // Save session in state and localStorage
    state.currentUser = data.user;
    localStorage.setItem('cafe_user', JSON.stringify(data.user));

    // Reset register form inputs
    document.getElementById('auth-form-register')?.reset();
    document.getElementById('modal-form-register')?.reset();

    updateAuthUI();
    loadAuthLogs(); // Show new trigger log immediately
    loadAuthUsers(); // Show new user in directory table
  } catch (err) {
    showToast(`Registration Error: ${err.message}`);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>Create Account (Register)</span><span>✨</span>';
    }
  }
}

/**
 * Handles signing out the current user.
 * Layman Explanation:
 * Erases the logged-in user from browser memory and returns to Guest mode.
 */
function logoutUser() {
  const userName = state.currentUser ? state.currentUser.fullName : 'User';
  state.currentUser = null;
  localStorage.removeItem('cafe_user');
  updateAuthUI();
  showToast(`Signed out successfully. Goodbye, ${userName}!`);
}

/**
 * Updates visual elements based on whether someone is logged in or browsing as Guest.
 * Layman Explanation:
 * Changes the button in the top right corner:
 * - If Guest: shows "Sign In / Register" button.
 * - If Logged In: shows a badge with your Name, Role, and a "Sign Out" button.
 */
function updateAuthUI() {
  const headerContainer = document.getElementById('header-auth-container');
  const sessionAvatar = document.getElementById('session-user-avatar');
  const sessionName = document.getElementById('session-display-name');
  const sessionRole = document.getElementById('session-display-role');
  const sessionActions = document.getElementById('session-actions-wrapper');
  const custAuthWidget = document.getElementById('cust-auth-widget');

  if (state.currentUser) {
    const u = state.currentUser;
    const initial = (u.fullName || u.username || 'U').charAt(0).toUpperCase();

    // 1. Staff Header Widget
    if (headerContainer) {
      headerContainer.innerHTML = `
        <div class="header-user-pill" title="Click to view Account / Sign Out" id="btn-header-profile">
          <div class="header-user-pill-avatar">${escapeHtml(initial)}</div>
          <span class="header-user-pill-name">${escapeHtml(u.fullName || u.username)}</span>
          <span class="header-user-pill-role">${escapeHtml(u.role || 'Staff')}</span>
        </div>
      `;
      document.getElementById('btn-header-profile')?.addEventListener('click', () => switchTab('auth'));
    }

    // 2. Customer Navbar Widget
    if (custAuthWidget) {
      custAuthWidget.innerHTML = `
        <button class="cust-auth-btn" id="btn-cust-profile" title="Logged in as ${escapeHtml(u.username)}">
          <span style="background: var(--coffee-accent); color: #120d0a; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700;">${escapeHtml(initial)}</span>
          <span>${escapeHtml(u.fullName || u.username)}</span>
        </button>
      `;
      document.getElementById('btn-cust-profile')?.addEventListener('click', () => openModal('modal-auth'));
      const nameInput = document.getElementById('cust-order-name');
      if (nameInput && !nameInput.value) nameInput.value = u.fullName || u.username;
      const resNameInput = document.getElementById('cust-res-name');
      if (resNameInput && !resNameInput.value) resNameInput.value = u.fullName || u.username;
    }

    // 3. Auth Tab Session Card
    if (sessionAvatar) sessionAvatar.textContent = initial;
    if (sessionName) sessionName.textContent = u.fullName || u.username;
    if (sessionRole) sessionRole.textContent = `Logged in as: ${u.role || 'Staff'} • Email: ${u.email || 'N/A'}`;
    if (sessionActions) {
      sessionActions.innerHTML = `<button type="button" class="quick-btn quick-btn-outline" id="btn-do-logout">🚪 Sign Out</button>`;
      document.getElementById('btn-do-logout')?.addEventListener('click', logoutUser);
    }
  } else {
    // Guest Mode
    if (headerContainer) {
      headerContainer.innerHTML = `
        <button class="quick-btn quick-btn-outline" id="btn-header-open-auth" style="border-color: var(--coffee-accent); color: var(--coffee-accent);">
          <span>🔐</span>
          <span>Sign In / Register</span>
        </button>
      `;
      document.getElementById('btn-header-open-auth')?.addEventListener('click', () => openModal('modal-auth'));
    }

    if (custAuthWidget) {
      custAuthWidget.innerHTML = `
        <button class="cust-auth-btn" id="btn-cust-login">
          <span>👤</span>
          <span>Sign In</span>
        </button>
      `;
      document.getElementById('btn-cust-login')?.addEventListener('click', () => openModal('modal-auth'));
    }

    if (sessionAvatar) sessionAvatar.textContent = '👤';
    if (sessionName) sessionName.textContent = 'Guest (Demo / Grading Mode)';
    if (sessionRole) sessionRole.textContent = 'Browsing as Guest — Full access to all modules allowed for evaluation';
    if (sessionActions) sessionActions.innerHTML = '';
  }
}

/**
 * Fetches all user records from MySQL table 'users'.
 * Layman Explanation:
 * Reads everyone who has an account in the cafe and fills the table on screen.
 */
async function loadAuthUsers() {
  const tbody = document.getElementById('auth-directory-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/auth/users`);
    const data = await res.json();

    if (!data.success || !data.data) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--cream-dim); padding: 20px;">No user accounts found.</td></tr>`;
      return;
    }

    state.authUsers = data.data;

    tbody.innerHTML = data.data.map(u => {
      const loginText = u.Last_Login ? new Date(u.Last_Login).toLocaleString() : '<span style="color: var(--cream-dim);">Never Logged In</span>';
      return `
        <tr>
          <td><strong>#${u.User_ID}</strong></td>
          <td><code>${escapeHtml(u.Username)}</code></td>
          <td><strong>${escapeHtml(u.Full_Name)}</strong></td>
          <td>${escapeHtml(u.Email)}</td>
          <td><span class="stock-badge badge-ok">${escapeHtml(u.Role || 'Staff')}</span></td>
          <td style="font-size: 0.82rem;">${loginText}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--status-occupied); padding: 20px;">Failed to load users: ${escapeHtml(err.message)}</td></tr>`;
  }
}

/**
 * Fetches the audit trail from MySQL table 'user_activity_logs'.
 * Layman Explanation:
 * This displays the proof that the MySQL Database Triggers are actively working!
 * Whenever someone registers or logs in, a row appeared here because of the trigger.
 */
async function loadAuthLogs() {
  const tbody = document.getElementById('auth-triggers-tbody');
  if (!tbody) return;

  try {
    const res = await fetch(`${API_BASE}/auth/logs`);
    const data = await res.json();

    if (!data.success || !data.data || data.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--cream-dim); padding: 20px;">No trigger audit records logged yet.</td></tr>`;
      return;
    }

    state.authLogs = data.data;

    tbody.innerHTML = data.data.map(log => {
      const isReg = log.Action_Type === 'REGISTRATION';
      const actionBadge = isReg 
        ? `<span class="stock-badge badge-ok">✨ ${escapeHtml(log.Action_Type)}</span>` 
        : `<span class="stock-badge" style="background: rgba(212, 155, 87, 0.2); color: var(--gold-caramel); border: 1px solid var(--gold-caramel);">🔑 ${escapeHtml(log.Action_Type)}</span>`;
      
      const timeStr = log.Log_Time ? new Date(log.Log_Time).toLocaleString() : 'N/A';

      return `
        <tr>
          <td><strong>#${log.Log_ID}</strong></td>
          <td><code>${escapeHtml(log.Username || 'system')}</code></td>
          <td>${actionBadge}</td>
          <td style="font-size: 0.82rem; color: var(--crema);">${escapeHtml(log.Action_Details)}</td>
          <td style="font-size: 0.78rem; color: var(--cream-dim);">${timeStr}</td>
        </tr>
      `;
    }).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--status-occupied); padding: 20px;">Failed to load trigger logs: ${escapeHtml(err.message)}</td></tr>`;
  }
}

// ================================================================
// 🌟 CUSTOMER STOREFRONT CONTROLLER (CUSTOMER POINT OF VIEW)
// ================================================================

/**
 * Layman Explanation:
 * This switches between the public Customer Storefront and the internal Staff Portal.
 * - When in 'customer' mode, guests only see the public menu, table reservations,
 *   shopping cart tray, and order tracking.
 * - When in 'management' mode, employees access the executive dashboard, POS,
 *   kitchen inventory, staff directory, and SQL demonstration lab.
 */
function switchPortal(portalName) {
  state.currentPortal = portalName;
  const custPortal = document.getElementById('customer-portal');
  const mgmtPortal = document.getElementById('management-portal');

  if (portalName === 'management') {
    if (custPortal) custPortal.style.display = 'none';
    if (mgmtPortal) mgmtPortal.style.display = 'flex';
    switchTab('dashboard');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Switched to Staff & Management Portal', 'success');
  } else {
    if (mgmtPortal) mgmtPortal.style.display = 'none';
    if (custPortal) custPortal.style.display = 'flex';
    switchCustomerTab(state.customerTab || 'menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    showToast('Switched to Customer Storefront', 'success');
  }
}

/**
 * Layman Explanation:
 * Controls the tabs on the customer storefront:
 * - 'menu': Browse food photos and add to order
 * - 'reservation': Book a table at the cafe
 * - 'track': Track live order status
 * - 'about': Read the story of the cafe
 */
function switchCustomerTab(tabName) {
  state.customerTab = tabName;

  // Update navigation button active state
  document.querySelectorAll('.cust-nav-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-cust-tab') === tabName);
  });

  // Update visible section
  document.querySelectorAll('.cust-tab-section').forEach(sec => {
    sec.classList.toggle('active', sec.id === `cust-view-${tabName}`);
  });

  if (tabName === 'menu') {
    renderCustomerMenu();
  }
}

/**
 * Initializes all event listeners for the Customer Storefront
 */
function initCustomerEvents() {
  // 1. Navigation buttons
  document.querySelectorAll('.cust-nav-btn[data-cust-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-cust-tab');
      switchCustomerTab(tab);
    });
  });

  // 2. Hero call to actions
  document.getElementById('hero-btn-menu')?.addEventListener('click', () => {
    switchCustomerTab('menu');
    document.getElementById('cust-view-menu')?.scrollIntoView({ behavior: 'smooth' });
  });

  document.getElementById('hero-btn-res')?.addEventListener('click', () => {
    switchCustomerTab('reservation');
    document.getElementById('cust-view-reservation')?.scrollIntoView({ behavior: 'smooth' });
  });

  // 3. Footer quick links
  document.getElementById('foot-link-menu')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchCustomerTab('menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('foot-link-res')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchCustomerTab('reservation');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('foot-link-track')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchCustomerTab('track');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
  document.getElementById('foot-link-about')?.addEventListener('click', (e) => {
    e.preventDefault();
    switchCustomerTab('about');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // 4. Category filter pills
  document.querySelectorAll('.cust-cat-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.cust-cat-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.customerCategory = pill.getAttribute('data-cat') || 'all';
      renderCustomerMenu();
    });
  });

  // 5. Customer search box
  document.getElementById('cust-search-input')?.addEventListener('input', (e) => {
    state.customerSearch = e.target.value.toLowerCase().trim();
    renderCustomerMenu();
  });

  // 6. Cart Drawer open & close
  document.getElementById('btn-open-cust-cart')?.addEventListener('click', openCustomerCart);
  document.getElementById('btn-close-cust-cart')?.addEventListener('click', closeCustomerCart);
  document.getElementById('cust-cart-backdrop')?.addEventListener('click', closeCustomerCart);

  // 7. Order Type toggle (Dine-In vs Takeaway)
  document.getElementById('cust-type-dinein')?.addEventListener('click', () => setCustomerOrderType('Dine-In'));
  document.getElementById('cust-type-takeaway')?.addEventListener('click', () => setCustomerOrderType('Takeaway'));

  // 8. Place order button
  document.getElementById('btn-cust-place-order')?.addEventListener('click', handlePlaceCustomerOrder);

  // 9. Reservation form submission
  document.getElementById('form-cust-reservation')?.addEventListener('submit', handleCustomerReservation);

  // 10. Order Tracking lookup
  document.getElementById('btn-cust-track-submit')?.addEventListener('click', handleTrackCustomerOrder);
  document.getElementById('cust-track-input')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleTrackCustomerOrder();
  });

  // 11. Success Modal: view order status button
  document.getElementById('btn-view-order-status')?.addEventListener('click', () => {
    closeModal('modal-cust-order-success');
    switchCustomerTab('track');
    const orderInput = document.getElementById('cust-track-input');
    if (orderInput && state.lastCustomerOrderId) {
      orderInput.value = state.lastCustomerOrderId;
      handleTrackCustomerOrder();
    }
  });
}

/**
 * Layman Explanation:
 * Displays all the delicious food and drinks on the customer screen!
 * Includes the photo, name, description, price, and "+ Add to Order" button.
 */
function renderCustomerMenu() {
  const grid = document.getElementById('cust-menu-grid');
  if (!grid) return;

  const catFilter = state.customerCategory;
  const search = state.customerSearch;

  const filtered = state.menuItems.filter(item => {
    // Only display active items to customers
    if (!item.Is_Active) return false;

    // Search filter
    if (search) {
      const nameMatch = (item.Item_Name || '').toLowerCase().includes(search);
      const descMatch = (item.Description || '').toLowerCase().includes(search);
      const catMatch = (item.Category || '').toLowerCase().includes(search);
      if (!nameMatch && !descMatch && !catMatch) return false;
    }

    // Category filter matching
    if (catFilter === 'all') return true;
    const cat = (item.Category || '').toLowerCase();
    const name = (item.Item_Name || '').toLowerCase();

    if (catFilter === 'coffees') {
      return cat.includes('coffee') || cat.includes('beverage') || name.includes('coffee') || name.includes('latte') || name.includes('cappuccino') || name.includes('macchiato') || name.includes('espresso');
    }
    if (catFilter === 'pasta') {
      return cat.includes('pasta') || name.includes('pasta') || name.includes('penne') || name.includes('alfredo') || name.includes('tagliatelle') || name.includes('biryani') || name.includes('paneer');
    }
    if (catFilter === 'sandwiches') {
      return cat.includes('sandwich') || name.includes('sandwich') || name.includes('panini') || name.includes('club') || cat.includes('snack');
    }
    if (catFilter === 'cookies') {
      return cat.includes('cookie') || cat.includes('dessert') || name.includes('cookie') || name.includes('brownie') || name.includes('jamun') || name.includes('fudge');
    }
    if (catFilter === 'eatables') {
      return cat.includes('eatable') || cat.includes('breakfast') || name.includes('croissant') || name.includes('puff') || name.includes('dosa') || name.includes('naan') || name.includes('fries');
    }

    return true;
  });

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align: center; padding: 60px 20px; color: var(--cream-dim);">
        <span style="font-size: 2.5rem; display: block; margin-bottom: 12px;">🔍</span>
        <h3 style="color: var(--crema); margin-bottom: 6px;">No Menu Items Found</h3>
        <p>Try searching for coffees, pasta, panini sandwiches, cookies, or croissants.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(item => {
    // Choose appropriate fallback image based on category
    let fallbackImg = '/images/coffees/cappuccino.jpg';
    const c = (item.Category || '').toLowerCase();
    const n = (item.Item_Name || '').toLowerCase();
    if (c.includes('pasta') || n.includes('pasta') || n.includes('penne')) fallbackImg = '/images/pasta/penne_arrabbiata.jpg';
    else if (c.includes('sandwich') || n.includes('sandwich') || n.includes('panini')) fallbackImg = '/images/sandwiches/grilled_panini.jpg';
    else if (c.includes('cookie') || n.includes('cookie') || n.includes('brownie')) fallbackImg = '/images/cookies/choco_chip_cookies.jpg';
    else if (c.includes('eatable') || c.includes('breakfast') || n.includes('croissant')) fallbackImg = '/images/eatables/butter_croissant.jpg';

    const imgSrc = item.Image_URL || fallbackImg;
    const desc = item.Description || 'Velvet & Bean handcrafted specialty recipe with premium organic ingredients.';
    const price = Number(item.Price || 0).toFixed(0);

    return `
      <div class="cust-menu-card" data-item-id="${item.Item_ID}">
        <div class="cust-card-img-wrap">
          <img src="${imgSrc}" alt="${escapeHtml(item.Item_Name)}" class="cust-card-img" onerror="this.onerror=null; this.src='${fallbackImg}';">
          <span class="cust-card-badge">${escapeHtml(item.Category || 'Specialty')}</span>
          <span class="cust-card-stock">Fresh</span>
        </div>
        <div class="cust-card-body">
          <h3 class="cust-card-title">${escapeHtml(item.Item_Name)}</h3>
          <p class="cust-card-desc">${escapeHtml(desc)}</p>
          <div class="cust-card-bottom">
            <span class="cust-card-price">₹${price}</span>
            <button class="cust-add-btn" onclick="addToCustomerCart(${item.Item_ID})">
              <span>➕</span>
              <span>Add to Order</span>
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ================================================================
// CUSTOMER SHOPPING CART & CHECKOUT ENGINE
// ================================================================

function openCustomerCart() {
  document.getElementById('cust-cart-backdrop')?.classList.add('open');
  document.getElementById('cust-cart-drawer')?.classList.add('open');
  renderCustomerCart();
}

function closeCustomerCart() {
  document.getElementById('cust-cart-backdrop')?.classList.remove('open');
  document.getElementById('cust-cart-drawer')?.classList.remove('open');
}

function setCustomerOrderType(type) {
  state.customerOrderType = type;
  document.getElementById('cust-type-dinein')?.classList.toggle('active', type === 'Dine-In');
  document.getElementById('cust-type-takeaway')?.classList.toggle('active', type === 'Takeaway');
  const tableGroup = document.getElementById('cust-table-selector-group');
  if (tableGroup) {
    tableGroup.style.display = (type === 'Dine-In') ? 'block' : 'none';
  }
}

/**
 * Layman Explanation:
 * Adds a selected coffee or food item to the customer's cart tray.
 */
function addToCustomerCart(itemId) {
  const item = state.menuItems.find(m => m.Item_ID === itemId);
  if (!item) return;

  const existing = state.customerCart.find(ci => ci.item.Item_ID === itemId);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.customerCart.push({ item, quantity: 1 });
  }

  renderCustomerCart();
  showToast(`Added ${item.Item_Name} to your order tray!`, 'success');
}

function updateCustomerCartQty(itemId, delta) {
  const idx = state.customerCart.findIndex(ci => ci.item.Item_ID === itemId);
  if (idx === -1) return;

  state.customerCart[idx].quantity += delta;
  if (state.customerCart[idx].quantity <= 0) {
    state.customerCart.splice(idx, 1);
  }
  renderCustomerCart();
}

/**
 * Layman Explanation:
 * Calculates line totals, 5% GST tax, and renders the customer's cart drawer.
 */
function renderCustomerCart() {
  const itemsContainer = document.getElementById('cust-cart-items');
  const badgeEl = document.getElementById('cust-cart-badge');
  const headerTotalEl = document.getElementById('cust-cart-header-total');
  const subtotalEl = document.getElementById('cust-bill-subtotal');
  const taxEl = document.getElementById('cust-bill-tax');
  const totalEl = document.getElementById('cust-bill-total');

  const totalCount = state.customerCart.reduce((sum, ci) => sum + ci.quantity, 0);
  const subtotal = state.customerCart.reduce((sum, ci) => sum + (Number(ci.item.Price || 0) * ci.quantity), 0);
  const tax = subtotal * 0.05;
  const grandTotal = subtotal + tax;

  if (badgeEl) badgeEl.textContent = totalCount;
  if (headerTotalEl) headerTotalEl.textContent = `₹${grandTotal.toFixed(0)}`;
  if (subtotalEl) subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
  if (taxEl) taxEl.textContent = `₹${tax.toFixed(2)}`;
  if (totalEl) totalEl.textContent = `₹${grandTotal.toFixed(2)}`;

  if (!itemsContainer) return;

  if (state.customerCart.length === 0) {
    itemsContainer.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--cream-dim);">
        <span style="font-size: 2.8rem; display: block; margin-bottom: 12px;">🛒</span>
        <h4 style="color: var(--crema); margin-bottom: 6px;">Your Order Tray is Empty</h4>
        <p style="font-size: 0.85rem;">Browse our handcrafted coffees, pasta, and baked goods to add items.</p>
      </div>
    `;
    return;
  }

  itemsContainer.innerHTML = state.customerCart.map(ci => {
    const itemTotal = (Number(ci.item.Price || 0) * ci.quantity).toFixed(2);
    const imgSrc = ci.item.Image_URL || '/images/coffees/cappuccino.jpg';

    return `
      <div class="cust-cart-item">
        <img src="${imgSrc}" class="cust-cart-item-img" alt="${escapeHtml(ci.item.Item_Name)}" onerror="this.src='/images/coffees/cappuccino.jpg';">
        <div class="cust-cart-item-info">
          <div class="cust-cart-item-title">${escapeHtml(ci.item.Item_Name)}</div>
          <div class="cust-cart-item-price">₹${Number(ci.item.Price).toFixed(0)} × ${ci.quantity} = ₹${itemTotal}</div>
        </div>
        <div class="cust-cart-item-qty">
          <button class="cust-qty-btn" onclick="updateCustomerCartQty(${ci.item.Item_ID}, -1)">−</button>
          <span style="font-weight: 700; font-size: 0.9rem; min-width: 18px; text-align: center;">${ci.quantity}</span>
          <button class="cust-qty-btn" onclick="updateCustomerCartQty(${ci.item.Item_ID}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Layman Explanation:
 * Sends the customer's completed order to the Node.js backend.
 * The backend runs an ACID transaction and fires 7 MySQL triggers to update
 * totals, deduct inventory, generate bills, and assign a tracking reference!
 */
async function handlePlaceCustomerOrder() {
  if (state.customerCart.length === 0) {
    showToast('Please add items to your cart before placing an order', 'error');
    return;
  }

  const name = document.getElementById('cust-order-name')?.value.trim();
  const phone = document.getElementById('cust-order-phone')?.value.trim();
  const paymentMethod = document.getElementById('cust-order-payment')?.value || 'UPI';
  const tableId = document.getElementById('cust-order-table')?.value || '1';

  if (!name || !phone) {
    showToast('Please enter your name and mobile number', 'error');
    return;
  }

  const payload = {
    Customer_Name: name,
    Customer_Phone: phone,
    Order_Type: state.customerOrderType,
    Table_ID: state.customerOrderType === 'Dine-In' ? parseInt(tableId, 10) : null,
    Payment_Method: paymentMethod,
    items: state.customerCart.map(ci => ({
      Item_ID: ci.item.Item_ID,
      Quantity: ci.quantity
    }))
  };

  const btn = document.getElementById('btn-cust-place-order');
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      state.lastCustomerOrderId = data.Order_ID;

      // Close cart drawer
      closeCustomerCart();

      // Show success modal with order confirmation & bill details
      const receiptEl = document.getElementById('cust-order-success-receipt');
      if (receiptEl) {
        receiptEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong>Order ID:</strong>
            <span style="color: var(--coffee-accent); font-weight: 700;">#${data.Order_ID}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong>Guest Name:</strong>
            <span>${escapeHtml(name)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong>Order Type:</strong>
            <span>${escapeHtml(state.customerOrderType)}${state.customerOrderType === 'Dine-In' ? ` (Table ${tableId})` : ''}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong>Total Amount Paid:</strong>
            <span style="color: var(--coffee-accent); font-weight: 800; font-size: 1.1rem;">₹${Number(data.Grand_Total || 0).toFixed(2)}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <strong>Payment Method:</strong>
            <span>${escapeHtml(paymentMethod)} (Instant Completed)</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--cream-dim); margin-top: 10px; border-top: 1px dashed var(--border-subtle); padding-top: 8px;">
            ⏱️ Estimated preparation time: <strong>8 to 12 minutes</strong>.
          </div>
        `;
      }

      openModal('modal-cust-order-success');
      showToast(`Order #${data.Order_ID} placed successfully!`, 'success');

      // Clear customer cart
      state.customerCart = [];
      renderCustomerCart();

      // Refresh management data in background so staff portal is always up to date
      loadDashboardData();
      loadOrdersData();
    } else {
      showToast(`Failed to place order: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ================================================================
// CUSTOMER TABLE RESERVATION CONTROLLER
// ================================================================

/**
 * Layman Explanation:
 * Handles the guest table reservation form.
 * Calls POST /api/reservations which triggers MySQL trigger trg_sync_table_reservation
 * to automatically lock and mark the table as Reserved!
 */
async function handleCustomerReservation(e) {
  e.preventDefault();

  const name = document.getElementById('cust-res-name')?.value.trim();
  const phone = document.getElementById('cust-res-phone')?.value.trim();
  const guests = parseInt(document.getElementById('cust-res-guests')?.value || '2', 10);
  const zone = document.getElementById('cust-res-zone')?.value || 'Window';
  const resDate = document.getElementById('cust-res-date')?.value;
  const resTime = document.getElementById('cust-res-time')?.value;
  const notes = document.getElementById('cust-res-notes')?.value.trim();

  if (!name || !phone || !resDate || !resTime) {
    showToast('Please fill all required reservation details', 'error');
    return;
  }

  const payload = {
    Customer_Name: name,
    Customer_Phone: phone,
    No_of_People: guests,
    Res_Date: resDate,
    Res_Time: resTime,
    Status: 'Confirmed'
  };

  try {
    const res = await fetch(`${API_BASE}/reservations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(`Table reserved successfully! Booking #${data.Reservation_ID}`, 'success');

      // Reset form
      document.getElementById('form-cust-reservation')?.reset();
      const today = new Date().toISOString().split('T')[0];
      const dateIn = document.getElementById('cust-res-date');
      if (dateIn) dateIn.value = today;

      // Show confirmation alert
      alert(`🎉 Table Reservation Confirmed!\n\nBooking ID: #${data.Reservation_ID}\nGuest: ${name}\nGuests: ${guests} People\nDate: ${resDate}\nTime: ${resTime}\nZone: ${zone}\n\nOur baristas look forward to hosting you!`);

      // Refresh management tables
      loadTablesData();
    } else {
      showToast(`Reservation failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Network error: ${err.message}`, 'error');
  }
}

// ================================================================
// CUSTOMER ORDER STATUS TRACKER
// ================================================================

/**
 * Layman Explanation:
 * Looks up an order by its ID or phone number and shows a visual 4-step progress bar:
 * 1. Placed -> 2. In Kitchen -> 3. Ready -> 4. Served / Completed.
 */
async function handleTrackCustomerOrder() {
  const input = document.getElementById('cust-track-input')?.value.trim();
  const resultsContainer = document.getElementById('cust-track-results');

  if (!input) {
    showToast('Please enter an Order ID or Mobile Number to track', 'error');
    return;
  }

  if (resultsContainer) {
    resultsContainer.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--crema-muted);">
        <span style="font-size: 2rem; display: block; margin-bottom: 8px;">⏳</span>
        Fetching live order progress...
      </div>
    `;
  }

  try {
    const res = await fetch(`${API_BASE}/orders/track/${encodeURIComponent(input)}`);
    const data = await res.json();

    if (!data.success || !data.data || data.data.length === 0) {
      resultsContainer.innerHTML = `
        <div class="track-placeholder">
          <span>❌</span>
          <h4 style="color: var(--crema); margin-bottom: 6px;">No Orders Found</h4>
          <p>We could not find any active or past orders matching "${escapeHtml(input)}". Please verify your Order ID or phone number.</p>
        </div>
      `;
      return;
    }

    resultsContainer.innerHTML = data.data.map(order => {
      const orderDate = new Date(order.Order_Date).toLocaleString();
      const status = order.Status || 'Completed';

      // 4-stage stepper
      const isCompleted = status.toLowerCase() === 'completed';
      const isReady = isCompleted || status.toLowerCase() === 'ready';
      const isPreparing = isReady || status.toLowerCase() === 'in progress';

      return `
        <div class="track-order-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 16px;">
            <div>
              <span style="color: var(--coffee-accent); font-weight: 800; font-size: 1.2rem;">Order #${order.Order_ID}</span>
              <div style="font-size: 0.8rem; color: var(--cream-dim); margin-top: 2px;">Placed on ${orderDate} • ${escapeHtml(order.Order_Type || 'Dine-In')}</div>
            </div>
            <div style="text-align: right;">
              <span class="stock-badge badge-ok">${escapeHtml(status)}</span>
              <div style="font-weight: 800; font-size: 1.15rem; color: var(--crema); margin-top: 4px;">₹${Number(order.Total_Amount || 0).toFixed(2)}</div>
            </div>
          </div>

          <div class="track-progress-stepper">
            <div class="track-step done">
              <div class="track-step-circle">✓</div>
              <span class="track-step-label">Order Placed</span>
            </div>
            <div class="track-step ${isPreparing ? 'done' : 'current'}">
              <div class="track-step-circle">☕</div>
              <span class="track-step-label">Brewing & Cooking</span>
            </div>
            <div class="track-step ${isReady ? 'done' : (isPreparing ? 'current' : '')}">
              <div class="track-step-circle">🍽️</div>
              <span class="track-step-label">Ready for Table</span>
            </div>
            <div class="track-step ${isCompleted ? 'done' : ''}">
              <div class="track-step-circle">✨</div>
              <span class="track-step-label">Completed</span>
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; color: var(--crema-muted); background: rgba(255,255,255,0.02); padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border-light); margin-top: 14px;">
            <span>Customer: <strong>${escapeHtml(order.Customer_Name || 'Guest')}</strong></span>
            <span>Payment: <strong>${escapeHtml(order.Payment_Method || 'UPI')} (${escapeHtml(order.Payment_Status || 'Paid')})</strong></span>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    resultsContainer.innerHTML = `
      <div class="track-placeholder">
        <span>⚠️</span>
        <p>Error tracking order: ${escapeHtml(err.message)}</p>
      </div>
    `;
  }
}

