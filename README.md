# Cloud-App-Dev-Final-Project
OSU CS 493 Cloud Application Development Final Project

The goal of this project is to implement a RESTful API that have the following features. The application will be deployed on Google Cloud Platform. 

a. An entity to model the user.
b. At least two other non-user entities.
c. The two non-user entities need to be related to each other.
d. The user needs to be related to at least one of the non-user entities.
e. Resources corresponding to the non-user entity related to the user must be protected.

Requirements for non-user entities
a. For each entity a collection URL must be provided that is represented  by the collection name. E.g.,  GET /boats represents the boats collection. If an entity is related to a user, then the collection URL must show only those entities in the collection which are related to the user corresponding to the valid JWT   provided in the request. E.g., if each boat is owned by a user, then GET /boats should only show those entities that are owned by the user who is authenticated by the JWT supplied in the request
b. For an entity that is not related to users, the collection URL should show all the entities in the collection.
c. The collection URL for an entity must implement paging showing 5 entities at a time. At a minimum it must have a 'next' link on every page except the last. The collection must include a property that indicates how many total items are in the collection.
d. Every representation of an entity must have a 'self' link pointing to the canonical representation of that entity. This must be a full URL, not relative path.
e. Each entity must have at least 3 properties of its own. Id and self are not consider a property in this count. Properties to model related entities are also no consider a property in this count. E.g., a boat is not a property of a load in this count, and neither is the owner of a boat.
f. Properties that correspond to creation date and last modified date will be considered towards this count.
g. Every entity must support all 4 CRUD operations, i.e., create/add, read/get, update/edit and delete. You must handle any "side effects" of these operations on an entity to other entities related to the entity. Update for an entity should support both PUT and PATCH.
i. Every CRUD operation for an entity related to a user must be protected and require a valid JWT corresponding to the relevant user. You must provide an endpoint to create a relationship and another to remove a relationship between the two non-user entities. It is your design choice to make these endpoints protected or unprotected.
j. If an entity has a relationship with other entities, then this info must be displayed in the representation of the entity. E.g., if a load is on a boat, then the representation of the boat must show the relationship with this load; the representation of this load must show the relationship with this boat.
k. There is no requirement to provide dedicated endpoints to view just the relationship
l. For endpoints that require a request body, you only need to support JSON representations in the request body. Requests to some endpoints, e.g., GET don't have a body. This point doesn't apply to such endpoints.
m. Any response bodies should be in JSON, including responses that contain an error message. Responses from some endpoints, e.g., DELETE, don't have a body. This point doesn't apply to such endpoints.
n. Any request to an endpoint that will send back a response with a body must include 'application/json' in the accept header. If it doesn't have such a header, such a request should be rejected.

User Details
a. You must have a User entity in your database.
b. You must support the ability for users of the application to create user accounts. There is no requirement to edit or delete users.
c. You may choose from the following methods of handling user accounts: you can handle all account creation and authentication yourself or you can use a 3rd party authentication service.
d. You must provide a URL where a user can provide a username and password to login or create a user account.
e. Requests for the protected resources must use a JWT for authentication. So you must show the JWT to the user after the login. You must also show the user's unique ID after login.
f. The choice of what to use as the user's unique ID is up to you. You can use the value of "sub" from the JWT as a user's unique ID. But this is not required.
g. You must provide an unprotected endpoint GET /users that returns all the users currently registered in the app, even if they don't currently have any relationship with a non-user entity. The response does not need to be paginated. Minimally this endpoint should display the unique ID for a user. Beyond that it is your choice what else is displayed.
h. There is no requirement for an integration at the UI level between the login page and the REST API endpoints.

Status Codes
Your application should support at least the following status codes
200
201
204
401
403
405
406
