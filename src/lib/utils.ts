import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge conditional + conflicting Tailwind classes. */
export function cn(...inputs: ClassValue[]): string {
	return twMerge(clsx(inputs));
}

/**
 * Generate a UUID. Uses the built-in Web Crypto `crypto.randomUUID()` when
 * available (all modern browsers + Node 19+), and falls back to a
 * `crypto.getRandomValues`-based v4 UUID for old Safari / non-secure (http://)
 * contexts, then to `Math.random()` as a last resort. Zero dependencies.
 */
export function uid(): string {
	const c: Crypto | undefined =
		typeof globalThis !== 'undefined' ? (globalThis.crypto as Crypto | undefined) : undefined;
	if (c?.randomUUID) return c.randomUUID();

	const bytes = new Uint8Array(16);
	if (c?.getRandomValues) {
		c.getRandomValues(bytes);
	} else {
		for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256);
	}
	// Per RFC 4122 v4.
	bytes[6] = (bytes[6] & 0x0f) | 0x40;
	bytes[8] = (bytes[8] & 0x3f) | 0x80;
	const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0'));
	return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex
		.slice(6, 8)
		.join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Format an epoch-ms timestamp as a short local date-time label using the
 * built-in `Intl.DateTimeFormat` (no `dayjs`/external dependency).
 */
export function formatLocalDateTime(epochMs: number, locale?: string): string {
	return new Intl.DateTimeFormat(locale, {
		dateStyle: 'medium',
		timeStyle: 'short'
	}).format(new Date(epochMs));
}
