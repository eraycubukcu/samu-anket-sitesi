// Türkiye UTC+3 sabit uygulanır (2016'dan beri yaz saati uygulaması yok).
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;
const OPEN_BEFORE_EXAM_MS = 10 * 60 * 1000;

// Sınav tarih/saatinden anketin açılış ve kapanış zamanını hesaplar.
// Açılış: sınavdan 10 dakika önce.
// Kapanış: sınav gününün (Türkiye saatiyle) 23:59:59.999'u -> anket bir
// sonraki güne sarkmaz.
export const computeSurveyWindow = (examDate) => {
  const exam = new Date(examDate);

  if (Number.isNaN(exam.getTime())) {
    throw new Error("Geçersiz sınav tarihi.");
  }

  const startDate = new Date(exam.getTime() - OPEN_BEFORE_EXAM_MS);

  const trExam = new Date(exam.getTime() + TR_OFFSET_MS);
  const endOfDayTR = Date.UTC(
    trExam.getUTCFullYear(),
    trExam.getUTCMonth(),
    trExam.getUTCDate(),
    23,
    59,
    59,
    999,
  );
  const endDate = new Date(endOfDayTR - TR_OFFSET_MS);

  return { startDate, endDate };
};
