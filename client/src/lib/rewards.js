const keyFor = userId => `familyplate.rewards.v1:${userId || 'guest'}`;

const readRewards = key => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}');
    return {
      points: Number(value.points) || 0,
      events: Array.isArray(value.events) ? value.events : [],
      activityDays: Array.isArray(value.activityDays) ? value.activityDays : []
    };
  } catch {
    return { points: 0, events: [], activityDays: [] };
  }
};

const todayKey = () => {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
};

export const readUserRewards = userId => readRewards(keyFor(userId));

export const recordReward = (userId, eventId, points) => {
  if (!eventId) return false;
  const key = keyFor(userId);
  const current = readRewards(key);
  const id = String(eventId);
  if (current.events.includes(id)) return false;

  const next = {
    points: current.points + (Number(points) || 0),
    events: [...current.events, id].slice(-500),
    activityDays: [...new Set([...current.activityDays, todayKey()])].slice(-365)
  };
  try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  window.dispatchEvent(new CustomEvent('familyplate:rewards-change', { detail: { key } }));
  return true;
};

export const recordPlannedMeal = (userId, menuItem) => {
  if (!menuItem?.id) return false;
  return recordReward(userId, `planned:${menuItem.id}`, 10);
};

export const notifyWeeklyMenuChanged = () => {
  window.dispatchEvent(new CustomEvent('familyplate:weekly-menu-change'));
};
