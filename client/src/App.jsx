import React, { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import LoadingSpinner from './components/LoadingSpinner';

// Layouts
import AuthLayout from './layouts/AuthLayout';
import AppLayout from './layouts/AppLayout';

// Eagerly loaded auth pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import Dashboard from './pages/Dashboard';
import PublicHome from './pages/PublicHome';

// Lazily loaded app pages (code-split per route)
const FamilyHome        = lazy(() => import('./pages/FamilyHome'));
const FamilyChat        = lazy(() => import('./pages/FamilyChat'));
const MealRequests      = lazy(() => import('./pages/MealRequests'));
const FamilyVoting      = lazy(() => import('./pages/FamilyVoting'));
const EventPlanner      = lazy(() => import('./pages/EventPlanner'));
const WeeklyMenu        = lazy(() => import('./pages/WeeklyMenu'));
const CommunityHome     = lazy(() => import('./pages/CommunityHome'));
const CommunityGroups   = lazy(() => import('./pages/CommunityGroups'));
const CreateRecipePost  = lazy(() => import('./pages/CreateRecipePost'));
const RecipesPage       = lazy(() => import('./pages/RecipesPage'));
const RecipeDetails     = lazy(() => import('./pages/RecipeDetails'));
const AIRecipeProcessor = lazy(() => import('./pages/AIRecipeProcessor'));
const Inventory         = lazy(() => import('./pages/Inventory'));
const ShoppingCart      = lazy(() => import('./pages/ShoppingCart'));
const Profile           = lazy(() => import('./pages/Profile'));
const SavedRecipes      = lazy(() => import('./pages/SavedRecipes'));
const MakerOnboarding   = lazy(() => import('./pages/MakerOnboarding'));
const MemberJoin        = lazy(() => import('./pages/MemberJoin'));
const DailySuggestions  = lazy(() => import('./pages/DailySuggestions'));
const MealChatPage      = lazy(() => import('./pages/MealChatPage'));

/** Guard: redirect to /login if not authenticated */
const ProtectedRoute = ({ children }) => {
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
};

const MakerOnlyRoute = ({ children }) => {
  const user = useAuthStore(state => state.user);
  if (user?.role !== 'maker') return <Navigate to="/dashboard" replace />;
  return children;
};

/** Page-level loading fallback */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <LoadingSpinner text="Loading..." />
  </div>
);

export default function App() {
  const initialize = useAuthStore(state => state.initialize);
  const isAuthenticated = useAuthStore(state => state.isAuthenticated);

  // Restore auth state from localStorage on mount
  useEffect(() => { initialize(); }, [initialize]);

  return (
    <BrowserRouter>
      {/* Global toast notifications (HCI: feedback on every action) */}
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3500,
          style: { borderRadius: '10px', fontFamily: 'inherit' },
          success: { iconTheme: { primary: '#f97316', secondary: '#fff' } },
        }}
      />

      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public introduction before account access */}
          <Route
            path="/"
            element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <PublicHome />}
          />

          {/* ── Auth routes (centered card layout) ── */}
          <Route element={<AuthLayout />}>
            <Route path="/login"          element={<Login />} />
            <Route path="/register"       element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
          </Route>

          {/* ── Protected app routes (sidebar layout) ── */}
          <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
            <Route path="/dashboard"      element={<Dashboard />} />

            {/* Onboarding & Member Join */}
            <Route path="/onboarding/maker" element={<MakerOnlyRoute><MakerOnboarding /></MakerOnlyRoute>} />
            <Route path="/join"             element={<MemberJoin />} />

            {/* Family Space */}
            <Route path="/family"             element={<FamilyHome />} />
            <Route path="/family/suggestions" element={<DailySuggestions />} />
            <Route path="/family/meal-chat"   element={<MealChatPage />} />
            <Route path="/family/chat"        element={<FamilyChat />} />
            <Route path="/family/requests"    element={<MealRequests />} />
            <Route path="/family/voting"      element={<FamilyVoting />} />
            <Route path="/family/events"      element={<EventPlanner />} />
            <Route path="/weekly-menu"        element={<WeeklyMenu />} />

            {/* Community */}
            <Route path="/community"      element={<CommunityHome />} />
            <Route path="/community/chat" element={<Navigate to="/community" replace />} />
            <Route path="/community/groups" element={<CommunityGroups />} />
            <Route path="/community/create" element={<CreateRecipePost />} />

            {/* Recipes */}
            <Route path="/recipes"        element={<RecipesPage />} />
            <Route path="/recipes/ai"     element={<AIRecipeProcessor />} />
            <Route path="/recipes/:id"    element={<RecipeDetails />} />

            {/* Planning */}
            <Route path="/my-menu"        element={<Navigate to="/weekly-menu" replace />} />
            <Route path="/inventory"      element={<Inventory />} />
            <Route path="/shopping"       element={<ShoppingCart />} />

            {/* Profile & Saved */}
            <Route path="/profile"        element={<Profile />} />
            <Route path="/saved"          element={<SavedRecipes />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
