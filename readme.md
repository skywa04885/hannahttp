# HannaHTTP

HannaHTTP is a work-in-progress simple express.js alternative.

## Example

```ts
// Creates the nested router.
const httpSimpleNestedRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

// Example of using compression and json in the nested router.
httpSimpleNestedRouter.get(
  "/all",
  useCompression({}),
  (match, req, res, next) => {
    res.json({
      hello: "world",
    });
  }
);

// Creates the primary router.
const httpSimpleRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

// Examples of using middleware that processes parts of the request.
httpSimpleRouter.use(bodyReader());
httpSimpleRouter.use(jsonBodyParser());

// Simple file serving.
httpSimpleRouter.get("/", (match, req, res, next): any => {
  return res.file(path.join(__dirname, "views", "index.html"));
});

// Example of nested router.
httpSimpleRouter.get("/api/*", httpSimpleNestedRouter);

// Example of static file serving with compression.
httpSimpleRouter.get(
  "/static/*",
  useCompression({
    match: /(\.html|\.js|\.css)$/, // Only compress files that match the expression.
    useDeflate: true,
    useGzip: true,
  }),
  serveStaticFiles(path.join(__dirname, "static"))
);

// Example where parameters are given in the request, each starts with ':'
//  and are not allowed to start / end with __ (due to system usage).
httpSimpleRouter.get("/test/:store_id/:article_id", (match, req, res, next): any => {
  return res.json({
    parameters: match.parameters,
  });
});

// Sends a 404 page not found for all remaining matches.
httpSimpleRouter.any("/*", (match, req, res, next) => res.text("", 404));

// Creates the server settings.
const settings: HTTPSettings = new HTTPSettings();
settings.sessionLogLevel = HTTPSessionLogLevel.Trace;

// Creates and listens the server.
const httpServer: HTTPServerPlain = new HTTPServerPlain(httpSimpleRouter, settings);
httpServer.listen(8080, "localhost", 10);
```