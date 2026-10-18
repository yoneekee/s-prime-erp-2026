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
import { ArrowLeft, Plus, Trash2, Save, Send, FileText, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { productionSlipSchema, type ProductionSlipFormValues } from "@/lib/schemas";
import { cn } from "@/lib/utils";
import { slipStore, generateSlipNo as nextSlipNo } from "@/services/mock-store";
import { mockPartners, type SlipDetailRow } from "@/services/mock-data";
import { useItems, useLocations } from "@/hooks/use-master-store";
import { getTodayISO } from "@/lib/format-utils";
import { useAuth } from "@/hooks/use-auth";
import { canEditSlip } from "@/lib/workflow";

const ProductionSlipCreate = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [searchParams] = useSearchParams();
  const editSlipNo = searchParams.get("slipNo");
  const editSlip = editSlipNo ? slipStore.get(editSlipNo) : undefined;
  const editMode = !!editSlip;
  const [slipNo] = useState(editSlip?.slipNo ?? nextSlipNo("SLP"));
  const { data: items } = useItems();
  const { data: locations } = useLocations();
  const catalog: CatalogItem[] = items.filter(item => item.isActive && ["RAW", "SEMI"].includes(item.itemType))
    .map(item => ({ code: item.itemCode, name: item.itemName, spec: item.spec, unit: item.unit, price: item.stdPrice, stockQty: item.stockQty }));
  const partners = mockPartners.filter(p => p.isActive && ["SUPPLIER", "BOTH"].includes(p.partnerType));
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
  } = useForm<ProductionSlipFormValues>({
    resolver: zodResolver(productionSlipSchema),
    defaultValues: {
      reqDate: editSlip?.date ?? getTodayISO(),
      vendor: editSlip?.partnerId != null ? String(editSlip.partnerId) : "",
      remark: editSlip?.remarks ?? "",
    },
    mode: "onChange",
  });

  const reqDate = watch("reqDate");
  const vendor = watch("vendor");

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
  const totalAmount = details.reduce((sum, row) => sum + row.supplyAmount, 0);

  const buildInput = () => {
    const partner = partners.find(p => String(p.partnerId) === vendor);
    return {
      slipNo, slipType: "PROD" as const, typeName: "購買",
      date: reqDate || getTodayISO(),
      requestEmpId: currentUser?.empId ?? 0, requester: currentUser?.empName ?? "-", department: currentUser?.deptName ?? "-",
      approverId: null, approver: "-", handlerId: null, handler: "-",
      status: "S00",
      partnerId: partner?.partnerId ?? null, partner: partner?.partnerName ?? "-",
      remarks: watch("remark") ?? "",
      details: details.map(row => ({ ...row, inboundQty: 0, lotNo: "" })),
      fromLocId: null, fromLocName: "-",
      deliveryAddress: "",
    };
  };

  /** 一時保存 (S00) または 申請 (S01)。編集モードでは update / update+申請。 */
  const persist = async (apply: boolean) => {
    if (saveGuard.current || !currentUser || formDisabled) return;
    saveGuard.current = true;
    try {
      const validHeader = apply ? await trigger() : true;
      const missingDetails = details.length === 0;
      setDetailsError(missingDetails);
      if (!validHeader || missingDetails) {
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
        navigate(`/production/execution?slipNo=${encodeURIComponent(editSlip.slipNo)}`);
      } else {
        const saved = await slipStore.add({ ...buildInput(), status: apply ? "S01" : "S00" }, currentUser);
        toast.success(apply ? "伝票を申請しました" : "伝票を保存しました（作成中ステータス）");
        navigate(`/production/execution?slipNo=${encodeURIComponent(saved.slipNo)}`);
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
            <Button variant="ghost" size="sm" onClick={() => navigate(editMode ? `/production/execution?slipNo=${encodeURIComponent(slipNo)}` : "/production/execution")} className="gap-1.5 text-muted-foreground hover:text-foreground">
              <ArrowLeft className="w-4 h-4" /> 一覧
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-bold text-foreground">{editMode ? "購買伝票 修正" : "新規伝票作成"}</h1>
              <p className="text-xs text-muted-foreground mt-0.5">{editMode ? "作成中の購買伝票を修正します" : "原材料調達のための新規伝票を作成します"}</p>
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
              <div className="space-y-1" data-validation-error={!!errors.reqDate}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">申請日 <span className="text-destructive">*</span></label>
                <DatePicker
                  className={cn(errors.reqDate && "[&_input]:border-destructive [&_input]:ring-1 [&_input]:ring-destructive")}
                  value={reqDate}
                  onChange={(d) => { setValue("reqDate", d ? format(d, "yyyy-MM-dd") : "", { shouldValidate: true }); }}
                />
                <FormError message={errors.reqDate?.message} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">申請者（部署）</label>
                <Input value={`${currentUser?.empName ?? "-"}（${currentUser?.deptName ?? "-"}）`} readOnly className="h-8 text-xs bg-muted/50 border-border" />
              </div>
              <div className="space-y-1" data-validation-error={!!errors.vendor}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">希望発注先 <span className="text-destructive">*</span></label>
                <Select value={vendor} onValueChange={(v) => setValue("vendor", v, { shouldValidate: true })}>
                  <SelectTrigger className={cn("h-8 text-xs border-border", errors.vendor && "border-destructive ring-1 ring-destructive")}>
                    <SelectValue placeholder="発注先を選択" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map(p => <SelectItem key={p.partnerId} value={String(p.partnerId)}>{p.partnerName}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FormError message={errors.vendor?.message} />
              </div>
              <div className="col-span-2 md:col-span-3 space-y-1" data-validation-error={!!errors.remark}>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">備考</label>
                <Textarea {...register("remark")} placeholder="伝票に関する備考事項を入力してください" className={cn("text-xs border-border min-h-[60px] resize-none", errors.remark && "border-destructive")} />
                <FormError message={errors.remark?.message} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground">合計金額</label>
                <Input value={`¥${totalAmount.toLocaleString()}`} readOnly className="h-8 text-xs font-mono bg-muted/50 border-border text-primary font-semibold" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Item Add Button */}
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

        <ItemSelectModal open={isItemModalOpen} onOpenChange={setIsItemModalOpen} items={catalog} onSelect={addItem} selectedCodes={details.map((d) => d.itemCode)} title="原材料品目選択" />

        {/* Detail Items */}
        <Card data-validation-error={detailsError && details.length === 0} className={cn("border-border bg-card", detailsError && details.length === 0 && "border-destructive")}>
          <CardHeader className="py-3 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold">
                明細品目一覧
                {details.length > 0 && (<Badge variant="outline" className="ml-2 text-[10px] px-1.5 py-0">{details.length}件</Badge>)}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {details.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <FileText className="w-8 h-8 mb-2 opacity-40" />
                <p className="text-xs">品目を検索して追加してください</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">品目コード</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">品目名</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">規格</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-center">単位</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">発注数量</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">単価</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 text-right">供給価額</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3">LOT番号</TableHead>
                        <TableHead className="text-[10px] uppercase tracking-wider text-muted-foreground h-8 px-3 w-12"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {details.map((item) => (
                        <TableRow key={item.detailId} className="border-border hover:bg-secondary/50">
                          <TableCell className="px-3 py-2 text-xs font-mono text-primary">{item.itemCode}</TableCell>
                          <TableCell className="px-3 py-2 text-xs font-medium text-foreground">{item.itemName}</TableCell>
                          <TableCell className="px-3 py-2 text-xs text-muted-foreground">{item.spec}</TableCell>
                          <TableCell className="px-3 py-2 text-xs text-center text-muted-foreground">{item.unit}</TableCell>
                          <TableCell className="px-3 py-2 text-xs text-right">
                            <Input type="number" min={1} value={item.orderQty} onChange={(e) => updateQty(item.detailId, Math.max(1, parseInt(e.target.value) || 1))} disabled={formDisabled} className="h-6 w-20 text-xs text-right border-border ml-auto" />
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
                      ))}
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

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2 pb-4">
          <Button variant="outline" size="sm" onClick={() => navigate(editMode ? `/production/execution?slipNo=${encodeURIComponent(slipNo)}` : "/production/execution")} className="gap-1.5 text-xs">キャンセル</Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={formDisabled || saving} className="gap-1.5 text-xs">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} 一時保存
          </Button>
          <Button
            size="sm"
            onClick={onSubmit}
            disabled={formDisabled || saving}
            className="gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />} 申請
          </Button>
        </div>
      </div>
    </ERPLayout>
  );
};

export default ProductionSlipCreate;
