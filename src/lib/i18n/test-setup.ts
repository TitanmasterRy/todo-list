// Vitest setup: load the English strings before any test runs (the app does this in store.init()).
import { setLocale } from './index.svelte';

await setLocale('en');
