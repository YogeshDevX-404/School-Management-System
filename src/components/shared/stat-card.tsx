import { motion } from 'framer-motion';
import { type LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number;
  trendLabel?: string;
  color?: 'primary' | 'success' | 'warning' | 'destructive' | 'chart-4' | 'chart-5';
  delay?: number;
}

const colorMap = {
  primary: 'from-sky-500 to-blue-600',
  success: 'from-emerald-500 to-green-600',
  warning: 'from-amber-500 to-orange-600',
  destructive: 'from-rose-500 to-red-600',
  'chart-4': 'from-violet-500 to-purple-600',
  'chart-5': 'from-pink-500 to-rose-600',
};

export function StatCard({ title, value, icon: Icon, trend, trendLabel, color = 'primary', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <Card className="group relative overflow-hidden p-5 transition-shadow hover:shadow-lg">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
            {trend !== undefined && (
              <div className="mt-2 flex items-center gap-1.5">
                <span className={cn(
                  'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  trend >= 0 ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
                )}>
                  {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {Math.abs(trend)}%
                </span>
                {trendLabel && <span className="text-[11px] text-muted-foreground">{trendLabel}</span>}
              </div>
            )}
          </div>
          <div className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md transition-transform group-hover:scale-110',
            colorMap[color]
          )}>
            <Icon className="h-6 w-6" />
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
