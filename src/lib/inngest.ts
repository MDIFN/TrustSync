import { Inngest } from "inngest";

export type QuestionnaireEvents = {
  "questionnaire/process.requested": {
    data: {
      questionnaireId: string;
      orgId: string;
      orgName: string;
      companyName: string;
      sourceFileName: string;
      totalQuestions: number;
    };
  };
  "compliance/document.ingested": {
    data: {
      documentId: string;
      orgId: string;
      filePath: string;
      fileName: string;
    };
  };
};

/**
 * Typed Inngest client. Event typing is enforced at call sites via the
 * generic parameter on inngest.send(); function handlers infer their event
 * payload from the trigger passed to createFunction().
 */
export const inngest = new Inngest({
  id: "trustsync-engine",
});
