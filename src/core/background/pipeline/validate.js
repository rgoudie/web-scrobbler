'use strict';

define((require) => {
	const ChromeStorage = require('storage/chrome-storage');
	const MusicBrainsValidator = require('pipeline/validator/musicbrainz');
	const ScrobbleServiceValidator = require('pipeline/validator/scrobble-service');

	const options = ChromeStorage.getStorage(ChromeStorage.OPTIONS);
	const validators = [{
		validator: MusicBrainsValidator,
		option: 'useMusicBrainz'
	}, {
		validator: ScrobbleServiceValidator,
		option: 'useScrobbleService'
	}];

	function makePromises(song) {
		return options.get().then(() => {
			return validators.map((data) => {
				// let option = data.option;

				// if (opts[option]) {
				let validator = data.validator;
				return validator.validate(song).catch(() => {
					return false;
				});
				// }

				// return Promise.resolve(true);
			});
		});
	}

	function process(song) {
		return makePromises(song).then((promises) => {
			return Promise.all(promises).then((results) => {
				console.log(results);
				let isSongValid = results.every((result) => result === true);
				song.flags.isValid = isSongValid;
			});
		});
	}

	return { process };
});
