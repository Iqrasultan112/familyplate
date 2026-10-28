const marketplaceOptions = [
  { value: 'all', label: 'Any marketplace · Google Shopping' },
  { value: 'daraz', label: 'Daraz Pakistan', domain: 'daraz.pk' },
  { value: 'carrefour', label: 'Carrefour Pakistan', domain: 'carrefour.pk' },
  { value: 'naheed', label: 'Naheed', domain: 'naheed.pk' },
  { value: 'imtiaz', label: 'Imtiaz Online', domain: 'shop.imtiaz.com.pk' },
  { value: 'other', label: 'Other marketplace · Web search' },
];

export const MARKETPLACE_OPTIONS = marketplaceOptions;

export function getMarketplaceSearchUrl(marketplace, itemName) {
  const query = String(itemName || '').trim();
  const selected = marketplaceOptions.find(option => option.value === marketplace);

  if (!query || !selected) return 'https://www.google.com/search?tbm=shop';
  if (marketplace === 'all') {
    return `https://www.google.com/search?tbm=shop&q=${encodeURIComponent(query)}`;
  }
  if (marketplace === 'other') {
    return `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  }

  const storeQuery = `site:${selected.domain} ${query}`;
  return `https://www.google.com/search?q=${encodeURIComponent(storeQuery)}`;
}
