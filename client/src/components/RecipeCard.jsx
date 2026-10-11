import React from 'react';
import { Clock, Users, Heart, Plus, ArrowUpRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RecipePhoto from './RecipePhoto';

const RecipeCard = ({ recipe, showActions = true, onSave, onAddToMenu, isSaved }) => {
  const navigate = useNavigate();
  const title = recipe.title || recipe.name || 'Family recipe';
  const minutes = [recipe.prepTime, recipe.cookTime].map(value => Number.parseInt(value, 10)).filter(Number.isFinite).reduce((sum, value) => sum + value, 0);

  const openRecipe = () => navigate(`/recipes/${recipe.id}`);
  const onCardKeyDown = event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openRecipe();
    }
  };

  return (
    <article
      className="recipe-card group"
      onClick={openRecipe}
      onKeyDown={onCardKeyDown}
      role="link"
      tabIndex={0}
      aria-label={`View ${title} recipe`}
    >
      <div className="recipe-card-image">
        <RecipePhoto recipe={{ ...recipe, name: title }} alt={title} loading="lazy" />
        <div className="recipe-image-shade" />
        <span className="recipe-photo-tag">FamilyPlate recipe</span>
        {showActions && onSave && (
          <button
            type="button"
            onClick={event => { event.stopPropagation(); onSave(recipe); }}
            className={`recipe-save-button ${isSaved ? 'is-saved' : ''}`}
            aria-label={isSaved ? `Remove ${title} from saved recipes` : `Save ${title}`}
          >
            <Heart size={18} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>

      <div className="recipe-card-body">
        <div className="flex items-start justify-between gap-3">
          <h3 className="recipe-card-title">{title}</h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-primary-400 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
        </div>
        <p className="recipe-card-description">{recipe.description || 'A family favourite, ready to explore.'}</p>

        <div className="recipe-card-meta">
          <span><Clock className="h-4 w-4" />{minutes ? `${minutes} min` : 'Time varies'}</span>
          <span><Users className="h-4 w-4" />{recipe.servings || 4} servings</span>
        </div>

        <div className="recipe-card-footer">
          <span className="recipe-author">By {recipe.creator?.name || recipe.creatorName || 'FamilyPlate cook'}</span>
          {showActions && onAddToMenu && (
            <button
              type="button"
              onClick={event => { event.stopPropagation(); onAddToMenu(recipe); }}
              className="recipe-add-button"
              aria-label={`Add ${title} to meal plan`}
              title="Add to meal plan"
            >
              <Plus size={17} /><span>Add to plan</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};

export default RecipeCard;
