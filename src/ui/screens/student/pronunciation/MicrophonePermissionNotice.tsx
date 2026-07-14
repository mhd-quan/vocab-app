import { api } from "@/lib/api";
import { AppGlyph } from "@/ui/components/AppGlyph";
import { Button } from "@/ui/components/Button";

type MicrophonePermissionView = Awaited<ReturnType<typeof api.permissions.microphoneStatus>>;

interface MicrophonePermissionNoticeProps {
  message: string;
  permission: MicrophonePermissionView | null;
}

export function MicrophonePermissionNotice({
  message,
  permission,
}: MicrophonePermissionNoticeProps) {
  const canOpenSettings = permission?.requiresSystemSettings && permission.canOpenSettings;

  return (
    <div
      role="alert"
      className="mt-4 rounded-control border-l-2 border-warning bg-warning/10 px-4 py-3"
    >
      <div className="flex gap-2.5">
        <AppGlyph name="warning" size="sm" className="mt-0.5 text-warning" />
        <div className="min-w-0 flex-1">
          <p className="text-sm leading-5 text-app">{message}</p>
          {canOpenSettings ? (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  void api.permissions.openMicrophoneSettings();
                }}
              >
                Open microphone settings
              </Button>
              {permission.requiresRestart ? (
                <span className="text-xs text-muted">Restart Vocab after changing access.</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
