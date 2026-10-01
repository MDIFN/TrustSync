import { NextRequest, NextResponse } from "next/server";
import { exportQuestionnaireAction } from "@/app/actions/exportQuestionnaire";

/**
 * Direct URL download for completed questionnaires. Useful for email links
 * and the Chrome extension handoff.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const result = await exportQuestionnaireAction(id);

  if (!result.success || !result.fileBase64) {
    return NextResponse.json(
      { error: result.error || "Export failed" },
      { status: 400 },
    );
  }

  const binaryBuffer = Buffer.from(result.fileBase64, "base64");
  return new NextResponse(new Uint8Array(binaryBuffer), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": binaryBuffer.length.toString(),
    },
  });
}
