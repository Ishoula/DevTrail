import React from 'react';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  className?: string;
  style?: React.CSSProperties;
  borderRadius?: string | number;
}

/**
 * Reusable skeleton placeholder component.
 * Uses Tailwind utilities and custom CSS variables for shimmer effect.
 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  style = {},
  borderRadius = '0.25rem',
}) => {
  const inlineStyle: React.CSSProperties = {
    width,
    height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
    ...style,
  };

  return (
    <div
      className={`bg-skeleton-base animate-shimmer ${className}`}
      style={inlineStyle}
      aria-hidden="true"
    />
  );
};

export default Skeleton;
