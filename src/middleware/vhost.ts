import { HTTPHeaderType } from "../HTTPHeaderType";
import { HTTPPathMatch } from "../HTTPPathMatch";
import { HTTPRequest } from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import {
  HTTPRouter,
  HTTPRouterCallback,
  HTTPRouterNextFunction,
} from "../HTTPRouter";

export interface IUseVhostOptions {}

/**
 * Constructs a virtual host middleware.
 * @param host the host to use.
 * @param router the router to use then the host matches.
 * @param options the options.
 * @returns the router callback.
 */
export const useVhost = (
  host: string,
  router: HTTPRouter,
  options?: IUseVhostOptions
): HTTPRouterCallback => {
  // Assigns the default options.
  options = Object.assign({}, options);

  // Cleans up the host, so we can easily compar eit.
  host = host.trim().toLowerCase();

  // Returns the piece of middleware.
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
  ): Promise<boolean> => {
    // Gets the header, and if not there, continue.
    let requestHost: string | undefined = request.headers!.getSingleHeader(
      HTTPHeaderType.Host
    );
    if (!requestHost) return true;

    // Cleans the host up, so we can easily compare it.
    requestHost = requestHost.trim().toLowerCase();

    // Checks if the host matches, if not, call the next middleware.
    if (requestHost !== host) return true;

    // Uses the router given in the arguments.
    await router.handle(request, response, match.remainder ?? '');

    // Do not go to the next piece of middleware.
    return false;
  };
};
