export function youtubeRecipeLinks(recipeName) {
  const name = String(recipeName || '').trim();
  if (!name) return [];
  return [
    { label: 'Watch a recipe video', query: `${name} recipe` },
    { label: 'Watch another cooking video', query: `${name} recipe step by step` },
  ].map(({ label, query }) => ({
    label,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`,
  }));
}
