'use client';

import { useState, useMemo } from 'react';
import { ChevronRight, ChevronDown, Plus, Minus, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface JsonViewerProps {
  data: unknown;
  level?: number;
  label?: string;
  isLast?: boolean;
  expandAll?: boolean;
  shrinkAll?: boolean;
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

function JsonItem({ data, level = 0, label, isLast = true, expandAll, shrinkAll }: JsonViewerProps) {
  const [localExpanded, setLocalExpanded] = useState<boolean | null>(null);

  // Determine expansion state based on props or local toggle
  const isExpanded = localExpanded !== null ? localExpanded : (expandAll ? true : shrinkAll ? false : level < 2);

  const isObject = data !== null && typeof data === 'object';
  const isArray = Array.isArray(data);
  const isEmpty = isObject && (isArray ? (data as unknown[]).length === 0 : Object.keys(data as Record<string, unknown>).length === 0);

  const toggleExpand = () => setLocalExpanded(!isExpanded);

  const renderValue = (val: unknown) => {
    if (typeof val === 'string') return <span className="text-green-600 dark:text-green-400">&quot;{val}&quot;</span>;
    if (typeof val === 'number') return <span className="text-blue-600 dark:text-blue-400">{val}</span>;
    if (typeof val === 'boolean') return <span className="text-purple-600 dark:text-purple-400">{val.toString()}</span>;
    if (val === null) return <span className="text-gray-500 font-bold italic">null</span>;
    return null;
  };

  if (!isObject || isEmpty) {
    return (
      <div className={cn("flex items-start gap-1 py-0.5 font-mono leading-normal", level > 0 && "ml-4")}>
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
    <div className={cn("flex flex-col py-0.5 font-mono leading-normal", level > 0 && "ml-4")}>
      <div 
        className="flex items-center gap-1 cursor-pointer hover:bg-primary/5 rounded px-1 -ml-1 transition-colors group"
        onClick={toggleExpand}
      >
        <span className="flex-shrink-0">
          {isExpanded ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />}
        </span>
        {label && <span className="text-foreground/60 font-medium">{label}:</span>}
        <span className="text-muted-foreground font-bold">{openBrace}</span>
        {!isExpanded && (
          <span className="text-muted-foreground/60 px-1 bg-muted/50 rounded mx-1 text-[10px] font-normal">
            {isArray ? `${(data as unknown[]).length} items` : `${Object.keys(data as Record<string, unknown>).length} keys`}
          </span>
        )}
        {!isExpanded && <span className="text-muted-foreground font-bold">{closeBrace}{!isLast && ','}</span>}
      </div>

      {isExpanded && (
        <>
          <div className="border-l border-muted-foreground/20 ml-1.5 pl-1">
            {isArray 
              ? (data as unknown[]).map((item, i, arr) => (
                  <JsonItem 
                    key={i} 
                    data={item} 
                    level={level + 1} 
                    isLast={i === arr.length - 1}
                    expandAll={expandAll}
                    shrinkAll={shrinkAll}
                  />
                ))
              : Object.keys(data as Record<string, unknown>).map((key, i, arr) => (
                  <JsonItem 
                    key={key} 
                    data={(data as Record<string, unknown>)[key]} 
                    level={level + 1} 
                    label={key} 
                    isLast={i === arr.length - 1}
                    expandAll={expandAll}
                    shrinkAll={shrinkAll}
                  />
                ))
            }
          </div>
          <div className="text-muted-foreground ml-1 font-bold">
            {closeBrace}{!isLast && ','}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Enhanced JSON Viewer with sorting, font controls, and global expansion toggles.
 */
export function JsonViewer({ data }: { data: unknown }) {
  const [fontSize, setFontSize] = useState(11);
  const [expandAll, setExpandAll] = useState(false);
  const [shrinkAll, setShrinkAll] = useState(false);

  // Automatically sort data on input
  const sortedData = useMemo(() => sortObjectKeys(data), [data]);

  const handleExpand = () => {
    setExpandAll(true);
    setShrinkAll(false);
  };

  const handleShrink = () => {
    setShrinkAll(true);
    setExpandAll(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Viewer Toolbar */}
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/40 gap-2">
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" size="icon" className="h-6 w-6" 
            onClick={() => setFontSize(Math.max(8, fontSize - 1))}
            title="Decrease Font Size"
          >
            <Minus className="w-3.5 h-3.5" />
          </Button>
          <span className="text-[10px] font-mono text-muted-foreground w-6 text-center">{fontSize}</span>
          <Button 
            variant="ghost" size="icon" className="h-6 w-6" 
            onClick={() => setFontSize(Math.min(24, fontSize + 1))}
            title="Increase Font Size"
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>
        </div>

        <div className="flex items-center gap-1">
          <Button 
            variant="outline" size="sm" className="h-6 px-2 text-[9px] font-bold gap-1"
            onClick={handleShrink}
          >
            <Minimize2 className="w-3 h-3" /> SHRINK ALL
          </Button>
          <Button 
            variant="outline" size="sm" className="h-6 px-2 text-[9px] font-bold gap-1"
            onClick={handleExpand}
          >
            <Maximize2 className="w-3 h-3" /> EXPAND ALL
          </Button>
        </div>
      </div>

      {/* Recursive Viewer */}
      <div className="flex-1 overflow-auto" style={{ fontSize: `${fontSize}px` }}>
        <JsonItem 
          data={sortedData} 
          expandAll={expandAll} 
          shrinkAll={shrinkAll} 
        />
      </div>
    </div>
  );
}
