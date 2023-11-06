const express = require('express');
const router = express.Router();
const axios = require("axios");
var SpotifyWebApi = require('spotify-web-api-node');
const app = require('../app');
const config = require('../config');

let artistDataForPost = {};
let spotifyApi;

/* GET search query results page. */
router.get('/:artist', (req, res) => {
    spotifyApi = req.app.get('spotifyApi');
    const options = createLastfmOptions(req.params.artist, 10, 0);
    const url = `https://${options.hostname}${options.path}`;
    axios.get(url)
        .then((response) => {
            const { data } = response;
            try {
                // checks to ensure you an access token (i.e. user is logged in with spotify)
                console.log('Access token is: ' + spotifyApi.getAccessToken());
            } catch {
                // if the user hasnt auth'd with spotify, returns them to index, logs to console
                res.redirect('/');
                console.log("Please login with spotify");
            }
            return data;
        })
        .then((data) => {
            return getTopTracks(data, spotifyApi);
        })
        .then((artistTopTrackData) => {
            artistDataForPost = artistTopTrackData;
            res.render('search', { querydata: artistTopTrackData });
        })
        .catch((error) => {
            console.error(error);
        })
});

// lastfm API const params
const lastfm = {
    method: ['artist.getSimilar', 'artist.gettoptracks'],
    api_key: config.lastfm.apiKey,
    format: "json",
    nojsoncallback: 1
};

// creates lastfm API params as required for the query
function createLastfmOptions(query, number, methodNo) {
    const options = {
        hostname: 'ws.audioscrobbler.com',
        port: 443,
        path: '/2.0/?',
        method: 'GET'
    }
    const str = 'method=' + lastfm.method[methodNo] +
        '&limit=' + number +
        '&artist=' + query +
        '&api_key=' + lastfm.api_key +
        '&format=' + lastfm.format +
        '&nojsoncallback=' + lastfm.nojsoncallback;
    options.path += str;
    return options;
}

// Gets the top tracks of each artists, stores the data in obj artistData
async function getTopTracks(resp, spotifyApi) {
    let artistData = {
        "queriedartist": resp.similarartists['@attr'].artist,
        "relatedartists": [],
        "trackuris": []
    };
    if (resp != null) {
        for (let i = 0; i < resp.similarartists.artist.length; i++) {
            artist = resp.similarartists.artist[i]
            var query = artist.name.replace(/ /g, "+");
            const optionsTopTracks = createLastfmOptions(query, 3, 1);
            const url = `https://${optionsTopTracks.hostname}${optionsTopTracks.path}`;
            try {
                const topTrackdata = await axios.get(url)
                let topTrackDataResp = topTrackdata.data;
                let parsedTopTracksIter = parseTopTracks(topTrackDataResp);
                artistData.relatedartists.push(parsedTopTracksIter);
                let queriedURIs = await getSpotifyTrackId(spotifyApi, topTrackDataResp);
                for (let j = 0; j < queriedURIs.length; j++) {
                    artistData.trackuris.push(queriedURIs[j]);
                }
                //artistData.trackuris.push(queriedURIs);
            } catch (error) {
                console.log("error", error);
            }
        }

    } else {
        console.log(`Haven't got a result for you, sorry!`);
    }
    console.log(artistData.trackuris);
    return artistData;
}

// extracts the top tracks from the top track api call  and stores them in my own obj to be added to obj artistData
function parseTopTracks(rsp) {
    artistName = rsp.toptracks['@attr'].artist;
    let iterAllTracksData = {
        "artistname": artistName,
        "songs": []
    };
    for (let i = 0; i < rsp.toptracks.track.length; i++) {
        var trackName = rsp.toptracks.track[i].name;
        let iterTrackData = {
            "songname": trackName,
            "songid": ''
        };
        iterAllTracksData.songs.push(iterTrackData);
    }
    return iterAllTracksData;
}

// gets the spotify URI for the track
async function getSpotifyTrackId(spotifyApi, rsp) {
    var trackIDs = [];
    var artistName = rsp.toptracks['@attr'].artist;
    for (let i = 0; i < rsp.toptracks.track.length; i++) {
        var trackName = rsp.toptracks.track[i].name;
        var spotifyTrackQuery = 'track:' + trackName + ' artist:' + artistName;
        try {
            await spotifyApi.searchTracks(spotifyTrackQuery)
                .then(function(data) {
                    let trackURI = data.body.tracks.items[0].uri;
                    trackIDs.push(trackURI);
                }, function(err) {
                    console.log('Something went wrong!', err);
                });
        } catch (error) {
            console.log("error", error);
        }
    }
    return trackIDs;
}

router.post('/create-playlist', function(req, res) {
    var trackURIs = artistDataForPost.trackuris;
    var queriedArtistsName = artistDataForPost.queriedartist;
    var playlistName = 'Playlist Similar to ' + queriedArtistsName;
    var playlistDesc = 'A playlist of top songs by artists similar to ' + queriedArtistsName + '. Automatically generated by Spotify Playlist Generator.';
    spotifyApi.createPlaylist(playlistName, { 'description': playlistDesc, 'public': true })
        .then(function(data) {
            return data.body.id;
        })
        .then(function(playlistID) {
            spotifyApi.addTracksToPlaylist(playlistID, trackURIs);
            console.log('Created your playlist!');
        }, function(err) {
            console.log('Something went wrong with playlist generation!', err);
        });
    res.redirect('back');
});

module.exports = router;