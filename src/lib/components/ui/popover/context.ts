import { getContext, setContext } from 'svelte';

export type PopoverCtx = {
	get open(): boolean;
	set open(v: boolean);
	contentId: string;
};

const KEY = Symbol('ts-popover');

export function setPopoverCtx(ctx: PopoverCtx): PopoverCtx {
	return setContext(KEY, ctx);
}

export function usePopoverCtx(): PopoverCtx {
	return getContext<PopoverCtx>(KEY);
}
