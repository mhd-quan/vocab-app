import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { queryClient, queryKeys } from "@/lib/queryClient";
import { Avatar } from "@/ui/components/Avatar";
import { Badge } from "@/ui/components/Badge";
import { BentoCard } from "@/ui/components/BentoCard";
import { Button } from "@/ui/components/Button";
import { Field, TextInput } from "@/ui/components/Field";
import { STUDENT_PETS, StudentPetIcon, parsePetSeed } from "@/ui/student/pets";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";

const COLORS = [
  "#38bdf8",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#ec4899",
  "#8b5cf6",
  "#14b8a6",
  "#f97316",
  "#84cc16",
  "#64748b",
];
const EMOJI_SETS = [
  "😀 😎 🤓 🥳 🦊 🐼 🐯 🦁 🐸 🐵 🐲 🦄 🐧 🦉 🚀 ⭐ 🔥 💎 👑 🎯".split(" "),
  "🍀 🌈 ⚡ 🌙 ☀️ 🪐 🎮 🎧 📚 ✏️ 🧠 🏆 🥇 🎨 🧩".split(" "),
].flat();
const BG_PRESETS = [
  { id: "none", label: "Clean light", value: "" },
  { id: "sunrise", label: "Sunrise", value: "linear-gradient(135deg,#fff7ed,#fef3c7 45%,#ecfeff)" },
  {
    id: "mint",
    label: "Mint field",
    value:
      "radial-gradient(circle at 20% 20%,#bbf7d0,transparent 35%),linear-gradient(135deg,#f0fdf4,#e0f2fe)",
  },
  {
    id: "paper",
    label: "Paper dots",
    value: "radial-gradient(#cbd5e1 1px,transparent 1px),#f8fafc",
  },
  { id: "peach", label: "Peach pop", value: "linear-gradient(160deg,#ffedd5,#fce7f3 55%,#e0f2fe)" },
  {
    id: "ocean",
    label: "Ocean glass",
    value:
      "radial-gradient(circle at 18% 18%,#bae6fd,transparent 33%),radial-gradient(circle at 82% 28%,#99f6e4,transparent 30%),linear-gradient(135deg,#f8fafc,#dbeafe 48%,#cffafe)",
  },
  {
    id: "cosmic",
    label: "Cosmic study",
    value:
      "radial-gradient(circle at 20% 22%,#c4b5fd 0 9%,transparent 10%),radial-gradient(circle at 78% 18%,#f0abfc 0 7%,transparent 8%),linear-gradient(135deg,#f8fafc,#e0e7ff 45%,#fdf2f8)",
  },
  {
    id: "notebook",
    label: "Notebook grid",
    value:
      "repeating-linear-gradient(0deg,#dbeafe 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,#dbeafe 0 1px,transparent 1px 28px),#f8fafc",
  },
  {
    id: "forest",
    label: "Forest calm",
    value:
      "radial-gradient(circle at 18% 20%,#bbf7d0,transparent 34%),linear-gradient(145deg,#f7fee7,#dcfce7 48%,#e0f2fe)",
  },
  {
    id: "arcade",
    label: "Arcade lights",
    value:
      "radial-gradient(circle at 18% 22%,#fef08a 0 9%,transparent 10%),radial-gradient(circle at 78% 24%,#f9a8d4 0 8%,transparent 9%),linear-gradient(135deg,#eef2ff,#cffafe 55%,#fae8ff)",
  },
];
const BACKGROUND_MAX_EDGE = 1920;
const BACKGROUND_INLINE_LIMIT_BYTES = 1_500_000;
const BACKGROUND_JPEG_QUALITY = 0.82;
const BACKGROUND_SIZE_OPTIONS = [
  { id: "cover", label: "Fill screen", value: "cover" },
  { id: "contain", label: "Fit image", value: "contain" },
  { id: "auto", label: "Tile original", value: "auto" },
] as const;
type BackgroundSizeMode = (typeof BACKGROUND_SIZE_OPTIONS)[number]["value"];

export function StudentSettings() {
  const { studentId } = useParams({ from: "/student/profile/$studentId/settings" });
  const id = Number(studentId);
  const studentQ = useQuery({
    queryKey: queryKeys.students.byId(id),
    queryFn: () => api.students.getById({ id }),
    enabled: Number.isFinite(id) && id > 0,
  });
  const bgQ = useQuery({
    queryKey: queryKeys.studentPrefs.studyBackground(id),
    queryFn: () => api.settings.get<string>({ key: bgKey(id) }),
    enabled: Number.isFinite(id) && id > 0,
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
  });
  const [nickname, setNickname] = useState("");
  const [emojiSearch, setEmojiSearch] = useState("");
  const [backgroundSize, setBackgroundSize] = useState<BackgroundSizeMode>("cover");
  const student = studentQ.data;
  const display = nickname || student?.displayName || student?.name || "";
  const selectedPet = parsePetSeed(student?.avatarSeed);
  const saveStudent = useMutation({
    mutationFn: (patch: {
      displayName?: string | null;
      avatarSeed?: string | null;
      color?: string | null;
    }) => api.students.update({ id, patch }),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.students.byId(id), updated);
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });
  const saveBg = useMutation({
    mutationFn: (value: string) => api.settings.set({ key: bgKey(id), value }),
    onSuccess: (_result, value) =>
      queryClient.setQueryData(queryKeys.studentPrefs.studyBackground(id), value),
  });

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-8 py-10">
      <Link
        to="/student/profile/$studentId"
        params={{ studentId: String(id) }}
        className="self-start text-xs font-medium text-muted hover:text-app"
      >
        Back to lessons
      </Link>
      <BentoCard tone="focus" className="grid gap-5 p-6 sm:grid-cols-[auto_1fr] sm:items-center">
        <Avatar
          name={display || "?"}
          avatarSeed={student?.avatarSeed}
          color={student?.color}
          size="lg"
        />
        <div>
          <Badge tone="focus" uppercase>
            Student fun settings
          </Badge>
          <h1 className="mt-2 font-display text-4xl font-semibold">Customize your study vibe</h1>
          <p className="mt-1 text-sm text-muted">
            Nickname, avatar, colors, emoji, background only. No app controls here.
          </p>
        </div>
      </BentoCard>

      <section className="grid gap-5 lg:grid-cols-2">
        <BentoCard className="p-5">
          <h2 className="font-display text-2xl font-semibold">Nickname</h2>
          <Field label="Nickname">
            <TextInput
              value={nickname || student?.displayName || ""}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={80}
            />
          </Field>
          <Button
            className="mt-3"
            onClick={() =>
              saveStudent.mutate({
                displayName: (nickname || student?.displayName || "").trim() || null,
              })
            }
          >
            Save nickname
          </Button>
        </BentoCard>

        <BentoCard className="p-5">
          <h2 className="font-display text-2xl font-semibold">Avatar color</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {COLORS.map((color) => (
              <button
                key={color}
                type="button"
                className="h-10 w-10 rounded-full border-2 border-white shadow-card"
                style={{ backgroundColor: color }}
                onClick={() => saveStudent.mutate({ color })}
                aria-label={color}
              />
            ))}
          </div>
        </BentoCard>

        <BentoCard className="p-5 lg:col-span-2">
          <h2 className="font-display text-2xl font-semibold">Study pet</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {STUDENT_PETS.map((pet) => {
              const selected = selectedPet === pet.id;
              return (
                <button
                  key={pet.id}
                  type="button"
                  aria-pressed={selected}
                  className={cn(
                    "group flex min-h-36 flex-col items-center justify-between rounded-bento border p-4 text-center shadow-card transition-[background-color,border-color,box-shadow,transform]",
                    selected
                      ? "border-accent/60 bg-accent/10 shadow-glow"
                      : "border-border-subtle bg-surface-1 hover:-translate-y-1 hover:border-accent/40 hover:bg-surface-2",
                  )}
                  onClick={() => saveStudent.mutate({ avatarSeed: `pet:${pet.id}` })}
                >
                  <StudentPetIcon
                    pet={pet.id}
                    mood={selected ? "cheering" : "happy"}
                    className="h-20 w-20"
                  />
                  <span className="mt-2 text-base font-semibold">{pet.name}</span>
                  <span className="text-xs text-muted">{pet.tagline}</span>
                </button>
              );
            })}
          </div>
        </BentoCard>

        <BentoCard className="p-5 lg:col-span-2">
          <h2 className="font-display text-2xl font-semibold">Emoji avatar picker</h2>
          <Field label="Search or paste any Unicode emoji">
            <TextInput
              value={emojiSearch}
              onChange={(e) => setEmojiSearch(e.target.value)}
              placeholder="Paste emoji here: 🦄"
            />
          </Field>
          <div className="mt-4 flex flex-wrap gap-2">
            {[
              ...new Set([
                ...EMOJI_SETS,
                ...Array.from(emojiSearch).filter((ch) => /\p{Extended_Pictographic}/u.test(ch)),
              ]),
            ].map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="grid h-11 w-11 place-items-center rounded-2xl border border-border-subtle bg-surface-1 text-2xl shadow-sm transition hover:-translate-y-0.5"
                onClick={() => saveStudent.mutate({ avatarSeed: `emoji:${emoji}` })}
              >
                {emoji}
              </button>
            ))}
          </div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-button border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-surface-2">
            Upload avatar image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) =>
                readImage(e.currentTarget.files?.[0], (src) =>
                  saveStudent.mutate({ avatarSeed: `image:${src}` }),
                )
              }
            />
          </label>
        </BentoCard>

        <BentoCard className="p-5 lg:col-span-2">
          <h2 className="font-display text-2xl font-semibold">Study background</h2>
          <p className="mt-1 text-sm text-muted">
            Student study screens default to light mode when a custom background is active.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {BG_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="h-24 rounded-2xl border border-border-subtle bg-surface-1 p-3 text-left text-sm font-semibold shadow-card transition hover:-translate-y-0.5 hover:border-accent/40"
                style={{ background: preset.value || "#f8fafc" }}
                onClick={() => saveBg.mutate(preset.value)}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {BACKGROUND_SIZE_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                aria-pressed={backgroundSize === option.value}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs font-semibold transition-[background-color,border-color,color]",
                  backgroundSize === option.value
                    ? "border-accent bg-accent/10 text-app"
                    : "border-border-subtle bg-surface-1 text-muted hover:border-accent/40 hover:text-app",
                )}
                onClick={() => setBackgroundSize(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <label className="mt-4 inline-flex cursor-pointer items-center gap-2 rounded-button border border-border-subtle px-4 py-2 text-sm font-semibold hover:bg-surface-2">
            Upload background image
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) =>
                readBackgroundImage(e.currentTarget.files?.[0], (src) =>
                  saveBg.mutate(backgroundCss(src, backgroundSize)),
                )
              }
            />
          </label>
          {bgQ.data ? (
            <Button variant="secondary" className="ml-3" onClick={() => saveBg.mutate("")}>
              Reset background
            </Button>
          ) : null}
        </BentoCard>
      </section>
    </div>
  );
}

function bgKey(studentId: number): string {
  return `student_profile:${studentId}:study_background`;
}

function backgroundCss(src: string, size: BackgroundSizeMode): string {
  const repeat = size === "auto" ? "repeat" : "no-repeat";
  return `url(${src}) center / ${size} ${repeat}`;
}

function readImage(file: File | undefined, done: (src: string) => void) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result === "string") done(reader.result);
  };
  reader.readAsDataURL(file);
}

function readBackgroundImage(file: File | undefined, done: (src: string) => void) {
  if (!file) return;
  const objectUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = "async";
  let settled = false;

  const fallback = () => {
    if (settled) return;
    settled = true;
    URL.revokeObjectURL(objectUrl);
    readImage(file, done);
  };

  const finish = () => {
    if (settled) return;
    settled = true;
    try {
      const { width, height } = scaledBackgroundSize(image.naturalWidth, image.naturalHeight);
      if (width <= 0 || height <= 0) {
        URL.revokeObjectURL(objectUrl);
        readImage(file, done);
        return;
      }
      if (
        file.size <= BACKGROUND_INLINE_LIMIT_BYTES &&
        width === image.naturalWidth &&
        height === image.naturalHeight
      ) {
        URL.revokeObjectURL(objectUrl);
        readImage(file, done);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        URL.revokeObjectURL(objectUrl);
        readImage(file, done);
        return;
      }
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      done(canvas.toDataURL("image/jpeg", BACKGROUND_JPEG_QUALITY));
    } catch {
      readImage(file, done);
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  image.onload = finish;
  image.onerror = fallback;
  image.src = objectUrl;
  const decodePromise = image.decode?.();
  if (decodePromise) void decodePromise.then(finish, fallback);
}

function scaledBackgroundSize(width: number, height: number): { width: number; height: number } {
  const edge = Math.max(width, height);
  if (!Number.isFinite(edge) || edge <= 0) return { width: 0, height: 0 };
  if (edge <= BACKGROUND_MAX_EDGE) return { width, height };
  const scale = BACKGROUND_MAX_EDGE / edge;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
