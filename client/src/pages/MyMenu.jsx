import React, { useState, useEffect } from 'react';
import { Plus, Trash2, ChevronLeft, ChevronRight, ShoppingBag, CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../lib/api';
import toast from 'react-hot-toast';
import RecipePhoto from '../components/RecipePhoto';

const localDateKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const MyMenu = () => {
  const [menuItems, setMenuItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  // Recipe Picker State
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerDate, setPickerDate] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState('');

  const fetchMenu = async () => {
    try {
      setLoading(true);
      const dateStr = localDateKey(currentWeekStart);
      const res = await api.get(`/menu?weekStart=${dateStr}`);
      setMenuItems(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error(error);
      toast.error('Failed to load menu');
    } finally {
      setLoading(false);
    }
  };

  const fetchRecipes = async () => {
    try {
      const [savedRes, myRes] = await Promise.all([
        api.get('/recipes/saved/list'),
        api.get('/recipes/my/recipes')
      ]);
      
      const allRecipes = [
        ...(Array.isArray(savedRes.data) ? savedRes.data : savedRes.data?.recipes || []),
        ...(Array.isArray(myRes.data) ? myRes.data : myRes.data?.recipes || [])
      ];
      // Deduplicate by ID
      const unique = Array.from(new Map(allRecipes.map(r => [r.id, r])).values());
      setRecipes(unique);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    fetchMenu();
  }, [currentWeekStart]);

  const handlePrevWeek = () => {
    setCurrentWeekStart(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() - 7));
  };

  const handleNextWeek = () => {
    setCurrentWeekStart(prev => new Date(prev.getFullYear(), prev.getMonth(), prev.getDate() + 7));
  };

  const handleCurrentWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    setCurrentWeekStart(new Date(today.setDate(diff)));
  };

  const openPicker = (dateStr) => {
    setPickerDate(dateStr);
    if (recipes.length === 0) fetchRecipes();
    setPickerOpen(true);
  };

  const handleSelectRecipe = async (recipe) => {
    // Duplicate check in current week
    const isDuplicate = menuItems.some(item => item.recipeId === recipe.id);
    if (isDuplicate) {
      if (!window.confirm(`${recipe.title} is already on your menu this week. Add again?`)) {
        return;
      }
    }

    try {
      await api.post('/menu', { recipeId: recipe.id, date: pickerDate });
      toast.success('Added to menu');
      setPickerOpen(false);
      fetchMenu();
    } catch (error) {
      console.error(error);
      toast.error('Failed to add to menu');
    }
  };

  const handleRemove = async (id) => {
    try {
      await api.delete(`/menu/${id}`);
      toast.success('Removed from menu');
      fetchMenu();
    } catch (error) {
      console.error(error);
      toast.error('Failed to remove');
    }
  };

  const checkIngredients = async (menuItem) => {
    try {
      const res = await api.post('/menu/check-ingredients', { recipeId: menuItem.recipeId });
      if (res.data.missing.length === 0) {
        toast.success('You have all ingredients!');
      } else {
        const count = res.data.missing.length;
        if (window.confirm(`You are missing ${count} ingredients. Add to shopping cart?`)) {
          await api.post('/shopping/bulk', { items: res.data.missing });
          toast.success('Added to shopping cart');
        }
      }
    } catch (error) {
      toast.error('Failed to check ingredients');
    }
  };

  const getWeekDays = () => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentWeekStart);
      d.setDate(d.getDate() + i);
      return {
        name: d.toLocaleDateString('en-US', { weekday: 'short' }),
        dateString: localDateKey(d),
        displayDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      };
    });
  };

  const weekDays = getWeekDays();
  const filteredRecipes = recipes.filter(r => String(r.title || r.name || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-shell max-w-6xl">
      <div className="page-heading flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 p-5 sm:p-7">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-primary-800 shadow-sm"><CalendarDays size={23} /></span>
          <div><h1 className="page-title">My meal calendar</h1><p className="page-subtitle">See and manage meals for each day of the week.</p></div>
        </div>

        <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-primary-200 shadow-sm">
          <button type="button" aria-label="Previous week" onClick={handlePrevWeek} className="btn-ghost min-h-10 p-2">
            <ChevronLeft size={20} />
          </button>
          <button type="button" onClick={handleCurrentWeek} className="btn-secondary min-h-10 whitespace-nowrap border-0 shadow-none px-3 py-2 text-xs sm:text-sm">
            Current Week
          </button>
          <button type="button" aria-label="Next week" onClick={handleNextWeek} className="btn-ghost min-h-10 p-2">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-10">Loading menu...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {weekDays.map(day => {
            const dayItems = menuItems.filter(item => String(item.date || '').slice(0, 10) === day.dateString);
            
            return (
              <div key={day.dateString} className="card p-0 flex flex-col h-full bg-white border-primary-200 overflow-hidden">
                <div className="bg-primary-50/70 px-4 py-3 border-b border-primary-100 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-primary-950">{day.name}</span>
                    <span className="text-sm text-primary-600 ml-2">{day.displayDate}</span>
                  </div>
                  <button 
                    type="button"
                    aria-label={`Add a meal for ${day.name}, ${day.displayDate}`}
                    onClick={() => openPicker(day.dateString)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white border border-primary-200 text-primary-800 hover:bg-primary-100 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                
                <div className="p-3 flex-1 flex flex-col gap-3 min-h-[120px]">
                  {dayItems.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-primary-500 py-4 border border-dashed border-primary-200 rounded-xl bg-[#FFFCFA]">
                      <CalendarDays size={19} className="mb-2 text-primary-300" aria-hidden="true" />
                      <p className="text-sm">No meals planned</p>
                    </div>
                  ) : (
                    dayItems.map(item => (
                      <div key={item.id} className="border border-primary-100 rounded-xl p-3 bg-white shadow-sm relative group">
                        <Link to={`/recipes/${item.recipeId}`} className="font-semibold text-primary-950 hover:text-primary-800 mb-1 block pr-8 truncate">
                          {item.recipe?.title || item.recipe?.name || 'Unknown Recipe'}
                        </Link>
                        
                        <div className="flex justify-between items-center mt-2">
                          <button 
                            onClick={() => checkIngredients(item)}
                            className="btn-ghost min-h-8 px-2 py-1 text-xs"
                          >
                            <ShoppingBag size={12} className="mr-1" />
                            Check Items
                          </button>
                        </div>
                        
                        <button 
                          onClick={() => handleRemove(item.id)}
                          type="button"
                          aria-label={`Remove ${item.recipe?.title || item.recipe?.name || 'meal'} from ${day.name}`}
                          title="Remove meal"
                          className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg text-primary-400 hover:text-red-700 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recipe Picker Modal */}
      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg flex flex-col max-h-[80vh]">
            <div className="p-4 border-b flex justify-between items-center">
              <h3 className="font-semibold text-lg">Select Recipe</h3>
              <button onClick={() => setPickerOpen(false)} className="p-1 hover:bg-gray-100 rounded-full">
                ✕
              </button>
            </div>
            
            <div className="p-4 border-b">
              <input
                type="text"
                placeholder="Search your recipes..."
                className="input w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            
            <div className="overflow-y-auto p-4 flex-1 space-y-2">
              {filteredRecipes.length === 0 ? (
                <p className="text-center py-4 text-gray-500">No recipes found. Save some first!</p>
              ) : (
                filteredRecipes.map(recipe => (
                  <button
                    key={recipe.id}
                    onClick={() => handleSelectRecipe(recipe)}
                    className="w-full text-left flex items-center p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="w-12 h-12 bg-gray-200 rounded-md overflow-hidden mr-4 flex-shrink-0">
                      {recipe.image || recipe.name ? (
                        <RecipePhoto recipe={recipe} alt={recipe.title || recipe.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">🍽️</div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 truncate">{recipe.title || recipe.name}</p>
                      <p className="text-xs text-gray-500 truncate">{recipe.prepTime}m • {recipe.servings} servings</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyMenu;
