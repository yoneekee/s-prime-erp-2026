import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { mockSlips } from "@/services/mock-data";
import { slipStore, generateSlipNo, type NewSlip } from "@/services/mock-store";
import type { WorkflowUser } from "@/lib/workflow";

const APPLICANT: WorkflowUser = { empId: 1001, empName: "キム ヨンジョン", deptName: "製造1課", role: "APPLICANT", roleLabel: "申請者" };
const APPROVER1: WorkflowUser = { empId: 1002, empName: "鈴木 花子", deptName: "経営管理課", role: "APPROVER_1", roleLabel: "一次承認者" };
const PURCHASER: WorkflowUser = { empId: 1004, empName: "山田 裕子", deptName: "製造2課", role: "PURCHASER", roleLabel: "購買担当" };

const input = (status = "S01"): NewSlip => {
  const { itemCount, totalAmount, ...slip } = mockSlips[0];
  return {
    ...slip,
    slipNo: generateSlipNo("SLP"),
    status,
    // ストアが user の値で上書きすることを確認するため、わざと異なる値を入れる
    requestEmpId: 9999,
    requester: "偽の名前",
    department: "偽の部署",
    details: slip.details.slice(0, 2).map(row => ({ ...row, supplyAmount: -1 })),
  };
};

describe("伝票保存 (add)", () => {
  beforeEach(() => { slipStore.reset(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 18, 13, 7, 0)); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("保存処理は300–500ms待機し明細から金額を計算する", async () => {
    const before = slipStore.getSnapshot();
    const pending = slipStore.add(input(), APPLICANT);
    await vi.advanceTimersByTimeAsync(299);
    expect(slipStore.getSnapshot()).toBe(before);
    await vi.advanceTimersByTimeAsync(201);
    const saved = await pending;
    expect(saved.itemCount).toBe(2);
    expect(saved.totalAmount).toBe(saved.details.reduce((sum, row) => sum + row.orderQty * row.unitPrice, 0));
    expect(JSON.parse(localStorage.getItem("erp_slip_store_v4") ?? "[]")[0]).toEqual(saved);
  });

  it("起票者情報は input ではなく user から設定される", async () => {
    const pending = slipStore.add(input(), APPLICANT);
    await vi.runAllTimersAsync();
    const saved = await pending;
    expect(saved.requestEmpId).toBe(1001);
    expect(saved.requester).toBe("キム ヨンジョン");
    expect(saved.department).toBe("製造1課");
  });

  it("S01 申請は全スキーマ項目を持つ最初の履歴を作る", async () => {
    const pending = slipStore.add(input("S01"), APPLICANT);
    await vi.runAllTimersAsync();
    const saved = await pending;
    expect(saved.workflow).toHaveLength(1);
    expect(saved.workflow[0]).toEqual({
      stepNo: 1, action: "apply", status: "申請", fromStatus: "S00", toStatus: "S01",
      empId: 1001, empName: "キム ヨンジョン", role: "申請者", comment: "-", procAt: "2026-10-18 13:07:00",
    });
  });

  it("S00/S01 以外のステータスは拒否される", async () => {
    const pending = slipStore.add(input("A00"), APPLICANT);
    const assertion = expect(pending).rejects.toThrow("作成時のステータスは S00 / S01 のみです");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("申請者以外のロールは起票できない", async () => {
    const pending = slipStore.add(input(), PURCHASER);
    const assertion = expect(pending).rejects.toThrow("伝票の起票は「申請者」ロールのみ可能です");
    await vi.runAllTimersAsync();
    await assertion;
  });

  it("同じ番号で同時保存しても異なる登録日番号になる", async () => {
    const slip = input();
    const first = slipStore.add(slip, APPLICANT);
    const second = slipStore.add(slip, APPLICANT);
    await vi.runAllTimersAsync();
    const rows = await Promise.all([first, second]);
    expect(rows[0].slipNo).not.toBe(rows[1].slipNo);
    for (const row of rows) expect(row.slipNo).toMatch(/^SLP20261018-\d{3}$/);
  });

  it("一時保存では履歴を作らない", async () => {
    const pending = slipStore.add(input("S00"), APPLICANT);
    await vi.runAllTimersAsync();
    expect((await pending).workflow).toEqual([]);
  });

  it("必須データがない新規申請は保存も履歴も作らない", async () => {
    const before = slipStore.getSnapshot();
    const stored = localStorage.getItem("erp_slip_store_v4");
    const pending = slipStore.add({ ...input(), details: [], partnerId: null }, APPLICANT);
    const assertion = expect(pending).rejects.toThrow();
    await vi.runAllTimersAsync();
    await assertion;
    expect(slipStore.getSnapshot()).toBe(before);
    expect(localStorage.getItem("erp_slip_store_v4")).toBe(stored);
  });

  it("書込み失敗時はrejectしメモリも保存済みデータも変更しない", async () => {
    const before = slipStore.getSnapshot();
    const stored = localStorage.getItem("erp_slip_store_v4");
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("quota"); });
    const pending = slipStore.add(input(), APPLICANT);
    const assertion = expect(pending).rejects.toThrow("quota");
    await vi.runAllTimersAsync();
    await assertion;
    expect(slipStore.getSnapshot()).toBe(before);
    expect(localStorage.getItem("erp_slip_store_v4")).toBe(stored);
  });
});

describe("ワークフロー遷移 (transition)", () => {
  beforeEach(() => { slipStore.reset(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 18, 14, 0, 0)); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  const addS01 = async () => {
    const pending = slipStore.add(input("S01"), APPLICANT);
    await vi.runAllTimersAsync();
    return pending;
  };

  it("新規 S01 → 一次承認で履歴が連続する", async () => {
    const saved = await addS01();
    const pending = slipStore.transition(saved.slipNo, "approve1", APPROVER1);
    await vi.runAllTimersAsync();
    const updated = await pending;
    expect(updated.status).toBe("A00");
    expect(updated.workflow).toHaveLength(2);
    expect(updated.workflow[1].fromStatus).toBe("S01");
    expect(updated.workflow[1].toStatus).toBe("A00");
    expect(updated.workflow[1].empId).toBe(1002);
  });

  it("分納入庫を永続化し入庫完了では数量を変更しない", async () => {
    const slip = slipStore.getSnapshot().find(s => s.slipType === "PROD" && s.status === "P02");
    if (!slip) throw new Error("P02 seed missing");
    const receipts = Object.fromEntries(slip.details.map(d => [d.detailId, d.orderQty - d.inboundQty]));
    const lots = Object.fromEntries(slip.details.map(d => [d.detailId, `LOT-${d.detailId}`]));
    const pending = slipStore.transition(slip.slipNo, "partialReceive", PURCHASER, undefined, { receipts, lots });
    await vi.runAllTimersAsync();
    const received = await pending;
    expect(received.status).toBe("P03");
    expect(received.details.map(d => d.inboundQty)).toEqual(slip.details.map(d => d.orderQty));
    const stored = JSON.parse(localStorage.getItem("erp_slip_store_v4") ?? "[]");
    expect(stored.find((s: { slipNo: string }) => s.slipNo === slip.slipNo)).toEqual(received);
    const completion = slipStore.transition(slip.slipNo, "receive", PURCHASER);
    await vi.runAllTimersAsync();
    const completed = await completion;
    expect(completed.status).toBe("P04");
    expect(completed.details).toEqual(received.details);
  });

  it("分納数量の検証失敗では保存も履歴も変更しない", async () => {
    const slip = slipStore.getSnapshot().find(s => s.slipType === "PROD" && s.status === "P02");
    if (!slip) throw new Error("P02 seed missing");
    const stored = localStorage.getItem("erp_slip_store_v4");
    const pending = slipStore.transition(slip.slipNo, "partialReceive", PURCHASER, undefined,
      { receipts: { 1: slip.details[0].orderQty + 1 }, lots: { 1: "LOT-A" } });
    const assertion = expect(pending).rejects.toThrow("入庫数量が不正です");
    await vi.runAllTimersAsync();
    await assertion;
    expect(slipStore.get(slip.slipNo)).toBe(slip);
    expect(localStorage.getItem("erp_slip_store_v4")).toBe(stored);
  });

  it("無効な遷移は拒否され状態を変更しない", async () => {
    const saved = await addS01();
    const before = slipStore.get(saved.slipNo);
    const pending = slipStore.transition(saved.slipNo, "order", PURCHASER);
    const assertion = expect(pending).rejects.toThrow("現在のステータスでは実行できません");
    await vi.runAllTimersAsync();
    await assertion;
    expect(slipStore.get(saved.slipNo)).toBe(before);
  });

  it("同一伝票・同一アクションの同時実行は 1 件だけ成功する", async () => {
    const saved = await addS01();
    // 敗者側の reject がハンドラ接続前に発火して unhandled にならないよう即座に settled 化する
    const first = slipStore.transition(saved.slipNo, "approve1", APPROVER1).then(
      () => "ok" as const, (e: Error) => e.message
    );
    const second = slipStore.transition(saved.slipNo, "approve1", APPROVER1).then(
      () => "ok" as const, (e: Error) => e.message
    );
    await vi.runAllTimersAsync();
    const results = await Promise.all([first, second]);
    expect(results.filter(r => r === "ok")).toHaveLength(1);
    expect(results.filter(r => r === "現在のステータスでは実行できません")).toHaveLength(1);
    expect(slipStore.get(saved.slipNo)?.workflow).toHaveLength(2);
  });

  it("差戻は A01 / P01 から成功し、P02 以降は失敗する", async () => {
    // A01 のシード伝票
    const a01 = slipStore.getSnapshot().find(s => s.slipType === "PROD" && s.status === "A01")!;
    const p1 = slipStore.transition(a01.slipNo, "return", PURCHASER, "見積条件を確認してください");
    await vi.runAllTimersAsync();
    expect((await p1).status).toBe("P00");

    // P01 のシード伝票
    const p01 = slipStore.getSnapshot().find(s => s.slipType === "PROD" && s.status === "P01")!;
    const p2 = slipStore.transition(p01.slipNo, "return", PURCHASER, "数量を再確認してください");
    await vi.runAllTimersAsync();
    expect((await p2).status).toBe("P00");

    // P02 のシード伝票は差戻不可
    const p02 = slipStore.getSnapshot().find(s => s.slipType === "PROD" && s.status === "P02")!;
    const p3 = slipStore.transition(p02.slipNo, "return", PURCHASER, "理由");
    const assertion = expect(p3).rejects.toThrow("現在のステータスでは実行できません");
    await vi.runAllTimersAsync();
    await assertion;
  });
});

describe("伝票修正 (update)", () => {
  beforeEach(() => { slipStore.reset(); vi.useFakeTimers(); vi.setSystemTime(new Date(2026, 9, 18, 15, 0, 0)); });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

  it("合計を再計算し、伝票番号・ステータス・履歴を維持する", async () => {
    const draft = slipStore.getSnapshot().find(s => s.status === "S00")!;
    const historyLen = draft.workflow.length;
    const edited: NewSlip = {
      ...draft,
      remarks: "修正済みの備考",
      details: [mockSlips[1].details[0], mockSlips[1].details[1]].map(r => ({ ...r, orderQty: 3 })),
    };
    const pending = slipStore.update(draft.slipNo, edited, APPLICANT);
    await vi.runAllTimersAsync();
    const updated = await pending;
    expect(updated.slipNo).toBe(draft.slipNo);
    expect(updated.status).toBe("S00");
    expect(updated.workflow).toHaveLength(historyLen);
    expect(updated.remarks).toBe("修正済みの備考");
    expect(updated.itemCount).toBe(2);
    expect(updated.totalAmount).toBe(updated.details.reduce((sum, r) => sum + r.orderQty * r.unitPrice, 0));
    updated.details.forEach((row, i) => expect(row.detailId).toBe(i + 1));
  });

  it("S00 以外または起票者以外は修正できない", async () => {
    const applied = slipStore.getSnapshot().find(s => s.status === "S01")!;
    const p1 = slipStore.update(applied.slipNo, { ...applied }, APPLICANT);
    const a1 = expect(p1).rejects.toThrow("この伝票は修正できません");
    await vi.runAllTimersAsync();
    await a1;

    const draft = slipStore.getSnapshot().find(s => s.status === "S00")!;
    const other: WorkflowUser = { empId: 1007, empName: "小林 明", role: "APPLICANT", roleLabel: "申請者" };
    const p2 = slipStore.update(draft.slipNo, { ...draft }, other);
    const a2 = expect(p2).rejects.toThrow("この伝票は修正できません");
    await vi.runAllTimersAsync();
    await a2;
  });
});
