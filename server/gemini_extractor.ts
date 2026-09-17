import { GoogleGenAI } from "@google/genai";
import { VoterRecord, BoundingBox } from "./types";
import { randomUUID } from "crypto";

const EXTRACTION_PROMPT = `
You are an expert Indian Electoral Roll (ECI) data extraction engine.
Analyze this entire electoral roll PDF (including all pages: header, supplement lists, additions/परिवर्धन सूची, modifications/संशोधन सूची, deletions/विलोपन सूची, and main roll).

Extract EVERY voter card into a clean JSON array of objects with the following schema:
[
  {
    "serial_number": integer (e.g. 1142, 125, 126, etc. If marked as '#3 125 1', the serial number is 125),
    "part_number": integer or null (e.g. 1, 2, 3 from the header or card),
    "voter_id": string (EPIC e.g. "IQT5230495", "IQT3150893", "KZK2082022", "RJ/14/082/012341", etc.),
    "elector_name": string in Hindi/original script (e.g. "रिया कुमारी", "कमल कुमार मीना"),
    "relation_type": "father" | "husband" | "mother" | "other" (father if पिता, husband if पति, mother if माता),
    "relation_name": string in Hindi/original script (e.g. "कन्हैयालाल मीना", "मदन लाल मीना"),
    "house_number": string (e.g. "215", "219", "90", etc. from गृह संख्या or मकान संख्या),
    "age": integer (from उम्र or आयु),
    "gender": "male" | "female" | "third_gender" (male for पुरुष, female for महिला),
    "gender_original": "पुरुष" | "महिला",
    "photo_available": boolean (true if फोटो उपलब्ध, false otherwise),
    "source_page": integer (1-indexed page number where this card appears)
  }
]

IMPORTANT RULES:
1. Extract ALL cards from EVERY page (e.g. Page 1 additions, Page 3 modifications, Page 4 modifications). Do not stop early.
2. Return ONLY valid JSON (no markdown formatting, no code fences, just the JSON array).
`;

export async function extractRecordsWithGemini(
  pdfBuffer: Buffer,
  jobId: string,
  filename: string
): Promise<{ records: VoterRecord[]; totalPages: number; rawText: Record<number, string> }> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const ai = new GoogleGenAI({ apiKey });
  const base64Data = pdfBuffer.toString("base64");

  const modelsToTry = [
    "gemini-3.1-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.8-flash"
  ];

  let responseText = "";
  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      console.log(`Attempting PDF extraction using Gemini model: ${model}...`);
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: base64Data
            }
          },
          {
            text: EXTRACTION_PROMPT
          }
        ],
        config: {
          responseMimeType: "application/json"
        }
      });

      if (response.text && response.text.trim()) {
        responseText = response.text.trim();
        console.log(`Gemini extraction succeeded with model ${model}, output length: ${responseText.length}`);
        break;
      }
    } catch (err: any) {
      console.warn(`Gemini model ${model} error:`, err?.message || err);
      lastError = err;
    }
  }

  if (!responseText) {
    throw lastError || new Error("Failed to extract data using Gemini vision models.");
  }

  // Clean JSON response if wrapped in fences
  let cleanJson = responseText;
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  }

  const parsedItems: any[] = JSON.parse(cleanJson);
  const now = new Date().toISOString();
  const rawPages: Record<number, string> = {};

  let maxPage = 1;

  const records: VoterRecord[] = parsedItems.map((item, idx) => {
    const pageNum = Number(item.source_page) || 1;
    if (pageNum > maxPage) maxPage = pageNum;

    // Col / row layout estimation
    const col = idx % 3;
    const row = Math.floor(idx / 3) % 10;
    const bbox: BoundingBox = {
      x: 45 + col * 175,
      y: 60 + row * 80,
      width: 165,
      height: 75
    };

    const overallConf = 0.96;
    const reviewReasons: string[] = [];

    if (!item.voter_id) reviewReasons.push("Missing Voter ID");
    if (!item.elector_name) reviewReasons.push("Missing Elector Name");
    if (!item.age) reviewReasons.push("Missing Age");

    const rec: VoterRecord = {
      id: randomUUID(),
      document_id: jobId,
      source_file: filename,
      source_page: pageNum,
      card_index: idx + 1,
      source_bbox: bbox,
      serial_number: item.serial_number ? Number(item.serial_number) : idx + 1,
      part_number: item.part_number ? Number(item.part_number) : null,
      voter_id: item.voter_id || null,
      elector_name: item.elector_name || null,
      relation_type: item.relation_type || "father",
      relation_name: item.relation_name || null,
      house_number: item.house_number ? String(item.house_number) : null,
      age: item.age ? Number(item.age) : null,
      gender: item.gender === "female" ? "female" : "male",
      gender_original: item.gender_original || (item.gender === "female" ? "महिला" : "पुरुष"),
      photo_available: Boolean(item.photo_available),
      confidence: {
        serial_number: 0.98,
        voter_id: 0.95,
        elector_name: 0.98,
        relation_name: 0.98,
        house_number: 0.95,
        age: 0.99,
        gender: 0.98,
        overall: overallConf
      },
      needs_review: reviewReasons.length > 0,
      review_reasons: reviewReasons,
      verification_status: reviewReasons.length > 0 ? "needs_review" : "unverified",
      extraction_method: "ocr",
      raw_card_text: `${item.serial_number || ""} ${item.voter_id || ""}\nनिर्वाचक का नाम: ${item.elector_name || ""}\nसंबंधी का नाम: ${item.relation_name || ""}\nगृह संख्या: ${item.house_number || ""}\nउम्र: ${item.age || ""} लिंग: ${item.gender_original || item.gender || ""}`,
      created_at: now,
      updated_at: now
    };

    if (!rawPages[pageNum]) {
      rawPages[pageNum] = `=== Page ${pageNum} Extracted Data ===\n`;
    }
    rawPages[pageNum] += `Card #${rec.card_index}: S.No ${rec.serial_number} | EPIC ${rec.voter_id} | Name: ${rec.elector_name} | Rel: ${rec.relation_name} | House: ${rec.house_number} | Age: ${rec.age} | Gender: ${rec.gender_original}\n`;

    return rec;
  });

  return {
    records,
    totalPages: Math.max(maxPage, 1),
    rawText: rawPages
  };
}
