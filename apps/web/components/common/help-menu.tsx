'use client';

import { ChevronDown, CircleHelp, CirclePlay, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const ICONS = { help: CircleHelp, video: CirclePlay, updates: Sparkles };
export type HelpMenuItem = { href: string; label: string; icon: keyof typeof ICONS };

/**
 * One "Help" menu for the help center, the video tour and What's new, the same on the
 * website and in the app (the app opens them in a new tab, so work in progress stays put).
 */
export function HelpMenu({
  label,
  items,
  newTab = false,
  className,
}: {
  label: string;
  items: HelpMenuItem[];
  newTab?: boolean;
  className?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn('text-muted-foreground', className)}
          data-testid="help-menu"
        >
          {label} <ChevronDown className="opacity-60" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        {items.map(({ href, label, icon }) => {
          const Icon = ICONS[icon];
          return (
            <DropdownMenuItem key={href} asChild>
              <a href={href} {...(newTab && { target: '_blank', rel: 'noopener' })}>
                <Icon aria-hidden /> {label}
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
