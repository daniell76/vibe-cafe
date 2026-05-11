import { Firestore } from '@google-cloud/firestore';

const project = process.env.GOOGLE_CLOUD_PROJECT || 'your-project-id';
const collectionName = process.env.VIBE_CAFE_COLLECTION || 'orders';

const firestore = new Firestore({ projectId: project });

export interface OrderData {
  name: string;
  coffeeOrder: string;
  happyPlace: string;
  imageUrl: string;
}

export async function saveOrder(orderData: OrderData): Promise<string> {
  const collection = firestore.collection(collectionName);
  const docRef = await collection.add({
    ...orderData,
    createdAt: new Date().toISOString(),
  });

  return docRef.id;
}
