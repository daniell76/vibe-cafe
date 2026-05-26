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
  // Stamped server-side by updateOrderStatus when status flips to the
  // matching value. Tracking pages use these to expire picked-up orders and
  // to time the "ready" popup.
  completedAt?: string;
  pickedUpAt?: string;
}

export type VibeImageAspect = '16:9' | '4:3';

export interface DrinkCategory {
  name: string;
  items: string[];
}

export interface AppSettings {
  appName: string;
  tagline: string;
  systemPrompt: string;
  drinkCategories: DrinkCategory[];
  milks: string[];
  flavors: string[];
  additionsEnabled: boolean;
  extraShotsEnabled: boolean;
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };
  aiInspirationHint: string;
  aiInspirationPlaceholder: string;
  // Foam art pipeline (B1): brainstorm 4 concepts, then render one icon each.
  foamBrainstormTemplate: string;       // instructions for the brainstorm step
  promptTemplate: string;               // per-icon render template — placeholders: {concept}, {happyPlace}
  vibeImageAspect: VibeImageAspect;
  // Vibe image pipeline (B2): extract mood (no subject nouns), render abstract wallpaper.
  vibeMoodTemplate: string;             // instructions for the mood-extraction step
  vibePromptTemplate: string;           // render template — placeholders: {mood}, {happyPlace}
  defaultDrink: string;
  defaultMilk: string;
  defaultAddition: string;
  // How many landscape tracking screens the store has. Each one renders a
  // contiguous slice of the global sorted queue at /tracking/<n>.
  trackingScreens: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  appName: 'Vibe Café',
  tagline: 'Experience the Future of Coffee',
  systemPrompt:
    'You are the barista AI for Vibe Café. Your goal is to guide users through selecting the perfect coffee blend based on their mood.',
  // Pre-seeded per the PDF brief slide 8 (Signature Drinks / Coffees / Teas).
  // The customer dropdown groups items by these categories.
  drinkCategories: [
    { name: 'Signature Drinks', items: ['Signature Drink 1', 'Signature Drink 2'] },
    { name: 'Coffees', items: ['Espresso', 'Americano', 'Latte', 'Cappuccino', 'Flat White', 'Matcha Latte', 'Iced Cappuccino', 'Hot Chocolate'] },
    { name: 'Teas', items: ['English Breakfast Tea', 'Earl Grey Tea', 'Peppermint Tea', 'Green Tea'] },
  ],
  milks: ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'],
  flavors: ['Vanilla', 'Caramel', 'Hazelnut', 'Sugar Free', 'None'],
  // Both default OFF per page-10 comment ("for this event there is no additions or
  // extra shots option"). Admin can flip either on; items are pre-populated so the
  // operator just toggles to enable.
  additionsEnabled: false,
  extraShotsEnabled: false,
  instructions: {
    step1: 'Personalise your perfect brew',
    step2: 'Choose a generative pattern for your latte art. Our barista bots will precision-etch this design using micro-foam projection.',
    step3: 'Please review your selections before finalising.',
  },
  aiInspirationHint: "What's your favourite hobby, music or destination? We'll use this to style your cup art.",
  aiInspirationPlaceholder: 'I like soul music and especially the music of Aretha Franklin.',
  foamBrainstormTemplate:
    'You generate concept ideas for printable coffee-foam icons. Given a user\'s "happy place" description, return EXACTLY 4 distinct, simple, iconic objects or symbols inspired by — but not directly referencing — the subject. Each concept must be a single recognisable object that can be rendered as a clean black-and-white silhouette icon.\n\n' +
    'Rules:\n' +
    '- 4 distinct concepts, each a short noun phrase (max ~3 words).\n' +
    '- Avoid the subject\'s name itself, brand names, logos, or text.\n' +
    '- Avoid abstract concepts ("freedom", "joy") — pick concrete renderable objects.',
  promptTemplate:
    'A simple, bold, black-on-white silhouette icon of: {concept}. ' +
    'Inspired by, but not directly referencing: {happyPlace}. ' +
    'Single isolated icon centered on a pure white square canvas with substantial empty white margins on all sides. ' +
    'Clean thick lines, high contrast, no text, no words, no logos, no faces, no people, no 3D shading, no photorealism, no background, no decorative frame or ring around the icon.',
  vibeImageAspect: '16:9',
  vibeMoodTemplate:
    'Given a user\'s "happy place" description, extract its emotional ATMOSPHERE into a short, evocative paragraph (60-80 words). Describe colors, light, texture, energy, mood, era, time of day, weather — anything that captures the FEELING of the subject without naming the subject itself.\n\n' +
    'Strictly do NOT mention:\n' +
    '- The original subject\'s name, nouns, people, places, brands, instruments, objects, animals, body parts, buildings, vehicles, food items.\n' +
    '- Verbs of action involving people or things.\n\n' +
    'DO use:\n' +
    '- Color palette words ("warm amber", "deep crimson and gold", "soft sage")\n' +
    '- Light/atmosphere words ("dappled afternoon sun", "neon haze", "candlelight glow")\n' +
    '- Texture words ("velvet", "rough plaster", "molten metal")\n' +
    '- Energy/mood words ("urgent", "languid", "exuberant", "contemplative")',
  vibePromptTemplate:
    'An abstract wallpaper that captures this atmosphere: {mood} ' +
    'Choose ONE of two visual languages based on what best fits the mood: ' +
    '(A) crisp 3D sculptural composition — intersecting geometric planes, crystalline shards, metallic or translucent surfaces, sharp edges, strong directional light; ' +
    'OR (B) bold 2D editorial illustration — stylised vector forms, flat colour fields, confident graphic shapes, rhythmic flowing lines. ' +
    'Magazine-cover quality, high contrast, cinematic, premium 4K, designed to fill a large landscape screen. ' +
    'Do not include words, letters, people, faces, logos, or any recognisable objects.',
  defaultDrink: 'Latte',
  defaultMilk: 'None',
  defaultAddition: 'None',
  trackingScreens: 1,
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
  const update: Record<string, unknown> = { status };
  // Per brief pp.14-19: only 3 active states (pending, making, completed); no
  // pickedUp. completedAt drives the 3-min auto-expiry on the tracking screen.
  // Stamp each time status transitions to 'completed' (including after an
  // undo→redo) so the TTL resets correctly.
  if (status === 'completed') update.completedAt = new Date().toISOString();
  await collection.doc(orderId).update(update);
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
      
      if (nextNumber > 9999) {
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
