import type { ReactNode } from 'react';

export default function PageHeading({ eyebrow, title, description, action }: {
    eyebrow: string; title: string; description?: ReactNode; action?: ReactNode;
}) {
    return <header className="page-heading">
        <div className="page-heading-copy">
            <p className="app-eyebrow"><span aria-hidden="true" />{eyebrow}</p>
            <h1>{title}</h1>
            {description && <div className="page-description">{description}</div>}
        </div>
        {action && <div className="page-heading-action">{action}</div>}
    </header>;
}
