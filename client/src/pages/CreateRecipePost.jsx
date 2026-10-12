import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { ArrowLeft, Send, Sparkles, ChefHat, Users, ImagePlus, Trash2 } from 'lucide-react';

export default function CreateRecipePost() {
  const [tab, setTab] = useState('share'); // 'share' | 'request'
  const [content, setContent] = useState('');
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [recipeId, setRecipeId] = useState('');
  const [myRecipes, setMyRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return undefined; }
    const preview = URL.createObjectURL(photo);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo]);

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
      let uploadedImage = null;
      if (photo) {
        const form = new FormData();
        form.append('image', photo);
        const upload = await api.post('/recipes/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploadedImage = upload.data.image;
      }
      await api.post('/community/posts', {
        type: tab,
        content,
        recipeId: tab === 'share' && recipeId ? recipeId : undefined,
        image: uploadedImage
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
                  <p className="label">Add a photo of your food</p>
                  <label className="btn-secondary min-h-11 cursor-pointer">
                    <ImagePlus className="h-4 w-4" /> Choose food photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) {
                        toast.error('Choose a JPG, PNG, or WebP photo under 6 MB.');
                        event.target.value = '';
                        return;
                      }
                      setPhoto(file);
                    }} />
                  </label>
                  {photo && <div className="mt-3 flex items-center gap-3"><img src={photoPreview} alt="Food photo preview" className="h-24 w-24 rounded-xl object-cover" /><span className="min-w-0 flex-1 truncate text-sm text-primary-800">{photo.name}</span><button type="button" onClick={() => setPhoto(null)} className="btn-ghost text-xs"><Trash2 className="h-4 w-4" /> Remove</button></div>}
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
                <div>
                  <p className="label">Add a helpful food photo (optional)</p>
                  <label className="btn-secondary min-h-11 cursor-pointer">
                    <ImagePlus className="h-4 w-4" /> Choose photo
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) {
                        toast.error('Choose a JPG, PNG, or WebP photo under 6 MB.');
                        event.target.value = '';
                        return;
                      }
                      setPhoto(file);
                    }} />
                  </label>
                  {photo && <div className="mt-3 flex items-center gap-3"><img src={photoPreview} alt="Food photo preview" className="h-24 w-24 rounded-xl object-cover" /><span className="min-w-0 flex-1 truncate text-sm text-primary-800">{photo.name}</span><button type="button" onClick={() => setPhoto(null)} className="btn-ghost text-xs"><Trash2 className="h-4 w-4" /> Remove</button></div>}
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
