import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, ChefHat, Plus, Search, SlidersHorizontal, Heart, FolderPlus, Pencil, Trash2, X, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import RecipePhoto from '../components/RecipePhoto';

const uniqueRecipes = values => Array.from(new Map(values.filter(recipe => recipe?.id).map(recipe => [String(recipe.id), recipe])).values());
const recentIds = () => { try { const parsed = JSON.parse(localStorage.getItem('familyplate:recent-recipes') || '[]'); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };

export default function SavedRecipes() {
  const [collections, setCollections] = useState([]);
  const [selectedCollection, setSelectedCollection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [family, setFamily] = useState(null);
  const [showCollectionForm, setShowCollectionForm] = useState(false);
  const [collectionDraft, setCollectionDraft] = useState('');
  const [editingCollection, setEditingCollection] = useState(null);
  const [showAddRecipes, setShowAddRecipes] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const [mineRes, favoritesRes, familyRes, customRes] = await Promise.all([
          api.get('/recipes/my/recipes').catch(() => ({ data: [] })),
          api.get('/recipes/saved/list').catch(() => ({ data: [] })),
          api.get('/family/mine').catch(() => ({ data: {} })),
          api.get('/recipes/collections').catch(() => ({ data: [] }))
        ]);
        const familyData = familyRes.data?.family || (Array.isArray(familyRes.data?.families) ? familyRes.data.families[0] : null);
        if (!active) return;
        setFamily(familyData);
        const menuRes = await api.get(familyData?.id ? `/weeklyMenu/family/${familyData.id}` : '/weeklyMenu').catch(() => ({ data: [] }));
        const menuItems = Array.isArray(menuRes.data) ? menuRes.data : [];
        const recent = await Promise.all(recentIds().slice(0, 12).map(id => api.get(`/recipes/${id}`).then(res => res.data).catch(() => null)));
        if (!active) return;
        const saved = Array.isArray(favoritesRes.data) ? favoritesRes.data : [];
        const mine = Array.isArray(mineRes.data) ? mineRes.data : [];
        const customCollections = Array.isArray(customRes.data) ? customRes.data : [];
        const planned = uniqueRecipes(menuItems.map(item => item.recipe));
        const cooked = uniqueRecipes(menuItems.filter(item => ['completed', 'cooked'].includes(item.status)).map(item => item.recipe));
        setCollections([
          { id: 'recent', title: 'Recently viewed', subtitle: `${uniqueRecipes(recent).length} recipes`, recipes: uniqueRecipes(recent), Icon: BookOpen },
          { id: 'mine', title: 'My recipes', subtitle: `${uniqueRecipes(mine).length} recipes`, recipes: uniqueRecipes(mine), Icon: ChefHat },
          { id: 'planned', title: 'Planned', subtitle: `${planned.length} recipes`, recipes: planned, Icon: CalendarDays },
          { id: 'cooked', title: 'Made it', subtitle: `${cooked.length} recipes`, recipes: cooked, Icon: ChefHat },
          { id: 'saved', title: 'Saved recipes', subtitle: `${uniqueRecipes(saved).length} recipes`, recipes: uniqueRecipes(saved), Icon: Heart },
          ...customCollections.map(collection => ({
            id: `custom-${collection.id}`, dbId: collection.id, custom: true,
            title: collection.name, subtitle: `${uniqueRecipes(collection.recipes || []).length} recipes`,
            recipes: uniqueRecipes(collection.recipes || []), Icon: FolderPlus
          }))
        ]);
      } catch { toast.error('Could not load your recipe collections'); }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, []);

  const allRecipes = useMemo(() => uniqueRecipes(collections.flatMap(collection => collection.recipes)), [collections]);
  const visibleRecipes = useMemo(() => {
    const source = selectedCollection ? selectedCollection.recipes : allRecipes;
    const term = search.trim().toLowerCase();
    if (!term) return source;
    return source.filter(recipe => `${recipe.name || recipe.title || ''} ${recipe.description || ''}`.toLowerCase().includes(term));
  }, [selectedCollection, allRecipes, search]);

  const openCreateCollection = (collection = null) => {
    setEditingCollection(collection);
    setCollectionDraft(collection?.title || '');
    setShowCollectionForm(true);
  };

  const saveCollection = async event => {
    event.preventDefault();
    const name = collectionDraft.trim();
    if (!name) return;
    try {
      if (editingCollection) {
        const { data } = await api.patch(`/recipes/collections/${editingCollection.dbId}`, { name });
        const update = collection => collection.id === editingCollection.id ? { ...collection, title: data.name } : collection;
        setCollections(previous => previous.map(update));
        setSelectedCollection(previous => previous?.id === editingCollection.id ? update(previous) : previous);
        toast.success('Collection renamed');
      } else {
        const { data } = await api.post('/recipes/collections', { name });
        const collection = { id: `custom-${data.id}`, dbId: data.id, custom: true, title: data.name, subtitle: '0 recipes', recipes: [], Icon: FolderPlus };
        setCollections(previous => [...previous, collection]);
        setSelectedCollection(collection);
        toast.success('Collection created');
      }
      setShowCollectionForm(false);
      setCollectionDraft('');
    } catch (error) { toast.error(error.response?.data?.error || 'Could not save this collection'); }
  };

  const addRecipeToCollection = async recipe => {
    if (!selectedCollection?.custom) return;
    try {
      await api.post(`/recipes/collections/${selectedCollection.dbId}/recipes`, { recipeId: recipe.id });
      const update = collection => collection.id === selectedCollection.id ? {
        ...collection,
        recipes: uniqueRecipes([recipe, ...collection.recipes]),
        subtitle: `${uniqueRecipes([recipe, ...collection.recipes]).length} recipes`
      } : collection;
      setCollections(previous => previous.map(update));
      setSelectedCollection(previous => previous ? update(previous) : previous);
      toast.success(`Added to ${selectedCollection.title}`);
    } catch (error) { toast.error(error.response?.data?.error || 'Could not add this recipe'); }
  };

  const removeRecipeFromCollection = async recipe => {
    if (!selectedCollection?.custom) return;
    try {
      await api.delete(`/recipes/collections/${selectedCollection.dbId}/recipes/${recipe.id}`);
      const update = collection => collection.id === selectedCollection.id ? {
        ...collection,
        recipes: collection.recipes.filter(item => String(item.id) !== String(recipe.id)),
        subtitle: `${collection.recipes.filter(item => String(item.id) !== String(recipe.id)).length} recipes`
      } : collection;
      setCollections(previous => previous.map(update));
      setSelectedCollection(previous => previous ? update(previous) : previous);
      toast.success('Removed from collection');
    } catch (error) { toast.error(error.response?.data?.error || 'Could not remove this recipe'); }
  };

  const deleteCollection = async () => {
    if (!selectedCollection?.custom || !window.confirm(`Delete “${selectedCollection.title}”? The recipes themselves will stay saved.`)) return;
    try {
      await api.delete(`/recipes/collections/${selectedCollection.dbId}`);
      setCollections(previous => previous.filter(collection => collection.id !== selectedCollection.id));
      setSelectedCollection(null);
      toast.success('Collection deleted');
    } catch (error) { toast.error(error.response?.data?.error || 'Could not delete this collection'); }
  };

  const addableRecipes = selectedCollection?.custom
    ? allRecipes.filter(recipe => !selectedCollection.recipes.some(item => String(item.id) === String(recipe.id)))
    : [];

  return <div className="page-shell max-w-7xl">
    <section className="min-h-[70vh] rounded-[28px] border border-[#f1d5c8] bg-[#fff9f5] px-4 py-6 text-[#44241d] shadow-sm sm:px-6 sm:py-8">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">{selectedCollection && <button onClick={() => { setSelectedCollection(null); setSearch(''); }} className="rounded-full p-2 text-[#704b40] hover:bg-[#f8e8df]" aria-label="Back to collections"><ArrowLeft className="h-5 w-5" /></button>}<div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#a34b39]">Your kitchen library</p><h1 className="mt-1 text-2xl font-bold sm:text-3xl">{selectedCollection?.title || 'Collections'}</h1>{selectedCollection && <p className="mt-1 text-sm text-[#806b63]">{selectedCollection.recipes.length} recipes in this collection</p>}</div></div>
        <div className="flex shrink-0 items-center gap-2">
          {selectedCollection?.custom && <>
            <button onClick={() => setShowAddRecipes(true)} className="flex items-center gap-2 rounded-full border border-[#e8c8b8] bg-white px-3 py-2.5 text-sm font-semibold text-[#704b40] hover:border-[#a34b39]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">Add recipes</span></button>
            <button onClick={() => openCreateCollection(selectedCollection)} className="rounded-full border border-[#e8c8b8] bg-white p-2.5 text-[#704b40] hover:text-[#a34b39]" aria-label="Rename collection"><Pencil className="h-4 w-4" /></button>
            <button onClick={deleteCollection} className="rounded-full border border-[#e8c8b8] bg-white p-2.5 text-[#704b40] hover:text-red-700" aria-label="Delete collection"><Trash2 className="h-4 w-4" /></button>
          </>}
          <button onClick={() => openCreateCollection()} className="flex items-center gap-2 rounded-full bg-[#69372b] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#542a21]"><Plus className="h-4 w-4" /><span className="hidden sm:inline">New collection</span></button>
        </div>
      </div>

      <form onSubmit={event => event.preventDefault()} className="mb-8 flex items-center gap-3">
        <label className="relative flex min-w-0 flex-1 items-center"><Search className="absolute left-4 h-5 w-5 text-[#a34b39]" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search recipes" className="w-full rounded-full border border-[#e8c8b8] bg-white py-3 pl-12 pr-4 text-sm text-[#44241d] outline-none placeholder:text-[#9a8278] focus:border-[#a34b39]" aria-label="Search recipe collections" /></label>
        <button type="button" aria-label="Recipe filters" onClick={() => toast('Search any collection by recipe name')} className="rounded-full border border-[#e8c8b8] bg-white p-3 text-[#704b40] hover:border-[#a34b39] hover:text-[#a34b39]"><SlidersHorizontal className="h-5 w-5" /></button>
      </form>

      {loading ? <div className="py-20 text-center text-[#806b63]">Loading your collections…</div> : selectedCollection || search.trim() ? (
        visibleRecipes.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{visibleRecipes.map(recipe => <article key={recipe.id} className="overflow-hidden rounded-2xl border border-[#f1d5c8] bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><button onClick={() => navigate(`/recipes/${recipe.id}`)} className="w-full text-left"><RecipePhoto recipe={recipe} alt={recipe.name} className="h-48 w-full object-cover" /><div className="p-4"><h2 className="font-semibold">{recipe.name || recipe.title}</h2><p className="mt-1 line-clamp-2 text-sm text-[#806b63]">{recipe.description || 'A recipe from your family kitchen.'}</p><span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-[#a34b39]">View recipe <ArrowRight className="h-4 w-4" /></span></div></button>{selectedCollection?.custom && <div className="border-t border-[#f1d5c8] px-4 py-2"><button onClick={() => removeRecipeFromCollection(recipe)} className="text-xs font-semibold text-[#806b63] hover:text-red-700">Remove from this collection</button></div>}</article>)}</div> : <div className="rounded-2xl border border-dashed border-[#e8c8b8] bg-white/70 px-5 py-16 text-center"><p className="font-semibold">{search ? 'No matching recipes' : 'This collection is empty'}</p><p className="mt-2 text-sm text-[#806b63]">{search ? 'Try another recipe name.' : 'Recipes will appear here as you save, plan, view, or cook them.'}</p>{selectedCollection?.custom && !search && <button onClick={() => setShowAddRecipes(true)} className="mt-4 rounded-full bg-[#69372b] px-4 py-2 text-sm font-semibold text-white">Add recipes</button>}</div>
      ) : <div className="flex gap-4 overflow-x-auto pb-4">{collections.map(collection => {
        const photos = collection.recipes.slice(0, 4);
        return <button key={collection.id} onClick={() => setSelectedCollection(collection)} className="w-[min(72vw,286px)] shrink-0 rounded-2xl p-2 text-left transition hover:bg-white">
          <div className="grid h-[min(66vw,270px)] max-h-[270px] min-h-[190px] grid-cols-2 grid-rows-2 gap-1 overflow-hidden rounded-xl bg-[#f5e7df]">
            {photos.length ? photos.map((recipe, index) => {
              const layout = photos.length === 1 ? 'col-span-2 row-span-2' : photos.length === 2 ? 'row-span-2' : photos.length === 3 && index === 0 ? 'row-span-2' : '';
              return <RecipePhoto key={recipe.id} recipe={recipe} alt={recipe.name} className={`h-full w-full object-cover ${layout}`} />;
            }) : <div className="col-span-2 row-span-2 flex flex-col items-center justify-center gap-3 bg-[#fff1e8] text-[#bd8a74]"><collection.Icon className="h-12 w-12" /><span className="text-sm">No recipes yet</span></div>}
          </div>
          <span className="mt-3 block text-lg font-semibold">{collection.title}</span><span className="mt-0.5 block text-sm text-[#806b63]">{collection.subtitle}</span>
        </button>;
      })}</div>}
      {!loading && !selectedCollection && family && <p className="mt-4 text-xs text-[#806b63]">Shared family recipes and meal history are included.</p>}
    </section>

    {showCollectionForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#44241d]/35 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowCollectionForm(false); }}>
      <form onSubmit={saveCollection} className="w-full max-w-md rounded-3xl border border-[#f1d5c8] bg-[#fffaf6] p-6 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-widest text-[#a34b39]">Your recipe library</p><h2 className="mt-1 text-xl font-bold">{editingCollection ? 'Rename collection' : 'Create a collection'}</h2><p className="mt-1 text-sm text-[#806b63]">Group recipes for a day, event, or person.</p></div><button type="button" onClick={() => setShowCollectionForm(false)} aria-label="Close" className="rounded-full p-2 text-[#806b63] hover:bg-[#f8e8df]"><X className="h-5 w-5" /></button></div>
        <label className="mb-4 block text-sm font-semibold">Collection name<input autoFocus maxLength={60} value={collectionDraft} onChange={event => setCollectionDraft(event.target.value)} placeholder="e.g. Weekend, Eid, Hamza’s Birthday" className="mt-2 w-full rounded-xl border border-[#e8c8b8] bg-white px-4 py-3 text-sm outline-none focus:border-[#a34b39]" /></label>
        {!editingCollection && <div className="mb-5 flex flex-wrap gap-2">{['Weekend', 'Eid', 'Hamza’s Birthday'].map(name => <button key={name} type="button" onClick={() => setCollectionDraft(name)} className="rounded-full border border-[#e8c8b8] bg-white px-3 py-1.5 text-xs font-semibold text-[#704b40] hover:border-[#a34b39]">{name}</button>)}</div>}
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setShowCollectionForm(false)} className="rounded-full border border-[#e8c8b8] px-4 py-2.5 text-sm font-semibold text-[#704b40]">Cancel</button><button type="submit" disabled={collectionDraft.trim().length < 2} className="flex items-center gap-2 rounded-full bg-[#69372b] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Check className="h-4 w-4" />{editingCollection ? 'Save name' : 'Create collection'}</button></div>
      </form>
    </div>}

    {showAddRecipes && selectedCollection?.custom && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#44241d]/35 p-4" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowAddRecipes(false); }}>
      <section className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-[#f1d5c8] bg-[#fffaf6] shadow-2xl" aria-labelledby="add-recipes-title">
        <div className="flex items-start justify-between gap-4 border-b border-[#f1d5c8] p-5"><div><p className="text-xs font-bold uppercase tracking-widest text-[#a34b39]">{selectedCollection.title}</p><h2 id="add-recipes-title" className="mt-1 text-xl font-bold">Add recipes</h2><p className="mt-1 text-sm text-[#806b63]">Choose from your saved, planned, and family recipes.</p></div><button onClick={() => setShowAddRecipes(false)} aria-label="Close" className="rounded-full p-2 text-[#806b63] hover:bg-[#f8e8df]"><X className="h-5 w-5" /></button></div>
        <div className="flex-1 space-y-2 overflow-y-auto p-4">{addableRecipes.length ? addableRecipes.map(recipe => <div key={recipe.id} className="flex items-center gap-3 rounded-2xl border border-[#f1d5c8] bg-white p-2"><RecipePhoto recipe={recipe} alt={recipe.name} className="h-14 w-16 shrink-0 rounded-xl object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{recipe.name || recipe.title}</p><p className="text-xs text-[#806b63]">{recipe.creator?.name || recipe.creatorName || 'Family recipe'}</p></div><button onClick={() => addRecipeToCollection(recipe)} className="flex shrink-0 items-center gap-1 rounded-full bg-[#69372b] px-3 py-2 text-xs font-semibold text-white"><Plus className="h-3.5 w-3.5" />Add</button></div>) : <div className="py-12 text-center"><p className="font-semibold">No more recipes in your library yet</p><p className="mt-2 text-sm text-[#806b63]">Find or save a recipe first, then add it to this collection.</p><button onClick={() => navigate('/recipes')} className="mt-4 rounded-full bg-[#69372b] px-4 py-2 text-sm font-semibold text-white">Find recipes</button></div>}</div>
        <div className="border-t border-[#f1d5c8] p-4 text-right"><button onClick={() => setShowAddRecipes(false)} className="rounded-full border border-[#e8c8b8] bg-white px-5 py-2.5 text-sm font-semibold text-[#704b40]">Done</button></div>
      </section>
    </div>}
  </div>;
}
