import { useEffect, useMemo, useState, type FormEvent } from 'react';
import PageHeader from '../components/dashboard/PageHeader';
import StatCard from '../components/dashboard/StatCard';
import { revenueService, type TableRevenueReport } from '../services/revenueService';
import { tableService, type RestaurantTable } from '../services/tableService';

function localDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function money(amount: number, currency: string) {
  try { return new Intl.NumberFormat('en-IN', { style: 'currency', currency }).format(amount); }
  catch { return `${currency} ${amount.toFixed(2)}`; }
}

function errorMessage(cause: unknown) {
  if (typeof cause === 'object' && cause !== null && 'response' in cause) {
    const response = (cause as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }
  return cause instanceof Error ? cause.message : 'The revenue report could not be loaded.';
}

export default function TableRevenueAnalytics({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(localDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [to, setTo] = useState(localDate(today));
  const [appliedRange, setAppliedRange] = useState({ from: localDate(new Date(today.getFullYear(), today.getMonth(), 1)), to: localDate(today) });
  const [report, setReport] = useState<TableRevenueReport | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([
      revenueService.getRestaurantRevenue(appliedRange.from, appliedRange.to),
      tableService.list().catch(() => [] as RestaurantTable[]),
    ]).then(([result, tableList]) => {
      if (!active) return;
      setReport(result);
      setTables(tableList);
    }).catch((cause: unknown) => {
      if (active) setError(errorMessage(cause));
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [appliedRange]);

  const tableLabels = useMemo(() => new Map(tables.map((table) => [table.id, table.displayName || `Table ${table.tableNumber}`])), [tables]);
  const applyRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (from > to) { setError('Start date must be on or before end date.'); return; }
    setError('');
    setLoading(true);
    setAppliedRange({ from, to });
  };
  const refreshReport = () => {
    setError('');
    setLoading(true);
    setAppliedRange({ ...appliedRange });
  };
  const currency = report?.currency || 'INR';

  return <>
    <PageHeader eyebrow={eyebrow} title={title} description={description} />
    <section className="df-panel">
      <div className="df-panel-heading"><div><p className="df-eyebrow">REPORTING PERIOD</p><h2>Choose dates</h2></div></div>
      <form className="df-inline-form" onSubmit={applyRange}>
        <div className="df-form-grid">
          <label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label>
          <label>To<input type="date" value={to} min={from} max={localDate(today)} onChange={(event) => setTo(event.target.value)} /></label>
        </div>
        <div className="df-form-actions"><button className="df-button df-button-primary" disabled={loading}>Apply period</button></div>
      </form>
    </section>

    {error && <div className="df-alert error" role="alert">{error}<button onClick={refreshReport}>Retry</button></div>}
    {loading ? <div className="df-empty">Loading table revenue…</div> : report && <>
      <div className="df-stat-grid">
        <StatCard label="Settled sales" value={money(report.grossRevenue, currency)} detail="Paid orders in this period" icon="↗" tone="green" />
        <StatCard label="Refunds" value={money(report.refunds, currency)} detail="Subtracted from net revenue" icon="↩" tone="orange" />
        <StatCard label="Net revenue" value={money(report.netRevenue, currency)} detail="Settled sales less refunds" icon="₹" tone="blue" />
        <StatCard label="Settled orders" value={report.completedOrders} detail={`${report.period.from} to ${report.period.to}`} icon="▣" tone="purple" />
      </div>
      <section className="df-panel">
        <div className="df-panel-heading"><div><p className="df-eyebrow">TABLE PERFORMANCE</p><h2>Revenue by table</h2></div><button className="df-icon-button" aria-label="Refresh report" onClick={refreshReport}>↻</button></div>
        {!report.tables?.length ? <div className="df-empty">No settled orders were recorded for this period.</div> : <div className="df-table-wrap"><table className="df-table"><thead><tr><th>Table</th><th>Settled orders</th><th>Gross sales</th><th>Refunds</th><th>Net revenue</th></tr></thead><tbody>{report.tables.map((row) => <tr key={`${row.tableId}:${row.currency}`}><td><strong>{tableLabels.get(row.tableId) || `Table ${row.tableId.slice(0, 8)}`}</strong></td><td>{row.completedOrders}</td><td>{money(row.grossRevenue, row.currency)}</td><td>{money(row.refunds, row.currency)}</td><td><strong>{money(row.netRevenue, row.currency)}</strong></td></tr>)}</tbody></table></div>}
      </section>
      <p className="df-footnote">Only paid or refunded orders are included. Unpaid and pending orders are excluded. Refunds are subtracted from gross sales; the reporting period uses order creation dates.</p>
    </>}
  </>;
}
