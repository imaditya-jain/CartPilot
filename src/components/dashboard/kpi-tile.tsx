import type { LucideIcon } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { Card, CardContent } from "@/components/ui/card";

export type KpiTone = "primary" | "success" | "warning" | "danger";

const TONE_CLASSES: Record<KpiTone, { swatch: string; icon: string }> = {
  primary: { swatch: "bg-primary/10", icon: "text-primary" },
  success: { swatch: "bg-success/10", icon: "text-success" },
  warning: { swatch: "bg-warning/10", icon: "text-warning" },
  danger: { swatch: "bg-danger/10", icon: "text-danger" },
};

const TONE_STROKE: Record<KpiTone, string> = {
  primary: "rgb(var(--color-primary))",
  success: "rgb(var(--color-success))",
  warning: "rgb(var(--color-warning))",
  danger: "rgb(var(--color-danger))",
};

interface KpiTileProps {
  label: string;
  value: string;
  icon: LucideIcon;
  tone: KpiTone;
  trend?: number[];
}

export function KpiTile({ label, value, icon: Icon, tone, trend }: KpiTileProps) {
  const toneClasses = TONE_CLASSES[tone];
  const showSparkline = trend && trend.length >= 2;

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
          </div>
          <div className={`rounded-md p-2 ${toneClasses.swatch}`}>
            <Icon className={`h-4 w-4 ${toneClasses.icon}`} aria-hidden="true" />
          </div>
        </div>
        {showSparkline && (
          <div className="mt-3 h-8">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={`sparkline-${tone}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TONE_STROKE[tone]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={TONE_STROKE[tone]} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="v"
                  stroke={TONE_STROKE[tone]}
                  strokeWidth={1.5}
                  fill={`url(#sparkline-${tone})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
