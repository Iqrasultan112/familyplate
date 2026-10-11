import React from 'react';
import { getInitials } from '../lib/utils';

export default function Avatar({ user, size = 'md' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-16 h-16 text-xl'
  };

  if (user?.profilePicture) {
    return (
      <img 
        src={user.profilePicture} 
        alt={user.name} 
        className={`${sizeClasses[size]} rounded-full object-cover border border-gray-200`}
      />
    );
  }

  return (
    <div className={`${sizeClasses[size]} rounded-full bg-primary-100 text-primary-700 font-semibold flex items-center justify-center border border-primary-200`}>
      {getInitials(user?.name)}
    </div>
  );
}
