/**
 * Mehrere Starts pro Spieler (Paschen).
 *
 * Kernkonzept: Ein Spieler (Person) ≠ ein Start (Turniereintrag).
 * Jeder Start ist technisch ein eigener Participant mit eigener participantId,
 * aber derselben userId (die Person dahinter). Die Obergrenze an Starts pro
 * Person wird pro Turnier im Backend gespeichert (tournament.maxStartsPerPerson).
 */

/** Standard-Obergrenze Starts (Karten) pro Person, wenn nichts anderes konfiguriert ist. */
export const DEFAULT_MAX_STARTS_PER_PERSON = 3;

/** Absolute Obergrenze, die im UI angeboten wird (Schutz vor unsinnigen Werten). */
export const MAX_STARTS_LIMIT = 10;

/** Minimales Interface, das für die Start-Nummerierung gebraucht wird. */
export interface StartLike {
  participantId: string;
  userId: string | null;
  registeredAt: string;
  /** Anzeigename – Fallback-Schlüssel, wenn keine userId vorhanden ist. */
  displayName?: string;
}

/** Zusätzliche Felder, um aktive Starts pro Person zu zählen. */
export interface CountableStart extends StartLike {
  status: string;
}

/**
 * Liefert einen stabilen "Personen-Schlüssel". Bevorzugt die userId (die echte
 * Person hinter dem Start). Personen ohne Account haben keine userId – dann wird
 * der (normalisierte) Anzeigename als Fallback verwendet, damit mehrere Starts
 * derselben account-losen Person trotzdem als eine Person erkannt werden.
 *
 * @returns Schlüssel oder null, wenn keine Zuordnung möglich ist.
 */
export function personKey(entry: {
  userId: string | null;
  displayName?: string | null;
}): string | null {
  if (entry.userId) return `user:${entry.userId}`;
  const name = entry.displayName?.trim().toLowerCase();
  return name ? `name:${name}` : null;
}

/**
 * Zählt je Person die Anzahl aktiver Starts (alles außer "Withdrawn").
 * Personen werden über {@link personKey} identifiziert (userId oder Name-Fallback).
 *
 * @returns Map personKey → Anzahl aktiver Starts.
 */
export function countActiveStartsByUser(
  entries: CountableStart[],
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    if (entry.status === "Withdrawn") continue;
    const key = personKey(entry);
    if (!key) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Ordnet jeder participantId eine 1-basierte Start-Nummer zu – aber nur für
 * Personen, die tatsächlich mehr als einen Start haben. Die Reihenfolge der
 * Registrierung (registeredAt, bei Gleichstand participantId) bestimmt, welcher
 * Start Nummer 1, 2, 3 … ist.
 *
 * @returns Map participantId → Start-Nummer. Enthält nur Einträge für Personen
 *   mit ≥ 2 Starts; Einzelstarts tauchen bewusst nicht auf, damit sie ohne
 *   Suffix angezeigt werden.
 */
export function buildStartNumbers(entries: StartLike[]): Map<string, number> {
  const byUser = new Map<string, StartLike[]>();
  for (const entry of entries) {
    const key = personKey(entry); // userId oder Name-Fallback
    if (!key) continue;
    const bucket = byUser.get(key);
    if (bucket) bucket.push(entry);
    else byUser.set(key, [entry]);
  }

  const result = new Map<string, number>();
  for (const bucket of byUser.values()) {
    if (bucket.length < 2) continue; // Einzelstart braucht kein Suffix
    const sorted = [...bucket].sort((a, b) => {
      const byTime = a.registeredAt.localeCompare(b.registeredAt);
      if (byTime !== 0) return byTime;
      return a.participantId.localeCompare(b.participantId);
    });
    sorted.forEach((entry, index) => {
      result.set(entry.participantId, index + 1);
    });
  }
  return result;
}

/**
 * Hängt das "(Start N)"-Suffix an, wenn die Person mehrere Starts hat. Ist die
 * participantId nicht in der Map (Einzelstart), bleibt der Name unverändert.
 */
export function withStartSuffix(
  name: string,
  participantId: string,
  startNumbers: Map<string, number>,
): string {
  const n = startNumbers.get(participantId);
  return n ? `${name} (Start ${n})` : name;
}
