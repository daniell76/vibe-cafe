import { Firestore } from '@google-cloud/firestore';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const collectionName = process.env.VIBE_CAFE_COLLECTION || 'orders';

if (!project) {
  console.warn('WARNING: GOOGLE_CLOUD_PROJECT is not set for Firestore.');
}

const firestore = new Firestore({
  projectId: project,
  preferRest: true, 
});

export interface OrderData {
  name: string;
  coffeeOrder: string;
  milk?: string;
  flavor?: string;
  happyPlace: string;
  imageUrl: string;
  status?: string;
  orderNumber?: number;
  createdAt?: string;
}

export interface AppSettings {
  drinks: string[];
  milks: string[];
  flavors: string[];
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };
  promptTemplate: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  drinks: ['Latte', 'Cappuccino', 'Flat White', 'Americano', 'Mocha'],
  milks: ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'],
  flavors: ['Vanilla', 'Caramel', 'Hazelnut', 'None'],
  instructions: {
    step1: 'Select your drink base',
    step2: 'Choose milk & flavoring',
    step3: 'Describe your happy place'
  },
  promptTemplate: '{happyPlace}. High-contrast sepia color pattern, simple abstract minimalist style optimized for foam printing, minimal fine details. Isolated subject on pure white background, 1:1 aspect ratio square dimension. Strictly no mug, no cup.'
};

export async function saveOrder(orderData: OrderData): Promise<string> {
  const collection = firestore.collection(collectionName);
  const docRef = await collection.add({
    ...orderData,
    status: orderData.status || 'pending',
    createdAt: orderData.createdAt || new Date().toISOString(),
  });

  return docRef.id;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).update({ status });
}

export async function deleteOrder(orderId: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).delete();
}

export async function getOrder(orderId: string): Promise<Record<string, unknown> | null> {
  const collection = firestore.collection(collectionName);
  const doc = await collection.doc(orderId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

export async function getOrders(limit = 20): Promise<Record<string, unknown>[]> {
  const collection = firestore.collection(collectionName);
  // Sort by creation date descending if possible, fallback to standard fetch
  const snapshot = await collection.limit(limit).get();
  const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Record<string, unknown>));
  // In-memory sort to handle potential index absence safely
  return docs.sort((a, b) => {
    const dateA = String(a.createdAt || '');
    const dateB = String(b.createdAt || '');
    return dateB.localeCompare(dateA);
  });
}

export async function getOrderByNumber(orderNumber: number): Promise<Record<string, unknown> | null> {
  const collection = firestore.collection(collectionName);
  const snapshot = await collection.where('orderNumber', '==', orderNumber).limit(1).get();
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}

export async function getSettings(): Promise<AppSettings> {
  const configRef = firestore.collection('config').doc('settings');
  const doc = await configRef.get();
  if (!doc.exists) {
    await configRef.set(DEFAULT_SETTINGS);
    return DEFAULT_SETTINGS;
  }
  return doc.data() as AppSettings;
}

export async function updateSettings(settings: Partial<AppSettings>): Promise<void> {
  const configRef = firestore.collection('config').doc('settings');
  await configRef.set(settings, { merge: true });
}

export async function getNextOrderNumber(): Promise<number> {
  const counterRef = firestore.collection('config').doc('counters');
  
  try {
    return await firestore.runTransaction(async (transaction) => {
      const doc = await transaction.get(counterRef);
      let nextNumber = 1;
      
      if (doc.exists) {
        const data = doc.data();
        nextNumber = (data?.orderSequence || 0) + 1;
      }
      
      if (nextNumber > 999) {
        nextNumber = 1;
      }
      
      transaction.set(counterRef, { orderSequence: nextNumber }, { merge: true });
      return nextNumber;
    });
  } catch (err) {
    console.error('Transaction counter failure, defaulting to random sequence:', err);
    return Math.floor(Math.random() * 900) + 100;
  }
}
