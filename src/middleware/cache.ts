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

import { Transform } from "stream";
import { HTTPHeaderType } from "../HTTPHeaderType";
import { HTTPPathMatch } from "../HTTPPathMatch";
import { HTTPRequest } from "../HTTPRequest";
import { HTTPResponse, HTTPResponseEvent } from "../HTTPResponse";
import { HTTPRouterCallback } from "../HTTPRouter";
import { MemoryCache } from "../misc/MemoryCache";

interface CachedResponseStatus {
  code: number;
  message?: string;
}

export type CachedResponseHeaders = [string, string][];

interface CachedResponse {
  status: CachedResponseStatus;
  headers: CachedResponseHeaders;
  buffer: Buffer;
}

export interface IUseCacheOptions {
  ttl?: number | null;
  excludeHeaders?: HTTPHeaderType[];
  uniqueHeaders?: HTTPHeaderType[];
  uniqueSearch?: boolean;
  uniqueHash?: boolean;
}

const generateCacheKey = (
  options: IUseCacheOptions,
  request: HTTPRequest
): string => {
  const segments: string[] = [];

  // Pushes the path to the segments.
  segments.push(request.uri!.path);

  // If the options specify to have unique search params, include them.
  if (options.uniqueSearch && Object.entries(request.uri!.search).length > 0) {
    segments.push(
      Object.entries(request.uri!.search)
        .map(([key, value]: [string, string]): string => {
          return `${key}=${encodeURIComponent(value)}`;
        })
        .join("&")
    );
  }

  // If the options specify to have unique hashes, include them.
  if (options.uniqueHash && request.uri!.hash) {
    segments.push(request.uri?.hash!);
  }

  // If the options specify to have unique headers, include them.
  if (options.uniqueHeaders) {
    for (const uniqueHeader of options.uniqueHeaders) {
      // Gets the headers from the request, and if not there, don't add them.
      const headers: string[] | null = request.headers!.getHeader(uniqueHeader);
      if (!headers) continue;

      // Adds the header key/ value pair.
      segments.push(
        `${uniqueHeader}=${headers.map((v) => encodeURIComponent(v)).join(",")}`
      );
    }
  }

  // Joints the segments with hashes to produce the final key.
  return segments.join("#");
};

export const useCache = (options?: IUseCacheOptions): HTTPRouterCallback => {
  // Assigns the default options.
  options ??= {};
  options.ttl ??= 60 * 1000;
  options.uniqueSearch ??= false;
  options.uniqueHash ??= false;

  // Initializes the headers to exclude if not done yet,
  //  and adds the default headers to exclude.
  options.excludeHeaders ??= [];
  options.excludeHeaders.push(
    HTTPHeaderType.Server,
    HTTPHeaderType.Date,
    HTTPHeaderType.Connection
  );

  // Initializes the headers that we use for uniqueness of
  //  request and adds the default headers to include.
  options.uniqueHeaders ??= [];
  options.uniqueHeaders.push(
    HTTPHeaderType.AcceptEncoding // Accept encoding changes how we'll respond.
  );

  // Creates the memory cache.
  const memoryCache: MemoryCache<string, CachedResponse> = new MemoryCache<
    string,
    CachedResponse
  >();

  // Returns the callback.
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse
  ): Promise<boolean> => {
    // Creates the cache key.
    const cacheKey: string = generateCacheKey(options!, request);

    {
      // Gets the previously cached response.
      const cachedResponse: CachedResponse | undefined =
        memoryCache.get(cacheKey);

      // If the response is not equal to null, write it.
      if (cachedResponse) {
        // Performs some logging.
        request.session.shouldTrace(() =>
          request.session.trace(
            `useCache(): Got cache hit for ${cacheKey}, and writing cached response.`
          )
        );

        // First writes the status, then the headers and finally the body.
        await response.status(
          cachedResponse.status.code,
          cachedResponse.status.message
        );
        for (const [key, value] of cachedResponse.headers)
          await response.header(key, value);
        await response.defaultHeaders();
        await response.endHeaders();
        await response.writeBodyImmediate(cachedResponse.buffer);
        await response.endBody();

        // Do not go to next middleware.
        return false;
      }
    }

    // Performs some logging.
    request.session.shouldTrace(() =>
      request.session.trace(
        `useCache(): did not find '${cacheKey}' in cache, now caching current response ...`
      )
    );

    // Some temp variables.
    let interceptedStatus: CachedResponseStatus | undefined = undefined;
    let interceptedHeaders: CachedResponseHeaders = [];

    // Listens for written headers in the response (so we can intercept them).
    response.on(
      HTTPResponseEvent.Header,
      (key: string, value: string): void => {
        // Ignores a specific set of headers.
        if (options!.excludeHeaders!.includes(key as HTTPHeaderType)) return;

        // Pushes the intercepted header.
        interceptedHeaders.push([key, value]);
      }
    );

    // Listens for the statujs line in the response (so we can intercept it).
    response.on(
      HTTPResponseEvent.Status,
      (code: number, message?: string): any =>
        (interceptedStatus = { code, message })
    );

    // Adds a transform stream to the body that will capture all the
    //  written data.
    const chunks: Buffer[] = [];
    response.addBodyTransform(
      new Transform({
        /**
         * Gets called when the stream is about to end.
         * @param callback the callback to call once the stream may be finished.
         */
        final: (callback: (error: Error | null | undefined) => void): void => {
          // Makes sure the proper values have been intercepted, if not
          //  log an error and finish the stream.
          if (interceptedStatus === undefined) {
            request.session.shouldError(() =>
              request.session.error(
                `useCache(): failed to cache response, did not intercept response line.`
              )
            );

            return callback(null);
          }

          // Concats all the chunks into a single buffer.
          const buffer: Buffer = Buffer.concat(chunks);

          // Constructs the final cached response.
          const cachedResponse: CachedResponse = {
            status: interceptedStatus!,
            headers: interceptedHeaders!,
            buffer,
          };

          // Stores the result in the cache.
          memoryCache.put(cacheKey, cachedResponse, options!.ttl!);

          // Logs that we've cached the request.
          request.session.shouldTrace(() =>
            request.session.trace(
              `useCache(): cached '${cacheKey}', size: '${
                buffer.length
              }', ttl: ${options!.ttl!}, status: ${cachedResponse.status}`
            )
          );

          // Calls the final callback.
          callback(null);
        },
        /**
         * Handles a chunk and transforms it.
         * @param chunk the chunk to handle.
         * @param encoding the encoding of the chunk.
         * @param callback the callback to call once processed.
         */
        transform: (
          chunk: Buffer,
          encoding: BufferEncoding,
          callback: (error: Error | null | undefined, data: Buffer) => void
        ) => {
          // Adds the chunk to the chunks.
          chunks.push(chunk);

          // Calls the callback immediately.
          callback(null, chunk);
        },
      }),
      true
    );

    // Goes to the next middleware.
    return true;
  };
};
