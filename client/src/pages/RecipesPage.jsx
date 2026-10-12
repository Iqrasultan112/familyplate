import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, Clock, Users, UtensilsCrossed, Sparkles } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import RecipePhoto from '../components/RecipePhoto';

export default function RecipesPage() {
  const [activeTab, setActiveTab] = useState('all'); // 'all' | 'online'
  const [recipes, setRecipes]     = useState([]);
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(false);
  const navigate                  = useNavigate();
  const isOnlineRecipe = recipe => recipe?.source === 'FamilyPlate AI' || String(recipe?.id || '').startsWith('ai-');

  useEffect(() => {
    const timer = setTimeout(() => fetchRecipes(search), search.trim() ? 300 : 0);
    return () => clearTimeout(timer);
  }, [activeTab, search]);

  const fetchRecipes = async (searchQuery = '') => {
    if (activeTab === 'online') {
      if (searchQuery.trim().length < 2) { setRecipes([]); setLoading(false); return; }
      setLoading(true);
      try {
        const res = await api.get('/ai/search-recipes', { params: { query: searchQuery.trim() } });
        setRecipes(res.data?.recipes || []);
      } catch (err) {
        setRecipes([]);
        toast.error(err.response?.data?.error || 'Online recipe search is unavailable');
      } finally { setLoading(false); }
      return;
    }
    setLoading(true);
    try {
      const res = await api.get('/recipes', { params: { search: searchQuery } });
      const dataList = Array.isArray(res.data) ? res.data : (res.data.recipes || []);
      setRecipes(dataList);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load recipes');
    } finally {
      setLoading(false);
    }
  };

  const saveOnlineRecipe = async recipe => {
    try {
      const { data } = await api.post('/recipes', {
        name: recipe.name,
        ingredients: recipe.ingredients,
        instructions: recipe.instructions.length ? recipe.instructions : ['Follow the recipe source for preparation instructions.'],
        servings: recipe.servings,
        image: recipe.image,
        sourceUrl: recipe.sourceUrl
      });
      toast.success('Recipe saved to your FamilyPlate library');
      navigate(`/recipes/${data.id}`);
    } catch (err) { toast.error(err.response?.data?.error || 'Could not save this recipe'); }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (search.trim().length < 2) {
      toast.error('Type at least two letters to search recipes');
      return;
    }
    // A search should return recipe ideas even when the household has not saved
    // that exact dish yet. The saved family collection remains in Browse recipes.
    setActiveTab('online');
  };

  return (
    <div className="page-shell space-y-6">

      {/* Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Find Recipes</h1>
          <p className="page-subtitle">Browse recipes or ask AI for a dish you can’t find.</p>
        </div>
        <button
          onClick={() => navigate('/recipes/ai')}
          className="btn-primary py-2.5 px-4 text-xs shrink-0 self-start sm:self-auto"
        >
          <Sparkles className="w-4 h-4" /> AI Recipe Creator
        </button>
      </div>

      {/* Search & Tabs */}
      <div className="card overflow-hidden p-0 border-primary-200">
        <div className="p-3 border-b border-primary-100 bg-[#F7FAF8]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
              <input
                type="text"
                placeholder={activeTab === 'online' ? 'Ask AI for recipes, e.g. chicken yakhni pulao…' : 'Search recipes or ask AI for a missing recipe…'}
                className="input pl-10 py-2.5 text-xs"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary py-2 px-4 text-xs">Search</button>
          </form>
        </div>

        <div className="flex border-t border-primary-100">
          {[
            { id: 'all',   label: 'Browse recipes' },
            { id: 'online', label: 'Ask AI' },
          ].map(tab => (
            <button
              key={tab.id}
              className={`flex-1 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-800 text-primary-950 bg-primary-50'
                  : 'border-transparent text-primary-600 hover:text-primary-900 hover:bg-primary-50'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-6 h-6 border-2 border-primary-200 border-t-primary-800 rounded-full animate-spin" />
        </div>
      ) : recipes.length === 0 ? (
        <div className="text-center py-20 bg-white border border-primary-200 rounded-2xl p-8">
          <div className="w-12 h-12 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UtensilsCrossed className="w-6 h-6 text-primary-700" />
          </div>
          <h3 className="text-lg font-bold text-primary-950 mb-1">No recipes found</h3>
          <p className="text-xs text-primary-600 mb-5">{activeTab === 'online' ? 'Describe the dish you want and AI will create complete recipe ideas.' : 'No saved match yet. Search again to get AI recipe ideas.'}</p>
          <button onClick={() => navigate('/recipes/ai')} className="btn-primary py-2.5 px-5 text-xs">
            <Plus className="w-4 h-4" /> Add Recipe
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recipes.map(recipe => (
            <div
              key={recipe.id || recipe._id || recipe.externalId}
              className="card overflow-hidden hover:shadow-card-lg border-primary-200 transition-all cursor-pointer group flex flex-col"
              onClick={() => !isOnlineRecipe(recipe) && navigate(`/recipes/${recipe.id || recipe._id}`)}
            >
              <div className="h-52 bg-primary-50 relative overflow-hidden border-b border-primary-100">
                <RecipePhoto recipe={recipe} alt={recipe.name} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                {recipe.photoSource && recipe.sourceUrl && (
                  <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="absolute bottom-2 left-2 rounded-md bg-white/90 px-2 py-1 text-[10px] font-semibold text-primary-900 shadow-sm">
                    Photo: {recipe.photoSource}
                  </a>
                )}
                  {recipe.prepTime && (
                  <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm border border-primary-200 px-2.5 py-1 rounded-lg text-[11px] font-bold text-primary-900 shadow-sm flex items-center gap-1">
                    <Clock className="w-3 h-3 text-primary-600" /> {recipe.prepTime} min
                  </div>
                )}
              </div>
              <div className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-base text-primary-950 group-hover:text-primary-800 transition-colors line-clamp-1 mb-1">
                    {recipe.name}
                  </h3>
                  <p className="text-xs text-primary-500 mb-4">
                    by {recipe.creator?.name || recipe.creatorName || 'FamilyPlate Chef'}
                  </p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-primary-100 text-xs text-primary-600">
                  <span className="flex items-center gap-1">
                    <Users className="w-3.5 h-3.5" /> {recipe.servings || '4'} Servings
                  </span>
                  {isOnlineRecipe(recipe) ? <>{recipe.sourceUrl && <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" onClick={event => event.stopPropagation()} className="font-semibold text-primary-700 underline">Source</a>}<button type="button" onClick={event => { event.stopPropagation(); saveOnlineRecipe(recipe); }} className="rounded-lg bg-primary-800 px-3 py-2 text-xs font-bold text-white">Save recipe</button></> : <span className="font-bold text-primary-800 group-hover:translate-x-0.5 transition-transform">View Recipe →</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
