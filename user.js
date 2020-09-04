const express = require('express');
const router = express.Router();

const {google} = require('googleapis');
const ds = require('./datastore');
const datastore = ds.datastore;

const USER = 'User'; 
const bodyParser = require('body-parser');


router.use(bodyParser.json());

// Removed details on client ID, secret and (inactive) website 
const YOUR_CLIENT_ID = '...';
const YOUR_CLIENT_SECRET = '...';
const YOUR_REDIRECT_URL = '...';
var code = ''; 

const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(YOUR_CLIENT_ID);

// Google OAuth client 
// Code taken from https://github.com/googleapis/google-api-nodejs-client/#authentication-and-authorization
const oauth2Client = new google.auth.OAuth2(
  YOUR_CLIENT_ID,
  YOUR_CLIENT_SECRET,
  YOUR_REDIRECT_URL
);

google.options({
  auth: oauth2Client
});

async function GetToken(code)
{
  const {tokens} = await oauth2Client.getToken(code)
  oauth2Client.setCredentials(tokens);
  return tokens; 
}

// generate a url that asks permissions for Blogger and Google Calendar scopes
const scopes = [
  'openid profile email'
];

const url = oauth2Client.generateAuthUrl({
  // 'online' (default) or 'offline' (gets refresh_token)
  access_type: 'offline',

  // If you only need one scope you can pass it as a string
  scope: scopes
});

// Verify token is valid
// Code taken from https://developers.google.com/identity/sign-in/web/backend-auth
async function checkJwt(jwtToken){
    const ticket = await client.verifyIdToken({
        idToken: jwtToken, 
        audience: YOUR_CLIENT_ID,
        });

    const payload = ticket.getPayload(); 

    return payload; 
} 

// Function to register owner if new
function regUser(sub){
    var result = {}; 
    const query = datastore.createQuery(USER).filter('uniqueID', '=', sub);
    return datastore.runQuery(query).then((results) => {
        result = results[0].map(ds.fromDatastore);

        // Save user if new account
        if(result == "")
        {
            var key = datastore.key(USER);
            const new_user = {"uniqueID": sub};
            return datastore.save({"key":key, "data":new_user}); 
        }
    }); 
}

//Function to get all users
function get_users(){
    const q = datastore.createQuery(USER);
    return datastore.runQuery(q).then( (entities) => {
            var result = entities[0].map(ds.fromDatastore);
            return result; 
        });
}

router.get('/', function(req, res, next){
	res.render('index', {title: "Welcome"});
});

// user clicks on agree button and will be redirect to google's permission page
router.get('/authorize', function(req, res, next){
  res.redirect(url); 
}); 

// Function to get token and sub from authorize_code, uses OAuth client library
router.get('/token', function(req, res, next)
{
  var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
  // get code from url 
  // referenced: https://stackoverflow.com/questions/979975/how-to-get-the-value-from-the-get-parameters
  var search = new URL(fullUrl);
    code = search.searchParams.get('code');
    GetToken(code).then((result) => {
      var context = {}; 
      context.JWT = result.id_token; 
      checkJwt(result.id_token).then((results) =>
      {
        context.id = results.sub;
        regUser(results.sub).then(() => {
            res.render('info', context);
        });
      });
    }).catch(err =>{
      console.log(err);
    });
});

// Display all registered users
router.get('/users', function(req, res){
    if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else
    {
        get_users().then((users) =>{
            res.status(200).json(users);
        });
    }
});

// Invalid requests for /users route
router.delete('/users', function(req, res){
    res.status(405).set('Accept', 'GET').json({Error: "DELETE request not accepted at current route"});
});

router.post('/users', function(req, res){
    res.status(405).set('Accept', 'GET').json({Error: "POST request not accepted at current route"});
});

//Invalidate put request for /boats
router.put('/users', function(req, res){
    res.status(405).set('Accept', 'GET').json({Error:"PUT request not accepted at current route"});
});

//Invalidate patch request for /boats
router.patch('/users', function(req, res){
    res.status(405).set('Accept', 'GET').json({Error:"PATCH request not accepted at current route"});
});

module.exports = router;