const express = require('express');
const admin = require('firebase-admin');
const fs = require('fs');
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
    try {
        fs.appendFileSync(path.join(__dirname, 'req.log'), `${new Date().toISOString()} ${req.method} ${req.url}\n`);
    } catch (e) {
        console.error('Request log write failed:', e);
    }
    console.log('REQ', req.method, req.url);
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

const apiRouter = express.Router();

// API: Submit a new order into Firebase
apiRouter.post('/orders', async (expressReq, expressRes) => {
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
apiRouter.get('/orders/track/:id', async (expressReq, expressRes) => {
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
apiRouter.get('/orders', async (expressReq, expressRes) => {
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
apiRouter.patch('/orders/:id/status', async (expressReq, expressRes) => {
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
apiRouter.get('/products', async (req, res) => {
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
apiRouter.post('/products', async (req, res) => {
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

// API: Update an existing product in Firestore
apiRouter.put('/products/:id', async (req, res) => {
    try {
        try {
            fs.appendFileSync(path.join(__dirname, 'req.log'), `${new Date().toISOString()} PUT /api/products/${req.params.id} body=${JSON.stringify(req.body)}\n`);
        } catch (e) {
            console.error('Put log write failed:', e);
        }
        console.log('PUT /api/products/:id called', req.params.id, 'body:', req.body);
        const { name, price, imgUrl } = req.body;
        const productId = req.params.id;
        
        if (!name || typeof price !== 'number') {
            return res.status(400).json({ error: 'Invalid product data' });
        }

        const docRef = firestoreDb.collection('products').doc(productId);
        const docSnap = await docRef.get();
        if (!docSnap.exists) {
            return res.status(404).json({ error: 'Product not found' });
        }

        const updateData = { name, price };
        if (imgUrl) updateData.imgUrl = imgUrl;

        await docRef.update(updateData);
        res.json({ success: true, id: productId });
    } catch (e) {
        console.error("Firestore update product error:", e);
        res.status(500).json({ error: "Failed to update product" });
    }
});

// API: Delete a product from Firestore
apiRouter.delete('/products/:id', async (req, res) => {
    try {
        const productId = req.params.id;
        await firestoreDb.collection('products').doc(productId).delete();
        res.json({ success: true, message: "Product deleted successfully" });
    } catch (e) {
        console.error("Firestore delete product error:", e);
        res.status(500).json({ error: "Failed to delete product" });
    }
});

// API: Update order details (admin modification)
apiRouter.put('/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        const { customerName, address, phone } = req.body;
        
        const docRef = firestoreDb.collection('orders').doc(orderId);
        const updateData = {};
        if (customerName) updateData.customerName = customerName;
        if (address) updateData.address = address;
        if (phone) updateData.phone = phone;
        
        await docRef.update(updateData);
        const updatedDoc = await docRef.get();
        res.json({ success: true, order: updatedDoc.data() });
    } catch (e) {
        console.error("Firestore update order error:", e);
        res.status(500).json({ error: "Failed to update order" });
    }
});

// API: Delete an order from Firestore
apiRouter.delete('/orders/:id', async (req, res) => {
    try {
        const orderId = req.params.id;
        await firestoreDb.collection('orders').doc(orderId).delete();
        res.json({ success: true, message: "Order deleted successfully" });
    } catch (e) {
        console.error("Firestore delete order error:", e);
        res.status(500).json({ error: "Failed to delete order" });
    }
});

// =========================================================================
// 3. FRONTEND STATIC FILE SERVING
// =========================================================================

const registeredApiRoutes = apiRouter.stack
    .filter(layer => layer.route)
    .map(layer => `${Object.keys(layer.route.methods).map(method => method.toUpperCase()).join(',')} ${layer.route.path}`);
console.log('Registered API routes:', registeredApiRoutes);

// Mount API router at /api
app.use('/api', apiRouter);

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