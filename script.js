
// ---------- Supabase Init ----------
const SUPABASE_URL = 'https://gkxiujmyfsdyxnwhgyzc.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdreGl1am15ZnNkeXhud2hneXpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY3NzU3MzUsImV4cCI6MjA4MjM1MTczNX0.oNv2crqvx94abVYFrNhnlQ_ACIdBe1UxMkIDHeBeH7U';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---------- State Management ----------
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let user = JSON.parse(localStorage.getItem('user')) || null;
let productsCache = [];
let currentCategory = 'all';

// ---------- DOM Elements ----------
const appContainer = document.getElementById('app-container');
const bottomNav = document.getElementById('bottom-nav');
const loadingSpinner = document.getElementById('loading-spinner');

// ---------- Helpers ----------
function showLoading() {
  loadingSpinner.style.display = 'block';
}

function hideLoading() {
  loadingSpinner.style.display = 'none';
}

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  updateCartCount();
}

function saveUser(userData) {
  user = userData;
  localStorage.setItem('user', JSON.stringify(user));
}

function updateCartCount() {
  const count = cart.length;
  // We can update a badge here if we had one in the bottom nav
  const badge = document.getElementById('cart-badge-count');
  if (badge) {
    badge.innerText = count > 0 ? count : '';
    badge.style.display = count > 0 ? 'inline-block' : 'none';
  }
}

// ---------- Navigation & Routing ----------
function navigateTo(screenName, params = {}) {
  console.log(`Navigating to: ${screenName}`);

  // Hide all main content children
  const mainContent = document.getElementById('main-content');
  mainContent.style.display = 'block'; // Ensure container is visible
  mainContent.innerHTML = ''; // Clear current content for simplicity or we could hide/show divs

  document.getElementById('auth-screen').innerHTML = ''; // Clear auth if active

  if (screenName === 'auth') {
    renderAuthScreen();
  } else {
    // Show Navigation Bar for logged in users
    renderBottomNav(screenName);

    if (screenName === 'catalog') renderCatalogView();
    else if (screenName === 'cart') renderCustomerCartView();
    else if (screenName === 'profile') renderCustomerMyProfile();
    else if (screenName === 'admin') renderAdminPanel();
    else if (screenName === 'admin-product-form') renderAdminProductForm(params.productId);
    else if (screenName === 'admin-order-detail') renderAdjustableOrderSummary(params.orderId);
  }
}

function renderBottomNav(activeTab) {
  if (!user) {
    bottomNav.innerHTML = '';
    return;
  }

  const isAdmin = user.phone === 'admin'; // Simple admin check

  bottomNav.innerHTML = `
        <div class="bottom-nav">
            <div class="nav-item ${activeTab === 'catalog' ? 'active' : ''}" onclick="navigateTo('catalog')">
                <span class="nav-icon">🏠</span>
                Home
            </div>
            <div class="nav-item ${activeTab === 'cart' ? 'active' : ''}" onclick="navigateTo('cart')">
                <span class="nav-icon">🛒</span>
                Cart <span id="cart-badge-count" style="background:red;color:white;border-radius:50%;padding:2px 5px;font-size:10px;display:none;"></span>
            </div>
            <div class="nav-item ${activeTab === 'profile' ? 'active' : ''}" onclick="navigateTo('profile')">
                <span class="nav-icon">👤</span>
                Profile
            </div>
            ${isAdmin ? `
            <div class="nav-item ${activeTab === 'admin' ? 'active' : ''}" onclick="navigateTo('admin')">
                <span class="nav-icon">⚙️</span>
                Admin
            </div>
            ` : ''}
        </div>
    `;
  updateCartCount();
}

// ---------- Auth Screen ----------
function renderAuthScreen() {
  const container = document.getElementById('auth-screen');
  container.innerHTML = `
        <div class="padded-container" style="text-align:center; padding-top: 50px;">
            <h1 style="color:#4CAF50;">Fresh Market</h1>
            <p>Order fresh vegetables & fruits daily.</p>
            
            <div style="background:white; padding:20px; border-radius:8px; margin-top:20px; box-shadow:0 2px 5px rgba(0,0,0,0.1);">
                <h3>Welcome</h3>
                <input type="text" id="auth-name" placeholder="Your Name" />
                <input type="tel" id="auth-phone" placeholder="Phone Number" />
                <input type="text" id="auth-house" placeholder="House Number / Address" />
                
                <button class="btn" onclick="handleLogin()">Start Ordering</button>
            </div>
        </div>
    `;
}

function handleLogin() {
  const name = document.getElementById('auth-name').value;
  const phone = document.getElementById('auth-phone').value;
  const house = document.getElementById('auth-house').value;

  if (!name || !phone || !house) {
    alert('Please fill in all fields.');
    return;
  }

  saveUser({ name, phone, house });
  navigateTo('catalog');
}

// ---------- Catalog View ----------
async function renderCatalogView() {
  const main = document.getElementById('main-content');

  main.innerHTML = `
        <div class="header">
            Fresh Market
        </div>
        <div style="padding:10px; display:flex; gap:10px; overflow-x:auto;">
            <button class="btn btn-small ${currentCategory === 'all' ? 'btn-orange' : ''}" onclick="filterCategory('all')">All</button>
            <button class="btn btn-small ${currentCategory === 'vegetable' ? 'btn-orange' : ''}" onclick="filterCategory('vegetable')">Veg</button>
            <button class="btn btn-small ${currentCategory === 'fruit' ? 'btn-orange' : ''}" onclick="filterCategory('fruit')">Fruits</button>
        </div>
        <div id="catalog-list" class="catalog">
            <div style="text-align:center; padding:20px;">Loading products...</div>
        </div>
    `;

  // Fetch products if not cached or force refresh
  showLoading();
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('available', true)
    .order('name');

  hideLoading();

  if (error) {
    console.error(error);
    document.getElementById('catalog-list').innerHTML = `<p style="color:red;text-align:center;">Error loading products.</p>`;
    return;
  }

  productsCache = data;
  renderProductList();
}

function filterCategory(cat) {
  currentCategory = cat;
  renderCatalogView(); // Re-render with filter
}

function renderProductList() {
  const container = document.getElementById('catalog-list');
  container.innerHTML = '';

  const filtered = currentCategory === 'all'
    ? productsCache
    : productsCache.filter(p => p.category === currentCategory);

  if (filtered.length === 0) {
    container.innerHTML = '<p style="text-align:center; color:#666;">No products found.</p>';
    return;
  }

  filtered.forEach(p => {
    const cartItem = cart.find(i => i.id === p.id);
    const qty = cartItem ? cartItem.quantity : 0;

    const el = document.createElement('div');
    el.className = 'product-card';
    el.innerHTML = `
            <img src="${p.image || 'https://placehold.co/150'}" alt="${p.name}">
            <h3>${p.name}</h3>
            <div class="price-tag">₹${p.price_per_250g} / ${p.minimum_quantity_unit === 'packet' ? 'pkt' : '250g'}</div>
            
            ${qty === 0 ? `
                <button class="btn" onclick="addToCart('${p.id}')">Add</button>
            ` : `
                <div class="qty-controls">
                    <button class="qty-btn" onclick="decreaseQty('${p.id}')">-</button>
                    <span style="font-weight:bold; font-size:18px; width:30px;">${qty}</span>
                    <button class="qty-btn" onclick="increaseQty('${p.id}')">+</button>
                </div>
            `}
        `;
    container.appendChild(el);
  });
}

function addToCart(productId) {
  const product = productsCache.find(p => p.id === productId);
  if (!product) return;

  cart.push({
    id: product.id,
    name: product.name,
    price_per_250g: product.price_per_250g,
    unit: product.minimum_quantity_unit,
    quantity: 1
  });
  saveCart();
  renderProductList(); // Re-render to show controls
  updateCartCount();
}

function increaseQty(productId) {
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.quantity++;
    saveCart();
    // Check if we are in catalog or cart view to know what to re-render
    // Simple heuristic: check if catalog list exists
    if (document.getElementById('catalog-list')) renderProductList();
    else renderCustomerCartView();
  }
}

function decreaseQty(productId) {
  const item = cart.find(i => i.id === productId);
  if (item) {
    item.quantity--;
    if (item.quantity <= 0) {
      cart = cart.filter(i => i.id !== productId);
    }
    saveCart();
    if (document.getElementById('catalog-list')) renderProductList();
    else renderCustomerCartView();
  }
}

// ---------- Cart View ----------
function renderCustomerCartView() {
  const main = document.getElementById('main-content');

  if (cart.length === 0) {
    main.innerHTML = `
            <div class="header">My Cart</div>
            <div class="padded-container" style="text-align:center; padding-top:50px;">
                <p>Your cart is empty.</p>
                <button class="btn" onclick="navigateTo('catalog')">Start Shopping</button>
            </div>
        `;
    return;
  }

  const totalApprox = cart.reduce((sum, item) => sum + (item.price_per_250g * item.quantity), 0);

  main.innerHTML = `
        <div class="header">My Cart</div>
        <div class="padded-container">
            ${cart.map(item => `
                <div class="product-card" style="display:flex; align-items:center; text-align:left; justify-content:space-between;">
                    <div style="flex:1;">
                        <strong>${item.name}</strong><br>
                        <small>₹${item.price_per_250g} / ${item.unit === 'packet' ? 'pkt' : '250g'}</small>
                    </div>
                    <div class="qty-controls" style="margin-top:0;">
                         <button class="qty-btn" onclick="decreaseQty('${item.id}')">-</button>
                         <span style="font-weight:bold; padding:0 10px;">${item.quantity}</span>
                         <button class="qty-btn" onclick="increaseQty('${item.id}')">+</button>
                    </div>
                </div>
            `).join('')}
            
            <div style="margin-top:20px; border-top:1px solid #ddd; padding-top:10px;">
                <div style="display:flex; justify-content:space-between; font-weight:bold; font-size:18px;">
                    <span>Total (Approx):</span>
                    <span>₹${totalApprox}</span>
                </div>
                <p style="font-size:12px; color:#666;">* Final price may vary slightly based on actual weight.</p>
            </div>

            <div style="margin-top:20px;">
                <h3>Delivery Details</h3>
                <p><strong>Name:</strong> ${user.name}</p>
                <p><strong>Phone:</strong> ${user.phone}</p>
                <p><strong>Address:</strong> ${user.house}</p>
                <button class="btn btn-small" style="background:#777;" onclick="navigateTo('profile')">Edit Details</button>
            </div>

            <button class="btn" style="margin-top:20px;" onclick="placeOrder()">Place Order</button>
        </div>
    `;
}

async function placeOrder() {
  showLoading();

  // Construct Order Object
  const orderData = {
    customer_name: user.name,
    customer_phone: user.phone,
    customer_house_number: user.house,
    items: cart, // Store the array as JSON
    status: 'pending_price_confirmation'
  };

  const { data, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select();

  hideLoading();

  if (error) {
    alert('Failed to place order: ' + error.message);
    console.error(error);
  } else {
    alert('Order Placed Successfully! We will contact you with the final weight and price.');
    cart = [];
    saveCart();
    navigateTo('catalog');
  }
}

// ---------- Profile View ----------
function renderCustomerMyProfile() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
        <div class="header">My Profile</div>
        <div class="padded-container">
            <h3>Edit Details</h3>
            <input type="text" id="edit-name" value="${user.name}" placeholder="Name">
            <input type="text" id="edit-phone" value="${user.phone}" placeholder="Phone">
            <input type="text" id="edit-house" value="${user.house}" placeholder="House Number">
            <button class="btn" onclick="updateProfile()">Save Changes</button>
            
            <hr style="margin:20px 0;">
            <h3>My Orders</h3>
            <div id="order-history">Loading history...</div>
            
            <button class="btn btn-danger" style="margin-top:30px;" onclick="logout()">Logout</button>
        </div>
    `;
  loadOrderHistory();
}

function updateProfile() {
  const name = document.getElementById('edit-name').value;
  const phone = document.getElementById('edit-phone').value;
  const house = document.getElementById('edit-house').value;

  saveUser({ name, phone, house });
  alert('Profile updated!');
}

function logout() {
  localStorage.removeItem('user');
  user = null;
  location.reload();
}

async function loadOrderHistory() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_phone', user.phone)
    .order('created_at', { ascending: false });

  const container = document.getElementById('order-history');
  if (error) {
    container.innerText = 'Error loading history.';
    return;
  }

  if (data.length === 0) {
    container.innerText = 'No past orders.';
    return;
  }

  container.innerHTML = data.map(o => `
        <div style="border:1px solid #eee; padding:10px; margin-bottom:10px; border-radius:5px;">
            <div style="display:flex; justify-content:space-between;">
                <strong>${new Date(o.created_at).toLocaleDateString()}</strong>
                <span class="${o.status === 'finalized' ? 'price-tag' : ''}">${o.status}</span>
            </div>
            <div>${o.items.length} items</div>
            ${o.grand_total_final ? `<div><strong>Total: ₹${o.grand_total_final}</strong></div>` : ''}
        </div>
    `).join('');
}

// ---------- Admin Panel ----------
function renderAdminPanel() {
  const main = document.getElementById('main-content');
  main.innerHTML = `
        <div class="header">Admin Panel</div>
        <div class="padded-container">
            <button class="btn btn-orange" onclick="navigateTo('admin-product-form')">Add New Product</button>
            
            <h3>Recent Orders</h3>
            <div id="admin-orders-list">Loading...</div>
        </div>
    `;
  loadAdminOrders();
}

async function loadAdminOrders() {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });

  const container = document.getElementById('admin-orders-list');
  if (error) {
    container.innerText = 'Error loading.';
    return;
  }

  container.innerHTML = data.map(o => `
        <div class="product-card" style="text-align:left; cursor:pointer;" onclick="navigateTo('admin-order-detail', {orderId: '${o.id}'})">
            <div><strong>${o.customer_name}</strong> (${o.customer_house_number})</div>
            <div>Status: <span class="admin-badge">${o.status}</span></div>
            <div>Time: ${new Date(o.created_at).toLocaleString()}</div>
        </div>
    `).join('');
}

// ---------- Admin: Product Form ----------
function renderAdminProductForm(productId = null) {
  const main = document.getElementById('main-content');
  main.innerHTML = `
        <div class="header">${productId ? 'Edit' : 'Add'} Product</div>
        <div class="padded-container">
             <input type="text" id="prod-name" placeholder="Product Name">
             <input type="text" id="prod-image" placeholder="Image URL">
             <input type="number" id="prod-price" placeholder="Price per Unit">
             
             <label>Unit Type:</label>
             <select id="prod-unit">
                <option value="250g">250g Base</option>
                <option value="packet">Packet</option>
             </select>

             <label>Category:</label>
             <select id="prod-category">
                <option value="vegetable">Vegetable</option>
                <option value="fruit">Fruit</option>
                <option value="other">Other</option>
             </select>

             <button class="btn" onclick="saveProduct('${productId || ''}')">Save Product</button>
             <button class="btn" style="background:#777; margin-top:10px;" onclick="navigateTo('admin')">Cancel</button>
        </div>
    `;
}

async function saveProduct(id) {
  const name = document.getElementById('prod-name').value;
  const image = document.getElementById('prod-image').value;
  const price = document.getElementById('prod-price').value;
  const unit = document.getElementById('prod-unit').value;
  const category = document.getElementById('prod-category').value;

  const payload = {
    name,
    image,
    price_per_250g: price,
    minimum_quantity_unit: unit,
    category,
    available: true
  };

  let error;
  if (id) {
    // Update
    ({ error } = await supabase.from('products').update(payload).eq('id', id));
  } else {
    // Insert
    ({ error } = await supabase.from('products').insert(payload));
  }

  if (error) alert('Error: ' + error.message);
  else {
    alert('Saved!');
    navigateTo('admin');
  }
}

// ---------- Admin: Order Detail & Finalize ----------
async function renderAdjustableOrderSummary(orderId) {
  const main = document.getElementById('main-content');
  main.innerHTML = `<div class="padded-container">Loading order...</div>`;

  const { data: order, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();

  if (error) {
    main.innerText = 'Error.';
    return;
  }

  main.innerHTML = `
        <div class="header">Order #${order.id.slice(0, 4)}</div>
        <div class="padded-container">
            <p><strong>Customer:</strong> ${order.customer_name}</p>
            <p><strong>Phone:</strong> ${order.customer_phone} <a href="https://wa.me/${order.customer_phone}" target="_blank">WhatsApp</a></p>
            <p><strong>Items:</strong></p>
            <div id="order-items-finalize"></div>
            
            <div style="font-weight:bold; font-size:18px; margin-top:20px; text-align:right;">
                Grand Total: ₹<span id="grand-total-display">0</span>
            </div>

            <button class="btn" onclick="finalizeOrder('${order.id}')">Finalize & Send Bill</button>
            <button class="btn" style="background:#777; margin-top:10px;" onclick="navigateTo('admin')">Back</button>
        </div>
    `;

  const list = document.getElementById('order-items-finalize');
  let runningTotal = 0;

  order.items.forEach((item, index) => {
    // Prepare HTML for item row
    // If status is finalized, maybe show finalized weights. 
    // For now assume we are editing.

    // Logic: Packet items don't change weight usually, but 250g items do.
    // We will default actual weight to (quantity * 250) or quantity if packet.

    const isPacket = item.unit === 'packet';
    const defaultWeight = isPacket ? item.quantity : (item.quantity * 250);
    const label = isPacket ? 'Qty' : 'Weight(g)';

    const div = document.createElement('div');
    div.className = 'product-card';
    div.innerHTML = `
            <div style="display:flex; justify-content:space-between;">
                <strong>${item.name}</strong>
                <span>Ordered: ${item.quantity} ${isPacket ? 'pK' : 'units'}</span>
            </div>
            <div style="margin-top:5px; display:flex; gap:10px; align-items:center;">
                <label>${label}:</label>
                <input type="number" 
                    id="weight-${index}" 
                    value="${defaultWeight}" 
                    style="width:100px; padding:5px;" 
                    onchange="recalcTotal(${index}, ${item.price_per_250g}, '${item.unit}')">
                
                <span style="margin-left:auto; font-weight:bold;">₹<span id="price-${index}">0</span></span>
            </div>
        `;
    list.appendChild(div);

    // Initial calc
    const initialPrice = calculateItemPrice(defaultWeight, item.price_per_250g, item.unit);
    document.getElementById(`price-${index}`).innerText = initialPrice;
    runningTotal += initialPrice;
  });

  document.getElementById('grand-total-display').innerText = runningTotal;
}

function calculateItemPrice(weightOrQty, pricePerUnit, unitType) {
  if (unitType === 'packet') {
    return weightOrQty * pricePerUnit;
  } else {
    // Unit is 250g base. 
    // Price is for 250g.
    // Price = (WeightInGrams / 250) * PricePer250g
    return Math.round((weightOrQty / 250) * pricePerUnit);
  }
}

window.recalcTotal = function (index, pricePerUnit, unitType) {
  const input = document.getElementById(`weight-${index}`);
  const val = parseFloat(input.value) || 0;

  const newPrice = calculateItemPrice(val, pricePerUnit, unitType);
  document.getElementById(`price-${index}`).innerText = newPrice;

  // Recalc Grand Total
  const allPrices = document.querySelectorAll('[id^="price-"]');
  let total = 0;
  allPrices.forEach(span => total += parseFloat(span.innerText));
  document.getElementById('grand-total-display').innerText = total;
}

window.finalizeOrder = async function (orderId) {
  if (!confirm('Confirm finalize and update order?')) return;

  // Gather all final data
  // This part requires mapping back inputs to the items
  // For simplicity, we just grab the grand total
  const total = document.getElementById('grand-total-display').innerText;

  const { error } = await supabase.from('orders').update({
    status: 'finalized',
    grand_total_final: total
  }).eq('id', orderId);

  if (error) alert('Error: ' + error.message);
  else {
    alert('Order Finalized!');
    navigateTo('admin');
  }
}


// ---------- Initialization ----------
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is logged in
  if (!user) {
    navigateTo('auth');
  } else {
    navigateTo('catalog');
  }
});