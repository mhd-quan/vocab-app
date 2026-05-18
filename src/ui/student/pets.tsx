import { cn } from "@/lib/cn";
import { useId } from "react";

export type StudentPetId = "nova" | "miso" | "pip" | "zuri";
export type StudentPetMood = "happy" | "cheering" | "thinking" | "sad";

export interface StudentPetDefinition {
  id: StudentPetId;
  name: string;
  tagline: string;
  tone: "focus" | "lime" | "ember" | "pink";
}

export const STUDENT_PETS: readonly StudentPetDefinition[] = [
  { id: "nova", name: "Nova", tagline: "Bright and brave", tone: "focus" },
  { id: "miso", name: "Miso", tagline: "Calm memory buddy", tone: "lime" },
  { id: "pip", name: "Pip", tagline: "Fast review spark", tone: "ember" },
  { id: "zuri", name: "Zuri", tagline: "Creative word hunter", tone: "pink" },
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
  label = `${pet} study pet`,
}: StudentPetProps) {
  const colors = petColors(pet);
  const uid = useId().replace(/:/g, "");
  const bodyId = `pet-${uid}-${pet}-body`;
  const shineId = `pet-${uid}-${pet}-shine`;
  return (
    <svg
      viewBox="0 0 96 96"
      role="img"
      aria-label={label}
      className={cn(
        "h-24 w-24 overflow-visible drop-shadow-[0_12px_18px_rgb(15_23_42/0.18)]",
        className,
      )}
    >
      <defs>
        <linearGradient id={bodyId} x1="23" y1="19" x2="75" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor={colors.light} />
          <stop offset="0.58" stopColor={colors.main} />
          <stop offset="1" stopColor={colors.dark} />
        </linearGradient>
        <radialGradient id={shineId} cx="35" cy="30" r="46" gradientUnits="userSpaceOnUse">
          <stop stopColor="white" stopOpacity="0.7" />
          <stop offset="0.45" stopColor="white" stopOpacity="0.16" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </radialGradient>
      </defs>

      <ellipse cx="48" cy="83" rx="25" ry="5.5" fill="rgb(15 23 42 / 0.16)" />
      {renderPetShape(pet, `url(#${bodyId})`, colors)}
      <ellipse cx="39" cy="35" rx="21" ry="17" fill={`url(#${shineId})`} />
      {renderPetMark(pet, colors)}
      {renderFace(mood)}
      {renderMoodAccent(mood, colors)}
    </svg>
  );
}

export function StudentLogoMark({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, "");
  const bodyId = `student-logo-${uid}-body`;
  const pageId = `student-logo-${uid}-page`;
  return (
    <svg
      viewBox="0 0 64 64"
      role="img"
      aria-label="Vocab App student logo"
      className={cn(
        "h-10 w-10 overflow-visible drop-shadow-[0_10px_18px_rgb(15_23_42/0.18)]",
        className,
      )}
    >
      <defs>
        <linearGradient id={bodyId} x1="12" y1="9" x2="54" y2="58" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#58cc02" />
          <stop offset="1" stopColor="#16a34a" />
        </linearGradient>
        <linearGradient id={pageId} x1="22" y1="18" x2="45" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e0f2fe" />
        </linearGradient>
      </defs>
      <path
        d="M10 23.5c0-8.1 6.5-14.6 14.6-14.6h14.8C47.5 8.9 54 15.4 54 23.5v13.9C54 48 46.5 55.1 32 58 17.5 55.1 10 48 10 37.4V23.5Z"
        fill={`url(#${bodyId})`}
      />
      <path
        d="M17 23.6c0-5 4-9 9-9h13.3c4.2 0 7.7 3.4 7.7 7.7v17.9c-3.1-1.6-7-2.4-11.7-2.4H25c-4.4 0-8 3.6-8 8V23.6Z"
        fill={`url(#${pageId})`}
      />
      <path
        d="M24 23.5h14.7M24 30.4h12M24 37.3h8.5"
        stroke="#0f172a"
        strokeOpacity="0.34"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <path
        d="M45.5 15.5 51 10l2.4 7.4 7.1 2.6-6.4 4.2.2 7.7-6.1-4.8-7.1 2.1 2.7-7.2-4.4-6.1 7.6.1Z"
        fill="#ffc800"
      />
      <path
        d="M48 18.1 50 16l.9 2.8 2.7 1-2.4 1.6.1 2.9-2.3-1.8-2.7.8 1-2.7-1.7-2.3 2.9.1Z"
        fill="#fff7ad"
      />
    </svg>
  );
}

function renderPetShape(pet: StudentPetId, fill: string, colors: ReturnType<typeof petColors>) {
  if (pet === "miso") {
    return (
      <g>
        <path
          d="M25 41c-9 5-12 15-7 25 5 11 17 18 31 18s26-7 31-18c5-10 2-20-7-25l-7-20-15 12c-1-.1-2-.1-3-.1s-2 0-3 .1L30 21l-5 20Z"
          fill={fill}
        />
        <path
          d="M30 23 43 34c-6 1-11 3-16 7l3-18Zm36 0-3 18c-5-4-10-6-16-7l19-11Z"
          fill={colors.dark}
          opacity="0.55"
        />
      </g>
    );
  }
  if (pet === "pip") {
    return (
      <g>
        <path
          d="M48 13c11 9 24 22 24 40 0 18-10 31-24 31S24 71 24 53c0-18 13-31 24-40Z"
          fill={fill}
        />
        <path
          d="M49 10c1 11 8 14 16 15-8 3-12 8-13 17-3-8-8-12-17-13 8-3 13-8 14-19Z"
          fill="#fff7ad"
          opacity="0.9"
        />
      </g>
    );
  }
  if (pet === "zuri") {
    return (
      <g>
        <path d="M18 54c0-19 13-33 30-33s30 14 30 33c0 17-12 30-30 30S18 71 18 54Z" fill={fill} />
        <path
          d="M28 28c2-9 8-15 17-17-3 7-3 13 0 18l-17-1Zm40 0c-2-9-8-15-17-17 3 7 3 13 0 18l17-1Z"
          fill={colors.light}
        />
      </g>
    );
  }
  return (
    <g>
      <path d="M18 52c0-18 13-31 30-31s30 13 30 31c0 19-12 32-30 32S18 71 18 52Z" fill={fill} />
      <path
        d="M31 25c1-9 7-15 17-17 10 2 16 8 17 17-5-3-11-5-17-5s-12 2-17 5Z"
        fill={colors.light}
      />
    </g>
  );
}

function renderPetMark(pet: StudentPetId, colors: ReturnType<typeof petColors>) {
  if (pet === "miso") {
    return (
      <path
        d="M36 70c5 3 19 3 24 0"
        stroke="white"
        strokeOpacity="0.42"
        strokeWidth="5"
        strokeLinecap="round"
      />
    );
  }
  if (pet === "pip") {
    return (
      <path
        d="M48 60 41 72h14l-5 10"
        stroke="white"
        strokeOpacity="0.52"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    );
  }
  if (pet === "zuri") {
    return (
      <path
        d="M33 68c6 6 24 6 30 0"
        stroke={colors.light}
        strokeOpacity="0.62"
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
    );
  }
  return (
    <path d="M48 61 52 70l10 1-8 6 2 10-8-5-8 5 2-10-8-6 10-1 4-9Z" fill="white" opacity="0.34" />
  );
}

function renderFace(mood: StudentPetMood) {
  if (mood === "cheering") {
    return (
      <g stroke="#0f172a" strokeWidth="3" strokeLinecap="round" fill="none">
        <path d="M34 48q5-6 10 0" />
        <path d="M52 48q5-6 10 0" />
        <path d="M40 60q8 10 16 0" fill="#0f172a" stroke="none" />
      </g>
    );
  }
  if (mood === "sad") {
    return (
      <g>
        <circle cx="39" cy="49" r="3.7" fill="#0f172a" />
        <circle cx="57" cy="49" r="3.7" fill="#0f172a" />
        <path
          d="M40 65q8-7 16 0"
          stroke="#0f172a"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      </g>
    );
  }
  return (
    <g>
      <circle cx="39" cy="49" r="4.2" fill="#0f172a" />
      <circle cx="57" cy="49" r="4.2" fill="#0f172a" />
      <circle cx="40.5" cy="47.5" r="1.3" fill="white" />
      <circle cx="58.5" cy="47.5" r="1.3" fill="white" />
      {mood === "thinking" ? (
        <path d="M42 64h12" stroke="#0f172a" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path
          d="M40 61q8 7 16 0"
          stroke="#0f172a"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
      )}
    </g>
  );
}

function renderMoodAccent(mood: StudentPetMood, colors: ReturnType<typeof petColors>) {
  if (mood === "thinking") {
    return (
      <g fill={colors.light} stroke="#0f172a" strokeOpacity="0.2" strokeWidth="1">
        <circle cx="68" cy="25" r="3" />
        <circle cx="76" cy="18" r="4" />
        <circle cx="84" cy="10" r="5" />
      </g>
    );
  }
  if (mood === "cheering") {
    return (
      <g stroke={colors.light} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M17 36 8 29" />
        <path d="M79 36 88 29" />
        <path d="M48 13V4" />
      </g>
    );
  }
  return null;
}

function petColors(pet: StudentPetId): { main: string; light: string; dark: string } {
  if (pet === "miso") return { main: "#58cc02", light: "#bbf7d0", dark: "#16a34a" };
  if (pet === "pip") return { main: "#ff9e4a", light: "#fff7ad", dark: "#ea580c" };
  if (pet === "zuri") return { main: "#ff86bf", light: "#f5d0fe", dark: "#be4bdb" };
  return { main: "#1cb0f6", light: "#a5f3fc", dark: "#2563eb" };
}
