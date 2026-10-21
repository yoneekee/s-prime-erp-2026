using ErpApi.Common;
using ErpApi.Domain;
using Microsoft.EntityFrameworkCore;

namespace ErpApi.Data;

/// <summary>
/// マスタの初期データ。フロントの mock-data.ts と同じ内容をマイグレーションで投入する。
/// (伝票のデモデータは含めていない。画面から起票するか、必要なら別途追加する)
/// </summary>
internal static class SeedData
{
    public static void Apply(ModelBuilder m)
    {
        m.Entity<Employee>().HasData(
            Emp(1001, "kim.y", "キム ヨンジョン", "MFG1", "PROD", "kim.y@sprime.co.jp", true, ""),
            Emp(1002, "suzuki.h", "鈴木 花子", "MGT", "APPROVER", "suzuki.h@sprime.co.jp", true, "一次承認権限"),
            Emp(1003, "sato.k", "佐藤 健一", "MGT", "APPROVER", "sato.k@sprime.co.jp", true, "二次承認権限"),
            Emp(1004, "yamada.y", "山田 裕子", "MFG2", "PROD", "yamada.y@sprime.co.jp", true, ""),
            Emp(1005, "ito.m", "伊藤 真一", "LOG", "LOG", "ito.m@sprime.co.jp", true, ""),
            Emp(1006, "watanabe.r", "渡辺 涼介", "QC", "INSP", "watanabe.r@sprime.co.jp", true, ""),
            Emp(1007, "kobayashi.a", "小林 明", "MFG1", "PROD", "kobayashi.a@sprime.co.jp", false, "2024.02 退職"));

        // デモ用ロール割当 (constants.ts の DEMO_USERS と同じ)
        m.Entity<EmployeeRole>().HasData(
            WorkflowRoles.DemoEmpIds.Select(kv => new { EmpId = kv.Value, Role = kv.Key }).ToArray<object>());

        m.Entity<Item>().HasData(
            Itm(1, "RAW-WAFER-300", "シリコンウェーハ 300mm", "RAW", "300mm / P-type", "EA", 85000m, 200, 300, 100, "1101", true),
            Itm(2, "RAW-CHEM-AZ", "フォトレジスト AZ-5214", "RAW", "1L / UV-grade", "EA", 120000m, 50, 80, 30, "1101", true),
            Itm(3, "RAW-GAS-N2", "高純度窒素ガス（N2）", "RAW", "99.999% / 47L", "SET", 45000m, 20, 15, 20, "1101", true),
            Itm(4, "SEMI-CHAMBER-01", "真空チャンバーモジュール", "SEMI", "SUS316L / Φ500", "EA", 3500000m, 5, 8, 3, "1102", true),
            Itm(5, "SEMI-RF-GEN", "RF発生器ユニット", "SEMI", "13.56MHz / 3kW", "EA", 8200000m, 5, 3, 2, "1102", true),
            Itm(6, "FIN-ETCH-500", "プラズマエッチング装置 PE-500", "FIN", "Standard Config", "SET", 45000000m, 0, 2, 1, "1103", true),
            Itm(7, "FIN-CVD-300", "CVD成膜装置 CV-300", "FIN", "Standard Config", "SET", 78000000m, 0, 8, 2, "1103", true),
            Itm(8, "RAW-ORING-VT", "バイトン Oリング（Φ300）", "RAW", "Viton / Φ300", "EA", 15000m, 0, 25, 50, "1101", false),
            Itm(9, "RAW-WAFER-200", "シリコンウェーハ 200mm", "RAW", "200mm / N-type", "EA", 62000m, 150, 240, 80, "1101", true),
            Itm(10, "RAW-CHEM-MIF", "現像液 AZ-300MIF", "RAW", "5L / TMAH", "EA", 95000m, 30, 60, 20, "1101", true),
            Itm(11, "RAW-GAS-AR", "高純度アルゴンガス (Ar)", "RAW", "99.9999% / 47L", "SET", 78000m, 20, 40, 15, "1101", true),
            Itm(12, "RAW-BOAT-6", "石英ボート 6インチ", "RAW", "6インチ / 25slot", "EA", 350000m, 10, 24, 6, "1101", true),
            Itm(13, "RAW-ORING-200", "O-Ring (Viton)", "RAW", "ID200 x 5.0", "EA", 12000m, 100, 180, 50, "1101", true),
            Itm(14, "FIN-SPUT-200", "スパッタリング装置 SP-200", "FIN", "Standard Config", "SET", 62000000m, 2, 5, 1, "1103", true),
            Itm(15, "SEMI-CHUCK-01", "精密ウェーハチャックモジュール", "SEMI", "Φ300", "EA", 3200000m, 12, 45, 10, "1102", true),
            Itm(16, "SEMI-ALIGN-02", "自動アライメントモジュール AL-02", "SEMI", "300mm / 自動補正", "EA", 5600000m, 10, 30, 8, "1102", true),
            Itm(17, "FIN-CMP-100", "CMP研磨装置 CM-100", "FIN", "Standard Config", "SET", 95000000m, 1, 3, 1, "1103", true),
            Itm(18, "SEMI-VALVE-05", "超高真空バルブ UV-05", "SEMI", "DN100 / SUS316L", "EA", 850000m, 30, 120, 25, "1102", true),
            Itm(19, "FIN-CLEAN-400", "洗浄装置 CL-400", "FIN", "Standard Config", "SET", 38000000m, 2, 6, 2, "1103", true));

        m.Entity<Location>().HasData(
            Loc(1, "本社 第1倉庫", "FACTORY", "150-0002", "東京都渋谷区渋谷1-2-3 本社ビルB1F", "03-1234-5678", true, "クリーンルーム環境（Class 1000）"),
            Loc(2, "本社 第2倉庫", "FACTORY", "150-0002", "東京都渋谷区渋谷1-2-3 本社ビル1F", "03-1234-5679", true, "一般資材保管"),
            Loc(3, "渋谷物流センター", "STORE", "150-0041", "東京都渋谷区神南2-5-10", "03-9876-5432", true, "出荷前ステージング専用"),
            Loc(4, "菊陽FAB納品拠点", "VENDOR", "869-1101", "熊本県菊池郡菊陽町津久礼8-12 デモ技術パーク", "096-000-0000", true, "菊陽ファウンドリー(株) 納品専用拠点"),
            Loc(5, "輸送中（積送）", "TRANSIT", "", "輸送中", "-", true, "積送品勘定管理用仮想拠点"),
            Loc(6, "大阪支店倉庫", "FACTORY", "530-0001", "大阪府大阪市北区梅田3-1-1", "06-1111-2222", false, "2024.01 閉鎖"));

        m.Entity<Partner>().HasData(
            Ptn(1, "SUP-001", "東京半導体(株)", "SUPPLIER", "135-0064", "東京都江東区青海7-10 デモ材料ビル"),
            Ptn(2, "SUP-002", "大阪精密工業(株)", "SUPPLIER", "564-0051", "大阪府吹田市豊津町9-18 デモ精密棟"),
            Ptn(3, "SUP-003", "名古屋電子(株)", "SUPPLIER", "450-0003", "愛知県名古屋市中村区名駅南6-14 デモ電子棟"),
            Ptn(4, "SUP-004", "名古屋素材(株)", "SUPPLIER", "455-0015", "愛知県名古屋市港区港栄5-12 デモ素材棟"),
            Ptn(5, "SUP-005", "九州ケミカル(株)", "SUPPLIER", "812-0016", "福岡県福岡市博多区博多駅南7-16 デモ化学棟"),
            Ptn(6, "CUS-006", "武蔵野セミコンダクター(株)", "CUSTOMER", "180-0004", "東京都武蔵野市吉祥寺本町5-18 デモ研究棟"),
            Ptn(7, "CUS-007", "洛西プロセス機器(株)", "CUSTOMER", "615-0002", "京都府京都市右京区西院東今田町8-20 デモ機器棟"),
            Ptn(8, "CUS-008", "蒲田ダイシングテック(株)", "CUSTOMER", "144-0052", "東京都大田区蒲田7-16 デモ加工棟"),
            Ptn(9, "CUS-009", "菊陽ファウンドリー(株)", "CUSTOMER", "869-1101", "熊本県菊池郡菊陽町津久礼8-12 デモ技術パーク"),
            Ptn(10, "CUS-010", "常陸マイクロデバイス(株)", "CUSTOMER", "312-0012", "茨城県ひたちなか市馬渡8-15 デモデバイス棟"),
            Ptn(11, "CUS-011", "相模光学工業(株)", "CUSTOMER", "252-0231", "神奈川県相模原市中央区相模原6-18 デモ光学棟"),
            Ptn(12, "CUS-012", "大井精機(株)", "CUSTOMER", "140-0014", "東京都品川区大井8-16 デモ精機棟"),
            Ptn(13, "CUS-013", "北関東テストシステム(株)", "CUSTOMER", "370-0046", "群馬県高崎市江木町9-22 デモ試験棟"));
    }

    private static object Emp(int id, string login, string name, string dept, string roleType, string email, bool active, string remarks)
        => new { EmpId = id, LoginId = login, EmpName = name, DeptCode = dept, RoleType = roleType, Email = email, IsActive = active, Remarks = remarks };

    private static object Itm(int id, string code, string name, string type, string spec, string unit, decimal price,
        int planQty, int stockQty, int safetyStock, string acct, bool active)
        => new
        {
            ItemId = id, ItemCode = code, ItemName = name, ItemType = type, Spec = spec, Unit = unit, StdPrice = price,
            PlanQty = planQty, StockQty = stockQty, SafetyStock = safetyStock, AcctCode = acct, IsActive = active,
        };

    private static object Loc(int id, string name, string type, string postal, string address, string contact, bool active, string remarks)
        => new
        {
            LocId = id, LocName = name, LocType = type, PostalCode = postal, Address = address,
            ContactInfo = contact, IsActive = active, Remarks = remarks,
        };

    private static object Ptn(int id, string code, string name, string type, string postal, string address)
        => new { PartnerId = id, PartnerCode = code, PartnerName = name, PartnerType = type, PostalCode = postal, Address = address, IsActive = true };
}
