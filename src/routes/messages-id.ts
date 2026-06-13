import type { MessagesOverride } from '$lib/index.js';

// A (partial, illustrative) Indonesian translation for the advanced demo's
// language toggle. The host owns this map; the library just renders whatever
// `messages` it's handed. Unspecified keys fall back to the English defaults.
export const messagesId: MessagesOverride = {
	add_text: 'Teks',
	add_track: 'Trek',
	aspect_ratio: 'Rasio aspek',
	back_to_projects: 'Kembali ke proyek',
	cancel: 'Batal',
	clips_label: 'klip',
	color: 'Warna',
	copy: 'Salin',
	cut: 'Potong',
	delete_clips: 'Hapus klip',
	delete_clips_confirm: ({ count }) => `Hapus ${count} klip terpilih? Bisa di-undo dengan ⌘Z.`,
	duplicate: 'Duplikat',
	export: 'Ekspor',
	export_locked: 'Tingkatkan paket untuk mengekspor',
	fps_label: 'Frame rate',
	group: 'Grup',
	hide: 'Sembunyikan',
	inspector_empty: 'Pilih klip untuk mengedit opsinya.',
	lock: 'Kunci',
	mute: 'Bisukan',
	new_project: 'Proyek baru',
	pause: 'Jeda',
	play: 'Putar',
	projects_title: 'Proyek',
	redo: 'Ulangi',
	rename_project: 'Ganti nama proyek',
	save: 'Simpan',
	snap: 'Magnet',
	solo: 'Solo',
	split: 'Pisah',
	tracks_label: 'trek',
	undo: 'Urungkan',
	ungroup: 'Pisahkan grup',
	unlock: 'Buka kunci',
	unmute: 'Suarakan',
	volume: 'Volume',
	zoom: 'Zoom'
};
