# HannaHTTP

HannaHTTP is a work-in-progress simple express.js alternative.

## Dependencies

1. consolidate

## Example

```ts
const {
  useBodyReader,
  HTTPServerPlain,
  HTTPSimpleRouter,
  HTTPSettings,
  useJsonBodyParser,
  useCompression,
  HTTPSessionLogLevel,
  useStatic,
} = require("hannahttp");
const path = require("path");

// Creates the router and the settings.
const router = new HTTPSimpleRouter();
const settings = new HTTPSettings();

// By changing the log level in the settings, we can see what happens
//  in the request (trace shows all details).
settings.sessionLogLevel = HTTPSessionLogLevel.Trace;

// The request body is not read by default (since the headers aren't handled yet).
//  so in order to read the request body, this piece of middleware needs to be called.
router.use(useBodyReader());

// Now in order to actually decode the json body, we need to call this middleware.
//  this middleware parses the json body, and stores it in req.u.body;
router.use(useJsonBodyParser());

// Now to compress text-based responses, we can use the compress middleware
//  which will either use GZIP or Deflate depending on the Accept-Encoding
//  and the server configuration (as bellow). The match regex can be adjuested
//  to determine which files will be compressed (since we don't want blobs to be
//  compressed as this is too expensive).
router.use(
  useCompression({
    match: /(\.html|\.txt|\.css|\.js)$/,
    useGzip: true,
    useDeflate: true,
  })
);

// Simple example of a nested router. A nested router can be
//  used to speed up request handing since less regular expressions
//  need to be matched, again use a all match (*) so the remainder
//  can be used by the nested router.
const nestedRouter = new HTTPSimpleRouter();

nestedRouter.get('/example', async (match, req, res) => {
  await res.text('Yes! It works...');

  // Returning false will prevent the next piece of middelware
  //  from being called, returning true will call the next one.
  return false;
});

router.get('/nested/*', nestedRouter);

// Here we serve static files in the given directory (in our case 'static').
//  remember that we need to define an all match (*) so that the middleware
//  will get the remainder, and use that as a file path.
router.get("/static/*", useStatic(path.join(__dirname, "static")));

// Example of simple response.
router.get("/", async (match, req, res) => {
  await res.text("Hello world!");
  return false;
});

// Example showing parameters (starting with :) and the all match (at the end of uri with *).
//  the match object will contain the parameters, and the remainder (the matched part by *).
router.get("/:param1/:param2/:param3/*", async (match, req, res) => {
  await res.json({
    match,
  });

  return false;
});

// Here an all match is used to send a 404 page.
router.any("/*", async (match, req, res) => {
  await res.text(`Page '${match.remainder}' not found!`, 404);
  
  return false;
});

// Creates the server and starts listening.
const server = new HTTPServerPlain(router, settings);
server.listen(8080, "0.0.0.0", 100);


```