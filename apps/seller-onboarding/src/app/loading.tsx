import { PendingOrb } from '@/components/pending-orb';

export default function Loading() {
  return (
    <div className="flex items-center gap-3 text-sm text-muted-foreground" role="status">
      <PendingOrb />
      Loading
    </div>
  );
}
