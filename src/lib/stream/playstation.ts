// Play → Stream → PlayStation: the console is reached through an app on the gaming PC (chiaki-ng, an open-source
// PlayStation Remote Play client, added to Apollo's applications), since a browser can't speak Sony's protocol itself.
import type { StreamApp } from './api';

const PLAYSTATION = /playstation|\bps[45]\b|chiaki|remote play/i;

/** Whether an Apollo app name looks like the PlayStation Remote Play app. */
export function isPlayStationApp(name: string): boolean {
  return PLAYSTATION.test(name);
}

/** The first app that opens PlayStation Remote Play on the PC, or null when it isn't set up. */
export function findPlayStationApp(apps: StreamApp[]): StreamApp | null {
  return apps.find((a) => isPlayStationApp(a.name)) ?? null;
}
