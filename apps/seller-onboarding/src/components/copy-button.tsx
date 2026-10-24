'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';

export function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setFailed(false);
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        } catch {
          setCopied(false);
          setFailed(true);
        }
      }}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? 'Copied' : failed ? 'Copy failed' : 'Copy'}
    </Button>
  );
}
