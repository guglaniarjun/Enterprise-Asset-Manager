import { Link } from "wouter";
import { ChevronRight, Home } from "lucide-react";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
      <Link href="/" className="flex items-center hover:text-foreground">
        <Home className="w-3.5 h-3.5" />
      </Link>
      {items.map((c, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5" />
          {c.href && i < items.length - 1 ? (
            <Link href={c.href} className="hover:text-foreground">{c.label}</Link>
          ) : (
            <span className={i === items.length - 1 ? "font-medium text-foreground" : ""}>{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
