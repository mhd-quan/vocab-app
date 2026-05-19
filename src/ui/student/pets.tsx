import { cn } from "@/lib/cn";
import { AppGlyph } from "@/ui/components/AppGlyph";

export type StudentPetId = "nova" | "miso" | "pip" | "zuri";
export type StudentPetMood = "happy" | "cheering" | "thinking" | "sad";

export interface StudentPetDefinition {
  id: StudentPetId;
  name: string;
  tagline: string;
  tone: "focus" | "lime" | "ember" | "pink";
}

export const STUDENT_PETS: readonly StudentPetDefinition[] = [
  { id: "nova", name: "Focus", tagline: "Daily study mode", tone: "focus" },
  { id: "miso", name: "Review", tagline: "Memory refresh", tone: "lime" },
  { id: "pip", name: "Streak", tagline: "Fast recall run", tone: "ember" },
  { id: "zuri", name: "Quest", tagline: "New word hunt", tone: "pink" },
];

export function defaultStudentPet(seed: string | number | null | undefined): StudentPetId {
  const text = String(seed ?? "");
  const hash = [...text].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return STUDENT_PETS[hash % STUDENT_PETS.length]?.id ?? "nova";
}

export function parsePetSeed(seed: string | null | undefined): StudentPetId | null {
  if (!seed?.startsWith("pet:")) return null;
  const id = seed.slice("pet:".length);
  return isStudentPetId(id) ? id : null;
}

export function isStudentPetId(value: string): value is StudentPetId {
  return STUDENT_PETS.some((pet) => pet.id === value);
}

interface StudentPetProps {
  pet?: StudentPetId;
  mood?: StudentPetMood;
  className?: string;
  label?: string;
}

export function StudentPetIcon({
  pet = "nova",
  mood = "happy",
  className,
  label = `${pet} study glyph`,
}: StudentPetProps) {
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "inline-grid h-24 w-24 place-items-center rounded-[var(--shape-corner-xl)] border border-current/20 bg-current/10 shadow-card",
        petTone(pet),
        className,
      )}
    >
      <AppGlyph name={moodGlyph(mood)} className="h-[56%] w-[56%]" />
    </span>
  );
}

export function StudentLogoMark({ className }: { className?: string }) {
  return (
    <span
      role="img"
      aria-label="Vocab App"
      className={cn(
        "inline-grid h-10 w-10 place-items-center rounded-[var(--shape-corner-lg)] bg-[color:var(--md-sys-color-primary,rgb(var(--color-accent)))] text-[color:var(--md-sys-color-on-primary,rgb(var(--color-accent-fg)))] shadow-card",
        className,
      )}
    >
      <AppGlyph name="app" className="h-[62%] w-[62%]" />
    </span>
  );
}

function moodGlyph(mood: StudentPetMood) {
  if (mood === "sad") return "warning";
  if (mood === "thinking") return "target";
  if (mood === "cheering") return "spark";
  return "studentMode";
}

function petTone(pet: StudentPetId): string {
  if (pet === "miso") return "text-lime";
  if (pet === "pip") return "text-ember";
  if (pet === "zuri") return "text-pink";
  return "text-focus";
}
