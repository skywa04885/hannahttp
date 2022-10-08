import { HTTPSimpleRouter } from "../HTTPRouter";
import { HTTPServerPlain } from "../HTTPServer";
import path from "path";
import serveStaticFiles from "../middleware/static";
import { bodyReader, jsonBodyParser } from "../middleware/body";
import { simpleLogger } from "../middleware/logging";

const httpSimpleNestedRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

httpSimpleNestedRouter.get("/all", (match, req, res, next) => {
  res.json({
    hello: "world",
  });
});

const httpSimpleRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

// httpSimpleRouter.use(simpleLogger());
httpSimpleRouter.use(bodyReader());
httpSimpleRouter.use(jsonBodyParser());

httpSimpleRouter.get("/", (match, req, res, next) => {
  res.file(path.join(__dirname, "files", "index.html"));
});

httpSimpleRouter.get("/api/*", httpSimpleNestedRouter);
httpSimpleRouter.get(
  "/static/*",
  serveStaticFiles(path.join(__dirname, "files"))
);

httpSimpleRouter.get("/test/:store_id/:article_id", (match, req, res, next) => {
  res.json({
    parameters: match.parameters,
  });
});

const httpServer: HTTPServerPlain = new HTTPServerPlain(httpSimpleRouter);

httpServer.listen(8080, "localhost", 10);
