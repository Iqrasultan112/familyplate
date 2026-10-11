import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { ArrowLeft, Send, Sparkles, ChefHat, Users } from 'lucide-react';

export default function CreateRecipePost() {
  const [tab, setTab] = useState('share'); // 'share' | 'request'
  const [content, setContent] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [myRecipes, setMyRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (tab === 'share') fetchMyRecipes();
  }, [tab]);

  const fetchMyRecipes = async () => {
    try {
      const res = await api.get('/recipes/my/recipes');
      setMyRecipes(res.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) { toast.error('Please enter some text'); return; }

    setLoading(true);
    try {
      await api.post('/community/posts', {
        type: tab,
        content,
        recipeId: tab === 'share' && recipeId ? recipeId : undefined
      });
      toast.success('Post created successfully!');
      navigate('/community');
    } catch (err) {
      toast.error('Failed to create post');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell max-w-2xl space-y-6">
      
      {/* Header */}
      <div className="page-heading flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="btn-ghost p-2">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="page-title">New Post</h1>
          <p className="page-subtitle">Share your culinary creations or ask the community</p>
        </div>
      </div>

      <div className="card overflow-hidden p-0">
        <div className="flex border-b border-primary-100">
          <button 
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              tab === 'share' ? 'bg-primary-50 text-primary-900 border-b-2 border-primary-600' : 'text-primary-600 hover:bg-primary-50'
            }`}
            onClick={() => setTab('share')}
          >
            <ChefHat className="w-4 h-4" /> Share Recipe
          </button>
          <button 
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
              tab === 'request' ? 'bg-primary-50 text-primary-900 border-b-2 border-primary-600' : 'text-primary-600 hover:bg-primary-50'
            }`}
            onClick={() => setTab('request')}
          >
            <Users className="w-4 h-4" /> Ask Community
          </button>
        </div>

        <div className="p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {tab === 'share' ? (
              <>
                <div>
                  <label className="label">Caption / Description</label>
                  <textarea 
                    className="input min-h-[140px] resize-none" 
                    placeholder="Tell us about this dish! Was it a family hit?"
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>

                <div>
                  <label className="label">Attach a Saved Recipe (Optional)</label>
                  <select 
                    className="input" 
                    value={recipeId} 
                    onChange={(e) => setRecipeId(e.target.value)}
                  >
                    <option value="">— No recipe attached —</option>
                    {myRecipes.map(r => (
                      <option key={r.id} value={r.id}>{r.name || r.title}</option>
                    ))}
                  </select>
                </div>
                
                <div className="flex items-start gap-2 bg-primary-50 rounded-xl p-4 text-xs text-primary-700">
                  <Sparkles className="w-4 h-4 shrink-0 text-primary-600 mt-0.5" />
                  <p>
                    Don't have the recipe saved? Use the <button type="button" onClick={() => navigate('/recipes/ai')} className="font-bold underline hover:text-primary-900">AI Recipe Processor</button> to parse it from text or voice first.
                  </p>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="label">What are you looking for?</label>
                  <textarea 
                    className="input min-h-[180px] resize-none" 
                    placeholder="E.g., I'm looking for a quick, kid-friendly dinner that takes under 30 minutes..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                </div>
              </>
            )}

            <div className="pt-2 flex justify-end">
              <button type="submit" disabled={loading} className="btn-primary w-full sm:w-auto px-8 py-3.5">
                {loading ? (
                  <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Posting…</>
                ) : (
                  <><Send className="w-4 h-4" /> Publish Post</>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
