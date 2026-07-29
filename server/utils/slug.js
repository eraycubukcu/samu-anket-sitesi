// Türkçe karakterleri ASCII karşılıklarına çevirir; NFD normalizasyonu
// "ı" gibi bazı Türkçe harfleri düzgün ayrıştıramadığı için elle eşleme kullanılır.
const TURKISH_CHAR_MAP = {
  ç: "c", Ç: "c",
  ş: "s", Ş: "s",
  ğ: "g", Ğ: "g",
  ı: "i", İ: "i",
  ö: "o", Ö: "o",
  ü: "u", Ü: "u",
};

export function slugify(text) {
  const replaced = String(text ?? "")
    .split("")
    .map((ch) => TURKISH_CHAR_MAP[ch] ?? ch)
    .join("");

  const slug = replaced
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || "anket";
}

// Aynı slug'tan zaten varsa sonuna -2, -3 ... ekleyerek benzersiz hale getirir.
export async function ensureUniqueSlug(Model, baseSlug, excludeId) {
  let slug = baseSlug;
  let counter = 2;

  while (
    await Model.exists({
      slug,
      ...(excludeId ? { _id: { $ne: excludeId } } : {}),
    })
  ) {
    slug = `${baseSlug}-${counter}`;
    counter += 1;
  }

  return slug;
}
