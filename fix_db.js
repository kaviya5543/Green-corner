const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'serviceAccountKey.json'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const firestoreDb = admin.firestore();

async function fixDb() {
    try {
        console.log("Deleting all products...");
        const snapshot = await firestoreDb.collection('products').get();
        for (const doc of snapshot.docs) {
            await doc.ref.delete();
        }
        console.log("Done clearing DB!");
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

fixDb();
