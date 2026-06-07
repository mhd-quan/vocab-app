import { cn } from "@/lib/cn";
import {
  Mascot,
  type MascotId,
  type MascotVariant,
  defaultMascotForSeed,
  isMascotId,
} from "@/ui/student/mascot";

export type MascotMood = "happy" | "cheering" | "thinking" | "sad";

export interface MascotIconProps {
  mood?: MascotMood;
  pet?: MascotId | LegacyPetId | null;
  avatarSeed?: string | null;
  studentId?: number | string | null;
  className?: string;
}

export function MascotIcon({
  mood = "happy",
  pet,
  avatarSeed,
  studentId,
  className,
}: MascotIconProps) {
  const explicitMascot = mascotIdFromPetProp(pet);
  const legacyFallbackMascot = mascotIdFromSeed(avatarSeed);
  const hasStudentSetting = numericStudentId(studentId) !== null;
  const selectedMascot =
    explicitMascot ??
    (hasStudentSetting
      ? null
      : (legacyFallbackMascot ?? defaultMascotForSeed(studentId ?? avatarSeed)));

  return (
    <Mascot
      studentId={studentId}
      mascotId={selectedMascot}
      fallbackMascotId={legacyFallbackMascot}
      variant={variantForMood(mood)}
      className={cn("text-success", className)}
      alt="Study mascot"
    />
  );
}

type LegacyPetId = "nova" | "miso" | "pip" | "zuri";

const LEGACY_PET_TO_MASCOT: Record<LegacyPetId, MascotId> = {
  nova: "1",
  miso: "2",
  pip: "3",
  zuri: "4",
};

function mascotIdFromPetProp(value: MascotId | LegacyPetId | null | undefined): MascotId | null {
  if (!value) return null;
  if (isMascotId(value)) return value;
  return LEGACY_PET_TO_MASCOT[value] ?? null;
}

function mascotIdFromSeed(seed: string | null | undefined): MascotId | null {
  if (!seed) return null;
  if (seed.startsWith("mascot:")) {
    const id = seed.slice("mascot:".length);
    return isMascotId(id) ? id : null;
  }
  if (seed.startsWith("pet:")) {
    const id = seed.slice("pet:".length);
    return isLegacyPetId(id) ? LEGACY_PET_TO_MASCOT[id] : null;
  }
  return null;
}

function isLegacyPetId(value: string): value is LegacyPetId {
  return value === "nova" || value === "miso" || value === "pip" || value === "zuri";
}

function numericStudentId(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return value;
  return null;
}

function variantForMood(mood: MascotMood): MascotVariant {
  if (mood === "cheering") return "cheer";
  if (mood === "thinking") return "focus";
  if (mood === "sad") return "concern";
  return "idle";
}
