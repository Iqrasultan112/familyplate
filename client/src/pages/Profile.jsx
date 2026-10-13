import React, { useState, useEffect, useRef } from 'react';
import { Camera, LogOut, Edit2, Check, X, Palette } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';
import api from '../lib/api';
import toast from 'react-hot-toast';
import RecipeCard from '../components/RecipeCard';
import { themes, useTheme } from '../contexts/ThemeContext';

const Profile = () => {
  const { user, logout, updateUser } = useAuthStore();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const { theme, setTheme } = useTheme();

  const [stats, setStats] = useState({ myRecipes: 0, savedRecipes: 0 });
  const [activeTab, setActiveTab] = useState('myRecipes'); // myRecipes, savedRecipes, myMenu
  
  const [myRecipes, setMyRecipes] = useState([]);
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [myMenu, setMyMenu] = useState([]);
  const [foodProfile, setFoodProfile] = useState({ allergies: [], dietaryPreferences: [], dislikes: '' });
  const [foodProfileDraft, setFoodProfileDraft] = useState({ allergies: '', dietaryPreferences: '', dislikes: '' });
  const [editingFoodProfile, setEditingFoodProfile] = useState(false);
  const [savingFoodProfile, setSavingFoodProfile] = useState(false);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  useEffect(() => {
    if (user) {
      setEditName(user.name);
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      const [myRes, savedRes, menuRes, profileRes] = await Promise.all([
        api.get('/recipes/my/recipes'),
        api.get('/recipes/saved/list'),
        api.get('/menu'),
        api.get('/profile')
      ]);
      setMyRecipes(myRes.data);
      setSavedRecipes(savedRes.data);
      setMyMenu(menuRes.data);
      const profile = profileRes.data || {};
      const normalizedProfile = {
        allergies: Array.isArray(profile.allergies) ? profile.allergies : [],
        dietaryPreferences: Array.isArray(profile.dietaryPreferences) ? profile.dietaryPreferences : [],
        dislikes: profile.dislikes || ''
      };
      setFoodProfile(normalizedProfile);
      setFoodProfileDraft({
        allergies: normalizedProfile.allergies.join(', '),
        dietaryPreferences: normalizedProfile.dietaryPreferences.join(', '),
        dislikes: normalizedProfile.dislikes
      });
      setStats({
        myRecipes: myRes.data.length,
        savedRecipes: savedRes.data.length,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveFoodProfile = async () => {
    setSavingFoodProfile(true);
    const toList = value => value.split(/[\n,;]/).map(item => item.trim()).filter(Boolean);
    try {
      const { data } = await api.put('/profile', {
        allergies: toList(foodProfileDraft.allergies),
        dietaryPreferences: toList(foodProfileDraft.dietaryPreferences),
        dislikes: foodProfileDraft.dislikes.trim()
      });
      const updated = {
        allergies: Array.isArray(data.allergies) ? data.allergies : [],
        dietaryPreferences: Array.isArray(data.dietaryPreferences) ? data.dietaryPreferences : [],
        dislikes: data.dislikes || ''
      };
      setFoodProfile(updated);
      updateUser(data);
      setFoodProfileDraft({ allergies: updated.allergies.join(', '), dietaryPreferences: updated.dietaryPreferences.join(', '), dislikes: updated.dislikes });
      setEditingFoodProfile(false);
      toast.success('Food profile updated');
    } catch (error) { toast.error(error.response?.data?.error || 'Could not update food profile'); }
    finally { setSavingFoodProfile(false); }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSaveProfile = async () => {
    try {
      const { data } = await api.put('/profile', { name: editName });
      updateUser(data);
      toast.success('Profile updated');
      setIsEditing(false);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update profile');
    }
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('avatar', file);

    try {
      const { data } = await api.post('/profile/avatar', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      updateUser(data);
      toast.success('Avatar updated');
    } catch (error) {
      toast.error('Failed to update avatar');
    }
  };

  if (!user) return <div className="p-8 text-center">Loading profile...</div>;

  const initials = user.name ? user.name.charAt(0).toUpperCase() : '?';

  return (
    <div className="page-shell max-w-5xl">
      {/* Profile Header */}
      <div className="card page-heading p-6 md:p-8 mb-8">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6 relative">
          
          <div className="relative group">
            <div className="w-24 h-24 md:w-32 md:h-32 rounded-full overflow-hidden bg-primary text-primary-foreground flex items-center justify-center text-4xl font-bold shadow-md">
              {user.avatar ? (
                <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
              ) : (
                initials
              )}
            </div>
            {isEditing && (
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                <Camera size={24} />
              </button>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              accept="image/*"
              onChange={handleAvatarChange}
            />
          </div>

          <div className="flex-1 text-center md:text-left w-full">
            {isEditing ? (
              <div className="space-y-3 max-w-sm mx-auto md:mx-0">
                <input
                  type="text"
                  className="input w-full"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Name"
                />
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">{user.email}<span className="mt-0.5 block text-xs text-slate-500">Account email cannot be changed here</span></p>
                <div className="flex gap-2 pt-2">
                  <button onClick={handleSaveProfile} className="btn-primary flex-1 flex items-center justify-center gap-1">
                    <Check size={16} /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)} className="btn-secondary flex-1 flex items-center justify-center gap-1">
                    <X size={16} /> Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-3xl font-bold text-gray-900 mb-1">{user.name}</h1>
                <p className="text-gray-500 mb-4">{user.email}</p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 mb-4">
                  <div className="bg-gray-50 px-4 py-2 rounded-lg border text-center">
                    <div className="text-xl font-bold text-primary">{stats.myRecipes}</div>
                    <div className="text-xs text-gray-500 uppercase font-semibold">My Recipes</div>
                  </div>
                  <div className="bg-gray-50 px-4 py-2 rounded-lg border text-center">
                    <div className="text-xl font-bold text-primary">{stats.savedRecipes}</div>
                    <div className="text-xs text-gray-500 uppercase font-semibold">Saved</div>
                  </div>
                </div>
                <button 
                  onClick={() => setIsEditing(true)} 
                  className="text-sm text-primary font-medium flex items-center gap-1 hover:underline mx-auto md:mx-0"
                >
                  <Edit2 size={14} /> Edit Profile
                </button>
              </>
            )}
          </div>
          
          <div className="md:absolute top-0 right-0">
            <button 
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium text-sm"
            >
              <LogOut size={16} />
              Logout
            </button>
          </div>
        </div>
      </div>

      <section className="card mb-8 p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="inline-flex rounded-full bg-primary-50 px-3 py-1 text-xs font-bold text-primary-800">{user.role === 'maker' ? 'Family meal planner' : 'Family member'}</span>
            <h2 className="mt-3 text-xl font-bold text-gray-900">{user.role === 'maker' ? 'My food profile' : 'My food needs'}</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600">{user.role === 'maker' ? 'Your own food needs are included when you plan meals for the household.' : 'Only you and your family meal planner can see these details. They help your household choose suitable meals.'}</p>
          </div>
          {!editingFoodProfile && <button onClick={() => setEditingFoodProfile(true)} className="btn-secondary shrink-0"><Edit2 size={15} /> Edit my food profile</button>}
        </div>
        {editingFoodProfile ? <div className="mt-5 grid gap-4 md:grid-cols-3">
          <label className="text-sm font-semibold text-gray-700">Allergies<textarea className="input mt-1 min-h-24 w-full font-normal" value={foodProfileDraft.allergies} onChange={event => setFoodProfileDraft(value => ({ ...value, allergies: event.target.value }))} placeholder="For example: peanuts, shellfish" /></label>
          <label className="text-sm font-semibold text-gray-700">Dietary preferences<textarea className="input mt-1 min-h-24 w-full font-normal" value={foodProfileDraft.dietaryPreferences} onChange={event => setFoodProfileDraft(value => ({ ...value, dietaryPreferences: event.target.value }))} placeholder="For example: vegetarian, less spicy" /></label>
          <label className="text-sm font-semibold text-gray-700">Foods I dislike<textarea className="input mt-1 min-h-24 w-full font-normal" value={foodProfileDraft.dislikes} onChange={event => setFoodProfileDraft(value => ({ ...value, dislikes: event.target.value }))} placeholder="For example: mushrooms, karela" /></label>
          <div className="flex gap-2 md:col-span-3"><button onClick={handleSaveFoodProfile} disabled={savingFoodProfile} className="btn-primary">{savingFoodProfile ? 'Saving…' : 'Save food profile'}</button><button onClick={() => { setEditingFoodProfile(false); setFoodProfileDraft({ allergies: foodProfile.allergies.join(', '), dietaryPreferences: foodProfile.dietaryPreferences.join(', '), dislikes: foodProfile.dislikes }); }} className="btn-secondary">Cancel</button></div>
        </div> : <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[['Allergies', foodProfile.allergies], ['Dietary preferences', foodProfile.dietaryPreferences], ['Foods I dislike', foodProfile.dislikes ? foodProfile.dislikes.split(/[\n,;]/).map(item => item.trim()).filter(Boolean) : []]].map(([label, items]) => <div key={label} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-sm text-slate-800">{items.length ? items.join(', ') : 'Nothing added yet'}</p></div>)}
        </div>}
      </section>

      <section className="card mb-8 p-5 md:p-6" aria-labelledby="theme-heading">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-50 text-primary-800"><Palette size={19} /></span>
          <div><h2 id="theme-heading" className="text-xl font-bold text-gray-900">Choose your theme</h2><p className="mt-1 text-sm text-gray-600">Pick a color style that feels right. Your choice is saved for this account.</p></div>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {themes.map(option => <button key={option.id} type="button" onClick={() => setTheme(option.id)} aria-pressed={theme === option.id} className={`flex min-h-16 items-center gap-3 rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${theme === option.id ? 'border-primary-700 ring-2 ring-primary-200' : 'border-slate-200'}`}>
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-black/10"><i className="w-1/2" style={{ backgroundColor: option.colors[0] }} /><i className="w-1/2" style={{ backgroundColor: option.colors[1] }} /></span>
            <span className="text-sm font-semibold text-slate-800">{option.name}{theme === option.id && <span className="block text-xs font-medium text-primary-700">Selected</span>}</span>
          </button>)}
        </div>
      </section>

      {/* Tabs */}
      <div className="border-b mb-6 flex overflow-x-auto">
        <button 
          onClick={() => setActiveTab('myRecipes')}
          className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'myRecipes' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          My Recipes
        </button>
        <button 
          onClick={() => setActiveTab('savedRecipes')}
          className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'savedRecipes' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          Saved Recipes
        </button>
        <button 
          onClick={() => setActiveTab('myMenu')}
          className={`px-6 py-3 font-medium whitespace-nowrap border-b-2 transition-colors ${activeTab === 'myMenu' ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
        >
          My Menu (This Week)
        </button>
      </div>

      {/* Tab Content */}
      <div className="min-h-[300px]">
        {activeTab === 'myRecipes' && (
          <div>
            {myRecipes.length === 0 ? (
              <p className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">You haven't created any recipes yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {myRecipes.map(recipe => (
                  <RecipeCard key={recipe.id} recipe={recipe} showActions={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'savedRecipes' && (
          <div>
            {savedRecipes.length === 0 ? (
              <p className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">You haven't saved any recipes yet.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedRecipes.map(recipe => (
                  <RecipeCard key={recipe.id} recipe={recipe} showActions={false} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'myMenu' && (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            {myMenu.length === 0 ? (
              <p className="text-center py-8 text-gray-500">No meals planned for this week.</p>
            ) : (
              <ul className="divide-y">
                {myMenu.map(item => (
                  <li key={item.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div>
                      <p className="font-semibold text-gray-800">{new Date(item.date).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p>
                      <p className="text-gray-600">{item.recipe?.title}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Profile;
