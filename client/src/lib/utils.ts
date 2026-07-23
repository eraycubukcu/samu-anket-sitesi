import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Eski kayıtlarda examDate boş/geçersiz olabilir - "Invalid Date" yerine
// anlaşılır bir metin göster.
export function formatDateTime(value: string | undefined | null) {
  if (!value) return "Belirtilmemiş"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Belirtilmemiş"
  return date.toLocaleString("tr-TR")
}
