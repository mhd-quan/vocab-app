const unlockedStudentIds = new Set<number>();
const listeners = new Set<() => void>();
let version = 0;

export function isStudentUnlocked(studentId: number): boolean {
  return unlockedStudentIds.has(studentId);
}

export function getStudentAccessVersion(): number {
  return version;
}

export function markStudentUnlocked(studentId: number): void {
  if (unlockedStudentIds.has(studentId)) return;
  unlockedStudentIds.add(studentId);
  notify();
}

export function lockStudentProfile(studentId: number): void {
  if (!unlockedStudentIds.delete(studentId)) return;
  notify();
}

export function clearUnlockedStudentProfiles(): void {
  if (unlockedStudentIds.size === 0) return;
  unlockedStudentIds.clear();
  notify();
}

export function subscribeStudentAccess(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function notify(): void {
  version += 1;
  for (const listener of listeners) listener();
}
