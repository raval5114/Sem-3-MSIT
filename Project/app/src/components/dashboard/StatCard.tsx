interface StatCardProps {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  tone?: 'orange' | 'green' | 'purple' | 'blue';
}

export default function StatCard({ label, value, detail, icon, tone = 'orange' }: StatCardProps) {
  return (
    <article className="df-stat-card">
      <div className={`df-stat-icon tone-${tone}`}>{icon}</div>
      <div className="df-stat-copy"><span>{label}</span><strong>{value}</strong><small>{detail}</small></div>
      <span className="df-stat-corner">↗</span>
    </article>
  );
}
