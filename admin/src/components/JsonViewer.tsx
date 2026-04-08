'use client';

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface JsonViewerProps {
  data: unknown;
  level?: number;
  label?: string;
  isLast?: boolean;
}

/**
 * Recursively sorts object keys alphabetically.
 */
export function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const typedObj = obj as Record<string, unknown>;
  return Object.keys(typedObj)
    .sort()
    .reduce((acc: Record<string, unknown>, key) => {
      acc[key] = sortObjectKeys(typedObj[key]);
      return acc;
    }, {});
}

export function JsonViewer({ data, level = 0, label, isLast = true }: JsonViewerProps) {
  const [isExpanded, setIsExpanded] = useState(level < 2); // Expand first 2 levels by default

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);
  const isEmpty = isObject && (isArray ? (data as unknown[]).length === 0 : Object.keys(data as Record<string, unknown>).length === 0);

  const toggleExpand = () => setIsExpanded(!isExpanded);

  const renderValue = (val: unknown) => {
    if (typeof val === 'string') return <span className="text-green-600 dark:text-green-400">&quot;{val}&quot;</span>;
    if (typeof val === 'number') return <span className="text-blue-600 dark:text-blue-400">{val}</span>;
    if (typeof val === 'boolean') return <span className="text-purple-600 dark:text-purple-400">{val.toString()}</span>;
    if (val === null) return <span className="text-gray-500">null</span>;
    return null;
  };

  if (!isObject || isEmpty) {
    return (
      <div className={cn("flex items-start gap-1 py-0.5 font-mono text-[11px]", level > 0 && "ml-4")}>
        {label && <span className="text-foreground/60 font-medium">{label}:</span>}
        {isEmpty ? (
          <span className="text-muted-foreground">{isArray ? '[]' : '{}'}{!isLast && ','}</span>
        ) : (
          <span className="break-all whitespace-pre-wrap">
            {renderValue(data)}{!isLast && ','}
          </span>
        )}
      </div>
    );
  }

  const openBrace = isArray ? '[' : '{';
  const closeBrace = isArray ? ']' : '}';

  return (
    <div className={cn("flex flex-col py-0.5 font-mono text-[11px]", level > 0 && "ml-4")}>
      <div 
        className="flex items-center gap-1 cursor-pointer hover:bg-muted/30 rounded px-1 -ml-1 transition-colors group"
        onClick={toggleExpand}
      >
        <span className="flex-shrink-0">
          {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </span>
        {label && <span className="text-foreground/60 font-medium">{label}:</span>}
        <span className="text-muted-foreground">{openBrace}</span>
        {!isExpanded && (
          <span className="text-muted-foreground px-1 bg-muted/50 rounded mx-1 text-[10px]">
            {isArray ? `${(data as unknown[]).length} items` : `${Object.keys(data as Record<string, unknown>).length} keys`}
          </span>
        )}
        {!isExpanded && <span className="text-muted-foreground">{closeBrace}{!isLast && ','}</span>}
      </div>

      {isExpanded && (
        <>
          <div className="border-l border-muted-foreground/20 ml-1.5 pl-1">
            {isArray 
              ? (data as unknown[]).map((item, i, arr) => (
                  <JsonViewer 
                    key={i} 
                    data={item} 
                    level={level + 1} 
                    isLast={i === arr.length - 1} 
                  />
                ))
              : Object.keys(data as Record<string, unknown>).map((key, i, arr) => (
                  <JsonViewer 
                    key={key} 
                    data={(data as Record<string, unknown>)[key]} 
                    level={level + 1} 
                    label={key} 
                    isLast={i === arr.length - 1} 
                  />
                ))
            }
          </div>
          <div className="text-muted-foreground ml-1">
            {closeBrace}{!isLast && ','}
          </div>
        </>
      )}
    </div>
  );
}
