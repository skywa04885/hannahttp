# HannaHTTP

HannaHTTP is a work-in-progress simple express.js alternative.
Up to this point, it's already better than express.js due to the internal usage of promises,
so no callback hell, and also less-hacky methods of transforming the response body. Further
it automatically picks the proper transfer encoding, to speed up the process, and prevent
the server from having too large buffers. With this I mean, that if it detects transform
streams or an unknown size, it will automatically write the response chunked.

Also one thing that sets this apart from express, is the way requests are handled. In
express the parameters are stored in the request object, which obviously doesn't make any
sense, because a request can match multiple pieces of middleware, of which each has
different patterns and other paramteres, which is why there is a separate match object
given to each piece of middleware, containing the paramters and remainder of the match.
With remainder I mean the remaining part of the URI when the user has used the * wildcard
at the end of the matching path.

## Dependencies

1. consolidate
## Features

1. Full-Blown HTTP Router with wildcards.
1. Async API for everything.
## Built-In Middleware

The library contains many pieces of middleware that will supply the user (you)
with all the built in funcionality you could desire. This prevents you from having
to install crappy external libraries (which express.js usually requires you to do).

1. Compression (Compresses the response with either: Deflate, GZIP or Brotli).
1. Body Reader (Reads the request body based on the Content-Length).
1. Body JSON Parser (Parses the read request body to json).
1. Body X-WWW-FORM-URIENCODED Parser (Parses form data from the read request body).
1. Cache (Caches complete responses for a given amount of time).
1. Static File Serving (Serves static files in the given directory).
1. LetsEncrypt Certbot (Generates and maintains letsencrypt certificates).
1. Virtual Hosting (Calls different routers based on the requested host).

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