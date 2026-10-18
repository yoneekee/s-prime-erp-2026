import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ERPLayout from "@/components/erp/ERPLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Plus, Search, FileText, ChevronLeft, ChevronRight,
} from "lucide-react";
import StatusFlowStepper from "@/components/erp/StatusFlowStepper";
import WorkflowActions from "@/components/erp/WorkflowActions";
import SlipStatusBanners from "@/components/erp/SlipStatusBanners";
import { toast } from "sonner";
import { useSlips } from "@/hooks/use-slip-store";
import { getSlipStatusLabel, getSlipStatusStyle } from "@/lib/slip-utils";
import { getFlowSteps } from "@/lib/workflow";
import { useAuth } from "@/hooks/use-auth";

const ProductionExecution = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const allSlips = useSlips();
  const slipList = useMemo(() => allSlips.filter(s => s.slipType === "PROD"), [allSlips]);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedSlip = searchParams.get("slipNo") ?? slipList[0]?.slipNo ?? "";
  const selectedSlipRec = slipList.find(s => s.slipNo === selectedSlip) ?? slipList[0];
  const [searchQuery, setSearchQuery] = useState("");
  const filteredSlips = slipList.filter(s => s.slipNo.toLowerCase().includes(searchQuery.toLowerCase()) || s.partner.toLowerCase().includes(searchQuery.toLowerCase()));
  useEffect(() => {
    const requested = searchParams.get("slipNo");
    const first = slipList[0];
    if (first && (!requested || !slipList.some(s => s.slipNo === requested))) {
      if (requested) toast.error("指定された伝票が見つかりません");
      setSearchParams(prev => { const next = new URLSearchParams(prev); next.set("slipNo", first.slipNo); return next; }, { replace: true });
    }
  }, [slipList, searchParams, setSearchParams]);
  const selectSlip = (slipNo: string) => setSearchParams(prev => { const next = new URLSearchParams(prev); next.set("slipNo", slipNo); return next; });
  const currentStatus = selectedSlipRec?.status ?? "S00";
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const statusInfo = { label: getSlipStatusLabel(currentStatus), color: getSlipStatusStyle(currentStatus) };
  const canCreate = currentUser?.role === "APPLICANT";
  const openEdit = () => {
    if (selectedSlipRec) navigate(`/production/execution/new?slipNo=${encodeURIComponent(selectedSlipRec.slipNo)}`);
  };

  return (
    <ERPLayout>
      <div className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">原材料・半製品購買</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              原材料・半製品の購買依頼から検収完了までを管理します
            </p>
          </div>
          {canCreate ? (
            <Button size="sm" onClick={() => navigate("/production/execution/new")} className="gap-1.5 bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="w-3.5 h-3.5" />
              新規伝票
            </Button>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <Button size="sm" disabled className="gap-1.5">
                    <Plus className="w-3.5 h-3.5" /> 新規伝票
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent><p className="text-xs">伝票の起票は「申請者」ロールのみ可能です</p></TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Top: Slip List + Action Buttons */}
        <div className="grid grid-cols-12 gap-4">
          {/* Slip List */}
          <Card className="col-span-12 lg:col-span-4 border-border bg-card">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">伝票一覧</CardTitle>
                <div className="flex items-center gap-1.5 bg-secondary rounded-md px-2.5 py-1">
                  <Search className="w-3 h-3 text-muted-foreground" />
                  <input
                    className="bg-transparent text-xs text-foreground placeholder:text-muted-foreground outline-none w-24"
                    placeholder="伝票番号・取引先検索"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-2 pb-2">
              <div className="space-y-1">
                {(() => {
                  const totalPages = Math.max(1, Math.ceil(filteredSlips.length / itemsPerPage));
                  const paged = filteredSlips.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
                  return (
                    <>
                      {paged.map((slip) => {
                        const st = { color: getSlipStatusStyle(slip.status), label: getSlipStatusLabel(slip.status) };
                        return (
                          <div
                            key={slip.slipNo}
                            onClick={() => selectSlip(slip.slipNo)}
                            className={`flex items-center justify-between px-3 py-2 rounded-md cursor-pointer transition-colors text-xs ${
                              selectedSlip === slip.slipNo
                                ? "bg-primary/10 border border-primary/30"
                                : "hover:bg-secondary border border-transparent"
                            }`}
                          >
                            <div className="space-y-0.5">
                              <div className="font-mono font-medium text-foreground">{slip.slipNo}</div>
                              <div className="text-muted-foreground">{slip.date} · {slip.requester}</div>
                            </div>
                            <div className="text-right space-y-0.5">
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${st?.color || ""}`}>
                                {st?.label.split(" ")[0] || slip.status}
                              </Badge>
                              <div className="text-muted-foreground">¥{slip.totalAmount.toLocaleString()}</div>
                            </div>
                          </div>
                        );
                      })}
                      {/* Pagination */}
                      <div className="flex items-center justify-between pt-2 px-1">
                        <span className="text-xs text-muted-foreground">
                          {filteredSlips.length}件中 {filteredSlips.length ? (currentPage - 1) * itemsPerPage + 1 : 0}-{Math.min(currentPage * itemsPerPage, filteredSlips.length)}件
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage((p) => p - 1)}
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </Button>
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="icon"
                              className="h-7 w-7 text-xs"
                              onClick={() => setCurrentPage(page)}
                            >
                              {page}
                            </Button>
                          ))}
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-7 w-7"
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage((p) => p + 1)}
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons Panel */}
          <Card className="col-span-12 lg:col-span-8 border-border bg-card">
            <CardHeader className="py-3 px-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">ワークフローアクション</CardTitle>
                <Badge className={`text-xs px-2.5 py-0.5 ${statusInfo.color}`}>
                  {statusInfo.label}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              {selectedSlipRec && <SlipStatusBanners slip={selectedSlipRec} />}
              {selectedSlipRec && (
                <WorkflowActions
                  slip={selectedSlipRec}
                  onEdit={openEdit}
                />
              )}
              {selectedSlipRec && <StatusFlowStepper {...getFlowSteps(selectedSlipRec)} />}
            </CardContent>
          </Card>
        </div>

        {/* Slip Header Info */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              伝票ヘッダ情報
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">伝票番号</label>
                <Input value={selectedSlipRec?.slipNo ?? ""} readOnly className="h-8 text-xs font-mono bg-muted/50 border-border" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">伝票ステータス</label>
                <div className="h-8 flex items-center">
                  <Badge className={`text-xs ${statusInfo.color}`}>{statusInfo.label}</Badge>
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">申請日</label>
                <Input value={selectedSlipRec?.date ?? "-"} readOnly className="h-8 text-xs bg-muted/50 border-border" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">申請者（部署）</label>
                <Input value={selectedSlipRec ? `${selectedSlipRec.requester}（${selectedSlipRec.department}）` : ""} readOnly className="h-8 text-xs bg-muted/50 border-border" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">希望発注先</label>
                <Input value={selectedSlipRec?.partner ?? "-"} readOnly className="h-8 text-xs bg-muted/50 border-border" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">確定発注先</label>
                <Input value={["P02", "P03", "P04", "I00"].includes(currentStatus) ? selectedSlipRec?.partner ?? "-" : "-"} readOnly className="h-8 text-xs bg-muted/50 border-border" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">合計金額</label>
                <Input value={`¥${(selectedSlipRec?.totalAmount ?? 0).toLocaleString()}`} readOnly className="h-8 text-xs font-mono bg-muted/50 border-border text-primary font-semibold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">備考</label>
                <Input value={selectedSlipRec?.remarks || "-"} readOnly className="h-8 text-xs border-border" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Detail Items Grid */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">明細品目一覧</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border">
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">品目コード</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">品目名</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">規格</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-center">単位</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">発注数量</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">入庫累計</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">単価</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">供給価額</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">LOT番号</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(selectedSlipRec?.details ?? []).map((item) => {
                    const fulfilled = item.inboundQty >= item.orderQty;
                    return (
                      <TableRow key={item.detailId} className="border-border hover:bg-secondary/50">
                        <TableCell className="px-3 py-2 text-xs font-mono text-primary">{item.itemCode}</TableCell>
                        <TableCell className="px-3 py-2 text-xs font-medium text-foreground">{item.itemName}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-muted-foreground">{item.spec}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-center text-muted-foreground">{item.unit}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right font-mono text-foreground">{item.orderQty.toLocaleString()}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right font-mono">
                          <span className={fulfilled ? "text-success" : "text-warning"}>
                            {item.inboundQty.toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right font-mono text-foreground">¥{item.unitPrice.toLocaleString()}</TableCell>
                        <TableCell className="px-3 py-2 text-xs text-right font-mono text-foreground">¥{item.supplyAmount.toLocaleString()}</TableCell>
                        <TableCell className="px-3 py-2 text-xs font-mono text-muted-foreground">
                          {item.lotNo || "-"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {/* Total Row */}
            <div className="flex justify-end items-center gap-4 px-4 py-2.5 border-t border-border bg-muted/30">
              <span className="text-xs text-muted-foreground">合計</span>
              <span className="text-sm font-mono font-bold text-primary">
                ¥{(selectedSlipRec?.totalAmount ?? 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Workflow History (新しい順) */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold">ワークフロー履歴</CardTitle>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border">
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 w-16 text-center">順番</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">処理状況</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">ステータス</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">処理者</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">権限・職務</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">コメント</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">処理日時</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(selectedSlipRec?.workflow ?? []).length === 0 ? (
                  <TableRow className="border-border">
                    <TableCell colSpan={7} className="px-3 py-6 text-xs text-center text-muted-foreground">
                      ワークフロー履歴がまだありません
                    </TableCell>
                  </TableRow>
                ) : [...(selectedSlipRec?.workflow ?? [])].reverse().map((wf) => (
                  <TableRow key={wf.stepNo} className="border-border hover:bg-secondary/50">
                    <TableCell className="px-3 py-2 text-xs text-center font-mono text-muted-foreground">{wf.stepNo}</TableCell>
                    <TableCell className="px-3 py-2 text-xs">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-primary/30 text-primary">
                        {wf.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs font-mono text-muted-foreground whitespace-nowrap">
                      {getSlipStatusLabel(wf.fromStatus)} → {getSlipStatusLabel(wf.toStatus)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-xs font-medium text-foreground">{wf.empName}</TableCell>
                    <TableCell className="px-3 py-2 text-xs text-muted-foreground">{wf.role}</TableCell>
                    <TableCell className="px-3 py-2 text-xs text-muted-foreground max-w-[200px] truncate">{wf.comment}</TableCell>
                    <TableCell className="px-3 py-2 text-xs font-mono text-muted-foreground">{wf.procAt}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
};

export default ProductionExecution;
