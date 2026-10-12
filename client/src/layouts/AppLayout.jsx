import React, { useEffect, useRef, useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, CalendarDays, BookOpen, ShoppingCart,
  LogOut, Sparkles, Package, Menu, X,
  UtensilsCrossed, Globe, ChevronRight, MessageCircle, ThumbsUp
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import NotificationBell from '../components/NotificationBell';
import Avatar from '../components/Avatar';
import MealChatPopup from '../components/MealChatPopup';

const navGroups = [
  {
    label: 'Plan meals',
    items: [
      { path: '/dashboard', label: 'Home', icon: LayoutDashboard },
      { path: '/weekly-menu', label: 'Weekly plan', icon: CalendarDays },
      { path: '/family/suggestions', label: 'Meal ideas', icon: Sparkles },
      { path: '/family/meal-chat', label: 'AI meal chat', icon: MessageCircle },
    ],
  },
  {
    label: 'Kitchen',
    items: [
      { path: '/inventory', label: 'Pantry', icon: Package },
      { path: '/shopping', label: 'Shopping list', icon: ShoppingCart },
    ],
  },
  {
    label: 'Together',
    items: [
      { path: '/family/voting', label: 'Family vote', icon: ThumbsUp },
      { path: '/community/groups', label: 'Friends & group chat', icon: Users },
      { path: '/family', label: 'Family space', icon: Users },
      { path: '/community', label: 'Community kitchen', icon: Globe },
    ],
  },
  {
    label: 'Recipes',
    items: [
      { path: '/recipes', label: 'Find recipes', icon: BookOpen },
      { path: '/saved', label: 'Saved recipes', icon: BookOpen },
    ],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set(['Plan meals', 'Kitchen', 'Together']));
  const desktopNavRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();
  const handleLogout = () => { logout(); navigate('/login'); };

  useEffect(() => {
    if (!chatOpen) return undefined;
    const closeOnEscape = event => { if (event.key === 'Escape') setChatOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [chatOpen]);

  const currentPage = location.pathname === '/family/meal-chat' ? 'Meal helper' : navGroups.flatMap(group => group.items)
    .filter(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`))
    .sort((a, b) => b.path.length - a.path.length)[0]?.label || 'FamilyPlate';
  const visibleNavGroups = navGroups;

  useEffect(() => {
    const currentGroup = visibleNavGroups.find(group => group.items.some(item => location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)));
    if (!currentGroup) return;
    setExpandedGroups(previous => previous.has(currentGroup.label) ? previous : new Set(previous).add(currentGroup.label));
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      desktopNavRef.current?.querySelector('[data-current-page="true"]')?.scrollIntoView({ block: 'nearest' });
    }));
  }, [location.pathname]);

  const Sidebar = () => (
    <div className="flex flex-col h-full bg-white">
      {/* Logo */}
      <NavLink to="/dashboard" onClick={() => setDrawerOpen(false)} aria-label="FamilyPlate home" className="flex items-center gap-3 px-5 h-[5rem] border-b border-primary-100 shrink-0 bg-[#FFFCF8] hover:bg-[#FFF7F2] transition-colors">
        <div className="w-11 h-11 rounded-2xl bg-primary-800 flex items-center justify-center shadow-sm">
          <UtensilsCrossed className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="block text-base font-extrabold text-primary-950 tracking-tight">FamilyPlate</span>
          <span className="block text-[10px] font-semibold tracking-[0.12em] text-primary-500">MEALS MADE TOGETHER</span>
        </div>
      </NavLink>

      <div className="shrink-0 border-b border-primary-100 p-3">
        <button type="button" onClick={() => { setDrawerOpen(false); setChatOpen(true); }} aria-label="Open meal helper chat" className="flex w-full items-center gap-3 rounded-2xl border border-primary-200 bg-[#fff4ec] px-3 py-3 text-left text-primary-950 shadow-sm transition hover:border-primary-400 hover:bg-[#ffede1]">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-800 text-white"><MessageCircle className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1"><strong className="block text-sm">Meal helper</strong><span className="mt-0.5 block text-xs text-primary-700">Aaj kya pakayen?</span></span>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary-600" />
        </button>
      </div>

      {/* Nav groups */}
      <nav ref={desktopNavRef} aria-label="Main navigation" className="flex-1 overflow-y-auto py-5 px-3 space-y-5">
        {visibleNavGroups.map(group => (
          <div key={group.label}>
            <button type="button" onClick={() => setExpandedGroups(previous => {
              const next = new Set(previous);
              next.has(group.label) ? next.delete(group.label) : next.add(group.label);
              return next;
            })} aria-expanded={expandedGroups.has(group.label)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-primary-50">
              <span className="section-label">{group.label}</span>
              <ChevronRight className={`h-3.5 w-3.5 text-primary-400 transition-transform ${expandedGroups.has(group.label) ? 'rotate-90' : ''}`} />
            </button>
            {expandedGroups.has(group.label) && <ul className="mt-1 space-y-1">
              {group.items.map(item => (
                <li key={item.path}>
                  <NavLink
                    to={item.path}
                    end={['/family', '/dashboard', '/community', '/recipes'].includes(item.path)}
                    data-current-page={item.label === currentPage ? 'true' : undefined}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-semibold transition-all duration-150 group ${
                        isActive
                          ? 'bg-primary-800 text-white border border-primary-900 shadow-md'
                          : 'text-primary-700 hover:bg-primary-50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon className={`w-4 h-4 shrink-0 transition-transform group-hover:scale-105 ${isActive ? 'text-white' : 'text-primary-500'}`} />
                        <span className="flex-1">{item.label}</span>
                        {isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-100" />}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="shrink-0 p-3 border-t border-primary-100">
        <div className="flex items-center gap-2 p-2 rounded-2xl bg-primary-50 border border-primary-100">
          <NavLink to="/profile" onClick={() => setDrawerOpen(false)} className="flex flex-1 min-w-0 items-center gap-3 rounded-xl p-1 hover:bg-white/80" aria-label="Open my profile">
            <Avatar user={user} size="sm" />
            <span className="flex-1 min-w-0">
              <span className="block text-[13px] font-bold text-primary-950 truncate leading-tight">{user?.name}</span>
              <span className="block text-xs text-primary-600 mt-0.5 truncate">My profile</span>
            </span>
          </NavLink>
          <button onClick={handleLogout} title="Sign out" aria-label="Sign out"
            className="p-1.5 rounded-lg text-primary-400 hover:text-red-700 hover:bg-[#F9EBEA] transition-all">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FFFAF5]">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-72 border-r border-primary-200 fixed inset-y-0 z-20 shadow-[8px_0_28px_rgba(71,36,24,0.035)]">
        <Sidebar />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-primary-950/20 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)} />
          <aside className="absolute left-0 inset-y-0 w-80 max-w-[88vw] bg-white z-50 shadow-float">
            <button onClick={() => setDrawerOpen(false)}
              className="absolute top-4 right-4 p-2 rounded-xl hover:bg-primary-50 text-primary-500">
              <X className="w-4 h-4" />
            </button>
            <Sidebar />
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 md:ml-72 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="min-h-[4.5rem] bg-[#FFFCF8]/95 backdrop-blur border-b border-primary-200 sticky top-0 z-10 flex items-center justify-between px-4 sm:px-6">
          <button onClick={() => setDrawerOpen(true)} aria-label="Open navigation menu"
            className="md:hidden btn-ghost p-2">
            <Menu className="w-5 h-5" />
          </button>
          <div className="md:hidden flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-800 flex items-center justify-center">
              <UtensilsCrossed className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-primary-950 text-sm">FamilyPlate</span>
          </div>
          <div className="hidden md:block mr-auto pl-5">
            <p className="text-[10px] font-bold tracking-[0.15em] text-primary-500">FAMILYPLATE <span className="px-1 text-primary-300">/</span> {currentPage.toUpperCase()}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="hidden sm:flex items-center gap-2.5 pl-4 border-l border-primary-200 ml-2">
              <Avatar user={user} size="sm" />
              <div className="hidden lg:block">
                <p className="text-[13px] font-bold text-primary-950 leading-tight">{user?.name}</p>
              <p className="text-xs text-primary-600">{user?.role === 'maker' ? 'Meal planner' : 'Family member'}</p>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className={['/family/meal-chat', '/family/chat'].includes(location.pathname) ? 'app-main min-h-0 flex-1 p-0 pb-[calc(4.5rem+env(safe-area-inset-bottom))] max-w-none mx-0 w-full md:pb-0' : 'app-main flex-1 p-4 sm:p-6 lg:p-8 max-w-[1500px] mx-auto w-full pb-24 md:pb-10'}>
          <Outlet />
        </main>
      </div>

      {chatOpen && <MealChatPopup onClose={() => setChatOpen(false)} />}

      {/* Mobile bottom nav */}
      <nav aria-label="Quick navigation" className="md:hidden fixed bottom-0 inset-x-0 z-20 bg-white border-t border-primary-200 flex justify-around items-center h-[calc(4.5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] px-0.5 shadow-[0_-5px_20px_rgba(71,36,24,0.08)]">
        {[
          { path: '/dashboard', icon: LayoutDashboard, label: 'Home' },
          { path: '/family/suggestions', icon: Sparkles, label: 'Meal ideas' },
          { path: '/family/voting', icon: ThumbsUp, label: 'Vote' },
          { path: '/community/groups', icon: Users, label: 'Groups' },
          { path: '/family/meal-chat', icon: MessageCircle, label: 'AI chat' },
        ].map(item => (
          <NavLink key={item.path} to={item.path}
            aria-label={item.label}
            className={({ isActive }) =>
              `flex min-w-0 flex-col items-center gap-0.5 px-1.5 py-1.5 rounded-xl transition-all ${
                isActive ? 'text-primary-900' : 'text-primary-500 hover:text-primary-700'
              }`
            }>
            {({ isActive }) => (
              <>
                <div className={`w-8 h-8 flex items-center justify-center rounded-xl transition-all ${isActive ? 'bg-primary-800 shadow-sm' : ''}`}>
                  <item.icon className={`w-5 h-5 ${isActive ? 'text-white' : ''}`} />
                </div>
                <span className="whitespace-nowrap text-[10px] font-semibold tracking-normal">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
