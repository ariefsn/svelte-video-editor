import { getContext, setContext } from 'svelte';

export type ConfirmOptions = { title: string; message?: string };
export type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

/**
 * Confirmation provider. A host may supply its own `confirm` callback (its own
 * dialog / native confirm); otherwise the editor renders a built-in
 * ConfirmDialog. Components request confirmation via `requestConfirm()` and
 * never touch a dialog component directly.
 */
export type ConfirmController = {
	/** Resolve a confirmation; returns true to proceed. */
	requestConfirm: ConfirmFn;
	/** Built-in dialog state (used only when no host `confirm` is supplied). */
	readonly builtin: {
		open: boolean;
		title: string;
		message: string;
	};
	/** Built-in dialog wiring. */
	resolveBuiltin(ok: boolean): void;
};

const KEY = Symbol.for('svelte-video-editor-confirm');

/**
 * Create a controller. Pass the host `confirm` callback if any; otherwise the
 * built-in dialog state drives confirmations.
 */
export function createConfirmController(
	getHostConfirm: () => ConfirmFn | undefined
): ConfirmController {
	const builtin = $state({ open: false, title: '', message: '' });
	let pending: ((ok: boolean) => void) | null = null;

	const requestConfirm: ConfirmFn = (opts) => {
		const hostConfirm = getHostConfirm();
		if (hostConfirm) return hostConfirm(opts);
		return new Promise<boolean>((resolve) => {
			builtin.title = opts.title;
			builtin.message = opts.message ?? '';
			builtin.open = true;
			pending = resolve;
		});
	};

	function resolveBuiltin(ok: boolean): void {
		builtin.open = false;
		const resolve = pending;
		pending = null;
		resolve?.(ok);
	}

	return {
		requestConfirm,
		get builtin() {
			return builtin;
		},
		resolveBuiltin
	};
}

export function setConfirmController(c: ConfirmController): ConfirmController {
	return setContext(KEY, c);
}

export function useConfirm(): ConfirmController {
	return getContext<ConfirmController>(KEY);
}
