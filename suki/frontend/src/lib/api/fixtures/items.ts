// 60 items across the real shop categories. Buy/sell prices are integer pesos.
// Stock is in sell units; some already below reorder to make /restock real.

import type { Item } from '../../types';

export const ITEMS: Item[] = [
  // Sachets (shampoo, coffee, conditioner, powdered drinks)
  { id: 'i01', name: 'Palmolive Shampoo Sachet',       category: 'sachet', buyUnit: 'ream', sellUnit: 'sachet', perPack: 12, buyPrice: 96,  sellPrice: 10, stock: 34, reorderAt: 12 },
  { id: 'i02', name: 'Sunsilk Shampoo Sachet',          category: 'sachet', buyUnit: 'ream', sellUnit: 'sachet', perPack: 12, buyPrice: 96,  sellPrice: 10, stock: 18, reorderAt: 12 },
  { id: 'i03', name: 'Head & Shoulders Sachet',         category: 'sachet', buyUnit: 'ream', sellUnit: 'sachet', perPack: 12, buyPrice: 108, sellPrice: 12, stock: 8,  reorderAt: 12 },
  { id: 'i04', name: 'Cream Silk Conditioner Sachet',   category: 'sachet', buyUnit: 'ream', sellUnit: 'sachet', perPack: 12, buyPrice: 96,  sellPrice: 10, stock: 22, reorderAt: 12 },
  { id: 'i05', name: 'Safeguard Sachet',                category: 'sachet', buyUnit: 'ream', sellUnit: 'sachet', perPack: 12, buyPrice: 84,  sellPrice: 9,  stock: 3,  reorderAt: 12 },
  { id: 'i06', name: 'Kopiko Brown Coffee 3-in-1',      category: 'sachet', buyUnit: 'box',  sellUnit: 'sachet', perPack: 30, buyPrice: 210, sellPrice: 9,  stock: 42, reorderAt: 20 },
  { id: 'i07', name: 'Nescafé Original 3-in-1 Twin',     category: 'sachet', buyUnit: 'box',  sellUnit: 'sachet', perPack: 30, buyPrice: 240, sellPrice: 10, stock: 26, reorderAt: 20 },
  { id: 'i08', name: 'Great Taste White Coffee',        category: 'sachet', buyUnit: 'box',  sellUnit: 'sachet', perPack: 30, buyPrice: 225, sellPrice: 9,  stock: 4,  reorderAt: 20 },
  { id: 'i09', name: 'Milo Chocolate Sachet',           category: 'sachet', buyUnit: 'box',  sellUnit: 'sachet', perPack: 24, buyPrice: 168, sellPrice: 9,  stock: 15, reorderAt: 12 },
  { id: 'i10', name: 'Bear Brand Adult Plus Sachet',    category: 'sachet', buyUnit: 'box',  sellUnit: 'sachet', perPack: 24, buyPrice: 192, sellPrice: 10, stock: 0,  reorderAt: 12 },

  // Canned goods
  { id: 'i11', name: 'Century Tuna Flakes 155g',        category: 'canned', buyUnit: 'case', sellUnit: 'can',    perPack: 48, buyPrice: 1440,sellPrice: 35, stock: 22, reorderAt: 8 },
  { id: 'i12', name: 'Argentina Corned Beef 150g',      category: 'canned', buyUnit: 'case', sellUnit: 'can',    perPack: 48, buyPrice: 1728,sellPrice: 42, stock: 6,  reorderAt: 8 },
  { id: 'i13', name: 'CDO Karne Norte 150g',            category: 'canned', buyUnit: 'case', sellUnit: 'can',    perPack: 48, buyPrice: 1440,sellPrice: 35, stock: 14, reorderAt: 8 },
  { id: 'i14', name: 'Ligo Sardines Green 155g',        category: 'canned', buyUnit: 'case', sellUnit: 'can',    perPack: 100,buyPrice: 1900,sellPrice: 22, stock: 31, reorderAt: 10 },
  { id: 'i15', name: 'Mega Sardines Red 155g',          category: 'canned', buyUnit: 'case', sellUnit: 'can',    perPack: 100,buyPrice: 2100,sellPrice: 25, stock: 2,  reorderAt: 10 },
  { id: 'i16', name: 'Purefoods Chinese Style Luncheon',category: 'canned', buyUnit: 'case', sellUnit: 'can',    perPack: 24, buyPrice: 1560,sellPrice: 74, stock: 9,  reorderAt: 6 },
  { id: 'i17', name: 'Del Monte Fiesta Spaghetti Sauce',category: 'canned', buyUnit: 'case', sellUnit: 'pouch',  perPack: 24, buyPrice: 720, sellPrice: 38, stock: 11, reorderAt: 6 },
  { id: 'i18', name: 'UFC Banana Ketchup 200g',         category: 'canned', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 528, sellPrice: 28, stock: 5,  reorderAt: 6 },

  // Noodles
  { id: 'i19', name: 'Lucky Me Pancit Canton Chilimansi',category: 'noodles',buyUnit: 'case', sellUnit: 'pack',  perPack: 60, buyPrice: 780, sellPrice: 15, stock: 44, reorderAt: 24 },
  { id: 'i20', name: 'Lucky Me Pancit Canton Original', category: 'noodles',buyUnit: 'case', sellUnit: 'pack',   perPack: 60, buyPrice: 780, sellPrice: 15, stock: 12, reorderAt: 24 },
  { id: 'i21', name: 'Lucky Me Beef na Beef Instant',   category: 'noodles',buyUnit: 'case', sellUnit: 'pack',   perPack: 60, buyPrice: 690, sellPrice: 13, stock: 38, reorderAt: 24 },
  { id: 'i22', name: 'Nissin Yakisoba Cheese',          category: 'noodles',buyUnit: 'case', sellUnit: 'pack',   perPack: 24, buyPrice: 600, sellPrice: 28, stock: 7,  reorderAt: 12 },
  { id: 'i23', name: 'Payless Xtra Big Chicken',        category: 'noodles',buyUnit: 'case', sellUnit: 'pack',   perPack: 60, buyPrice: 660, sellPrice: 12, stock: 20, reorderAt: 24 },

  // Drinks (soft drinks, bottled water)
  { id: 'i24', name: 'Coke Sakto 200ml',                category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 336, sellPrice: 16, stock: 30, reorderAt: 12 },
  { id: 'i25', name: 'Royal Tru-Orange 250ml',          category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 360, sellPrice: 18, stock: 5,  reorderAt: 12 },
  { id: 'i26', name: 'Sprite Sakto 200ml',              category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 336, sellPrice: 16, stock: 18, reorderAt: 12 },
  { id: 'i27', name: 'C2 Apple 230ml',                  category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 432, sellPrice: 22, stock: 10, reorderAt: 8 },
  { id: 'i28', name: 'Cobra Energy Drink 240ml',        category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 528, sellPrice: 28, stock: 4,  reorderAt: 8 },
  { id: 'i29', name: 'Nature Spring 500ml',             category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 192, sellPrice: 12, stock: 25, reorderAt: 12 },
  { id: 'i30', name: 'Absolute Distilled 500ml',        category: 'drinks', buyUnit: 'case', sellUnit: 'bottle', perPack: 24, buyPrice: 216, sellPrice: 13, stock: 9,  reorderAt: 12 },

  // Cigarettes — sold singly (tingi)
  { id: 'i31', name: 'Marlboro Red Stick',              category: 'cigarettes', buyUnit: 'ream', sellUnit: 'stick', perPack: 200, buyPrice: 1400, sellPrice: 10, stock: 68, reorderAt: 40 },
  { id: 'i32', name: 'Marlboro Lights Stick',           category: 'cigarettes', buyUnit: 'ream', sellUnit: 'stick', perPack: 200, buyPrice: 1400, sellPrice: 10, stock: 44, reorderAt: 40 },
  { id: 'i33', name: 'Winston Red Stick',               category: 'cigarettes', buyUnit: 'ream', sellUnit: 'stick', perPack: 200, buyPrice: 1200, sellPrice: 8,  stock: 22, reorderAt: 40 },
  { id: 'i34', name: 'Fortune International Stick',     category: 'cigarettes', buyUnit: 'ream', sellUnit: 'stick', perPack: 200, buyPrice: 1000, sellPrice: 7,  stock: 0,  reorderAt: 40 },

  // Rice (by the kilo)
  { id: 'i35', name: 'Sinandomeng Rice',                category: 'rice',   buyUnit: 'sack', sellUnit: 'kilo',   perPack: 25, buyPrice: 1225, sellPrice: 55, stock: 18, reorderAt: 6 },
  { id: 'i36', name: 'Dinorado Rice',                   category: 'rice',   buyUnit: 'sack', sellUnit: 'kilo',   perPack: 25, buyPrice: 1500, sellPrice: 65, stock: 3,  reorderAt: 6 },
  { id: 'i37', name: 'NFA Rice',                        category: 'rice',   buyUnit: 'sack', sellUnit: 'kilo',   perPack: 25, buyPrice: 950,  sellPrice: 42, stock: 22, reorderAt: 6 },

  // Cellular load (kept as items for the till; sold in denominations)
  { id: 'i38', name: 'Smart Load 15',                   category: 'load',   buyUnit: 'load',  sellUnit: 'load',   perPack: 1,  buyPrice: 14,   sellPrice: 15, stock: 999,reorderAt: 0 },
  { id: 'i39', name: 'Smart Load 30',                   category: 'load',   buyUnit: 'load',  sellUnit: 'load',   perPack: 1,  buyPrice: 28,   sellPrice: 30, stock: 999,reorderAt: 0 },
  { id: 'i40', name: 'Globe Load 20',                   category: 'load',   buyUnit: 'load',  sellUnit: 'load',   perPack: 1,  buyPrice: 19,   sellPrice: 20, stock: 999,reorderAt: 0 },
  { id: 'i41', name: 'TM Load 50',                      category: 'load',   buyUnit: 'load',  sellUnit: 'load',   perPack: 1,  buyPrice: 47,   sellPrice: 50, stock: 999,reorderAt: 0 },

  // Bread
  { id: 'i42', name: 'Pandesal',                        category: 'bread',  buyUnit: 'tray', sellUnit: 'piece',  perPack: 30, buyPrice: 60,   sellPrice: 3,  stock: 26, reorderAt: 20 },
  { id: 'i43', name: 'Gardenia White Bread Slice',      category: 'bread',  buyUnit: 'case', sellUnit: 'loaf',   perPack: 12, buyPrice: 720,  sellPrice: 68, stock: 5,  reorderAt: 4 },
  { id: 'i44', name: 'Skyflakes Crackers Single',       category: 'bread',  buyUnit: 'box',  sellUnit: 'pack',   perPack: 25, buyPrice: 200,  sellPrice: 10, stock: 14, reorderAt: 10 },
  { id: 'i45', name: 'Rebisco Crackers',                category: 'bread',  buyUnit: 'box',  sellUnit: 'pack',   perPack: 25, buyPrice: 175,  sellPrice: 9,  stock: 8,  reorderAt: 10 },

  // Candy / small treats (piece-selling territory)
  { id: 'i46', name: 'Mentos Mint Roll',                category: 'candy',  buyUnit: 'box',  sellUnit: 'roll',   perPack: 12, buyPrice: 180,  sellPrice: 18, stock: 11, reorderAt: 6 },
  { id: 'i47', name: 'Storck Candy Piece',              category: 'candy',  buyUnit: 'jar',  sellUnit: 'piece',  perPack: 100,buyPrice: 100,  sellPrice: 2,  stock: 88, reorderAt: 30 },
  { id: 'i48', name: 'White Rabbit Candy',              category: 'candy',  buyUnit: 'jar',  sellUnit: 'piece',  perPack: 100,buyPrice: 150,  sellPrice: 3,  stock: 12, reorderAt: 30 },
  { id: 'i49', name: 'Chuckie Chocolate Drink',         category: 'candy',  buyUnit: 'case', sellUnit: 'pouch',  perPack: 24, buyPrice: 480,  sellPrice: 25, stock: 6,  reorderAt: 8 },
  { id: 'i50', name: 'Chocolate Bar Small',             category: 'candy',  buyUnit: 'box',  sellUnit: 'piece',  perPack: 40, buyPrice: 400,  sellPrice: 12, stock: 24, reorderAt: 10 },

  // Household
  { id: 'i51', name: 'Surf Powder Sachet',              category: 'household',buyUnit:'ream',sellUnit: 'sachet', perPack: 12, buyPrice: 96,   sellPrice: 10, stock: 30, reorderAt: 12 },
  { id: 'i52', name: 'Ariel Powder Sachet',             category: 'household',buyUnit:'ream',sellUnit: 'sachet', perPack: 12, buyPrice: 108,  sellPrice: 12, stock: 4,  reorderAt: 12 },
  { id: 'i53', name: 'Downy Fabric Con Sachet',         category: 'household',buyUnit:'ream',sellUnit: 'sachet', perPack: 12, buyPrice: 96,   sellPrice: 10, stock: 15, reorderAt: 12 },
  { id: 'i54', name: 'Joy Dishwash Sachet',             category: 'household',buyUnit:'ream',sellUnit: 'sachet', perPack: 12, buyPrice: 72,   sellPrice: 8,  stock: 21, reorderAt: 12 },
  { id: 'i55', name: 'Ajax Dishwash Sachet',            category: 'household',buyUnit:'ream',sellUnit: 'sachet', perPack: 12, buyPrice: 60,   sellPrice: 7,  stock: 2,  reorderAt: 12 },
  { id: 'i56', name: 'Colgate Toothpaste Sachet',       category: 'household',buyUnit:'ream',sellUnit: 'sachet', perPack: 12, buyPrice: 96,   sellPrice: 10, stock: 18, reorderAt: 12 },
  { id: 'i57', name: 'Modess Sanitary Pad Piece',       category: 'household',buyUnit:'pack',sellUnit: 'piece',  perPack: 8,  buyPrice: 40,   sellPrice: 6,  stock: 9,  reorderAt: 8 },
  { id: 'i58', name: 'Zonrox Bleach 250ml',             category: 'household',buyUnit:'case',sellUnit: 'bottle', perPack: 24, buyPrice: 528,  sellPrice: 28, stock: 5,  reorderAt: 6 },
  { id: 'i59', name: 'Baygon Insecticide 300ml',        category: 'household',buyUnit:'case',sellUnit: 'can',    perPack: 12, buyPrice: 1080, sellPrice: 105,stock: 3,  reorderAt: 4 },
  { id: 'i60', name: 'Match Box Small',                 category: 'household',buyUnit:'box', sellUnit: 'piece',  perPack: 100,buyPrice: 100,  sellPrice: 2,  stock: 55, reorderAt: 20 },
];
