import * as XLSX from "xlsx";

export interface ParsedQuestion {
  sheetName: string;
  rowIndex: number;
  questionText: string;
  sectionCategory: string | null;
}

export interface AnswerPayload {
  sheetName: string;
  rowIndex: number;
  answerCol: string;
  answerText: string;
}

/**
 * Parses multi-tab vendor security questionnaires (.xlsx / .csv) into
 * structured question rows, and writes approved answers back into the
 * ORIGINAL workbook binary so all customer formatting, formulas and merged
 * cells are preserved.
 */
export class SpreadsheetProcessor {
  /**
   * Extracts question rows from a questionnaire workbook.
   *
   * Heuristic: a row is a "question" when column A contains a question mark,
   * or when it looks like a natural-language inquiry (>= 4 words). Column B is
   * treated as the answer column.
   */
  public static parseQuestionnaire(fileBuffer: Buffer): ParsedQuestion[] {
    const workbook = XLSX.read(fileBuffer, { type: "buffer" });
    const questions: ParsedQuestion[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      });

      rows.forEach((row, idx) => {
        const questionCell = String(row[0] ?? "").trim();
        const answerCell = String(row[1] ?? "").trim();

        if (!questionCell) return;
        // Skip obvious header rows
        if (/^(question|item|control|ref|#)$/i.test(questionCell)) return;
        // Already answered manually — leave untouched
        if (answerCell) return;
        // Must look like a question: ends with ? or is a multi-word inquiry
        const looksLikeQuestion =
          questionCell.endsWith("?") || questionCell.split(/\s+/).length >= 4;
        if (!looksLikeQuestion) return;

        const sectionCategory = this.inferSection(rows, idx);
        questions.push({
          sheetName,
          rowIndex: idx,
          questionText: questionCell,
          sectionCategory,
        });
      });
    }

    return questions;
  }

  /**
   * Loads the ORIGINAL uploaded workbook, writes approved/edited answers into
   * the target cells, and returns the mutated binary. Only answer cells are
   * touched: styles, formulas, and merged layouts survive.
   */
  public static writeAnswersToWorkbook(
    originalBuffer: Buffer,
    answers: AnswerPayload[],
  ): Buffer {
    const workbook = XLSX.read(originalBuffer, { type: "buffer", cellStyles: true });

    // Group answers by sheet to minimize re-lookups
    const bySheet = new Map<string, AnswerPayload[]>();
    for (const answer of answers) {
      const list = bySheet.get(answer.sheetName) ?? [];
      list.push(answer);
      bySheet.set(answer.sheetName, list);
    }

    for (const [sheetName, sheetAnswers] of bySheet) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;

      for (const answer of sheetAnswers) {
        const cellAddress = `${answer.answerCol}${answer.rowIndex + 1}`; // 0-indexed row -> A1 notation
        const existing = sheet[cellAddress];
        sheet[cellAddress] = {
          t: "s",
          v: answer.answerText,
          // Preserve any pre-existing style reference
          ...(existing && typeof existing === "object" && "s" in existing
            ? { s: (existing as XLSX.CellObject).s }
            : {}),
        };
      }
    }

    const outBuffer = XLSX.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    }) as Buffer;

    return outBuffer;
  }

  /** Walks upwards to find the nearest non-question row as a section label. */
  private static inferSection(rows: unknown[][], fromIndex: number): string | null {
    for (let i = fromIndex - 1; i >= 0 && i >= fromIndex - 10; i--) {
      const cell = String(rows[i]?.[0] ?? "").trim();
      if (!cell) continue;
      const isQuestion =
        cell.endsWith("?") || cell.split(/\s+/).length >= 4;
      if (!isQuestion && cell.length > 2 && cell.length < 120) {
        return cell;
      }
    }
    return null;
  }
}
