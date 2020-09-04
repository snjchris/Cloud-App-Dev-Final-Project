const express = require('express');
const app = express();

var handlebars = require('express-handlebars').create({defaultLayout:'main'});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');
app.use(express.static('public'))

var bodyParser = require('body-parser');
app.use(bodyParser.json());

app.use('/', require('./user.js'));
app.use('/boats', require('./boats.js'));
app.use('/loads', require('./loads.js'));

// IF route to a page that is not found, render a HTTP 404 response.
app.use(function(req, res)
{
    res.status(404);
    res.render('404');
});
  
// IF internal server error occurs when processing a route, render a HTTP 500 response.  
app.use(function(err, req, res, next)
{
    console.error(err.stack);
    res.status(500);
    res.render('500');
});

// Listen to the App Engine-specified port, or 8080 otherwise
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}...`);
});