import { useCallback, useEffect, useState } from 'react';
import { readUserRewards, recordReward } from '../lib/rewards';

const keyFor = userId => `familyplate.rewards.v1:${userId || 'guest'}`;

export default function useRewardPoints(userId) {
  const key = keyFor(userId);
  const [rewards, setRewards] = useState(() => readUserRewards(userId));

  useEffect(() => {
    setRewards(readUserRewards(userId));
    const refresh = event => {
      if (!event?.detail?.key || event.detail.key === key) setRewards(readUserRewards(userId));
    };
    const refreshFromOtherTab = event => {
      if (event.key === key) setRewards(readUserRewards(userId));
    };
    window.addEventListener('familyplate:rewards-change', refresh);
    window.addEventListener('storage', refreshFromOtherTab);
    return () => {
      window.removeEventListener('familyplate:rewards-change', refresh);
      window.removeEventListener('storage', refreshFromOtherTab);
    };
  }, [key, userId]);

  const award = useCallback((eventId, points) => {
    const awarded = recordReward(userId, eventId, points);
    if (awarded) setRewards(readUserRewards(userId));
    return awarded;
  }, [key, userId]);

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
