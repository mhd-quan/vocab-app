import { cn } from "@/lib/cn";
import {
  AppWindow,
  ArrowRight,
  BookBookmark,
  BookOpen,
  BookOpenText,
  Calendar,
  CaretDown,
  CaretLeft,
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
  MagnifyingGlass,
  Microphone,
  Monitor,
  PencilSimple,
  PlayCircle,
  SidebarSimple,
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
  | "back"
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
  | "search"
  | "person"
  | "playAudio"
  | "settings"
  | "sidebar"
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
  size?: "sm" | "md" | "lg";
}

const GLYPH_SIZES: Record<NonNullable<AppGlyphProps["size"]>, string> = {
  sm: "h-4 w-4",
  md: "h-[18px] w-[18px]",
  lg: "h-5 w-5",
};

// Phosphor's `regular` weight is the SF-Symbol-style stroke look used across
// the app. `filled` opts in to Phosphor's `fill` variant for emphasis (hearts,
// XP spark, stop button).
const GLYPHS: Record<AppGlyphName, Icon> = {
  accuracy: Target,
  app: AppWindow,
  arrowRight: ArrowRight,
  back: CaretLeft,
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
  search: MagnifyingGlass,
  person: User,
  playAudio: PlayCircle,
  settings: SlidersHorizontal,
  sidebar: SidebarSimple,
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

export function AppGlyph({ name, className, filled = false, size = "md" }: AppGlyphProps) {
  const Icon = GLYPHS[name];
  return (
    <Icon
      aria-hidden="true"
      focusable="false"
      weight={filled ? "fill" : "regular"}
      className={cn("shrink-0", GLYPH_SIZES[size], className)}
    />
  );
}
