/**
 * SlipStatusBanners – 伝票詳細エリア上部の状態アラート。
 * 否認 (A02) / 差戻 (P00, T00) / 修正開始直後の作成中 (S00) を表示する。
 */
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { XCircle, RotateCcw, Info } from "lucide-react";
import type { SlipFull } from "@/services/mock-store";

const SlipStatusBanners = ({ slip }: { slip: SlipFull }) => {
  const latest = slip.workflow[slip.workflow.length - 1];

  if (slip.status === "A02") {
    const rejectEntry = [...slip.workflow].reverse().find((e) => e.action === "reject");
    return (
      <Alert variant="destructive">
        <XCircle className="h-4 w-4" />
        <AlertTitle>この伝票は否認されました。再申請はできません。</AlertTitle>
        {rejectEntry && <AlertDescription>否認理由：{rejectEntry.comment}</AlertDescription>}
      </Alert>
    );
  }

  if (slip.status === "P00" || slip.status === "T00") {
    const returnEntry = [...slip.workflow].reverse().find((e) => e.action === "return");
    return (
      <Alert className="border-warning/50 text-warning [&>svg]:text-warning">
        <RotateCcw className="h-4 w-4" />
        <AlertTitle>この伝票は差戻されました。「修正開始」で作成中に戻し、内容を修正して再度申請してください。</AlertTitle>
        {returnEntry && <AlertDescription>差戻理由：{returnEntry.comment}</AlertDescription>}
      </Alert>
    );
  }

  if (slip.status === "S00" && latest?.action === "startCorrection") {
    const returnEntry = [...slip.workflow].reverse().find((e) => e.action === "return");
    return (
      <Alert className="border-info/50 text-info [&>svg]:text-info">
        <Info className="h-4 w-4" />
        <AlertTitle>差戻理由：{returnEntry?.comment ?? "-"}</AlertTitle>
      </Alert>
    );
  }

  return null;
};

export default SlipStatusBanners;
