'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { Appear } from '@/components/appear';
import { FormError } from '@/components/form-message';
import { MonoLabel } from '@/components/mono-label';
import { Panel } from '@/components/panel';
import { StatusChip } from '@/components/status-chip';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { loadUsage } from '@/lib/actions';
import { alignUsageRows, channelLabel, checkPhrase, formatCallTime, shortBuyer, type AlignedCall, type RecentCall } from '@/lib/copy';
import type { Usage } from '@/lib/misa-client';

const COLUMNS = 'lg:grid-cols-[5.5rem_minmax(0,1.3fr)_8.5rem_4.5rem_minmax(0,1.45fr)_7.5rem_4.5rem]';

export function UsageView({ initial }: { initial: Usage }) {
  const router = useRouter();
  const [usage, setUsage] = useState(initial);
  const [detail, setDetail] = useState<string>();
  const previous = useRef<AlignedCall[]>([]);
  const shownAt = useRef(new Map<string, string>());
  const previousHeight = useRef(0);

  const recent = [...usage.recent].sort((left, right) => Date.parse(right.at) - Date.parse(left.at)).slice(0, 50);
  const aligned = alignUsageRows(previous.current, recent);
  previous.current = aligned.map((item) => ({ key: item.key, row: item.row }));
  for (const item of aligned) {
    if (!shownAt.current.has(item.key)) shownAt.current.set(item.key, item.row.at);
  }
  const signature = aligned.map((item) => item.key).join('\n');

  useEffect(() => {
    let stopped = false;
    let ticket = 0;
    const poll = async () => {
      const mine = ++ticket;
      const result = await loadUsage();
      if (stopped || mine !== ticket) return;
      if (!result.ok) {
        if (result.reason === 'session') {
          router.push('/');
          return;
        }
        setDetail(result.detail);
        return;
      }
      setDetail(undefined);
      setUsage(result.usage);
    };
    const timer = window.setInterval(() => void poll(), 3000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, [router]);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const delta = root.scrollHeight - previousHeight.current;
    if (previousHeight.current > 0 && delta > 0 && window.scrollY > 80) {
      window.scrollTo({ top: window.scrollY + delta });
    }
    previousHeight.current = root.scrollHeight;
  }, [signature]);

  const tiles = [
    { label: 'Calls', value: String(usage.totals.calls) },
    { label: 'Charged', value: String(usage.totals.charged) },
    { label: 'Refused by check', value: String(usage.totals.refused_by_check) },
    { label: 'Revenue', value: `$${usage.totals.revenue_usd}`, accent: true },
    { label: 'Buyers', value: String(usage.totals.unique_buyers) },
    { label: 'Average latency', value: `${usage.totals.avg_latency_ms} ms` },
  ];

  return (
    <div className="grid gap-6">
      <FormError message={detail} />
      <Panel title="Totals" description="This page updates every few seconds.">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border bg-background/40 px-4 py-3">
              <dt>
                <MonoLabel>{tile.label}</MonoLabel>
              </dt>
              <dd className={`mt-2 font-display text-2xl font-semibold tracking-tight ${tile.accent === true ? 'text-accent' : ''}`}>
                {tile.value}
              </dd>
            </div>
          ))}
        </dl>
      </Panel>

      {usage.totals.calls > 0 && (
        <Panel title="By operation">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operation</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Charged</TableHead>
                <TableHead>Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usage.by_operation.map((row) => (
                <TableRow key={row.operation_id}>
                  <TableCell className="font-mono whitespace-normal">{row.operation_id}</TableCell>
                  <TableCell className="font-mono">{row.calls}</TableCell>
                  <TableCell className="font-mono">{row.charged}</TableCell>
                  <TableCell className="font-mono">${row.revenue_usd}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Panel title="Recent calls">
        {aligned.length === 0 ? (
          <p className="text-sm text-muted-foreground">No agent calls yet. When an agent buys, each call shows here with its receipt.</p>
        ) : (
          <div className="grid gap-2">
            <div className={`hidden px-1 font-mono text-[11px] tracking-[0.12em] text-muted-foreground uppercase lg:grid ${COLUMNS}`}>
              <span>Time</span>
              <span>Operation</span>
              <span>Channel</span>
              <span>Price</span>
              <span>Result</span>
              <span>Buyer</span>
              <span>Latency</span>
            </div>
            {aligned.map((item, index) => (
              <Appear key={item.key} index={index}>
                <CallRow row={item.row} at={shownAt.current.get(item.key) ?? item.row.at} />
              </Appear>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

function CallRow({ row, at }: { row: RecentCall; at: string }) {
  const refused = !row.charged || row.check === 'failed';
  return (
    <div className={`grid min-w-0 gap-2 rounded-2xl border px-3 py-3 lg:items-center lg:rounded-none lg:border-0 lg:border-b lg:px-1 ${COLUMNS}`}>
      <LocalTime iso={at} />
      <span className="min-w-0 font-mono text-sm break-words" title={row.operation_id}>
        {row.operation_id}
      </span>
      <span className="text-sm text-muted-foreground">{channelLabel(row.channel)}</span>
      <span className="font-mono text-sm">${row.price_usd}</span>
      <span className="flex flex-wrap items-center gap-2">
        {refused ? (
          <>
            <StatusChip tone="wait">Refused, not charged</StatusChip>
            {row.failed_checks.length > 0 && (
              <span className="text-sm text-muted-foreground">{row.failed_checks.map((name) => checkPhrase(name)).join(', ')}</span>
            )}
          </>
        ) : (
          <StatusChip tone="pass">Charged</StatusChip>
        )}
      </span>
      <span className="font-mono text-sm" title={row.buyer}>
        {shortBuyer(row.buyer)}
      </span>
      <span className="font-mono text-sm text-muted-foreground">{row.latency_ms} ms</span>
    </div>
  );
}

function LocalTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState('');
  useEffect(() => {
    setLabel(formatCallTime(iso));
  }, [iso]);
  return <span className="font-mono text-sm tabular-nums">{label}</span>;
}
