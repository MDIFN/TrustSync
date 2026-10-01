import { serve } from "inngest/next";
import { inngest } from "@/lib/inngest";
import { processQuestionnaireJob } from "@/inngest/functions/processQuestionnaire";
import { ingestComplianceDocument } from "@/inngest/functions/ingestComplianceDocument";

// Serve all background functions via the Inngest handler
export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [processQuestionnaireJob, ingestComplianceDocument],
});
