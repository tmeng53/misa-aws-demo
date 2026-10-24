import { CopyButton } from '@/components/copy-button';
import { MonoLabel } from '@/components/mono-label';
import type { Published } from '@/lib/misa-client';

const LINES = [
  { key: 'door_url', label: 'Where agents call you' },
  { key: 'listing_url', label: 'Your listing' },
  { key: 'openapi_url', label: 'OpenAPI description' },
] as const;

/** Lets a long URL wrap at slashes and hyphens without changing what Copy uses. */
function readableUrl(value: string): string {
  return value.replaceAll('/', '/\u200b').replaceAll('-', '-\u200b');
}

export function LiveLinks({ links }: { links: Published }) {
  return (
    <ul className="grid gap-4">
      {LINES.map((line) => {
        const value = links[line.key];
        return (
          <li key={line.key} className="flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <MonoLabel>{line.label}</MonoLabel>
              <p className="mt-1 font-mono text-sm break-words">{readableUrl(value)}</p>
            </div>
            <CopyButton value={value} />
          </li>
        );
      })}
    </ul>
  );
}
