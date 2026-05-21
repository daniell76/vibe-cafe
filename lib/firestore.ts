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
  additions?: string[];
  extraShots?: number;
  artLabel?: string;
  happyPlace: string;
  imageUrl: string;
  vibeImageUrl?: string;
  status?: string;
  orderNumber?: number;
  createdAt?: string;
}

export type VibeImageAspect = '16:9' | '4:3';

export interface AppSettings {
  appName: string;
  tagline: string;
  systemPrompt: string;
  drinks: string[];
  milks: string[];
  flavors: string[];
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };
  promptTemplate: string;
  vibeImageAspect: VibeImageAspect;
  vibePromptTemplate: string;
  defaultDrink: string;
  defaultMilk: string;
  defaultAddition: string;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Vibe Café',
  tagline: 'Experience the Future of Coffee',
  systemPrompt:
    'You are the barista AI for Vibe Café. Your goal is to guide users through selecting the perfect coffee blend based on their mood.',
  drinks: ['Espresso', 'Americano', 'Latte', 'Cappuccino', 'Flat White', 'Cortado', 'Macchiato', 'Mocha', 'Cold Brew'],
  milks: ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'],
  flavors: ['Vanilla', 'Caramel', 'Hazelnut', 'Sugar Free', 'None'],
  instructions: {
    step1: 'Personalise your perfect brew',
    step2: 'Choose a generative pattern for your latte art. Our barista bots will precision-etch this design using micro-foam projection.',
    step3: 'Please review your selections before finalising.',
  },
  promptTemplate:
    'A flat, single-layer high-contrast sepia-on-white stencil illustration of {happyPlace}. ' +
    'Render the subject as a single isolated shape — or a small group of clearly disconnected shapes — drifting on an empty pure-white square canvas. ' +
    'The subject occupies roughly the middle 50% of the canvas. ' +
    'The entire outer 25% margin on every side — and especially all four corners — is uniform RGB(255,255,255) pure-white empty pixels with no marks, no shading, no gradient, no texture. ' +
    'Absolutely nothing surrounds the subject: no enclosing shape, no border, no frame, no medallion, no badge, no emblem, no coin, no disc, no plate, no roundel, no halo, no aura, no glow, no vignette, no decorative scrollwork, no leaves around the subject, no background scenery, no coffee cup, no saucer. ' +
    'Clean bold edges, highly graphic, no 3D shading, no photorealism.',
  vibeImageAspect: '16:9',
  vibePromptTemplate:
    'A stunning, delightful, magazine-quality photograph capturing the essence of: {happyPlace}. ' +
    'Cinematic composition, warm and inviting natural lighting, rich texture and depth, professional photography, ' +
    'soothing and aesthetic atmosphere, sharp focus, full-bleed wallpaper-ready framing.\n\n' +
    'People rule: include human figures ONLY when the description explicitly is about a person, a named individual, a group of people, ' +
    'or when it explicitly mentions a crowd, gathering, festival, parade, audience, concert, wedding, party, dance, performance, ' +
    'busy/bustling/crowded scene, shoppers, market vendors, players, dancers, performers, or similar group activity. ' +
    'For all other subjects — quiet places, landmarks, objects, plants, food, animals, vehicles, scenery, still life — render the scene ' +
    'completely free of incidental human figures: no bystanders, no pedestrians, no tiny crowd figures in the background, no silhouettes of people, no faces. ' +
    'The photograph should look as if captured during a perfect, deliberate moment.\n\n' +
    'No text, no watermark.',
  defaultDrink: 'Latte',
  defaultMilk: 'None',
  defaultAddition: 'None',
};

export async function saveOrder(orderData: OrderData): Promise<string> {
  const collection = firestore.collection(collectionName);
  const payload: Record<string, unknown> = {
    ...orderData,
    status: orderData.status || 'pending',
    createdAt: orderData.createdAt || new Date().toISOString(),
  };
  for (const k of Object.keys(payload)) {
    if (payload[k] === undefined) delete payload[k];
  }
  const docRef = await collection.add(payload);
  return docRef.id;
}

export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).update({ status });
}

export async function updateOrderFields(orderId: string, fields: Record<string, unknown>): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).update(fields);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const collection = firestore.collection(collectionName);
  await collection.doc(orderId).delete();
}

// Wipe every order document and reset the order-number counter.
// Returns { deletedOrders, imageUrls } so the caller can also clean storage.
export async function deleteAllOrders(): Promise<{ deletedOrders: number; imageUrls: string[] }> {
  const orders = firestore.collection(collectionName);
  const snapshot = await orders.get();
  const imageUrls: string[] = [];

  // Collect URLs first so we can return them to the caller for GCS cleanup.
  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    if (typeof data.imageUrl === 'string') imageUrls.push(data.imageUrl);
    if (typeof data.vibeImageUrl === 'string') imageUrls.push(data.vibeImageUrl);
  }

  // Firestore batches cap at 500 ops.
  const CHUNK = 450;
  for (let i = 0; i < snapshot.docs.length; i += CHUNK) {
    const batch = firestore.batch();
    for (const d of snapshot.docs.slice(i, i + CHUNK)) batch.delete(d.ref);
    await batch.commit();
  }

  // Reset the order-number counter so the next order starts at 1.
  const counterRef = firestore.collection('config').doc('counters');
  await counterRef.set({ orderSequence: 0 }, { merge: true });

  return { deletedOrders: snapshot.size, imageUrls };
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
  const stored = (doc.data() || {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    instructions: { ...DEFAULT_SETTINGS.instructions, ...(stored.instructions || {}) },
  };
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
