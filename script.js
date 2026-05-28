// --- 1. FIREBASE IMPORTS ---
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";
import { getFirestore, collection, addDoc, doc, getDoc, updateDoc, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js";

// Initialize Firebase (Replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyCnp-s_zyRGRxMq-IA_cMAtoou_orffBpU",
  authDomain: "the-green-world-aa2f9.firebaseapp.com",
  databaseURL: "https://the-green-world-aa2f9-default-rtdb.firebaseio.com",
  projectId: "the-green-world-aa2f9",
  storageBucket: "the-green-world-aa2f9.firebasestorage.app",
  messagingSenderId: "870237294797",
  appId: "1:870237294797:web:85d31bc0a5dd2448029984",
  measurementId: "G-L73WX74YSV"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Use relative URLs so API calls work on both localhost and deployed servers
// This ensures /api/products calls go to the same domain serving the frontend
const API_BASE_URL = '';

// ---------------- STATE ----------------
let cart = JSON.parse(localStorage.getItem('cart')) || [];
let wishlist = JSON.parse(localStorage.getItem('wishlist')) || [];
let loadedProducts = [];
const wishlistLastTap = {};
let wishlistTouchHandled = false;

// Temporary checkout state
let checkoutItems = [];
let checkoutTotal = 0;
let checkoutSource = ""; // "cart" or "single"

// ---------------- STORAGE ----------------
function updateStorage() {
    localStorage.setItem('cart', JSON.stringify(cart));
    localStorage.setItem('wishlist', JSON.stringify(wishlist));
    renderUI();
}

// ---------------- CART & WISHLIST ----------------
function addToCart(name, price) {
    cart.push({ name: name, price: price });
    updateStorage();
    alert(name + " added to cart!");
}

function removeFromCart(index) {
    cart.splice(index, 1);
    updateStorage();
}

function toggleWishlistItem(name, element) {
    const index = wishlist.indexOf(name);
    const heartElement = element.classList.contains('wishlist-heart') ? element : element.closest('.product-card')?.querySelector('.wishlist-heart');

    if (index > -1) {
        wishlist.splice(index, 1);
        if (heartElement) {
            heartElement.classList.remove('active');
            heartElement.style.color = '#ccc';
        }
    } else {
        wishlist.push(name);
        if (heartElement) {
            heartElement.classList.add('active');
            heartElement.style.color = 'red';
        }
    }
    updateStorage();
}

// ---------------- SIDEBAR & NAVIGATION ----------------
function updateSidebarOverlay() {
    const overlay = document.getElementById("pageOverlay");
    const cart = document.getElementById("cartSidebar");
    const wish = document.getElementById("wishlistSidebar");
    if (!overlay) return;
    const isOpen = cart?.classList.contains("active") || wish?.classList.contains("active");
    overlay.classList.toggle("active", isOpen);
}

function closeSidebars() {
    document.getElementById("cartSidebar").classList.remove("active");
    document.getElementById("wishlistSidebar").classList.remove("active");
    updateSidebarOverlay();
}

function toggleCart() {
    document.getElementById("cartSidebar").classList.toggle("active");
    if (document.getElementById("cartSidebar").classList.contains("active")) {
        document.getElementById("wishlistSidebar").classList.remove("active");
    }
    updateSidebarOverlay();
}

function toggleWishlist() {
    document.getElementById("wishlistSidebar").classList.toggle("active");
    if (document.getElementById("wishlistSidebar").classList.contains("active")) {
        document.getElementById("cartSidebar").classList.remove("active");
    }
    updateSidebarOverlay();
}

function showSection(id) {
    document.querySelectorAll(".view-section").forEach(section => section.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    if (id === 'tracking-view') {
        loadTrackingHistory();
    }
}

// ---------------- STOREFRONT PRODUCTS ----------------
const staticProducts = [
    { name: " Yellow Rose", price: 250, imgUrl: "https://agrogreeninfotech.com/wp-content/uploads/2022/12/Yellow-ROSE-.jpg" },
    { name: "Anthuriium", price: 550, imgUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSh7CIywPIIZ4EvLEWKYHLRebGN3DyEMOzv4iLsf7Gtxg&s" },
    { name: "Mari gold", price: 400, imgUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRmPWthBHg_oMb0bpq8MhZ5UVtRaICF8XywPw&s" },
    { name: " Sun flower", price: 450, imgUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRb0bI0kwXkVajXAWY-_WpnXzriokpfrWe46g&s" },
    { name: "Dianthus", price: 250, imgUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRe8uUs2FBASRNMlBnJwdVc6jWEPIekta3RGkAgmx1tOQ&s" },
    { name: "Hibiscus", price: 200, imgUrl: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTcawOq00WE4QxHZUf-XmkXbYUVUWpqg-1hPr6lx20h3g&s" }
];

function isBlockedProduct(product) {
    if (!product || typeof product.name !== 'string') return false;
    const normalized = product.name.trim().toLowerCase();
    return /test/i.test(product.name) || normalized === 'red rose';
}

async function loadProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/products`);
        const dbProducts = response.ok ? await response.json() : [];
        
        const gridContainer = document.getElementById("plant-grid-container");
        if (!gridContainer) return;

        const allProducts = [...staticProducts, ...dbProducts].filter(product => !isBlockedProduct(product));
        loadedProducts = allProducts;
        wishlist = wishlist.filter(name => allProducts.some(product => product.name === name));

        gridContainer.innerHTML = "";
        allProducts.forEach((product) => {
            const isInWishlist = wishlist.includes(product.name);
            const heartClass = isInWishlist ? "active" : "";
            const heartColor = isInWishlist ? 'style="color: red;"' : 'style="color: #ccc;"';
            
            gridContainer.innerHTML += `
                <div class="product-card">
                    <div class="wishlist-heart ${heartClass}" ${heartColor} onclick="handleWishlistToggle(event, this)" ontouchend="handleWishlistToggle(event, this)" data-name="${product.name}">❤</div>
                    <img src="${product.imgUrl}" alt="${product.name}" class="product-image" onclick="handleWishlistToggle(event, this)" ontouchend="handleWishlistToggle(event, this)" data-name="${product.name}">
                    <div class="product-info">
                        <h3>${product.name}</h3>
                        <p class="product-price">₹${product.price}</p>
                        <button class="add-to-cart-btn" onclick="addToCart('${product.name}', ${product.price})">Add to Cart</button>
                    </div>
                </div>
            `;
        });
    } catch (e) {
        console.error("Error loading products: ", e);
    }
}

async function addNewProduct(event) {
    event.preventDefault();
    const name = document.getElementById("prodName").value.trim();
    const price = parseInt(document.getElementById("prodPrice").value.trim());
    const fileInput = document.getElementById("prodImgFile");
    const imgFile = fileInput.files[0];

    if (!name || isNaN(price) || !imgFile) {
        alert("Please fill out all fields correctly and select an image.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = async function() {
            // Compress image to prevent database bloating
            const canvas = document.createElement("canvas");
            const MAX_WIDTH = 500;
            const MAX_HEIGHT = 500;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                }
            } else {
                if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                }
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, width, height);
            
            // Generate standard WebP base64 string
            const base64Img = canvas.toDataURL("image/webp", 0.8);

            try {
                const response = await fetch(`${API_BASE_URL}/api/products`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, price, imgUrl: base64Img })
                });
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`Failed to add product: ${response.status} ${response.statusText} - ${errorText}`);
                }
                
                alert("Product added successfully!");
                document.getElementById("addProductForm").reset();
                loadProducts(); // Refresh storefront
                showSection('shop-view');
            } catch (err) {
                console.error("Error adding new product: ", err);
                alert("Failed to add product. Please try again. Check the console for details.");
            }
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(imgFile);
}

function handleWishlistToggle(event, element) {
    const name = element.dataset.name;
    if (!name) return;

    if (event.type === 'touchend') {
        wishlistTouchHandled = true;
        setTimeout(() => { wishlistTouchHandled = false; }, 500);
    }

    if (event.type === 'click' && wishlistTouchHandled) {
        return;
    }

    const now = Date.now();
    const lastTap = wishlistLastTap[name] || 0;
    if (now - lastTap < 400) {
        toggleWishlistItem(name, element);
        wishlistLastTap[name] = 0;
    } else {
        wishlistLastTap[name] = now;
    }
}

function showProductInShop(element) {
    const productName = element.dataset.name;
    if (!productName) return;

    showSection('shop-view');
    const productCards = Array.from(document.querySelectorAll('.product-card'));
    const target = productCards.find(card => card.querySelector('h3')?.innerText.trim() === productName.trim());

    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('highlight-card');
        window.setTimeout(() => target.classList.remove('highlight-card'), 2200);
    } else {
        alert(`Product "${productName}" is not available in the store right now.`);
    }
}

// ---------------- CHECKOUT MODAL FLOW ----------------
function openPaymentModal() {
    if (cart.length === 0) {
        alert("Your cart is empty.");
        return;
    }
    checkoutItems = [...cart];
    checkoutTotal = cart.reduce((sum, item) => sum + item.price, 0);
    checkoutSource = "cart";

    document.getElementById("modalTotalAmount").innerText = "₹" + checkoutTotal;
    document.getElementById("paymentModal").classList.add("active");
}

function closePaymentModal() {
    document.getElementById("paymentModal").classList.remove("active");
}

function togglePaymentFields(showCard) {
    const cardFields = document.getElementById("cardDetailsFormFields");
    if (cardFields) {
        cardFields.style.display = showCard ? "block" : "none";
        
        const cardNum = document.getElementById("cardNumber");
        const cardExp = document.getElementById("cardExpiry");
        const cardCvv = document.getElementById("cardCvv");
        if (showCard) {
            cardNum.setAttribute("required", "true");
            cardExp.setAttribute("required", "true");
            cardCvv.setAttribute("required", "true");
        } else {
            cardNum.removeAttribute("required");
            cardExp.removeAttribute("required");
            cardCvv.removeAttribute("required");
        }
    }
}

async function buyNow(name, price) {
    checkoutItems = [{ name: name, price: price }];
    checkoutTotal = price;
    checkoutSource = "single";

    document.getElementById("modalTotalAmount").innerText = "₹" + price;
    document.getElementById("paymentModal").classList.add("active");
}

async function handleCheckoutSubmission(event) {
    event.preventDefault();

    const name = document.getElementById("custName").value.trim();
    const address = document.getElementById("custAddress").value.trim();
    const phone = document.getElementById("custPhone").value.trim();
    const paymentType = document.querySelector('input[name="paymentType"]:checked').value;

    if (!name || !address || !phone) {
        alert("Please fill in Name, Address, and Phone.");
        return;
    }

    if (paymentType === "CARD") {
        const cardNum = document.getElementById("cardNumber").value.trim();
        const cardExp = document.getElementById("cardExpiry").value.trim();
        const cardCvv = document.getElementById("cardCvv").value.trim();
        if (!cardNum || !cardExp || !cardCvv) {
            alert("Please fill in all card details.");
            return;
        }
    }

    try {
        const docRef = await addDoc(collection(db, "orders"), {
            customerName: name,
            address: address,
            phone: phone,
            paymentMethod: paymentType,
            items: checkoutItems,
            totalPrice: checkoutTotal,
            status: "Order Placed",
            timestamp: new Date()
        });

        alert("Order placed successfully! Tracking ID: " + docRef.id);

        if (checkoutSource === "cart") {
            cart = [];
            updateStorage();
            toggleCart();
        }

        document.getElementById("paymentForm").reset();
        togglePaymentFields(false);
        closePaymentModal();

        showSection("tracking-view");
        document.getElementById("trackingInput").value = docRef.id;
        trackOrder();
        loadAdminOrders();
    } catch (e) {
        console.error("Error creating order in Firestore: ", e);
        alert("Failed to place order. Please try again.");
    }
}

// ---------------- ORDER TRACKING ----------------
async function trackOrder() {
    const trackingId = document.getElementById("trackingInput").value.trim();
    const resultDiv = document.getElementById("trackingResultDisplay");
    if (!trackingId) return alert("Enter Tracking ID");

    try {
        const docRef = doc(db, "orders", trackingId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            resultDiv.style.display = "block";
            
            let itemsString = "";
            if (Array.isArray(data.items)) {
                itemsString = data.items.map(i => i.name || i).join(', ');
            } else if (typeof data.items === 'string') {
                itemsString = data.items;
            } else {
                itemsString = "Unknown Product";
            }

            const currentStatus = data.status || "Order Placed";
            
            let timelineHtml = "";
            if (currentStatus === "Cancelled") {
                timelineHtml = `
                    <div class="tracking-flow" style="justify-content: center;">
                        <div class="flow-step cancelled-step" style="width: 100%;">
                            <div class="flow-dot">✖</div>
                            <strong>This Order Has Been Cancelled</strong>
                        </div>
                    </div>
                `;
            } else {
                timelineHtml = `
                    <div class="tracking-flow">
                        <div class="flow-step ${isStepActive("Order Placed", currentStatus) ? 'active-step' : ''}">
                            <div class="flow-dot">1</div>
                            Order Placed
                        </div>
                        <div class="flow-step ${isStepActive("Packed", currentStatus) ? 'active-step' : ''}">
                            <div class="flow-dot">2</div>
                            Packed
                        </div>
                        <div class="flow-step ${isStepActive("In Transit", currentStatus) ? 'active-step' : ''}">
                            <div class="flow-dot">3</div>
                            In Transit
                        </div>
                        <div class="flow-step ${isStepActive("Delivered", currentStatus) ? 'active-step' : ''}">
                            <div class="flow-dot">4</div>
                            Delivered
                        </div>
                    </div>
                `;
            }

            resultDiv.innerHTML = `
                <h3 style="margin-top: 0; color: var(--primary-color); border-bottom: 2px solid var(--light-bg); padding-bottom: 10px;">Order Reference: ${trackingId}</h3>
                <div style="margin: 15px 0;">
                    <p style="margin: 8px 0;"><strong>Recipient Name:</strong> ${data.customerName || 'Guest'}</p>
                    <p style="margin: 8px 0;"><strong>Shipping Destination:</strong> ${data.address || 'Not Provided'}</p>
                    <p style="margin: 8px 0;"><strong>Contact Number:</strong> ${data.phone || 'Not Provided'}</p>
                    <p style="margin: 8px 0;"><strong>Plants Package Inventory:</strong> ${itemsString}</p>
                    <p style="margin: 8px 0;"><strong>Total Value Due:</strong> ₹${data.totalPrice || data.total || 0} via [${data.paymentMethod || 'COD'}]</p>
                    <p style="margin: 8px 0;"><strong>Fulfillment State:</strong> <span class="badge ${getStatusBadgeClass(currentStatus)}">${currentStatus}</span></p>
                </div>
                ${timelineHtml}
            `;
        } else {
            resultDiv.style.display = "none";
            alert("Order not found!");
        }
    } catch (e) {
        console.error("Error tracking order: ", e);
        alert("Failed to fetch tracking details.");
    }
}

async function loadTrackingHistory() {
    const historyContainer = document.getElementById('orderHistoryList');
    if (!historyContainer) return;
    historyContainer.innerHTML = '<p style="color:#666;">Loading recent orders...</p>';

    try {
        const querySnapshot = await getDocs(collection(db, 'orders'));
        const orders = [];
        querySnapshot.forEach((docSnap) => {
            orders.push({ id: docSnap.id, ...docSnap.data() });
        });

        orders.sort((a, b) => getOrderTimestamp(a) - getOrderTimestamp(b));

        if (orders.length === 0) {
            historyContainer.innerHTML = '<p style="color:#666;">No tracked orders yet.</p>';
            return;
        }

        historyContainer.innerHTML = orders.map(order => {
            const itemsString = Array.isArray(order.items)
                ? order.items.map(i => i.name || i).join(', ')
                : typeof order.items === 'string'
                    ? order.items
                    : 'Unknown product(s)';
            return `
                <button class="order-history-card" onclick="selectOrder('${order.id}')">
                    <div><strong>ID:</strong> ${order.id}</div>
                    <div><strong>Items:</strong> ${itemsString}</div>
                    <div><strong>Status:</strong> ${order.status || 'Order Placed'}</div>
                </button>
            `;
        }).join('');
    } catch (e) {
        console.error('Error loading order history:', e);
        historyContainer.innerHTML = '<p style="color:red;">Failed to load order history.</p>';
    }
}

function selectOrder(orderId) {
    document.getElementById('trackingInput').value = orderId;
    trackOrder();
}

function getStatusBadgeClass(status) {
    switch (status) {
        case "Order Placed": return "badge-placed";
        case "Packed": return "badge-shipping";
        case "In Transit": return "badge-shipping";
        case "Delivered": return "badge-delivered";
        default: return "badge-placed";
    }
}

function isStepActive(stepName, currentStatus) {
    const sequence = ["Order Placed", "Packed", "In Transit", "Delivered"];
    const stepIndex = sequence.indexOf(stepName);
    const currentIndex = sequence.indexOf(currentStatus);
    return currentIndex >= stepIndex;
}

// ---------------- ADMIN PANEL ----------------
async function loadAdminOrders() {
    console.log("Loading orders...");
    try {
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js");
        const querySnapshot = await getDocs(collection(db, "orders"));
        const tableBody = document.getElementById("adminOrdersTableBody");
        tableBody.innerHTML = ""; 

        const orders = [];
        querySnapshot.forEach((docSnapshot) => {
            orders.push({ id: docSnapshot.id, ...docSnapshot.data() });
        });

        orders.sort((a, b) => getOrderTimestamp(a) - getOrderTimestamp(b));

        orders.forEach((order) => {
            const itemsString = Array.isArray(order.items)
                ? order.items.map(i => i.name || i).join(', ')
                : typeof order.items === 'string'
                    ? order.items
                    : 'Unknown Product';

            const orderStatus = order.status || "Order Placed";

            tableBody.innerHTML += `
                <tr>
                    <td>${order.id}</td>
                    <td>${order.customerName || 'Guest'}</td>
                    <td>
                        <div style="font-size: 12px; line-height: 1.4;">
                            📞 ${order.phone || 'N/A'}<br>
                            📍 ${order.address || 'N/A'}
                        </div>
                    </td>
                    <td>${itemsString}</td>
                    <td>₹${order.totalPrice || order.total || 0}</td>
                    <td>${order.paymentMethod || 'COD'}</td>
                    <td><span class="badge ${getStatusBadgeClass(orderStatus)}">${orderStatus}</span></td>
                    <td>
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <select onchange="updateOrderStatus('${order.id}', this.value)" style="padding: 5px; border-radius: 4px; border: 1px solid #ccc;">
                                <option value="Order Placed" ${orderStatus === 'Order Placed' ? 'selected' : ''}>Order Placed</option>
                                <option value="Packed" ${orderStatus === 'Packed' ? 'selected' : ''}>Packed</option>
                                <option value="In Transit" ${orderStatus === 'In Transit' ? 'selected' : ''}>In Transit</option>
                                <option value="Delivered" ${orderStatus === 'Delivered' ? 'selected' : ''}>Delivered</option>
                                <option value="Cancelled" ${orderStatus === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                            <button onclick="deleteOrder('${order.id}')" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; border-radius: 4px; cursor: pointer;" title="Delete Order">🗑️</button>
                        </div>
                    </td>
                </tr>
            `;
        });
    } catch (e) {
        console.error("Error loading orders: ", e);
    }
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        const docRef = doc(db, "orders", orderId);
        await updateDoc(docRef, { status: newStatus });
        alert(`Status updated successfully for ${orderId}`);
        loadAdminOrders();
    } catch (e) {
        console.error("Error updating order: ", e);
        alert("Failed to update order status.");
    }
}

async function deleteOrder(orderId) {
    if (!confirm("Are you sure you want to permanently delete this order?")) return;
    try {
        const docRef = doc(db, "orders", orderId);
        await deleteDoc(docRef);
        alert(`Order ${orderId} has been deleted.`);
        loadAdminOrders();
    } catch (e) {
        console.error("Error deleting order: ", e);
        alert("Failed to delete order.");
    }
}

function getOrderTimestamp(order) {
    if (!order || order.timestamp == null) return 0;
    if (order.timestamp.toDate) return order.timestamp.toDate().getTime();
    if (order.timestamp instanceof Date) return order.timestamp.getTime();
    const parsed = Date.parse(order.timestamp);
    return Number.isNaN(parsed) ? 0 : parsed;
}

async function deleteAllOrders() {
    if (!confirm("Delete all tracked orders permanently? This cannot be undone.")) return;
    try {
        const querySnapshot = await getDocs(collection(db, "orders"));
        const deletePromises = [];
        querySnapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, "orders", docSnap.id)));
        });
        await Promise.all(deletePromises);
        alert("All orders have been deleted.");
        clearTrackingResult();
        loadAdminOrders();
        loadTrackingHistory();
    } catch (e) {
        console.error("Error deleting all orders: ", e);
        alert("Failed to delete all orders.");
    }
}

function clearTrackingResult() {
    const resultDiv = document.getElementById("trackingResultDisplay");
    const trackingInput = document.getElementById("trackingInput");
    if (resultDiv) {
        resultDiv.style.display = "none";
        resultDiv.innerHTML = "";
    }
    if (trackingInput) {
        trackingInput.value = "";
    }
}

// ---------------- RENDER UI ----------------
function renderUI() {
    const cartCount = document.getElementById("cart-count");
    const wishCount = document.getElementById("wishlist-count");
    
    if (cartCount) cartCount.innerText = cart.length;
    if (wishCount) wishCount.innerText = wishlist.length;

    const cartList = document.getElementById("cartItemsList");
    if (cartList) {
        cartList.innerHTML = cart.length === 0 ? "<p>Your cart is empty.</p>" : cart.map((item, index) => `
            <div style="margin-bottom:15px; border-bottom:1px solid #ddd; padding-bottom:10px;">
                <div>${item.name} - ₹${item.price}</div>
                <button onclick="removeFromCart(${index})" style="color:red; cursor:pointer;">Remove</button>
                <button onclick="buyNow('${item.name}', ${item.price})" style="background:green; color:white; cursor:pointer;">Buy Now</button>
            </div>
        `).join('');
    }

    const wishList = document.getElementById("wishlistItemsList");
    if (wishList) {
        wishList.innerHTML = wishlist.map(item => `
            <div class="wishlist-item-entry" data-name="${item}" onclick="showProductInShop(this)" style="padding:10px; border-bottom:1px solid #ccc; cursor:pointer;">
                <span style="color:red; margin-right:8px;">❤</span>
                <span style="text-decoration:underline;">${item}</span>
            </div>
        `).join('');
    }

    const totalVal = document.getElementById("cartTotalValue");
    if (totalVal) {
        totalVal.innerText = "₹" + cart.reduce((sum, item) => sum + item.price, 0);
    }
}

// --- EXPOSE ALL FUNCTIONS TO WINDOW ---
window.loadAdminOrders = loadAdminOrders;
window.toggleCart = toggleCart;
window.toggleWishlist = toggleWishlist;
window.showSection = showSection;
window.buyNow = buyNow;
window.trackOrder = trackOrder;
window.removeFromCart = removeFromCart;
window.addToCart = addToCart;
window.toggleWishlistItem = toggleWishlistItem;
window.handleWishlistToggle = handleWishlistToggle;
window.showProductInShop = showProductInShop;
window.openPaymentModal = openPaymentModal;
window.closePaymentModal = closePaymentModal;
window.togglePaymentFields = togglePaymentFields;
window.handleCheckoutSubmission = handleCheckoutSubmission;
window.closeSidebars = closeSidebars;
window.updateOrderStatus = updateOrderStatus;
window.deleteOrder = deleteOrder;
window.deleteAllOrders = deleteAllOrders;
window.loadProducts = loadProducts;
window.addNewProduct = addNewProduct;
window.selectOrder = selectOrder;

document.addEventListener("DOMContentLoaded", () => {
    renderUI();
    loadProducts();
    updateSidebarOverlay();
});

