import { describe, expect, it, vi } from "vitest";
import { createMockSlips, mockEmployees, mockItems, mockLocations, mockPartners, mockSlips } from "@/services/mock-data";
import { itemSchema } from "@/lib/schemas/item.schema";
import { ROLE_OPTIONS, DEMO_USERS } from "@/lib/constants";
import { TRANSITIONS, findTransition, canExecute } from "@/lib/workflow";
import { slipStore } from "@/services/mock-store";
import { SLIP_STATUS_CONFIG } from "@/lib/slip-utils";
import source from "@/services/mock-data.ts?raw";
import { getDashboardCounts, getPendingTasks, getRecentActivity, getSafetyStockAlerts, getActivityType, isActivityUnread, getSlipDetailPath } from "@/lib/dashboard";
import { daysAgoISO, getFiscalYearPeriod } from "@/lib/format-utils";

describe("デモ初期データの整合性", () => {
  it("申請者1001の氏名・ログインID・メール・部署は指定値に一致する", () => {
    expect(mockEmployees.find(employee => employee.empId === 1001)).toMatchObject({
      empName: "キム ヨンジョン", loginId: "kim.y", email: "kim.y@sprime.co.jp", deptName: "製造1課",
    });
  });
  it("社員v3と伝票v4の保存を維持し旧キーを読み込み時に削除する", async () => {
    const employees = mockEmployees.map(employee => ({ ...employee }));
    employees[0].remarks = "保存済み社員";
    localStorage.setItem("erp_master_employees_v1", "[]");
    localStorage.setItem("erp_master_employees_v2", "[]");
    localStorage.setItem("erp_master_employees_v3", JSON.stringify(employees));
    for (const version of [1, 2, 3]) localStorage.setItem(`erp_slip_store_v${version}`, "[]");
    slipStore.reset();
    vi.resetModules();
    const { employeeStore } = await import("@/services/master-store");
    const { slipStore: reloadedSlips } = await import("@/services/mock-store");
    expect(employeeStore.getSnapshot()[0].remarks).toBe("保存済み社員");
    expect(localStorage.getItem("erp_master_employees_v1")).toBeNull();
    expect(localStorage.getItem("erp_master_employees_v2")).toBeNull();
    for (const version of [1, 2, 3]) expect(localStorage.getItem(`erp_slip_store_v${version}`)).toBeNull();
    expect(reloadedSlips.getSnapshot()).toEqual(slipStore.getSnapshot());
    expect(reloadedSlips.getSnapshot()[0].requester).toBe("キム ヨンジョン");
    employeeStore.reset();
  });
  it("指定された20件の日数差と連番を維持する", () => {
    const today = new Date(2026, 9, 18, 1, 0);
    const ages = [6, 8, 9, 12, 14, 15, 16, 17, 3, 5, 7, 10, 14, 17, 20, 20, 22, 24, 24, 27];
    const sequences = ["001", "003", "002", "001", "005", "002", "004", "001", "001", "002", "001", "003", "002", "001", "003", "004", "002", "003", "001", "004"];
    const rows = createMockSlips(today);
    rows.forEach((slip, index) => {
      expect(slip.date).toBe(daysAgoISO(ages[index], today));
      expect(slip.slipNo.endsWith(`-${sequences[index]}`)).toBe(true);
    });
    expect(rows[0].date).toBe("2026-10-12");
    expect(rows[19].date).toBe("2026-09-21");
  });
  it("初期化した日を基準に伝票日・LOT・履歴を再作成する", () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date(2027, 0, 2, 1));
      slipStore.reset();
      const slip = slipStore.getSnapshot()[0];
      expect(slip.date).toBe("2026-12-27");
      expect(slip.slipNo).toBe("SLP20261227-001");
      expect(slip.details[0].lotNo).toBe("LOT-20261227-1-1");
      expect(slip.workflow[0].procAt).toBe("2026-12-27 09:00:00");
    } finally { vi.useRealTimers(); slipStore.reset(); }
  });
  it("会計年度は4月1日から翌年3月31日", () => {
    expect(getFiscalYearPeriod(new Date(2026, 2, 31))).toEqual({ startDate: "2025-04-01", endDate: "2026-03-31" });
    expect(getFiscalYearPeriod(new Date(2026, 3, 1))).toEqual({ startDate: "2026-04-01", endDate: "2027-03-31" });
  });
  it("全伝票の社員IDと表示名が社員マスタに一致する", () => {
    for (const slip of mockSlips) {
      expect(slip.requestEmpId).toBe(1001);
      expect(slip.department).toBe("製造1課");
      for (const [id, name] of [[slip.requestEmpId, slip.requester], [slip.approverId, slip.approver], [slip.handlerId, slip.handler]] as const) {
        expect(name).toBe(id === null ? "-" : mockEmployees.find(e => e.empId === id)?.empName);
      }
      const approved = ["A01", "P01", "P02", "P03", "P04", "I00", "T01", "T02", "T03"].includes(slip.status);
      expect(slip.approverId).toBe(slip.status === "A02" ? 1002 : approved ? 1003 : null);
      const handled = (slip.slipType === "PROD" ? ["P01", "P02", "P03", "P04", "I00"] : ["T01", "T02", "T03"]).includes(slip.status);
      expect(slip.handlerId).toBe(handled ? slip.slipType === "PROD" ? 1004 : 1005 : null);
    }
  });
  it("物流担当はLOGで定義される", () => {
    expect(ROLE_OPTIONS).toContainEqual({ code: "LOG", name: "物流担当" });
    expect(mockEmployees.find(e => e.empId === 1005)?.roleType).toBe("LOG");
  });
  it("明細の品目ID・コード・単価・分類がマスタに一致する", () => {
    for (const slip of mockSlips) for (const row of slip.details) {
      const item = mockItems.find(i => i.itemId === row.itemId);
      expect(item).toBeDefined();
      expect(row.itemCode).toBe(item?.itemCode);
      expect(row.unitPrice).toBe(item?.stdPrice);
      expect(slip.slipType === "PROD" ? ["RAW", "SEMI"] : ["FIN", "SEMI"]).toContain(item?.itemType);
      if (slip.slipType === "SHIP") expect(row.orderQty).toBeLessThanOrEqual(item?.stockQty ?? -1);
    }
  });
  it("取引先の分類・表示名・出発地・配送住所が一致する", () => {
    for (const slip of mockSlips) {
      if (slip.partnerId === null) { expect(slip.partner).toBe("-"); continue; }
      const partner = mockPartners.find(p => p.partnerId === slip.partnerId);
      expect(partner).toBeDefined();
      expect(slip.partner).toBe(partner?.partnerName);
      expect(slip.slipType === "PROD" ? ["SUPPLIER", "BOTH"] : ["CUSTOMER", "BOTH"]).toContain(partner?.partnerType);
      if (slip.slipType === "SHIP") {
        const location = mockLocations.find(l => l.locId === slip.fromLocId);
        expect(location?.isActive).toBe(true);
        expect(["FACTORY", "STORE"]).toContain(location?.locType);
        expect(slip.fromLocName).toBe(location?.locName);
        expect(slip.deliveryAddress).toBe(`〒${partner?.postalCode} ${partner?.address}`);
      }
    }
  });
  it("件数・金額・明細連番は明細から計算される", () => {
    for (const slip of mockSlips) {
      expect(slip.itemCount).toBe(slip.details.length);
      expect(slip.totalAmount).toBe(slip.details.reduce((sum, row) => sum + row.supplyAmount, 0));
      slip.details.forEach((row, index) => {
        expect(row.detailId).toBe(index + 1);
        expect(row.supplyAmount).toBe(row.orderQty * row.unitPrice);
      });
    }
  });
  it("伝票番号は一意で種別・日付に一致し既存20件を維持する", () => {
    expect(mockSlips).toHaveLength(20);
    expect(new Set(mockSlips.map(s => s.slipNo)).size).toBe(mockSlips.length);
    expect(mockSlips[11].status).toBe("T03");
    expect(Object.keys(SLIP_STATUS_CONFIG).filter(code => code.startsWith("T"))).toEqual(["T00", "T01", "T02", "T03"]);
    for (const slip of mockSlips) expect(SLIP_STATUS_CONFIG[slip.status]).toBeDefined();
    // PROD 伝票の区分名は「購買」
    for (const slip of mockSlips) {
      expect(slip.typeName).toBe(slip.slipType === "PROD" ? "購買" : "出庫");
    }
    for (const slip of mockSlips) expect(slip.slipNo).toMatch(new RegExp(`^${slip.slipType === "PROD" ? "SLP" : "SHP"}${slip.date.replace(/-/g, "")}-\\d{3}$`));
  });
  it("入庫累計とLOT番号は状態に一致する", () => {
    for (const slip of mockSlips) {
      if (slip.slipType === "PROD" && slip.status === "P03") expect(slip.details.some(row => row.inboundQty > 0 && row.inboundQty < row.orderQty)).toBe(true);
      for (const row of slip.details) {
        expect(row.inboundQty).toBeLessThanOrEqual(row.orderQty);
        if (slip.slipType === "SHIP") {
          expect(row.inboundQty).toBe(0);
          if (["T01", "T02", "T03"].includes(slip.status)) expect(row.lotNo.length).toBeGreaterThan(0);
          else expect(row.lotNo).toBe("");
        } else if (["P04", "I00"].includes(slip.status)) {
          expect(row.inboundQty).toBe(row.orderQty);
          expect(row.lotNo.length).toBeGreaterThan(0);
        } else if (slip.status === "P03") {
          if (row.inboundQty > 0) expect(row.lotNo.length).toBeGreaterThan(0);
        } else { expect(row.inboundQty).toBe(0); expect(row.lotNo).toBe(""); }
      }
    }
  });
  it("品目と取引先のID・コードは一意で品目スキーマと勘定科目を満たす", () => {
    const identifiers: (string | number)[][] = [mockItems.map(i => i.itemId), mockItems.map(i => i.itemCode), mockPartners.map(p => p.partnerId), mockPartners.map(p => p.partnerCode)];
    for (const values of identifiers) expect(new Set(values).size).toBe(values.length);
    for (const item of mockItems) {
      expect(itemSchema.safeParse(item).success).toBe(true);
      expect(item.acctCode).toBe(({ RAW: "1101", SEMI: "1102", FIN: "1103" } as Record<string, string>)[item.itemType]);
    }
    for (const partner of mockPartners) expect(partner.postalCode).toMatch(/^\d{3}-\d{4}$/);
  });
  it("シード履歴は S00 から連続し、最終 toStatus が伝票ステータスと一致する", () => {
    slipStore.reset();
    for (const slip of slipStore.getSnapshot()) {
      const wf = slip.workflow;
      if (slip.status === "S00") { expect(wf).toHaveLength(0); continue; }
      expect(wf[0].fromStatus).toBe("S00");
      wf.forEach((entry, i) => {
        expect(entry.stepNo).toBe(i + 1);
        if (i > 0) expect(entry.fromStatus).toBe(wf[i - 1].toStatus);
        // ラベル・ロール・社員ID は遷移テーブル (またはシード専用アクション) と DEMO_USERS に一致
        const def = findTransition(slip.slipType, entry.action as never, entry.fromStatus);
        const seedOnly = ["partialReceive", "receive"].includes(entry.action);
        expect(def || seedOnly).toBeTruthy();
        if (def) expect(entry.status).toBe(def.label);
        const demo = DEMO_USERS.find(u => u.empId === entry.empId);
        expect(demo).toBeDefined();
        expect(entry.role).toBe(demo?.roleLabel);
        expect(entry.empName).toBe(mockEmployees.find(e => e.empId === entry.empId)?.empName);
      });
      expect(wf[wf.length - 1].toStatus).toBe(slip.status);
    }
  });
  it("A02 シードは一次承認者の否認コメントを持つ", () => {
    slipStore.reset();
    const rejected = slipStore.getSnapshot().filter(s => s.status === "A02");
    expect(rejected.length).toBeGreaterThanOrEqual(2);
    for (const slip of rejected) {
      const entry = slip.workflow[slip.workflow.length - 1];
      expect(entry.action).toBe("reject");
      expect(entry.empId).toBe(1002);
      expect(entry.comment).toBe("数量の根拠が不足しているため否認します");
    }
  });
  it("実在の顧客名を含まない", () => {
    const forbiddenNames = [
      "東京" + "エレクトロン", "SCR" + "EEN", "ディ" + "スコ", "TS" + "MC",
      "ルネ" + "サス", "キヤ" + "ノン", "ニ" + "コン", "アドバン" + "テスト", "サム" + "スン", "Sam" + "sung",
    ];
    for (const name of forbiddenNames) expect(source.includes(name)).toBe(false);
  });
});

describe("ダッシュボードと通知のデータ", () => {
  it("指定状態のみをKPIとして集計する", () => {
    slipStore.reset();
    expect(getDashboardCounts(slipStore.getSnapshot(), mockItems)).toEqual({ pending: 1, purchasing: 4, shipping: 3, lowStock: 1 });
  });
  it("タスクはロール別のcanExecuteに一致し新しい順になる", () => {
    slipStore.reset();
    const slips = slipStore.getSnapshot();
    for (const demo of DEMO_USERS) {
      const employee = mockEmployees.find(emp => emp.empId === demo.empId);
      if (!employee) throw new Error("社員が見つかりません");
      const user = { ...demo, empName: employee.empName };
      const tasks = getPendingTasks(slips, user);
      const expected = slips.filter(slip => TRANSITIONS[slip.slipType].some(def => canExecute(slip, def.action, user).ok));
      expect(tasks.map(task => task.slip.slipNo).sort()).toEqual(expected.map(slip => slip.slipNo).sort());
      expect(tasks.map(task => task.slip.date)).toEqual(tasks.map(task => task.slip.date).sort().reverse());
    }
    const purchaser = { empId: 1004, empName: "山田 裕子", role: "PURCHASER" as const, roleLabel: "購買担当" };
    expect(getPendingTasks(slips, purchaser)).toHaveLength(5);
    expect(getPendingTasks(slips, null)).toEqual([]);
    const firstApprover = { empId: 1002, empName: "鈴木 花子", role: "APPROVER_1" as const, roleLabel: "一次承認者" };
    expect(getPendingTasks(slips, firstApprover)[0].actions).toEqual(["一次承認", "否認"]);
  });
  it("履歴は全伝票を横断し処理日時順で8件・10件に制限する", () => {
    slipStore.reset();
    const slips = slipStore.getSnapshot();
    const activity = getRecentActivity(slips, 8);
    expect(activity).toHaveLength(8);
    expect(getRecentActivity(slips, 10)).toHaveLength(10);
    expect(activity.map(entry => entry.procAt)).toEqual(activity.map(entry => entry.procAt).sort().reverse());
    expect(activity[0].slipNo).toBe(slips[8].slipNo);
    expect(activity[0].label).toBe("配送開始（積送）");
    expect(getSlipDetailPath(activity[0])).toBe(`/production/shipping?slipNo=${slips[8].slipNo}`);
    expect(getSlipDetailPath(slips[0])).toBe(`/production/execution?slipNo=${slips[0].slipNo}`);
  });
  it("安全在庫警告は有効品目のみ、在庫比率の低い順", () => {
    const rows = getSafetyStockAlerts([
      { isActive: true, stockQty: 15, safetyStock: 20 },
      { isActive: false, stockQty: 0, safetyStock: 20 },
      { isActive: true, stockQty: 5, safetyStock: 20 },
      { isActive: true, stockQty: 20, safetyStock: 20 },
    ]);
    expect(rows.map(row => row.stockQty)).toEqual([5, 15]);
    expect(getSafetyStockAlerts(mockItems).map(item => item.itemCode)).toEqual(["RAW-GAS-N2"]);
  });
  it("否認・差戻は警告、最終承認・検収完了・売上確定は成功", () => {
    for (const label of ["否認", "差戻"]) expect(getActivityType(label)).toBe("warning");
    for (const label of ["最終承認", "検収完了", "売上確定"]) expect(getActivityType(label)).toBe("success");
    expect(getActivityType("申請")).toBe("info");
  });
  it("既読時刻より後で個別既読キーにない履歴だけ未読", () => {
    const entry = { key: "SLP1", procAt: "2026-10-18 10:00:01" };
    expect(isActivityUnread(entry, "2026-10-18T10:00:00", [])).toBe(true);
    expect(isActivityUnread(entry, "2026-10-18T10:00:01", [])).toBe(false);
    expect(isActivityUnread(entry, "2026-10-18T10:00:02", [])).toBe(false);
    expect(isActivityUnread(entry, "2026-10-18T10:00:00", ["SLP1"])).toBe(false);
  });
});