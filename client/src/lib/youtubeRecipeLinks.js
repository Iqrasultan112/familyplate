export function youtubeRecipeLinks(recipeName) {
  const name = String(recipeName || '').trim();
  if (!name) return [];
  return [{
    label: `Search ${name} recipe videos on YouTube`,
    url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} recipe`)}`,
    direct: false,
  }];
}
