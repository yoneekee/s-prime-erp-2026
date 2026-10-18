import { useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import ERPLayout from "@/components/erp/ERPLayout";
import { FormError } from "@/components/erp/FormError";
import ItemSelectModal, { CatalogItem } from "@/components/erp/ItemSelectModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { DatePicker } from "@/components/ui/date-picker";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Save, Send, FileText, AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { shipmentSlipSchema, type ShipmentSlipFormValues } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { slipStore, generateSlipNo as nextSlipNo } from "@/services/mock-store";
import { mockPartners, type SlipDetailRow } from "@/services/mock-data";
import { useItems, useLocations } from "@/hooks/use-master-store";
import { getTodayISO } from "@/lib/format-utils";
import { useAuth } from "@/hooks/use-auth";
import { canEditSlip } from "@/lib/workflow";

const ShipmentSlipCreate = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const editSlipNo = searchParams.get("slipNo");
  const editSlip = editSlipNo ? slipStore.get(editSlipNo) : undefined;
  const editMode = !!editSlip;
  const [slipNo] = useState(editSlip?.slipNo ?? nextSlipNo("SHP"));
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const catalog: CatalogItem[] = items.filter(item => item.isActive && ["FIN", "SEMI"].includes(item.itemType))
    .map(item => ({ code: item.itemCode, name: item.itemName, spec: item.spec, unit: item.unit, price: item.stdPrice, stockQty: item.stockQty }));
  const partners = mockPartners.filter(p => p.isActive && ["CUSTOMER", "BOTH"].includes(p.partnerType));
  const warehouses = locations.filter(l => l.isActive && ["FACTORY", "STORE"].includes(l.locType));
  const [details, setDetails] = useState<SlipDetailRow[]>(editSlip?.details ?? []);
  const [saving, setSaving] = useState(false);
  const saveGuard = useRef(false);
  const pageRef = useRef<HTMLDivElement>(null);
  const [detailsError, setDetailsError] = useState(false);
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);

  const isApplicant = currentUser?.role === "APPLICANT";
  const editAllowed = editMode && currentUser ? canEditSlip(editSlip, currentUser) : false;
  const formDisabled = !isApplicant || (editMode && !editAllowed);

  const {
    register,
    trigger,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShipmentSlipFormValues>({
    resolver: zodResolver(shipmentSlipSchema),
    defaultValues: {
      shipDate: editSlip?.date ?? getTodayISO(),
      customer: editSlip?.partnerId != null ? String(editSlip.partnerId) : "",
      deliveryAddr: editSlip?.deliveryAddress ?? "",
      warehouse: editSlip?.fromLocId != null ? String(editSlip.fromLocId) : "",
      remark: editSlip?.remarks ?? "",
    },
    mode: "onChange",
  });

  const shipDate = watch("shipDate");
  const customer = watch("customer");
  const warehouse = watch("warehouse");

  const addItem = (catalogItem: CatalogItem) => {
    const item = items.find(i => i.itemCode === catalogItem.code && i.isActive);
    if (!item) return;
    if (details.some(d => d.itemId === item.itemId)) { toast.error("既に追加済みの品目です。"); return; }
    setDetails(prev => [...prev, { detailId: prev.length + 1, itemId: item.itemId,
      itemCode: item.itemCode, itemName: item.itemName, spec: item.spec, unit: item.unit,
      orderQty: 1, inboundQty: 0, unitPrice: item.stdPrice, supplyAmount: item.stdPrice, lotNo: "" }]);
    toast.success(`${item.itemName} を追加しました`);
  };
  const removeItem = (id: number) => setDetails(prev => prev.filter(d => d.detailId !== id).map((d, index) => ({ ...d, detailId: index + 1 })));
  const updateQty = (id: number, qty: number) => setDetails(prev => prev.map(d => d.detailId === id ? { ...d, orderQty: qty, supplyAmount: qty * d.unitPrice } : d));
  const stockQty = (itemId: number) => items.find(item => item.itemId === itemId)?.stockQty ?? 0;
  const totalAmount = details.reduce((sum, row) => sum + row.supplyAmount, 0);
  const hasStockWarning = details.some(row => row.orderQty > stockQty(row.itemId));

  const buildInput = () => {
    const partner = partners.find(p => String(p.partnerId) === customer);
    const location = warehouses.find(l => String(l.locId) === warehouse);
    return {
      slipNo, slipType: "SHIP" as const, typeName: "出庫",
      date: shipDate || getTodayISO(),
      requestEmpId: currentUser?.empId ?? 0, requester: currentUser?.empName ?? "-", department: currentUser?.deptName ?? "-",
      approverId: null, approver: "-", handlerId: null, handler: "-",
      status: "S00",
      partnerId: partner?.partnerId ?? null, partner: partner?.partnerName ?? "-",
      remarks: watch("remark") ?? "",
      details: details.map(row => ({ ...row, inboundQty: 0, lotNo: "" })),
      fromLocId: location?.locId ?? null, fromLocName: location?.locName ?? "-",
      deliveryAddress: watch("deliveryAddr") ?? "",
    };
  };

  /** 一時保存 (S00) または 出庫申請 (S01)。編集モードでは update / update+申請。 */
  const persist = async (apply: boolean) => {
    if (saveGuard.current || !currentUser || formDisabled) return;
    saveGuard.current = true;
    try {
      const validHeader = apply ? await trigger() : true;
      const missingDetails = details.length === 0;
      setDetailsError(missingDetails);
      if (!validHeader || missingDetails || (apply && hasStockWarning)) {
        toast.error(apply ? "入力内容に不備があります。赤枠の項目を確認してください" : "明細を1件以上追加してください");
        requestAnimationFrame(() => {
          pageRef.current?.querySelector<HTMLElement>('[data-validation-error="true"]')?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
        return;
      }
      setSaving(true);
      if (editMode && editSlip) {
        await slipStore.update(editSlip.slipNo, buildInput(), currentUser);
        if (apply) await slipStore.transition(editSlip.slipNo, "apply", currentUser);
        toast.success(apply ? "伝票を申請しました" : "伝票を保存しました（作成中ステータス）");
        navigate(`/production/shipping?slipNo=${encodeURIComponent(editSlip.slipNo)}`);
      } else {
        const saved = await slipStore.add({ ...buildInput(), status: apply ? "S01" : "S00" }, currentUser);
        toast.success(apply ? "伝票を申請しました" : "伝票を保存しました（作成中ステータス）");
        navigate(`/production/shipping?slipNo=${encodeURIComponent(saved.slipNo)}`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "保存に失敗しました");
    } finally {
      saveGuard.current = false;
      setSaving(false);
    }
  };
  const handleSave = () => persist(false);
  const onSubmit = () => persist(true);

  return (
    <ERPLayout>
      <div ref={pageRef} className="space-y-4">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate(editMode ? `/production/shipping?slipNo=${encodeURIComponent(slipNo)}` : "/production/shipping")} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> 一覧
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{editMode ? "出庫伝票 修正" : "新規出庫伝票作成"}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{editMode ? "作成中の出庫伝票を修正します" : "完成品出庫のための新規伝票を作成します"}</p>
            </div>
          </div>
          <Badge className="bg-muted text-muted-foreground text-xs px-2.5 py-0.5">作成中 (Draft)</Badge>
        </div>

        {!isApplicant && (
          <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>伝票の起票は「申請者」ロールのみ可能です</AlertTitle>
            <AlertDescription>画面上部の「デモ用ロール切替」で申請者に切り替えてください。</AlertDescription>
          </Alert>
        )}
        {editMode && !editAllowed && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>この伝票は修正できません</AlertTitle>
            <AlertDescription>修正は作成中の伝票の起票者のみ可能です。</AlertDescription>
          </Alert>
        )}

        {/* Header Info */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" /> 伝票ヘッダ情報
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">伝票番号</label>
                <Input value={slipNo} readOnly className="h-8 text-xs font-mono bg-muted/50 border-border" />
              </div>
              <div className="space-y-1" data-validation-error={!!errors.shipDate}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">出庫希望日 <span className="text-destructive">*</span></label>
                <DatePicker className={cn(errors.shipDate && "[&_input]:border-destructive [&_input]:ring-1 [&_input]:ring-destructive")} value={shipDate} onChange={(d) => setValue("shipDate", d ? format(d, "yyyy-MM-dd") : "", { shouldValidate: true })} />
                <FormError message={errors.shipDate?.message} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">申請者（部署）</label>
                <Input value={`${currentUser?.empName ?? "-"}（${currentUser?.deptName ?? "-"}）`} readOnly className="h-8 text-xs bg-muted/50 border-border" />
              </div>
              <div className="space-y-1" data-validation-error={!!errors.customer}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">得意先 <span className="text-destructive">*</span></label>
                <Select value={customer} onValueChange={(v) => {
                  setValue("customer", v, { shouldValidate: true });
                  const partner = partners.find(p => String(p.partnerId) === v);
                  if (partner) setValue("deliveryAddr", `〒${partner.postalCode} ${partner.address}`, { shouldValidate: true });
                }}>
                  <SelectTrigger className={cn("h-8 text-xs border-border", errors.customer && "border-destructive ring-1 ring-destructive")}>
                    <SelectValue placeholder="得意先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(p => <SelectItem key={p.partnerId} value={String(p.partnerId)}>{p.partnerName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormError message={errors.customer?.message} />
              </div>
              <div className="space-y-1 md:col-span-2" data-validation-error={!!errors.deliveryAddr}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">配送先住所</label>
                <Input {...register("deliveryAddr")} placeholder="配送先住所を入力してください" className={cn("h-8 text-xs border-border", errors.deliveryAddr && "border-destructive")} />
                <FormError message={errors.deliveryAddr?.message} />
              </div>
              <div className="space-y-1" data-validation-error={!!errors.warehouse}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">出発地倉庫 <span className="text-destructive">*</span></label>
                <Select value={warehouse} onValueChange={(v) => setValue("warehouse", v, { shouldValidate: true })}>
                  <SelectTrigger className={cn("h-8 text-xs border-border", errors.warehouse && "border-destructive ring-1 ring-destructive")}>
                    <SelectValue placeholder="倉庫を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.map(l => <SelectItem key={l.locId} value={String(l.locId)}>{l.locName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormError message={errors.warehouse?.message} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">出庫合計金額</label>
                <Input value={`¥${totalAmount.toLocaleString()}`} readOnly className="h-8 text-xs font-mono bg-muted/50 border-border text-primary font-semibold" />
              </div>
              <div className="col-span-2 md:col-span-4 space-y-1" data-validation-error={!!errors.remark}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">備考</label>
                <Textarea {...register("remark")} placeholder="出庫伝票に関する備考事項を入力してください" className={cn("text-xs border-border min-h-[60px] resize-none", errors.remark && "border-destructive")} />
                <FormError message={errors.remark?.message} />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Item Add */}
        <Card className="border-border bg-card">
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">品目追加</CardTitle>
              <Button size="sm" onClick={() => setIsItemModalOpen(true)} disabled={formDisabled} className="gap-1.5 text-xs">
                <Plus className="w-3.5 h-3.5" /> 品目選択
              </Button>
            </div>
          </CardHeader>
        </Card>

        <ItemSelectModal open={isItemModalOpen} onOpenChange={setIsItemModalOpen} items={catalog} onSelect={addItem} selectedCodes={details.map((d) => d.itemCode)} showStock={true} title="出庫品目選択" />

        {/* Detail Items */}
        <Card data-validation-error={detailsError && details.length === 0 || hasStockWarning} className={cn("border-border bg-card", detailsError && details.length === 0 && "border-destructive")}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                明細品目一覧
                {details.length > 0 && (<Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{details.length}件</Badge>)}
              </CardTitle>
              {hasStockWarning && (
                <div className="flex items-center gap-1.5 text-warning">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="text-[10px]">在庫不足品目あり</span>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {details.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">出庫する品目を検索して追加してください</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">品目コード</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">品目名</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">実在庫</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">出庫数量</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">単価</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">売上金額</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">LOT番号</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.map((item) => {
                        const overStock = item.orderQty > stockQty(item.itemId);
                        return (
                          <TableRow key={item.detailId} className={cn("border-border hover:bg-secondary/50", overStock && "bg-destructive/5")}>
                            <TableCell className="px-3 py-2 text-xs font-mono text-primary">{item.itemCode}</TableCell>
                            <TableCell className="px-3 py-2 text-xs font-medium text-foreground">{item.itemName}</TableCell>
                            <TableCell className="px-3 py-2 text-xs text-right font-mono">
                              <span className={stockQty(item.itemId) <= 5 ? "text-warning" : "text-success"}>{stockQty(item.itemId).toLocaleString()}</span>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs text-right">
                              <div className="flex items-center justify-end gap-1">
                                {overStock && <AlertTriangle className="w-3 h-3 text-destructive" />}
                                <Input type="number" min={1} value={item.orderQty} onChange={(e) => updateQty(item.detailId, Math.max(1, parseInt(e.target.value) || 1))} disabled={formDisabled} className={cn("h-6 w-20 text-xs text-right border-border ml-auto", overStock && "border-destructive text-destructive")} />
                              </div>
                            </TableCell>
                            <TableCell className="px-3 py-2 text-xs text-right font-mono text-foreground">¥{item.unitPrice.toLocaleString()}</TableCell>
                            <TableCell className="px-3 py-2 text-xs text-right font-mono text-foreground">¥{item.supplyAmount.toLocaleString()}</TableCell>
                            <TableCell className="px-3 py-2 text-xs">
                              <span className="text-muted-foreground">-</span>
                            </TableCell>
                            <TableCell className="px-3 py-2">
                              <Button variant="ghost" size="sm" onClick={() => removeItem(item.detailId)} disabled={formDisabled} className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
                <div className="flex justify-end items-center gap-4 px-4 py-2.5 border-t border-border bg-muted/30">
                  <span className="text-xs text-muted-foreground">合計</span>
                  <span className="text-sm font-mono font-bold text-primary">¥{totalAmount.toLocaleString()}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {detailsError && details.length === 0 && <FormError message="明細を1件以上追加してください" />}
        {hasStockWarning && <FormError message="出庫数量が実在庫を超過する品目があります" />}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pb-4">
          <Button variant="outline" size="sm" onClick={() => navigate(editMode ? `/production/shipping?slipNo=${encodeURIComponent(slipNo)}` : "/production/shipping")} className="gap-1.5 text-xs">キャンセル</Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={formDisabled || saving} className="gap-1.5 text-xs">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 一時保存
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={formDisabled || saving}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} 出庫申請
          </Button>
        </div>
      </div>
    </ERPLayout>
  );
};

export default ShipmentSlipCreate;
