// import { Transform, Writable } from "stream";
// import { HTTPAcceptEncoding } from "../headers/HTTPAcceptEncodingHeader";
// import { HTTPContentEncoding } from "../headers/HTTPContentEncodingHeader";
// import { HTTPContentType } from "../HTTPContentType";
// import { HTTPHeaderType } from "../HTTPHeaderType";
// import { HTTPPathMatch } from "../HTTPPathMatch";
// import { HTTPRequest } from "../HTTPRequest";
// import { HTTPResponse } from "../HTTPResponse";
// import { HTTPRouterCallback, HTTPRouterNextFunction } from "../HTTPRouter";

// interface _ICacheResponse {
//   status: number;
//   buffer: Buffer;
// }

// interface _ICacheObject {
//   value: _ICacheResponse;
//   expire: number | null;
//   timeout: NodeJS.Timeout | null;
// }

// class _Cache {
//   protected _map: { [key: string]: _ICacheObject };

//   /**
//    * Constructs a new cache class.
//    */
//   public constructor() {
//     this._map = {};
//   }

//   /**
//    * Gets a value from the cache.
//    * @param key the key to get the value from.
//    * @returns either null or the value.
//    */
//   public get(key: string): _ICacheResponse | null {
//     // Gets the object.
//     const obj: _ICacheObject | null = this._map[key] ?? null;

//     // If the object is null, return null
//     //  else return the value.
//     if (obj === null) return null;
//     else return obj.value;
//   }

//   /**
//    * Puts a new value in the cache.
//    * @param key the key of the value to put in the map.
//    * @param value the value to put in the map.
//    * @param ttl the time to live, after which it will be removed.
//    * @returns the current instance.
//    */
//   public put(
//     key: string,
//     value: _ICacheResponse,
//     ttl: number | null = null
//   ): this {
//     // Gets the old object.
//     const old: _ICacheObject | null = this._map[key] ?? null;

//     // If there is an old record, clear it's timeout
//     //  we won't remove it, since it will be overwritten.
//     if (old !== null && old.timeout !== null) clearTimeout(old.timeout);

//     // Calculates the expiration time.
//     const expire: number | null =
//       ttl === null ? null : new Date().getTime() + ttl;

//     // Creates the timer, this will be used to automatically
//     //  clear something from the cache.
//     const timeout: NodeJS.Timeout | null =
//       ttl === null
//         ? null
//         : setTimeout(() => {
//             delete this._map[key];
//           }, ttl);

//     // Creates the new object to insert into the map.
//     const obj: _ICacheObject = {
//       expire,
//       timeout,
//       value,
//     };

//     // Inserts the new object into the map.
//     this._map[key] = obj;

//     // Returns the current instance.
//     return this;
//   }
// }

// export interface IUseCacheOptions {
//   ttl?: number | null;
// }

// export const useCache = (options?: IUseCacheOptions): HTTPRouterCallback => {
//   // Assigns default options.
//   options = Object.assign(
//     {
//       ttl: 600,
//     },
//     options
//   );

//   // Creates the cache.
//   const cache: _Cache = new _Cache();

//   // Returns the callback.
//   return (
//     match: HTTPPathMatch,
//     request: HTTPRequest,
//     response: HTTPResponse,
//     next: HTTPRouterNextFunction
//   ): any => {
//     // Gets the request from the cache, and if it exists
//     //  write the response to the client.
//     const cachedResponse: _ICacheResponse | null =
//       cache.get(request.rawUri!) ?? null;
//     if (cachedResponse !== null) {
//       // Performs some logging.
//       request.session.shouldTrace(() =>
//         request.session.trace(
//           `useCache(): Got cache hit for ${request.rawUri}, and writing cached response.`
//         )
//       );
//     }

//     // Performs some logging.
//     request.session.shouldTrace(() =>
//       request.session.trace(
//         `useCache(): did not find '${request.rawUri}' in cache, now caching current response ...`
//       )
//     );

//     // Adds a transform stream to the body that will capture all the
//     //  written data.
//     const chunks: Buffer[] = [];
//     response.addBodyTransform(
//       new Transform({
//         final: (callback: (error: Error | null | undefined) => void) => {
//           // Concats all the chunks into a single buffer.
//           const buffer: Buffer = Buffer.concat(chunks);

//           // Stores the result in the cache.
//           cache.put(
//             request.rawUri!,
//             {
//               buffer,
//               status: response.sentStatus,
//             },
//             options!.ttl!
//           );

//           // Logs that we've cached the request.
//           request.session.shouldTrace(() =>
//             request.session.trace(
//               `useCache(): cached '${request.rawUri}', size: '${
//                 buffer.length
//               }', ttl: ${options!.ttl!}, status: ${response.sentStatus}`
//             )
//           );

//           // Calls the final callback.
//           callback(null);
//         },
//         transform: (
//           chunk: Buffer,
//           encoding: BufferEncoding,
//           callback: (error: Error | null | undefined, data: Buffer) => void
//         ) => {
//           // Adds the chunk to the chunks.
//           chunks.push(chunk);

//           // Calls the callback immediately.
//           callback(null, chunk);
//         },
//       })
//     );

//     // Calls the next middleware.
//     return next();
//   };
// };
