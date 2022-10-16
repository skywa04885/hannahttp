/*
  HannaHTTP extremely fast and customizable HTTP server.
  Copyright (C) Luke A.C.A. Rieff 2022

  This program is free software: you can redistribute it and/or modify
  it under the terms of the GNU General Public License as published by
  the Free Software Foundation, either version 3 of the License, or
  (at your option) any later version.

  This program is distributed in the hope that it will be useful,
  but WITHOUT ANY WARRANTY; without even the implied warranty of
  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
  GNU General Public License for more details.

  You should have received a copy of the GNU General Public License
  along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { HTTPSimpleRouter } from "../HTTPRouter";
import { HTTPServerPlain } from "../HTTPServer";
import path from "path";
import useStatic from "../middleware/static";
import { useBodyReader, useJsonBodyParser } from "../middleware/body";
import { useLogging } from "../middleware/logging";
import { useCompression } from "../middleware/compress";
import { HTTPSettings } from "../HTTPSettings";
import { HTTPSessionLogLevel } from "../HTTPSession";
import { useCache } from "../middleware/cache";
import { useVhost } from "../middleware/vhost";

// Creates the nested router.
const httpSimpleNestedRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

// Example of using compression and json in the nested router.
httpSimpleNestedRouter.get(
  "/all",
  (match, req, res, next) => {
    res.json({
      hello: "world",
    });
  }
);

// Creates the primary router.
const httpSimpleRouter: HTTPSimpleRouter = new HTTPSimpleRouter();

// Examples of using middleware that processes parts of the request.
httpSimpleRouter.use(useBodyReader());
httpSimpleRouter.use(useJsonBodyParser());

// Simple file serving.
httpSimpleRouter.get("/", (match, req, res, next): any => {
  return res.file(path.join(__dirname, "views", "index.html"));
});

// Example of nested router.
httpSimpleRouter.get("/api/*", httpSimpleNestedRouter);

// Example of static file serving with compression.
httpSimpleRouter.get(
  "/static/*",
  useCache({
    ttl: 60000,
  }),
  useCompression({
    match: /(\.html|\.js|\.css|\.jpg)$/, // Only compress files that match the expression.
    useDeflate: true,
    useGzip: true,
  }),
  useStatic(path.join(__dirname, "static"))
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
// settings.sessionLogLevel = HTTPSessionLogLevel.Trace;

// Creates and listens the server.
const httpServer: HTTPServerPlain = new HTTPServerPlain(httpSimpleRouter, settings);
httpServer.listen(8080, "localhost", 10);
