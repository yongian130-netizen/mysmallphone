import React, { useState } from 'react';

interface AvatarWithFallbackProps {
  src?: string;
  name: string;
  sizeClass?: string;
}

export const AvatarWithFallback: React.FC<AvatarWithFallbackProps> = ({
  src,
  name,
  sizeClass = 'w-10 h-10 text-sm',
}) => {
  const [hasError, setHasError] = useState(false);

  const initials = name
    .split(' ')
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  if (!src || hasError) {
    return (
      <div
        className={`${sizeClass} rounded-lg bg-slate-900 text-white font-semibold flex items-center justify-center shrink-0 select-none border border-slate-800`}
        aria-label={name}
      >
        {initials || 'AI'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`${name} avatar`}
      referrerPolicy="no-referrer"
      onError={() => setHasError(true)}
      className={`${sizeClass} rounded-lg object-cover shrink-0 border border-slate-200 bg-slate-100`}
    />
  );
};
