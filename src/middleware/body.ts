import { request } from "http";
import { HTTPContentType, HTTPHeaderType } from "../HTTPHeaders";
import {
  HTTPRequest,
  HTTPRequestBufferBody,
  HTTPRequestEvent,
} from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import { HTTPRouterNextFunction } from "../HTTPRouter";

/**
 * Reads the body into a buffer.
 * @param request the request.
 * @param response the response.
 * @param next the next function.
 */
export const _reader = (
  request: HTTPRequest,
  response: HTTPResponse,
  next: HTTPRouterNextFunction
): void => {
  // Gets the content length string, if not there just call the next function/
  const contentLengthString: string | null =
    request.headers!.getSingleHeader("content-length") ?? null;
  if (contentLengthString === null) return next();

  // Gets the content length number, and if it's not valid (<= 0) go to next route.
  const contentLength: number = parseInt(contentLengthString);
  if (contentLength <= 0) return next();

  // Adds an event listener for when the state changed.
  request.once(HTTPRequestEvent.RequestFinishedLoading, next);

  // Starts reading the body.
  request.loadBufferBody(contentLength);
};

export const _json = (
  request: HTTPRequest,
  response: HTTPResponse,
  next: HTTPRouterNextFunction
): void => {
  // If the request body is not json, just go to the next callback.
  if (
    request.headers!.getSingleHeader(HTTPHeaderType.ContentType) !==
    HTTPContentType.ApplicationJson
  )
    return next();

  // Gets the request body and interprets it as a buffer body.
  const bufferBody: HTTPRequestBufferBody =
    request.body as HTTPRequestBufferBody;

  // Get the string version of the buffer in the request body.
  const bodyString: string = bufferBody.buffer.toString("utf-8");

  // Parses the json, and puts it in the request user data.
  const bodyObject: any = JSON.parse(bodyString);
  request.u = {};
  request.u.body = bodyObject;

  // Continues to the next route.
  next();
};

export const _urlEncoded = (
  request: HTTPRequest,
  response: HTTPResponse,
  next: HTTPRouterNextFunction
): void => {
  // If the request body is not urlencoded, just go to the next callback.
  if (
    request.headers!.getSingleHeader(HTTPHeaderType.ContentType) !==
    HTTPContentType.ApplicationXWWWFormUrlencoded
  )


    return next();
};
