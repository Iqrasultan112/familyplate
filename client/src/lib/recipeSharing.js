const DEPLOYED_APP_ORIGIN = 'https://familyplate-tau.vercel.app';

export function getShareableRecipeUrl(recipe) {
  if (typeof window === 'undefined') return DEPLOYED_APP_ORIGIN;

  const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const configuredOrigin = import.meta.env.VITE_PUBLIC_APP_URL?.replace(/\/$/, '');
  const origin = configuredOrigin || (localHost ? DEPLOYED_APP_ORIGIN : window.location.origin);
  const recipeId = recipe?.id;

  return recipeId
    ? `${origin}/recipes/${encodeURIComponent(recipeId)}`
    : origin;
}

export function getWhatsAppRecipeShareUrl(recipe) {
  const name = recipe?.title || recipe?.name || 'FamilyPlate recipe';
  const description = String(recipe?.description || '').trim();
  const recipeUrl = getShareableRecipeUrl(recipe);
  const message = [
    `FamilyPlate recipe: ${name}`,
    description,
    `View the recipe: ${recipeUrl}`,
  ].filter(Boolean).join('\n\n');

  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}
