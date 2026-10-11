import React, { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../lib/api';
import { sameIngredient } from '../lib/foodMatching';

const parseList = value => {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
};
const scale = (value, factor) => {
  const match = String(value || '').match(/^(\s*)(\d+\s*\/\s*\d+|\d+(?:\.\d+)?)(.*)$/);
  if (!match) return value || '1';
  const amount = match[2].includes('/') ? match[2].split('/').map(Number).reduce((a, b) => a / b) : Number(match[2]);
  return `${match[1]}${Number((amount * factor).toFixed(2))}${match[3]}`;
};

export default function ShoppingIngredientsModal({ recipe, servings = 4, onClose }) {
  const ingredients = useMemo(() => parseList(recipe?.ingredients).map((item, index) => ({
    id: `${index}-${item.name || item.ingredient || item}`,
    name: String(item.name || item.ingredient || item).trim(),
    quantity: String(item.quantity || item.amount || '1').trim()
  })).filter(item => item.name), [recipe]);
  const [pantry, setPantry] = useState([]);
  const [selected, setSelected] = useState(() => new Set(ingredients.map(item => item.id)));
  const [count, setCount] = useState(Number(servings) || 4);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api.get('/inventory').then(result => setPantry(Array.isArray(result.data) ? result.data : [])).catch(() => setPantry([]));
  }, []);
  const isInPantry = ingredient => pantry.some(item => sameIngredient(item.ingredient, ingredient.name));
  const needed = ingredients.filter(item => !isInPantry(item));
  const stocked = ingredients.filter(isInPantry);
  const base = Number.parseFloat(recipe?.servings) || 4;
  const factor = count / base;
  const toggle = id => setSelected(previous => { const next = new Set(previous); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleGroup = group => setSelected(previous => {
    const next = new Set(previous); const allSelected = group.every(item => next.has(item.id));
    group.forEach(item => allSelected ? next.delete(item.id) : next.add(item.id)); return next;
  });
  const add = async () => {
    const items = ingredients.filter(item => selected.has(item.id)).map(item => ({ ingredient: item.name, quantity: scale(item.quantity, factor) }));
    if (!items.length) return toast.error('Select at least one ingredient');
    setSaving(true);
    try { await api.post('/shopping/bulk', { items }); toast.success(`${items.length} items added to shopping list`); onClose(); }
    catch (error) { toast.error(error.response?.data?.error || 'Could not update shopping list'); }
    finally { setSaving(false); }
  };
  const group = (title, list, description) => <section className="mt-5" key={title}>
    <div className="mb-2 flex items-center justify-between border-b border-[#f1d8ca] pb-2"><div><h3 className="font-semibold text-[#3b211b]">{title}</h3>{description && <p className="mt-0.5 text-xs text-[#806b63]">{description}</p>}</div><button type="button" onClick={() => toggleGroup(list)} className="text-xs font-semibold text-[#a84634] hover:text-[#713126]">{list.length && list.every(item => selected.has(item.id)) ? 'Deselect all' : 'Select all'}</button></div>
    {list.length ? list.map(item => <label key={item.id} className="flex cursor-pointer items-center gap-3 border-b border-[#f1e5dd] px-1 py-3 last:border-0 hover:bg-[#fff5ef]"><span className="min-w-0 flex-1"><strong className="font-semibold text-[#3b211b]">{scale(item.quantity, factor)}</strong><span className="ml-2 text-sm text-[#60483f]">{item.name}</span>{isInPantry(item) && <small className="mt-0.5 block text-xs text-emerald-700">Pantry: {pantry.find(stock => sameIngredient(stock.ingredient, item.name))?.quantity}</small>}</span><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="h-5 w-5 accent-[#f28b3c]" aria-label={`Add ${item.name}`} /></label>) : <p className="py-3 text-sm text-[#806b63]">No ingredients in this section.</p>}
  </section>;
  return <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
    <section role="dialog" aria-modal="true" aria-label="Choose shopping list ingredients" onClick={event => event.stopPropagation()} className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl border border-[#f1d8ca] bg-[#fffaf6] text-[#3b211b] shadow-2xl sm:rounded-3xl">
      <header className="flex items-start justify-between border-b border-[#f1d8ca] p-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a84634]">Shopping list</p><h2 className="mt-1 text-xl font-bold text-[#3b211b]">Add ingredients</h2><p className="mt-1 text-sm text-[#806b63]">{recipe?.name}</p></div><button type="button" onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-[#60483f] hover:bg-[#fff0e7]"><X className="h-5 w-5" /></button></header>
      <div className="flex items-center justify-between border-b border-[#f1d8ca] px-5 py-3"><span className="text-sm text-[#806b63]">Scale for servings</span><div className="flex items-center gap-4 rounded-xl bg-[#fff0e7] p-1"><button type="button" onClick={() => setCount(value => Math.max(1, value - 1))} className="rounded-lg p-2 text-[#60483f] hover:bg-white" aria-label="Remove a serving"><Minus className="h-4 w-4" /></button><span className="min-w-7 text-center font-bold">{count}</span><button type="button" onClick={() => setCount(value => Math.min(100, value + 1))} className="rounded-lg p-2 text-[#a84634] hover:bg-white" aria-label="Add a serving"><Plus className="h-4 w-4" /></button></div></div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-2">{group(`Items to add · ${needed.length}`, needed, 'Ingredients not found in your pantry')}{group(`You might already have · ${stocked.length}`, stocked, 'These are in your pantry; include them only if you need more')}</div>
      <footer className="border-t border-[#f1d8ca] bg-[#fffaf6] p-4"><button type="button" disabled={saving || selected.size === 0} onClick={add} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#713126] px-5 py-3.5 font-bold text-white transition hover:bg-[#57241d] disabled:cursor-not-allowed disabled:opacity-50"><ShoppingCart className="h-5 w-5" /> {saving ? 'Adding…' : `Add ${selected.size} item${selected.size === 1 ? '' : 's'}`}</button></footer>
    </section>
  </div>;
}
