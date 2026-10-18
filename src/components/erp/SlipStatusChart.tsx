import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { FileText } from "lucide-react";

import { useSlips } from "@/hooks/use-slip-store";
import { SLIP_STATUS_CONFIG, type SlipStatusConfig } from "@/lib/slip-utils";

const categories: { category: SlipStatusConfig["category"]; name: string; color: string }[] = [
  { category: "draft", name: "作成中", color: "hsl(var(--muted-foreground))" },
  { category: "pending", name: "申請・承認待ち", color: "hsl(var(--warning))" },
  { category: "approved", name: "承認済", color: "hsl(var(--success))" },
  { category: "rejected", name: "否認", color: "hsl(var(--destructive))" },
  { category: "processing", name: "処理中", color: "hsl(var(--primary))" },
  { category: "complete", name: "完了", color: "hsl(var(--info))" },
];

const SlipStatusChart = () => {
  const slips = useSlips();
  const statusData = categories.map(c => ({ ...c, value: slips.filter(s => SLIP_STATUS_CONFIG[s.status]?.category === c.category).length }));
  const total = slips.length;
  return (
    <div className="card-glow border-glow rounded-lg bg-card p-4 h-full animate-slide-up" style={{ animationDelay: "450ms" }}>
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">伝票ステータス状況</h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="w-32 h-32 flex-shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={statusData}
                cx="50%"
                cy="50%"
                innerRadius={28}
                outerRadius={52}
                paddingAngle={2}
                dataKey="value"
                strokeWidth={0}
              >
                {statusData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "11px",
                  color: "hsl(var(--popover-foreground))",
                }}
                formatter={(value: number, name: string) => [`${value}件 (${((value / (total || 1)) * 100).toFixed(0)}%)`, name]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-1.5">
          {statusData.map((item, i) => (
            <div key={i} className="flex items-center justify-between text-[11px]">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: item.color }} />
                <span className="text-foreground">{item.name}</span>
              </div>
              <span className="font-mono text-muted-foreground">{item.value}件</span>
            </div>
          ))}
          <div className="pt-1 border-t border-border flex items-center justify-between text-[11px] font-medium">
            <span className="text-foreground">合計</span>
            <span className="font-mono text-primary">{total}件</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SlipStatusChart;
