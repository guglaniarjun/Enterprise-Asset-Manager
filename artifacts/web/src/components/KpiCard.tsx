import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: number | string;
  suffix?: string;
  hint?: string;
  href?: string;
  trend?: "ok" | "warning" | "danger";
};

export function KpiCard({ title, value, suffix, hint, href, trend }: Props) {
  const valueColor =
    trend === "danger"
      ? "text-destructive"
      : trend === "warning"
        ? "text-amber-600"
        : "text-foreground";
  const inner = (
    <Card
      className={cn(
        "transition-shadow",
        href && "hover:shadow-md hover:border-primary/40 cursor-pointer",
      )}
    >
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {href && <ArrowRight className="w-4 h-4 text-muted-foreground" />}
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", valueColor)}>
          {value}
          {suffix ?? ""}
        </div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}
