var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var SpotifyWebApi = require('spotify-web-api-node');

var indexRouter = require('./routes/index');
var searchRouter = require('./routes/search');
var config = require('./config');

var app = express();

var scopes = ['user-read-private', 'user-read-email', 'playlist-modify-public'],
    redirectUri = '',
    clientId = config.spotify.clientId,
    clientSecret = config.spotify.clientSecret,
    state = 'logged-in';

// taken from https://www.npmjs.com/package/spotify-web-api-node
// this API wrapper is used to interact with the Spotify API when getting track URIs and Playlist Generation
var spotifyApi = new SpotifyWebApi({
    redirectUri: redirectUri,
    clientId: clientId,
    clientSecret: clientSecret,
});

function requestAuth() {
    var authorizeURL = spotifyApi.createAuthorizeURL(scopes, state);
    console.log(authorizeURL);
    return authorizeURL;
}

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/search', searchRouter);

// route to handle spotify authentication
app.post('/request-auth', function(req, res) {
    // Get the hostname and port so that spotify callback can be done correctly
    // note that you will still have to manually add the redirURI on the spotify dev dashboard
    var port = req.app.settings.port;
    var hostname = req.hostname;
    spotifyApi.setRedirectURI('http://' + hostname + ':' + port + '/callback');
    authUrl = requestAuth();
    res.redirect(authUrl);
});

// route to handle the spotify auth callback and redirect
// extract and store the callback code, and sets the access and refresh tokens required for use of spotify API functions
app.get('/callback', function(req, res) {
    let code = req.query.code;
    spotifyApi.authorizationCodeGrant(code).then(
            function(data) {
                console.log('The token expires in ' + data.body['expires_in']);
                console.log('The access token is ' + data.body['access_token']);
                console.log('The refresh token is ' + data.body['refresh_token']);

                // Set the access token on the API object to use it in later calls
                spotifyApi.setAccessToken(data.body['access_token']);
                spotifyApi.setRefreshToken(data.body['refresh_token']);
                app.set('spotifyApi', spotifyApi);
            },
            function(err) {
                console.log('Something went wrong!', err);
            }
        )
        .then((rsp) => {
            res.redirect('/');
        });
});

// route to handle the search button
app.post('/search-artist', function(req, res) {
    res.redirect(`/search/${req.body.queryInput.replace(/ /g, "+")}`);
});

// catch 404 and forward to error handler
app.use(function(req, res, next) {
    next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
    // set locals, only providing error in development
    res.locals.message = err.message;
    res.locals.error = req.app.get('env') === 'development' ? err : {};

    // render the error page
    res.status(err.status || 500);
    res.render('error');
});

module.exports = app;