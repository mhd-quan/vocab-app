import { cn } from "@/lib/cn";
import {
  AppWindow,
  ArrowRight,
  BookBookmark,
  BookOpen,
  BookOpenText,
  Calendar,
  CaretDown,
  Check,
  CircleNotch,
  Crosshair,
  Crown,
  Diamond,
  DownloadSimple,
  FileText,
  Flame,
  GraduationCap,
  Headphones,
  Heart,
  type Icon,
  Keyboard,
  Lock,
  Microphone,
  Monitor,
  PencilSimple,
  PlayCircle,
  SlidersHorizontal,
  Sparkle,
  SpeakerHigh,
  SquaresFour,
  Star,
  Stop,
  Target,
  Tray,
  Trophy,
  User,
  UsersThree,
  Warning,
  X,
} from "@phosphor-icons/react";

export type AppGlyphName =
  | "accuracy"
  | "app"
  | "arrowRight"
  | "book"
  | "calendar"
  | "check"
  | "chevronDown"
  | "content"
  | "crown"
  | "dashboard"
  | "dictionary"
  | "download"
  | "edit"
  | "flame"
  | "gem"
  | "headphones"
  | "heart"
  | "import"
  | "keyboard"
  | "lesson"
  | "lock"
  | "microphone"
  | "person"
  | "playAudio"
  | "settings"
  | "spark"
  | "spinner"
  | "star"
  | "stop"
  | "studentMode"
  | "students"
  | "target"
  | "trophy"
  | "tutorMode"
  | "volume"
  | "warning"
  | "x";

export interface AppGlyphProps {
  name: AppGlyphName;
  className?: string;
  filled?: boolean;
}

// Phosphor's `regular` weight is the SF-Symbol-style stroke look used across
// the app. `filled` opts in to Phosphor's `fill` variant for emphasis (hearts,
// XP spark, stop button).
const GLYPHS: Record<AppGlyphName, Icon> = {
  accuracy: Target,
  app: AppWindow,
  arrowRight: ArrowRight,
  book: BookOpen,
  calendar: Calendar,
  check: Check,
  chevronDown: CaretDown,
  content: FileText,
  crown: Crown,
  dashboard: SquaresFour,
  dictionary: BookBookmark,
  download: DownloadSimple,
  edit: PencilSimple,
  flame: Flame,
  gem: Diamond,
  headphones: Headphones,
  heart: Heart,
  import: Tray,
  keyboard: Keyboard,
  lesson: BookOpenText,
  lock: Lock,
  microphone: Microphone,
  person: User,
  playAudio: PlayCircle,
  settings: SlidersHorizontal,
  spark: Sparkle,
  spinner: CircleNotch,
  star: Star,
  stop: Stop,
  studentMode: GraduationCap,
  students: UsersThree,
  target: Crosshair,
  trophy: Trophy,
  tutorMode: Monitor,
  volume: SpeakerHigh,
  warning: Warning,
  x: X,
};

export function AppGlyph({ name, className, filled = false }: AppGlyphProps) {
  const Icon = GLYPHS[name];
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      weight={filled ? "fill" : "regular"}
      className={cn("h-5 w-5 shrink-0", className)}
    />
  );
}
