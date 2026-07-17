import Link from 'next/link';
import { Inbox } from 'lucide-react';

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="empty-state">
      <div className="state-icon">
        <Inbox aria-hidden="true" />
      </div>
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action ? (
        <Link className="button button--primary" href={action.href}>
          {action.label}
        </Link>
      ) : null}
    </div>
  );
}
