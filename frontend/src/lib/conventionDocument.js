export const AUTO_BINDINGS = Object.freeze({
  "student.fullName": "Nom complet de l’étudiant",
  "student.firstName": "Prénom de l’étudiant",
  "student.lastName": "Nom de l’étudiant",
  "student.email": "Adresse e-mail de l’étudiant",
  "student.specialty": "Spécialité de l’étudiant",
  "student.department": "Département de l’étudiant",
  "student.gouvernorat": "Gouvernorat de l’étudiant",
  "institution.name": "Nom de l’établissement",
  "company.name": "Nom de l’entreprise",
  "company.contactName": "Nom du contact de l’entreprise",
  "company.email": "Adresse e-mail de l’entreprise",
  "offer.title": "Intitulé de l’offre",
  "offer.durationWeeks": "Durée du stage en semaines",
  "offer.gouvernorat": "Gouvernorat du stage",
  "offer.workMode": "Mode de travail",
});

const isPresent = (value) => String(value ?? "").trim().length > 0;

export function resolveAuto(binding, ctx = {}) {
  const value = String(binding ?? "")
    .split(".")
    .reduce((current, key) => current?.[key], ctx);
  return value == null ? "" : String(value);
}

export function validateField(field, value) {
  const normalized = String(value ?? "").trim();
  if (field?.required && !normalized) return "Ce champ est obligatoire.";
  if (!normalized) return null;

  switch (field?.type) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
        ? null
        : "Saisissez une adresse e-mail valide.";
    case "phone": {
      const digits = normalized.replace(/\D/g, "");
      return /^[+()\d.\s-]+$/.test(normalized) && digits.length >= 7 && digits.length <= 15
        ? null
        : "Saisissez un numéro de téléphone valide.";
    }
    case "date": {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
      if (!match) return "Saisissez une date valide.";
      const [, year, month, day] = match.map(Number);
      const date = new Date(Date.UTC(year, month - 1, day));
      return date.getUTCFullYear() === year &&
        date.getUTCMonth() === month - 1 &&
        date.getUTCDate() === day
        ? null
        : "Saisissez une date valide.";
    }
    case "number":
      return /^-?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/.test(normalized) &&
        Number.isFinite(Number(normalized))
        ? null
        : "Saisissez un nombre valide.";
    case "text":
    case "textarea":
      return null;
    default:
      return "Le type de champ est invalide.";
  }
}

export function buildDocument(snapshot, values = {}) {
  const sections = (snapshot?.sections || []).map((section) => ({
    ...section,
    fields: (section.fields || []).map((field) => {
      let value;
      if (field.source === "STATIC") value = field.value;
      else if (field.source === "AUTO") value = values[field.key] ?? "";
      else value = values[field.key] ?? "";
      const text = value == null ? "" : String(value);
      const locked = field.source === "STATIC" || field.source === "AUTO";
      return {
        ...field,
        value: text,
        state: isPresent(text) ? (locked ? "locked" : "filled") : "missing",
      };
    }),
  }));

  return {
    templateVersion: snapshot?.version ?? snapshot?.templateVersion ?? null,
    header: snapshot?.header || {},
    title: snapshot?.title || "",
    sections,
    articles: snapshot?.articles || [],
    signatories: snapshot?.signatories || [],
    footer: snapshot?.footer || {},
  };
}

export function computeCompletion(snapshot, values = {}) {
  const counts = {
    student: { done: 0, total: 0 },
    company: { done: 0, total: 0 },
  };
  for (const section of snapshot?.sections || []) {
    for (const field of section.fields || []) {
      if (!field.required || !["STUDENT", "COMPANY"].includes(field.source)) continue;
      const party = field.source === "STUDENT" ? "student" : "company";
      counts[party].total += 1;
      if (isPresent(values[field.key])) counts[party].done += 1;
    }
  }
  return {
    ...counts,
    complete:
      counts.student.done === counts.student.total &&
      counts.company.done === counts.company.total,
  };
}

export function computePartyProgress(snapshot, values = {}) {
  const progress = {
    student: { done: 0, total: 0 },
    company: { done: 0, total: 0 },
  };
  for (const section of snapshot?.sections || []) {
    for (const field of section.fields || []) {
      if (!["STUDENT", "COMPANY"].includes(field.source)) continue;
      const party = field.source === "STUDENT" ? "student" : "company";
      progress[party].total += 1;
      if (isPresent(values[field.key])) progress[party].done += 1;
    }
  }
  return progress;
}

export function getCompanyConventionAction(convention, companyId) {
  if (!convention || convention.companyId !== companyId) return null;
  if (convention.state === "APPROVED") return "APPROVED";

  const completion = computeCompletion(
    convention.templateSnapshot,
    convention.values,
  );
  const frozen = Boolean(
    convention.frozenHash || convention.signatures?.length,
  );
  if (!frozen && completion.company.done < completion.company.total) {
    return "TO_COMPLETE";
  }
  if (
    convention.state === "SIGNED_STUDENT" &&
    convention.currentActorId === companyId &&
    completion.complete
  ) {
    return "TO_SIGN";
  }
  return "IN_PROGRESS";
}

export function countCompanyConventionActions(conventions, companyId) {
  return (conventions || []).filter((convention) =>
    ["TO_COMPLETE", "TO_SIGN"].includes(
      getCompanyConventionAction(convention, companyId),
    ),
  ).length;
}

function sortKeys(value) {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((result, key) => {
      result[key] = sortKeys(value[key]);
      return result;
    }, {});
}

export function canonicalize(document) {
  const canonicalDocument = {
    templateVersion: document?.templateVersion ?? null,
    header: document?.header || {},
    title: document?.title || "",
    sections: document?.sections || [],
    articles: document?.articles || [],
    signatories: document?.signatories || [],
    footer: document?.footer || {},
  };
  return JSON.stringify(sortKeys(canonicalDocument));
}

// NOT IN API YET: legacy services expose this plain-text view while screens migrate to the structured document.
export function serializeDocumentText(document) {
  const lines = [...(document?.header?.lines || []), "", document?.title || ""];
  for (const section of document?.sections || []) {
    lines.push("", section.title || "");
    for (const field of section.fields || []) {
      const value =
        field.value ||
        (field.required && field.state === "missing" ? "À compléter" : "—");
      lines.push(`${field.label} : ${value}`);
    }
  }
  for (const article of document?.articles || []) {
    lines.push("", article.title || "", article.text || "");
  }
  lines.push(
    "",
    `Code : ${document?.footer?.code || ""}`,
    `Révision : ${document?.footer?.revision || ""}`,
    `Édition : ${document?.footer?.edition || ""}`,
  );
  return lines.join("\n").trim();
}

export async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Le calcul SHA-256 n’est pas disponible dans cet environnement.");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(String(text)),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

export function etabName(code) {
  const names = { ETAB1: "Institut A", ETAB2: "Institut B" };
  const normalized = String(code ?? "").trim();
  if (names[normalized]) return names[normalized];
  if (/^ETAB\d+$/i.test(normalized)) return "Établissement inconnu";
  return normalized;
}
