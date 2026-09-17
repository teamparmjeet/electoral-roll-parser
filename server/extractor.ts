import { ParsedCard } from "./types";

/**
 * Normalizes Devanagari numerals (०, १, २, ३, ४, ५, ६, ७, ८, ९) to standard ASCII digits (0-9).
 */
export function normalizeDevanagariNumbers(text: string): string {
  if (!text) return "";
  const devanagariDigits = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];
  let result = text;
  for (let i = 0; i < 10; i++) {
    const reg = new RegExp(devanagariDigits[i], "g");
    result = result.replace(reg, String(i));
  }
  return result;
}

/**
 * Strips excessive whitespaces, OCR noise characters, and trailing punctuation.
 */
export function cleanText(text: string): string {
  if (!text) return "";
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, "") // zero-width spaces
    .replace(/[|│।]/g, " ") // table separators/dandas
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Calculates a confidence score and review recommendation for a specific extracted field.
 */
export function calculateFieldConfidence(field: string, value: any): { score: number; review: boolean; reason: string } {
  if (value === null || value === undefined || value === "") {
    return { score: 0.10, review: true, reason: `Missing ${field}` };
  }

  const s = String(value).trim();

  if (field === "serial_number") {
    const n = Number(s);
    if (!isNaN(n) && n > 0 && n < 10000) {
      return { score: 0.98, review: false, reason: "" };
    }
    return { score: 0.50, review: true, reason: "Invalid serial number" };
  }

  if (field === "age") {
    const age = Number(s);
    if (!isNaN(age) && age >= 18 && age <= 125) {
      return { score: 0.99, review: false, reason: "" };
    }
    if (!isNaN(age) && (age < 18 || age > 125)) {
      return { score: 0.40, review: true, reason: `Suspicious age: ${age}` };
    }
    return { score: 0.30, review: true, reason: "Age not a valid number" };
  }

  if (field === "voter_id") {
    if (/^[A-Z]{3}[0-9]{7}$/.test(s)) return { score: 0.98, review: false, reason: "" };
    if (/^[A-Z0-9/\-]{8,20}$/i.test(s)) return { score: 0.92, review: false, reason: "" };
    if (s.includes("?") || s.includes("\ufffd")) return { score: 0.60, review: true, reason: "Voter ID contains OCR artifact" };
    return { score: 0.72, review: true, reason: "Voter ID non-standard format" };
  }

  if (field === "elector_name" || field === "relation_name") {
    if (s.length < 2) return { score: 0.40, review: true, reason: `${field} too short` };
    if (s.includes("?") || s.includes("\ufffd")) return { score: 0.65, review: true, reason: `${field} contains OCR artifacts` };
    return { score: 0.96, review: false, reason: "" };
  }

  if (field === "gender") {
    if (["male", "female", "third_gender"].includes(s)) return { score: 0.98, review: false, reason: "" };
    return { score: 0.60, review: true, reason: "Unknown gender value" };
  }

  if (field === "house_number") {
    if (s.includes("?") || s.includes("\ufffd")) return { score: 0.70, review: true, reason: "House number contains uncertain characters" };
    return { score: 0.95, review: false, reason: "" };
  }

  return { score: 0.90, review: false, reason: "" };
}

export function parseCardText(cardText: string): ParsedCard {
  const normalized = normalizeDevanagariNumbers(cardText);

  let serialNumber: number | null = null;
  let partNumber: number | null = null;
  let voterId: string | null = null;
  let electorName: string | null = null;
  let relationType: "father" | "husband" | "mother" | "other" | null = null;
  let relationName: string | null = null;
  let houseNumber: string | null = null;
  let age: number | null = null;
  let gender: "male" | "female" | "third_gender" | null = null;
  let genderOriginal: string | null = null;
  let photoAvailable = false;

  // Check photo availability
  if (/फोटो\s*उपलब्ध|Photo\s*Available|Available/i.test(cardText)) {
    photoAvailable = true;
  }

  // Check for Supplement Header format: "#3 125 1 IQT3150893" or "1142 1 IQT5230495"
  const supplementHeader = normalized.match(/#\s*\d+\s+(\d+)\s+(\d+)\s+([A-Z0-9]+)/i);
  if (supplementHeader) {
    serialNumber = parseInt(supplementHeader[1], 10);
    partNumber = parseInt(supplementHeader[2], 10);
    voterId = supplementHeader[3];
  } else {
    const parivardhanHeader = normalized.match(/(?:^|\n)\s*(\d{1,5})\s+(\d+)\s+([A-Z0-9]{8,12})/i);
    if (parivardhanHeader) {
      serialNumber = parseInt(parivardhanHeader[1], 10);
      partNumber = parseInt(parivardhanHeader[2], 10);
      voterId = parivardhanHeader[3];
    }
  }

  // Fallback Serial Number
  if (!serialNumber) {
    const snMatch = normalized.match(/(?:^|\n|\s)(\d{1,5})(?=\s|\n|[A-Z]|$)/);
    if (snMatch) {
      const val = parseInt(snMatch[1], 10);
      if (val > 0 && val < 5000) {
        serialNumber = val;
      }
    }
  }

  // Fallback Voter ID (EPIC)
  if (!voterId) {
    const epicMatch = normalized.match(/([A-Z]{3}[0-9]{7})/);
    if (epicMatch) {
      voterId = epicMatch[1];
    } else {
      const stateCodeMatch = normalized.match(/([A-Z]{2}\/[0-9]{2,3}\/[0-9]{2,3}\/[0-9]{4,8})/);
      if (stateCodeMatch) {
        voterId = stateCodeMatch[1];
      } else {
        const genericEpic = normalized.match(/([A-Z]{2,4}[0-9]{6,10})/);
        if (genericEpic) {
          voterId = genericEpic[1];
        }
      }
    }
  }

  // Elector Name
  const namePattern = /(?:निर्वाचक\s*का\s*नाम|मतदाता\s*का\s*नाम|नाम|Elector['’]?s?\s*Name)\s*[:\-\s]*([^\n\r]+)/i;
  const nameMatch = normalized.match(namePattern);
  if (nameMatch) {
    let nameRaw = cleanText(nameMatch[1]);
    nameRaw = nameRaw.replace(/(?:पिता|पति|माता|संरक्षक|मकान|गृह|आयु|उम्र|लिंग).*/, "").trim();
    if (nameRaw.length >= 2) {
      electorName = nameRaw;
    }
  }

  // Relation Name & Type
  const fatherMatch = normalized.match(/(?:पिता\s*का\s*नाम|Father['’]?s?\s*Name)\s*[:\-\s]*([^\n\r]+)/i);
  const husbandMatch = normalized.match(/(?:पति\s*का\s*नाम|Husband['’]?s?\s*Name)\s*[:\-\s]*([^\n\r]+)/i);
  const motherMatch = normalized.match(/(?:माता\s*का\s*नाम|Mother['’]?s?\s*Name)\s*[:\-\s]*([^\n\r]+)/i);
  const otherMatch = normalized.match(/(?:संरक्षक\s*का\s*नाम|अन्य\s*[:\-\s]|Guardian['’]?s?\s*Name)\s*[:\-\s]*([^\n\r]+)/i);

  if (fatherMatch) {
    relationType = "father";
    relationName = cleanText(fatherMatch[1]).replace(/(?:मकान|गृह|आयु|उम्र|लिंग).*/, "").trim();
  } else if (husbandMatch) {
    relationType = "husband";
    relationName = cleanText(husbandMatch[1]).replace(/(?:मकान|गृह|आयु|उम्र|लिंग).*/, "").trim();
  } else if (motherMatch) {
    relationType = "mother";
    relationName = cleanText(motherMatch[1]).replace(/(?:मकान|गृह|आयु|उम्र|लिंग).*/, "").trim();
  } else if (otherMatch) {
    relationType = "other";
    relationName = cleanText(otherMatch[1]).replace(/(?:मकान|गृह|आयु|उम्र|लिंग).*/, "").trim();
  }

  // House Number
  const housePattern = /(?:गृह\s*संख्या|मकान\s*संख्या|मकान\s*नं|गृह\s*क्रमांक|House\s*No\.?)\s*[:\-\s]*([^\n\r,;]+)/i;
  const houseMatch = normalized.match(housePattern);
  if (houseMatch) {
    let hVal = cleanText(houseMatch[1]).replace(/(?:आयु|उम्र|लिंग|Age|Gender).*/i, "").trim();
    if (hVal) {
      houseNumber = hVal;
    }
  }

  // Age (handles both आयु and उम्र)
  const agePattern = /(?:आयु|उम्र|Age)\s*[:\-\s]*([0-9]{1,3})/i;
  const ageMatch = normalized.match(agePattern);
  if (ageMatch) {
    const aVal = parseInt(ageMatch[1], 10);
    if (aVal > 0 && aVal <= 130) {
      age = aVal;
    }
  }

  // Gender
  const genderPattern = /(?:लिंग|Gender)\s*[:\-\s]*([^\n\r\s]+)/i;
  const genderMatch = normalized.match(genderPattern);
  if (genderMatch) {
    const rawG = cleanText(genderMatch[1]);
    genderOriginal = rawG;
    if (/पुरुष|Male|M\b/i.test(rawG)) {
      gender = "male";
    } else if (/महिला|स्त्री|Female|F\b/i.test(rawG)) {
      gender = "female";
    } else if (/अन्य|तृतीय|Trans|Other/i.test(rawG)) {
      gender = "third_gender";
    }
  }

  // Calculate field confidences and review flags
  const reviewReasons: string[] = [];
  const fields = [
    { key: "serial_number", val: serialNumber },
    { key: "voter_id", val: voterId },
    { key: "elector_name", val: electorName },
    { key: "relation_name", val: relationName },
    { key: "house_number", val: houseNumber },
    { key: "age", val: age },
    { key: "gender", val: gender }
  ];

  const confidence: any = {};
  let totalScore = 0;

  for (const f of fields) {
    const res = calculateFieldConfidence(f.key, f.val);
    confidence[f.key] = res.score;
    totalScore += res.score;
    if (res.review && res.reason) {
      reviewReasons.push(res.reason);
    }
  }

  const overall = Number((totalScore / fields.length).toFixed(2));
  confidence.overall = overall;

  const needsReview = overall < 0.85 || reviewReasons.length > 0;

  return {
    serial_number: serialNumber,
    part_number: partNumber,
    voter_id: voterId,
    elector_name: electorName,
    relation_type: relationType,
    relation_name: relationName,
    house_number: houseNumber,
    age: age,
    gender: gender,
    gender_original: genderOriginal,
    photo_available: photoAvailable,
    confidence,
    needs_review: needsReview,
    review_reasons: reviewReasons,
    raw_card_text: cardText
  };
}

/**
 * Splits extracted page text into isolated voter card chunks.
 */
export function splitPageIntoCardTexts(pageText: string): string[] {
  if (!pageText) return [];

  const lines = pageText.split("\n");
  const cardChunks: string[] = [];
  let currentChunk: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const normalizedLine = normalizeDevanagariNumbers(line);

    // Look for card start delimiter:
    // 1. Line starts with #3 or #\d+
    const isSupplementStart = /^#\s*\d+\s+\d+/i.test(normalizedLine);
    // 2. Line is a standalone serial number
    const isSerialStart = /^\d{1,4}$/.test(normalizedLine);
    // 3. Line contains an EPIC code
    const hasEpic = /[A-Z]{3}[0-9]{7}|[A-Z]{2}\/\d{2}\/\d{3}\/\d{5,8}/i.test(normalizedLine);
    // 4. Line contains "निर्वाचक का नाम" when the current card already contains "निर्वाचक का नाम"
    const isDuplicateName = /निर्वाचक\s*का\s*नाम|मतदाता\s*का\s*नाम/i.test(line) && /निर्वाचक\s*का\s*नाम|मतदाता\s*का\s*नाम/i.test(currentChunk.join("\n"));

    if ((isSupplementStart || isSerialStart || hasEpic || isDuplicateName) && currentChunk.length >= 2) {
      const prevText = currentChunk.join("\n");
      if (/नाम|Name|पिता|पति|Father|Husband|आयु|उम्र|Age/i.test(prevText)) {
        cardChunks.push(prevText);
        currentChunk = [line];
        continue;
      }
    }

    currentChunk.push(line);
  }

  if (currentChunk.length > 0) {
    const lastText = currentChunk.join("\n");
    if (/नाम|Name|पिता|पति|Father|Husband|आयु|उम्र|Age/i.test(lastText)) {
      cardChunks.push(lastText);
    }
  }

  return cardChunks;
}
