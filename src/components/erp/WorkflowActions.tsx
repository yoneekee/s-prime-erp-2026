/**
 * WorkflowActions – 伝票詳細ページ共通のワークフローアクションパネル。
 * - ボタンは workflow.ts の遷移テーブルから生成 (ハードコードした状態判定なし)
 * - 無効ボタンは canExecute の理由をツールチップで表示
 * - 全アクションに確認ダイアログ (否認/差戻はコメント必須、配送開始は LOT 番号必須)
 */
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Send, CheckCircle2, XCircle, RotateCcw, FileCheck, Truck, PackageCheck,
  ClipboardCheck, Pencil, Loader2, Receipt, FileSearch, type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { slipStore, type SlipFull } from "@/services/mock-store";
import {
  TRANSITIONS, canExecute, canEditSlip, findTransition, getApplyMissing,
  type ActionId, type TransitionDef,
} from "@/lib/workflow";
import { getSlipStatusLabel } from "@/lib/slip-utils";
import { useAuth } from "@/hooks/use-auth";

const ACTION_ICONS: Partial<Record<ActionId, LucideIcon>> = {
  apply: Send,
  approve1: CheckCircle2,
  approveFinal: CheckCircle2,
  reject: XCircle,
  return: RotateCcw,
  startCorrection: Pencil,
  startEstimate: FileSearch,
  order: FileCheck,
  partialReceive: Truck,
  receive: PackageCheck,
  inspect: ClipboardCheck,
  ship: Truck,
  completeShipment: PackageCheck,
  confirmSales: Receipt,
};

interface PendingAction {
  def: TransitionDef;
}

interface WorkflowActionsProps {
  slip: SlipFull;
  /** 修正ボタン / 修正開始後の遷移先 (編集モードの作成ページを開く) */
  onEdit: () => void;
}

const WorkflowActions = ({ slip, onEdit }: WorkflowActionsProps) => {
  const { currentUser } = useAuth();
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [comment, setComment] = useState("");
  const [commentError, setCommentError] = useState("");
  const [lots, setLots] = useState<Record<number, string>>({});
  const [receipts, setReceipts] = useState<Record<number, number>>({});
  const [running, setRunning] = useState<ActionId | null>(null);

  // ロール切替時は開いている確認ダイアログを閉じる
  useEffect(() => {
    setPending(null);
    setComment("");
    setCommentError("");
    setLots({});
    setReceipts({});
  }, [currentUser?.role]);

  // テーブル順を維持しつつ action ごとに 1 ボタン (否認は S01/A00 の 2 定義を統合)
  const buttons = useMemo(() => {
    const seen = new Set<ActionId>();
    return TRANSITIONS[slip.slipType].filter((def) => {
      if (seen.has(def.action)) return false;
      seen.add(def.action);
      return true;
    });
  }, [slip.slipType]);

  if (!currentUser) return null;

  const openDialog = (def: TransitionDef) => {
    setPending({ def });
    setComment("");
    setCommentError("");
    setLots(def.action === "partialReceive" ? Object.fromEntries(slip.details.map(d => [d.detailId, d.lotNo])) : {});
    setReceipts(Object.fromEntries(slip.details.map(d => [d.detailId, 0])));
  };

  const lotsComplete =
    pending?.def.action !== "ship" ||
    slip.details.every((d) => (lots[d.detailId] ?? "").trim().length > 0);
  const commentOk = !pending?.def.requiresComment || comment.trim().length > 0;
  const receiptsComplete = pending?.def.action !== "partialReceive" || (
    slip.details.some(d => (receipts[d.detailId] ?? 0) > 0) &&
    slip.details.every(d => {
      const qty = receipts[d.detailId] ?? 0;
      return Number.isInteger(qty) && qty >= 0 && qty <= d.orderQty - d.inboundQty &&
        (qty === 0 || (lots[d.detailId] ?? "").trim().length > 0);
    })
  );
  const confirmDisabled = !pending || !commentOk || !lotsComplete || !receiptsComplete || running !== null;

  const handleConfirm = async () => {
    if (!pending || confirmDisabled) return;
    const { def } = pending;
    if (def.requiresComment && !comment.trim()) {
      setCommentError("理由を入力してください");
      return;
    }
    setRunning(def.action);
    try {
      await slipStore.transition(slip.slipNo, def.action, currentUser, comment, {
        lots: def.action === "ship" || def.action === "partialReceive" ? lots : undefined,
        receipts: def.action === "partialReceive" ? receipts : undefined,
      });
      toast.success(`${def.label}しました`);
      setPending(null);
      if (def.action === "startCorrection") onEdit();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "処理に失敗しました");
    } finally {
      setRunning(null);
    }
  };

  const renderButton = (def: TransitionDef) => {
    const check = canExecute(slip, def.action, currentUser);
    const missing = def.action === "apply" ? getApplyMissing(slip) : [];
    // 必須項目だけが不足している場合に限り、クリックで修正方法を案内する。
    const missingOnly = check.ok === false && missing.length > 0 &&
      check.reason === `申請に必要な項目が未入力です：${missing.join("、")}`;
    const enabled = check.ok || missingOnly;
    const Icon = ACTION_ICONS[def.action] ?? FileCheck;
    const isRunning = running === def.action;
    const variant =
      def.action === "reject" ? (check.ok ? "destructive" : "outline")
      : def.action === "return" ? "outline"
      : enabled ? "default" : "outline";
    const btn = (
      <Button
        key={def.action}
        size="sm"
        variant={variant}
        disabled={!enabled || running !== null}
        onClick={() => {
          if (missingOnly && check.ok === false) {
            toast.error(`${check.reason}。「修正」から入力してください。`);
            return;
          }
          openDialog(def);
        }}
        className={`gap-1.5 text-xs ${def.action === "return" ? "border-warning/50 text-warning hover:bg-warning/10" : ""}`}
      >
        {isRunning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
        {def.label}
      </Button>
    );
    if (check.ok) return btn;
    const reason = (check as { ok: false; reason: string }).reason;
    return (
      <Tooltip key={def.action}>
        <TooltipTrigger asChild><span className="inline-flex">{btn}</span></TooltipTrigger>
        <TooltipContent><p className="text-xs">{reason}</p></TooltipContent>
      </Tooltip>
    );
  };

  const editCheck = canEditSlip(slip, currentUser);
  const editButton = (
    <Button
      size="sm"
      variant="outline"
      disabled={!editCheck || running !== null}
      onClick={onEdit}
      className="gap-1.5 text-xs"
    >
      <Pencil className="w-3.5 h-3.5" /> 修正
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {buttons.map(renderButton)}
        {editCheck ? editButton : (
          <Tooltip>
            <TooltipTrigger asChild><span className="inline-flex">{editButton}</span></TooltipTrigger>
            <TooltipContent><p className="text-xs">修正は作成中の伝票の起票者のみ可能です</p></TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* 確認ダイアログ */}
      <Dialog open={pending !== null} onOpenChange={(open) => { if (!open && running === null) setPending(null); }}>
        <DialogContent aria-describedby={undefined} className={pending?.def.action === "partialReceive" ? "sm:max-w-5xl max-h-[90dvh] overflow-y-auto" : "sm:max-w-lg"}>
          <DialogHeader>
            <DialogTitle>{pending?.def.label}の確認</DialogTitle>
            <DialogDescription>内容を確認して実行してください。</DialogDescription>
          </DialogHeader>
          {pending && (
            <div className="space-y-3 py-2">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-muted-foreground mb-0.5">伝票番号</div>
                  <div className="font-mono font-medium text-foreground">{slip.slipNo}</div>
                </div>
                <div>
                  <div className="text-muted-foreground mb-0.5">ステータス遷移</div>
                  <div className="font-medium text-foreground">
                    {getSlipStatusLabel(slip.status)} → {getSlipStatusLabel(findTransition(slip.slipType, pending.def.action, slip.status)?.to ?? "")}
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-muted-foreground mb-0.5">操作者</div>
                  <div className="font-medium text-foreground">{currentUser.empName}（{currentUser.roleLabel}）</div>
                </div>
              </div>

              {/* 配送開始（積送）: 全明細の LOT 番号入力が必須 */}
              {pending.def.action === "ship" && (
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">LOT番号（全明細必須）</label>
                  {slip.details.map((d) => (
                    <div key={d.detailId} className="flex items-center gap-2">
                      <span className="text-xs text-foreground flex-1 truncate">{d.itemCode} {d.itemName}</span>
                      <Input
                        value={lots[d.detailId] ?? ""}
                        onChange={(e) => setLots((prev) => ({ ...prev, [d.detailId]: e.target.value }))}
                        placeholder="LOT番号を入力"
                        className="h-7 w-40 text-xs font-mono"
                      />
                    </div>
                  ))}
                  {!lotsComplete && <p className="text-[11px] text-destructive">LOT番号を入力してください</p>}
                </div>
              )}

              {pending.def.action === "partialReceive" && (
                <div className="overflow-x-auto">
                  <Table className="min-w-[760px]">
                    <TableHeader>
                      <TableRow>
                        {["品目コード", "品目名", "発注数量", "入庫累計", "残数", "今回入庫", "LOT番号"].map(label => (
                          <TableHead key={label} className="whitespace-nowrap text-xs">{label}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {slip.details.map(d => {
                        const remaining = d.orderQty - d.inboundQty;
                        const qty = receipts[d.detailId] ?? 0;
                        return (
                          <TableRow key={d.detailId}>
                            <TableCell className="whitespace-nowrap text-xs font-mono">{d.itemCode}</TableCell>
                            <TableCell className="text-xs min-w-40">{d.itemName}</TableCell>
                            <TableCell className="text-right font-mono">{d.orderQty.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{d.inboundQty.toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono">{remaining.toLocaleString()}</TableCell>
                            <TableCell>
                              <Input type="number" min={0} max={remaining} step={1}
                                aria-label={`${d.itemCode} 今回入庫`} value={Number.isNaN(qty) ? "" : qty}
                                disabled={remaining === 0 || running !== null}
                                onChange={e => setReceipts(prev => ({ ...prev, [d.detailId]: e.target.value === "" ? NaN : Number(e.target.value) }))}
                                className="h-8 w-24 text-right font-mono" />
                            </TableCell>
                            <TableCell>
                              <Input aria-label={`${d.itemCode} LOT番号`} value={lots[d.detailId] ?? ""}
                                required={qty > 0} disabled={remaining === 0 || running !== null}
                                onChange={e => setLots(prev => ({ ...prev, [d.detailId]: e.target.value }))}
                                className="h-8 w-40 font-mono" />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  コメント{pending.def.requiresComment && <span className="text-destructive"> *（必須）</span>}
                </label>
                <Textarea
                  placeholder={pending.def.requiresComment ? "理由を入力してください..." : "コメント（任意）"}
                  value={comment}
                  onChange={(e) => { setComment(e.target.value); if (e.target.value.trim()) setCommentError(""); }}
                  className="min-h-[80px] text-sm"
                />
                {commentError && <p className="text-[11px] text-destructive">{commentError}</p>}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPending(null)} disabled={running !== null}>
              キャンセル
            </Button>
            <Button
              variant={pending?.def.action === "reject" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={confirmDisabled}
              className="gap-1.5"
            >
              {running !== null && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {pending?.def.label} 確認
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WorkflowActions;
