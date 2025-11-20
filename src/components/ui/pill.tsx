import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const pillVariants = cva(
  'inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold transition-colors shadow-sm',
  {
    variants: {
      variant: {
        default: 'bg-slate-900 text-white',
        success: 'bg-emerald-600 text-white',
        warning: 'bg-amber-500 text-slate-900',
        info: 'bg-indigo-600 text-white',
        muted: 'bg-slate-100 text-slate-800'
      }
    },
    defaultVariants: {
      variant: 'default'
    }
  }
);

export interface PillProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof pillVariants> {}

export function Pill({ className, variant, ...props }: PillProps) {
  return (
    <div className={cn(pillVariants({ variant }), className)} {...props} />
  );
}
