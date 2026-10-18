import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getPendingTasks, getRecentActivity, getSlipDetailPath } from "@/lib/dashboard";
import { getSlipStatusLabel, getSlipStatusStyle } from "@/lib/slip-utils";
import { formatCurrency, formatDateTime } from "@/lib/format-utils";
import type { SlipFull } from "@/services/mock-store";
import type { WorkflowUser } from "@/lib/workflow";

export function PendingTasks({ slips, user }: { slips: SlipFull[]; user: WorkflowUser | null }) {
  const tasks = getPendingTasks(slips, user);
  const navigate = useNavigate();
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-semibold text-foreground mb-4">あなたの未処理タスク（{user?.roleLabel ?? "-"}）</h2>
      {tasks.length === 0 ? <p className="py-8 text-sm text-muted-foreground">現在、対応が必要な伝票はありません</p> : (
        <>
          <Table>
            <TableHeader><TableRow>
              <TableHead>伝票番号</TableHead><TableHead>伝票区分</TableHead><TableHead>状態</TableHead>
              <TableHead>取引先</TableHead><TableHead className="text-right">合計金額</TableHead><TableHead>次の操作</TableHead>
            </TableRow></TableHeader>
            <TableBody>{tasks.slice(0, 8).map(({ slip, actions }) => (
              <TableRow key={slip.slipNo} onClick={() => navigate(getSlipDetailPath(slip))} className="cursor-pointer">
                <TableCell className="whitespace-nowrap"><Link to={getSlipDetailPath(slip)} className="font-mono text-primary hover:underline">{slip.slipNo}</Link></TableCell>
                <TableCell><Badge variant="outline" className="whitespace-nowrap">{slip.typeName}</Badge></TableCell>
                <TableCell><Badge className={getSlipStatusStyle(slip.status)}>{getSlipStatusLabel(slip.status)}</Badge></TableCell>
                <TableCell className="min-w-[140px]">{slip.partner}</TableCell>
                <TableCell className="text-right font-mono whitespace-nowrap">{formatCurrency(slip.totalAmount)}</TableCell>
                <TableCell className="min-w-[120px] text-sm">{actions.join(" / ")}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
          {tasks.length > 8 && <p className="mt-3 text-xs text-muted-foreground">他 {tasks.length - 8}件</p>}
        </>
      )}
    </section>
  );
}

export function RecentWorkflow({ slips }: { slips: SlipFull[] }) {
  const activity = getRecentActivity(slips, 8);
  const navigate = useNavigate();
  return (
    <section className="min-w-0">
      <h2 className="text-sm font-semibold text-foreground mb-4">最近のワークフロー</h2>
      {activity.length === 0 ? <p className="py-8 text-sm text-muted-foreground">ワークフロー履歴はありません</p> : (
        <Table>
          <TableHeader><TableRow><TableHead>処理日時</TableHead><TableHead>伝票番号</TableHead><TableHead>処理</TableHead><TableHead>担当者</TableHead><TableHead>状態遷移</TableHead></TableRow></TableHeader>
          <TableBody>{activity.map(entry => (
            <TableRow key={entry.key} onClick={() => navigate(getSlipDetailPath(entry))} className="cursor-pointer">
              <TableCell className="font-mono whitespace-nowrap text-xs">{formatDateTime(entry.procAt.replace(" ", "T"))}</TableCell>
              <TableCell className="whitespace-nowrap"><Link to={getSlipDetailPath(entry)} className="font-mono text-primary hover:underline">{entry.slipNo}</Link></TableCell>
              <TableCell className="whitespace-nowrap">{entry.label}</TableCell>
              <TableCell className="min-w-[180px]">{entry.empName}（{entry.role}）</TableCell>
              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{getSlipStatusLabel(entry.fromStatus)} → {getSlipStatusLabel(entry.toStatus)}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      )}
    </section>
  );
}