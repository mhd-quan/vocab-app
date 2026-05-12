import { queryClient } from "@/lib/queryClient";
import { AppModeProvider } from "@/providers/AppModeProvider";
import { DisplayPreferencesProvider } from "@/providers/DisplayPreferencesProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { AppRoot } from "@/ui/shell/AppRoot";
import { QueryClientProvider } from "@tanstack/react-query";

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <DisplayPreferencesProvider>
          <AppModeProvider>
            <AppRoot />
          </AppModeProvider>
        </DisplayPreferencesProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
