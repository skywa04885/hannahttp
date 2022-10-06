import { HTTPSimpleRouter } from "../HTTPRouter";
import { HTTPServerPlain } from "../HTTPServer";
import { middleware } from "../middleware";
import path from 'path';

const httpSimpleNestedRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

httpSimpleNestedRouter.get('/all', (req, res, next) => {
  res.json({
    hello: "world"
  });
});

const httpSimpleRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

httpSimpleRouter.use(middleware.logging.simple);
httpSimpleRouter.use(middleware.body.reader);
httpSimpleRouter.use(middleware.body.json);

httpSimpleRouter.get('/', (req, res, next) => {
  res.file(path.join(__dirname, 'files', 'index.html'));
});

httpSimpleRouter.get('/api/*', httpSimpleNestedRouter);

httpSimpleRouter.any('/*', (req, res, next) => {
  res.text('Page not found!', 404);
});

console.dir(httpSimpleRouter, { depth: null});

const httpServer: HTTPServerPlain = new HTTPServerPlain(httpSimpleRouter);

httpServer.httpServerSocket.listen(8080, 'localhost', 10);