const per100g = {
  chicken: [165, 31, 0, 3.6, 0], beef: [250, 26, 0, 15, 0], lamb: [294, 25, 0, 21, 0],
  fish: [140, 24, 0, 4, 0], egg: [143, 13, 1, 10, 0], rice: [365, 7, 80, 1, 1],
  lentil: [352, 24, 63, 1, 11], chickpea: [364, 19, 61, 6, 17], potato: [77, 2, 17, 0, 2],
  tomato: [18, 1, 4, 0, 1], onion: [40, 1, 9, 0, 2], peas: [81, 5, 14, 0, 5],
  spinach: [23, 3, 4, 0, 2], yogurt: [61, 4, 5, 3, 0], milk: [61, 3, 5, 3, 0],
  ghee: [900, 0, 0, 100, 0], oil: [884, 0, 0, 100, 0], butter: [717, 1, 0, 81, 0],
  flour: [364, 10, 76, 1, 3], bread: [260, 9, 49, 3, 3], pasta: [371, 13, 75, 2, 3],
  cheese: [402, 25, 1, 33, 0], garlic: [149, 6, 33, 1, 2], carrot: [41, 1, 10, 0, 3],
  banana: [89, 1, 23, 0, 3], sugar: [387, 0, 100, 0, 0], dates: [282, 2, 75, 0, 8]
};
const keyFor = name => {
  const n = String(name || '').toLowerCase();
  if (/chicken/.test(n)) return 'chicken'; if (/beef|qeema/.test(n)) return 'beef'; if (/lamb|mutton/.test(n)) return 'lamb';
  if (/fish|salmon|tuna/.test(n)) return 'fish'; if (/egg/.test(n)) return 'egg'; if (/rice/.test(n)) return 'rice';
  if (/lentil|daal|dal/.test(n)) return 'lentil'; if (/chickpea|chana/.test(n)) return 'chickpea';
  if (/potato|aloo/.test(n)) return 'potato'; if (/tomato/.test(n)) return 'tomato'; if (/onion/.test(n)) return 'onion';
  if (/pea|matar/.test(n)) return 'peas'; if (/spinach|palak/.test(n)) return 'spinach'; if (/yogurt|yoghurt|curd|dahi/.test(n)) return 'yogurt';
  if (/milk|cream/.test(n)) return 'milk'; if (/ghee/.test(n)) return 'ghee'; if (/oil/.test(n)) return 'oil'; if (/butter/.test(n)) return 'butter';
  if (/atta|flour|maida|sooji|semolina/.test(n)) return 'flour'; if (/roti|chapati|naan|bread/.test(n)) return 'bread';
  if (/pasta|macaroni/.test(n)) return 'pasta'; if (/cheese|paneer/.test(n)) return 'cheese'; if (/garlic/.test(n)) return 'garlic';
  if (/carrot/.test(n)) return 'carrot'; if (/banana/.test(n)) return 'banana'; if (/sugar/.test(n)) return 'sugar'; if (/date/.test(n)) return 'dates';
  return null;
};
const gramsFor = (quantity, key) => {
  const text = String(quantity || '').toLowerCase();
  const m = text.match(/(\d+(?:\.\d+)?|\d+\s*\/\s*\d+|½|¼|¾)/);
  if (!m) return null;
  const amount = m[1].includes('/') ? m[1].split('/').map(Number).reduce((a,b)=>a/b) : ({'½':.5,'¼':.25,'¾':.75}[m[1]] ?? Number(m[1]));
  const unit = text.slice((m.index || 0) + m[0].length).trim();
  if (/\bkg\b/.test(unit)) return amount * 1000;
  if (/\b(g|gram|grams)\b/.test(unit)) return amount;
  if (/\b(l|litre|liter|litres|liters)\b/.test(unit)) return amount * 1000;
  if (/\b(ml|millilitre|milliliter)\b/.test(unit)) return amount;
  if (/\b(cup|cups)\b/.test(unit)) return amount * ({rice:185,lentil:190,chickpea:164,flour:120,peas:145,oil:218,sugar:200,cheese:110,yogurt:245,milk:245}[key] || 150);
  if (/\b(tbsp|tablespoon|tablespoons)\b/.test(unit)) return amount * (key === 'oil' || key === 'ghee' ? 14 : 15);
  if (/\b(tsp|teaspoon|teaspoons)\b/.test(unit)) return amount * (key === 'oil' || key === 'ghee' ? 4.5 : 5);
  if (/\b(clove|cloves)\b/.test(unit)) return amount * 3;
  if (/\b(piece|pieces|pcs|medium|large|small)\b/.test(unit) || !unit) return amount * ({chicken:150,beef:100,lamb:100,egg:50,tomato:120,onion:110,potato:170,carrot:60,garlic:3}[key] || 50);
  return null;
};
export const estimateNutrition = (ingredients, servings = 4) => {
  const rows = (Array.isArray(ingredients) ? ingredients : []).map(item => {
    const key = keyFor(item.name || item.ingredient); const grams = key && gramsFor(item.quantity || item.amount, key);
    return key && Number.isFinite(grams) ? { values: per100g[key], grams } : null;
  }).filter(Boolean);
  const totalIngredients = Array.isArray(ingredients) ? ingredients.filter(i => i.name || i.ingredient).length : 0;
  const coveragePercent = totalIngredients ? Math.round(rows.length / totalIngredients * 100) : 0;
  if (!rows.length || coveragePercent < 60) return null;
  const total = rows.reduce((sum, row) => sum.map((v,i) => v + row.values[i] * row.grams / 100), [0,0,0,0,0]);
  const divisor = Math.max(1, Number.parseInt(servings,10) || 4);
  const [calories, proteinG, carbsG, fatG, fiberG] = total.map(value => Math.round(value / divisor));
  return { calories, proteinG, carbsG, fatG, fiberG, perServing: true, estimated: true, coveragePercent };
};
