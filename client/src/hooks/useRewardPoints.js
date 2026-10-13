import { useCallback, useEffect, useState } from 'react';

const keyFor = userId => `familyplate.rewards.v1:${userId || 'guest'}`;
const readRewards = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return { points: Number(value.points) || 0, events: Array.isArray(value.events) ? value.events : [] };
  } catch { return { points: 0, events: [] }; }
};

export default function useRewardPoints(userId) {
  const key = keyFor(userId);
  const [rewards, setRewards] = useState(() => readRewards(key));

  useEffect(() => {
    setRewards(readRewards(key));
    const refresh = event => { if (!event?.detail?.key || event.detail.key === key) setRewards(readRewards(key)); };
    window.addEventListener('familyplate:rewards-change', refresh);
    return () => window.removeEventListener('familyplate:rewards-change', refresh);
  }, [key]);

  const award = useCallback((eventId, points) => {
    if (!eventId) return false;
    const current = readRewards(key);
    if (current.events.includes(String(eventId))) return false;
    const next = { points: current.points + points, events: [...current.events, String(eventId)].slice(-500) };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    setRewards(next);
    window.dispatchEvent(new CustomEvent('familyplate:rewards-change', { detail: { key } }));
    return true;
  }, [key]);

  return { points: rewards.points, completedMeals: rewards.events.filter(event => event.startsWith('cooked:')).length, award };
}
