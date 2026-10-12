import api from './api';
import { sameIngredient } from './foodMatching';

/** Add recipe ingredients absent from the pantry to the user's shopping list. */
export async function addMissingRecipeIngredients(recipeId) {
  const { data: check } = await api.post('/menu/check-ingredients', { recipeId });
  const missing = Array.isArray(check?.missing) ? check.missing : [];
  if (!missing.length) return 0;

  const { data: cart } = await api.get('/shopping');
  const alreadyListed = (Array.isArray(cart) ? cart : [])
    .filter(item => !item.isPurchased)
    .map(item => item.ingredient);
  const items = missing
    .filter(item => !alreadyListed.some(name => sameIngredient(name, item.name)))
    .map(item => ({ ingredient: item.name, quantity: item.quantity || '1' }));

  if (!items.length) return 0;
  await api.post('/shopping/bulk', { items });
  return items.length;
}
