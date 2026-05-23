export interface OrderDraft {
  name: string;
  coffeeOrder: string;
  milk: string;
  addition: string;
  extraShots: number;
  happyPlace: string;
}

export interface ArtOption {
  id: string;
  label: string;
  description: string;
  imageUrl: string;
}

export interface DrinkCategory {
  name: string;
  items: string[];
}

export interface OrderSettings {
  appName: string;
  tagline: string;
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
  defaultDrink: string;
  defaultMilk: string;
  defaultAddition: string;
}

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  appName: 'Vibe Café',
  tagline: 'Experience the Future of Coffee',
  drinkCategories: [
    { name: 'Coffees', items: ['Latte', 'Cappuccino', 'Flat White', 'Americano', 'Mocha'] },
  ],
  milks: ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'],
  flavors: ['Vanilla', 'Caramel', 'Hazelnut', 'Sugar Free', 'None'],
  additionsEnabled: false,
  extraShotsEnabled: false,
  instructions: {
    step1: 'Personalise your perfect brew',
    step2: 'Choose a generative pattern for your latte art.',
    step3: 'Please review your selections before finalising.',
  },
  aiInspirationHint: "What's your favourite hobby, music or destination? We'll use this to style your cup art.",
  aiInspirationPlaceholder: 'I like soul music and especially the music of Aretha Franklin.',
  defaultDrink: 'Latte',
  defaultMilk: 'None',
  defaultAddition: 'None',
};
