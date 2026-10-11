const PHOTO_STOP_WORDS = new Set(['recipe', 'quick', 'easy', 'simple', 'classic', 'family', 'style', 'homemade', 'traditional', 'authentic', 'for', 'with', 'a', 'the', 'celebration', 'everyday', 'meal', 'dish', 'mild', 'spicy', 'desi', 'special', 'best', 'delicious', 'and', 'of']);
const photoTerms = value => String(value || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim().split(/\s+/)
  .filter(word => word && !PHOTO_STOP_WORDS.has(word))
  .map(word => ({ pilau: 'pulao', pilaf: 'pulao', qeema: 'keema', daal: 'dal', lentils: 'lentil', eggs: 'egg', tomatoes: 'tomato', onions: 'onion' }[word] || word));

// Browser fallback helps when the server cannot reach the public photo API.
// Wikimedia's API supports cross-origin browser requests with origin=*.
export async function findCommonsRecipePhoto(name = '') {
  const terms = [...new Set(photoTerms(name))];
  if (!terms.length) return '';
  const searchParams = new URLSearchParams({ action: 'query', format: 'json', origin: '*', list: 'search', srnamespace: '6', srsearch: `"${terms.join(' ')}"`, srlimit: '8' });
  const searchResponse = await fetch(`https://commons.wikimedia.org/w/api.php?${searchParams}`, { signal: AbortSignal.timeout(8000) });
  if (!searchResponse.ok) return '';
  const results = (await searchResponse.json()).query?.search || [];
  const matches = results.map(page => {
    const titleTerms = new Set(photoTerms(page.title));
    const matched = terms.filter(term => titleTerms.has(term)).length;
    return { ...page, matched, score: matched / terms.length };
  }).filter(page => page.matched >= Math.min(terms.length, 2) && page.score >= 0.5)
    .sort((a, b) => b.score - a.score || b.matched - a.matched).slice(0, 4);
  if (!matches.length) return '';
  const imageParams = new URLSearchParams({ action: 'query', format: 'json', origin: '*', prop: 'imageinfo', titles: matches.map(page => page.title).join('|'), iiprop: 'url|mime', iiurlwidth: '960' });
  const imageResponse = await fetch(`https://commons.wikimedia.org/w/api.php?${imageParams}`, { signal: AbortSignal.timeout(8000) });
  if (!imageResponse.ok) return '';
  const pages = Object.values((await imageResponse.json()).query?.pages || {});
  for (const match of matches) {
    const info = pages.find(page => page.title === match.title)?.imageinfo?.[0];
    const image = info?.thumburl || info?.url;
    if (image && /^https:\/\//i.test(image) && /^image\/(jpeg|png|webp)/i.test(info.mime || '')) return image;
  }
  return '';
}

// Openverse indexes openly licensed food photography from several providers.
// Search the recipe title first, then a compact dish query; only accept a real
// photograph whose title or tags match the recipe's defining words.
export async function findOpenverseRecipePhoto(name = '') {
  const terms = [...new Set(photoTerms(name))];
  if (!terms.length) return '';
  const proteins = terms.filter(term => ['chicken', 'beef', 'mutton', 'lamb', 'fish', 'egg', 'paneer', 'tofu'].includes(term));
  const dishTypes = terms.filter(term => ['rice', 'pulao', 'dal', 'keema', 'curry', 'roti', 'bread', 'biryani', 'pasta', 'soup', 'salad', 'cake', 'pancake', 'paratha'].includes(term));
  const core = [...new Set([...proteins, ...dishTypes])];
  const queries = [...new Set([name, core.join(' ')].filter(Boolean))];
  for (const query of queries) {
    try {
      const params = new URLSearchParams({ q: query, category: 'photograph', mature: 'false', page_size: '20' });
      const response = await fetch(`https://api.openverse.org/v1/images/?${params}`, { signal: AbortSignal.timeout(9000) });
      if (!response.ok) continue;
      const results = (await response.json()).results || [];
      const ranked = results.map(item => {
        const titleAndTags = photoTerms(`${item.title || ''} ${(item.tags || []).map(tag => tag.name).join(' ')}`);
        const matchedCore = core.filter(term => titleAndTags.includes(term)).length;
        return { item, matchedCore };
      }).filter(({ item, matchedCore }) => {
        // A title or tag must identify the defining protein and dish type when
        // both are present, to avoid showing an unrelated food photo.
        return core.length >= 2 ? matchedCore === core.length : matchedCore >= 1;
      });
      const match = ranked[0]?.item;
      const image = match?.thumbnail || match?.url;
      if (image && /^https:\/\//i.test(image) && (/\.(jpe?g|png|webp)(?:\?|$)/i.test(image) || /api\.openverse\.org\/v1\/images\/[^/]+\/thumb\/?$/i.test(image))) {
        return {
          image,
          sourceUrl: match.foreign_landing_url || match.detail_url || 'https://openverse.org/',
          matchedName: match.title || name,
          photoSource: 'Openverse',
          photoAttribution: match.attribution || `${match.title || 'Photo'} by ${match.creator || 'unknown creator'} · ${match.license || 'license details'}`,
          photoLicenseUrl: match.license_url || null
        };
      }
    } catch { /* continue to the next query or source */ }
  }
  return '';
}

export function resolveRecipeImage(image) {
  if (!image) return '';
  if (/^https?:\/\//i.test(image) || /^data:image\//i.test(image)) return image;
  if (image.startsWith('/uploads/')) {
    const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? `${window.location.origin}/api` : 'http://localhost:5000/api');
    return `${apiUrl.replace(/\/api\/?$/, '')}${image}`;
  }
  return image;
}
