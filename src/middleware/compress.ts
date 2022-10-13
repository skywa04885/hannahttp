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

import { HTTPEncodingHeader } from "../HTTPEncodingHeader";
import { HTTPEncoding } from "../HTTPEncoding";
import { HTTPHeaderType } from "../HTTPHeaderType";
import { HTTPPathMatch } from "../HTTPPathMatch";
import { HTTPRequest } from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import {
  HTTPRouterCallback,
  HTTPRouterNextFunction,
  HTTPSimpleRouterHandler,
} from "../HTTPRouter";
import zlib from "zlib";
import { match } from "assert";

export interface IUseCompressionOptions {
  match?: RegExp;
  useGzip?: boolean;
  useDeflate?: boolean;
}

/**
 * Uses compression on the given route.
 * @param options the options for the compression middleware.
 * @returns the compression middelware callback.
 */
export const useCompression = (
  options?: IUseCompressionOptions
): HTTPRouterCallback => {
  // Assigns the default options.
  options = Object.assign(
    {
      match: null,
      useGzip: true,
      useDeflate: true,
    },
    options
  );

  return (
    pathMatch: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
    next: HTTPRouterNextFunction
  ): any => {
    // Checks if we should perform compression at all.
    if (options!.match && !options!.match!.test(pathMatch.remainder!)) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): not compressing file '${pathMatch.remainder}' due to pattern mismatch.`
        )
      );

      // Goes to the next piece of middleware.
      return next();
    }

    // Gets the accept encoding header value, and if it is not there just call the next handler.
    const rawAcceptEncodingHeaderValue: string | null =
      request.headers!.getSingleHeader(HTTPHeaderType.AcceptEncoding);
    if (rawAcceptEncodingHeaderValue === null) return next();

    // Parses the accept encoding header.
    const acceptEncodingHeader: HTTPEncodingHeader =
      HTTPEncodingHeader.fromValue(rawAcceptEncodingHeaderValue);

    // Checks if the accept encoding header contains deflate or gzip, then uses either of them.
    if (
      acceptEncodingHeader.contains(HTTPEncoding.DEFLATE) &&
      options!.useDeflate
    ) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): compressing file '${pathMatch.remainder}' with deflate.`
        )
      );

      // Adds the transfer encoding and content encoding.
      response.addTransferEncoding(HTTPEncoding.DEFLATE);
      response.addContentEncoding(HTTPEncoding.DEFLATE);

      // Adds the transformation stream.
      response.addBodyTransform(zlib.createDeflate());
    } else if (
      acceptEncodingHeader.contains(HTTPEncoding.GZIP) &&
      options!.useGzip
    ) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): compressing file '${pathMatch.remainder}' with gzip.`
        )
      );

      // Adds the transfer encoding and content encoding.
      response.addTransferEncoding(HTTPEncoding.GZIP);
      response.addContentEncoding(HTTPEncoding.GZIP);

      // Adds the transformation stream.
      response.addBodyTransform(zlib.createGzip());
    }

    // Continues to the next handler.
    return next();
  };
};
