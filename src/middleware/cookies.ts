import { HTTPHeaderType } from "../HTTPHeaderType";
import { HTTPPathMatch } from "../HTTPPathMatch"
import { HTTPRequest } from "../HTTPRequest"
import { HTTPResponse } from "../HTTPResponse"
import { HTTPRouterNextFunction } from "../HTTPRouter"

export interface IUseCookiesOptions {}

export interface IUseCookiesBody {
  cookies: {[key: string]: string};
}

/**
 * Constructs a piece of middleware to parse cookies.
 * @param options the options for the piece of middleware.
 * @returns the piece of middleware used to parse cookies.
 */
export const useCookies = (options?: IUseCookiesOptions) => {
  options = Object.assign({}, options);

  return (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
    next: HTTPRouterNextFunction
  ): any => {
    // Gets the reference to the request userdata as cookies body.
    const u: IUseCookiesBody = request.u as IUseCookiesBody;
    u.cookies = {};

    // Gets the list of cookies, if null just return since there are none.
    const cookies: string[] | null = request.headers?.getHeader(HTTPHeaderType.Cookie) ?? null;
    if (cookies === null) return next();

    // Loops over all the cookies and parses them.
    for (const cookie of cookies) {
      // Processes the cookies inside the cookie, or something.... This mechanism sucks.
      cookie.split(';').forEach((pair: string): void => {
        // Cleans up the pair.
        pair.trim();

        // Splits the cookie into it's segment.
        const segments: string[] = pair.split('=');
        if (segments.length !== 2)
          throw new Error(`Segment count of cookie not equal to 2 but: ${segments.length}`);
        
        // Gets the key and the value from the segments.
        let [key, value]: [string, string] = segments as [string, string];

        // Prepares the key and the value.
        key = key.trim();
        value = decodeURIComponent(value);

        // Sets the cookie in the request body.
        u.cookies[key] = value;
      });
    }

    // Calls the next piece of middleware.
    return next();
  };
}