'use client';

import React from 'react';
import { getChainTailwind, normalizeMerchant } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface MerchantBadgeProps {
  merchant: string | undefined | null;
  className?: string;
  variant?: 'solid' | 'light' | 'outline' | 'text';
  showName?: boolean;
}

/**
 * MerchantBadge - A unified component for displaying cinema chain branding
 * Centralizes colors and styling logic for XXI, CGV, Cinépolis, and FLIX.
 */
export function MerchantBadge({
  merchant,
  className,
  variant = 'light',
  showName = true
}: MerchantBadgeProps) {
  const normalized = normalizeMerchant(merchant);
  const styles = getChainTailwind(merchant);

  if (!normalized || !styles) {
    return (
      <span className={cn(
        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
        "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700",
        className
      )}>
        {merchant || 'Unknown'}
      </span>
    );
  }

  const baseClasses = "px-2 py-0.5 rounded-full text-[10px] font-bold border transition-colors";

  let variantClasses = "";
  switch (variant) {
    case 'solid':
      variantClasses = `${styles.badge} border-transparent`;
      break;
    case 'light':
      variantClasses = `${styles.badgeLight} ${styles.text} border-current/10`;
      break;
    case 'outline':
      variantClasses = `bg-transparent ${styles.text} border-current`;
      break;
    case 'text':
      variantClasses = `bg-transparent ${styles.text} border-transparent px-0 py-0`;
      break;
  }

  return (
    <span className={cn(baseClasses, variantClasses, className)}>
      {showName ? normalized : ''}
    </span>
  );
}
