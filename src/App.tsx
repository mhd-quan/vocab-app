import { queryClient } from "@/lib/queryClient";
import { AppModeProvider } from "@/providers/AppModeProvider";
import { AppRoot } from "@/ui/shell/AppRoot";
import { QueryClientProvider } from "@tanstack/react-query";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppModeProvider>
        <AppRoot />
      </AppModeProvider>
    </QueryClientProvider>
  );
}
