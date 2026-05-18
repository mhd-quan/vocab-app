import { cn } from "@/lib/cn";
import {
  StudentPetIcon,
  type StudentPetId,
  type StudentPetMood,
  defaultStudentPet,
  parsePetSeed,
} from "@/ui/student/pets";

export type MascotMood = StudentPetMood;

export interface MascotIconProps {
  mood?: MascotMood;
  pet?: StudentPetId | null;
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
  const selectedPet = pet ?? parsePetSeed(avatarSeed) ?? defaultStudentPet(studentId ?? avatarSeed);
  return (
    <StudentPetIcon
      pet={selectedPet}
      mood={mood}
      className={cn("text-success", className)}
      label={`${selectedPet} ${mood} study pet`}
    />
  );
}
