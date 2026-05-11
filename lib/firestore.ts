import { Firestore } from '@google-cloud/firestore';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const collectionName = process.env.VIBE_CAFE_COLLECTION || 'orders';

if (!project) {
  console.warn('WARNING: GOOGLE_CLOUD_PROJECT is not set for Firestore.');
}

const firestore = new Firestore({
  projectId: project,
  // Adding explicit settings to help with gRPC connection issues
  preferRest: true, 
});

export interface OrderData {
  name: string;
  coffeeOrder: string;
  happyPlace: string;
  imageUrl: string;
  status?: string;
}

export async function saveOrder(orderData: OrderData): Promise<string> {
  const collection = firestore.collection(collectionName);
  const docRef = await collection.add({
    ...orderData,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });

  return docRef.id;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).update({ status });
}

export async function getOrders(limit = 10): Promise<Record<string, unknown>[]> {
  const collection = firestore.collection(collectionName);
  // Temporarily removing orderBy to check if it's causing the "undefined" error (missing index)
  const snapshot = await collection.limit(limit).get();
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
