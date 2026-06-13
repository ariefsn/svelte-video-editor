import { browser } from '$app/environment';

// Demo-only dark/light toggle (host concern, not the library).
const KEY = 'sts-demo.theme';

class Theme {
	dark = $state(false);

	init() {
		if (!browser) return;
		this.dark = localStorage.getItem(KEY) === 'dark';
		this.apply();
	}

	toggle() {
		this.dark = !this.dark;
		this.apply();
		if (browser) localStorage.setItem(KEY, this.dark ? 'dark' : 'light');
	}

	private apply() {
		if (browser) document.documentElement.classList.toggle('dark', this.dark);
	}
}

export const theme = new Theme();
