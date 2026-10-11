import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Search, Check, X, Package, Upload, ListPlus, Loader2 } from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';

export default function Inventory() {
  const [inventory, setInventory] = useState([]);
  const [history, setHistory] = useState([]);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [addName, setAddName]     = useState('');
  const [addQty, setAddQty]       = useState('');
  const [adding, setAdding]       = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName]   = useState('');
  const [editQty, setEditQty]     = useState('');
  const [importText, setImportText] = useState('');
  const [receiptFile, setReceiptFile] = useState(null);
  const [importItems, setImportItems] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState('');
  const [savingImport, setSavingImport] = useState(false);
  const [billPhotoEnabled, setBillPhotoEnabled] = useState(null);

  const fetchInventory = async () => {
    try { setLoading(true); const [res, useRes] = await Promise.all([api.get('/inventory'), api.get('/inventory/history').catch(() => ({ data: [] }))]); setInventory(res.data || []); setHistory(useRes.data || []); }
    catch { toast.error('Failed to load inventory'); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchInventory(); }, []);
  useEffect(() => {
    api.get('/ai/capabilities').then(({ data }) => setBillPhotoEnabled(Boolean(data.billPhotoReading))).catch(() => setBillPhotoEnabled(false));
  }, []);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addName.trim()) return;
    setAdding(true);
    try {
      await api.post('/inventory', { ingredient: addName, quantity: addQty });
      toast.success('Item added to pantry');
      setAddName(''); setAddQty('');
      fetchInventory();
    } catch { toast.error('Failed to add'); }
    finally { setAdding(false); }
  };

  const parseGroceryText = async () => {
    if (!importText.trim()) return toast.error('Paste a grocery list first');
    setImporting(true);
    setImportMode('list');
    try {
      const { data } = await api.post('/ai/extract-groceries', { rawText: importText.trim() });
      setImportItems((data.items || []).map(item => ({ ingredient: item.ingredient, quantity: item.quantity || '1 pack' })));
      if (!data.items?.length) toast.error(data.message || 'No grocery items found. Try one item per line.');
      else toast.success(`${data.items.length} items found. Review the names and amounts.`);
    } catch (error) { toast.error(error.response?.data?.error || 'Could not read that list'); }
    finally { setImporting(false); setImportMode(''); }
  };

  const scanReceipt = async () => {
    if (!receiptFile) return toast.error('Choose a receipt or grocery-bill photo first');
    const formData = new FormData();
    formData.append('receipt', receiptFile);
    setImporting(true);
    setImportMode('bill');
    try {
      const { data } = await api.post('/ai/extract-groceries/image', formData);
      setImportItems((data.items || []).map(item => ({ ingredient: item.ingredient, quantity: item.quantity || '1 pack' })));
      if (!data.items?.length) toast.error('No grocery items found. Try a clearer photo or paste the item list.');
      else toast.success(`${data.items.length} items found. Review them before adding.`);
    } catch (error) { toast.error(error.response?.data?.error || 'Could not read that bill'); }
    finally { setImporting(false); setImportMode(''); }
  };

  const saveImportedItems = async () => {
    const items = importItems.filter(item => item.ingredient.trim());
    if (!items.length) return toast.error('Add at least one item to the review list');
    setSavingImport(true);
    try {
      const results = await Promise.allSettled(items.map(item => api.post('/inventory', { ingredient: item.ingredient.trim(), quantity: item.quantity.trim() || '1 pack' })));
      const added = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - added;
      if (added) { toast.success(`${added} pantry item${added === 1 ? '' : 's'} added`); setImportItems(items.filter((_, index) => results[index].status === 'rejected')); setImportText(''); setReceiptFile(null); await fetchInventory(); }
      if (failed) toast.error(`${failed} item${failed === 1 ? '' : 's'} could not be added. Please review and retry.`);
    } finally { setSavingImport(false); }
  };

  const handleDelete = async (id) => {
    try { await api.delete(`/inventory/${id}`); setInventory(inventory.filter(i => i.id !== id)); }
    catch { toast.error('Failed to delete'); }
  };

  const startEdit  = (item) => { setEditingId(item.id); setEditName(item.ingredient); setEditQty(item.quantity || ''); };
  const cancelEdit = ()     => { setEditingId(null); setEditName(''); setEditQty(''); };

  const saveEdit = async (id) => {
    try {
      await api.put(`/inventory/${id}`, { ingredient: editName, quantity: editQty });
      toast.success('Updated');
      setEditingId(null);
      fetchInventory();
    } catch { toast.error('Failed to update'); }
  };

  const filtered = inventory.filter(i => i.ingredient.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page-shell max-w-4xl space-y-6">

      {/* Header */}
      <div className="page-heading flex items-center justify-between">
        <div>
          <h1 className="page-title">Kitchen Stock</h1>
          <p className="page-subtitle">Track ingredients available in your pantry</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-card">
          <Package className="w-4 h-4 text-primary-500" />
          <span className="text-sm font-bold text-slate-900">{inventory.length}</span>
          <span className="text-xs text-slate-400">items</span>
        </div>
      </div>

      {/* Add form */}
      <div className="card p-5">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Add Ingredient</p>
        <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-2">
          <input
            type="text" required placeholder="Ingredient name (e.g. Flour, Tomatoes)"
            className="input flex-1"
            value={addName} onChange={e => setAddName(e.target.value)}
          />
          <input
            type="text" required placeholder="Quantity (e.g. 500g, 6 eggs)"
            className="input sm:w-36"
            value={addQty} onChange={e => setAddQty(e.target.value)}
          />
          <button type="submit" disabled={adding} className="btn-primary shrink-0">
            {adding
              ? <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : <Plus className="w-4 h-4" />}
            Add Item
          </button>
        </form>
      </div>

      <section className="card space-y-4 p-5" aria-labelledby="bulk-import-title">
        <div><h2 id="bulk-import-title" className="font-bold text-slate-900">Add a whole grocery shop</h2><p className="mt-1 text-sm text-slate-600">Paste your shopping list or choose a clear photo of the bill. Check every item before it goes into your pantry.</p></div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label htmlFor="grocery-list" className="text-sm font-semibold text-slate-700">Paste a list</label>
            <textarea id="grocery-list" className="input min-h-28 w-full" value={importText} onChange={event => setImportText(event.target.value)} placeholder={'For example:\n2 kg potatoes\n1 dozen eggs\n500 g chicken'} />
            <button type="button" onClick={parseGroceryText} disabled={importing || !importText.trim()} className="btn-secondary"><ListPlus className="h-4 w-4" />{importMode === 'list' ? 'Reading list…' : 'Read my list'}</button>
          </div>
          <div className="space-y-2">
            <label htmlFor="receipt-photo" className="text-sm font-semibold text-slate-700">Or add a bill photo</label>
            <input id="receipt-photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="input w-full file:mr-3 file:rounded-lg file:border-0 file:bg-orange-50 file:px-3 file:py-2 file:font-semibold file:text-orange-900" disabled={billPhotoEnabled !== true} onChange={event => setReceiptFile(event.target.files?.[0] || null)} />
            {billPhotoEnabled === true ? <><p className="text-xs text-slate-500">A clear, well-lit photo works best. Choosing “Read bill photo” sends it to the connected AI service to identify grocery items; review the result before saving.</p><button type="button" onClick={scanReceipt} disabled={importing || !receiptFile} className="btn-secondary"><Upload className="h-4 w-4" />{importMode === 'bill' ? 'Reading bill…' : 'Read bill photo'}</button></> : <p className="rounded-lg bg-amber-50 p-3 text-xs leading-5 text-amber-900">Bill photo reading is unavailable because FamilyPlate doesn’t have a working photo-reading service connected. Paste the bill or shopping list on the left to add its items.</p>}
          </div>
        </div>
        {importItems.length > 0 && <div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/50 p-4">
          <div><h3 className="font-semibold text-slate-900">Review items ({importItems.length})</h3><p className="text-xs text-slate-600">Correct any item or amount before adding.</p></div>
          <div className="space-y-2">{importItems.map((item, index) => <div key={`${index}-${item.ingredient}`} className="flex gap-2"><input aria-label={`Item ${index + 1}`} className="input min-w-0 flex-1 bg-white" value={item.ingredient} onChange={event => setImportItems(list => list.map((entry, i) => i === index ? { ...entry, ingredient: event.target.value } : entry))} /><input aria-label={`Amount for ${item.ingredient || `item ${index + 1}`}`} className="input w-32 bg-white" value={item.quantity} onChange={event => setImportItems(list => list.map((entry, i) => i === index ? { ...entry, quantity: event.target.value } : entry))} /><button type="button" aria-label={`Remove ${item.ingredient}`} className="btn-ghost p-2 text-red-600" onClick={() => setImportItems(list => list.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button></div>)}</div>
          <button type="button" className="btn-ghost text-sm" onClick={() => setImportItems(list => [...list, { ingredient: '', quantity: '' }])}><Plus className="h-4 w-4" /> Add a missed item</button>
          <button type="button" onClick={saveImportedItems} disabled={savingImport} className="btn-primary">{savingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}{savingImport ? 'Adding items…' : 'Add reviewed items to pantry'}</button>
        </div>}
      </section>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text" placeholder="Search pantry…"
          className="input pl-10 bg-white"
          value={search} onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-slate-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 px-6">
            <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Package className="w-6 h-6 text-slate-400" />
            </div>
            <p className="font-semibold text-slate-700">
              {search ? 'No matching items' : 'Your pantry is empty'}
            </p>
            <p className="text-sm text-slate-400 mt-1">
              {search ? 'Try a different search term' : 'Start adding ingredients from your kitchen'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50/60">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                {filtered.length} ingredient{filtered.length !== 1 ? 's' : ''}
              </span>
            </div>
            <ul className="divide-y divide-slate-50">
              {filtered.map(item => (
                <li key={item.id} className="flex items-center gap-3 px-4 py-3.5 hover:bg-slate-50 group transition-colors">
                  {editingId === item.id ? (
                    <div className="flex flex-1 items-center gap-2">
                      <input type="text" className="input flex-1 py-2 text-sm"
                        value={editName} onChange={e => setEditName(e.target.value)} />
                      <input type="text" className="input w-28 py-2 text-sm" placeholder="Qty"
                        value={editQty} onChange={e => setEditQty(e.target.value)} />
                      <button onClick={() => saveEdit(item.id)}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                        <Check className="w-4 h-4" />
                      </button>
                      <button onClick={cancelEdit}
                        className="p-2 text-slate-400 hover:bg-slate-100 rounded-lg transition-colors">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center shrink-0">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-800">{item.ingredient}</p>
                        {item.quantity && (
                          <p className="text-xs text-slate-400 mt-0.5">{item.quantity}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(item)}
                          className="p-1.5 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-all">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>

      <section className="card p-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div><h2 className="font-bold text-slate-900">Recent pantry use</h2><p className="mt-1 text-xs text-slate-500">Amounts change only when ingredient names and units match safely.</p></div>
          <span className="rounded-full bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-800">{history.length} records</span>
        </div>
        {history.length ? <>
          <ul className="divide-y divide-slate-100">{history.slice(0, showAllHistory ? history.length : 12).map(entry => <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><div><p className="font-semibold text-slate-800">{entry.ingredient} <span className="font-normal text-slate-500">used in {entry.recipeName}</span></p><p className="text-xs text-slate-500">{new Date(entry.createdAt).toLocaleString()}</p></div><p className="text-right text-xs text-slate-600">Used {entry.quantityUsed}<br/><span className="font-semibold text-emerald-700">Left {entry.quantityRemaining}</span></p></li>)}</ul>
          {history.length > 12 && <button type="button" onClick={() => setShowAllHistory(value => !value)} className="btn-ghost text-sm">{showAllHistory ? 'Show recent records' : `Show all ${history.length} records from the last 14 days`}</button>}
        </> : <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">When you finish a planned meal, matched ingredient use and remaining amounts will appear here.</p>}
      </section>
    </div>
  );
}
