// A small ring buffer of uncaught errors and failed promises, for the admin panel's Debug tab. Nothing leaves the device.
export interface LoggedError {
  at: string;
  message: string;
  source?: string;
}

const MAX = 50;
export const errorLog: LoggedError[] = [];

function push(message: string, source?: string): void {
  errorLog.push({ at: new Date().toISOString(), message: message.slice(0, 500), source: source?.slice(0, 200) });
  if (errorLog.length > MAX) errorLog.splice(0, errorLog.length - MAX);
}

export function installErrorLog(w: Window = window): void {
  w.addEventListener('error', (e) => push(e.message || String(e.error), e.filename ? `${e.filename}:${e.lineno}` : undefined));
  w.addEventListener('unhandledrejection', (e) => push(e.reason instanceof Error ? e.reason.message : String(e.reason), 'promise'));
}
