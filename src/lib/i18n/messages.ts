import { getContext, setContext } from 'svelte';

// Inlined, English-by-default UI strings (previously paraglide
// `m.video_editor_*`). Hosts override any subset via the `messages` prop on
// <TimelineEditor> / <ProjectListView>; unspecified keys fall back to English.
// This is the single source of translation — there is no `locale` concept;
// localize by passing a fully-translated `messages` map.
//
// Most values are plain strings. The four that interpolate are functions.

export type Messages = {
	addCrossfade: string;
	addText: string;
	addTrack: string;
	animation: string;
	animOnEnter: string;
	animOnExit: string;
	animDuration: string;
	animEasing: string;
	animNone: string;
	animFade: string;
	animSlideLeft: string;
	animSlideRight: string;
	animSlideUp: string;
	animSlideDown: string;
	animScale: string;
	animZoom: string;
	animBounce: string;
	animPop: string;
	animSpin: string;
	animBlur: string;
	animWipe: string;
	animFlip: string;
	easingLinear: string;
	easingEaseIn: string;
	easingEaseOut: string;
	easingEaseInOut: string;
	alignCenter: string;
	alignLeft: string;
	alignRight: string;
	alignment: string;
	aspectRatio: string;
	backToProjects: string;
	background: string;
	backgroundOpacity: string;
	backgroundSolid: string;
	backgroundGradient: string;
	backgroundAngle: string;
	backgroundPresets: string;
	backgroundCustom: string;
	backgroundNone: string;
	backgroundFrom: string;
	backgroundTo: string;
	border: string;
	borderWidth: string;
	shadowColor: string;
	shadowBlur: string;
	shadowOffset: string;
	binEmpty: string;
	binFilterAll: string;
	binFilterVideos: string;
	binFilterImages: string;
	binFilterAudios: string;
	binFilterEmpty: string;
	cancel: string;
	mediaLibrary: string;
	clipsLabel: string;
	closeGap: string;
	closeGapAll: string;
	color: string;
	copy: string;
	cut: string;
	defaultText: string;
	deleteClips: string;
	deleteClipsConfirm: (args: { count: number }) => string;
	deleteMarker: string;
	deleteProject: string;
	deleteProjectConfirm: (args: { name: string }) => string;
	deleteTrack: string;
	deleteTrackConfirm: (args: { name: string }) => string;
	detachAudio: string;
	duplicate: string;
	export: string;
	exportLocked: string;
	fadeIn: string;
	fadeOut: string;
	followPlayhead: string;
	fontSize: string;
	fontWeight: string;
	fpsLabel: string;
	group: string;
	hide: string;
	inspectorEmpty: string;
	lastEdited: string;
	lock: string;
	loopRange: string;
	marker: string;
	markerLabel: string;
	moreOptions: string;
	mute: string;
	newProject: string;
	noGapHere: string;
	opBlockedContiguous: string;
	opBlockedInvalid: string;
	opBlockedLocked: string;
	opBlockedNoAudio: string;
	opBlockedNoTarget: string;
	opBlockedOccupied: string;
	options: string;
	pause: string;
	play: string;
	positionHint: string;
	previewEmptyHint: string;
	previewEmptyTitle: string;
	projectName: string;
	projectSettingsLockedHint: string;
	projectsEmpty: string;
	projectsTitle: string;
	redo: string;
	removeBinConfirm: (args: { name: string }) => string;
	removeFromBin: string;
	renameProject: string;
	replaceClamped: string;
	resizePanes: string;
	resizeBin: string;
	resizeInspector: string;
	rippleDelete: string;
	rollEdit: string;
	save: string;
	shortcutAltDrag: string;
	shortcutClipboard: string;
	shortcutGroup: string;
	shortcutInsert: string;
	shortcutMultiSelect: string;
	shortcutNoSnap: string;
	shortcutPlayPause: string;
	shortcutRange: string;
	shortcutSlip: string;
	shortcutSplit: string;
	shortcutUngroup: string;
	shortcutsTitle: string;
	show: string;
	snap: string;
	solo: string;
	split: string;
	textContent: string;
	textShadow: string;
	tracksLabel: string;
	undo: string;
	ungroup: string;
	unlink: string;
	unlock: string;
	unmute: string;
	volume: string;
	weightBold: string;
	weightRegular: string;
	weightSemibold: string;
	zoom: string;
	zoomIn: string;
	zoomOut: string;
};

export type MessageKey = keyof Messages;

/** A host-supplied override map (any subset of keys). */
export type MessagesOverride = Partial<Messages>;

export const defaultMessages: Messages = {
	addCrossfade: 'Add crossfade',
	addText: 'Text',
	addTrack: 'Track',
	animation: 'Animation',
	animOnEnter: 'On enter',
	animOnExit: 'On exit',
	animDuration: 'Duration',
	animEasing: 'Easing',
	animNone: 'None',
	animFade: 'Fade',
	animSlideLeft: 'Slide left',
	animSlideRight: 'Slide right',
	animSlideUp: 'Slide up',
	animSlideDown: 'Slide down',
	animScale: 'Scale',
	animZoom: 'Zoom',
	animBounce: 'Bounce',
	animPop: 'Pop',
	animSpin: 'Spin',
	animBlur: 'Blur',
	animWipe: 'Wipe',
	animFlip: 'Flip',
	easingLinear: 'Linear',
	easingEaseIn: 'Ease in',
	easingEaseOut: 'Ease out',
	easingEaseInOut: 'Ease in-out',
	alignCenter: 'Center',
	alignLeft: 'Left',
	alignRight: 'Right',
	alignment: 'Alignment',
	aspectRatio: 'Aspect ratio',
	backToProjects: 'Back to projects',
	background: 'Background',
	backgroundOpacity: 'Background opacity',
	backgroundSolid: 'Solid',
	backgroundGradient: 'Gradient',
	backgroundAngle: 'Angle',
	backgroundPresets: 'Presets',
	backgroundCustom: 'Custom',
	backgroundNone: 'None',
	backgroundFrom: 'From',
	backgroundTo: 'To',
	border: 'Border',
	borderWidth: 'Border width',
	shadowColor: 'Shadow color',
	shadowBlur: 'Shadow blur',
	shadowOffset: 'Shadow offset',
	binEmpty: 'Import media, then drag it onto the timeline.',
	binFilterAll: 'All',
	binFilterVideos: 'Videos',
	binFilterImages: 'Images',
	binFilterAudios: 'Audio',
	binFilterEmpty: 'No items of this type.',
	cancel: 'Cancel',
	mediaLibrary: 'Media',
	clipsLabel: 'clips',
	closeGap: 'Close gap',
	closeGapAll: 'Close gap (all tracks)',
	color: 'Color',
	copy: 'Copy',
	cut: 'Cut',
	defaultText: 'Your text',
	deleteClips: 'Delete clips',
	deleteClipsConfirm: ({ count }) => `Delete ${count} selected clip(s)? You can undo this with ⌘Z.`,
	deleteMarker: 'Delete marker',
	deleteProject: 'Delete project',
	deleteProjectConfirm: ({ name }) =>
		`Delete "${name}"? This only removes the project — media assets stay in your library.`,
	deleteTrack: 'Delete track',
	deleteTrackConfirm: ({ name }) =>
		`Delete "${name}" and all clips on it? You can undo this with ⌘Z.`,
	detachAudio: 'Detach audio',
	duplicate: 'Duplicate',
	export: 'Export',
	exportLocked: 'Upgrade to export your video',
	fadeIn: 'Fade in',
	fadeOut: 'Fade out',
	followPlayhead: 'Follow playhead',
	fontSize: 'Font size',
	fontWeight: 'Font weight',
	fpsLabel: 'Frame rate',
	group: 'Group',
	hide: 'Hide',
	inspectorEmpty: 'Select a clip to edit its options.',
	lastEdited: 'Last edited',
	lock: 'Lock',
	loopRange: 'Loop in/out range',
	marker: 'Marker',
	markerLabel: 'Marker label',
	moreOptions: 'More',
	mute: 'Mute',
	newProject: 'New project',
	noGapHere: 'No gap here',
	opBlockedContiguous: 'Ripple delete needs a contiguous selection',
	opBlockedInvalid: "That edit isn't possible here",
	opBlockedLocked: 'Blocked by a locked clip or track',
	opBlockedNoAudio: 'This clip has no audio to detach',
	opBlockedNoTarget: 'No suitable track found',
	opBlockedOccupied: 'Not enough room — something is in the way',
	options: 'Options',
	pause: 'Pause',
	play: 'Play',
	positionHint: 'Tip: drag the text directly on the preview to position it.',
	previewEmptyHint: 'Import media, then drag it to the timeline below to get started.',
	previewEmptyTitle: 'Drag clips onto the timeline',
	projectName: 'Project name',
	projectSettingsLockedHint:
		'Remove all clips from the timeline to change the aspect ratio or frame rate',
	projectsEmpty: 'No projects yet. Create one to start editing.',
	projectsTitle: 'Projects',
	redo: 'Redo',
	removeBinConfirm: ({ name }) =>
		`Remove "${name}" from the bin? Clips already on the timeline are not affected.`,
	removeFromBin: 'Remove from bin',
	renameProject: 'Rename project',
	replaceClamped: 'Replaced — the new media is shorter, so the clip was trimmed',
	resizePanes: 'Resize timeline panel',
	resizeBin: 'Resize media panel',
	resizeInspector: 'Resize options panel',
	rippleDelete: 'Ripple delete',
	rollEdit: 'Roll edit',
	save: 'Save',
	shortcutAltDrag: 'Drag duplicate',
	shortcutClipboard: 'Copy/Cut/Paste/Duplicate',
	shortcutGroup: 'Group',
	shortcutInsert: 'Insert on drop',
	shortcutMultiSelect: 'Multi-select',
	shortcutNoSnap: 'No snapping',
	shortcutPlayPause: 'Play/Pause',
	shortcutRange: 'In / Out',
	shortcutSlip: 'Slip',
	shortcutSplit: 'Split / all tracks',
	shortcutUngroup: 'Ungroup',
	shortcutsTitle: 'Keyboard shortcuts',
	show: 'Show',
	snap: 'Snapping',
	solo: 'Solo',
	split: 'Split',
	textContent: 'Text',
	textShadow: 'Text shadow',
	tracksLabel: 'tracks',
	undo: 'Undo',
	ungroup: 'Ungroup',
	unlink: 'Unlink audio',
	unlock: 'Unlock',
	unmute: 'Unmute',
	volume: 'Volume',
	weightBold: 'Bold',
	weightRegular: 'Regular',
	weightSemibold: 'Semibold',
	zoom: 'Zoom',
	zoomIn: 'Zoom in',
	zoomOut: 'Zoom out'
};

/** Merge a host override map over the English defaults. */
export function resolveMessages(override?: MessagesOverride): Messages {
	if (!override) return defaultMessages;
	return { ...defaultMessages, ...override };
}

const KEY = Symbol.for('svelte-video-editor-messages');

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
