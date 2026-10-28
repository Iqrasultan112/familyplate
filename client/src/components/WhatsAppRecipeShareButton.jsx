import React from 'react';
import { MessageCircle } from 'lucide-react';
import { getWhatsAppRecipeShareUrl } from '../lib/recipeSharing';

export default function WhatsAppRecipeShareButton({ recipe, label = 'Share', className = '' }) {
  const handleShare = event => {
    event.preventDefault();
    event.stopPropagation();
    window.open(getWhatsAppRecipeShareUrl(recipe), '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      className={`inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-white px-2.5 text-xs font-semibold text-emerald-800 transition-colors hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${className}`}
      aria-label={`Share ${recipe?.title || recipe?.name || 'recipe'} on WhatsApp`}
      title="Share this recipe on WhatsApp"
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  );
}
