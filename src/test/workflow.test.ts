import { describe, expect, it } from "vitest";
import {
  TRANSITIONS, canExecute, applyTransition, getFlowSteps, canEditSlip, getApplyMissing,
  isSlipEditable, isSlipComplete, isSlipTerminal,
  type WorkflowSlip, type WorkflowUser, type ActionId,
} from "@/lib/workflow";

const USERS: Record<string, WorkflowUser> = {
  applicant: { empId: 1001, empName: "キム ヨンジョン", role: "APPLICANT", roleLabel: "申請者" },
  approver1: { empId: 1002, empName: "鈴木 花子", role: "APPROVER_1", roleLabel: "一次承認者" },
  approver2: { empId: 1003, empName: "佐藤 健一", role: "APPROVER_2", roleLabel: "最終承認者" },
  purchaser: { empId: 1004, empName: "山田 裕子", role: "PURCHASER", roleLabel: "購買担当" },
  inspector: { empId: 1006, empName: "渡辺 涼介", role: "INSPECTOR", roleLabel: "検収担当" },
  shipper: { empId: 1005, empName: "伊藤 真一", role: "SHIPPER", roleLabel: "出庫担当" },
};

const NOW = "2026-10-18 14:00:00";

const makeSlip = (status: string, slipType: "PROD" | "SHIP" = "PROD", over: Partial<WorkflowSlip> = {}): WorkflowSlip => ({
  slipNo: "SLP20261018-001",
  slipType,
  status,
  requestEmpId: 1001,
  approverId: null,
  approver: "-",
  handlerId: null,
  handler: "-",
  partnerId: 1,
  fromLocId: slipType === "SHIP" ? 1 : null,
  details: [{ detailId: 1, orderQty: 10, inboundQty: 0, itemCode: "RAW-A", unit: "EA" }, { detailId: 2, orderQty: 20, inboundQty: 0, itemCode: "RAW-B", unit: "SET" }],
  workflow: [],
  ...over,
});

describe("canExecute / applyTransition: 正常遷移", () => {
  const cases: [string, "PROD" | "SHIP", string, ActionId, keyof typeof USERS, string][] = [
    ["申請", "PROD", "S00", "apply", "applicant", "S01"],
    ["一次承認", "PROD", "S01", "approve1", "approver1", "A00"],
    ["最終承認", "PROD", "A00", "approveFinal", "approver2", "A01"],
    ["否認(一次)", "PROD", "S01", "reject", "approver1", "A02"],
    ["否認(最終)", "PROD", "A00", "reject", "approver2", "A02"],
    ["見積開始", "PROD", "A01", "startEstimate", "purchaser", "P01"],
    ["差戻(A01)", "PROD", "A01", "return", "purchaser", "P00"],
    ["差戻(P01)", "PROD", "P01", "return", "purchaser", "P00"],
    ["修正開始", "PROD", "P00", "startCorrection", "applicant", "S00"],
    ["発注確定", "PROD", "P01", "order", "purchaser", "P02"],
    ["検収完了", "PROD", "P04", "inspect", "inspector", "I00"],
    ["配送開始", "SHIP", "A01", "ship", "shipper", "T01"],
    ["差戻(出庫)", "SHIP", "A01", "return", "shipper", "T00"],
    ["修正開始(出庫)", "SHIP", "T00", "startCorrection", "applicant", "S00"],
    ["出庫完了", "SHIP", "T01", "completeShipment", "shipper", "T02"],
    ["売上確定", "SHIP", "T02", "confirmSales", "shipper", "T03"],
  ];
  it.each(cases)("%s: %s %s → %s", (_name, type, from, action, userKey, to) => {
    const slip = makeSlip(from, type);
    const user = USERS[userKey];
    expect(canExecute(slip, action, user)).toEqual({ ok: true });
    const next = applyTransition(slip, action, user, "確認コメント", NOW,
      action === "ship" ? { lots: { 1: "LOT-A", 2: "LOT-B" } } : undefined);
    expect(next.status).toBe(to);
    const entry = next.workflow[next.workflow.length - 1];
    expect(entry.action).toBe(action);
    expect(entry.fromStatus).toBe(from);
    expect(entry.toStatus).toBe(to);
    expect(entry.empId).toBe(user.empId);
    expect(entry.role).toBe(user.roleLabel);
    expect(entry.procAt).toBe(NOW);
  });
});

describe("canExecute: 拒否理由", () => {
  it("ステータス不一致は「現在のステータスでは実行できません」", () => {
    expect(canExecute(makeSlip("A01"), "apply", USERS.applicant))
      .toEqual({ ok: false, reason: "現在のステータスでは実行できません" });
  });
  it("ロール不一致は権限理由を返す", () => {
    expect(canExecute(makeSlip("S01"), "approve1", USERS.applicant))
      .toEqual({ ok: false, reason: "この操作には「一次承認者」の権限が必要です" });
  });
  it("起票者以外の apply / startCorrection は拒否", () => {
    const other: WorkflowUser = { empId: 1007, empName: "小林 明", role: "APPLICANT", roleLabel: "申請者" };
    expect(canExecute(makeSlip("S00"), "apply", other))
      .toEqual({ ok: false, reason: "この操作は起票者本人のみ実行できます" });
    expect(canExecute(makeSlip("P00"), "startCorrection", other))
      .toEqual({ ok: false, reason: "この操作は起票者本人のみ実行できます" });
  });
  it("A02 からは何も開始できない (否認は終端)", () => {
    for (const def of TRANSITIONS.PROD) {
      expect(canExecute(makeSlip("A02"), def.action, USERS.purchaser).ok).toBe(false);
    }
  });
  it("P00 / T00 から直接 申請(S01) できない", () => {
    expect(canExecute(makeSlip("P00"), "apply", USERS.applicant).ok).toBe(false);
    expect(canExecute(makeSlip("T00", "SHIP"), "apply", USERS.applicant).ok).toBe(false);
  });
  it("P02 以降から差戻できない", () => {
    for (const st of ["P02", "P03", "P04", "I00"]) {
      expect(canExecute(makeSlip(st), "return", USERS.purchaser).ok).toBe(false);
    }
  });
  it("購買担当は出庫伝票を、出庫担当は購買伝票を操作できない", () => {
    expect(canExecute(makeSlip("A01", "SHIP"), "ship", USERS.purchaser).ok).toBe(false);
    expect(canExecute(makeSlip("A01", "PROD"), "order", USERS.shipper).ok).toBe(false);
  });
});

describe("applyTransition: コメント・フィールド更新", () => {
  it("否認はコメント必須", () => {
    expect(() => applyTransition(makeSlip("S01"), "reject", USERS.approver1, "  ", NOW))
      .toThrow("理由を入力してください");
  });
  it("差戻はコメント必須", () => {
    expect(() => applyTransition(makeSlip("A01"), "return", USERS.purchaser, "", NOW))
      .toThrow("理由を入力してください");
  });
  it("apply は承認者・担当者をリセットする", () => {
    const slip = makeSlip("S00", "PROD", { approverId: 1003, approver: "佐藤 健一", handlerId: 1004, handler: "山田 裕子" });
    const next = applyTransition(slip, "apply", USERS.applicant, undefined, NOW);
    expect(next.approverId).toBeNull();
    expect(next.approver).toBe("-");
    expect(next.handlerId).toBeNull();
  });
  it("approveFinal / reject は承認者を記録する", () => {
    const a = applyTransition(makeSlip("A00"), "approveFinal", USERS.approver2, undefined, NOW);
    expect(a.approverId).toBe(1003);
    const r = applyTransition(makeSlip("S01"), "reject", USERS.approver1, "理由", NOW);
    expect(r.approverId).toBe(1002);
  });
  it("startEstimate / ship / return は担当者が未設定なら記録する", () => {
    const e = applyTransition(makeSlip("A01"), "startEstimate", USERS.purchaser, undefined, NOW);
    expect(e.handlerId).toBe(1004);
    const s = applyTransition(makeSlip("A01", "SHIP"), "ship", USERS.shipper, undefined, NOW, { lots: { 1: "L1", 2: "L2" } });
    expect(s.handlerId).toBe(1005);
  });
  it("配送開始は全明細の LOT 番号が必須", () => {
    expect(() => applyTransition(makeSlip("A01", "SHIP"), "ship", USERS.shipper, undefined, NOW, { lots: { 1: "L1" } }))
      .toThrow("LOT番号を入力してください");
    const ok = applyTransition(makeSlip("A01", "SHIP"), "ship", USERS.shipper, undefined, NOW, { lots: { 1: " L1 ", 2: "L2" } });
    expect(ok.details[0].lotNo).toBe("L1");
  });
  it("canExecute の理由で throw する", () => {
    expect(() => applyTransition(makeSlip("S01"), "approve1", USERS.applicant, undefined, NOW))
      .toThrow("この操作には「一次承認者」の権限が必要です");
  });
});

describe("申請データ検証", () => {
  it("購買の不足項目は明細・取引先の順で返す", () => {
    const slip = makeSlip("S00", "PROD", { details: [], partnerId: null });
    expect(getApplyMissing(slip)).toEqual(["明細", "取引先"]);
    expect(canExecute(slip, "apply", USERS.applicant).ok).toBe(false);
  });
  it("出庫は不足する出庫元倉庫も返す", () => {
    const slip = makeSlip("S00", "SHIP", { details: [], partnerId: null, fromLocId: null });
    expect(getApplyMissing(slip)).toEqual(["明細", "取引先", "出庫元倉庫"]);
    expect(canExecute(slip, "apply", USERS.applicant).ok).toBe(false);
  });
  it("申請に必要な項目が揃っていれば不足項目はない", () => {
    expect(getApplyMissing(makeSlip("S00", "SHIP"))).toEqual([]);
    expect(canExecute(makeSlip("S00", "SHIP"), "apply", USERS.applicant).ok).toBe(true);
  });
  it("項目不足でも起票者・ロール・ステータスの制限を優先する", () => {
    const slip = makeSlip("S00", "PROD", { details: [], partnerId: null });
    expect(canExecute(slip, "apply", USERS.approver1)).toEqual({ ok: false, reason: "この操作は起票者本人のみ実行できます" });
    expect(canExecute(slip, "apply", { ...USERS.purchaser, empId: 1001 })).toEqual({ ok: false, reason: "この操作には「申請者」の権限が必要です" });
    expect(canExecute({ ...slip, status: "A02" }, "apply", USERS.applicant)).toEqual({ ok: false, reason: "現在のステータスでは実行できません" });
  });
  it.each([
    ["PROD", { details: [] }],
    ["PROD", { partnerId: null }],
    ["SHIP", { fromLocId: null }],
  ] as ["PROD" | "SHIP", Partial<WorkflowSlip>][])("%s の必須データ不足は申請不可", (type, missing) => {
    const slip = makeSlip("S00", type, missing);
    expect(canExecute(slip, "apply", USERS.applicant).ok).toBe(false);
    expect(() => applyTransition(slip, "apply", USERS.applicant, undefined, NOW)).toThrow();
  });
  it("起票者本人でも申請者以外のロールは申請不可", () => {
    expect(canExecute(makeSlip("S00"), "apply", { ...USERS.purchaser, empId: 1001 }).ok).toBe(false);
  });
});

describe("分納入庫 / 入庫完了", () => {
  it("P02 と P03 から分納入庫し、実際の数量とLOTだけを記録する", () => {
    const slip = makeSlip("P02");
    const first = applyTransition(slip, "partialReceive", USERS.purchaser, "初回", NOW,
      { receipts: { 1: 4 }, lots: { 1: " LOT-A " } });
    expect(first.status).toBe("P03");
    expect(first.details[0].inboundQty).toBe(4);
    expect(first.details[0].lotNo).toBe("LOT-A");
    expect(first.details[1]).toEqual(slip.details[1]);
    expect(first.workflow[0].comment).toBe("初回、RAW-A 4EA");
    expect(slip.details[0].inboundQty).toBe(0);
    const second = applyTransition(first, "partialReceive", USERS.purchaser, undefined, NOW,
      { receipts: { 1: 6, 2: 20 }, lots: { 2: "LOT-B" } });
    expect(second.details.map(d => d.inboundQty)).toEqual([10, 20]);
    expect(second.details[0].lotNo).toBe("LOT-A");
    expect(second.workflow[1].comment).toBe("RAW-A 6EA、RAW-B 20SET");
    expect(canExecute(second, "partialReceive", USERS.purchaser).ok).toBe(false);
    const completed = applyTransition(second, "receive", USERS.purchaser, undefined, NOW);
    expect(completed.status).toBe("P04");
    expect(completed.details).toBe(second.details);
  });
  it.each([-1, 11, 0.5, NaN, Infinity, 0])("不正な入庫数量 %s は拒否", qty => {
    expect(() => applyTransition(makeSlip("P02"), "partialReceive", USERS.purchaser, undefined, NOW,
      { receipts: { 1: qty }, lots: { 1: "LOT-A" } })).toThrow("入庫数量が不正です");
  });
  it("入庫対象のLOT番号は必須", () => {
    expect(() => applyTransition(makeSlip("P02"), "partialReceive", USERS.purchaser, undefined, NOW,
      { receipts: { 1: 1 }, lots: { 1: " " } })).toThrow("LOT番号を入力してください");
  });
  it("未入庫なしの分納と未完了の入庫完了は拒否", () => {
    const complete = makeSlip("P03", "PROD", { details: [{ detailId: 1, orderQty: 10, inboundQty: 10 }] });
    expect(canExecute(complete, "partialReceive", USERS.purchaser).ok).toBe(false);
    expect(canExecute(makeSlip("P03"), "receive", USERS.purchaser).ok).toBe(false);
    expect(canExecute(makeSlip("P02"), "receive", USERS.purchaser).ok).toBe(false);
    expect(canExecute(makeSlip("P02"), "partialReceive", USERS.applicant).ok).toBe(false);
  });
});

describe("getFlowSteps", () => {
  it("通常フロー: 現在ステップと完了ステップ", () => {
    const { steps, branch } = getFlowSteps(makeSlip("P01"));
    expect(branch).toBeNull();
    expect(steps.find(s => s.code === "P01")?.state).toBe("current");
    expect(steps.find(s => s.code === "A01")?.state).toBe("done");
    expect(steps.find(s => s.code === "P02")?.state).toBe("upcoming");
  });
  it("A02 分岐: afterStep まで done、本筋に current なし", () => {
    const slip = makeSlip("A02", "PROD", {
      workflow: [{ stepNo: 1, action: "reject", status: "否認", fromStatus: "S01", toStatus: "A02", empId: 1002, empName: "鈴木 花子", role: "一次承認者", comment: "x", procAt: NOW }],
    });
    const { steps, branch } = getFlowSteps(slip);
    expect(branch).toEqual({ status: "A02", label: "否認", afterStep: "S01" });
    expect(steps.every(s => s.state !== "current")).toBe(true);
    expect(steps.find(s => s.code === "S01")?.state).toBe("done");
    expect(steps.find(s => s.code === "A00")?.state).toBe("upcoming");
  });
  it("P00 / T00 分岐マーカー", () => {
    const p = getFlowSteps(makeSlip("P00", "PROD", {
      workflow: [{ stepNo: 1, action: "return", status: "差戻", fromStatus: "P01", toStatus: "P00", empId: 1004, empName: "山田 裕子", role: "購買担当", comment: "x", procAt: NOW }],
    }));
    expect(p.branch?.afterStep).toBe("P01");
    const t = getFlowSteps(makeSlip("T00", "SHIP", {
      workflow: [{ stepNo: 1, action: "return", status: "差戻", fromStatus: "A01", toStatus: "T00", empId: 1005, empName: "伊藤 真一", role: "出庫担当", comment: "x", procAt: NOW }],
    }));
    expect(t.branch?.afterStep).toBe("A01");
  });
});

describe("状態判定", () => {
  it("canEditSlip は作成中かつ起票者本人のみ", () => {
    expect(canEditSlip(makeSlip("S00"), USERS.applicant)).toBe(true);
    expect(canEditSlip(makeSlip("S01"), USERS.applicant)).toBe(false);
    expect(canEditSlip(makeSlip("S00"), USERS.approver1)).toBe(false);
  });
  it("isSlipEditable / isSlipComplete / isSlipTerminal", () => {
    expect(isSlipEditable("S00")).toBe(true);
    expect(isSlipEditable("S01")).toBe(false);
    expect(isSlipComplete("I00")).toBe(true);
    expect(isSlipComplete("T03")).toBe(true);
    expect(isSlipTerminal("A02")).toBe(true);
    expect(isSlipTerminal("P01")).toBe(false);
  });
});
