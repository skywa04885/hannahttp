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

import { HTTPHeaderType } from "../http/header";
import { HTTPPathMatch } from "../router/path-match";
import { HTTPRequest } from "../http/request";
import { HTTPResponse } from "../http/response";
import zlib, { BrotliOptions, Gzip, ZlibOptions } from "zlib";
import { match } from "assert";
import { HTTPAcceptEncoding, HTTPAcceptEncodingHeader } from "../http/headers/accept-encoding";
import { HTTPTransferEncoding } from "../http/headers/transfer-encoding";
import { HTTPContentEncoding } from "../http/headers/content-encoding";
import { HTTPSimpleRouterCallback } from "../router/simple-router";

export interface IUseCompressionOptions {
  match?: RegExp;
  useGzip?: boolean;
  useDeflate?: boolean;
  useBrotli?: boolean;
  brotliOptions?: BrotliOptions;
  gzipOptions?: ZlibOptions;
  deflateOptions?: ZlibOptions;
}

/**
 * Uses compression on the given route.
 * @param options the options for the compression middleware.
 * @returns the compression middelware callback.
 */
export const useCompression = (
  options?: IUseCompressionOptions
): HTTPSimpleRouterCallback => {
  // Assigns the default options.
  options ??= {};
  options.useBrotli ??= true;
  options.useGzip ??= true;
  options.useDeflate ??= true;

  return async (
    pathMatch: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    // Checks if we should perform compression at all.
    if (options!.match && !options!.match!.test(pathMatch.remainder!)) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): not compressing file '${pathMatch.remainder}' due to pattern mismatch.`
        )
      );

      // Goes to the next piece of middleware.
      return true;
    }

    // Gets the accept encoding header value, and if it is not there just call the next handler.
    const rawAcceptEncodingHeaderValue: string | undefined =
      request.headers!.getSingleHeader(HTTPHeaderType.AcceptEncoding);
    if (!rawAcceptEncodingHeaderValue) return true;

    // Parses the accept encoding header.
    const acceptEncodingHeader: HTTPAcceptEncodingHeader =
      HTTPAcceptEncodingHeader.decode(rawAcceptEncodingHeaderValue);

    // Checks if the accept encoding header contains deflate or gzip, then uses either of them.
    if (
      acceptEncodingHeader.includes(HTTPAcceptEncoding.Deflate) &&
      options!.useDeflate
    ) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): compressing file '${pathMatch.remainder}' with deflate.`
        )
      );

      // Adds the transfer encoding and content encoding.
      response.addContentEncoding(HTTPContentEncoding.Deflate);

      // Adds the transformation stream.
      response.addBodyTransform(zlib.createDeflate(options?.deflateOptions));
    } else if (
      acceptEncodingHeader.includes(HTTPAcceptEncoding.Gzip) &&
      options!.useGzip
    ) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): compressing file '${pathMatch.remainder}' with gzip.`
        )
      );

      // Adds the transfer encoding and content encoding.
      response.addContentEncoding(HTTPContentEncoding.Gzip);

      // Adds the transformation stream.
      response.addBodyTransform(zlib.createGzip(options?.gzipOptions));
    } else if (acceptEncodingHeader.includes(HTTPAcceptEncoding.Brotli) && options!.useBrotli) {
      // Performs some logging.
      response.session.shouldTrace(() =>
        response.session.trace(
          `useCompression(): compressing file '${pathMatch.remainder}' with br.`
        )
      );

      // Adds the transfer encoding and content encoding.
      response.addContentEncoding(HTTPContentEncoding.Brotli);

      // Adds the transformation stream.
      response.addBodyTransform(zlib.createBrotliCompress(options?.brotliOptions));
    }

    // Continues to the next handler.
    return true;
  };
};
