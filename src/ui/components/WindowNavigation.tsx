import { type ReactNode, createContext, useContext, useEffect, useMemo } from "react";

export interface WindowBackRegistration {
  pathname: string;
  label: string;
  onBack: () => void;
}

type RegisterWindowBack = (registration: WindowBackRegistration) => () => void;

const WindowBackContext = createContext<{
  pathname: string;
  register: RegisterWindowBack;
} | null>(null);

export function WindowNavigationProvider({
  register,
  pathname,
  children,
}: {
  register: RegisterWindowBack;
  pathname: string;
  children: ReactNode;
}) {
  const value = useMemo(() => ({ register, pathname }), [pathname, register]);
  return <WindowBackContext.Provider value={value}>{children}</WindowBackContext.Provider>;
}

/**
 * Lets a routed view replace the shell's default Back behavior. Sessions use
 * this to finish persistence before leaving while keeping the control in the
 * same toolbar position as every other view.
 */
export function useWindowBackAction(label: string, onBack: () => void) {
  const context = useContext(WindowBackContext);

  useEffect(() => {
    if (!context) return;
    return context.register({ pathname: context.pathname, label, onBack });
  }, [context, label, onBack]);

  return context !== null;
}
