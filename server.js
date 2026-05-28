const express = require('express');
const admin = require('firebase-admin');
const path = require('path');
const app = express();

const PORT = process.env.PORT || 3000;

// =========================================================================
// 1. FIREBASE INITIALIZATION
// =========================================================================
// Support providing the service account via an environment variable (SERVICE_ACCOUNT_JSON)
// or falling back to a local serviceAccountKey.json for local dev. This avoids committing
// secrets into source when deploying to cloud hosts.
let serviceAccount;
if (process.env.SERVICE_ACCOUNT_JSON) {
    try {
        serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_JSON);
    } catch (e) {
        console.error('Invalid SERVICE_ACCOUNT_JSON:', e);
        process.exit(1);
    }
} else {
    serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));
}

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DATABASE_URL || "https://the-green-world-aa2f9-default-rtdb.firebaseio.com/"
});

const db = admin.database();
const firestoreDb = admin.firestore();

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// =========================================================================
// 2. BACKEND API ENDPOINTS
// =========================================================================

// API: Submit a new order into Firebase
app.post('/api/orders', async (expressReq, expressRes) => {
    const { customerName, items, total, paymentMethod, address, phone } = expressReq.body;
    
    if (!customerName || !items || !total || !paymentMethod) {
        return expressRes.status(400).json({ error: "Missing required order fields" });
    }

    const orderId = 'ORD-' + Math.floor(100000 + Math.random() * 900000);

    const newOrder = {
        id: orderId, 
        customerName,
        items,
        total,
        paymentMethod,
        address: address || "Not Provided",
        phone: phone || "Not Provided",
        status: "Order Placed",
        date: new Date().toISOString()
    };

    try {
        await db.ref(`orders/${orderId}`).set(newOrder);
        expressRes.status(201).json({ success: true, order: newOrder });
    } catch (error) {
        console.error("Firebase write error:", error);
        expressRes.status(500).json({ error: "Failed to submit order to database" });
    }
});

// API: Track an individual order item by its ID parameters
app.get('/api/orders/track/:id', async (expressReq, expressRes) => {
    const trackingId = expressReq.params.id;

    try {
        const snapshot = await db.ref(`orders/${trackingId}`).once('value');
        if (!snapshot.exists()) {
            return expressRes.status(404).json({ error: "Tracking ID not found" });
        }
        expressRes.json(snapshot.val());
    } catch (error) {
        console.error("Firebase tracking fetch error:", error);
        expressRes.status(500).json({ error: "Error communicating with database" });
    }
});

// API: Retrieve all orders for the Admin Dashboard Table View
app.get('/api/orders', async (expressReq, expressRes) => {
    try {
        const snapshot = await db.ref('orders').once('value');
        if (snapshot.exists()) {
            const ordersData = snapshot.val();
            const ordersArray = Object.values(ordersData);
            expressRes.json(ordersArray);
        } else {
            expressRes.json([]);
        }
    } catch (error) {
        console.error("Firebase fetch error:", error);
        expressRes.status(500).json({ error: "Failed to retrieve orders from database" });
    }
});

// API: Update order tracking status (Admin Control Layer)
app.patch('/api/orders/:id/status', async (expressReq, expressRes) => {
    const orderId = expressReq.params.id;
    const { status } = expressReq.body;

    try {
        const orderRef = db.ref(`orders/${orderId}`);
        const snapshot = await orderRef.once('value');

        if (!snapshot.exists()) {
            return expressRes.status(404).json({ error: "Order not found" });
        }
        
        await orderRef.update({ status: status });
        const updatedSnapshot = await orderRef.once('value');
        expressRes.json({ success: true, order: updatedSnapshot.val() });
    } catch (error) {
        console.error("Firebase status update error:", error);
        expressRes.status(500).json({ error: "Failed to update order status" });
    }
});

// API: Get all products from Firestore
app.get('/api/products', async (req, res) => {
    try {
        const snapshot = await firestoreDb.collection('products').get();
        // No auto-seeding; static products are now handled by frontend
        const products = [];
        snapshot.forEach(doc => products.push({ id: doc.id, ...doc.data() }));
        res.json(products);
    } catch (e) {
        console.error("Firestore get products error:", e);
        res.status(500).json({ error: "Failed to load products" });
    }
});

// API: Add a new product to Firestore
app.post('/api/products', async (req, res) => {
    try {
        const { name, price, imgUrl } = req.body;
        if (!name || typeof price !== 'number' || !imgUrl) {
            return res.status(400).json({ error: 'Invalid product data' });
        }
        const docRef = await firestoreDb.collection('products').add({ name, price, imgUrl });
        res.status(201).json({ success: true, id: docRef.id });
    } catch (e) {
        console.error("Firestore add product error:", e);
        res.status(500).json({ error: "Failed to add product" });
    }
});

// =========================================================================
// 3. FRONTEND STATIC FILE SERVING
// =========================================================================

// Serve static files (HTML, CSS, JS, etc.) from the workspace root
app.use(express.static(__dirname));

// Direct any root request to index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server Engine
app.listen(PORT, () => {
    console.log(`Server running smoothly on port ${PORT} with Firebase cloud connected!`);
});