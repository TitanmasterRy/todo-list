import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import { setupPwa } from './lib/pwa.svelte';

const app = mount(App, { target: document.getElementById('app')! });
setupPwa();

export default app;
