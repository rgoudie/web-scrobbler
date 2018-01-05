'use strict';

define((require) => {
	const MusicBrainsApi = require('service/musicbrainz');

	function validate(song) {
		let artist = song.getArtist();
		let track = song.getTrack();

		let query = {
			artistname: `+"${artist}"^4${artist}`,
			title: `+"${track}"^3 ${track}`
		};
		return MusicBrainsApi.getRecording(query).then((result) => {
			if (result.count > 0) {
				let songTitle = song.getTrack();
				for (let recording of result.recordings) {
					if (compare(recording.title, songTitle)) {
						return true;
					}
				}
			}

			return false;
		});
	}

	function compare(a, b) {
		return a.toLowerCase() === b.toLowerCase();
	}

	return { validate };
});
