import { api } from "@/lib/api";
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
    <div className="flex flex-col gap-3 rounded-xl border border-warning/35 bg-warning/10 px-4 py-3 text-sm text-warning">
      <p>{message}</p>
      {canOpenSettings ? (
        <div className="flex flex-wrap items-center gap-3">
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
            <span className="text-xs text-muted-2">Restart Vocab App after changing access.</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
