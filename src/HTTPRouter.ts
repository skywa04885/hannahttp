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

import { HTTPMethod } from "./HTTPMethod";
import { HTTPRequest } from "./HTTPRequest";
import { HTTPResponse } from "./HTTPResponse";
import { HTTPPathMatcher } from "./HTTPPathMatcher";
import { HTTPPathMatch } from "./HTTPPathMatch";

export type HTTPRouterNextFunction = () => void;

export type HTTPRouterCallback<T = any> = (
  match: HTTPPathMatch,
  request: HTTPRequest<T>,
  response: HTTPResponse,
) => Promise<boolean>;

export enum HTTPSimpleRouterMethod {
  GET = 0,
  PUT = 1,
  POST = 2,
  HEAD = 3,
  DELETE = 4,
  CONNECT = 5,
  OPTIONS = 6,
  TRACE = 7,
  PATCH = 8,
}

export type HTTPSimpleRouterHandler = HTTPRouterCallback | HTTPSimpleRouter;
export type HTTPSimpleRouterElement = [
  HTTPSimpleRouterMethod | null,
  HTTPPathMatcher,
  HTTPSimpleRouterHandler
];

export class HTTPRouter {
  /**
   * Handles the given request.
   * @param request the request to handle.
   * @param response the response for the handled request.
   * @param path the optional path for when we're dealing with vhosts.
   * @returns a promise that resolves once the request is handled.
   */
  public async handle(
    request: HTTPRequest,
    response: HTTPResponse,
    path: string | null = null
  ): Promise<void> {
    throw new Error("Not implemented!");
  }
}

/**
 * Turns an http router method into it's numeric counterpart.
 * @param httpMethod the http method to get the numeric value of.
 * @returns the numeric method.
 */
export const httpSimpleRouterMethodFromHttpMethod = (
  httpMethod: HTTPMethod
): HTTPSimpleRouterMethod => {
  switch (httpMethod) {
    case HTTPMethod.GET:
      return HTTPSimpleRouterMethod.GET;
    case HTTPMethod.PUT:
      return HTTPSimpleRouterMethod.PUT;
    case HTTPMethod.POST:
      return HTTPSimpleRouterMethod.POST;
    case HTTPMethod.HEAD:
      return HTTPSimpleRouterMethod.HEAD;
    case HTTPMethod.DELETE:
      return HTTPSimpleRouterMethod.DELETE;
    case HTTPMethod.CONNECT:
      return HTTPSimpleRouterMethod.CONNECT;
    case HTTPMethod.OPTIONS:
      return HTTPSimpleRouterMethod.OPTIONS;
    case HTTPMethod.TRACE:
      return HTTPSimpleRouterMethod.TRACE;
    case HTTPMethod.PATCH:
      return HTTPSimpleRouterMethod.PATCH;
    default:
      throw new Error(`Unrecognized HTTP method: ${httpMethod}!`);
  }
};

export class HTTPSimpleRouter extends HTTPRouter {
  protected _elements: HTTPSimpleRouterElement[];

  /**
   * Constructs a new simple http router.
   */
  public constructor() {
    super();
    this._elements = [];
  }

  /**
   * Handles a PATCH request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public patch(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.PATCH, matcher, ...handlers);
  }

  /**
   * Handles a TRACE request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public trace(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.TRACE, matcher, ...handlers);
  }

  /**
   * Handles a CONNECT request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public connect(
    matcher: string,
    ...handlers: HTTPSimpleRouterHandler[]
  ): this {
    return this.register(HTTPMethod.CONNECT, matcher, ...handlers);
  }

  /**
   * Handles a HEAD request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public head(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.HEAD, matcher, ...handlers);
  }

  /**
   * Handles a PUT request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public put(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.PUT, matcher, ...handlers);
  }

  /**
   * Handles a DELETE request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public delete(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.DELETE, matcher, ...handlers);
  }

  /**
   * Handles a GET request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public get(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.GET, matcher, ...handlers);
  }

  /**
   * Handles a POST request.
   * @param matcher the pattern to match against.
   * @param handlers the handlers for when matches.
   * @returns the current instance.
   */
  public post(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(HTTPMethod.POST, matcher, ...handlers);
  }

  /**
   * Registers a handler for a matcher, that works with any method.
   * @param matcher the matcher.
   * @param handlers the handlers to run on all methods which paths match.
   * @returns the current instance.
   */
  public any(matcher: string, ...handlers: HTTPSimpleRouterHandler[]): this {
    return this.register(null, matcher, ...handlers);
  }

  /**
   * Registers a handler that will always match and run.
   * @param handler the handler to always run.
   * @returns the current instance.
   */
  public use(handler: HTTPSimpleRouterHandler): this {
    return this.register(null, "*", handler);
  }

  /**
   * Registers a new handler.
   * @param httpMethod the method to handle.
   * @param matcher the matcher that will determine if the handler should run.
   * @param handlers the handlers to run on the given method if the path matches.
   * @returns The current instance.
   */
  public register(
    httpMethod: HTTPMethod | null,
    matcher: string,
    ...handlers: HTTPSimpleRouterHandler[]
  ): this {
    // Gets the numeric version of the method (will allow quicker matching).
    const httpSimpleRouterMethod: HTTPSimpleRouterMethod | null =
      httpMethod !== null
        ? httpSimpleRouterMethodFromHttpMethod(httpMethod)
        : null;

    // Constructs the http uri matcher.
    const httpUriMatcher = HTTPPathMatcher.fromPath(matcher);

    // Inserts the element into the router.
    handlers.forEach((handler: HTTPSimpleRouterHandler): void => {
      this._elements.push([httpSimpleRouterMethod, httpUriMatcher, handler]);
    });

    // Returns the current instance.
    return this;
  }

  /**
   * Cleans a given path.
   * @param path the path to clean.
   * @returns the cleaned path.
   */
  protected cleanPath(path: string): string {
    // Replaces all the double slashes in the path with a single one.
    path = path.replace(/\/+/g, "/");

    // Trims off the trailing slash.
    if (path.endsWith("/") && path !== "/")
      path = path.substring(0, path.length - 1);

    // Returns the processed path.
    return path;
  }

  /**
   * Gets all the callbacks for the given method and path.
   * @param method the method to get all the callbacks for.
   * @param path the path to match all the matchers against.
   */
  public *callbacks(
    method: HTTPSimpleRouterMethod,
    path: string
  ): Generator<[HTTPPathMatch, HTTPRouterCallback]> {
    for (const element of this._elements) {
      // If the method does not match, continue.
      if (
        !(
          element[0] === null ||
          element[0] === method ||
          (element[0] === HTTPSimpleRouterMethod.GET &&
            method === HTTPSimpleRouterMethod.HEAD)
        )
      )
        continue;

      // Gets the matcher.
      const httpUriMatcher: HTTPPathMatcher = element[1];

      // Runs the matcher on the current path, and if nothing matches, simply continue.
      const httpUriMatcherResult: HTTPPathMatch | null =
        httpUriMatcher.match(path);
      if (httpUriMatcherResult === null) continue;

      // Gets the handler.
      const httpSimpleRouterHandler: HTTPSimpleRouterHandler = element[2];

      // Checks the type of handler, and if it is another router, yield all it's matches first.
      if (httpSimpleRouterHandler instanceof HTTPSimpleRouter) {
        // Makes sure if there is any remainder at all.
        const remainingPath: string = httpUriMatcherResult.remainder ?? "";

        // Yields all the matches.
        for (const match of httpSimpleRouterHandler.callbacks(
          method,
          remainingPath
        ))
          yield match;

        // Don't yield itself.
        continue;
      }

      // Yield the handler.
      yield [httpUriMatcherResult, httpSimpleRouterHandler];
    }
  }

  /**
   * Handles the given request.
   * @param httpRequest the request to handle.
   * @param httpResponse the response to pass with it.
   * @param path the optional supplied path, for when we're dealing with virtual hosts.
   * @returns a promise that resolves when the request is handled.
   */
  public async handle(
    httpRequest: HTTPRequest,
    httpResponse: HTTPResponse,
    path: string | null = null
  ): Promise<void> {
    // Gets the router method.
    const httpSimpleRouterMethod: HTTPSimpleRouterMethod =
      httpSimpleRouterMethodFromHttpMethod(httpRequest.method!);

    // Cleans up the path.
    path =
      path !== null
        ? this.cleanPath(path)
        : this.cleanPath(httpRequest.uri!.path);

    // Loops over all the callbacks.
    for (const [match, callback] of this.callbacks(
      httpSimpleRouterMethod,
      path
    )) {
      // Runs the callback, and breaks if we shouldn't run the next route.
      const next: boolean = await callback(match, httpRequest, httpResponse);
      if (!next) break;
    }
  }
}
