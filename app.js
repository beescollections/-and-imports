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
    // This allows our existing buttons to easily change the URL
    window.location.hash = pageId; 
}

function handleRouting() {
    // Get the page name from the URL (removes the '#')
    let pageId = window.location.hash.substring(1);
    if (!pageId) pageId = 'home'; // Default to home if no hash

    const pages = document.querySelectorAll('.page');
    let pageExists = false;

    // Hide all pages, show the active one
    pages.forEach(page => {
        if (page.id === pageId) {
            page.classList.add('active');
            pageExists = true;
        } else {
            page.classList.remove('active');
        }
    });

    // Fallback if a customer types a broken link
    if (!pageExists) {
        document.getElementById('home').classList.add('active');
        pageId = 'home';
    }

    window.scrollTo(0, 0);
    
    // Run page-specific logic
    if (pageId === 'cart') renderCart();
    if (pageId === 'admin') {
        renderAdminInventory();
        fetchOrders(); 
    }
}

// Listen for the Back/Forward buttons, and the initial page load!
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

// --- 7. CHECKOUT LOGIC ---
document.getElementById('checkout-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    if(cart.length === 0) {
        alert("Please add some items to your cart before checking out!");
        return;
    }

    let exactCartTotal = 0;
    cart.forEach(item => exactCartTotal += parseFloat(item.price));
    
    const userAmountPaid = parseFloat(document.getElementById('amount-paid').value);

    if (userAmountPaid < exactCartTotal) {
        alert(`Payment Incomplete!\n\nYour cart total is GHS ${exactCartTotal.toFixed(2)}, but you only entered GHS ${userAmountPaid.toFixed(2)}.\n\nPlease pay the full amount to place your order.`);
        return; 
    }

    const btn = e.target.querySelector('button');
    btn.innerText = 'Submitting Order...';
    btn.disabled = true;

    const orderData = {
        customer_name: document.getElementById('cust-name').value,
        momo_number: document.getElementById('momo-number').value,
        transaction_ref: document.getElementById('transaction-ref').value,
        amount: userAmountPaid,
        cart_items: cart,
        status: 'pending'
    };

    const { error } = await client.from('payments').insert([orderData]);

    if (error) {
        console.error("Checkout Error:", error);
        alert("There was an error processing your order. Please try again.");
    } else {
        // Deduct Stock
        for (let item of cart) {
            const product = products.find(p => p.id === item.id);
            if (product && product.stock_quantity > 0) {
                await client.from('products').update({ stock_quantity: product.stock_quantity - 1 }).eq('id', item.id);
            }
        }

        // Format the cart into a neat HTML list for the email
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
            order_summary: itemsListHtml 
        }).then(
            function(response) {
                console.log("Email notification sent successfully", response);
            },
            function(error) {
                console.error("Email notification failed", error);
            }
        );

        alert('Payment Details Submitted Successfully! \n\nWe will verify your MoMo transaction and contact you regarding delivery.');
        cart = []; 
        localStorage.removeItem('beeCart');
        document.getElementById('cart-count').innerText = '0';
        e.target.reset(); 
        navigate('home');
        fetchProducts(); 
    }

    btn.innerText = 'Confirm Payment';
    btn.disabled = false;
});

// --- 8. ADMIN DASHBOARD LOGIC ---
function renderAdminInventory() {
    const list = document.getElementById('admin-inventory-list');
    list.innerHTML = '';

    if(products.length === 0) {
        list.innerHTML = '<p>No items in inventory.</p>';
        return;
    }

    products.forEach(product => {
        list.innerHTML += `
            <div class="admin-item">
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${product.image_url}" alt="${product.name}">
                    <div>
                        <p style="font-weight: bold; font-size: 0.9rem;">${product.name}</p>
                        <p style="font-size: 0.75rem; color: #999;">${product.category || 'Uncategorized'}</p>
                        <p style="color: #25D366; font-size: 0.8rem; font-weight: bold;">Stock: ${product.stock_quantity || 0}</p>
                        <p style="color: #666; font-size: 0.8rem;">GHS ${parseFloat(product.price).toFixed(2)}</p>
                    </div>
                </div>
                <div>
                    <button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; margin-right: 5px;" onclick="promptUpdateStock('${product.id}', ${product.stock_quantity || 0})">Update Stock</button>
                    <button class="btn-danger" onclick="deleteProduct('${product.id}')">Delete</button>
                </div>
            </div>
        `;
    });
}

async function promptUpdateStock(productId, currentStock) {
    const newStock = prompt(`Enter the new amount of stock for this item (Current: ${currentStock}):`, currentStock);
    
    if (newStock !== null && newStock !== "") {
        const parsedStock = parseInt(newStock);
        if (!isNaN(parsedStock) && parsedStock >= 0) {
            const { error } = await client.from('products').update({ stock_quantity: parsedStock }).eq('id', productId);
            if (error) {
                alert("Failed to update stock in database.");
            } else {
                alert("Stock updated successfully!");
                fetchProducts(); 
            }
        } else {
            alert("Please enter a valid number (0 or higher).");
        }
    }
}

async function deleteProduct(productId) {
    if(confirm("Are you sure you want to delete this item from the store permanently?")) {
        const { error } = await client.from('products').delete().eq('id', productId);
        if (error) {
            console.error("Delete error:", error);
            alert("Could not delete product.");
        } else {
            alert("Item deleted.");
            fetchProducts(); 
        }
    }
}

document.getElementById('add-product-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const fileInput = document.getElementById('new-image-file');
    const file = fileInput.files[0];
    const submitBtn = e.target.querySelector('button');
    
    if (!file) {
        alert("Please select an image first!");
        return;
    }

    submitBtn.innerText = 'Uploading Photo...';
    submitBtn.disabled = true;

    const fileName = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`;

    const { data: uploadData, error: uploadError } = await client.storage
        .from('product-images')
        .upload(fileName, file);

    if (uploadError) {
        console.error("Upload error:", uploadError);
        alert("Failed to upload image.");
        submitBtn.innerText = 'Save to Store';
        submitBtn.disabled = false;
        return;
    }

    submitBtn.innerText = 'Saving Item...';
    const { data: urlData } = client.storage.from('product-images').getPublicUrl(fileName);
    const imageUrl = urlData.publicUrl;

    const newProduct = {
        name: document.getElementById('new-name').value,
        price: parseFloat(document.getElementById('new-price').value),
        stock_quantity: parseInt(document.getElementById('new-stock').value), 
        category: document.getElementById('new-category').value, 
        description: document.getElementById('new-desc').value,
        image_url: imageUrl
    };

    const { error: insertError } = await client.from('products').insert([newProduct]);

    if (insertError) {
        console.error("Insert error:", insertError);
        alert("Failed to save item details.");
    } else {
        alert(`${newProduct.name} has been added to your live shop!`);
        e.target.reset(); 
        fetchProducts(); 
    }

    submitBtn.innerText = 'Save to Store';
    submitBtn.disabled = false;
});

// --- ADMIN ORDERS & SEARCH LOGIC ---
async function fetchOrders() {
    const list = document.getElementById('admin-orders-list');
    list.innerHTML = '<p>Loading orders...</p>';

    const { data, error } = await client.from('payments').select('*').order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching orders:", error);
        list.innerHTML = '<p>Could not load orders.</p>';
        return;
    }

    allOrders = data; 
    renderAdminOrders(allOrders);
}

function renderAdminOrders(orders) {
    const list = document.getElementById('admin-orders-list');
    list.innerHTML = '';

    if (!orders || orders.length === 0) {
        list.innerHTML = '<p>No orders match your search.</p>';
        return;
    }

    orders.forEach(order => {
        let itemsHtml = '<ul style="margin-left: 20px; font-size: 0.85rem; color: #555; margin-bottom: 0;">';
        let cartTotal = 0; 

        if (order.cart_items && order.cart_items.length > 0) {
            order.cart_items.forEach(item => {
                const itemPrice = parseFloat(item.price);
                itemsHtml += `<li><strong>${item.name}</strong> - Option: ${item.selectedSize} (GHS ${itemPrice.toFixed(2)})</li>`;
                cartTotal += itemPrice;
            });
        } else {
            itemsHtml += `<li>No items listed</li>`;
        }
        itemsHtml += '</ul>';

        const amountPaid = parseFloat(order.amount) || 0;
        const balance = cartTotal - amountPaid;
        
        let balanceHtml = '';
        if (balance > 0) {
            balanceHtml = `<p style="color: #ff4d4d; font-weight: bold; font-size: 0.95rem; margin-top: 5px;">⚠️ Balance Due: GHS ${balance.toFixed(2)}</p>`;
        } else if (balance < 0) {
            balanceHtml = `<p style="color: #007bff; font-weight: bold; font-size: 0.95rem; margin-top: 5px;">ℹ️ Overpaid by: GHS ${Math.abs(balance).toFixed(2)}</p>`;
        } else {
            balanceHtml = `<p style="color: #25D366; font-weight: bold; font-size: 0.95rem; margin-top: 5px;">✅ Fully Paid</p>`;
        }

        list.innerHTML += `
            <div style="background: var(--cream); padding: 15px; border-radius: 5px; margin-bottom: 15px; border-left: 4px solid var(--gold); position: relative;">
                
                <div style="position: absolute; right: 15px; top: 15px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end;">
                    ${order.status !== 'Completed' ? `<button class="btn-primary" style="padding: 5px 10px; font-size: 0.8rem; width: auto;" onclick="markOrderComplete('${order.id}')">Mark Delivered</button>` : ''}
                    <button class="btn-danger" style="padding: 5px 10px; font-size: 0.8rem; width: auto;" onclick="deleteOrder('${order.id}')">Delete</button>
                </div>

                <h4 style="margin-bottom: 5px; max-width: 65%;">Order from: ${order.customer_name}</h4>
                <p style="font-size: 0.85rem; margin-bottom: 2px;"><strong>MoMo Number:</strong> ${order.momo_number}</p>
                <p style="font-size: 0.85rem; margin-bottom: 2px;"><strong>Ref ID:</strong> ${order.transaction_ref}</p>
                <p style="font-size: 0.85rem; margin-bottom: 10px;"><strong>Status:</strong> <span style="color: ${order.status === 'Completed' ? 'green' : 'orange'}; font-weight: bold;">${order.status.toUpperCase()}</span></p>
                
                <strong>Items to Pack:</strong>
                ${itemsHtml}
                
                <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed #ccc;">
                    <p style="font-size: 0.9rem; margin-bottom: 3px;"><strong>Cart Total Price:</strong> GHS ${cartTotal.toFixed(2)}</p>
                    <p style="font-size: 0.9rem; margin-bottom: 3px;"><strong>Amount Paid by Customer:</strong> GHS ${amountPaid.toFixed(2)}</p>
                    ${balanceHtml}
                </div>
            </div>
        `;
    });
}

function searchOrders() {
    const searchTerm = document.getElementById('order-search').value.toLowerCase();
    const filteredOrders = allOrders.filter(order => {
        const nameMatch = order.customer_name && order.customer_name.toLowerCase().includes(searchTerm);
        const momoMatch = order.momo_number && order.momo_number.includes(searchTerm);
        const refMatch = order.transaction_ref && order.transaction_ref.toLowerCase().includes(searchTerm);
        return nameMatch || momoMatch || refMatch;
    });
    renderAdminOrders(filteredOrders); 
}

async function markOrderComplete(orderId) {
    if(confirm("Have you delivered this order? Mark it as complete?")) {
        const { error } = await client.from('payments').update({ status: 'Completed' }).eq('id', orderId);
        if(error) {
            alert("Could not update order status.");
        } else {
            fetchOrders(); 
        }
    }
}

// Delete Order Logic
async function deleteOrder(orderId) {
    if(confirm("Are you sure you want to permanently delete this order record? This cannot be undone.")) {
        const { error } = await client.from('payments').delete().eq('id', orderId);
        if(error) {
            alert("Could not delete order. Did you update the Supabase policy? Error: " + error.message);
        } else {
            fetchOrders(); 
        }
    }
}

// --- 9. SECURE ADMIN LOGIN LOGIC ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const emailInput = document.getElementById('admin-email').value;
    const passwordInput = document.getElementById('admin-password').value;
    const submitBtn = e.target.querySelector('button');
    
    submitBtn.innerText = 'Authenticating...';
    submitBtn.disabled = true;

    // Ask Supabase to securely log this person in
    const { data, error } = await client.auth.signInWithPassword({
        email: emailInput,
        password: passwordInput,
    });

    if (error) {
        alert("Access Denied: " + error.message);
    } else {
        e.target.reset(); 
        navigate('admin'); 
    }
    
    submitBtn.innerText = 'Secure Login';
    submitBtn.disabled = false;
});

// SECURE LOGOUT
async function adminLogout() {
    await client.auth.signOut();
    navigate('home');
    alert("You have been securely logged out.");
}
