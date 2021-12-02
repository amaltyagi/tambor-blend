const http = require('http');
const port = process.env.PORT || 8888;
const express = require('express'); // Express web server framework
const request = require('request'); // "Request" library
const cors = require('cors');
const querystring = require('querystring');
const cookieParser = require('cookie-parser');
const ObjectsToCsv = require('objects-to-csv');
const mysql = require('mysql');

var client_id = 'f6adfa99d13644548a1c60e653246502'; // Your client id
var client_secret = '570f580bd2a34f63a9c0a3bd750e1fc6'; // Your secret
var redirect_uri = 'https://tambor-party.herokuapp.com/callback/'; // Your redirect uri
let curr_id;

/**
* Generates a random string containing numbers and letters
* @param  {number} length The length of the string
* @return {string} The generated string
*/
var generateRandomString = function(length) {
  var text = '';
  var possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

  for (var i = 0; i < length; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
};

var stateKey = 'spotify_auth_state';

var app = express();

app.use(express.static(__dirname))
  .use(cors())
  .use(cookieParser());

app.get('/login', function(req, res) {

  var state = generateRandomString(16);
  res.cookie(stateKey, state);

  // your application requests authorization
  var scope = 'user-read-private user-read-email user-follow-read streaming playlist-modify-private playlist-modify-public playlist-read-private user-top-read';
  res.redirect('https://accounts.spotify.com/authorize?' +
    querystring.stringify({
      response_type: 'code',
      client_id: client_id,
      scope: scope,
      redirect_uri: redirect_uri,
      state: state
    }));

});

app.get('/callback', function(req, res) {

  // your application requests refresh and access tokens
  // after checking the state parameter

  var code = req.query.code || null;
  var state = req.query.state || null;
  var storedState = req.cookies ? req.cookies[stateKey] : null;

  if (state === null || state !== storedState) {
    res.redirect('/#' +
      querystring.stringify({
        error: 'state_mismatch'
      }));
  } else {
    res.clearCookie(stateKey);
    var authOptions = {
      url: 'https://accounts.spotify.com/api/token',
      form: {
        code: code,
        redirect_uri: redirect_uri,
        grant_type: 'authorization_code'
      },
      headers: {
        'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64'))
      },
      json: true
    };

    request.post(authOptions, function(error, response, body) {
      if (!error && response.statusCode === 200) {

        var access_token = body.access_token,
            refresh_token = body.refresh_token;

        var options = {
          url: 'https://api.spotify.com/v1/me',
          headers: { 'Authorization': 'Bearer ' + access_token },
          json: true
        };

        // use the access token to access the Spotify Web API
        request.get(options, function(error, response, body) {
          console.log(body);
          console.log(body.display_name);
          console.log(body.id);
          console.log(body.uri);
          console.log(body.email);

          curr_id = body.id;
        });

        // we can also pass the token to the browser to make requests from there
        res.redirect('/#' +
          querystring.stringify({
            access_token: access_token,
            refresh_token: refresh_token
          }));

        
      } else {
        res.redirect('/#' +
          querystring.stringify({
            error: 'invalid_token'
          }));
      }
    });
  }
});

app.get('/refresh_token', function(req, res) {

  // requesting access token from refresh token
  var refresh_token = req.query.refresh_token;
  var authOptions = {
    url: 'https://accounts.spotify.com/api/token',
    headers: { 'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')) },
    form: {
      grant_type: 'refresh_token',
      refresh_token: refresh_token
    },
    json: true
  };

  request.post(authOptions, function(error, response, body) {
    if (!error && response.statusCode === 200) {
      var con = mysql.createConnection({
        HOST: "us-cdbr-east-04.cleardb.com",
        USER: "b8ecddea309a73",
        PASSWORD: "99ff4e22",
        DB: "heroku_50ae15780e97258"
      });

      con.connect(function(err) {
        if (err) throw err;
        console.log('connected');
        con.query(
          "INSERT INTO users (user_id, user_email, user_name, user_uri, user_displayname, user_country) VALUES (0, 'test', 'test', 'test', 'test', 'test')",
          function(err, result) {
            if (err) throw err;
            console.log('vals inserted');
        });
      });

      var access_token = body.access_token;
      res.send({
        'access_token': access_token
      });

      var options = {
      //  url: 'https://api.spotify.com/v1/users/'+user_id+'/playlists',
      //  url: 'https://api.spotify.com/v1/browse/featured-playlists',
        url: '',
        headers: { 'Authorization': 'Bearer ' + access_token },
        json: true
      };

      // async function toCsv(list, file) {
      //   const csv = new ObjectsToCsv(list);
      //   await csv.toDisk('./user_data/'+curr_id+file+'.csv');
      // }

      // options['url'] = 'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topTracks = [];
      //   body.items.forEach(track => 
      //     track.artists.forEach(artist => 
      //       topTracks.push([
      //         artist.name, artist.uri, 
      //         track.album.name, track.album.uri, track.album.release_date, 
      //         track.name, track.uri
      //       ])
      //     )
      //   );
      //   toCsv(topTracks, '_short_tracks1-50');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/tracks?time_range=short_term&offset=49&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topTracks = [];
      //   body.items.forEach(track => 
      //     track.artists.forEach(artist => 
      //       topTracks.push([
      //         artist.name, artist.uri, 
      //         track.album.name, track.album.uri, track.album.release_date, 
      //         track.name, track.uri
      //       ])
      //     )
      //   );
      //   toCsv(topTracks, '_short_tracks51-100');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topTracks = [];
      //   body.items.forEach(track => 
      //     track.artists.forEach(artist => 
      //       topTracks.push([
      //         artist.name, artist.uri, 
      //         track.album.name, track.album.uri, track.album.release_date, 
      //         track.name, track.uri
      //       ])
      //     )
      //   );
      //   toCsv(topTracks, '_medium_tracks1-50');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/tracks?time_range=medium_term&offset=49&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topTracks = [];
      //   body.items.forEach(track => 
      //     track.artists.forEach(artist => 
      //       topTracks.push([
      //         artist.name, artist.uri, 
      //         track.album.name, track.album.uri, track.album.release_date, 
      //         track.name, track.uri
      //       ])
      //     )
      //   );
      //   toCsv(topTracks, '_medium_tracks51-100');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/tracks?time_range=long_term&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topTracks = [];
      //   body.items.forEach(track => 
      //     track.artists.forEach(artist => 
      //       topTracks.push([
      //         artist.name, artist.uri, 
      //         track.album.name, track.album.uri, track.album.release_date, 
      //         track.name, track.uri
      //       ])
      //     )
      //   );
      //   toCsv(topTracks, '_long_tracks1-50');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/tracks?time_range=long_term&offset=49&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topTracks = [];
      //   body.items.forEach(track => 
      //     track.artists.forEach(artist => 
      //       topTracks.push([
      //         artist.name, artist.uri, 
      //         track.album.name, track.album.uri, track.album.release_date, 
      //         track.name, track.uri
      //       ])
      //     )
      //   );
      //   toCsv(topTracks, '_long_tracks51-100');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/artists?time_range=short_term&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topArtists = [];
      //   body.items.forEach(artist => 
      //     artist.genres.forEach(genre =>
      //       topArtists.push([
      //         artist.name, artist.uri, genre
      //       ])
      //     )
      //   );
      //   toCsv(topArtists, '_short_artists1-50');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/artists?time_range=short_term&offset=49&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topArtists = [];
      //   body.items.forEach(artist => 
      //     artist.genres.forEach(genre =>
      //       topArtists.push([
      //         artist.name, artist.uri, genre
      //       ])
      //     )
      //   );
      //   toCsv(topArtists, '_short_artists51-100');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/artists?time_range=medium_term&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topArtists = [];
      //   body.items.forEach(artist => 
      //     artist.genres.forEach(genre =>
      //       topArtists.push([
      //         artist.name, artist.uri, genre
      //       ])
      //     )
      //   );
      //   toCsv(topArtists, '_medium_artists1-50');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/artists?time_range=medium_term&offset=49&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topArtists = [];
      //   body.items.forEach(artist => 
      //     artist.genres.forEach(genre =>
      //       topArtists.push([
      //         artist.name, artist.uri, genre
      //       ])
      //     )
      //   );
      //   toCsv(topArtists, '_medium_artists51-100');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/artists?time_range=long_term&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topArtists = [];
      //   body.items.forEach(artist => 
      //     artist.genres.forEach(genre =>
      //       topArtists.push([
      //         artist.name, artist.uri, genre
      //       ])
      //     )
      //   );
      //   toCsv(topArtists, '_long_artists1-50');
      // })

      // options['url'] = 'https://api.spotify.com/v1/me/top/artists?time_range=long_term&offset=49&limit=50';
      // request.get(options, function(err, res, body) {
      //   var topArtists = [];
      //   body.items.forEach(artist => 
      //     artist.genres.forEach(genre =>
      //       topArtists.push([
      //         artist.name, artist.uri, genre
      //       ])
      //     )
      //   );
      //   toCsv(topArtists, '_long_artists51-100');
      // })

      // var con = mysql.createConnection({
      //   host: 
      // })
    }
  });
});

app.listen(port);