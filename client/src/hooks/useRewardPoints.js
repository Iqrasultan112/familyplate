import { useCallback, useEffect, useState } from 'react';

const keyFor = userId => `familyplate.rewards.v1:${userId || 'guest'}`;
const readRewards = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return { points: Number(value.points) || 0, events: Array.isArray(value.events) ? value.events : [], activityDays: Array.isArray(value.activityDays) ? value.activityDays : [] };
  } catch { return { points: 0, events: [], activityDays: [] }; }
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
    const today = new Date();
    const day = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const next = { points: current.points + points, events: [...current.events, String(eventId)].slice(-500), activityDays: [...new Set([...current.activityDays, day])].slice(-365) };
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
    setRewards(next);
    window.dispatchEvent(new CustomEvent('familyplate:rewards-change', { detail: { key } }));
    return true;
  }, [key]);

  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  const days = new Set(rewards.activityDays);
  const today = new Date();
  if (!days.has(dayKey(today))) today.setDate(today.getDate() - 1);
  let streak = 0;
  while (days.has(dayKey(today))) { streak += 1; today.setDate(today.getDate() - 1); }
  return {
    points: rewards.points,
    plannedMeals: rewards.events.filter(event => event.startsWith('planned:')).length,
    completedMeals: rewards.events.filter(event => event.startsWith('cooked:')).length,
    streak,
    level: rewards.points >= 200 ? 'Kitchen Star' : rewards.points >= 80 ? 'Home Chef' : rewards.points >= 20 ? 'Kitchen Helper' : 'New Cook',
    award
  };
}
