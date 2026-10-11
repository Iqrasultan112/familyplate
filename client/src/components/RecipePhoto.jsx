import React, { useEffect, useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import api from '../lib/api';
import { findCommonsRecipePhoto, findOpenverseRecipePhoto, resolveRecipeImage } from '../lib/recipeImage';

const isUserPhoto = image => /^data:image\//i.test(String(image || '')) || String(image || '').startsWith('/uploads/');
const isVerifiedOnlinePhoto = (image, recipe) => /(?:themealdb\.com|upload\.wikimedia\.org)/i.test(String(image || '')) || /api\.openverse\.org\/v1\/images\/[^/]+\/thumb\/?$/i.test(String(image || '')) || recipe?.photoSource === 'Openverse';
const pendingPhotoRequests = new Map();
const getIngredients = recipe => (Array.isArray(recipe?.ingredients) ? recipe.ingredients : [])
  .map(item => String(typeof item === 'string' ? item : item?.name || '').trim())
  .filter(Boolean);
const photoCacheKey = recipe => {
  const ingredients = getIngredients(recipe).map(value => value.toLowerCase()).sort().join('|');
  return `familyplate:food-photo-v4:${String(recipe?.name || recipe?.title || 'family meal').trim().toLowerCase()}:${ingredients}`;
};

export default function RecipePhoto({ recipe, className = '', alt, ...props }) {
  const name = recipe?.name || recipe?.title || 'family meal';
  const sourceImage = recipe?.image;
  const key = photoCacheKey(recipe);
  const [photo, setPhoto] = useState(() => {
    if (isUserPhoto(sourceImage)) return resolveRecipeImage(sourceImage);
    if (isVerifiedOnlinePhoto(sourceImage, recipe)) return sourceImage;
    try { return localStorage.getItem(key) || ''; }
    catch { return ''; }
  });

  useEffect(() => {
    let active = true;
    if (isUserPhoto(sourceImage) || isVerifiedOnlinePhoto(sourceImage, recipe)) {
      setPhoto(resolveRecipeImage(sourceImage));
      return () => { active = false; };
    }
    const cached = (() => { try { return localStorage.getItem(key); } catch { return null; } })();
    if (cached) { setPhoto(cached); return () => { active = false; }; }
    setPhoto('');

    const requestPhoto = async () => {
      if (pendingPhotoRequests.has(key)) return pendingPhotoRequests.get(key);
      const request = Promise.any([
        api.get('/ai/recipe-image', { params: { name } }).then(({ data }) => data?.image || Promise.reject(new Error('No server photo'))),
        findOpenverseRecipePhoto(name).then(photo => photo?.image || Promise.reject(new Error('No Openverse photo'))),
        findCommonsRecipePhoto(name).then(image => image || Promise.reject(new Error('No browser photo')))
      ]).catch(() => '');
      pendingPhotoRequests.set(key, request);
      try { return await request; }
      finally { pendingPhotoRequests.delete(key); }
    };

    requestPhoto().then(image => {
      if (!active || !image) return;
      setPhoto(image);
      try { localStorage.setItem(key, image); } catch {}
    }).catch(() => {});
    return () => { active = false; };
  }, [key, name, sourceImage]);

  if (!photo) return <div className={`${className} flex items-center justify-center bg-gradient-to-br from-[#fff7f1] to-[#f2dfd4]`} role="img" aria-label={`${alt || name}: exact online food photo unavailable`}><UtensilsCrossed aria-hidden="true" className="h-9 w-9 text-[#bd8a74]" /></div>;
  return <img src={photo} alt={alt || name} className={className} onError={() => setPhoto('')} {...props} />;
}
