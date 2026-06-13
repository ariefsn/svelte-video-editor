import { getContext, setContext } from 'svelte';

// Inlined, English-by-default UI strings (previously paraglide
// `m.video_editor_*`). Hosts override any subset via the `messages` prop on
// <TimelineEditor> / <ProjectListView>; unspecified keys fall back to English.
// This is the single source of translation — there is no `locale` concept;
// localize by passing a fully-translated `messages` map.
//
// Most values are plain strings. The four that interpolate are functions.

export type Messages = {
	add_crossfade: string;
	add_text: string;
	add_track: string;
	align_center: string;
	align_left: string;
	align_right: string;
	alignment: string;
	aspect_ratio: string;
	back_to_projects: string;
	background: string;
	background_opacity: string;
	bin_empty: string;
	cancel: string;
	clips_label: string;
	close_gap: string;
	close_gap_all: string;
	color: string;
	copy: string;
	cut: string;
	default_text: string;
	delete_clips: string;
	delete_clips_confirm: (args: { count: number }) => string;
	delete_marker: string;
	delete_project: string;
	delete_project_confirm: (args: { name: string }) => string;
	delete_track: string;
	delete_track_confirm: (args: { name: string }) => string;
	detach_audio: string;
	duplicate: string;
	export: string;
	export_locked: string;
	fade_in: string;
	fade_out: string;
	follow_playhead: string;
	font_size: string;
	font_weight: string;
	fps_label: string;
	group: string;
	hide: string;
	inspector_empty: string;
	last_edited: string;
	lock: string;
	loop_range: string;
	marker: string;
	marker_label: string;
	mute: string;
	new_project: string;
	no_gap_here: string;
	op_blocked_contiguous: string;
	op_blocked_invalid: string;
	op_blocked_locked: string;
	op_blocked_no_audio: string;
	op_blocked_no_target: string;
	op_blocked_occupied: string;
	pause: string;
	play: string;
	position_hint: string;
	preview_empty_hint: string;
	preview_empty_title: string;
	project_name: string;
	project_settings_locked_hint: string;
	projects_empty: string;
	projects_title: string;
	redo: string;
	remove_bin_confirm: (args: { name: string }) => string;
	remove_from_bin: string;
	rename_project: string;
	replace_clamped: string;
	resize_panes: string;
	ripple_delete: string;
	roll_edit: string;
	save: string;
	shortcut_alt_drag: string;
	shortcut_clipboard: string;
	shortcut_group: string;
	shortcut_insert: string;
	shortcut_multi_select: string;
	shortcut_no_snap: string;
	shortcut_play_pause: string;
	shortcut_range: string;
	shortcut_slip: string;
	shortcut_split: string;
	shortcut_ungroup: string;
	show: string;
	snap: string;
	solo: string;
	split: string;
	text_content: string;
	text_shadow: string;
	tracks_label: string;
	undo: string;
	ungroup: string;
	unlink: string;
	unlock: string;
	unmute: string;
	volume: string;
	weight_bold: string;
	weight_regular: string;
	weight_semibold: string;
	zoom: string;
	zoom_in: string;
	zoom_out: string;
};

export type MessageKey = keyof Messages;

/** A host-supplied override map (any subset of keys). */
export type MessagesOverride = Partial<Messages>;

export const defaultMessages: Messages = {
	add_crossfade: 'Add crossfade',
	add_text: 'Text',
	add_track: 'Track',
	align_center: 'Center',
	align_left: 'Left',
	align_right: 'Right',
	alignment: 'Alignment',
	aspect_ratio: 'Aspect ratio',
	back_to_projects: 'Back to projects',
	background: 'Background',
	background_opacity: 'Background opacity',
	bin_empty: 'Import media, then drag it onto the timeline.',
	cancel: 'Cancel',
	clips_label: 'clips',
	close_gap: 'Close gap',
	close_gap_all: 'Close gap (all tracks)',
	color: 'Color',
	copy: 'Copy',
	cut: 'Cut',
	default_text: 'Your text',
	delete_clips: 'Delete clips',
	delete_clips_confirm: ({ count }) =>
		`Delete ${count} selected clip(s)? You can undo this with ⌘Z.`,
	delete_marker: 'Delete marker',
	delete_project: 'Delete project',
	delete_project_confirm: ({ name }) =>
		`Delete "${name}"? This only removes the project — media assets stay in your library.`,
	delete_track: 'Delete track',
	delete_track_confirm: ({ name }) =>
		`Delete "${name}" and all clips on it? You can undo this with ⌘Z.`,
	detach_audio: 'Detach audio',
	duplicate: 'Duplicate',
	export: 'Export',
	export_locked: 'Upgrade to export your video',
	fade_in: 'Fade in',
	fade_out: 'Fade out',
	follow_playhead: 'Follow playhead',
	font_size: 'Font size',
	font_weight: 'Font weight',
	fps_label: 'Frame rate',
	group: 'Group',
	hide: 'Hide',
	inspector_empty: 'Select a clip to edit its options.',
	last_edited: 'Last edited',
	lock: 'Lock',
	loop_range: 'Loop in/out range',
	marker: 'Marker',
	marker_label: 'Marker label',
	mute: 'Mute',
	new_project: 'New project',
	no_gap_here: 'No gap here',
	op_blocked_contiguous: 'Ripple delete needs a contiguous selection',
	op_blocked_invalid: "That edit isn't possible here",
	op_blocked_locked: 'Blocked by a locked clip or track',
	op_blocked_no_audio: 'This clip has no audio to detach',
	op_blocked_no_target: 'No suitable track found',
	op_blocked_occupied: 'Not enough room — something is in the way',
	pause: 'Pause',
	play: 'Play',
	position_hint: 'Tip: drag the text directly on the preview to position it.',
	preview_empty_hint: 'Import media, then drag it to the timeline below to get started.',
	preview_empty_title: 'Drag clips onto the timeline',
	project_name: 'Project name',
	project_settings_locked_hint:
		'Remove all clips from the timeline to change the aspect ratio or frame rate',
	projects_empty: 'No projects yet. Create one to start editing.',
	projects_title: 'Projects',
	redo: 'Redo',
	remove_bin_confirm: ({ name }) =>
		`Remove "${name}" from the bin? Clips already on the timeline are not affected.`,
	remove_from_bin: 'Remove from bin',
	rename_project: 'Rename project',
	replace_clamped: 'Replaced — the new media is shorter, so the clip was trimmed',
	resize_panes: 'Resize timeline panel',
	ripple_delete: 'Ripple delete',
	roll_edit: 'Roll edit',
	save: 'Save',
	shortcut_alt_drag: 'Drag duplicate',
	shortcut_clipboard: 'Copy/Cut/Paste/Duplicate',
	shortcut_group: 'Group',
	shortcut_insert: 'Insert on drop',
	shortcut_multi_select: 'Multi-select',
	shortcut_no_snap: 'No snapping',
	shortcut_play_pause: 'Play/Pause',
	shortcut_range: 'In / Out',
	shortcut_slip: 'Slip',
	shortcut_split: 'Split / all tracks',
	shortcut_ungroup: 'Ungroup',
	show: 'Show',
	snap: 'Snapping',
	solo: 'Solo',
	split: 'Split',
	text_content: 'Text',
	text_shadow: 'Text shadow',
	tracks_label: 'tracks',
	undo: 'Undo',
	ungroup: 'Ungroup',
	unlink: 'Unlink audio',
	unlock: 'Unlock',
	unmute: 'Unmute',
	volume: 'Volume',
	weight_bold: 'Bold',
	weight_regular: 'Regular',
	weight_semibold: 'Semibold',
	zoom: 'Zoom',
	zoom_in: 'Zoom in',
	zoom_out: 'Zoom out'
};

/** Merge a host override map over the English defaults. */
export function resolveMessages(override?: MessagesOverride): Messages {
	if (!override) return defaultMessages;
	return { ...defaultMessages, ...override };
}

const KEY = Symbol.for('svelte-timeline-studio-messages');

/** A reactive holder so descendants see live `messages` changes (e.g. a host
 * swapping languages at runtime) — setContext only runs once at init, so we
 * store a getter, not a snapshot. */
export type MessagesProvider = { get current(): Messages };

export function setMessagesProvider(provider: MessagesProvider): MessagesProvider {
	return setContext(KEY, provider);
}

/**
 * Read resolved messages from context. Returns a reactive proxy whose property
 * reads always reflect the latest provided messages, so components can use
 * `t.export` directly and stay reactive. Falls back to English defaults.
 */
export function useMessages(): Messages {
	const provider = getContext<MessagesProvider | undefined>(KEY);
	if (!provider) return defaultMessages;
	// Proxy each access to the live provider so reads are reactive.
	return new Proxy({} as Messages, {
		get(_t, prop: string) {
			return provider.current[prop as keyof Messages];
		},
		has(_t, prop: string) {
			return prop in provider.current;
		},
		ownKeys() {
			return Reflect.ownKeys(provider.current);
		},
		getOwnPropertyDescriptor() {
			return { enumerable: true, configurable: true };
		}
	});
}
