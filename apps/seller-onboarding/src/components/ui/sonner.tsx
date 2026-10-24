'use client';
/**
 * shadcn/ui's Toaster (sonner), adapted to the repo's lint rules: always dark
 * (Misa has no light theme), with sonner's CSS variables set as classes.
 */
import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { Toaster as Sonner, type ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group [--border-radius:var(--radius-xl)] [--normal-bg:var(--popover)] [--normal-border:var(--border)] [--normal-text:var(--popover-foreground)]"
    icons={{
      success: <CircleCheckIcon className="size-4 text-pass" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4 text-wait" />,
      error: <OctagonXIcon className="size-4 text-fail" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    toastOptions={{
      classNames: {
        toast: 'cn-toast',
      },
    }}
    {...props}
  />
);

export { Toaster };
