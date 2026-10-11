const aliases = [
  ['tomato', 'tomatoes'], ['onion', 'onions'], ['potato', 'potatoes', 'aloo'],
  ['chicken', 'chicken breast', 'chicken thigh'], ['beef', 'ground beef', 'minced beef', 'qeema'],
  ['mutton', 'lamb'], ['rice', 'basmati rice'], ['lentil', 'lentils', 'daal', 'dal'],
  ['yogurt', 'yoghurt', 'curd', 'dahi'], ['cilantro', 'coriander', 'fresh coriander'],
  ['pea', 'peas', 'matar'], ['chickpea', 'chickpeas', 'chana'], ['egg', 'eggs'],
  ['spinach', 'palak'], ['aubergine', 'eggplant', 'brinjal'], ['garlic', 'garlic cloves']
];
export const sameIngredient = (a, b) => {
  const clean = v => String(v || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z0-9]+/g, ' ').replace(/\b(large|small|medium|fresh|dried|chopped|sliced|minced|boneless|skinless|cooked|raw)\b/g, ' ').replace(/\s+/g, ' ').trim();
  let left = clean(a), right = clean(b);
  for (const group of aliases) { if (group.includes(left)) left = group[0]; if (group.includes(right)) right = group[0]; }
  return !!left && left.replace(/s$/, '') === right.replace(/s$/, '');
};
