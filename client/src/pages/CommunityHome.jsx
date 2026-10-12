import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Heart, MessageCircle, Plus, Search, Clock,
  Mic, ChefHat, Users, BookOpen, Send, ImagePlus, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import useAuthStore from '../store/authStore';
import RecipePhoto from '../components/RecipePhoto';

export default function CommunityHome() {
  const [activeTab, setActiveTab]       = useState('all'); // 'all' | 'share' | 'request'
  const [posts, setPosts]               = useState([]);
  const [page, setPage]                 = useState(1);
  const [search, setSearch]             = useState('');
  const [loading, setLoading]           = useState(false);
  const [quickContent, setQuickContent] = useState('');
  const [quickImage, setQuickImage] = useState(null);
  const [quickImagePreview, setQuickImagePreview] = useState('');
  const [quickType, setQuickType]       = useState('share');
  const [quickRecipeId, setQuickRecipeId] = useState('');
  const [myRecipes, setMyRecipes]       = useState([]);
  const [submitting, setSubmitting]     = useState(false);
  const [expandedComments, setExpandedComments] = useState({}); // { [postId]: commentsArray }
  const [commentInputs, setCommentInputs]       = useState({}); // { [postId]: string }
  const [loadingComments, setLoadingComments]   = useState({});
  const navigate                        = useNavigate();
  const { user }                        = useAuthStore();

  useEffect(() => {
    if (!quickImage) { setQuickImagePreview(''); return undefined; }
    const preview = URL.createObjectURL(quickImage);
    setQuickImagePreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [quickImage]);

  useEffect(() => {
    fetchPosts(1, true);
    fetchMyRecipes();
  }, [activeTab]);

  const fetchMyRecipes = async () => {
    try {
      const res = await api.get('/recipes/my/recipes');
      setMyRecipes(res.data || []);
    } catch {}
  };

  const fetchPosts = async (pageNum, reset = false) => {
    try {
      setLoading(true);
      const params = { page: pageNum, search };
      if (activeTab !== 'all') params.type = activeTab;
      const res = await api.get('/community/posts', { params });
      const newPosts = Array.isArray(res.data) ? res.data : (res.data.posts || []);
      if (reset) setPosts(newPosts);
      else setPosts(prev => [...prev, ...newPosts]);
      setPage(pageNum);
    } catch {
      toast.error('Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchPosts(1, true);
  };

  const handleQuickPost = async (e) => {
    e.preventDefault();
    if (!quickContent.trim()) {
      toast.error('Please write something to post');
      return;
    }

    setSubmitting(true);
    try {
      let uploadedImage = null;
      if (quickImage) {
        const form = new FormData();
        form.append('image', quickImage);
        const upload = await api.post('/recipes/images', form, { headers: { 'Content-Type': 'multipart/form-data' } });
        uploadedImage = upload.data.image;
      }
      const res = await api.post('/community/posts', {
        content: quickContent.trim(),
        type: quickType,
        recipeId: quickType === 'share' && quickRecipeId ? parseInt(quickRecipeId) : undefined,
        image: uploadedImage
      });
      toast.success('Post published to community!');
      setQuickContent('');
      setQuickImage(null);
      setQuickRecipeId('');
      // Prepend to feed
      setPosts(prev => [res.data, ...prev]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create post');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleLike = async (postId) => {
    try {
      const res = await api.post(`/community/posts/${postId}/like`);
      setPosts(posts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likesCount: res.data.likes,
            isLiked: res.data.liked
          };
        }
        return p;
      }));
    } catch {
      toast.error('Failed to like post');
    }
  };

  const toggleComments = async (postId) => {
    if (expandedComments[postId]) {
      // Collapse
      const next = { ...expandedComments };
      delete next[postId];
      setExpandedComments(next);
      return;
    }

    try {
      setLoadingComments(prev => ({ ...prev, [postId]: true }));
      const res = await api.get(`/community/posts/${postId}/comments`);
      setExpandedComments(prev => ({ ...prev, [postId]: res.data || [] }));
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoadingComments(prev => ({ ...prev, [postId]: false }));
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId];
    if (!text || !text.trim()) return;

    try {
      const res = await api.post(`/community/posts/${postId}/comments`, { content: text.trim() });
      setExpandedComments(prev => ({
        ...prev,
        [postId]: [...(prev[postId] || []), res.data]
      }));
      setCommentInputs(prev => ({ ...prev, [postId]: '' }));
      setPosts(posts.map(p => p.id === postId ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p));
      toast.success('Comment added');
    } catch {
      toast.error('Failed to post comment');
    }
  };

  return (
    <div className="page-shell max-w-4xl space-y-6">

      {/* Header */}
      <div className="page-heading flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Community Kitchen</h1>
          <p className="page-subtitle">Home-cooked dishes, family recipes, dawat menus, and kitchen tips—all in one photo-friendly feed.</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/community/groups')} className="btn-secondary text-xs py-2">
            <Users className="w-3.5 h-3.5" /> Friends & family groups
          </button>
          <button onClick={() => navigate('/recipes/ai')} className="btn-secondary text-xs py-2">
            <Mic className="w-3.5 h-3.5 text-primary-700" /> AI Recipe
          </button>
          <button onClick={() => navigate('/community/create')} className="btn-primary text-xs py-2">
            <Plus className="w-3.5 h-3.5" /> Full Post
          </button>
        </div>
      </div>

      {/* Quick Post Box */}
      <div className="card p-5 border-primary-200">
        <form onSubmit={handleQuickPost} className="space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-primary-100">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-900 font-bold text-xs flex items-center justify-center">
              {user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            <span className="text-xs font-bold text-primary-950">Share with the community as {user?.name || 'You'}</span>
            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                onClick={() => setQuickType('share')}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${quickType === 'share' ? 'bg-primary-800 text-white' : 'text-primary-600 hover:bg-primary-50'}`}
              >
                Share a dish
              </button>
              <button
                type="button"
                onClick={() => setQuickType('request')}
                className={`text-xs px-2.5 py-1 rounded-lg font-semibold transition-colors ${quickType === 'request' ? 'bg-primary-800 text-white' : 'text-primary-600 hover:bg-primary-50'}`}
              >
                Ask a question
              </button>
            </div>
          </div>

          <textarea
            className="input min-h-[90px] resize-none text-sm"
            placeholder={quickType === 'share' ? "What delicious dish did you make today? Share your cooking secrets..." : "Need a quick recipe recommendation or culinary advice? Ask here..."}
            value={quickContent}
            onChange={e => setQuickContent(e.target.value)}
          />

          <div className="flex flex-wrap items-center gap-3">
            <label className="btn-secondary min-h-10 cursor-pointer px-3 py-2 text-xs">
              <ImagePlus className="h-4 w-4" /> Add a food photo
              <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 6 * 1024 * 1024) {
                  toast.error('Choose a JPG, PNG, or WebP photo under 6 MB.');
                  event.target.value = '';
                  return;
                }
                setQuickImage(file);
              }} />
            </label>
            {quickImage && <span className="text-xs text-primary-700">{quickImage.name}</span>}
            {quickImage && <button type="button" onClick={() => setQuickImage(null)} className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2 text-xs font-semibold text-primary-700 hover:bg-primary-50"><Trash2 className="h-3.5 w-3.5" />Remove photo</button>}
          </div>
          {quickImagePreview && <img src={quickImagePreview} alt="Selected food for your post" className="max-h-72 w-full rounded-2xl border border-primary-100 object-cover" />}

          {quickType === 'share' && myRecipes.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-primary-600 font-semibold">Attach Saved Recipe:</span>
              <select
                className="input py-1.5 px-3 text-xs w-auto max-w-xs"
                value={quickRecipeId}
                onChange={e => setQuickRecipeId(e.target.value)}
              >
                <option value="">— Optional: Link recipe —</option>
                {myRecipes.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting || !quickContent.trim()}
              className="btn-primary py-2 px-5 text-xs shadow-sm"
            >
              {submitting ? (
                <><span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Publishing…</>
              ) : (
                <><Send className="w-3.5 h-3.5" /> Post to Community</>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Search + Filter Tabs */}
      <div className="card overflow-hidden p-0 border-primary-200">
        <div className="p-3 border-b border-primary-100 bg-[#FFFAF5]">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search recipes, users, ingredients…"
                className="input pl-10 py-2.5 text-xs"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button type="submit" className="btn-secondary py-2 px-4 text-xs">Search</button>
          </form>
        </div>
        <div className="flex border-t border-primary-100">
          {[
            { id: 'all',     label: 'All posts',  icon: BookOpen },
            { id: 'share',   label: 'Dishes & stories',    icon: ChefHat  },
            { id: 'request', label: 'Questions',    icon: Users    },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-bold transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'border-primary-800 text-primary-950 bg-primary-50'
                  : 'border-transparent text-primary-600 hover:text-primary-900 hover:bg-primary-50'
              }`}
            >
              <tab.icon className="w-3.5 h-3.5" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Feed */}
      <div className="space-y-4">
        {posts.length === 0 && !loading && (
          <div className="text-center py-16 bg-white border border-primary-200 rounded-2xl p-6">
            <div className="w-12 h-12 bg-primary-50 border border-primary-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <BookOpen className="w-6 h-6 text-primary-700" />
            </div>
            <p className="font-bold text-primary-950">No community posts found</p>
            <p className="text-xs text-primary-600 mt-1">Be the first to share your favorite recipe with fellow food lovers!</p>
          </div>
        )}

        {posts.map(post => (
          <div key={post.id} className="card p-0 overflow-hidden border-primary-200 hover:border-primary-300 transition-all">
            {/* Post Header */}
            <div className="flex items-center gap-3 p-5 pb-3">
              {post.user?.avatar ? (
                <img src={post.user.avatar} alt="" className="w-10 h-10 rounded-full object-cover border border-primary-200" />
              ) : (
                <div className="w-10 h-10 bg-primary-100 border border-primary-200 rounded-full flex items-center justify-center font-bold text-primary-900 text-sm">
                  {post.user?.name?.[0]?.toUpperCase() || 'U'}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-primary-950 truncate">{post.user?.name || 'Community Member'}</p>
                <p className="text-[11px] text-primary-500">
                  {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
              {post.type === 'share' ? (
                <span className="badge-purple text-[10px]">{post.recipe ? 'Recipe' : 'Kitchen story'}</span>
              ) : (
                <span className="badge-amber text-[10px]">Query</span>
              )}
            </div>

            {/* Post Text */}
            <div className="px-5 pb-4">
              <p className="text-sm text-primary-900 leading-relaxed whitespace-pre-line">{post.content}</p>
            </div>

            {(post.image || post.recipe) && <div className="px-5 pb-4">
              <RecipePhoto recipe={{ name: post.recipe?.name || 'Community food photo', ingredients: post.recipe?.ingredients, image: post.image || post.recipe?.image }} alt={post.recipe?.name ? `Photo of ${post.recipe.name}` : 'Photo shared with this post'} className="max-h-[32rem] w-full rounded-2xl border border-primary-100 object-cover" loading="lazy" />
            </div>}

            {/* Attached Recipe Preview Card */}
            {post.recipe && (
              <div
                onClick={() => navigate(`/recipes/${post.recipe.id}`)}
                className="mx-5 mb-4 bg-[#F9F7F4] border border-primary-200 p-3.5 rounded-xl flex items-center gap-4 cursor-pointer hover:border-primary-400 transition-all group"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">Featured Recipe</span>
                  <p className="font-bold text-primary-950 text-sm truncate group-hover:text-primary-800 transition-colors">
                    {post.recipe.name}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-primary-600 mt-1">
                    {post.recipe.prepTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.recipe.prepTime}m prep</span>}
                    {post.recipe.cookTime && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {post.recipe.cookTime}m cook</span>}
                    {post.recipe.servings && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {post.recipe.servings} servings</span>}
                  </div>
                </div>
                <span className="text-xs font-bold text-primary-800 group-hover:translate-x-0.5 transition-transform">View Recipe →</span>
              </div>
            )}

            {/* Footer Action Bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-primary-100 bg-[#FFFAF5]">
              <div className="flex items-center gap-5">
                <button
                  onClick={() => toggleLike(post.id)}
                  className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                    post.isLiked ? 'text-red-600' : 'text-primary-600 hover:text-red-600'
                  }`}
                >
                  <Heart className={`w-4 h-4 ${post.isLiked ? 'fill-current text-red-600' : ''}`} />
                  {post.likesCount || 0}
                </button>
                <button
                  onClick={() => toggleComments(post.id)}
                  className="flex items-center gap-1.5 text-xs font-bold text-primary-600 hover:text-primary-950 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  {post.commentsCount || 0} {post.commentsCount === 1 ? 'Comment' : 'Comments'}
                </button>
              </div>
              {post.recipe && (
                <button
                  onClick={() => navigate(`/recipes/${post.recipe.id}`)}
                  className="text-xs font-bold text-primary-800 hover:underline"
                >
                  Cook this dish
                </button>
              )}
            </div>

            {/* Comments Thread Section */}
            {expandedComments[post.id] && (
              <div className="border-t border-primary-100 bg-white p-5 space-y-4">
                <p className="text-xs font-bold text-primary-900 uppercase tracking-wide">Discussion</p>
                <div className="space-y-3">
                  {expandedComments[post.id].length === 0 ? (
                    <p className="text-xs text-primary-400 italic">No comments yet. Start the conversation!</p>
                  ) : (
                    expandedComments[post.id].map(c => (
                      <div key={c.id} className="flex items-start gap-3 bg-[#FFFAF5] border border-primary-100 p-3 rounded-xl">
                        <div className="w-7 h-7 bg-primary-100 text-primary-900 font-bold text-xs rounded-full flex items-center justify-center shrink-0">
                          {c.user?.name?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-bold text-primary-950">{c.user?.name || 'User'}</p>
                            <span className="text-[10px] text-primary-400">
                              {new Date(c.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          <p className="text-xs text-primary-800 mt-1">{c.content}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Comment Input */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    placeholder="Write a comment or tip…"
                    className="input py-2 text-xs flex-1"
                    value={commentInputs[post.id] || ''}
                    onChange={e => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post.id); }}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddComment(post.id)}
                    className="btn-primary py-2 px-4 text-xs shrink-0"
                  >
                    Reply
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex justify-center py-10">
            <div className="w-5 h-5 border-2 border-primary-200 border-t-primary-800 rounded-full animate-spin" />
          </div>
        )}
      </div>
    </div>
  );
}
