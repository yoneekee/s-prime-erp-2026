import { ClipboardCheck, Package, Truck, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import ERPLayout from "@/components/erp/ERPLayout";
import KPICard from "@/components/erp/KPICard";
import SafetyStockAlert from "@/components/erp/SafetyStockAlert";
import SlipStatusChart from "@/components/erp/SlipStatusChart";
import { PendingTasks, RecentWorkflow } from "@/components/erp/DashboardWorkflow";
import { useSlips } from "@/hooks/use-slip-store";
import { useItems } from "@/hooks/use-master-store";
import { useAuth } from "@/hooks/use-auth";
import { getDashboardCounts } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format-utils";

const Index = () => {
  const slips = useSlips();
  const { data: items } = useItems();
  const { currentUser } = useAuth();
  const counts = getDashboardCounts(slips, items);
  const kpis = [
    { title: "承認待ち", value: counts.pending, icon: ClipboardCheck, path: "/production/slips" },
    { title: "購買進行中", value: counts.purchasing, icon: Package, path: "/production/execution" },
    { title: "出庫進行中", value: counts.shipping, icon: Truck, path: "/production/shipping" },
    { title: "安全在庫割れ", value: counts.lowStock, icon: AlertTriangle, path: "/master/item" },
  ];
  return (
    <ERPLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-lg font-bold text-foreground">全体ダッシュボード</h1>
          <div className="data-text text-xs text-muted-foreground">最終更新: {new Date().toLocaleString("ja-JP")}</div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map(kpi => <Link key={kpi.title} to={kpi.path} className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring hover:opacity-90">
            <KPICard title={kpi.title} value={`${formatNumber(kpi.value)}件`} icon={kpi.icon} />
          </Link>)}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 min-w-0"><PendingTasks slips={slips} user={currentUser} /></div>
          <div className="min-w-0"><SlipStatusChart /></div>
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 border-t border-border pt-6">
          <div className="xl:col-span-2 min-w-0"><RecentWorkflow slips={slips} /></div>
          <div className="min-w-0"><SafetyStockAlert /></div>
        </div>
      </div>
    </ERPLayout>
  );
};

export default Index;
