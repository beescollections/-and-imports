// --- 0. API KEYS ---
// FIX: Use your TEST key here until Paystack officially verifies her business documents!
const PAYSTACK_PUBLIC_KEY = 'pk_test_YOUR_TEST_KEY_HERE'; 

// Uncomment the line below ONLY after Paystack emails Bee saying her account is 100% verified and live.
// const PAYSTACK_PUBLIC_KEY = 'pk_live_0e7c17571693c054970ee243c4c9f2b3e8f7a14a';

// --- 1. SUPABASE CONNECTION ---
const SUPABASE_URL = 'https://blqgodxcqjgpuscoxzah.supabase.co';
const SUPABASE_KEY = 'sb_publishable_KhhAED2Z2Vq2IJvJvA4JYQ_Fgs2QqhC';

const client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- INITIALIZE EMAILJS ---
emailjs.init("rffuW_Hdh69azO9iY");

// --- 2. GLOBAL STATE ---
let products = [];
let currentCategory = 'All'; 
let cart = JSON.parse(localStorage.getItem('beeCart')) || [];
let allOrders = []; 

// --- 3. INITIALIZATION & DATA FETCHING ---
document.addEventListener('DOMContentLoaded', () => {
    fetchProducts(); 
    document.getElementById('cart-count').innerText = cart.length;
});

async function fetchProducts() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Loading store...</p>';

    const { data, error } = await client.from('products').select('*').order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching products:", error);
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Could not load products. Please check your database connection.</p>';
        return;
    }

    products = data;
    renderProducts();
    
    if(document.getElementById('admin').classList.contains('active')) {
        renderAdminInventory();
        fetchOrders(); 
    }
}

// --- 4. NAVIGATION & ROUTING ---
function navigate(pageId) {
    window.location.hash = pageId; 
}

function handleRouting() {
    let pageId = window.location.hash.substring(1);
    if (!pageId) pageId = 'home';

    const pages = document.querySelectorAll('.page');
    let pageExists = false;

    pages.forEach(page => {
        if (page.id === pageId) {
            page.classList.add('active');
            pageExists = true;
        } else {
            page.classList.remove('active');
        }
    });

    if (!pageExists) {
        document.getElementById('home').classList.add('active');
        pageId = 'home';
    }

    window.scrollTo(0, 0);
    
    if (pageId === 'cart') renderCart();
    if (pageId === 'admin') {
        renderAdminInventory();
        fetchOrders(); 
    }
}

window.addEventListener('hashchange', handleRouting);
window.addEventListener('load', handleRouting);

function filterProducts() {
    currentCategory = document.getElementById('category-filter').value;
    renderProducts();
}

// --- 5. SHOP & PRODUCT MODAL LOGIC ---
function renderProducts() {
    const grid = document.getElementById('product-grid');
    grid.innerHTML = ''; 

    const filteredProducts = currentCategory === 'All' 
        ? products 
        : products.filter(p => p.category === currentCategory);

    if (filteredProducts.length === 0) {
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">No items found in this category right now.</p>';
        return;
    }

    filteredProducts.forEach(product => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.onclick = () => openModal(product.id);
        
        card.innerHTML = `
            <img src="${product.image_url}" alt="${product.name}">
            <span style="display:inline-block; margin-top:10px; font-size: 0.8rem; background: var(--beige); padding: 3px 10px; border-radius: 10px; color: var(--gold); font-weight: 600;">${product.category || 'Uncategorized'}</span>
            <h3 style="margin-top: 5px;">${product.name}</h3>
            <p>GHS ${parseFloat(product.price).toFixed(2)}</p>
        `;
        grid.appendChild(card);
    });
}

function openModal(productId) {
    const product = products.find(p => p.id === productId);
    const modal = document.getElementById('product-modal');
    const modalBody = document.getElementById('modal-body');

    const stockQuantity = product.stock_quantity || 0;
    const isOutOfStock = stockQuantity <= 0;
    
    const stockText = isOutOfStock 
        ? `<p style="color: #ff4d4d; font-weight: bold; margin-bottom: 10px;">❌ Out of Stock</p>` 
        : `<p style="color: #25D366; font-weight: bold; margin-bottom: 10px;">✅ ${stockQuantity} in stock</p>`;
        
    const btnDisabled = isOutOfStock ? 'disabled style="background: #ccc; cursor: not-allowed;"' : '';
    const btnText = isOutOfStock ? 'Sold Out' : 'Add to Cart';

    modalBody.innerHTML = `
        <img src="${product.image_url}" alt="${product.name}">
        <div class="modal-info">
            <h2>${product.name}</h2>
            <p style="font-size: 0.9rem; color: #666; margin-bottom: 5px;">Category: ${product.category || 'Uncategorized'}</p>
            ${stockText}
            <p class="price">GHS ${parseFloat(product.price).toFixed(2)}</p>
            <p>${product.description}</p>
            
            <label for="size-select" style="display:block; margin-top:15px; font-weight:bold;">Select Option/Size:</label>
            <select id="size-select" ${btnDisabled}>
                <option value="N/A">N/A (One Size / Appliance)</option>
                <option value="UK 8">UK 8 (Small)</option>
                <option value="UK 10">UK 10 (Medium)</option>
                <option value="UK 12">UK 12 (Large)</option>
                <option value="UK 14">UK 14 (X-Large)</option>
            </select>

            <button class="btn-primary" ${btnDisabled} onclick="addToCart('${product.id}')" style="margin-top: 10px;">${btnText}</button>
        </div>
    `;

    modal.style.display = 'flex';
}

function closeModal() {
    document.getElementById('product-modal').style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('product-modal');
    if (event.target == modal) {
        modal.style.display = "none";
    }
}

// --- 6. CART LOGIC ---
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    
    const itemsCurrentlyInCart = cart.filter(item => item.id === productId).length;
    if (itemsCurrentlyInCart >= product.stock_quantity) {
        alert(`You cannot add more of this item! We only have ${product.stock_quantity} left in stock.`);
        return;
    }

    const size = document.getElementById('size-select').value;
    const cartItem = {
        ...product,
        selectedSize: size,
        cartId: Math.random().toString(36).substr(2, 9)
    };

    cart.push(cartItem);
    localStorage.setItem('beeCart', JSON.stringify(cart));
    
    document.getElementById('cart-count').innerText = cart.length;
    closeModal();
    alert(`${product.name} added to your cart!`);
}

function renderCart() {
    const cartContainer = document.getElementById('cart-items');
    let total = 0;
    cartContainer.innerHTML = '';

    if (cart.length === 0) {
        cartContainer.innerHTML = '<p style="text-align:center; padding: 20px;">Your cart is beautifully empty.</p>';
        document.getElementById('cart-total').innerText = '0.00';
        return;
    } 

    cart.forEach((item) => {
        total += parseFloat(item.price);
        cartContainer.innerHTML += `
            <div class="cart-item">
                <div>
                    <h4>${item.name}</h4>
                    <p style="color: #666; font-size: 0.9rem;">Option: ${item.selectedSize}</p>
                    <p style="font-weight: bold;">GHS ${parseFloat(item.price).toFixed(2)}</p>
                </div>
                <button class="remove-btn" onclick="removeFromCart('${item.cartId}')">Remove</button>
            </div>
        `;
    });
    
    document.getElementById('cart-total').innerText = total.toFixed(2);
}

function removeFromCart(cartId) {
    cart = cart.filter(item => item.cartId !== cartId);
    localStorage.setItem('beeCart', JSON.stringify(cart));
    document.getElementById('cart-count').innerText = cart.length;
    renderCart(); 
}

// --- 7. CHECKOUT LOGIC (PAYSTACK AUTOMATION) ---
document.getElementById('checkout-form').addEventListener('submit', function(e) {
    e.preventDefault();

    if(cart.length === 0) {
        alert("Please add some items to your cart before checking out!");
        return;
    }

    // Securely calculate exact total from the cart 
    let exactCartTotal = 0;
    cart.forEach(item => exactCartTotal += parseFloat(item.price));

    const email = document.getElementById('cust-email').value;
    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('momo-number').value;
    const address = document.getElementById('delivery-address').value;

    const btn = document.getElementById('pay-btn');
    btn.innerText = 'Opening Secure Checkout...';
    btn.disabled = true;

    // Initialize Paystack Pop-up
    let handler = PaystackPop.setup({
        key: PAYSTACK_PUBLIC_KEY, 
        email: email,
        // FIX: Math.round ensures there are no tiny decimals that crash Paystack's system
        amount: Math.round(exactCartTotal * 100), 
        currency: 'GHS',
        ref: 'BEE_' + Math.floor((Math.random() * 1000000000) + 1), 
        metadata: {
            custom_fields: [
                { display_name: "Customer Name", variable_name: "customer_name", value: name },
                { display_name: "Phone Number", variable_name: "phone_number", value: phone }
            ]
        },
        callback: async function(response) {
            // THIS RUNS ONLY IF PAYMENT IS SUCCESSFUL
            const paystackReference = response.reference;
            btn.innerText = 'Processing Order...';

            const orderData = {
                customer_name: name,
                momo_number: phone, 
                transaction_ref: paystackReference, 
                amount: exactCartTotal, 
                delivery_address: address,
                screenshot_url: null, // No longer using screenshots
                cart_items: cart,
                status: 'Paid - Pending Delivery'
            };

            const { error } = await client.from('payments').insert([orderData]);

            if (error) {
                console.error("Checkout Error:", error);
                alert("Payment successful, but order failed to save. Please contact support with Reference ID: " + paystackReference);
            } else {
                // Deduct Stock
                for (let item of cart) {
                    const product = products.find(p => p.id === item.id);
                    if (product && product.stock_quantity > 0) {
                        await client.from('products').update({ stock_quantity: product.stock_quantity - 1 }).eq('id', item.id);
                    }
                }

                let itemsListHtml = '<ul style="margin: 0; padding-left: 20px;">';
                cart.forEach(item => {
                    itemsListHtml += `<li style="margin-bottom: 5px;"><strong>${item.name}</strong> - Option: ${item.selectedSize} (GHS ${parseFloat(item.price).toFixed(2)})</li>`;
                });
                itemsListHtml += '</ul>';

                // SEND EMAIL NOTIFICATION VIA EMAILJS
                emailjs.send("service_mudquvm", "template_rkricc9", {
                    customer_name: orderData.customer_name,
                    amount: orderData.amount,
                    momo_number: orderData.momo_number,
                    transaction_ref: orderData.transaction_ref,
                    delivery
