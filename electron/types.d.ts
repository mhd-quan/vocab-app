declare module "electron-squirrel-startup" {
  const started: boolean;
  export default started;
}

// Constants injected by @electron-forge/plugin-vite at build time.
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;
