export function auditQuestionsForSave(questions: string[] | undefined): string[] {
  if (!Array.isArray(questions)) return [];
  return questions.map((question) => question.trim()).filter(Boolean);
}

export function auditQuestionsForUi(questions: string[] | undefined): string[] {
  const saved = auditQuestionsForSave(questions);
  return saved.length > 0 ? saved : [""];
}
