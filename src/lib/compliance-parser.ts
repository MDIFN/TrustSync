import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export interface ProcessedChunk {
  chunkIndex: number;
  content: string;
  tokenCount: number;
  sectionHeader: string;
}

export interface ParseResult {
  title: string;
  totalTokens: number;
  chunks: ProcessedChunk[];
}

/**
 * Parses PDF and DOCX compliance documents (SOC 2 reports, ISO 27001 annexes,
 * InfoSec policies) into header-aware, token-budgeted chunks ready for
 * embedding.
 */
export class ComplianceDocumentParser {
  /** Main entry point: auto-detects format from file extension. */
  public static async parseDocument(
    fileBuffer: Buffer,
    fileName: string,
  ): Promise<ParseResult> {
    const isPdf = fileName.toLowerCase().endsWith(".pdf");
    const isDocx = fileName.toLowerCase().endsWith(".docx");

    let normalizedText: string;
    if (isPdf) {
      normalizedText = await this.extractPdfText(fileBuffer);
    } else if (isDocx) {
      normalizedText = await this.extractDocxText(fileBuffer);
    } else if (fileName.toLowerCase().endsWith(".txt") || fileName.toLowerCase().endsWith(".md")) {
      normalizedText = fileBuffer.toString("utf-8");
    } else {
      throw new Error(
        "Unsupported document format. Only PDF, DOCX, TXT and MD files are allowed.",
      );
    }

    const chunks = this.createHeaderAwareChunks(normalizedText, 500, 80);
    const totalTokens = chunks.reduce((acc, c) => acc + c.tokenCount, 0);

    return {
      title: fileName.replace(/\.[^/.]+$/, ""),
      totalTokens,
      chunks,
    };
  }

  /** PDF branch: extracts text and strips recurring headers/footers. */
  private static async extractPdfText(buffer: Buffer): Promise<string> {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return result.text
        // Strip recurring page footers like "Page 12 of 85"
        .replace(/Page\s+\d+\s+of\s+\d+/gi, "")
        .replace(/Confidential\s*-\s*Internal\s*Use\s*Only/gi, "")
        // Normalize duplicate blank lines
        .replace(/\n\s*\n\s*\n/g, "\n\n")
        .trim();
    } finally {
      await parser.destroy();
    }
  }

  /** DOCX branch: converts Word styles to clean Markdown via Mammoth. */
  private static async extractDocxText(buffer: Buffer): Promise<string> {
    const options = {
      styleMap: [
        "p[style-name='Heading 1'] => h1:fresh",
        "p[style-name='Heading 2'] => h2:fresh",
        "p[style-name='Heading 3'] => h3:fresh",
      ],
    };
    const { value: rawHtml } = await mammoth.convertToHtml({ buffer }, options);

    return rawHtml
      .replace(/<h1>(.*?)<\/h1>/gi, "\n# $1\n")
      .replace(/<h2>(.*?)<\/h2>/gi, "\n## $1\n")
      .replace(/<h3>(.*?)<\/h3>/gi, "\n### $1\n")
      .replace(/<p>(.*?)<\/p>/gi, "$1\n\n")
      .replace(/<strong>(.*?)<\/strong>/gi, "**$1**")
      .replace(/<em>(.*?)<\/em>/gi, "*$1*")
      .replace(/<[^>]+>/g, "") // Strip remaining HTML wrappers
      .trim();
  }

  /**
   * Header-aware recursive chunking: retains the nearest section context in
   * every slice and injects it as a `[SECTION: ...]` prefix so embeddings and
   * retrieved snippets never lose their parent heading.
   */
  private static createHeaderAwareChunks(
    fullText: string,
    targetTokenSize: number = 500,
    overlapTokens: number = 80,
  ): ProcessedChunk[] {
    const lines = fullText.split("\n");
    const chunks: ProcessedChunk[] = [];
    let currentSection = "General Compliance Overview";
    let currentChunkTokens = 0;
    let currentChunkLines: string[] = [];
    let chunkIndex = 0;

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect header boundaries (Markdown or standard SOC 2 sections)
      if (trimmed.startsWith("#") || /^(Section|Control|Policy)\s+\d+/i.test(trimmed)) {
        currentSection = trimmed.replace(/^#+\s*/, "");
      }

      // Estimate token count (~4 characters per token average)
      const lineTokens = Math.ceil(trimmed.length / 4);

      if (
        currentChunkTokens + lineTokens > targetTokenSize &&
        currentChunkLines.length > 0
      ) {
        // Finalize current chunk with header context injected at top
        const contentBody = currentChunkLines.join("\n");
        chunks.push({
          chunkIndex,
          sectionHeader: currentSection,
          content: `[SECTION: ${currentSection}]\n${contentBody}`,
          tokenCount: currentChunkTokens,
        });
        chunkIndex++;

        // Build sliding-window overlap for continuity across boundaries
        const overlapLines: string[] = [];
        let accruedOverlapTokens = 0;
        for (let i = currentChunkLines.length - 1; i >= 0; i--) {
          const lTokens = Math.ceil(currentChunkLines[i].length / 4);
          if (accruedOverlapTokens + lTokens <= overlapTokens) {
            overlapLines.unshift(currentChunkLines[i]);
            accruedOverlapTokens += lTokens;
          } else {
            break;
          }
        }
        currentChunkLines = [...overlapLines, trimmed];
        currentChunkTokens = accruedOverlapTokens + lineTokens;
      } else {
        currentChunkLines.push(trimmed);
        currentChunkTokens += lineTokens;
      }
    }

    // Flush remaining content
    if (currentChunkLines.length > 0) {
      chunks.push({
        chunkIndex,
        sectionHeader: currentSection,
        content: `[SECTION: ${currentSection}]\n${currentChunkLines.join("\n")}`,
        tokenCount: currentChunkTokens,
      });
    }

    return chunks;
  }
}
