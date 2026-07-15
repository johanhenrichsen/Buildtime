import { useState } from 'react';
import { Download, Loader2, Clock, FileText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { useToast } from '@/hooks/use-toast';
import { useAttendanceEvents } from '@/lib/queries';
import { useWorkers } from '@/lib/queries';
import type { AttendanceEventRow } from '@/lib/api';

// ── Helpers ───────────────────────────────────────────────────────────────────

function today() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() + 1); // Monday
  return d.toISOString().slice(0, 10);
}

function startOfLastWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay() - 6); // last Monday
  return d.toISOString().slice(0, 10);
}

function endOfLastWeek() {
  const d = new Date();
  d.setDate(d.getDate() - d.getDay()); // last Sunday
  return d.toISOString().slice(0, 10);
}

function startOfMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
}

function formatDateOnly(iso: string) {
  return new Date(iso).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}

function matchMethodLabel(m: string) {
  return m === 'face' ? 'Face' : m === 'face_low_confidence' ? 'Face (low)' : 'Employee ID';
}

function eventLabel(t: string) {
  return t === 'in' ? 'Clock In' : 'Clock Out';
}

// Build CSV from raw events — one row per event
function buildCsv(events: AttendanceEventRow[]): string {
  const headers = ['Worker Name', 'Employee No', 'Date', 'Time', 'Event', 'Site', 'Match Method', 'Flagged'];
  const rows = events.map((e) => [
    e.worker.name,
    e.worker.employeeNo,
    formatDateOnly(e.serverTs),
    formatTime(e.serverTs),
    eventLabel(e.eventType),
    e.site.name,
    matchMethodLabel(e.matchMethod),
    e.flaggedForReview ? 'Yes' : 'No',
  ]);
  return [headers, ...rows].map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Quick range presets ───────────────────────────────────────────────────────

const PRESETS = [
  { label: 'Today',      from: () => today(),         to: () => today() },
  { label: 'Yesterday',  from: () => daysAgo(1),      to: () => daysAgo(1) },
  { label: 'This Week',  from: startOfWeek,           to: today },
  { label: 'Last Week',  from: startOfLastWeek,       to: endOfLastWeek },
  { label: 'This Month', from: startOfMonth,          to: today },
  { label: 'Last 30 days', from: () => daysAgo(30),  to: today },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function Reports() {
  const { toast } = useToast();

  const [from, setFrom]         = useState(startOfWeek);
  const [to, setTo]             = useState(today);
  const [workerFilter, setWorkerFilter] = useState('');
  const [activePreset, setActivePreset] = useState('This Week');

  const { data: workersData } = useWorkers({ status: 'active', limit: 200 });
  const workers = workersData?.data ?? [];

  const { data: events = [], isLoading, isFetching } = useAttendanceEvents({
    from,
    to,
    workerId: workerFilter || undefined,
  });

  function applyPreset(preset: typeof PRESETS[0]) {
    setFrom(preset.from());
    setTo(preset.to());
    setActivePreset(preset.label);
  }

  function handleFromChange(val: string) {
    setFrom(val);
    setActivePreset('');
  }

  function handleToChange(val: string) {
    setTo(val);
    setActivePreset('');
  }

  function handleExport() {
    if (events.length === 0) {
      toast({ title: 'No data', description: 'No events in this date range.', variant: 'destructive' });
      return;
    }
    const filename = `attendance-${from}_to_${to}.csv`;
    downloadCsv(buildCsv(events), filename);
    toast({ title: 'Exported', description: `${events.length} events downloaded as ${filename}` });
  }

  const PREVIEW_LIMIT = 200;
  const preview = events.slice(0, PREVIEW_LIMIT);

  return (
    <div className="p-4 sm:p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">Attendance Log</h1>
        <p className="text-sm text-muted-foreground mt-0.5">View and export worker clock-in/out times for any date range</p>
      </div>

      {/* ── Filters ──────────────────────────────────────────────────────── */}
      <div className="bg-card border border-border rounded-lg p-4 mb-4 space-y-4">
        {/* Quick presets */}
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors border ${
                activePreset === p.label
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-muted border-border text-muted-foreground hover:text-foreground'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Date range + worker filter */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs mb-1 block">From</Label>
            <Input type="date" value={from} onChange={(e) => handleFromChange(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label className="text-xs mb-1 block">To</Label>
            <Input type="date" value={to} onChange={(e) => handleToChange(e.target.value)} className="w-40" />
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs mb-1 block">Worker (optional)</Label>
            <Select value={workerFilter} onValueChange={setWorkerFilter}>
              <SelectTrigger>
                <SelectValue placeholder="All workers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All workers</SelectItem>
                {workers.map((w) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} <span className="text-muted-foreground">({w.employeeNo})</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={handleExport}
            disabled={isLoading || isFetching || events.length === 0}
            className="flex-shrink-0"
          >
            {isFetching
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Loading…</>
              : <><Download className="w-4 h-4 mr-2" />Export CSV</>}
          </Button>
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────── */}
      {isLoading ? (
        <div className="bg-card border border-border rounded-lg p-4">
          <TableSkeleton rows={6} cols={5} />
        </div>
      ) : events.length === 0 && from && to ? (
        <div className="bg-card border border-border rounded-lg p-12 text-center">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h2 className="font-semibold text-foreground mb-1">No events found</h2>
          <p className="text-sm text-muted-foreground">
            No clock-in or clock-out events recorded between {formatDate(from)} and {formatDate(to)}.
          </p>
        </div>
      ) : events.length > 0 ? (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-semibold">
                {events.length} event{events.length !== 1 ? 's' : ''}
                {from && to && ` · ${formatDate(from)} – ${formatDate(to)}`}
              </span>
            </div>
            {events.length > PREVIEW_LIMIT && (
              <span className="text-xs text-muted-foreground">Showing first {PREVIEW_LIMIT} — export for full data</span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Worker</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Time</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Event</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Site</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Method</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((ev) => (
                  <tr key={ev.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{ev.worker.name}</div>
                      <div className="text-xs text-muted-foreground font-mono">{ev.worker.employeeNo}</div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{formatDateOnly(ev.serverTs)}</td>
                    <td className="px-4 py-2.5 font-mono font-medium">{formatTime(ev.serverTs)}</td>
                    <td className="px-4 py-2.5">
                      <Badge className={`text-xs ${
                        ev.eventType === 'in'
                          ? 'bg-emerald-100 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                          : 'bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-100'
                      }`}>
                        {eventLabel(ev.eventType)}
                      </Badge>
                      {ev.flaggedForReview && (
                        <Badge className="ml-1 text-xs bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-100">Flagged</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{ev.site.name}</td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{matchMethodLabel(ev.matchMethod)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {/* ── Payroll DTR export (secondary) ───────────────────────────────── */}
      <PayrollDtrExport />
    </div>
  );
}

// ── Legacy payroll DTR export ──────────────────────────────────────────────────

import { useCutoffs } from '@/lib/queries';
import { exportDtr } from '@/lib/api';

function PayrollDtrExport() {
  const { toast } = useToast();
  const { data } = useCutoffs();
  const [selectedCutoff, setSelectedCutoff] = useState('');
  const [loading, setLoading] = useState(false);
  const cutoffs = data?.data ?? [];

  async function handleExport() {
    if (!selectedCutoff) return;
    setLoading(true);
    try {
      const rows = await exportDtr(selectedCutoff) as Record<string, unknown>[];
      if (!rows.length) {
        toast({ title: 'No data', description: 'No DTR records for this period.', variant: 'destructive' });
        return;
      }
      const cutoff = cutoffs.find((c) => c.id === selectedCutoff);
      const range = cutoff ? `${cutoff.periodStart.slice(0, 10)}_to_${cutoff.periodEnd.slice(0, 10)}` : selectedCutoff;
      const headers = Object.keys(rows[0]);
      const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => JSON.stringify(r[h] ?? '')).join(','))].join('\n');
      downloadCsv(csv, `dtr-${range}.csv`);
      toast({ title: 'Exported', description: 'DTR data downloaded.' });
    } catch {
      toast({ title: 'Error', description: 'Failed to export DTR.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }

  if (cutoffs.length === 0) return null;

  return (
    <div className="mt-6 bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Payroll DTR Export</h2>
        <span className="text-xs text-muted-foreground">(computed records by cutoff period)</span>
      </div>
      <div className="flex items-end gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px]">
          <Label className="text-xs mb-1 block">Cutoff Period</Label>
          <Select value={selectedCutoff} onValueChange={setSelectedCutoff}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a period…" />
            </SelectTrigger>
            <SelectContent>
              {cutoffs.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {formatDate(c.periodStart)} – {formatDate(c.periodEnd)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button variant="outline" onClick={handleExport} disabled={loading || !selectedCutoff}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Exporting…</> : <><Download className="w-4 h-4 mr-2" />Export DTR CSV</>}
        </Button>
      </div>
    </div>
  );
}
