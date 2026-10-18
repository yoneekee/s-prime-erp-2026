import { AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useItems } from "@/hooks/use-master-store";
import { getSafetyStockAlerts } from "@/lib/dashboard";
import { formatNumber } from "@/lib/format-utils";

const SafetyStockAlert = () => {
  const { data: items } = useItems();
  const alertItems = getSafetyStockAlerts(items);
  return (
    <div className="card-glow border-glow rounded-lg bg-card p-4 h-full animate-slide-up" style={{ animationDelay: "350ms" }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-semibold text-foreground">安全在庫割れ警告</h3>
        </div>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/20 text-destructive font-medium">
          {alertItems.length}件
        </span>
      </div>
      <div className="space-y-2">
        {alertItems.length === 0 && <p className="py-6 text-sm text-muted-foreground">安全在庫を下回る品目はありません</p>}
        {alertItems.map((item) => {
          return (
            <Link to="/master/item" key={item.itemId} className="block p-2.5 rounded-md bg-destructive/5 border border-destructive/10 hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="flex-1 min-w-0">
                <div className="space-y-1">
                  <div className="text-xs font-mono text-primary break-all">{item.itemCode}</div>
                  <div className="text-sm text-foreground">{item.itemName}</div>
                </div>
                <div className="mt-2">
                  <span className="text-xs font-mono text-destructive whitespace-nowrap">
                    {formatNumber(item.stockQty)} / {formatNumber(item.safetyStock)} {item.unit}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
};

export default SafetyStockAlert;
