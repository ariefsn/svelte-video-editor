import { getContext, setContext } from 'svelte';

export type NotifyKind = 'error' | 'info' | 'success' | 'warning';
export type NotifyFn = (message: string, kind: NotifyKind) => void;

// Transient-notification sink. The editor sets it from the host's optional
// `onNotify` prop; components call `notify(message, kind)` instead of importing
// a toast library. When the host supplies nothing, notifications no-op.

const KEY = Symbol.for('svelte-timeline-studio-notify');

export function setNotify(fn: NotifyFn): NotifyFn {
	return setContext(KEY, fn);
}

export function useNotify(): NotifyFn {
	return getContext<NotifyFn>(KEY) ?? (() => {});
}
