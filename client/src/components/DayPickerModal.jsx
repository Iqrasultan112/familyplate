import React, { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';

const localDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const DayPickerModal = ({ isOpen, onClose, onSelectDay, recipeName }) => {
  const [date, setDate] = useState(localDateKey(new Date()));
  const [mealType, setMealType] = useState('Dinner');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (isOpen) {
      setDate(localDateKey(new Date()));
      setMealType('Dinner');
    }
  }, [isOpen]);
  if (!isOpen) return null;

  const saveSelection = async () => {
    if (!date || date < localDateKey(new Date())) return;
    setSaving(true);
    try {
      const saved = await onSelectDay(date, mealType);
      if (saved !== false) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="p-4 border-b flex justify-between items-center bg-gray-50">
          <h3 className="font-semibold text-lg text-gray-800">Schedule this recipe</h3>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-200 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <p className="text-sm text-gray-600 mb-4">
            Choose the exact date and meal for <span className="font-medium text-primary">{recipeName}</span>.
          </p>
          <div className="space-y-4">
            <label className="block text-sm font-semibold text-gray-800">Date
              <input type="date" className="input mt-1 w-full" value={date} min={localDateKey(new Date())} onChange={event => setDate(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold text-gray-800">Meal time
              <select className="input mt-1 w-full" value={mealType} onChange={event => setMealType(event.target.value)}>
                <option>Breakfast</option><option>Lunch</option><option>Dinner</option>
              </select>
            </label>
            {date && <p className="rounded-lg bg-primary-50 p-3 text-sm text-primary-900">Adding to <strong>{new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</strong> · <strong>{mealType}</strong></p>}
            <button type="button" onClick={saveSelection} disabled={saving || !date || date < localDateKey(new Date())} className="btn-primary w-full justify-center">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : `Add to ${mealType}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayPickerModal;
