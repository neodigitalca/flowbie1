const exchanges = [];

export function addExchange(entry) {
  exchanges.push({
    at: new Date().toISOString(),
    ...entry,
  });
  while (exchanges.length > 5) exchanges.shift();
}

export function getRecentExchanges(limit = 5) {
  return exchanges.slice(-limit);
}

export function formatExchangesForPrompt(limit = 5) {
  const recent = getRecentExchanges(limit);
  if (!recent.length) return "";
  return recent
    .map(
      (e, i) =>
        `Prior Q${i + 1}: ${e.transcript}\nPrior A${i + 1}: ${(e.summary || e.answerText || "").slice(0, 400)}`,
    )
    .join("\n\n");
}

export function clearExchanges() {
  exchanges.length = 0;
}
