const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const ds = require('./datastore');

const datastore = ds.datastore;

const LOAD = "Load";
const BOAT = "Boat";

router.use(bodyParser.json());


/* ------------- Begin Lodging Model Functions ------------- */
// Function to count number of loads
function count_loads()
{
    var results = {};
    var query = datastore.createQuery(LOAD);
    return datastore.runQuery(query).then( (entities) => {
        results.loads = entities[0].map(ds.fromDatastore);
        var count = 0; 
        for(var object in results.loads)
        {
            count ++; 
        }

        return count; 
    });
}

// Function to add load
function post_load(weight, content, date, req){
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    var key = datastore.key(LOAD);
    const new_load = {"weight": weight,  "content": content, "delivery_date": date, "carrier": []};
    return new Promise(function(resolve, reject){
        datastore.save({"key":key, "data":new_load}, (err) =>{
            if(err){
                reject(new Error());
            }
            else{
                var newUrl = fullUrl +'/' + key.id;
                var result = {"id": key.id, "weight": weight, "content": content, "delivery_date": date, "carrier": [], "self": newUrl};
                return resolve(result);
            }
        });
    });
}

// Function to pull loads in datastore, five at a time
function get_loads(req){
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    //Limit to three boat results per page
    var q = datastore.createQuery(LOAD).limit(5);

    var results = {};

    if(Object.keys(req.query).includes("cursor")){
        q = q.start(req.query.cursor);
    }

    return datastore.runQuery(q).then( (entities) => {
            results.loads = entities[0].map(ds.fromDatastore);
            for (var object in results.loads)
            {
                if(results.loads[object].carrier.length === 1)
                {
                    var bid = results.loads[object].carrier[0];
                    var boatUrl = req.protocol + '://' + req.get('host') + '/boats/' + bid;
                    results.loads[object].carrier = [];
                    results.loads[object].carrier = {"id": bid, "self": boatUrl};
                }
                
                // Make sure self link does not have cursor in it
                if(Object.keys(req.query).includes("cursor"))
                {
                    results.loads[object].self = req.protocol + '://' + req.get('host') + results.loads[object].id;
                }
                else
                {
                    results.loads[object].self = fullUrl +'/' + results.loads[object].id;
                }
            }
            if(entities[1].moreResults !== ds.Datastore.NO_MORE_RESULTS){
                results.next = req.protocol + "://" + req.get("host") + req.baseUrl + "?cursor=" + encodeURIComponent(entities[1].endCursor);
            }
    }).then(() =>{
        return count_loads().then((number) => {
            results.total_count = number;
            return results; 
        });
    });
}

// Function to edit a load (PUT)
async function put_load(id, weight, content, date, req)
{
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const key = datastore.key([LOAD, parseInt(id,10)]);
    const change_load = {"weight": weight, "content": content, "delivery_date": date};

    return new Promise(function(resolve, reject){
        datastore.get(key, (err, entity) =>{
            if(err || entity === undefined){
                reject(new Error("404"));
            }
            else{ 
                var load = entity;
                change_load.carrier = load.carrier;
                datastore.update({"key":key, "data":change_load}).then(() => {
                    var result = {"url": fullUrl};
                    resolve(result);
                });
            }
        });
    });
}

// Function to edit a load (PATCH)
async function patch_load(id, weight, content, date, req)
{
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    return new Promise(function(resolve, reject){
        datastore.get(key, (err, entity) => {
            if(err || entity === undefined)
            {
                // load does not exist
                reject(new Error());
            }
            else
            {
                if(weight)
                {
                    if(content)
                    {
                        if(date)
                        {
                            // User entered all three properties to be changed
                            var change_load = {"weight": weight, "content": content, "delivery_date": date};
                        }
                        else
                        {
                            // Just weight and content
                            var change_load = {"weight": weight, "content": content, "delivery_date": entity.delivery_date};
                        }
                    }
                    else if(!content && date)
                    {
                        // Just weight and date
                        var change_load = {"weight": weight, "content": entity.content, "delivery_date": date};
                    }
                    else
                    {
                        // Just weight
                        var change_load = {"weight": weight, "content": entity.content, "delivery_date": entity.delivery_date};
                    }
                }
                else if(!weight && content)
                {
                    if(date)
                    {
                        // Just content and date
                        var change_load = {"weight": entity.weight, "content": content, "delivery_date": date};
                    }
                    else
                    {
                        // Just content
                        var change_load = {"weight": entity.weight, "content": content, "delivery_date": entity.delivery_date};
                    }
                }
                else
                {
                    // Just date
                    var change_load = {"weight": entity.weight, "content": entity.content, "delivery_date": date};
                }

                // Don't change carrier info
                change_load.carrier = entity.carrier; 

                // Update record and display updated record
                datastore.update({"key": key, "data": change_load}).then(() => {
                    resolve(get_load(id, req));
                });
            }
        });
    });
}

// Function to pull a load's information from datastore
function get_load(id, req){
    var fullUrl = req.protocol + '://' + req.get('host') + req.originalUrl;
    const key = datastore.key([LOAD, parseInt(id, 10)]);
    var format = []; 
    return new Promise( function(resolve, reject){
        datastore.get(key, (err, entity)=>{
            if(err || entity === undefined){
                reject(new Error());
            }
            else{
                if(entity.carrier.length > 0)
                {
                    // Format boat display to include self url
                    format.push({"boat_id": entity.carrier[0], "self": req.protocol + '://' + req.get('host') + '/boats/' + entity.carrier[0]}); 
                }
                else
                {
                    format = entity.carrier; 
                }
                var result = {"id": key.id, "weight": entity.weight, "content": entity.content, "delivery_date": entity.delivery_date, "carrier": format, "self": fullUrl};
                resolve(result)};
        });
    });

}

// Function to delete load, also removes it from boat if it's loaded 
async function delete_load(id){
    const key = datastore.key([LOAD, parseInt(id,10)]);

    const [load] = await datastore.get(key);

    if(load === undefined){
        throw new Error(); 
    }
    else{
        // load is loaded on boat
        if(load.carrier.length > 0)
        {
            const bkey = datastore.key([BOAT, parseInt(load.carrier[0], 10)]);
            
            const [boat] = await datastore.get(bkey);

            // Go through all the loads on boat and delete the load with matching id
            boat.loads.forEach(function(lid)
            {
                if (lid === id)
                {
                    var index = boat.loads.indexOf(lid);
                    boat.loads.splice(index, 1);
                }
            });
            //Update boat's load information
            datastore.save({"key": bkey, "data": boat});
        }
        datastore.delete(key);
    }
}

/* ------------- End Model Functions ------------- */

/* ------------- Begin Controller Functions ------------- */
// Invalid requests for /loads route
router.delete('/', function(req, res){
    res.status(405).set('Accept', 'GET, POST').json({Error: "DELETE request not accepted at current route"});
});

// Invalid put request for /loads route
router.put('/', function(req, res){
    res.status(405).set('Accept', 'GET, POST').json({Error:"PUT request not accepted at current route"});
});

// Invalid patch request for /loads route
router.patch('/', function(req, res){
    res.status(405).set('Accept', 'GET, POST').json({Error:"PATCH request not accepted at current route"});
});


// Get all loads
router.get('/', function(req, res){
    if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else
    {
        get_loads(req).then((loads) => {
            res.status(200).json(loads);
        });
    }
});

// Get load details
router.get('/:id', function(req, res){
    if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else
    {
        get_load(req.params.id, req).then((load)=> {
            res.status(200).json(load);
        }).catch(error => {
            res.status(404).json({Error: "No load with this load_id exists"});
        });
    }
})

// Invalid post request for /boats/:id
router.post('/:id', function(req, res){
    res.status(405).set('Accept', 'GET, PATCH, PUT').json({Error:"POST request not accepted at current route"});
});

// Add new load
router.post('/', function(req, res){
    if(req.get('content-type') !== 'application/json')
    {
        res.status(415).json({Error: "Server only accepts application/json data"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else if(!req.body.weight || !req.body.content || !req.body.delivery_date)
    {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
    else{
        post_load(req.body.weight, req.body.content, req.body.delivery_date, req).then((key) => {
            res.status(201).json(key);
        });
    }
});

// Edit a load
router.put('/:id', function(req, res){
    if(req.get('content-type') !== 'application/json')
    {
        res.status(415).json({Error: "Server only accepts application/json data"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else if(!req.body.weight || !req.body.content || !req.body.delivery_date)
    {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
    else
    {
        put_load(req.params.id, req.body.weight, req.body.content, req.body.delivery_date, req).then((key) => {
            res.status(303).json(key);
        }).catch(err =>{
            res.status(404).json({Error: "No load with this load_id exists"});
        });
    }
});

// PATCH edit a load
router.patch('/:id', function(req, res){
    if(req.get('content-type') !== 'application/json')
    {
        res.status(415).json({Error: "Server only accepts application/json data"});
    }
    else if(!req.accepts(['application/json']))
    {
        res.status(406).json({Error: "Server only responds with application/json data"});
    }
    else if(!req.body.weight && !req.body.content && !req.body.delivery_date)
    {
        res.status(400).json({ Error: "The request object is missing at least one of the required attributes"});
    }
    else
    {
        patch_load(req.params.id, req.body.weight, req.body.content, req.body.delivery_date, req).then((key) => {
            res.status(200).json(key);
        }).catch(err =>{
            res.status(404).json({Error: "No load with this load_id exists"});
        });
    }
});

//Delete a load, frees up boat if boat has load
router.delete('/:id', function(req, res){
    delete_load(req.params.id).then(() => {
        res.status(204).json();
    })
    .catch(error =>{
        res.status(404).json({Error: "No load with this load_id exists"});
    });
});

module.exports = router;