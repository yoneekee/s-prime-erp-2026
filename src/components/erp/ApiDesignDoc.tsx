/** 会社紹介用のAPI連携設計。表示専用で、デモの業務処理は変更しない。 */
import type { ReactNode } from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

function DocTable({
  head,
  rows,
  monoCols = [],
  labelCols = [],
}: {
  head: string[];
  rows: string[][];
  monoCols?: number[];
  labelCols?: number[];
}) {
  return (
    <div className="my-3 max-w-full overflow-x-auto rounded-md border border-border/50">
      <Table className="min-w-[640px]">
        <TableHeader>
          <TableRow>
            {head.map((label) => (
              <TableHead
                key={label}
                className="h-9 whitespace-nowrap px-3 text-xs"
              >
                {label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={index}>
              {row.map((cell, column) => (
                <TableCell
                  key={column}
                  className={`px-3 py-2 align-top text-xs ${monoCols.includes(column) ? "font-mono text-primary" : labelCols.includes(column) ? "font-semibold text-foreground" : "text-muted-foreground"}`}
                >
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="my-3 max-w-full overflow-x-auto rounded-md border border-border/50 bg-muted/50 p-3 font-mono text-xs leading-relaxed text-foreground">
      <code>{children}</code>
    </pre>
  );
}

function Sub({ children }: { children: ReactNode }) {
  return (
    <h4 className="mt-5 text-xs font-semibold text-foreground first:mt-0">
      {children}
    </h4>
  );
}

function DesignLabel() {
  return (
    <Badge variant="outline" className="mb-3 border-primary text-primary">
      API設計（未実装）
    </Badge>
  );
}

const sections: { id: string; title: string; body: ReactNode }[] = [
  {
    id: "endpoints",
    title: "主要APIエンドポイント",
    body: (
      <>
        <DesignLabel />
        <p className="text-xs leading-relaxed text-muted-foreground">
          パスはAPIベースパスからの相対表記です。実際のURLには /api
          プレフィックスを想定しています。
        </p>
        <DocTable
          head={["分類", "エンドポイント", "主な機能"]}
          monoCols={[1]}
          rows={[
            [
              "認証",
              "/auth/login, /auth/refresh, /auth/logout, /auth/me",
              "ログイン・認証情報管理",
            ],
            ["社員", "/employees", "社員マスタの取得・管理"],
            ["品目", "/items", "品目マスタ・在庫情報の取得"],
            ["拠点", "/locations", "工場・倉庫などの拠点管理"],
            ["取引先", "/partners", "取引先情報の取得（更新系は要確認）"],
            ["伝票", "/slips, /slips/{slipNo}", "一覧・詳細・登録・修正"],
            [
              "ワークフロー",
              "/slips/{slipNo}/actions",
              "申請・承認・差戻・入出庫処理",
            ],
            [
              "ダッシュボード",
              "/dashboard/summary, /dashboard/tasks, /dashboard/low-stock",
              "業務集計・担当タスク・安全在庫割れ",
            ],
            [
              "通知",
              "/notifications, /notifications/read",
              "履歴通知・既読管理",
            ],
          ]}
        />
        <Sub>HTTPメソッド</Sub>
        <DocTable
          head={["メソッド", "用途"]}
          monoCols={[0]}
          rows={[
            ["GET", "取得"],
            ["POST", "登録・業務アクション"],
            ["PUT", "更新"],
            ["DELETE", "マスタ削除（使用中データは削除不可）"],
          ]}
        />
        <Sub>共通仕様</Sub>
        <DocTable
          head={["項目", "内容"]}
          labelCols={[0]}
          rows={[
            [
              "認証",
              "JWT Bearer（アクセストークン30分、リフレッシュトークン7日・ローテーション方式）",
            ],
            [
              "日付・ID",
              "日付はYYYY-MM-DD、日時はISO 8601（タイムゾーンの扱いは未確定）。IDは数値、伝票は文字列のslipNoで識別",
            ],
            [
              "ページング",
              "page=1、pageSize=10、最大100件。dataに items / totalCount / page / pageSize / totalPages を格納",
            ],
            [
              "ステータスコード",
              "200・201 成功／400 入力不備／401 未認証／403 権限違反／404 対象なし／409 競合／500 サーバーエラー",
            ],
          ]}
        />
        <Sub>共通レスポンス例</Sub>
        <Code>{`{
  "success": true,
  "data": { "slipNo": "SLP20261021-001", "status": "S01" },
  "message": null,
  "errors": null,
  "timestamp": "2026-10-21T09:00:00"
}`}</Code>
      </>
    ),
  },
];

export default function ApiDesignDoc() {
  return (
    <Accordion
      type="single"
      collapsible
      defaultValue="endpoints"
      className="w-full min-w-0"
    >
      {sections.map((section) => (
        <AccordionItem
          key={section.id}
          value={section.id}
          className="border-border/50"
        >
          <AccordionTrigger className="gap-3 py-3 text-left text-sm">
            {section.title}
          </AccordionTrigger>
          <AccordionContent>{section.body}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}
