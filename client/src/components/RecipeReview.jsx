import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, CheckCircle, Share2 } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { resolveRecipeImage } from '../lib/recipeImage';

const asList = value => {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return [];
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; }
};

export default function RecipeReview({ initialRecipe, initialGroupId = '', onStartOver }) {
  const [recipe, setRecipe] = useState({ ...initialRecipe, ingredients: asList(initialRecipe.ingredients), instructions: asList(initialRecipe.instructions) });
  const [isEditing, setIsEditing] = useState(true);
  const [loading, setLoading] = useState(false);
  const [savedRecipe, setSavedRecipe] = useState(null);
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const [sharing, setSharing] = useState(false);
  const [photoSearch, setPhotoSearch] = useState(false);
  const [photoUpload, setPhotoUpload] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!initialRecipe.name?.trim() || initialRecipe.image) return;
    let active = true;
    api.get('/ai/recipe-image', { params: { name: initialRecipe.name } }).then(({ data }) => {
      if (active) setRecipe(current => current.image ? current : ({ ...current, image: data.image, sourceUrl: data.sourceUrl, photoSource: data.photoSource }));
    }).catch(() => {});
    return () => { active = false; };
  }, [initialRecipe.name, initialRecipe.image]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await api.post('/recipes', recipe);
      toast.success('Recipe saved successfully!');
      setSavedRecipe(res.data);
      try { const groupRes = await api.get('/groups'); setGroups(groupRes.data || []); if (initialGroupId) setSelectedGroup(initialGroupId); } catch {}
    } catch (err) {
      toast.error('Failed to save recipe');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleShare = async () => {
    if (!savedRecipe?.id || !selectedGroup) return;
    setSharing(true);
    try {
      const ingredients = asList(savedRecipe.ingredients);
      const instructions = asList(savedRecipe.instructions);
      if (!ingredients.length || !instructions.length) throw new Error('Add at least one ingredient and one cooking step before sharing.');
      const recipeText = `🍲 ${savedRecipe.name}${savedRecipe.image ? `\nPhoto: ${resolveRecipeImage(savedRecipe.image)}` : ''}${savedRecipe.sourceUrl ? `\nPhoto source: ${savedRecipe.sourceUrl}` : ''}\nServes: ${savedRecipe.servings || 4}\n\nIngredients:\n${ingredients.map(i => `• ${i.quantity || ''} ${i.name || ''}`.trim()).join('\n')}\n\nMethod:\n${instructions.map((step, index) => `${index + 1}. ${step}`).join('\n')}`;
      await api.post(`/groups/${selectedGroup}/messages`, { content: recipeText, kind: 'recipe' });
      toast.success(`Recipe shared with ${groups.find(group => String(group.id) === String(selectedGroup))?.name || 'your group'}`);
    } catch (error) { toast.error(error.response?.data?.error || error.message || 'Could not share recipe'); }
    finally { setSharing(false); }
  };

  const findRecipePhoto = async () => {
    if (!recipe.name?.trim()) { toast.error('Add the recipe name first'); return; }
    setPhotoSearch(true);
    try {
      const { data } = await api.get('/ai/recipe-image', { params: { name: recipe.name } });
      setRecipe(current => ({ ...current, image: data.image, sourceUrl: data.sourceUrl, photoSource: data.photoSource }));
      toast.success(`Photo found for ${data.matchedName}`);
    } catch (error) { toast.error(error.response?.data?.error || 'Could not find a matching photo'); }
    finally { setPhotoSearch(false); }
  };

  const uploadRecipePhoto = async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    const form = new FormData(); form.append('image', file);
    setPhotoUpload(true);
    try {
      const { data } = await api.post('/recipes/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setRecipe(current => ({ ...current, image: data.image, sourceUrl: '' }));
      toast.success('Recipe photo added');
    } catch (error) { toast.error(error.response?.data?.error || 'Could not add this photo'); }
    finally { setPhotoUpload(false); event.target.value = ''; }
  };

  const updateIngredient = (index, field, value) => {
    const updated = [...recipe.ingredients];
    updated[index][field] = value;
    setRecipe({ ...recipe, ingredients: updated });
  };

  const addIngredient = () => {
    setRecipe({ ...recipe, ingredients: [...recipe.ingredients, { name: '', quantity: '' }] });
  };

  const removeIngredient = (index) => {
    const updated = recipe.ingredients.filter((_, i) => i !== index);
    setRecipe({ ...recipe, ingredients: updated });
  };

  const updateInstruction = (index, value) => {
    const updated = [...recipe.instructions];
    updated[index] = value;
    setRecipe({ ...recipe, instructions: updated });
  };

  const addInstruction = () => {
    setRecipe({ ...recipe, instructions: [...recipe.instructions, ''] });
  };

  const removeInstruction = (index) => {
    const updated = recipe.instructions.filter((_, i) => i !== index);
    setRecipe({ ...recipe, instructions: updated });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-4 md:p-6 mb-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Review Recipe</h2>
        <button 
          onClick={() => setIsEditing(!isEditing)} 
          className="text-blue-600 hover:bg-blue-50 px-3 py-1 rounded flex items-center gap-1"
        >
          {isEditing ? <CheckCircle className="w-4 h-4"/> : <Edit2 className="w-4 h-4"/>}
          {isEditing ? 'Preview' : 'Edit'}
        </button>
      </div>

      <div className={`border-l-4 p-3 mb-6 text-sm ${initialRecipe.needsManualReview ? 'bg-amber-50 border-amber-500 text-amber-950' : 'bg-blue-50 border-blue-400 text-blue-900'}`}>
        <strong>{initialRecipe.needsManualReview ? 'Please check this recipe draft.' : 'Please review the AI draft.'}</strong> {initialRecipe.needsManualReview ? 'Ingredients and cooking steps were picked out locally from your note. Confirm the amounts and add anything the app missed before saving.' : 'Check quantities and cooking steps before saving.'}
      </div>

      <div className="space-y-6">
        {/* Name */}
        <div>
          <label className="label">Recipe Name</label>
          {isEditing ? (
            <input 
              type="text" 
              className="input text-lg font-bold" 
              value={recipe.name || ''} 
              onChange={e => setRecipe({...recipe, name: e.target.value})}
              placeholder="e.g. Grandma's Apple Pie"
            />
          ) : (
            <div className="text-xl font-bold p-2">{recipe.name || <span className="text-gray-400 italic">Not specified</span>}</div>
          )}
        </div>

        <section className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h3 className="font-bold text-primary-950">Recipe photo</h3><p className="text-sm text-primary-700">Find a matching public photo or add one from your device.</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" onClick={findRecipePhoto} disabled={photoSearch || !recipe.name?.trim()} className="btn-secondary">{photoSearch ? 'Searching…' : 'Find photo online'}</button><label className={`btn-secondary cursor-pointer ${photoUpload ? 'pointer-events-none opacity-60' : ''}`}>{photoUpload ? 'Uploading…' : 'Upload photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={uploadRecipePhoto} /></label></div>
          </div>
          {recipe.image && <div className="mt-3 overflow-hidden rounded-xl border bg-white"><img src={resolveRecipeImage(recipe.image)} alt={`${recipe.name || 'Recipe'}`} className="h-48 w-full object-cover" />{recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="block px-3 py-2 text-xs text-primary-700 underline">Photo source: {recipe.photoSource || 'online recipe source'}</a>}</div>}
        </section>

        {/* Meta info */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="label">Prep Time (mins)</label>
            {isEditing ? (
              <input type="number" className="input" value={recipe.prepTime || ''} onChange={e => setRecipe({...recipe, prepTime: e.target.value})} />
            ) : (
              <div className="p-2">{recipe.prepTime || <span className="text-gray-400 italic">N/A</span>}</div>
            )}
          </div>
          <div>
            <label className="label">Cook Time (mins)</label>
            {isEditing ? (
              <input type="number" className="input" value={recipe.cookTime || ''} onChange={e => setRecipe({...recipe, cookTime: e.target.value})} />
            ) : (
              <div className="p-2">{recipe.cookTime || <span className="text-gray-400 italic">N/A</span>}</div>
            )}
          </div>
          <div>
            <label className="label">Servings</label>
            {isEditing ? (
              <input type="number" className="input" value={recipe.servings || ''} onChange={e => setRecipe({...recipe, servings: e.target.value})} />
            ) : (
              <div className="p-2">{recipe.servings || <span className="text-gray-400 italic">N/A</span>}</div>
            )}
          </div>
        </div>

        {/* Ingredients */}
        <div>
          <h3 className="font-bold text-lg mb-2 border-b pb-1">Ingredients</h3>
          <div className="space-y-2">
            {(recipe.ingredients || []).map((ing, i) => (
              <div key={i} className="flex gap-2 items-start">
                {isEditing ? (
                  <>
                    <input type="text" className="input flex-1" placeholder="Quantity (e.g. 2 cups)" value={ing.quantity || ''} onChange={e => updateIngredient(i, 'quantity', e.target.value)} />
                    <input type="text" className="input flex-[2]" placeholder="Ingredient (e.g. Flour)" value={ing.name || ''} onChange={e => updateIngredient(i, 'name', e.target.value)} />
                    <button onClick={() => removeIngredient(i)} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 className="w-5 h-5"/></button>
                  </>
                ) : (
                  <div className="p-2 bg-gray-50 rounded flex-1">
                    <span className="font-semibold mr-2">{ing.quantity}</span> {ing.name}
                  </div>
                )}
              </div>
            ))}
          </div>
          {isEditing && (
            <button onClick={addIngredient} className="mt-2 text-sm text-blue-600 flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4"/> Add Ingredient
            </button>
          )}
        </div>

        {/* Instructions */}
        <div>
          <h3 className="font-bold text-lg mb-2 border-b pb-1">Instructions</h3>
          <div className="space-y-3">
            {(recipe.instructions || []).map((step, i) => (
              <div key={i} className="flex gap-3">
                <div className="mt-2 w-6 h-6 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center text-sm font-bold shrink-0">{i + 1}</div>
                {isEditing ? (
                  <>
                    <textarea className="input flex-1 min-h-[60px]" value={step} onChange={e => updateInstruction(i, e.target.value)} />
                    <button onClick={() => removeInstruction(i)} className="p-2 text-red-500 hover:bg-red-50 rounded h-fit"><Trash2 className="w-5 h-5"/></button>
                  </>
                ) : (
                  <div className="p-2 flex-1 pt-2">{step}</div>
                )}
              </div>
            ))}
          </div>
          {isEditing && (
            <button onClick={addInstruction} className="mt-3 text-sm text-blue-600 flex items-center gap-1 hover:underline">
              <Plus className="w-4 h-4"/> Add Step
            </button>
          )}
        </div>

      </div>

      {!savedRecipe ? <div className="mt-8 pt-6 border-t flex flex-col sm:flex-row gap-4">
        <button onClick={onStartOver} className="btn-secondary flex-1 py-3">Start Over</button>
        <button onClick={handleSave} disabled={loading} className="btn-primary flex-1 py-3 shadow-md text-lg">
          {loading ? 'Saving...' : 'Confirm & Save'}
        </button>
      </div> : <div className="mt-8 space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div><h3 className="font-bold text-emerald-950">Recipe saved — share it with your people</h3><p className="text-sm text-emerald-800">Send the full recipe to a private friends or relatives group.</p></div>
        {groups.length ? <div className="flex flex-col gap-2 sm:flex-row"><select className="input flex-1" value={selectedGroup} onChange={e => setSelectedGroup(e.target.value)}><option value="">Choose a group</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name} · {group.kind}</option>)}</select><button onClick={handleShare} disabled={!selectedGroup || sharing} className="btn-primary"><Share2 className="h-4 w-4" />{sharing ? 'Sharing…' : 'Share recipe'}</button></div> : <p className="text-sm text-emerald-900">Create a friends or relatives group first to share this recipe.</p>}
        <div className="flex gap-2"><button onClick={() => navigate(`/recipes/${savedRecipe.id}`)} className="btn-secondary">Open saved recipe</button><button onClick={onStartOver} className="btn-secondary">Make another recipe</button></div>
      </div>}
    </div>
  );
}
