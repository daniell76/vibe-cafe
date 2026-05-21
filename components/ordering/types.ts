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

export interface OrderSettings {
  appName: string;
  tagline: string;
  drinks: string[];
  milks: string[];
  flavors: string[];
  instructions: {
    step1: string;
    step2: string;
    step3: string;
  };
  defaultDrink: string;
  defaultMilk: string;
  defaultAddition: string;
}

export const DEFAULT_ORDER_SETTINGS: OrderSettings = {
  appName: 'Vibe Café',
  tagline: 'Experience the Future of Coffee',
  drinks: ['Latte', 'Cappuccino', 'Flat White', 'Americano', 'Mocha'],
  milks: ['Regular Milk', 'Oat Milk', 'Almond Milk', 'Soy Milk', 'None'],
  flavors: ['Vanilla', 'Caramel', 'Hazelnut', 'Sugar Free', 'None'],
  instructions: {
    step1: 'Personalise your perfect brew',
    step2: 'Choose a generative pattern for your latte art.',
    step3: 'Please review your selections before finalising.',
  },
  defaultDrink: 'Latte',
  defaultMilk: 'None',
  defaultAddition: 'None',
};
