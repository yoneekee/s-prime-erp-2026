# 半導体精密機器製造および統合在庫管理システム（S-PRIME ERP）

**S-PRIME ERP : S**emiconductor **P**recision **R**esource & **I**nventory **M**anagement **E**RP

---

# 1. プロジェクト概要

本プロジェクトは、半導体精密部品および装置製造業の特性を反映し、**原材料の調達からBOM（Bill of Materials）に基づく生産、そして最終製品の出庫に至る全工程を統合管理する**Enterprise Resource Planning（ERP）システムである。伝票ベースの承認プロセスによる業務統制、リアルタイムの受払（Inventory Flow）追跡、およびビジネストランザクションと会計仕訳の自動連動によるデータ整合性の確保を目的とする。

---

# デモ版の実装範囲

フロントエンド専用デモ。伝票は `src/services/mock-store.ts` の `slipStore.add / transition / update`、マスタは専用ストア経由でlocalStorageに保存する。伝票更新は300–500 msの擬似待機後、保存成功を確認してから画面へ通知する。ヘッダー・明細は保存時のスナップショットで、金額・件数はストアで算出する。「デモデータ初期化」でシードに戻る。

`src/lib/workflow.ts` の `canExecute / applyTransition / getFlowSteps` が遷移ルールの唯一の定義元で、操作ボタンと `src/lib/dashboard.ts` の現在のロール別未処理タスクもこの定義から生成する。デモ用ロールは実際のセキュリティ権限管理ではない。氏名・部署は社員マスタからempIdで解決する。取引先・顧客は架空のデモ会社で、取引先は読取専用シード。

`src/services/*.service.ts`、`src/types`、`src/hooks/api` は今後のC# Web API連携用で、デモからは使用しない。環境変数の変更だけではデモ画面を実APIに切り替えられない。

任意の空でないID・パスワードでログインし、ヘッダーの「デモ用ロール切替」を使用します。

申請者 キム ヨンジョン · 一次承認者 鈴木 花子 · 最終承認者 佐藤 健一 · 購買担当 山田 裕子 · 検収担当 渡辺 涼介 · 出庫担当 伊藤 真一

社員マスタに物流担当（LOG）の権限種別を追加済み。Vitestの対象はワークフロールール・ストア動作・シード整合性です。

シード伝票の日付はデモデータ作成日を基準に相対生成し、最新の伝票は3日前となります。

全体ダッシュボードは伝票・品目マスタからKPI（承認待ち / 購買進行中 / 出庫進行中 / 安全在庫割れ）、現在のロール別未処理タスク、最近のワークフロー、伝票ステータス状況、安全在庫割れ警告を算出します。ヘッダー通知はワークフロー履歴から生成し、未読表示・「すべて既読」・伝票詳細への移動に対応します。

## 今後の拡張

- 検収完了・出庫完了による在庫増減、および会計仕訳。
- 在庫調整（T04）：未実装。デモのステータス・操作には含まない。
- 発注書・請求書・財務諸表と伝票の連動（現在はモック表示・PDF）。
- BOM伝票の永続化。
- C# / PostgreSQL連携と本番認証・権限管理。

# 本番設計（C# / PostgreSQL 想定）

以下の技術構成、機能要件、勘定・DBテーブルは今後の拡張にあたる本番設計です。3.1・5.1・8は現行デモの事実を別記します。DBテーブルはデモの保存構造ではありません。

# 2. 技術スタック

| 区分 | 技術 |
|------|------|
| **Frontend** | TypeScript, React（State Management: React Query / Context API） |
| **Backend** | C#（.NET Core）, Entity Framework Core |
| **Database** | PostgreSQL（Transaction Isolation Level: Read Committed） |
| **Tool** | Visual Studio Code, DBeaver |
| **Infrastructure** | Azure Cloud Services（App Service, Azure Database for PostgreSQL） |
| **Library** | Recharts, date-fns, shadcn/ui, Tailwind CSS, lucide-react |

---

# 3. コアマスターデータ定義

### 3.1 デモの伝票ステータスとワークフロー

| コード | 表示名 | 定義 |
|---|---|---|
| S00 | 作成中 | 作成中 |
| S01 | 申請中 | 申請中 |
| A00 | 承認中 | 一次承認済・最終承認待ち |
| A01 | 承認済 | 承認済 |
| A02 | 否認 | 終結・再申請不可 |
| P00 | 差戻中 | 差戻中 |
| P01 | 見積中 | 見積中 |
| P02 | 発注済 | 発注済 |
| P03 | 分納中 | 分納中 |
| P04 | 入庫済 | 入庫済 |
| I00 | 検収済 | 検収済 |
| T00 | 差戻中 | 差戻中 |
| T01 | 積送中 | 積送中 |
| T02 | 出庫済 | 出庫済 |
| T03 | 売上確定 | 売上確定 |

T04 在庫調整は今後の拡張で、デモには存在しません。状態変更による在庫・仕訳連動は未実装です。

---

# 4. 主要機能要件（Functional Requirements）

### 4.1 購買および製造実行（Procurement & Manufacturing）

- **BOM基盤自動展開:** 完成品の生産計画策定時に下位部品リストを自動抽出し、過不足状況を可視化。
- **分納管理（Partial Delivery）:** 分納時には `stock_spec_history` に入庫履歴のみ蓄積し管理効率を向上。最終入庫完了（`P04`）時点で累積数量を合算し、買掛金確定仕訳を実行。

### 4.2 物流および出庫管理（Logistics）

- **積送在庫（In-Transit）管理:** 倉庫を出たが売上として認識される前の段階にある「積送品」勘定を個別管理し、資産整合性を維持。
- **FIFO基盤LOT追跡:** 半導体部品の特性を考慮した先入先出基盤のLOT指定出庫機能を提供。

### 4.3 会計連動およびレポーティング（Accounting & Reporting）

- **自動仕訳エンジン:** 伝票ステータス変更（Trigger）に基づき、事前定義された勘定科目への仕訳データを自動生成。
- **財務諸表Export:** 貸借対照表（B/S）、損益計算書（P/L）を日本標準様式およびPDFで出力。

---

# 5. 機能要件定義

## 5.1 デモの段階別操作・データフロー

遷移は `src/lib/workflow.ts` のみに定義します。共通承認、購買、出庫の順に記載します。

| 操作 | 遷移 | 担当・条件 |
|---|---|---|
| 申請 | S00→S01 | 起票者本人・申請者 |
| 一次承認 | S01→A00 | 一次承認者 |
| 否認 | S01→A02 | 一次承認者・理由必須 |
| 最終承認 | A00→A01 | 最終承認者 |
| 否認 | A00→A02 | 最終承認者・理由必須 |
| 見積開始 | A01→P01 | 購買担当 |
| 差戻 | A01/P01→P00 | 購買担当・理由必須・発注確定前のみ |
| 修正開始 | P00→S00 | 起票者 |
| 発注確定 | P01→P02 | 購買担当 |
| 分納入庫 | P02/P03→P03 | 購買担当 |
| 入庫完了 | P03→P04 | 購買担当 |
| 検収完了 | P04→I00 | 検収担当 |
| 配送開始（積送） | A01→T01 | 出庫担当 |
| 差戻 | A01→T00 | 出庫担当・理由必須 |
| 修正開始 | T00→S00 | 起票者 |
| 出庫完了 | T01→T02 | 出庫担当 |
| 売上確定 | T02→T03 | 出庫担当 |

- 申請には明細1行以上と取引先が必要。出庫は倉庫も必須。
- 新規作成は申請者のみ。修正はS00の起票者本人のみ。
- 差戻後は「修正開始 → S00 → 修正 → 申請」。伝票番号と全履歴を保持し、承認をやり直す。
- 分納入庫は明細ごとに今回入庫数量を0～残数で入力し、入庫する行のLOT番号を必須とする。履歴に入庫品目を記録する。
- 入庫完了は全行の入庫累計が発注数量と一致した場合のみ。
- 配送開始は全明細行のLOT番号が必須。
- 履歴は最新順で「順番、処理状況、ステータス（変更前→変更後）、処理者、権限・職務、コメント、処理日時」を表示。

今後の拡張：見積時の予定在庫確保、発注・入庫・売上の仕訳、検収・出庫時の在庫増減。本番会計設計は5.2および6～7のテーブルを参照。

本番設計の仕訳例：発注 [借] 未着品 / [貸] 未払金、最終入庫 [借] 原材料 / [貸] 未着品 および [借] 未払金 / [貸] 買掛金、積送 [借] 積送品 / [貸] 完成品、売上 [借] 売掛金 / [貸] 売上高 および [借] 売上原価 / [貸] 積送品。すべて今後の拡張です。

---

## 5.2 会計勘定科目

| **区分** | **勘定科目名** | **コード** | **説明** |
|----------|----------------|------------|----------|
| **資産** | 原材料 | 1101 | 外部から購入した基礎部品および原材料 |
| | 半製品 | 1102 | 組立中のモジュールや加工された中間部品 |
| | 完成品 | 1103 | 最終検収が完了した販売用装置 |
| | 未着品 | 1104 | 発注後まだ倉庫に到着していない輸送中資産 |
| | 積送品 | 1105 | 顧客へ配送中だがまだ売上認識前の資産 |
| | 売掛金 | 1106 | 製品販売後まだ回収していない債権 |
| **負債** | 買掛金 | 2101 | 原材料入庫後まだ支払っていない債務 |
| | 未払金 | 2102 | 一般経費や発注段階で発生する一時的債務 |
| **収益** | 売上高 | 4101 | 装置販売およびサービス提供収益 |
| **費用** | 売上原価 | 5101 | 販売された製品の製造原価 |
| | 棚卸減耗損 | 5102 | 検収不合格や破損による在庫損失 |

---

# 6. データベース設計の要点（DB Architecture）

- **トランザクション無結性:** 検収終了（`I00`）および売上確定（`T03`）時、複数テーブル（数量、履歴、仕訳）の更新を単一トランザクションにまとめ、原子性（Atomicity）を保証。
- **Concurrency Control:** 在庫差引時に**悲観的ロック（Pessimistic Lock）**および `item_id` のソート順に従ったロック取得により、デッドロック（Deadlock）を防止しデータの正確性を確保。

---

# 7. テーブル定義書

### 7.1 受払履歴（伝票基本情報）テーブル

- テーブル名: `tran_history`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `slip_no` | VARCHAR(20) | PK | 伝票番号（形式例: SLP{yyyyMMdd}-001） |
| `slip_date` | DATE | NOT NULL | 伝票作成日 |
| `request_emp_id` | INTEGER | FK | 起案者ID（Employees参照） |
| `status_code` | VARCHAR(10) | FK | 現在の伝票状態（Common_Codes参照） |
| `slip_type` | VARCHAR(10) | NOT NULL | 伝票区分（PRODUCTION: 購買、SHIPMENT: 出庫） |
| `from_loc_id` | INTEGER | - | 出発地拠点ID |
| `to_loc_id` | INTEGER | - | 到着地拠点ID |
| `total_amount` | NUMERIC(18,2) | - | 伝票合計金額 |
| `remarks` | TEXT | - | 備考（特記事項） |
| `is_printed1` | INTEGER | DEFAULT 0 | 書類出力状況: 0（請求書未出力）、1（請求書出力済） |
| `is_printed2` | INTEGER | DEFAULT 2 | 書類出力状況: 2（発注書未出力）、3（発注書出力済） |
| `partner_id` | INTEGER | FK | 取引先ID（取引先マスタ参照） |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | 起案者ID（Employees参照） |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.2 受払明細（伝票内明細品目）テーブル

- テーブル名: `tran_detail_history`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `detail_id` | SERIAL | PK | 明細行固有番号 |
| `slip_no` | VARCHAR(20) | FK | 親伝票番号（Headers参照） |
| `item_id` | INTEGER | NOT NULL | 品目ID |
| `order_qty` | NUMERIC(12,2) | - | 発注（申請）数量 |
| `inbound_qty` | NUMERIC(12,2) | - | 実際入庫数量 |
| `unit_price` | NUMERIC(18,2) | - | 単価 |
| `supply_amount` | NUMERIC(18,2) | - | 供給価額（数量×単価） |
| `lot_no` | VARCHAR(30) | - | 半導体部品LOT番号 |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | 起案者ID（Employees参照） |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.3 入庫明細（分納入庫履歴）テーブル

- テーブル名: `stock_spec_history`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `receiving_id` | SERIAL | PK | 入庫明細固有番号 |
| `slip_no` | VARCHAR(20) | FK (slip_headers) | 元伝票番号 |
| `detail_id` | INTEGER | FK (slip_details) | 伝票明細行参照 |
| `receive_date` | DATE | NOT NULL | 実際入庫日 |
| `receive_qty` | NUMERIC(12,2) | NOT NULL | 今回入庫数量 |
| `receive_amount` | NUMERIC(18,2) | - | 今回入庫金額（数量×単価） |
| `lot_no` | VARCHAR(30) | - | 入庫LOT番号（バッチ別追跡用） |
| `loc_id` | INTEGER | FK (locations) | 入庫拠点ID |
| `inspect_note` | VARCHAR(255) | - | 入庫時の特記事項（外観損傷等） |
| `proc_emp_id` | INTEGER | FK (employees) | 入庫処理者ID |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | 起案者ID（Employees参照） |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.4 ワークフロー（伝票別承認）テーブル

- テーブル名: `workflow`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `wf_id` | SERIAL | PK | ワークフロー記録ID |
| `slip_no` | VARCHAR(20) | FK | 対象伝票番号 |
| `proc_emp_id` | INTEGER | FK | 処理者ID（Employees参照） |
| `proc_status` | VARCHAR(10) | NOT NULL | 処理状態（承認、差戻、否認等） |
| `proc_comment` | TEXT | - | 差戻事由または承認意見 |
| `proc_at` | TIMESTAMP | DEFAULT NOW() | 処理日時 |
| `step_no` | INTEGER | - | 決裁順序（1次、2次等） |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.5 BOMテーブル

- テーブル名: `bom_spec`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `bom_id` | SERIAL | PK | BOM行固有番号 |
| `parent_item_id` | INTEGER | FK (items) | 産出品目（半製品/完成品） |
| `child_item_id` | INTEGER | FK (items) | 投入品目（原材料/半製品） |
| `required_qty` | NUMERIC(12,4) | NOT NULL | 1単位生産時の必要数量 |
| `loss_rate` | NUMERIC(5,2) | DEFAULT 0 | ロス率（%） |
| `sort_order` | INTEGER | - | 投入順序（工程順序） |
| `is_active` | BOOLEAN | DEFAULT TRUE | 使用可否 |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.6 会計仕訳テーブル

- テーブル名: `account_entry`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `journal_id` | SERIAL | PK | 仕訳固有番号 |
| `slip_no` | VARCHAR(20) | FK | 元受払伝票番号 |
| `shiwake_code` | VARCHAR(1) | NOT NULL | 借方（0）、貸方（1）、その他（9） |
| `account_code` | VARCHAR(10) | NOT NULL | 勘定科目コード |
| `amount` | NUMERIC(18,2) | DEFAULT 0 | 金額 |
| `entry_date` | TIMESTAMP | DEFAULT NOW() | 仕訳発生日時 |
| `description` | VARCHAR(255) | - | 摘要（内容要約） |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.7 品目マスターテーブル

- テーブル名: `item_mst`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `item_id` | SERIAL | PK | 品目固有番号 |
| `item_code` | VARCHAR(20) | UNIQUE | 品目コード（例: SEMI-CHAMBER-01） |
| `item_name` | VARCHAR(100) | NOT NULL | 品目名称 |
| `item_type` | VARCHAR(10) | - | 分類（RAW, SEMI, FIN） |
| `spec` | VARCHAR(100) | - | 詳細規格・仕様 |
| `unit` | VARCHAR(10) | - | 管理単位（EA, SET, KG） |
| `std_price` | NUMERIC(18,2) | - | 標準単価（原価計算用） |
| `plan_qty` | NUMERIC(12,2) | DEFAULT 0 | **予定在庫**（見積～入庫前段階） |
| `stock_qty` | NUMERIC(12,2) | DEFAULT 0 | **実在庫**（検収完了済の実数量） |
| `acct_code` | VARCHAR(10) | - | 基本勘定コード（1101: 原材料等） |
| `safety_stock` | NUMERIC(12,2) | DEFAULT 0 | 安全在庫量（発注点管理用） |
| `is_active` | BOOLEAN | DEFAULT TRUE | 使用可否（廃番品目の管理） |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.8 倉庫拠点マスターテーブル

- テーブル名: `warehouse_mst`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `loc_id` | SERIAL | PK | 拠点固有番号 |
| `loc_name` | VARCHAR(50) | NOT NULL | 拠点名称（例: 本社倉庫、渋谷店舗） |
| `loc_type` | VARCHAR(10) | NOT NULL | 拠点類型（FACTORY, STORE, TRANSIT, VENDOR） |
| `postal_code` | VARCHAR(10) | - | 郵便番号（日本7桁〒対応） |
| `address` | VARCHAR(255) | - | 住所情報 |
| `contact_info` | VARCHAR(50) | - | 担当者連絡先（電話番号等） |
| `is_active` | BOOLEAN | DEFAULT TRUE | 使用可否（無効時は選択不可） |
| `remarks` | TEXT | - | 備考（拠点特記事項） |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.9 取引先マスターテーブル

- テーブル名: `customer_mst`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `partner_id` | SERIAL | PK | 取引先固有番号 |
| `partner_code` | VARCHAR(20) | UNIQUE | 取引先コード |
| `partner_name` | VARCHAR(100) | NOT NULL | 取引先名称 |
| `partner_type` | VARCHAR(10) | NOT NULL | 区分（SUPPLIER: 仕入先、CUSTOMER: 得意先、BOTH: 兼用） |
| `postal_code` | VARCHAR(10) | - | 郵便番号 |
| `address` | VARCHAR(255) | - | 住所 |
| `contact_name` | VARCHAR(50) | - | 担当者氏名 |
| `contact_tel` | VARCHAR(20) | - | 連絡先 |
| `bank_info` | VARCHAR(255) | - | 銀行口座情報（請求書出力用） |
| `is_active` | BOOLEAN | DEFAULT TRUE | 使用可否 |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.10 社員マスターテーブル

- テーブル名: `emp_mst`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `emp_id` | SERIAL | PK | 社員固有番号 |
| `login_id` | VARCHAR(20) | UNIQUE | ログインID |
| `password` | VARCHAR(255) | NOT NULL | 暗号化パスワード |
| `emp_name` | VARCHAR(50) | NOT NULL | 氏名 |
| `dept_code` | VARCHAR(10) | - | 部署コード |
| `role_type` | VARCHAR(10) | - | 権限（APPROVER, PROD, INSP） |
| `is_active` | BOOLEAN | DEFAULT TRUE | 在籍状況 |
| `email` | VARCHAR(100) | - | メールアドレス（通知受信用） |
| `remarks` | TEXT | - | 備考（特記事項） |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

### 7.11 汎用マスターテーブル

- テーブル名: `general_mst`

| **カラム名** | **データ型** | **制約** | **説明** |
|--------------|--------------|----------|----------|
| `code_id` | VARCHAR(10) | PK | コードID（例: S00） |
| `group_code` | VARCHAR(20) | NOT NULL | グループ分類 |
| `code_name` | VARCHAR(50) | - | 名称 |
| `sort_order` | INTEGER | - | 表示順序 |
| `is_use` | BOOLEAN | DEFAULT TRUE | 使用可否 |
| `create_date` | TIMESTAMP | DEFAULT NOW() | 登録日時 |
| `create_user` | INTEGER | - | ログインユーザー |
| `update_date` | TIMESTAMP | DEFAULT NOW() | 更新日時（初回登録時は登録日時と同一） |
| `update_user` | INTEGER | - | ログインユーザー |

---

# 8. 画面定義（現行デモ）

### 8.0 全体ダッシュボード

`/` — `src/pages/Index.tsx`

伝票・品目マスタからKPI（承認待ち / 購買進行中 / 出庫進行中 / 安全在庫割れ）、「あなたの未処理タスク」、「最近のワークフロー」、「伝票ステータス状況」、安全在庫割れ警告を算出します。タスクは現在のロールとワークフロールールに従います。ヘッダー通知は同じ履歴を参照し、未読・「すべて既読」・伝票詳細への移動に対応します。

### 8.1 伝票一覧

`/production/slips` — `src/pages/SlipListPage.tsx`

購買（PROD）・出庫（SHIP）の検索、ステータス表示、詳細画面への遷移。データはslipStoreから取得する。



### 8.2 原材料・半製品購買

`/production/execution` — `src/pages/ProductionExecution.tsx`

起票から検収までの状態、保存済みヘッダー・明細、入庫累計、LOT、全履歴を表示。操作は5.1の遷移定義に従う。



### 8.3 出庫管理

`/production/shipping` — `src/pages/ShipmentManagement.tsx`

製品の出庫依頼から売上確定までを管理します。配送開始時に全行のLOT番号を入力する。



### 8.4 財務諸表照会

`/documents/finance` — `src/pages/FinancialStatements.tsx`

モックデータ表示・PDF画面。今後の拡張：保存伝票・仕訳との連動。



### 8.5 BOM生産伝票

`/documents/bom` — `src/pages/BomProductionSlip.tsx`

モックBOM画面。今後の拡張：BOM伝票の永続化・在庫/会計連動。



### 8.6 請求書・発注書

`/documents/invoice` — `src/pages/InvoiceManagement.tsx`

モックデータ表示・PDF画面。今後の拡張：保存伝票・仕訳との連動。



### 8.7 社員マスタ

`/master/employee` — `src/pages/EmployeeMaster.tsx`

専用マスタストア経由で登録・修正・削除とlocalStorage保存。社員の権限種別には物流担当（LOG）を含む。



### 8.8 品目マスタ

`/master/item` — `src/pages/ItemMaster.tsx`

専用マスタストア経由で登録・修正・削除とlocalStorage保存。



### 8.9 倉庫拠点マスタ

`/master/warehouse` — `src/pages/WarehouseMaster.tsx`

専用マスタストア経由で登録・修正・削除とlocalStorage保存。



### 8.10 作成/修正画面

`/production/execution/new` — `ProductionSlipCreate.tsx`

`/production/shipping/new` — `ShipmentSlipCreate.tsx`

修正は各 `/new?slipNo=...` で行う。新規作成は申請者のみ、S00の修正は起票者本人のみ。


伝票番号の形式（登録日）：購買 `SLP{yyyyMMdd}-NNN`、出庫 `SHP{yyyyMMdd}-NNN`、BOM `BOM{yyyyMMdd}-NNN`。BOM伝票の永続化は今後の拡張です。
