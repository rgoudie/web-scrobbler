'use strict';

const MB_API_URL = 'http://musicbrainz.org/ws/2';

define(() => {
	/**
	 * Get MusicBrainz ID of given type.
	 * @param  {String} type Index to be searched
	 * @param  {String} query Search query
	 * @return {Promise} Promise resolved with request result
	 */
	function getMusicBrainzId(type, query) {
		let url = makeUrl(type, query);
		return request(url);
	}

	/**
	 * Get recording by search query.
	 * @param  {String} query Search query
	 * @return {Promise} Promise resolved with request result
	 */
	function getRecording(query) {
		let url = makeUrl('recording', query);
		return request(url);
	}

	/*
	 * Internal functions
	 */

	function makeUrl(type, query) {
		return `${MB_API_URL}/${type}/?${makeParams(query)}`;
	}

	function makeParams(query) {
		let queryStr = makeQueryParam(query);
		return `query=${queryStr}&fmt=json`;
	}

	function makeQueryParam(query) {
		let queryStr = '';
		for (let key in query) {
			let value = query[key];
			queryStr += `${key}:${value} `;
		}

		return queryStr.trim();
	}

	function request(url) {
		console.log(url);
		return fetch(url, { method: 'GET' }).then((result) => {
			if (!result.ok) {
				throw new Error('Invalid request');
			}

			return result.json();
		});
	}

	return { getRecording, getMusicBrainzId };
});
