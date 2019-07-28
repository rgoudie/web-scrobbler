'use strict';

const CATEGORY_MUSIC = '/channel/UC-9-kyTW8ZkZNDHQJ6FgpwQ';
const CATEGORY_ENTERTAINMENT = '/channel/UCi-g4cjqGV7jvU8aeSuj0jQ';

const CATEGORY_PENDING = 'YT_DUMMY_CATEGORY_PENDING';

/**
 * Array of categories allowed to be scrobbled.
 * @type {Array}
 */
let allowedCategories = [];

/**
 * "Video Id=Category" map.
 * @type {Map}
 */
let categoryCache = new Map();

/**
 * CSS selector of video element. It's common for both players.
 * @type {String}
 */
const videoSelector = '.html5-main-video';

let currentVideoPlaylist = [];
let currentVideoDescription = null;
let artistTrackFromDescription = null;

readConnectorOptions();

Connector.playerSelector = '#content';

Connector.getArtistTrack = () => {
	const artistTrackFromDesc = getArtistTrackFromDescription();
	const videoTitle = $('.html5-video-player .ytp-title-link').first().text();
	const ownerName = $('#meta-contents #owner-name a').text();

	let { artist, track } = Util.processYoutubeVideoTitle(videoTitle);
	if (!artist) {
		artist = ownerName;
	}

	if (!artistTrackFromDesc.artist) {
		artistTrackFromDesc.artist = artist;
	}

	if (!Util.isArtistTrackEmpty(artistTrackFromDesc)) {
		return artistTrackFromDesc;
	}

	return { artist, track };
};

/*
 * Because player can be still present in the page, we need to detect
 * that it's invisible and don't return current time. Otherwise resulting
 * state may not be considered empty.
 */
Connector.getCurrentTime = () => {
	if (currentVideoPlaylist.length > 0) {
		return getCurrentTimeFromPlaylist();
	}

	return getVideoCurrentTime();
};

Connector.getDuration = () => {
	if (currentVideoPlaylist.length > 0) {
		return getTrackDurationFromPlaylist();
	}

	return getVideoDuration();
};

Connector.isPlaying = () => {
	return $('.html5-video-player').hasClass('playing-mode');
};

Connector.getUniqueID = () => {
	/*
	 * Youtube doesn't update video title immediately in fullscreen mode.
	 * We don't return video ID until video title is shown.
	 */
	if (Connector.isFullscreenMode()) {
		let videoTitle = $('.html5-video-player.playing-mode .ytp-title-link').text();
		if (!videoTitle) {
			return null;
		}
	}

	let videoId = $('ytd-watch-flexy').attr('video-id');

	if (!videoId) {
		let videoUrl = $('.html5-video-player.playing-mode .ytp-title-link').attr('href');
		videoId = Util.getYoutubeVideoIdFromUrl(videoUrl);
	}

	return videoId;
};

Connector.isScrobblingAllowed = () => {
	if ($('.videoAdUi').length > 0) {
		return false;
	}

	// FIXME: Workaround to prevent scrobbling the vidio opened in a background tab.
	if (Connector.getCurrentTime() < 1) {
		return false;
	}

	if (allowedCategories.length === 0) {
		return true;
	}

	const videoId = Connector.getUniqueID();
	if (videoId) {
		const videoCategory = getVideoCategory(videoId);
		if (videoCategory !== null) {
			return allowedCategories.includes(videoCategory);
		}

		return false;
	}

	return true;
};

Connector.applyFilter(MetadataFilter.getYoutubeFilter());

Connector.isFullscreenMode = () => {
	return $('.html5-video-player').hasClass('ytp-fullscreen');
};

/**
 * Get video category.
 * @param  {String} videoId Video ID
 * @return {String} Video category
 */
function getVideoCategory(videoId) {
	if (videoId === null) {
		return null;
	}

	if (!categoryCache.has(videoId)) {
		/*
		 * Add dummy category for videoId to prevent
		 * fetching category multiple times.
		 */
		categoryCache.set(videoId, CATEGORY_PENDING);

		fetchCategoryId(videoId).then((category) => {
			if (category === null) {
				Util.debugLog(`Failed to resolve category for ${videoId}`, 'warn');
			}

			categoryCache.set(videoId, category);
		});

		return null;
	}

	return categoryCache.get(videoId);
}

async function fetchCategoryId() {
	await fillMoreSection();
	return $('.ytd-metadata-row-renderer .yt-formatted-string[href^="/channel/"]').attr('href');
}

async function fillMoreSection() {
	function waitForClick(ms = 0) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	const ytShowLessText = $('yt-formatted-string.less-button').text();
	const ytShowMoreText = $('yt-formatted-string.more-button').text();

	// Apply global style to prevent "More/Less" button flickering.
	$('yt-formatted-string.less-button').text(ytShowMoreText);
	let styleTag = $(`
		<style id="tmp-style">
			ytd-metadata-row-container-renderer {
				visibility: hidden;
			}
			ytd-metadata-row-container-renderer #collapsible {
				height: 0;
			}
			ytd-expander > #content.ytd-expander {
				overflow: hidden;
				max-height: var(--ytd-expander-collapsed-height);
			}
			yt-formatted-string.less-button {
				margin-top: 0 !important;
			}
		</style>
	`);
	$('html > head').append(styleTag);

	// Open "More" section.
	$('yt-formatted-string.more-button').click();
	await waitForClick();

	// Close "More" section.
	$('yt-formatted-string.less-button').click();

	// Remove global style.
	$('yt-formatted-string.less-button').text(ytShowLessText);
	$('#tmp-style').remove();
}

/**
 * Asynchronously read connector options.
 */
async function readConnectorOptions() {
	if (await Util.getOption('YouTube', 'scrobbleMusicOnly')) {
		allowedCategories.push(CATEGORY_MUSIC);
	}
	if (await Util.getOption('YouTube', 'scrobbleEntertainmentOnly')) {
		allowedCategories.push(CATEGORY_ENTERTAINMENT);
	}
}

function getVideoDescription() {
	return $('#description').text();
}

function getArtistTrackFromDescription() {
	const description = getVideoDescription();

	if (currentVideoDescription === description) {
		if (currentVideoPlaylist.length > 0) {
			artistTrackFromDescription = getArtistTrackFromPlaylist(currentVideoPlaylist);
		}

		return artistTrackFromDescription;
	}

	Util.debugLog('Update description');
	currentVideoDescription = description;

	const playlist = getPlaylistFromDescription(description);
	if (playlist.length) {
		currentVideoPlaylist = playlist;
		artistTrackFromDescription = getArtistTrackFromPlaylist(playlist);
	} else if (isValidYouTubeDescription(description)) {
		currentVideoPlaylist = [];
		artistTrackFromDescription = getArtistTrackFromYouTubeDescription(description);
	} else {
		currentVideoPlaylist = [];
		artistTrackFromDescription = Util.makeEmptyArtistTrack();
	}

	return artistTrackFromDescription;
}

// TODO: Move parser code to Util module.

const LINE_ARTIST_TRACK = 0;
const LINE_ALBUM = 1;

const descFirstLine = 'Provided to YouTube';
const descLastLine = 'Auto-generated by YouTube.';

const descArtistTrackSeparator = '·';

function isValidYouTubeDescription(desc) {
	return desc && (
		desc.startsWith(descFirstLine) ||
		desc.endsWith(descLastLine)
	);
}

function getArtistTrackFromYouTubeDescription(desc) {
	let indexOffset = 0;
	const lines = desc.split('\n').filter((line) => line.length > 0);
	if (lines[0].startsWith(descFirstLine)) {
		indexOffset = 1;
	}

	const { artist, track } = Util.splitArtistTrack(
		lines[LINE_ARTIST_TRACK + indexOffset],
		descArtistTrackSeparator, { swap: true }
	);
	const album = lines[LINE_ALBUM + indexOffset];

	return { artist, track, album };
}

const regex1 = /[[(]*(\d{0,2}:*\d{2}:\d{2})[\])]*\s+(.+)/i;
const regex2 = /\s*(.+)\s+[[(]*(\d{0,2}:*\d{2}:\d{2})[\])]*/i;

const noPrefix = /^\d+\./;

const regexes = [{
	regex: regex1, timestampIndex: 1, trackIndex: 2
}, {
	regex: regex2, timestampIndex: 2, trackIndex: 1
}];

function getArtistTrackFromPlaylist() {
	const track = getCurrentTrackFromPlaylist();

	return { track };
}

function getPlaylistFromDescription(description) {
	let playlist = [];

	const lines = description.split('\n');
	for (const line of lines) {
		for (const regexData of regexes) {
			const { regex, timestampIndex, trackIndex } = regexData;

			const matchResult = line.match(regex);

			if (matchResult) {
				const rawTimestamp = matchResult[timestampIndex];
				const timestamp = Util.stringToSeconds(rawTimestamp);
				const track = matchResult[trackIndex].replace(noPrefix, '');

				playlist.push({ timestamp, track });
				break;
			}
		}
	}

	playlist = playlist.sort(compareTimestamps);

	for (let i = 0; i < playlist.length; ++i) {
		let duration = 0;
		const entry = playlist[i];

		if (i === 0) {
			duration = getVideoDuration() - entry.timestamp;
		} else {
			const prevEntry = playlist[i - 1];
			duration = prevEntry.timestamp - entry.timestamp;
		}

		entry.duration = duration;
	}

	return playlist.sort(compareTimestamps);
}

function compareTimestamps(a, b) {
	return b.timestamp - a.timestamp;
}

function getCurrentEntryFromPlaylist() {
	const currentTime = getVideoCurrentTime();

	for (const entry of currentVideoPlaylist) {
		if (currentTime >= entry.timestamp) {
			return entry;
		}
	}

	return null;
}

function getCurrentTrackFromPlaylist() {
	const entry = getCurrentEntryFromPlaylist();
	return entry ? entry.track : null;
}

function getTrackDurationFromPlaylist() {
	const entry = getCurrentEntryFromPlaylist();
	return entry ? entry.duration : null;
}

function getCurrentTimeFromPlaylist() {
	const entry = getCurrentEntryFromPlaylist();
	if (!entry) {
		return null;
	}

	const currentTime = getVideoCurrentTime();
	return currentTime - entry.timestamp;
}

function getVideoDuration() {
	return $(videoSelector).prop('duration');
}

function getVideoCurrentTime() {
	return $(videoSelector).prop('currentTime');
}
