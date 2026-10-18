import { daysAgoISO } from "@/lib/format-utils";

/**
 * ============================================================
 * 統合モックデータ (mock-data.ts)
 * ============================================================
 *
 * 目的: 全ページで使われるモックデータを一箇所に集約。
 * API連携時はこのファイル内のデータを API 呼び出しに差し替えるだけで済みます。
 *
 * 使い方:
 *   import { mockEmployees, mockItems } from "@/services/mock-data";
 */

// ========================================
// 社員マスタ
// ========================================

export interface MockEmployee {
  empId: number;
  loginId: string;
  empName: string;
  deptCode: string;
  deptName: string;
  roleType: string;
  roleName: string;
  email: string;
  isActive: boolean;
  remarks: string;
}

export const mockEmployees: MockEmployee[] = [
  { empId: 1001, loginId: "kim.y", empName: "キム ヨンジョン", deptCode: "MFG1", deptName: "製造1課", roleType: "PROD", roleName: "製造担当", email: "kim.y@sprime.co.jp", isActive: true, remarks: "" },
  { empId: 1002, loginId: "suzuki.h", empName: "鈴木 花子", deptCode: "MGT", deptName: "経営管理課", roleType: "APPROVER", roleName: "承認者", email: "suzuki.h@sprime.co.jp", isActive: true, remarks: "一次承認権限" },
  { empId: 1003, loginId: "sato.k", empName: "佐藤 健一", deptCode: "MGT", deptName: "経営管理課", roleType: "APPROVER", roleName: "承認者", email: "sato.k@sprime.co.jp", isActive: true, remarks: "二次承認権限" },
  { empId: 1004, loginId: "yamada.y", empName: "山田 裕子", deptCode: "MFG2", deptName: "製造2課", roleType: "PROD", roleName: "製造担当", email: "yamada.y@sprime.co.jp", isActive: true, remarks: "" },
  { empId: 1005, loginId: "ito.m", empName: "伊藤 真一", deptCode: "LOG", deptName: "物流課", roleType: "LOG", roleName: "物流担当", email: "ito.m@sprime.co.jp", isActive: true, remarks: "" },
  { empId: 1006, loginId: "watanabe.r", empName: "渡辺 涼介", deptCode: "QC", deptName: "品質管理課", roleType: "INSP", roleName: "検収担当", email: "watanabe.r@sprime.co.jp", isActive: true, remarks: "" },
  { empId: 1007, loginId: "kobayashi.a", empName: "小林 明", deptCode: "MFG1", deptName: "製造1課", roleType: "PROD", roleName: "製造担当", email: "kobayashi.a@sprime.co.jp", isActive: false, remarks: "2024.02 退職" },
];

// ========================================
// 品目マスタ
// ========================================

export interface MockItem {
  itemId: number;
  itemCode: string;
  itemName: string;
  itemType: string;
  typeName: string;
  spec: string;
  unit: string;
  stdPrice: number;
  planQty: number;
  stockQty: number;
  safetyStock: number;
  acctCode: string;
  isActive: boolean;
}

export const mockItems: MockItem[] = [
  { itemId: 1, itemCode: "RAW-WAFER-300", itemName: "シリコンウェーハ 300mm", itemType: "RAW", typeName: "原材料", spec: "300mm / P-type", unit: "EA", stdPrice: 85000, planQty: 200, stockQty: 300, safetyStock: 100, acctCode: "1101", isActive: true },
  { itemId: 2, itemCode: "RAW-CHEM-AZ", itemName: "フォトレジスト AZ-5214", itemType: "RAW", typeName: "原材料", spec: "1L / UV-grade", unit: "EA", stdPrice: 120000, planQty: 50, stockQty: 80, safetyStock: 30, acctCode: "1101", isActive: true },
  { itemId: 3, itemCode: "RAW-GAS-N2", itemName: "高純度窒素ガス（N2）", itemType: "RAW", typeName: "原材料", spec: "99.999% / 47L", unit: "SET", stdPrice: 45000, planQty: 20, stockQty: 15, safetyStock: 20, acctCode: "1101", isActive: true },
  { itemId: 4, itemCode: "SEMI-CHAMBER-01", itemName: "真空チャンバーモジュール", itemType: "SEMI", typeName: "半製品", spec: "SUS316L / Φ500", unit: "EA", stdPrice: 3500000, planQty: 5, stockQty: 8, safetyStock: 3, acctCode: "1102", isActive: true },
  { itemId: 5, itemCode: "SEMI-RF-GEN", itemName: "RF発生器ユニット", itemType: "SEMI", typeName: "半製品", spec: "13.56MHz / 3kW", unit: "EA", stdPrice: 8200000, planQty: 5, stockQty: 3, safetyStock: 2, acctCode: "1102", isActive: true },
  { itemId: 6, itemCode: "FIN-ETCH-500", itemName: "プラズマエッチング装置 PE-500", itemType: "FIN", typeName: "完成品", spec: "Standard Config", unit: "SET", stdPrice: 45000000, planQty: 0, stockQty: 2, safetyStock: 1, acctCode: "1103", isActive: true },
  { itemId: 7, itemCode: "FIN-CVD-300", itemName: "CVD成膜装置 CV-300", itemType: "FIN", typeName: "完成品", spec: "Standard Config", unit: "SET", stdPrice: 78000000, planQty: 0, stockQty: 8, safetyStock: 2, acctCode: "1103", isActive: true },
  { itemId: 8, itemCode: "RAW-ORING-VT", itemName: "バイトン Oリング（Φ300）", itemType: "RAW", typeName: "原材料", spec: "Viton / Φ300", unit: "EA", stdPrice: 15000, planQty: 0, stockQty: 25, safetyStock: 50, acctCode: "1101", isActive: false },
  { itemId: 9, itemCode: "RAW-WAFER-200", itemName: "シリコンウェーハ 200mm", itemType: "RAW", typeName: "原材料", spec: "200mm / N-type", unit: "EA", stdPrice: 62000, planQty: 150, stockQty: 240, safetyStock: 80, acctCode: "1101", isActive: true },
  { itemId: 10, itemCode: "RAW-CHEM-MIF", itemName: "現像液 AZ-300MIF", itemType: "RAW", typeName: "原材料", spec: "5L / TMAH", unit: "EA", stdPrice: 95000, planQty: 30, stockQty: 60, safetyStock: 20, acctCode: "1101", isActive: true },
  { itemId: 11, itemCode: "RAW-GAS-AR", itemName: "高純度アルゴンガス (Ar)", itemType: "RAW", typeName: "原材料", spec: "99.9999% / 47L", unit: "SET", stdPrice: 78000, planQty: 20, stockQty: 40, safetyStock: 15, acctCode: "1101", isActive: true },
  { itemId: 12, itemCode: "RAW-BOAT-6", itemName: "石英ボート 6インチ", itemType: "RAW", typeName: "原材料", spec: "6インチ / 25slot", unit: "EA", stdPrice: 350000, planQty: 10, stockQty: 24, safetyStock: 6, acctCode: "1101", isActive: true },
  { itemId: 13, itemCode: "RAW-ORING-200", itemName: "O-Ring (Viton)", itemType: "RAW", typeName: "原材料", spec: "ID200 x 5.0", unit: "EA", stdPrice: 12000, planQty: 100, stockQty: 180, safetyStock: 50, acctCode: "1101", isActive: true },
  { itemId: 14, itemCode: "FIN-SPUT-200", itemName: "スパッタリング装置 SP-200", itemType: "FIN", typeName: "完成品", spec: "Standard Config", unit: "SET", stdPrice: 62000000, planQty: 2, stockQty: 5, safetyStock: 1, acctCode: "1103", isActive: true },
  { itemId: 15, itemCode: "SEMI-CHUCK-01", itemName: "精密ウェーハチャックモジュール", itemType: "SEMI", typeName: "半製品", spec: "Φ300", unit: "EA", stdPrice: 3200000, planQty: 12, stockQty: 45, safetyStock: 10, acctCode: "1102", isActive: true },
  { itemId: 16, itemCode: "SEMI-ALIGN-02", itemName: "自動アライメントモジュール AL-02", itemType: "SEMI", typeName: "半製品", spec: "300mm / 自動補正", unit: "EA", stdPrice: 5600000, planQty: 10, stockQty: 30, safetyStock: 8, acctCode: "1102", isActive: true },
  { itemId: 17, itemCode: "FIN-CMP-100", itemName: "CMP研磨装置 CM-100", itemType: "FIN", typeName: "完成品", spec: "Standard Config", unit: "SET", stdPrice: 95000000, planQty: 1, stockQty: 3, safetyStock: 1, acctCode: "1103", isActive: true },
  { itemId: 18, itemCode: "SEMI-VALVE-05", itemName: "超高真空バルブ UV-05", itemType: "SEMI", typeName: "半製品", spec: "DN100 / SUS316L", unit: "EA", stdPrice: 850000, planQty: 30, stockQty: 120, safetyStock: 25, acctCode: "1102", isActive: true },
  { itemId: 19, itemCode: "FIN-CLEAN-400", itemName: "洗浄装置 CL-400", itemType: "FIN", typeName: "完成品", spec: "Standard Config", unit: "SET", stdPrice: 38000000, planQty: 2, stockQty: 6, safetyStock: 2, acctCode: "1103", isActive: true },

];

// ========================================
// 倉庫拠点マスタ
// ========================================

export interface MockLocation {
  locId: number;
  locName: string;
  locType: string;
  typeName: string;
  postalCode: string;
  address: string;
  contactInfo: string;
  isActive: boolean;
  remarks: string;
}

export const mockLocations: MockLocation[] = [
  { locId: 1, locName: "本社 第1倉庫", locType: "FACTORY", typeName: "工場", postalCode: "150-0002", address: "東京都渋谷区渋谷1-2-3 本社ビルB1F", contactInfo: "03-1234-5678", isActive: true, remarks: "クリーンルーム環境（Class 1000）" },
  { locId: 2, locName: "本社 第2倉庫", locType: "FACTORY", typeName: "工場", postalCode: "150-0002", address: "東京都渋谷区渋谷1-2-3 本社ビル1F", contactInfo: "03-1234-5679", isActive: true, remarks: "一般資材保管" },
  { locId: 3, locName: "渋谷物流センター", locType: "STORE", typeName: "倉庫", postalCode: "150-0041", address: "東京都渋谷区神南2-5-10", contactInfo: "03-9876-5432", isActive: true, remarks: "出荷前ステージング専用" },
  { locId: 4, locName: "菊陽FAB納品拠点", locType: "VENDOR", typeName: "取引先", postalCode: "869-1101", address: "熊本県菊池郡菊陽町津久礼8-12 デモ技術パーク", contactInfo: "096-000-0000", isActive: true, remarks: "菊陽ファウンドリー(株) 納品専用拠点" },
  { locId: 5, locName: "輸送中（積送）", locType: "TRANSIT", typeName: "積送", postalCode: "", address: "輸送中", contactInfo: "-", isActive: true, remarks: "積送品勘定管理用仮想拠点" },
  { locId: 6, locName: "大阪支店倉庫", locType: "FACTORY", typeName: "工場", postalCode: "530-0001", address: "大阪府大阪市北区梅田3-1-1", contactInfo: "06-1111-2222", isActive: false, remarks: "2024.01 閉鎖" },
];

// ========================================
// 伝票一覧
// ========================================

export interface MockPartner {
  partnerId: number;
  partnerCode: string;
  partnerName: string;
  partnerType: "SUPPLIER" | "CUSTOMER" | "BOTH";
  postalCode: string;
  address: string;
  isActive: boolean;
}

/** 架空の国内デモ取引先（読取専用） */
export const mockPartners: MockPartner[] = [
  { partnerId: 1, partnerCode: "SUP-001", partnerName: "東京半導体(株)", partnerType: "SUPPLIER", postalCode: "135-0064", address: "東京都江東区青海7-10 デモ材料ビル", isActive: true },
  { partnerId: 2, partnerCode: "SUP-002", partnerName: "大阪精密工業(株)", partnerType: "SUPPLIER", postalCode: "564-0051", address: "大阪府吹田市豊津町9-18 デモ精密棟", isActive: true },
  { partnerId: 3, partnerCode: "SUP-003", partnerName: "名古屋電子(株)", partnerType: "SUPPLIER", postalCode: "450-0003", address: "愛知県名古屋市中村区名駅南6-14 デモ電子棟", isActive: true },
  { partnerId: 4, partnerCode: "SUP-004", partnerName: "名古屋素材(株)", partnerType: "SUPPLIER", postalCode: "455-0015", address: "愛知県名古屋市港区港栄5-12 デモ素材棟", isActive: true },
  { partnerId: 5, partnerCode: "SUP-005", partnerName: "九州ケミカル(株)", partnerType: "SUPPLIER", postalCode: "812-0016", address: "福岡県福岡市博多区博多駅南7-16 デモ化学棟", isActive: true },
  { partnerId: 6, partnerCode: "CUS-006", partnerName: "武蔵野セミコンダクター(株)", partnerType: "CUSTOMER", postalCode: "180-0004", address: "東京都武蔵野市吉祥寺本町5-18 デモ研究棟", isActive: true },
  { partnerId: 7, partnerCode: "CUS-007", partnerName: "洛西プロセス機器(株)", partnerType: "CUSTOMER", postalCode: "615-0002", address: "京都府京都市右京区西院東今田町8-20 デモ機器棟", isActive: true },
  { partnerId: 8, partnerCode: "CUS-008", partnerName: "蒲田ダイシングテック(株)", partnerType: "CUSTOMER", postalCode: "144-0052", address: "東京都大田区蒲田7-16 デモ加工棟", isActive: true },
  { partnerId: 9, partnerCode: "CUS-009", partnerName: "菊陽ファウンドリー(株)", partnerType: "CUSTOMER", postalCode: "869-1101", address: "熊本県菊池郡菊陽町津久礼8-12 デモ技術パーク", isActive: true },
  { partnerId: 10, partnerCode: "CUS-010", partnerName: "常陸マイクロデバイス(株)", partnerType: "CUSTOMER", postalCode: "312-0012", address: "茨城県ひたちなか市馬渡8-15 デモデバイス棟", isActive: true },
  { partnerId: 11, partnerCode: "CUS-011", partnerName: "相模光学工業(株)", partnerType: "CUSTOMER", postalCode: "252-0231", address: "神奈川県相模原市中央区相模原6-18 デモ光学棟", isActive: true },
  { partnerId: 12, partnerCode: "CUS-012", partnerName: "大井精機(株)", partnerType: "CUSTOMER", postalCode: "140-0014", address: "東京都品川区大井8-16 デモ精機棟", isActive: true },
  { partnerId: 13, partnerCode: "CUS-013", partnerName: "北関東テストシステム(株)", partnerType: "CUSTOMER", postalCode: "370-0046", address: "群馬県高崎市江木町9-22 デモ試験棟", isActive: true },
];

export interface SlipDetailRow {
  detailId: number;
  itemId: number;
  itemCode: string;
  itemName: string;
  spec: string;
  unit: string;
  orderQty: number;
  inboundQty: number;
  unitPrice: number;
  supplyAmount: number;
  lotNo: string;
}

export interface MockSlipRecord {
  slipNo: string;
  slipType: "PROD" | "SHIP";
  typeName: string;
  date: string;
  requestEmpId: number;
  requester: string;
  department: string;
  approverId: number | null;
  approver: string;
  handlerId: number | null;
  handler: string;
  status: string;
  partnerId: number | null;
  partner: string;
  remarks: string;
  fromLocId: number | null;
  fromLocName: string;
  deliveryAddress: string;
  details: SlipDetailRow[];
  totalAmount: number;
  itemCount: number;
}

// 種別・状態・取引先・明細件数・連番を維持し、業務日は生成日から計算する。
const slipSeedHeaders: { sequence: string; slipType: "PROD" | "SHIP"; daysAgo: number; status: string; partnerId: number | null; rowCount: number }[] = [
  { sequence: "001", slipType: "PROD", daysAgo: 6, status: "P03", partnerId: 1, rowCount: 3 },
  { sequence: "003", slipType: "PROD", daysAgo: 8, status: "A01", partnerId: 2, rowCount: 2 },
  { sequence: "002", slipType: "PROD", daysAgo: 9, status: "I00", partnerId: 3, rowCount: 5 },
  { sequence: "001", slipType: "PROD", daysAgo: 12, status: "S00", partnerId: null, rowCount: 0 },
  { sequence: "005", slipType: "PROD", daysAgo: 14, status: "P04", partnerId: 1, rowCount: 4 },
  { sequence: "002", slipType: "PROD", daysAgo: 15, status: "A02", partnerId: 5, rowCount: 1 },
  { sequence: "004", slipType: "PROD", daysAgo: 16, status: "P02", partnerId: 2, rowCount: 3 },
  { sequence: "001", slipType: "PROD", daysAgo: 17, status: "I00", partnerId: 1, rowCount: 2 },
  { sequence: "001", slipType: "SHIP", daysAgo: 3, status: "T01", partnerId: 6, rowCount: 3 },
  { sequence: "002", slipType: "SHIP", daysAgo: 5, status: "T03", partnerId: 7, rowCount: 2 },
  { sequence: "001", slipType: "SHIP", daysAgo: 7, status: "T02", partnerId: 8, rowCount: 1 },
  { sequence: "003", slipType: "SHIP", daysAgo: 10, status: "T03", partnerId: 9, rowCount: 2 },
  { sequence: "002", slipType: "SHIP", daysAgo: 14, status: "T03", partnerId: 11, rowCount: 4 },
  { sequence: "001", slipType: "SHIP", daysAgo: 17, status: "A01", partnerId: 12, rowCount: 2 },
  { sequence: "003", slipType: "PROD", daysAgo: 20, status: "S01", partnerId: 1, rowCount: 2 },
  { sequence: "004", slipType: "SHIP", daysAgo: 20, status: "T02", partnerId: 13, rowCount: 1 },
  { sequence: "002", slipType: "PROD", daysAgo: 22, status: "P01", partnerId: 3, rowCount: 3 },
  { sequence: "003", slipType: "SHIP", daysAgo: 24, status: "A02", partnerId: 6, rowCount: 3 },
  { sequence: "001", slipType: "PROD", daysAgo: 24, status: "A01", partnerId: 2, rowCount: 2 },
  { sequence: "004", slipType: "PROD", daysAgo: 27, status: "I00", partnerId: 1, rowCount: 4 },
];

export function createMockSlips(today = new Date()): MockSlipRecord[] {
  return slipSeedHeaders.map((seedHeader, index) => {
  const date = daysAgoISO(seedHeader.daysAgo, today);
  const prefix = seedHeader.slipType === "PROD" ? "SLP" : "SHP";
  const header = { ...seedHeader, date, slipNo: `${prefix}${date.replace(/-/g, "")}-${seedHeader.sequence}` };
  const requester = mockEmployees.find(e => e.empId === 1001);
  if (!requester) throw new Error("デモ申請者が見つかりません");
  const approved = ["A01", "P01", "P02", "P03", "P04", "I00", "T01", "T02", "T03"].includes(header.status);
  const approverId = header.status === "A02" ? 1002 : approved ? 1003 : null;
  const handled = header.slipType === "PROD"
    ? ["P01", "P02", "P03", "P04", "I00"].includes(header.status)
    : ["T01", "T02", "T03"].includes(header.status);
  const handlerId = handled ? (header.slipType === "PROD" ? 1004 : 1005) : null;
  const partner = mockPartners.find(p => p.partnerId === header.partnerId);
  const candidates = mockItems.filter(item => item.isActive && (header.slipType === "PROD" ? ["RAW", "SEMI"] : ["FIN", "SEMI"]).includes(item.itemType));
  const details: SlipDetailRow[] = Array.from({ length: header.rowCount }, (_, row) => {
    const item = candidates[(index + row) % candidates.length];
    const orderQty = header.slipType === "SHIP" ? Math.min(item.stockQty, row + 1) : 10 * (row + 1);
    const inboundQty = header.slipType === "SHIP" ? 0
      : ["P04", "I00"].includes(header.status) ? orderQty
      : header.status === "P03" ? Math.floor(orderQty / 2) : 0;
    const needsLot = inboundQty > 0 || (header.slipType === "SHIP" && ["T01", "T02", "T03"].includes(header.status));
    return { detailId: row + 1, itemId: item.itemId, itemCode: item.itemCode, itemName: item.itemName,
      spec: item.spec, unit: item.unit, orderQty, inboundQty, unitPrice: item.stdPrice,
      supplyAmount: orderQty * item.stdPrice, lotNo: needsLot ? `LOT-${header.date.replace(/-/g, "")}-${index + 1}-${row + 1}` : "" };
  });
  const locations = mockLocations.filter(l => l.isActive && ["FACTORY", "STORE"].includes(l.locType));
  const location = header.slipType === "SHIP" ? locations[index % locations.length] : undefined;
  return { slipNo: header.slipNo, slipType: header.slipType, date: header.date, status: header.status,
    typeName: header.slipType === "PROD" ? "購買" : "出庫",
    requestEmpId: requester.empId, requester: requester.empName, department: requester.deptName,
    approverId, approver: mockEmployees.find(e => e.empId === approverId)?.empName ?? "-",
    handlerId, handler: mockEmployees.find(e => e.empId === handlerId)?.empName ?? "-",
    partnerId: header.partnerId, partner: partner?.partnerName ?? "-",
    remarks: header.status === "S00" ? "" : `デモ${header.slipType === "PROD" ? "資材調達" : "出庫"}伝票 ${index + 1}`,
    fromLocId: location?.locId ?? null, fromLocName: location?.locName ?? "-",
    deliveryAddress: header.slipType === "SHIP" && partner ? `〒${partner.postalCode} ${partner.address}` : "",
    details, itemCount: details.length, totalAmount: details.reduce((sum, row) => sum + row.supplyAmount, 0) };
  });
}

export const mockSlips = createMockSlips();


