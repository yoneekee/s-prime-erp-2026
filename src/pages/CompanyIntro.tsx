import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ERPLayout from "@/components/erp/ERPLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Cpu,
  Database,
  Factory,
  FileText,
  Layers,
  Package,
  Shield,
  TrendingUp,
  Workflow,
  BookOpen,
  Server,
  Code2,
  CloudCog,
  BarChart3,
  Building2,
  ExternalLink,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const statusCodes = [
  {
    group: "Common",
    code: "S00",
    nameEn: "Draft",
    nameJp: "作成中",
    desc: "起票・修正中",
    role: "申請者",
  },
  {
    group: "Common",
    code: "S01",
    nameEn: "Pending",
    nameJp: "申請中",
    desc: "一次承認待ち",
    role: "申請者",
  },
  {
    group: "Common",
    code: "A00",
    nameEn: "In-Review",
    nameJp: "承認中",
    desc: "一次承認済・最終承認待ち",
    role: "一次承認者",
  },
  {
    group: "Common",
    code: "A01",
    nameEn: "Approved",
    nameJp: "承認済",
    desc: "最終承認完了",
    role: "最終承認者",
  },
  {
    group: "Common",
    code: "A02",
    nameEn: "Rejected",
    nameJp: "否認",
    desc: "承認者が却下（再申請不可）",
    role: "一次承認者・最終承認者",
  },
  {
    group: "Purchase",
    code: "P00",
    nameEn: "Returned",
    nameJp: "差戻中",
    desc: "購買担当が発注前に差戻し",
    role: "購買担当",
  },
  {
    group: "Purchase",
    code: "P01",
    nameEn: "Quoted",
    nameJp: "見積中",
    desc: "購買担当が見積を開始",
    role: "購買担当",
  },
  {
    group: "Purchase",
    code: "P02",
    nameEn: "Ordered",
    nameJp: "発注済",
    desc: "発注確定済・入荷待ち",
    role: "購買担当",
  },
  {
    group: "Purchase",
    code: "P03",
    nameEn: "Partial",
    nameJp: "分納中",
    desc: "一部入庫済",
    role: "購買担当",
  },
  {
    group: "Purchase",
    code: "P04",
    nameEn: "Received",
    nameJp: "入庫済",
    desc: "全数量入庫済",
    role: "購買担当",
  },
  {
    group: "Inspection",
    code: "I00",
    nameEn: "Accepted",
    nameJp: "検収済",
    desc: "検収完了",
    role: "検収担当",
  },
  {
    group: "Logistics",
    code: "T00",
    nameEn: "Returned",
    nameJp: "差戻中",
    desc: "出庫担当が差戻し",
    role: "出庫担当",
  },
  {
    group: "Logistics",
    code: "T01",
    nameEn: "Transit",
    nameJp: "積送中",
    desc: "LOT番号を記録し配送中",
    role: "出庫担当",
  },
  {
    group: "Logistics",
    code: "T02",
    nameEn: "Delivered",
    nameJp: "出庫済",
    desc: "顧客への引渡完了",
    role: "出庫担当",
  },
  {
    group: "Logistics",
    code: "T03",
    nameEn: "Invoiced",
    nameJp: "売上確定",
    desc: "売上を計上",
    role: "出庫担当",
  },
];

const accountCodes = [
  {
    category: "資産",
    name: "原材料",
    code: "1101",
    desc: "外部から購入した基礎部品および原材料",
  },
  {
    category: "資産",
    name: "半製品",
    code: "1102",
    desc: "組立中のモジュールや加工された中間部品",
  },
  {
    category: "資産",
    name: "完成品",
    code: "1103",
    desc: "最終検収が完了した販売用装置",
  },
  {
    category: "資産",
    name: "未着品",
    code: "1104",
    desc: "発注後まだ倉庫に到着していない輸送中資産",
  },
  {
    category: "資産",
    name: "積送品",
    code: "1105",
    desc: "顧客へ配送中だがまだ売上認識前の資産",
  },
  {
    category: "資産",
    name: "売掛金",
    code: "1106",
    desc: "製品販売後まだ回収していない債権",
  },
  {
    category: "負債",
    name: "買掛金",
    code: "2101",
    desc: "原材料入庫後まだ支払っていない債務",
  },
  {
    category: "負債",
    name: "未払金",
    code: "2102",
    desc: "一般経費や発注段階で発生する一時的債務",
  },
  {
    category: "収益",
    name: "売上高",
    code: "4101",
    desc: "装置販売およびサービス提供収益",
  },
  {
    category: "費用",
    name: "売上原価",
    code: "5101",
    desc: "販売された製品の製造原価",
  },
  {
    category: "費用",
    name: "棚卸減耗損",
    code: "5102",
    desc: "検収不合格や破損による在庫損失",
  },
];

const techStack = [
  {
    icon: Code2,
    label: "Frontend",
    value: "TypeScript, React, Vite, Tailwind CSS, shadcn/ui, Vitest",
  },
  {
    icon: Server,
    label: "Backend（今後の拡張）",
    value: "C# (.NET Core), Entity Framework Core",
  },
  {
    icon: Database,
    label: "Database（今後の拡張）",
    value: "PostgreSQL (Read Committed)",
  },
  {
    icon: CloudCog,
    label: "Infrastructure（今後の拡張）",
    value: "Azure Cloud Services",
  },
];

interface TableColumn {
  name: string;
  type: string;
  constraint: string;
  desc: string;
}

const tableSchemas: Record<string, TableColumn[]> = {
  tran_history: [
    {
      name: "slip_no",
      type: "VARCHAR(20)",
      constraint: "PK",
      desc: "伝票番号",
    },
    {
      name: "slip_date",
      type: "DATE",
      constraint: "NOT NULL",
      desc: "伝票作成日",
    },
    {
      name: "request_emp_id",
      type: "INTEGER",
      constraint: "FK",
      desc: "起案者ID（Employees参照）",
    },
    {
      name: "status_code",
      type: "VARCHAR(10)",
      constraint: "FK",
      desc: "現在の伝票状態（Common_Codes参照）",
    },
    {
      name: "slip_type",
      type: "VARCHAR(10)",
      constraint: "NOT NULL",
      desc: "伝票区分（購買・出庫）",
    },
    {
      name: "from_loc_id",
      type: "INTEGER",
      constraint: "-",
      desc: "出発地拠点ID",
    },
    {
      name: "to_loc_id",
      type: "INTEGER",
      constraint: "-",
      desc: "到着地拠点ID",
    },
    {
      name: "total_amount",
      type: "NUMERIC(18,2)",
      constraint: "-",
      desc: "伝票合計金額",
    },
    {
      name: "remarks",
      type: "TEXT",
      constraint: "-",
      desc: "備考（特記事項）",
    },
    {
      name: "is_printed1",
      type: "INTEGER",
      constraint: "DEFAULT 0",
      desc: "書類出力状況 0(請求書未出力) 1(請求書出力済)",
    },
    {
      name: "is_printed2",
      type: "INTEGER",
      constraint: "DEFAULT 2",
      desc: "書類出力状況 2(発注書未出力) 3(発注書出力済)",
    },
    {
      name: "partner_id",
      type: "INTEGER",
      constraint: "FK",
      desc: "取引先ID（取引先マスタ参照）",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "起案者ID（Employees参照）",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  tran_detail_history: [
    {
      name: "detail_id",
      type: "SERIAL",
      constraint: "PK",
      desc: "明細行固有番号",
    },
    {
      name: "slip_no",
      type: "VARCHAR(20)",
      constraint: "FK",
      desc: "親伝票番号（Headers参照）",
    },
    {
      name: "item_id",
      type: "INTEGER",
      constraint: "NOT NULL",
      desc: "品目ID",
    },
    {
      name: "order_qty",
      type: "NUMERIC(12,2)",
      constraint: "-",
      desc: "発注（申請）数量",
    },
    {
      name: "inbound_qty",
      type: "NUMERIC(12,2)",
      constraint: "-",
      desc: "実入庫数量",
    },
    {
      name: "unit_price",
      type: "NUMERIC(18,2)",
      constraint: "-",
      desc: "単価",
    },
    {
      name: "supply_amount",
      type: "NUMERIC(18,2)",
      constraint: "-",
      desc: "供給価額（数量×単価）",
    },
    {
      name: "lot_no",
      type: "VARCHAR(30)",
      constraint: "-",
      desc: "半導体部品LOT番号",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "起案者ID（Employees参照）",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  stock_spec_history: [
    {
      name: "receiving_id",
      type: "SERIAL",
      constraint: "PK",
      desc: "入庫明細固有番号",
    },
    {
      name: "slip_no",
      type: "VARCHAR(20)",
      constraint: "FK (slip_headers)",
      desc: "元伝票番号",
    },
    {
      name: "detail_id",
      type: "INTEGER",
      constraint: "FK (slip_details)",
      desc: "伝票明細行参照",
    },
    {
      name: "receive_date",
      type: "DATE",
      constraint: "NOT NULL",
      desc: "実入庫日",
    },
    {
      name: "receive_qty",
      type: "NUMERIC(12,2)",
      constraint: "NOT NULL",
      desc: "今回入庫数量",
    },
    {
      name: "receive_amount",
      type: "NUMERIC(18,2)",
      constraint: "-",
      desc: "今回入庫金額（数量×単価）",
    },
    {
      name: "lot_no",
      type: "VARCHAR(30)",
      constraint: "-",
      desc: "入庫LOT番号（バッチ別追跡用）",
    },
    {
      name: "loc_id",
      type: "INTEGER",
      constraint: "FK (locations)",
      desc: "入庫拠点ID",
    },
    {
      name: "inspect_note",
      type: "VARCHAR(255)",
      constraint: "-",
      desc: "入庫時特記事項（外観損傷等）",
    },
    {
      name: "proc_emp_id",
      type: "INTEGER",
      constraint: "FK (employees)",
      desc: "入庫処理者ID",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "起案者ID（Employees参照）",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  workflow: [
    {
      name: "wf_id",
      type: "SERIAL",
      constraint: "PK",
      desc: "ワークフロー記録ID",
    },
    {
      name: "slip_no",
      type: "VARCHAR(20)",
      constraint: "FK",
      desc: "対象伝票番号",
    },
    {
      name: "proc_emp_id",
      type: "INTEGER",
      constraint: "FK",
      desc: "処理者ID（Employees参照）",
    },
    {
      name: "proc_status",
      type: "VARCHAR(10)",
      constraint: "NOT NULL",
      desc: "処理状態（承認、差戻、否認等）",
    },
    {
      name: "proc_comment",
      type: "TEXT",
      constraint: "-",
      desc: "差戻理由または承認意見",
    },
    {
      name: "proc_at",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "処理日時",
    },
    {
      name: "step_no",
      type: "INTEGER",
      constraint: "-",
      desc: "決裁順序（1次、2次等）",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  bom_spec: [
    { name: "bom_id", type: "SERIAL", constraint: "PK", desc: "BOM行固有番号" },
    {
      name: "parent_item_id",
      type: "INTEGER",
      constraint: "FK (items)",
      desc: "産出品目（半製品/完成品）",
    },
    {
      name: "child_item_id",
      type: "INTEGER",
      constraint: "FK (items)",
      desc: "投入品目（原材料/半製品）",
    },
    {
      name: "required_qty",
      type: "NUMERIC(12,4)",
      constraint: "NOT NULL",
      desc: "1単位生産時の必要数量",
    },
    {
      name: "loss_rate",
      type: "NUMERIC(5,2)",
      constraint: "DEFAULT 0",
      desc: "ロス率（%）",
    },
    {
      name: "sort_order",
      type: "INTEGER",
      constraint: "-",
      desc: "投入順序（工程順序）",
    },
    {
      name: "is_active",
      type: "BOOLEAN",
      constraint: "DEFAULT TRUE",
      desc: "使用可否",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  account_entry: [
    {
      name: "journal_id",
      type: "SERIAL",
      constraint: "PK",
      desc: "仕訳固有番号",
    },
    {
      name: "slip_no",
      type: "VARCHAR(20)",
      constraint: "FK",
      desc: "元受払伝票番号",
    },
    {
      name: "shiwake_code",
      type: "VARCHAR(1)",
      constraint: "NOT NULL",
      desc: "借方(0) 貸方(1) その他(9)",
    },
    {
      name: "account_code",
      type: "VARCHAR(10)",
      constraint: "NOT NULL",
      desc: "勘定科目コード",
    },
    {
      name: "amount",
      type: "NUMERIC(18,2)",
      constraint: "DEFAULT 0",
      desc: "金額",
    },
    {
      name: "entry_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "仕訳発生日時",
    },
    {
      name: "description",
      type: "VARCHAR(255)",
      constraint: "-",
      desc: "摘要（内容要約）",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  item_mst: [
    { name: "item_id", type: "SERIAL", constraint: "PK", desc: "品目固有番号" },
    {
      name: "item_code",
      type: "VARCHAR(20)",
      constraint: "UNIQUE",
      desc: "品目コード（例：SEMI-CHAMBER-01）",
    },
    {
      name: "item_name",
      type: "VARCHAR(100)",
      constraint: "NOT NULL",
      desc: "品目名称",
    },
    {
      name: "item_type",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "分類（RAW, SEMI, FIN）",
    },
    {
      name: "spec",
      type: "VARCHAR(100)",
      constraint: "-",
      desc: "詳細規格・仕様",
    },
    {
      name: "unit",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "管理単位（EA, SET, KG）",
    },
    {
      name: "std_price",
      type: "NUMERIC(18,2)",
      constraint: "-",
      desc: "標準単価（原価計算用）",
    },
    {
      name: "plan_qty",
      type: "NUMERIC(12,2)",
      constraint: "DEFAULT 0",
      desc: "予定在庫（見積～入庫前段階）",
    },
    {
      name: "stock_qty",
      type: "NUMERIC(12,2)",
      constraint: "DEFAULT 0",
      desc: "実在庫（検収完了済の実数量）",
    },
    {
      name: "acct_code",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "基本勘定コード（1101：原材料等）",
    },
    {
      name: "safety_stock",
      type: "NUMERIC(12,2)",
      constraint: "DEFAULT 0",
      desc: "安全在庫量（発注点管理用）",
    },
    {
      name: "is_active",
      type: "BOOLEAN",
      constraint: "DEFAULT TRUE",
      desc: "使用可否（廃番品目処理）",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  warehouse_mst: [
    { name: "loc_id", type: "SERIAL", constraint: "PK", desc: "拠点固有番号" },
    {
      name: "loc_name",
      type: "VARCHAR(50)",
      constraint: "NOT NULL",
      desc: "拠点名称（例：本社倉庫、渋谷店舗）",
    },
    {
      name: "loc_type",
      type: "VARCHAR(10)",
      constraint: "NOT NULL",
      desc: "拠点類型（FACTORY, STORE, TRANSIT, VENDOR）",
    },
    {
      name: "postal_code",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "郵便番号（日本7桁〒対応）",
    },
    {
      name: "address",
      type: "VARCHAR(255)",
      constraint: "-",
      desc: "住所情報",
    },
    {
      name: "contact_info",
      type: "VARCHAR(50)",
      constraint: "-",
      desc: "担当者連絡先（電話番号等）",
    },
    {
      name: "is_active",
      type: "BOOLEAN",
      constraint: "DEFAULT TRUE",
      desc: "使用可否（無効時は選択不可）",
    },
    {
      name: "remarks",
      type: "TEXT",
      constraint: "-",
      desc: "備考（拠点特記事項記録）",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  customer_mst: [
    {
      name: "partner_id",
      type: "SERIAL",
      constraint: "PK",
      desc: "取引先固有番号",
    },
    {
      name: "partner_code",
      type: "VARCHAR(20)",
      constraint: "UNIQUE",
      desc: "取引先コード",
    },
    {
      name: "partner_name",
      type: "VARCHAR(100)",
      constraint: "NOT NULL",
      desc: "取引先名称",
    },
    {
      name: "partner_type",
      type: "VARCHAR(10)",
      constraint: "NOT NULL",
      desc: "区分（SUPPLIER：仕入先、CUSTOMER：得意先、BOTH：兼用）",
    },
    {
      name: "postal_code",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "郵便番号",
    },
    { name: "address", type: "VARCHAR(255)", constraint: "-", desc: "住所" },
    {
      name: "contact_name",
      type: "VARCHAR(50)",
      constraint: "-",
      desc: "担当者氏名",
    },
    {
      name: "contact_tel",
      type: "VARCHAR(20)",
      constraint: "-",
      desc: "連絡先",
    },
    {
      name: "bank_info",
      type: "VARCHAR(255)",
      constraint: "-",
      desc: "銀行口座情報（請求書出力用）",
    },
    {
      name: "is_active",
      type: "BOOLEAN",
      constraint: "DEFAULT TRUE",
      desc: "使用可否",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  emp_mst: [
    { name: "emp_id", type: "SERIAL", constraint: "PK", desc: "社員固有番号" },
    {
      name: "login_id",
      type: "VARCHAR(20)",
      constraint: "UNIQUE",
      desc: "ログインID",
    },
    {
      name: "password",
      type: "VARCHAR(255)",
      constraint: "NOT NULL",
      desc: "暗号化パスワード",
    },
    {
      name: "emp_name",
      type: "VARCHAR(50)",
      constraint: "NOT NULL",
      desc: "氏名",
    },
    {
      name: "dept_code",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "部署コード",
    },
    {
      name: "role_type",
      type: "VARCHAR(10)",
      constraint: "-",
      desc: "権限（APPROVER, PROD, INSP）",
    },
    {
      name: "is_active",
      type: "BOOLEAN",
      constraint: "DEFAULT TRUE",
      desc: "在職可否",
    },
    {
      name: "email",
      type: "VARCHAR(100)",
      constraint: "-",
      desc: "メールアドレス（通知受信用）",
    },
    {
      name: "remarks",
      type: "TEXT",
      constraint: "-",
      desc: "備考（特記事項記録）",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
  general_mst: [
    {
      name: "code_id",
      type: "VARCHAR(10)",
      constraint: "PK",
      desc: "コードID",
    },
    {
      name: "group_code",
      type: "VARCHAR(20)",
      constraint: "NOT NULL",
      desc: "グループ分類",
    },
    { name: "code_name", type: "VARCHAR(50)", constraint: "-", desc: "名称" },
    { name: "sort_order", type: "INTEGER", constraint: "-", desc: "表示順序" },
    {
      name: "is_use",
      type: "BOOLEAN",
      constraint: "DEFAULT TRUE",
      desc: "使用可否",
    },
    {
      name: "create_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "登録日時",
    },
    {
      name: "create_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
    {
      name: "update_date",
      type: "TIMESTAMP",
      constraint: "DEFAULT NOW()",
      desc: "更新日時（初回登録時は登録日時）",
    },
    {
      name: "update_user",
      type: "INTEGER",
      constraint: "-",
      desc: "ログインユーザー",
    },
  ],
};

const tableList = [
  { name: "tran_history", desc: "受払履歴（伝票基本情報）" },
  { name: "tran_detail_history", desc: "受払明細（伝票内明細品目）" },
  { name: "stock_spec_history", desc: "入庫明細（分納入庫履歴）" },
  { name: "workflow", desc: "ワークフロー（伝票別承認）" },
  { name: "bom_spec", desc: "BOM（部品構成表）" },
  { name: "account_entry", desc: "会計仕訳" },
  { name: "item_mst", desc: "品目マスタ" },
  { name: "warehouse_mst", desc: "倉庫拠点マスタ" },
  { name: "customer_mst", desc: "取引先マスタ" },
  { name: "emp_mst", desc: "社員マスタ" },
  { name: "general_mst", desc: "汎用マスタ" },
];

const SectionTitle = ({
  icon: Icon,
  children,
}: {
  icon: React.ElementType;
  children: React.ReactNode;
}) => (
  <div className="flex items-center gap-2.5 mb-4">
    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
      <Icon className="w-4 h-4 text-primary" />
    </div>
    <h2 className="text-lg font-semibold text-foreground">{children}</h2>
  </div>
);

const CompanyIntro = () => {
  const navigate = useNavigate();
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [navigateTarget, setNavigateTarget] = useState<{
    title: string;
    path: string;
  } | null>(null);

  return (
    <ERPLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border border-border p-8">
          <div className="absolute top-4 right-4 opacity-10">
            <Cpu className="w-32 h-32 text-primary" />
          </div>
          <div className="relative z-10">
            <Badge
              variant="outline"
              className="mb-3 text-[10px] tracking-widest uppercase border-primary/30 text-primary"
            >
              Enterprise Resource Planning
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground mb-2">
              S-PRIME ERP
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              <strong>S</strong>emiconductor <strong>P</strong>recision{" "}
              <strong>R</strong>esource & <strong>I</strong>nventory{" "}
              <strong>M</strong>anagement <strong>E</strong>RP
            </p>
            <Separator className="my-4" />
            <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
              半導体精密部品および装置製造業の特性を反映し、
              <strong className="text-foreground">
                購買依頼から検収、製品の出庫から売上確定までを管理
              </strong>
              するフロントエンド専用デモです。
              二段階承認と処理履歴を通じて、担当者ごとの業務の流れを体験できます。入力した伝票やマスタはブラウザに保存され、再読込後も引き続き利用できます。
            </p>
          </div>
        </div>

        {/* Developer Profile */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">開発者紹介</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <p className="text-xs text-muted-foreground leading-relaxed">
              本システムを開発したエンジニアのプロフィールをご紹介しています。
            </p>
            <Button
              asChild
              size="sm"
              className="self-start sm:self-auto flex-shrink-0"
            >
              <a
                href="https://dev-showcase-kim.netlify.app"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="開発者紹介サイト（新しいタブで開きます）"
              >
                <ExternalLink />
                開発者紹介サイトを見る
              </a>
            </Button>
          </CardContent>
        </Card>

        {/* Tech Stack */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Layers}>技術スタック</SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {techStack.map((t) => (
                <div
                  key={t.label}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50 border border-border/50"
                >
                  <t.icon className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-medium text-foreground">
                      {t.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t.value}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Design System */}
        <Card
          className="cursor-pointer hover:border-primary/50 transition-colors"
          onClick={() =>
            setNavigateTarget({
              title: "デザインシステム",
              path: "/design-system",
            })
          }
        >
          <CardHeader className="pb-3">
            <SectionTitle icon={Layers}>デザインシステム</SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-4 p-4 rounded-lg bg-secondary/30 border border-border/50">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Layers className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground mb-1">
                  UIコンポーネントおよびスタイルガイド
                </p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  カラーパレット、タイポグラフィ、ボタン・バッジ・カードなどの共通UIコンポーネント、ステータスバッジの使用規則など、S-PRIME
                  ERPで使用する全デザイン要素をまとめたガイドです。
                </p>
                <Badge
                  variant="outline"
                  className="mt-2 text-[10px] border-primary/30 text-primary"
                >
                  ガイドを見る →
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Core Features */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={TrendingUp}>主要機能要件</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              {
                icon: Factory,
                title: "購買・分納入庫",
                items: [
                  "購買依頼を二段階で承認し、見積・発注・分納入庫・検収まで管理します。",
                  "入荷ごとに数量とLOT番号を記録し、処理の履歴を残します。",
                ],
              },
              {
                icon: Package,
                title: "物流および出庫管理",
                items: [
                  "出庫依頼の承認後、配送開始から出庫完了・売上確定まで管理します。",
                  "配送開始時に全品目のLOT番号を記録します。",
                ],
              },
              {
                icon: BarChart3,
                title: "ダッシュボード・帳票",
                items: [
                  "ダッシュボードと通知には、伝票の進行状況と現在のロールで必要な対応を表示します。",
                  "財務諸表・請求書・発注書はサンプルデータのデモ表示とPDF出力に対応しています。",
                ],
              },
            ].map((section) => (
              <div
                key={section.title}
                className="p-4 rounded-lg border border-border/50 bg-secondary/30"
              >
                <div className="flex items-center gap-2 mb-2">
                  <section.icon className="w-4 h-4 text-primary" />
                  <h3 className="text-sm font-semibold text-foreground">
                    {section.title}
                  </h3>
                </div>
                <ul className="space-y-1.5 ml-6">
                  {section.items.map((item, i) => (
                    <li
                      key={i}
                      className="text-xs text-muted-foreground list-disc leading-relaxed"
                    >
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Business Workflow */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Workflow}>ビジネスワークフロー</SectionTitle>
          </CardHeader>
          <CardContent>
            <Accordion
              type="multiple"
              defaultValue={["step1", "step2", "step3", "step4"]}
              className="w-full"
            >
              <AccordionItem value="step1">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      1
                    </Badge>
                    購買依頼から検収まで
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground space-y-1.5 pl-8">
                  <p className="leading-relaxed">
                    申請者が購買依頼を起票・申請すると、一次承認者・最終承認者の2段階で承認されます。承認後は購買担当が見積・発注を行い、入荷のたびに数量とLOT番号を分納入庫として記録します。全数量がそろうと入庫完了となり、検収担当の検収をもって完了します。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step2">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      2
                    </Badge>
                    差戻しと否認
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground space-y-1.5 pl-8">
                  <p className="leading-relaxed">
                    承認後、発注確定までに内容の見直しが必要な場合、購買担当は理由を添えて差し戻せます。起票者は同じ伝票番号のまま内容を修正して再申請でき、それまでの履歴はすべて残ります。一方、承認者による否認は最終判断のため、その伝票は再申請できません。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step3">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      3
                    </Badge>
                    出庫から売上確定まで
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground space-y-1.5 pl-8">
                  <p className="leading-relaxed">
                    出庫依頼も同じ2段階承認を経て、出庫担当が配送開始（LOT番号を記録）、出庫完了、売上確定まで処理します。承認後に問題があれば出庫担当が差し戻し、起票者が修正して再申請します。
                  </p>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="step4">
                <AccordionTrigger className="text-sm hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      4
                    </Badge>
                    デモ用ロール切替
                  </div>
                </AccordionTrigger>
                <AccordionContent className="text-xs text-muted-foreground pl-8">
                  <p className="leading-relaxed">
                    画面上部の「デモ用ロール切替」で操作者を切り替えると、申請から検収・売上確定までの全工程を一人で体験できます。ダッシュボードには、現在のロールで対応が必要な伝票が表示されます。
                  </p>

                  <div className="overflow-x-auto mt-4 rounded-lg border border-border">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-secondary/50">
                          <TableHead className="text-xs whitespace-nowrap">
                            ロール
                          </TableHead>
                          <TableHead className="text-xs whitespace-nowrap">
                            担当者
                          </TableHead>
                          <TableHead className="text-xs">主な操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <TableRow>
                          <TableCell className="text-xs whitespace-nowrap">
                            申請者
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            キム ヨンジョン
                          </TableCell>
                          <TableCell className="text-xs">
                            購買・出庫依頼の起票と申請、差戻し後の修正・再申請
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs whitespace-nowrap">
                            一次承認者
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            鈴木 花子
                          </TableCell>
                          <TableCell className="text-xs">
                            一次承認・否認
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs whitespace-nowrap">
                            最終承認者
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            佐藤 健一
                          </TableCell>
                          <TableCell className="text-xs">
                            最終承認・否認
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs whitespace-nowrap">
                            購買担当
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            山田 裕子
                          </TableCell>
                          <TableCell className="text-xs">
                            見積、発注、分納入庫、入庫完了、差戻し
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs whitespace-nowrap">
                            検収担当
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            渡辺 涼介
                          </TableCell>
                          <TableCell className="text-xs">検収</TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell className="text-xs whitespace-nowrap">
                            出庫担当
                          </TableCell>
                          <TableCell className="text-xs whitespace-nowrap">
                            伊藤 真一
                          </TableCell>
                          <TableCell className="text-xs">
                            配送開始、出庫完了、売上確定、差戻し
                          </TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>
                  <p className="mt-3 leading-relaxed">
                    デモ用ロールは業務の流れを体験するためのもので、本番の認証・権限管理とは異なります。
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </CardContent>
        </Card>

        {/* Status Codes */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Shield}>伝票ステータスコード定義</SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-[11px] font-semibold w-20">
                      区分
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold w-24">
                      コード
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold w-32">
                      ステータス (EN)
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold w-32">
                      ステータス (JP)
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold">
                      ビジネス定義
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold w-36">
                      担当者
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {statusCodes.map((s) => (
                    <TableRow key={s.code}>
                      <TableCell className="text-[11px]">
                        <Badge
                          variant="outline"
                          className="text-[9px] font-mono"
                        >
                          {s.group}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-mono font-semibold text-primary">
                        {s.code}
                      </TableCell>
                      <TableCell className="text-[11px]">{s.nameEn}</TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {s.nameJp}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {s.desc}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {s.role}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Account Codes */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={FileText}>
              会計勘定科目（今後の拡張）
            </SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-[11px] font-semibold w-24">
                      区分
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold w-40">
                      勘定科目
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold w-24">
                      コード
                    </TableHead>
                    <TableHead className="text-[11px] font-semibold">
                      説明
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {accountCodes.map((a) => (
                    <TableRow key={a.code}>
                      <TableCell className="text-[11px]">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            a.category === "資産"
                              ? "border-primary/30 text-primary"
                              : a.category === "負債"
                                ? "border-destructive/30 text-destructive"
                                : a.category === "収益"
                                  ? "border-success/30 text-success"
                                  : "border-warning/30 text-warning"
                          }`}
                        >
                          {a.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] font-medium">
                        {a.name}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-primary">
                        {a.code}
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {a.desc}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* DB Architecture */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={Database}>本番設計（今後の拡張）</SectionTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-4 rounded-lg border border-border/50 bg-secondary/30">
              <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary" />
                トランザクション整合性
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                今後の拡張として、検収や売上確定に伴う数量・履歴・会計仕訳をまとめて更新する設計を想定しています。以下のテーブルは本番向けの設計資料であり、現在のデモの保存先ではありません。
              </p>
            </div>
            <div className="p-4 rounded-lg border border-border/50 bg-secondary/30">
              <h3 className="text-sm font-semibold text-foreground mb-1.5 flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-primary" />
                Concurrency Control
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed">
                今後の拡張として、複数の担当者が同時に処理しても在庫数量の整合性を保てるよう、更新時の競合制御を設計します。
              </p>
            </div>

            {/* Table list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
              {tableList.map((t) => (
                <button
                  key={t.name}
                  onClick={() => setSelectedTable(t.name)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-muted/50 border border-border/30 hover:bg-primary/10 hover:border-primary/30 transition-colors text-left cursor-pointer"
                >
                  <Database className="w-3 h-3 text-primary flex-shrink-0" />
                  <span className="text-[11px] font-mono text-primary">
                    {t.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    — {t.desc}
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Screen Definitions */}
        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={BookOpen}>画面定義</SectionTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: "8.0",
                  title: "全体ダッシュボード",
                  desc: "承認待ちや購買・出庫の進行状況、未処理タスク、安全在庫割れを確認",
                  path: "/",
                },
                {
                  id: "8.1",
                  title: "伝票一覧",
                  desc: "購買・出庫に関する全伝票を横断的に検索・照会",
                  path: "/production/slips",
                },
                {
                  id: "8.2",
                  title: "原材料・半製品購買",
                  desc: "購買依頼から分納入庫・検収までの進行状況と履歴を管理",
                  path: "/production/execution",
                },
                {
                  id: "8.3",
                  title: "出庫管理",
                  desc: "製品の出庫依頼から売上確定までを管理",
                  path: "/production/shipping",
                },
                {
                  id: "8.4",
                  title: "財務諸表",
                  desc: "B/S、P/L照会およびPDF出力",
                  path: "/documents/finance",
                },
                {
                  id: "8.5",
                  title: "BOM生産伝票",
                  desc: "部品構成と必要数量をサンプルデータで確認",
                  path: "/documents/bom",
                },
                {
                  id: "8.6",
                  title: "請求書・発注書",
                  desc: "発注書（PO）、請求書（Invoice）照会およびPDF出力",
                  path: "/documents/invoice",
                },
                {
                  id: "8.7",
                  title: "社員マスタ",
                  desc: "社員の登録・修正・削除と職務区分の管理",
                  path: "/master/employee",
                },
                {
                  id: "8.8",
                  title: "品目マスタ",
                  desc: "原材料/半製品/完成品の登録・修正・削除",
                  path: "/master/item",
                },
                {
                  id: "8.9",
                  title: "倉庫拠点マスタ",
                  desc: "倉庫、拠点の登録・修正・削除",
                  path: "/master/warehouse",
                },
              ].map((screen) => (
                <div
                  key={screen.id}
                  onClick={() =>
                    setNavigateTarget({
                      title: screen.title,
                      path: screen.path,
                    })
                  }
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-secondary/30 hover:bg-primary/10 hover:border-primary/30 transition-colors cursor-pointer"
                >
                  <Badge
                    variant="outline"
                    className="text-[10px] font-mono mt-0.5 flex-shrink-0"
                  >
                    {screen.id}
                  </Badge>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {screen.title}
                      {["財務諸表", "BOM生産伝票", "請求書・発注書"].includes(
                        screen.title,
                      ) && (
                        <Badge variant="outline" className="ml-2 text-[10px]">
                          デモ表示
                        </Badge>
                      )}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {screen.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionTitle icon={TrendingUp}>今後の拡張</SectionTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1.5 ml-6 text-xs text-muted-foreground list-disc leading-relaxed">
              <li>在庫数量・会計仕訳の自動連動</li>
              <li>在庫調整</li>
              <li>帳票・財務諸表と伝票の連動</li>
              <li>BOM伝票の保存</li>
            </ul>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-6">
          <p className="text-[11px] text-muted-foreground">
            © {new Date().getFullYear()} S-Prime Corp. —
            半導体精密機器製造および統合在庫管理システム
            <span aria-hidden="true" className="mx-1.5">
              ·
            </span>
            <a
              href="https://dev-showcase-kim.netlify.app"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="開発者紹介サイト（新しいタブで開きます）"
              className="text-primary underline underline-offset-4 hover:text-primary/80"
            >
              開発者紹介
            </a>
          </p>
        </div>
      </div>

      {/* Table Schema Modal */}
      <Dialog
        open={!!selectedTable}
        onOpenChange={(open) => !open && setSelectedTable(null)}
      >
        <DialogContent
          aria-describedby={undefined}
          className="sm:max-w-2xl max-h-[80vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="text-sm font-mono flex items-center gap-2">
              <Database className="w-4 h-4 text-primary" />
              {selectedTable}
              <Badge variant="outline" className="text-[9px] ml-1">
                {tableList.find((t) => t.name === selectedTable)?.desc}
              </Badge>
            </DialogTitle>
          </DialogHeader>
          {selectedTable && tableSchemas[selectedTable] && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/50">
                    <TableHead className="text-[10px] font-semibold">
                      カラム名
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold">
                      データ型
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold">
                      制約
                    </TableHead>
                    <TableHead className="text-[10px] font-semibold">
                      説明
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tableSchemas[selectedTable].map((col) => (
                    <TableRow key={col.name}>
                      <TableCell className="text-[11px] font-mono text-primary font-medium">
                        {col.name}
                      </TableCell>
                      <TableCell className="text-[11px] font-mono text-muted-foreground">
                        {col.type}
                      </TableCell>
                      <TableCell className="text-[11px]">
                        <Badge
                          variant="outline"
                          className={`text-[9px] ${
                            col.constraint === "PK"
                              ? "border-primary/40 text-primary"
                              : col.constraint.startsWith("FK")
                                ? "border-warning/40 text-warning"
                                : col.constraint === "NOT NULL"
                                  ? "border-destructive/40 text-destructive"
                                  : "text-muted-foreground"
                          }`}
                        >
                          {col.constraint}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[11px] text-muted-foreground">
                        {col.desc}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Navigate Confirm Dialog */}
      <Dialog
        open={!!navigateTarget}
        onOpenChange={(open) => !open && setNavigateTarget(null)}
      >
        <DialogContent aria-describedby={undefined} className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              該当画面に遷移しますか？
            </DialogTitle>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">{navigateTarget?.title}</strong>{" "}
            画面に遷移します。
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setNavigateTarget(null)}
            >
              キャンセル
            </Button>
            <Button
              size="sm"
              onClick={() => {
                if (navigateTarget) navigate(navigateTarget.path);
                setNavigateTarget(null);
              }}
            >
              遷移
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ERPLayout>
  );
};

export default CompanyIntro;
