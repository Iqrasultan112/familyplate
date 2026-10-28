import React, { useState, useEffect } from 'react';
import { Plus, Trash2, CheckCircle2, Circle, ShoppingCart, ExternalLink, Store } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { MARKETPLACE_OPTIONS, getMarketplaceSearchUrl } from '../lib/marketplaceLinks';

export default function ShoppingCartPage() {
  const [items, setItems]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [addQty, setAddQty]   = useState('');
  const [adding, setAdding]   = useState(false);
  const [marketplace, setMarketplace] = useState(() => {
    try { return localStorage.getItem('familyplate:shopping-marketplace') || 'all'; }
    catch { return 'all'; }
  });

  useEffect(() => {
    try { localStorage.setItem('familyplate:shopping-marketplace', marketplace); }
    catch {}
  }, [marketplace]);

  const fetchCart = async () => {
    try { setLoading(true); const res = await api.get('/shopping'); setItems(res.data || []); }
    catch { toast.error('Failed to load shopping list'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchCart(); }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    try {
      await api.post('/shopping', { ingredient: addName, quantity: addQty });
      toast.success('Item added');
      setAddName(''); setAddQty('');
      fetchCart();
    } catch { toast.error('Failed to add item'); }
    finally { setAdding(false); }
  };

  const togglePurchased = async (id, cur) => {
    try {
      await api.patch(`/shopping/${id}`, { isPurchased: !cur });
      setItems(items.map(i => i.id === id ? { ...i, isPurchased: !cur } : i));
    } catch { toast.error('Failed to update'); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/shopping/${id}`); setItems(items.filter(i => i.id !== id)); }
    catch { toast.error('Failed to delete'); }
  };

  const clearPurchased = async () => {
    try { await api.delete('/shopping/purchased/clear'); toast.success('Cleared'); fetchCart(); }
    catch { toast.error('Failed to clear'); }
  };

  const toBuy     = items.filter(i => !i.isPurchased);
  const purchased = items.filter(i => i.isPurchased);
  const progress  = items.length > 0 ? Math.round((purchased.length / items.length) * 100) : 0;

  return (
    <div className="page-shell max-w-2xl space-y-6">

      {/* Header */}
      <div className="page-heading flex items-center justify-between">
        <div>
          <h1 className="page-title">Shopping List</h1>
          <p className="page-subtitle">{toBuy.length} item{toBuy.length !== 1 ? 's' : ''} remaining to purchase</p>
        </div>
        {purchased.length > 0 && (
          <button onClick={clearPurchased}
            className="text-xs font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors border border-red-100">
            Clear Purchased
          </button>
        )}
      </div>

      {/* Progress */}
      {items.length > 0 && (
        <div className="card p-4">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Shopping Progress</span>
            <span className="text-xs font-bold text-primary-600">{progress}% complete</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-1.5">
            <div
              className="bg-primary-600 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between text-[11px] text-slate-400 mt-2">
            <span>{purchased.length} purchased</span>
            <span>{toBuy.length} remaining</span>
          </div>
        </div>
      )}

      {/* Add item */}
      <div className="card p-4">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Item</p>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text" placeholder="Ingredient name…" required
            className="input flex-1"
            value={addName} onChange={e => setAddName(e.target.value)}
          />
          <input
            type="text" placeholder="Qty"
            className="input w-20"
            value={addQty} onChange={e => setAddQty(e.target.value)}
          />
          <button type="submit" disabled={adding} className="btn-primary px-3 shrink-0">
            {adding
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />
            }
          </button>
        </form>
      </div>

      {toBuy.length > 0 && (
        <div className="card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-xl bg-emerald-50 p-2 text-emerald-700"><Store className="h-4 w-4" /></span>
            <div>
              <label htmlFor="shopping-marketplace" className="block text-sm font-semibold text-slate-800">Shop from a marketplace</label>
              <p className="mt-0.5 text-xs leading-5 text-slate-500">Choose a store, then use Shop beside an item to find it.</p>
            </div>
          </div>
          <select
            id="shopping-marketplace"
            className="input w-full sm:max-w-xs"
            value={marketplace}
            onChange={event => setMarketplace(event.target.value)}
          >
            {MARKETPLACE_OPTIONS.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <p className="text-xs leading-5 text-slate-500 sm:hidden">FamilyPlate opens product search; add items and checkout on the store’s site.</p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 bg-white border border-dashed border-slate-200 rounded-2xl">
          <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShoppingCart className="w-6 h-6 text-slate-400" />
          </div>
          <p className="font-semibold text-slate-700">Your shopping list is empty</p>
          <p className="text-sm text-slate-400 mt-1">
            Items auto-fill from ingredient checks on recipes
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* To buy */}
          {toBuy.length > 0 && (
            <div className="card overflow-hidden p-0">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                  <Circle className="w-3.5 h-3.5" /> To Purchase
                </span>
                <span className="badge-slate">{toBuy.length}</span>
              </div>
              <ul className="divide-y divide-slate-50">
                {toBuy.map(item => (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-3.5 transition-colors hover:bg-slate-50 group sm:gap-3 sm:px-4">
                    <button onClick={() => togglePurchased(item.id, item.isPurchased)}
                      className="text-slate-300 hover:text-primary-500 transition-colors shrink-0">
                      <Circle className="w-5 h-5" />
                    </button>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800">{item.ingredient}</span>
                      {item.quantity && (
                        <span className="ml-2 text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">{item.quantity}</span>
                      )}
                    </div>
                    <a
                      href={getMarketplaceSearchUrl(marketplace, item.ingredient)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-lg border border-emerald-200 bg-white px-2 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 sm:px-2.5"
                      aria-label={`Find ${item.ingredient} on ${MARKETPLACE_OPTIONS.find(option => option.value === marketplace)?.label || 'a marketplace'}`}
                      title="Find this item on the selected marketplace"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      Shop
                    </a>
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all sm:opacity-0 sm:group-hover:opacity-100">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <p className="border-t border-slate-100 px-4 py-2.5 text-xs leading-5 text-slate-500">Shop opens product results on the selected marketplace. Add the item to that store’s cart and complete checkout there.</p>
            </div>
          )}

          {/* Purchased */}
          {purchased.length > 0 && (
            <div className="bg-white border border-emerald-100 rounded-2xl overflow-hidden opacity-70">
              <div className="flex items-center justify-between px-4 py-3 border-b border-emerald-100 bg-emerald-50/40">
                <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Purchased
                </span>
                <span className="text-xs font-semibold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">{purchased.length}</span>
              </div>
              <ul className="divide-y divide-slate-50">
                {purchased.map(item => (
                  <li key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 group transition-colors">
                    <button onClick={() => togglePurchased(item.id, item.isPurchased)}
                      className="text-emerald-500 shrink-0">
                      <CheckCircle2 className="w-5 h-5" />
                    </button>
                    <div className="flex-1 line-through text-slate-400 text-sm min-w-0">
                      {item.ingredient}
                      {item.quantity && <span className="ml-2 text-xs">({item.quantity})</span>}
                    </div>
                    <button onClick={() => handleDelete(item.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
