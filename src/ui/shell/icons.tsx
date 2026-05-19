import { AppGlyph } from "@/ui/components/AppGlyph";

interface GlyphProps {
  className?: string;
}

export const DashboardIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="dashboard" className={className} />
);

export const StudentsIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="students" className={className} />
);

export const ContentIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="content" className={className} />
);

export const DictionaryIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="dictionary" className={className} />
);

export const ImportsIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="import" className={className} />
);

export const SettingsIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="settings" className={className} />
);

export const LockIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="lock" className={className} />
);

export const StudentModeIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="studentMode" className={className} />
);

export const TutorModeIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="tutorMode" className={className} />
);

export const EditIcon = ({ className }: GlyphProps) => (
  <AppGlyph name="edit" className={className} />
);
