const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');

const datastore = ds.datastore;

const BOAT = "Boat";
const LOAD = "Load";

router.use(bodyParser.json());

// Removed client ID info
const YOUR_CLIENT_ID = '...';

const {OAuth2Client} = require('google-auth-library');
const client = new OAuth2Client(YOUR_CLIENT_ID);
    
/* ------------- Begin Lodging Model Functions ------------- */

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

// Function to count number of boats that belong to an user
function count_boats(owner)
{
    var results = {};
    var query = datastore.createQuery(BOAT).filter('owner', '=', owner)
    return datastore.runQuery(query).then( (entities) => {
        results.boats = entities[0].map(ds.fromDatastore);
        var count = 0; 
        for(var object in results.boats)
        {
            count ++; 
        }

        return count; 
    });
}

// Function to add a boat
function post_boat(name, type, length, owner, req){
    // Get url: referenced: https://stackoverflow.com/questions/10183291/how-to-get-the-full-url-in-express
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    var key = datastore.key(BOAT);
    const new_boat = {"name": name, "type": type, "length": length, "owner": owner, "loads": []};
    return new Promise(function(resolve, reject){
        datastore.save({"key":key, "data":new_boat}, (err) =>{
            if(err){
                reject(new Error());
            }
            else{
                var newUrl = fullUrl +'/' + key.id;
                var result = {"id": key.id, "name": name, "type": type, "length": length, "owner": owner, "loads": [], "self": newUrl};
                resolve(result);
            }
        });
    });
}

// Function to get a boat with provided id that is associated with the requester
function get_boat(id, owner, req){
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const key = datastore.key([BOAT, parseInt(id, 10)]);
    var format = [];
    return new Promise( function(resolve, reject){
        datastore.get(key, (err, entity)=>{
            if(err || entity === undefined){
                reject(new Error());
            }
            else if(entity.owner !== owner)
            {
                reject(new Error("403"));
            }
            else{
                if(entity.loads !== [])
                {
                    // format loads to include id and self link
                    // referenced: https://stackoverflow.com/questions/40250139/push-object-into-array
                    for(var object in entity.loads)
                    {
                        var load = {}; 
                        load["id"] = entity.loads[object];
                        load["self"] = req.protocol + '://' + req.get('host') +'/loads/' + entity.loads[object];
                        format.push(load);
                    }
                }
                else
                {
                    format = entity.loads;
                }
                var result = {"id": key.id, "name": entity.name, "type": entity.type, "length": entity.length, "owner": entity.owner, "loads": format, "self": fullUrl};
                resolve(result)};
        });
    });
}

// Function to get all boats tied to a owner
function get_boats(owner, req){
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    var results = {};
    var query = datastore.createQuery(BOAT).filter('owner', '=', owner).limit(5);
    if(Object.keys(req.query).includes("cursor")){
        query = query.start(req.query.cursor);
    }
    return datastore.runQuery(query).then( (entities) => {
            results.boats = entities[0].map(ds.fromDatastore);
            for (var object in results.boats)
            {
                // Make sure self link does not have cursor in it
                if(Object.keys(req.query).includes("cursor"))
                {
                    results.boats[object].self = req.protocol + '://' + req.get('host') +'/boats/' + results.boats[object].id;
                }
                else{
                    results.boats[object].self = fullUrl +'/' + results.boats[object].id;
                }
            }
            if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS){
                results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encodeURIComponent(entities[1].endCursor);
            }
        }).then(()=>{
            return count_boats(owner).then((number) =>{
                results.total_count = number;
                return results; 
        });
    });
}

// Update boat details (PUT)
async function put_boat(id, name, type, length, owner, req){
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const key = datastore.key([BOAT, parseInt(id,10)]);
    const change_boat = {"name": name, "type": type, "length": length};
    return new Promise( function(resolve, reject){
        datastore.get(key, (err, entity)=>{
            if(err || entity === undefined){
                reject(new Error("404"));
            }
            else if(entity.owner !== owner)
            {
                reject(new Error("403"));
            }
            else{ 

                var boat = entity;
                change_boat.loads = boat.loads;
                change_boat.owner = boat.owner;
                datastore.update({"key":key, "data":change_boat}).then(() => {
                    var result = {"url": fullUrl};
                    resolve(result);
                });
            }
        });
    });
}

// Update boat details (PATCH)
async function patch_boat(id, name, type, length, owner, req){
    const key = datastore.key([BOAT, parseInt(id,10)]);
    return new Promise( function(resolve, reject){
        datastore.get(key, (err, entity)=>{
            if(err || entity === undefined)
            {
                reject(new Error());
            }
            else if(entity.owner !== owner)
            {
                // requester is not the owner of the boat
                reject(new Error("403"));
            }
            else
            { 
                if(name)
                {
                    if(type)
                    {
                        //all attributes exist
                        if(length)
                        {
                            var change_boat = {"name": name, "type": type, "length": length};
                        }
                        else
                        {
                            var change_boat = {"name": name, "type": type, "length": entity.length};
                        }
                    }
                    else if(!type && length)
                    {
                        // Just name and length are provided
                        var change_boat = {"name": name, "type": entity.type, "length": length};
                    }
                    else{
                        var change_boat = {"name": name, "type": entity.type, "length": entity.length};
                    }
                }
                // Check what new attributes are provided
                else if(!name && type)
                {
                    //type and length exist
                    if(length)
                    {
                        var change_boat = {"name": entity.name, "type": type, "length": length};
                    }
                    else
                    {
                        var change_boat = {"name": entity.name, "type": type, "length": entity.length};
                    }
                }
                else
                {
                    // Just length is provided
                    var change_boat = {"name": entity.name, "type": entity.type, "length": length};
                }

                // Don't update owner or loads on boat
                change_boat.loads = entity.loads;
                change_boat.owner = entity.owner;
                
                datastore.update({"key":key, "data":change_boat}).then(() => {
                    resolve(get_boat(id, owner, req));
                });
            }
        });
    });       
}

// Function to add load to boat and also update load's carrier info
async function put_load(bid, lid, owner){
    const bkey = datastore.key([BOAT, parseInt(bid, 10)]);
    const lkey = datastore.key([LOAD, parseInt(lid, 10)]);

    const [load] = await datastore.get(lkey); 
    const [boat] = await datastore.get(bkey);

    if(boat === undefined || load === undefined)
    {
        throw new Error("404");
    }
    // See if load is already been loaded
    else if(load.carrier.length > 0)
    {
        throw new Error("403");
    }
    else if(boat.owner !== owner)
    {
        throw new Error("403a");
    }
    else
    {
        boat.loads.push(lid);
        load.carrier.push(bid);

        return datastore.save({"key": bkey, "data": boat}).then(datastore.save({"key":lkey, "data": load}));
    }
}

// Function to remove load from boat and also update load's carrier info
async function delete_load(bid, lid, owner){
    const bkey = datastore.key([BOAT, parseInt(bid, 10)]);
    const lkey = datastore.key([LOAD, parseInt(lid, 10)]);

    const [load] = await datastore.get(lkey); 
    const [boat] = await datastore.get(bkey);

    if(boat === undefined || load === undefined)
    {
        throw new Error("404");
    }
    else if(boat.owner !== owner)
    {
        throw new Error("403a");
    }
    // Check if load is actually on boat
    else if(load.carrier.length === 0 || load.carrier[0] !== bid)
    {
        throw new Error("403");
    }
    else
    {
        // Find load on boat and remove it
        boat.loads.forEach(function(id)
        {
            if (id === lid)
            {
                var index = boat.loads.indexOf(id);
                boat.loads.splice(index, 1);
            }
        });
        
        // Remove boat information on load
        load.carrier = []; 

        return datastore.save({"key": bkey, "data": boat}).then(datastore.save({"key":lkey, "data": load}));
    }
}

// Function to clear load's carrier info - called by delete_boat function
async function remove_carrier(lid){
    const lkey = datastore.key([LOAD, parseInt(lid, 10)]);

    const [load] = await datastore.get(lkey); 

    // Remove boat information on load
    load.carrier = []; 

    return datastore.save({"key":lkey, "data": load});
}

// Function to delete boat and also unloads any loads on boat
async function delete_boat(id, owner){
    const bkey = datastore.key([BOAT, parseInt(id, 10)]);
    const [boat] = await datastore.get(bkey);

    if(boat === undefined)
    {
        throw new Error();
    }
    else if(boat.owner !== owner)
    {
        throw new Error("403");
    }
    else{
        if(boat.loads.length > 0)
        {
            var lkey;
            var promises = [];
            // unload all loads on boat - remove load's carrier info
            boat.loads.forEach(function(lid){
                promises.push(
                    remove_carrier(lid)
                );
            });

            // delete boat after all load's carrier info is cleared
            // referenced: https://stackoverflow.com/questions/38362231/how-to-use-promise-in-foreach-loop-of-array-to-populate-an-object
            Promise.all(promises).then(() => {
                datastore.delete(bkey);
            });
        }
        datastore.delete(bkey);
    }
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */

// Invalid requests for /boats route
router.delete('/', function(req, res){
    res.status(405).set('Accept', 'GET, POST').json({Error: "DELETE request not accepted at current route"});
});

// Invalid put request for /boats
router.put('/', function(req, res){
    res.status(405).set('Accept', 'GET, POST').json({Error:"PUT request not accepted at current route"});
});

// Invalid patch request for /boats
router.patch('/', function(req, res){
    res.status(405).set('Accept', 'GET, POST').json({Error:"PATCH request not accepted at current route"});
});

// Get all boats
router.get('/', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else{
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            get_boats(owner, req).then( (boats) => {
                res.status(200).json(boats);
            });
        }).catch(err => {
            console.log(err);
            res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
    
});

// Get a boat
router.get('/:id', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else{
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            get_boat(req.params.id, owner, req).then((boat)=> {
                res.status(200).json(boat);
            }).catch(error => {
                if(error.message === "403")
                {
                    res.status(403).json({Error: "Boat access denied"});
                }
                else
                {
                    res.status(404).json({Error: "No boat with this boat_id exists"});
                }
            });
        }).catch(err => {
            console.log(err);
            res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

// Invalid post request for /boats/:id
router.post('/:id', function(req, res){
    res.status(405).set('Accept', 'GET, PATCH, PUT').json({Error:"POST request not accepted at current route"});
});


// Add a boat
router.post('/', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else if(req.get('content-type') !== 'application/json')
    {
        res.status(415).json({Error: "Server only accepts application/json data"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else if(!req.body.name || !req.body.type || !req.body.length)
    {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
    else{
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            post_boat(req.body.name, req.body.type, req.body.length, owner, req).then((key) => {
                    res.status(201).json(key);
            });
        }).catch(err => {
                res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

// Edit a boat's information
router.put('/:id', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else if(req.get('content-type') !== 'application/json')
    {
        res.status(415).json({Error: "Server only accepts application/json data"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    //Don't update info if not all parameters exist-
    else if(!req.body.name || !req.body.type || !req.body.length)
    {
            res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
    else{
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            put_boat(req.params.id, req.body.name, req.body.type, req.body.length, owner, req)
            .then((key)=> {
                    res.status(303).json(key);
            }).catch(err =>{
                // Errors from put_boat function
                if(err.message === "404")
                {
                    res.status(404).json({Error: "No boat with this boat_id exists"});
                }
                else
                {
                    res.status(403).json({Error: "Boat access denied"});
                }
            });
        }).catch(error =>{
            // Error from checkJwt function
            res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

// PATCH edit a boat's information
router.patch('/:id', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    //reject non-json requests
    else if(req.get('content-type') !== 'application/json')
    {
        res.status(415).json({Error: "Server only accepts application/json data"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    //Don't update info if parameter(s) don't exist-
    else if(!req.body.name && !req.body.type && !req.body.length)
    {
        res.status(400).json({Error: "The request object is missing at least one of the required attributes"});
    }
    else{
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            patch_boat(req.params.id, req.body.name, req.body.type, req.body.length, owner, req)
                .then((key)=> {
                    res.status(200).json(key);
                }).catch(error =>{
                    if(error.message === "403")
                    {
                        res.status(403).json({Error: "Boat access denied"});
                    }
                    else{
                        res.status(404).json({Error: "No boat with this boat_id exists"});
                    }
                });
            }).catch(err => {
                // Error from checkJwt function
                res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

// Invalid post request for /boats/:id/loads/:id
router.post('/:bid/loads/:lid', function(req, res){
    res.status(405).set('Accept', 'PUT, DELETE').json({Error:"POST request not accepted at current route"});
});

// Invalid get request for /boats/:id/loads/:id
router.get('/:bid/loads/:lid', function(req, res){
    res.status(405).set('Accept', 'PUT, DELETE').json({Error:"GET request not accepted at current route"});
});

// Invalid patch request for /boats/:id/loads/:id
router.patch('/:bid/loads/:lid', function(req, res){
    res.status(405).set('Accept', 'PUT, DELETE').json({Error:"PATCH request not accepted at current route"});
});

//Add a load to a boat
router.put('/:bid/loads/:lid', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else
    {
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            put_load(req.params.bid, req.params.lid, owner)
            .then(() => {res.status(204).end()})
            //If load is taken or boat/load don't exist
            .catch(err => {
                if(err.message === "403")
                {
                    res.status(403).json({Error: "The load is already on another boat"});
                }
                else if(err.message === "403a")
                {
                    res.status(403).json({Error: "Boat access denied"});
                }
                else
                {
                    res.status(404).json({Error: "The specified boat and/or load don\u0027t exist"});
                }
            });
        // JWT is invalid
        }).catch(err => {
            res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

//Remove a load from boat
router.delete('/:bid/loads/:lid', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else
    {
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            delete_load(req.params.bid, req.params.lid, owner)
            .then(() => {res.status(204).end()})
            .catch(err => {
                if(err.message === "403")
                {
                    res.status(403).json({Error: "The load is not on this boat"});
                }
                else if(err.message === "403a")
                {
                    res.status(403).json({Error: "Boat access denied"});
                }
                else
                {
                    res.status(404).json({Error: "The specified boat and/or load don\u0027t exist"});
                }
            });
         // JWT is invalid
        }).catch(err => {
            res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

//Delete a boat
router.delete('/:id', function(req, res){
    if(!req.headers.authorization)
    {
        res.status(401).json({Error: "Missing or invalid JWT"});
    }
    else
    {
        // Remove "Bearer" from string
        // Referenced: https://stackoverflow.com/questions/10398931/how-to-remove-text-from-a-string
        var jwtToken = req.headers.authorization.replace("Bearer ", ""); 
        checkJwt(jwtToken).then((result) => {
            var owner = result['sub'];
            delete_boat(req.params.id, owner).then(() => {res.status(204).json()})
            .catch(error =>{
                if(error.message === "403")
                {
                    res.status(403).json({Error: "Boat access denied"});
                }
                else{
                    res.status(404).json({Error: "No boat with this boat_id exists"});
                }
            });
        }).catch(err => {
            // Error from checkJwt function
            res.status(401).json({Error: "Missing or invalid JWT"});
        });
    }
});

module.exports = router;