import { getContext, setContext } from 'svelte';

export type ContextMenuCtx = {
	get open(): boolean;
	get x(): number;
	get y(): number;
	openAt(x: number, y: number): void;
	close(): void;
};

const KEY = Symbol('ts-context-menu');

export function setContextMenuCtx(ctx: ContextMenuCtx): ContextMenuCtx {
	return setContext(KEY, ctx);
}

export function useContextMenuCtx(): ContextMenuCtx {
	return getContext<ContextMenuCtx>(KEY);
}
