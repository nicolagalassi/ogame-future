// Tampermonkey / Violentmonkey storage API (granted in the userscript header).
declare function GM_getValue<T = unknown>(key: string, defaultValue?: T): T;
declare function GM_setValue(key: string, value: unknown): void;
