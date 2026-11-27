// Tampermonkey / Violentmonkey storage API (granted in the userscript header).
declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
declare function GM_listValues(): string[];
declare function GM_deleteValue(key: string): void;

// Fonts bundled into the script as base64 (scripts/build.mjs, loader '.woff2': 'base64').
declare module '*.woff2' {
  const data: string;
  export default data;
}
