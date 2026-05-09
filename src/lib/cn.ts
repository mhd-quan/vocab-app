import clsx, { type ClassValue } from "clsx";

/** className utility that's friendly to conditional + array inputs. */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}
