import Anthropic from "@anthropic-ai/sdk";

export interface RetrievedChunk {
  chunkId: string;
  documentTitle: string;
  content: string;
  similarityScore: number;
}

export interface AuditedAnswer {
  suggestedAnswer: string;
  confidenceScore: number;
  reviewStatus: "pending" | "flagged";
  citationChunkIds: string[];
}

const CONFIDENCE_THRESHOLD = 0.7;

const SYSTEM_PROMPT = `You are a certified InfoSec auditor drafting responses to vendor security questionnaires.

STRICT RULES:
1. Answer ONLY from the provided document excerpts. Never invent, extrapolate, or assume security capabilities.
2. Each excerpt is tagged with [DOC:n]. When you use an excerpt, cite it inline as [DOC:n].
3. If the excerpts do not contain direct evidence for a control, respond EXACTLY with "Information Not Found" and nothing else.
4. Keep answers factual, concise, and in the style of formal security documentation (2-5 sentences unless the question demands otherwise).
5. Respond in strict JSON format.`;

/**
 * Drafts an audited questionnaire answer using Claude with retrieved
 * compliance chunks. Enforces the zero-hallucination policy: items lacking
 * documented evidence are flagged for mandatory human review.
 */
export class ComplianceInferenceEngine {
  private anthropic: Anthropic;

  constructor(apiKey: string) {
    this.anthropic = new Anthropic({ apiKey });
  }

  public async generateAuditedAnswer(
    questionText: string,
    sectionCategory: string | null,
    chunks: RetrievedChunk[],
    companyName: string,
  ): Promise<AuditedAnswer> {
    if (chunks.length === 0) {
      return {
        suggestedAnswer: "Information Not Found",
        confidenceScore: 0,
        reviewStatus: "flagged",
        citationChunkIds: [],
      };
    }

    const context = chunks
      .map(
        (chunk, idx) =>
          `[DOC:${idx + 1}] (source: ${chunk.documentTitle}, similarity: ${chunk.similarityScore.toFixed(2)})\n${chunk.content}`,
      )
      .join("\n\n---\n\n");

    const userMessage = `Company: ${companyName}
${sectionCategory ? `Questionnaire section: ${sectionCategory}` : ""}

DOCUMENT EXCERPTS:
${context}

QUESTION: ${questionText}

Draft the answer now. Remember: if the excerpts lack direct evidence, respond only with "Information Not Found". Cite excerpts as [DOC:n].`;

    const message = await this.anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userMessage }],
    });

    const rawText = message.content
      .filter((block) => block.type === "text")
      .map((block) => (block.type === "text" ? block.text : ""))
      .join("");

    const parsed = this.parseStructuredOutput(rawText);
    const citationChunkIds = this.resolveCitations(parsed.citations, chunks);
    const vectorScore = Math.max(...chunks.map((c) => c.similarityScore), 0);
    const confidenceScore = this.scoreConfidence(vectorScore, parsed.usesCitations, parsed.refused);

    return {
      suggestedAnswer: parsed.answer,
      confidenceScore,
      reviewStatus: confidenceScore < CONFIDENCE_THRESHOLD ? "flagged" : "pending",
      citationChunkIds,
    };
  }

  private parseStructuredOutput(raw: string): {
    answer: string;
    citations: number[];
    refused: boolean;
    usesCitations: boolean;
  } {
    const refused = /information not found/i.test(raw);
    const citationMatches = [...raw.matchAll(/\[DOC:(\d+)\]/g)].map((m) =>
      Number.parseInt(m[1], 10),
    );
    const uniqueCitations = [...new Set(citationMatches)];

    // Strip a JSON wrapper if the model emitted one; otherwise use raw text
    let answer = raw.trim();
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]) as { answer?: string };
        if (typeof parsed.answer === "string") answer = parsed.answer.trim();
      } catch {
        // Fall back to raw text
      }
    }

    return {
      answer: refused ? "Information Not Found" : answer,
      citations: uniqueCitations,
      refused,
      usesCitations: uniqueCitations.length > 0,
    };
  }

  private resolveCitations(citations: number[], chunks: RetrievedChunk[]): string[] {
    return [
      ...new Set(
        citations
          .map((n) => chunks[n - 1])
          .filter((c): c is RetrievedChunk => Boolean(c))
          .map((c) => c.chunkId),
      ),
    ];
  }

  /**
   * Weighted confidence: retrieval quality (60%) + citation discipline (25%)
   * + explicit refusal handling (15%). Items below 0.70 are flagged red for
   * mandatory human verification.
   */
  private scoreConfidence(
    vectorScore: number,
    usesCitations: boolean,
    refused: boolean,
  ): number {
    if (refused) return 0;

    const retrieval = Math.min(vectorScore, 1) * 0.6;
    const citationBonus = usesCitations ? 0.25 : 0;
    const grounding = refused ? 0 : 0.15;
    return Math.round(Math.min(retrieval + citationBonus + grounding, 1) * 1000) / 1000;
  }
}
