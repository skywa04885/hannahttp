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

import { request } from "http";
import { HTTPContentType } from "../HTTPContentType";
import { HTTPHeaderType } from "../HTTPHeaderType";
import { HTTPPathMatch } from "../HTTPPathMatch";
import {
  HTTPRequest,
  HTTPRequestBufferBody,
  HTTPRequestEvent,
} from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import { HTTPRouter, HTTPRouterCallback, HTTPRouterNextFunction } from "../HTTPRouter";

export interface IBodyReaderOptions {}

/**
 * Constructs a middleware to read a body.
 * @param options the options for the body reader.
 * @returns the middleware to read the body into a buffer.
 */
export const useBodyReader = (
  options?: IBodyReaderOptions
): HTTPRouterCallback => {
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    // Gets the content length string, if not there just call the next function/
    const contentLengthString: string | null =
      request.headers!.getSingleHeader("content-length") ?? null;
    if (contentLengthString === null) return true;

    // Gets the content length number, and if it's not valid (<= 0) go to next route.
    const contentLength: number = parseInt(contentLengthString);
    if (contentLength <= 0) return true;

    // Loads the buffered body.
    await request.loadBufferBody(contentLength);

    // Goes to the next middleware.
    return true;
  };
};

export interface IUseJsonBodyParserOptions {}

/**
 * Constructs a middleware to parse a json body.
 * @param options the options for the json body parser.
 * @returns the middleware to parse a json body.
 */
export const useJsonBodyParser = (
  options?: IUseJsonBodyParserOptions
): HTTPRouterCallback => {
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    // If the request body is not json, just go to the next callback.
    if (
      request.headers!.getSingleHeader(HTTPHeaderType.ContentType) !==
      HTTPContentType.ApplicationJson
    )
      return true;

    // Gets the request body and interprets it as a buffer body.
    const bufferBody: HTTPRequestBufferBody =
      request.body as HTTPRequestBufferBody;

    // Get the string version of the buffer in the request body.
    const bodyString: string = bufferBody.buffer.toString("utf-8");

    // Parses the json, and puts it in the request user data.
    const bodyObject: any = JSON.parse(bodyString);
    request.u.body = bodyObject;

    // Continues to the next route.
    return true;
  };
};

export interface IUseUrlEncodedBodyParserOptions {}

/**
 * Creates a piece of middleware that decode an X-WWW-FORM-URLENCODED body.
 * @param options the options for the middleware.
 * @returns the callback that will process the body,
 */
export const useUrlEncodedBodyParser = (options?: IUseUrlEncodedBodyParserOptions): HTTPRouterCallback =>  {
  // Sets the default options.
  options = Object.assign({}, options);

  // Returns the middleware.
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    // If the request body is not json, just go to the next callback.
    if (
      request.headers!.getSingleHeader(HTTPHeaderType.ContentType) !==
      HTTPContentType.ApplicationXWWWFormUrlencoded
    )
      return true;

    // Gets the request body and interprets it as a buffer body.
    const bufferBody: HTTPRequestBufferBody =
      request.body as HTTPRequestBufferBody;

    // Get the string version of the buffer in the request body.
    const bodyString: string = bufferBody.buffer.toString("utf-8");

    // Parses the json, and puts it in the request user data.
    const bodyObject: any = Object.fromEntries(bodyString.split("&").map((pair: string): [string, string] => {
      // Splits the pair into segments.
      const pairSegments: string[] = pair.split('=');
      if (pairSegments.length !== 2) 
        throw new Error(`Invalid pair segment count: ${pairSegments.length}`);

      // Gets the key and the value.
      let [key, value] = pairSegments;

      // Cleans the key and the value.
      key = key.trim();
      value = value.trim();

      // Decodes the value.
      value = decodeURIComponent(value);

      // Returns the pair.
      return [key, value];
    }));
    request.u.body = bodyObject;

    // Continues to the next route.
    return true;
  };
}