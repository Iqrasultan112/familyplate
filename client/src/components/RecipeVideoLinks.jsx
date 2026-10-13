import React from 'react';
import { ExternalLink, Play } from 'lucide-react';
import { youtubeRecipeLinks } from '../lib/youtubeRecipeLinks';

export default function RecipeVideoLinks({ recipeName, compact = false, links: suppliedLinks, showHeading = true }) {
  const links = suppliedLinks?.length ? suppliedLinks : youtubeRecipeLinks(recipeName);
  if (!links.length) return null;

  return (
    <section className={compact ? 'mt-4 rounded-xl border border-red-100 bg-red-50/60 p-3' : 'rounded-2xl border border-red-100 bg-gradient-to-br from-white to-red-50/60 p-5 sm:p-6'} aria-label={`YouTube videos for ${recipeName}`}>
      {showHeading && <div className="mb-3 flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-700"><Play className="h-4 w-4" aria-hidden="true" /></span>
        <h2 className="text-sm font-bold text-primary-950">Related YouTube videos</h2>
      </div>}
      <div className="grid gap-2 sm:grid-cols-2">
        {links.map(({ label, url }) => (
          <a
            key={label}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-red-100 bg-white px-3 py-2.5 text-sm font-semibold text-primary-900 transition hover:border-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            <span>{label}</span>
            <ExternalLink className="h-4 w-4 shrink-0 text-red-700" aria-hidden="true" />
          </a>
        ))}
      </div>
    </section>
  );
}
