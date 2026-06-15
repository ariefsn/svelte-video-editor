<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import type { BinItem, TimelineProject } from '../../types/timeline.js';
	import { Tooltip } from '../atoms/index.js';
	import ConfirmDialog from '../molecules/ConfirmDialog.svelte';
	import Sheet from '../molecules/Sheet.svelte';
	import { createIsMobile, setViewport } from '../../core/viewport.svelte.js';
	import { migrateProject } from '../../core/migration.js';
	import { setEditorHost, type EditorHost, type SectionCtx } from '../../core/host.js';
	import type { OpFailReason } from '../../core/ops.js';
	import { setTimelineEditor, TimelineEditorStore } from '../../core/state.svelte.js';
	import {
		resolveMessages,
		setMessagesProvider,
		type MessageKey,
		type MessagesOverride
	} from '../../i18n/messages.js';
	import { setNotify, type NotifyFn } from '../../core/notify.js';
	import {
		createConfirmController,
		setConfirmController,
		type ConfirmFn
	} from '../../core/confirm.svelte.js';
	import AssetBinPanel from './AssetBinPanel.svelte';
	import InspectorPanel from './InspectorPanel.svelte';
	import PreviewStage from './PreviewStage.svelte';
	import ShortcutsFooter from './ShortcutsFooter.svelte';
	import TimelineToolbar from './TimelineToolbar.svelte';
	import TimelineTracks from './TimelineTracks.svelte';
	import TransportBar from './TransportBar.svelte';

	// Host-agnostic contract: serialized project in, debounced project out;
	// all external concerns (assets, thumbnails, export, gating, import UI,
	// notifications, confirmation, persistence) arrive via callbacks/snippets.
	// No fetches, no browser storage, no app services in here.
	type Props = {
		project: TimelineProject;
		onChange: (project: TimelineProject) => void;
		/** Debounce window (ms) for onChange. 0 = fire on every edit. */
		changeDebounceMs?: number;
		resolveAsset: EditorHost['resolveAsset'];
		generateThumbnail: EditorHost['generateThumbnail'];
		generateWaveform?: EditorHost['generateWaveform'];
		onExport: EditorHost['onExport'];
		can: EditorHost['can'];
		magneticMainTrack?: boolean;
		/** Optional. When provided, a back button renders and calls this. */
		onBack?: () => void;
		/** Transient feedback sink (blocked ops, clamped replace). No-ops if absent. */
		onNotify?: NotifyFn;
		/** Override any UI label; unspecified keys fall back to English. */
		messages?: MessagesOverride;
		/** Host-supplied confirmation; falls back to the built-in dialog. */
		confirm?: ConfirmFn;
		/** Initial timeline-pane height (px); host owns persistence. */
		timelineHeight?: number;
		/** Fired when the user drags the pane divider; host may persist it. */
		onTimelineHeightChange?: (height: number) => void;
		/** Initial bin-column width (px); host owns persistence. */
		binWidth?: number;
		/** Fired when the user drags the bin divider; host may persist it. */
		onBinWidthChange?: (width: number) => void;
		/** Initial inspector-column width (px); host owns persistence. */
		inspectorWidth?: number;
		/** Fired when the user drags the inspector divider; host may persist it. */
		onInspectorWidthChange?: (width: number) => void;
		/** Host-owned import UI rendered inside the bin panel. */
		binImport?: Snippet<[{ addItems: (items: BinItem[]) => void }]>;
		/** Optional section overrides. Each replaces the corresponding default
		 * section (including its wrapper element) and receives the editor
		 * context as its argument; omitted sections render the built-ins.
		 * On mobile (<768px) the `assetBin` and `inspector` overrides render
		 * inside a bottom sheet instead of a side column, so avoid fixed widths
		 * in those overrides. */
		toolbar?: Snippet<[SectionCtx]>;
		assetBin?: Snippet<[SectionCtx]>;
		preview?: Snippet<[SectionCtx]>;
		transport?: Snippet<[SectionCtx]>;
		inspector?: Snippet<[SectionCtx]>;
		tracks?: Snippet<[SectionCtx]>;
		shortcutsFooter?: Snippet<[SectionCtx]>;
	};

	let {
		project,
		onChange,
		changeDebounceMs = 800,
		resolveAsset,
		generateThumbnail,
		generateWaveform,
		onExport,
		can,
		magneticMainTrack = false,
		onBack,
		onNotify,
		messages,
		confirm,
		timelineHeight,
		onTimelineHeightChange,
		binWidth,
		onBinWidthChange,
		inspectorWidth,
		onInspectorWidthChange,
		binImport,
		toolbar,
		assetBin,
		preview,
		transport,
		inspector,
		tracks,
		shortcutsFooter
	}: Props = $props();

	// Resolve + provide messages, notify and confirm via context.
	const t = $derived(resolveMessages(messages));
	// Provide a reactive holder so descendants see live language swaps.
	setMessagesProvider({
		get current() {
			return t;
		}
	});
	const notify: NotifyFn = (message, kind) => onNotify?.(message, kind);
	setNotify(notify);
	const confirmCtl = createConfirmController(() => confirm);
	setConfirmController(confirmCtl);
	const builtinConfirm = confirmCtl.builtin;

	const failReasonKey: Record<OpFailReason, MessageKey> = {
		locked: 'opBlockedLocked',
		occupied: 'opBlockedOccupied',
		'not-contiguous': 'opBlockedContiguous',
		'no-target': 'opBlockedNoTarget',
		'no-audio': 'opBlockedNoAudio',
		invalid: 'opBlockedInvalid'
	};

	// The store is created once per mounted editor; the host remounts via
	// {#key project.id} when switching projects. Old serialized shapes are
	// upgraded on the way in.
	const editor = new TimelineEditorStore(migrateProject(project), {
		emitChange: onChange,
		notify: (reason) => notify(t[failReasonKey[reason]] as string, 'error'),
		magneticMainTrack: () => magneticMainTrack,
		emitDebounceMs: () => changeDebounceMs
	});
	setTimelineEditor(editor);
	const host = setEditorHost({
		resolveAsset,
		generateThumbnail,
		generateWaveform,
		onExport,
		can
	});

	onMount(() => () => editor.destroy());

	async function requestDeleteSelected() {
		if (editor.selectedClipIds.size === 0) return;
		const ok = await confirmCtl.requestConfirm({
			title: t.deleteClips,
			message: t.deleteClipsConfirm({ count: editor.selectedClipIds.size })
		});
		if (ok) editor.deleteSelected();
	}

	const sectionCtx: SectionCtx = {
		editor,
		host,
		onBack: onBack ? () => onBack?.() : undefined,
		onRequestDelete: requestDeleteSelected
	};

	// Responsive layout: below the `md` breakpoint the side panels (bin, inspector)
	// don't fit, so they move into bottom sheets. `isMobile` is false during SSR
	// and the first render (desktop-first), so the sidebars are the default.
	const viewport = createIsMobile();
	const isMobile = $derived(viewport.current);
	// Share with the section components (toolbar, tracks, footer) via context.
	setViewport({
		get isMobile() {
			return isMobile;
		}
	});
	let binSheetOpen = $state(false);
	let inspectorSheetOpen = $state(false);

	// Close the inspector sheet when the selection is cleared. (Opening is NOT
	// tied to selection — selecting a clip is also the start of a drag/trim, so
	// auto-opening here would block direct manipulation on mobile.)
	let lastActiveClipId: string | null = null;
	$effect(() => {
		const id = editor.activeClipId;
		if (id !== lastActiveClipId) {
			lastActiveClipId = id;
			if (!id) inspectorSheetOpen = false;
		}
	});

	// Open the inspector sheet on an explicit request — a tap (not a drag) on a
	// clip bumps `inspectorRequestSeq`. Mobile only; desktop has the side panel.
	let lastInspectorSeq = editor.inspectorRequestSeq;
	$effect(() => {
		const seq = editor.inspectorRequestSeq;
		if (seq !== lastInspectorSeq) {
			lastInspectorSeq = seq;
			if (isMobile && editor.activeClip) inspectorSheetOpen = true;
		}
	});

	// Preview/timeline split: the timeline pane has an explicit height (dragged
	// via the divider). The height is host-owned — initial value in via
	// `timelineHeight`, changes out via `onTimelineHeightChange`. The library
	// itself persists nothing.
	const MIN_TIMELINE_H = 140;
	const MIN_PREVIEW_H = 240;

	let containerH = $state(0);
	let timelineH = $state<number | null>(timelineHeight ?? null);
	const timelineHpx = $derived(
		Math.min(
			Math.max(timelineH ?? containerH * 0.25, MIN_TIMELINE_H),
			Math.max(containerH - MIN_PREVIEW_H, MIN_TIMELINE_H)
		)
	);

	let resizeStartY = 0;
	let resizeStartH = 0;

	function persistTimelineH() {
		timelineH = timelineHpx;
		onTimelineHeightChange?.(timelineHpx);
	}

	function onDividerPointerDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		resizeStartY = e.clientY;
		resizeStartH = timelineHpx;
	}

	function onDividerPointerMove(e: PointerEvent) {
		if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
		timelineH = resizeStartH + (resizeStartY - e.clientY);
	}

	function onDividerPointerUp(e: PointerEvent) {
		const el = e.currentTarget as HTMLElement;
		if (!el.hasPointerCapture(e.pointerId)) return;
		el.releasePointerCapture(e.pointerId);
		persistTimelineH();
	}

	function onDividerKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
		e.preventDefault();
		timelineH = timelineHpx + (e.key === 'ArrowUp' ? 16 : -16);
		persistTimelineH();
	}

	// Bin/inspector column widths — same host-owned pattern as the timeline height,
	// but horizontal. Desktop-only (mobile uses the bottom sheets).
	const MIN_BIN_W = 160;
	const MIN_MAIN_W = 320;
	const MIN_INSPECTOR_W = 200;

	let containerW = $state(0);
	let binW = $state<number | null>(binWidth ?? null);
	let inspectorW = $state<number | null>(inspectorWidth ?? null);

	const binWpx = $derived(
		Math.min(
			Math.max(binW ?? 240, MIN_BIN_W),
			Math.max(containerW - MIN_MAIN_W - MIN_INSPECTOR_W, MIN_BIN_W)
		)
	);
	const inspectorWpx = $derived(
		Math.min(
			Math.max(inspectorW ?? 256, MIN_INSPECTOR_W),
			Math.max(containerW - MIN_MAIN_W - MIN_BIN_W, MIN_INSPECTOR_W)
		)
	);

	let resizeStartX = 0;
	let resizeStartW = 0;

	function persistBinW() {
		binW = binWpx;
		onBinWidthChange?.(binWpx);
	}
	function persistInspectorW() {
		inspectorW = inspectorWpx;
		onInspectorWidthChange?.(inspectorWpx);
	}

	function onBinResizeDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		resizeStartX = e.clientX;
		resizeStartW = binWpx;
	}
	function onBinResizeMove(e: PointerEvent) {
		if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
		binW = resizeStartW + (e.clientX - resizeStartX);
	}
	function onBinResizeUp(e: PointerEvent) {
		const el = e.currentTarget as HTMLElement;
		if (!el.hasPointerCapture(e.pointerId)) return;
		el.releasePointerCapture(e.pointerId);
		persistBinW();
	}
	function onBinResizeKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		binW = binWpx + (e.key === 'ArrowRight' ? 16 : -16);
		persistBinW();
	}

	// The inspector handle sits on the panel's LEFT edge, so dragging left widens.
	function onInspectorResizeDown(e: PointerEvent) {
		(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
		resizeStartX = e.clientX;
		resizeStartW = inspectorWpx;
	}
	function onInspectorResizeMove(e: PointerEvent) {
		if (!(e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) return;
		inspectorW = resizeStartW + (resizeStartX - e.clientX);
	}
	function onInspectorResizeUp(e: PointerEvent) {
		const el = e.currentTarget as HTMLElement;
		if (!el.hasPointerCapture(e.pointerId)) return;
		el.releasePointerCapture(e.pointerId);
		persistInspectorW();
	}
	function onInspectorResizeKeydown(e: KeyboardEvent) {
		if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
		e.preventDefault();
		inspectorW = inspectorWpx + (e.key === 'ArrowLeft' ? 16 : -16);
		persistInspectorW();
	}

	function isEditableTarget(e: KeyboardEvent): boolean {
		const el = e.target;
		if (!(el instanceof HTMLElement)) return false;
		return (
			el.tagName === 'INPUT' ||
			el.tagName === 'TEXTAREA' ||
			el.tagName === 'SELECT' ||
			el.isContentEditable
		);
	}

	function handleDelete(e: KeyboardEvent) {
		e.preventDefault();
		if (e.shiftKey) {
			// ⇧Delete: ripple delete selection, or close gap across all tracks.
			if (editor.selectedGap) editor.closeSelectedGap(true);
			else if (editor.selectedClipIds.size > 0) editor.rippleDeleteSelected();
			return;
		}
		if (editor.selectedGap) {
			editor.closeSelectedGap(false);
		} else if (editor.selectedClipIds.size > 0) {
			requestDeleteSelected();
		} else if (editor.project.range) {
			editor.deleteRange();
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (isEditableTarget(e)) return;
		const mod = e.metaKey || e.ctrlKey;
		const key = e.key.toLowerCase();

		if (e.code === 'Space') {
			e.preventDefault();
			editor.togglePlay();
		} else if (mod && key === 'g') {
			e.preventDefault();
			if (e.shiftKey) editor.ungroupSelection();
			else editor.groupSelection();
		} else if (mod && key === 'z') {
			e.preventDefault();
			if (e.shiftKey) editor.redo();
			else editor.undo();
		} else if (mod && key === 'c') {
			e.preventDefault();
			editor.copySelection();
		} else if (mod && key === 'x') {
			e.preventDefault();
			editor.cutSelection();
		} else if (mod && key === 'v') {
			e.preventDefault();
			editor.paste();
		} else if (mod && key === 'd') {
			e.preventDefault();
			editor.duplicateSelected();
		} else if (e.key === 'Delete' || e.key === 'Backspace') {
			handleDelete(e);
		} else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
			e.preventDefault();
			const frames = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? editor.project.fps : 1);
			if (editor.selectedClipIds.size > 0) editor.nudgeSelected(frames);
			else editor.stepFrames(frames);
		} else if (e.key === 'Escape') {
			editor.clearSelection();
		} else if (!mod && key === 's') {
			e.preventDefault();
			if (e.shiftKey) editor.splitAllAtPlayhead();
			else editor.splitAtPlayhead();
		} else if (!mod && key === 'i') {
			e.preventDefault();
			if (e.altKey) editor.clearRange();
			else editor.setRangeIn();
		} else if (!mod && key === 'o') {
			e.preventDefault();
			if (e.altKey) editor.clearRange();
			else editor.setRangeOut();
		} else if (!mod && key === 'm') {
			e.preventDefault();
			if (e.shiftKey) editor.jumpToMarker(1);
			else if (e.altKey) editor.jumpToMarker(-1);
			else editor.addMarkerAtPlayhead();
		} else if (e.altKey && key === 'l') {
			e.preventDefault();
			if (editor.activeClipId) editor.toggleLink(editor.activeClipId);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} onbeforeunload={() => editor.flush()} />

{#snippet colDivider(handlers: {
	label: string;
	tipSide: 'left' | 'right';
	down: (e: PointerEvent) => void;
	move: (e: PointerEvent) => void;
	up: (e: PointerEvent) => void;
	keydown: (e: KeyboardEvent) => void;
})}
	<Tooltip text={handlers.label} side={handlers.tipSide}>
		{#snippet child({ props })}
			<div
				{...props}
				role="separator"
				aria-orientation="vertical"
				aria-label={handlers.label}
				tabindex="0"
				class="group flex w-1.5 shrink-0 cursor-col-resize touch-none items-center justify-center hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
				onpointerdown={handlers.down}
				onpointermove={handlers.move}
				onpointerup={handlers.up}
				onpointercancel={handlers.up}
				onkeydown={handlers.keydown}
			>
				<div class="h-10 w-1 rounded-full bg-border group-hover:bg-primary/60"></div>
			</div>
		{/snippet}
	</Tooltip>
{/snippet}

<div
	class="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border bg-background text-foreground"
	bind:clientHeight={containerH}
>
	{#if toolbar}
		{@render toolbar(sectionCtx)}
	{:else}
		<TimelineToolbar {onBack} onRequestDelete={requestDeleteSelected} />
	{/if}

	<div class="flex min-h-0 flex-1" bind:clientWidth={containerW}>
		{#if !isMobile}
			<!-- Desktop: bin is an inline side column (override or built-in). On
			     mobile it moves into a bottom sheet (rendered below). -->
			{#if assetBin}
				{@render assetBin(sectionCtx)}
			{:else}
				<aside class="shrink-0 border-r" style="width: {binWpx}px;">
					<AssetBinPanel {binImport} />
				</aside>
				{@render colDivider({
					label: t.resizeBin,
					tipSide: 'right',
					down: onBinResizeDown,
					move: onBinResizeMove,
					up: onBinResizeUp,
					keydown: onBinResizeKeydown
				})}
			{/if}
		{/if}
		<main class="flex min-w-0 flex-1 flex-col">
			{#if preview}
				{@render preview(sectionCtx)}
			{:else}
				<div class="min-h-0 flex-1">
					<PreviewStage />
				</div>
			{/if}
			{#if transport}
				{@render transport(sectionCtx)}
			{:else}
				<TransportBar />
			{/if}
		</main>
		{#if !isMobile}
			<!-- Desktop: inspector is an inline side column (override or built-in).
			     On mobile it moves into a bottom sheet (rendered below). -->
			{#if inspector}
				{@render inspector(sectionCtx)}
			{:else if editor.activeClip}
				{@render colDivider({
					label: t.resizeInspector,
					tipSide: 'left',
					down: onInspectorResizeDown,
					move: onInspectorResizeMove,
					up: onInspectorResizeUp,
					keydown: onInspectorResizeKeydown
				})}
				<aside class="shrink-0 border-l" style="width: {inspectorWpx}px;">
					<InspectorPanel onRequestDelete={requestDeleteSelected} />
				</aside>
			{/if}
		{/if}
	</div>

	<Tooltip text={t.resizePanes}>
		{#snippet child({ props })}
			<div
				{...props}
				role="separator"
				aria-orientation="horizontal"
				aria-label={t.resizePanes}
				tabindex="0"
				class="group flex h-2 shrink-0 cursor-row-resize touch-none items-center justify-center border-y hover:bg-primary/10 focus-visible:bg-primary/10 focus-visible:outline-none"
				onpointerdown={onDividerPointerDown}
				onpointermove={onDividerPointerMove}
				onpointerup={onDividerPointerUp}
				onpointercancel={onDividerPointerUp}
				onkeydown={onDividerKeydown}
			>
				<div class="h-1 w-10 rounded-full bg-border group-hover:bg-primary/60"></div>
			</div>
		{/snippet}
	</Tooltip>

	<div class="flex min-h-0 shrink-0 flex-col" style="height: {timelineHpx}px;">
		{#if tracks}
			{@render tracks(sectionCtx)}
		{:else}
			<!-- On mobile the bin has no sidebar, so the tracks' zoom row hosts a
			     Media button to open the bin sheet. -->
			<TimelineTracks
				onRequestDelete={requestDeleteSelected}
				onOpenBin={isMobile ? () => (binSheetOpen = true) : undefined}
			/>
		{/if}
	</div>

	{#if shortcutsFooter}
		{@render shortcutsFooter(sectionCtx)}
	{:else if !isMobile}
		<!-- Keyboard hints are desktop-only; on mobile the transport bar shows an
		     info button that opens them in a sheet instead. -->
		<ShortcutsFooter />
	{/if}
</div>

<!-- Mobile-only: bin & inspector move into bottom sheets — hosting the section
     override when provided, otherwise the built-in. (Override snippets render
     inline on desktop and inside these sheets on mobile, so a host override
     should avoid fixed widths.) -->
{#if isMobile}
	<Sheet bind:open={binSheetOpen}>
		{#snippet title()}{t.mediaLibrary}{/snippet}
		<div class="h-[60vh]">
			{#if assetBin}
				{@render assetBin(sectionCtx)}
			{:else}
				<AssetBinPanel {binImport} />
			{/if}
		</div>
	</Sheet>
{/if}

{#if isMobile && editor.activeClip}
	<Sheet bind:open={inspectorSheetOpen}>
		<div class="h-[60vh]">
			{#if inspector}
				{@render inspector(sectionCtx)}
			{:else}
				<InspectorPanel onRequestDelete={requestDeleteSelected} />
			{/if}
		</div>
	</Sheet>
{/if}

<!-- Built-in confirmation dialog (used only when no host `confirm` is supplied). -->
<ConfirmDialog
	open={builtinConfirm.open}
	onOpenChange={(v) => {
		if (!v) confirmCtl.resolveBuiltin(false);
	}}
	onConfirm={() => confirmCtl.resolveBuiltin(true)}
	confirmLabel={t.deleteClips}
	cancelLabel={t.cancel}
>
	{#snippet title()}{builtinConfirm.title}{/snippet}
	{#snippet description()}{builtinConfirm.message}{/snippet}
</ConfirmDialog>
