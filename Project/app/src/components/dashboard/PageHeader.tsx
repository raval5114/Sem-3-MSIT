interface PageHeaderProps {
  eyebrow?: string;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}

export default function PageHeader({ eyebrow = 'DINEFLOW WORKSPACE', title, description, action }: PageHeaderProps) {
  return (
    <div className="df-page-heading">
      <div>
        <p className="df-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="df-page-description">{description}</p>
      </div>
      {action && <button className="df-button df-button-primary" onClick={action.onClick}><span>＋</span>{action.label}</button>}
    </div>
  );
}
