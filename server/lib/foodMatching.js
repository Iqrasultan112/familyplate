const groups = [
  ['tomato', 'tomatoes'], ['onion', 'onions'], ['potato', 'potatoes', 'aloo'],
  ['chicken', 'chicken breast', 'chicken thigh'], ['beef', 'ground beef', 'minced beef', 'qeema'],
  ['mutton', 'lamb'], ['rice', 'basmati rice'], ['lentil', 'lentils', 'daal', 'dal'],
  ['yogurt', 'yoghurt', 'curd', 'dahi'], ['cilantro', 'coriander', 'fresh coriander'],
  ['green chili', 'green chilies', 'chilli', 'chili'], ['pea', 'peas', 'matar'],
  ['chickpea', 'chickpeas', 'chana'], ['egg', 'eggs'], ['garlic', 'garlic cloves'],
  ['ginger', 'fresh ginger'], ['spinach', 'palak'], ['aubergine', 'eggplant', 'brinjal'],
  ['flatbread', 'roti', 'chapati'], ['ghee', 'clarified butter'], ['oil', 'cooking oil', 'vegetable oil']
  ,['spring onion', 'spring onions', 'green onion', 'green onions', 'scallion', 'scallions']
  ,['soy sauce', 'soya sauce']
  ,['cumin', 'cumin seed', 'cumin seeds', 'jeera', 'zeera']
  ,['turmeric', 'turmeric powder', 'haldi']
];
const canonical = value => {
  let text = String(value || '').toLowerCase().trim().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
  if (!text) return '';
  for (const group of groups) if (group.some(alias => text === alias)) return group[0];
  text = text.replace(/\b(large|small|medium|fresh|dried|chopped|sliced|minced|boneless|skinless|cooked|raw)\b/g, ' ').replace(/\s+/g, ' ').trim();
  for (const group of groups) if (group.some(alias => text === alias)) return group[0];
  return text.replace(/s$/, '');
};
export const sameIngredient = (left, right) => {
  const variants = value => String(value || '').split(/[\/,;]/).map(canonical).filter(Boolean);
  const a = variants(left), b = variants(right);
  return a.some(name => b.includes(name));
};
export const pantryHas = (pantry, ingredient) => pantry.some(item => sameIngredient(
  typeof item === 'string' ? item : item.ingredient, ingredient
));
export const pantryOverlap = (pantry, ingredients) => ingredients.filter(item => pantryHas(pantry, item.name || item)).length;
export const isStaple = name => /^(salt|water|oil|pepper|spice|spices|cumin|coriander|turmeric|chili|garam masala)$/.test(canonical(name));
