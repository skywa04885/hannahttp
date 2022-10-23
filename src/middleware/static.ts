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

import path from "path";
import { HTTPPathMatch } from "../router/path-match";
import { HTTPRequest } from "../http/request";
import { HTTPResponse } from "../http/response";
import { HTTPSimpleRouterCallback } from "../router/simple-router";

export interface IServeFilesOptions {}

/**
 *
 * @param rootPath the root directory to serve files from.
 * @param options the file serving options.
 * @returns the callback that can be run by the router.
 */
export const useStatic = (
  rootPath: string,
  options?: IServeFilesOptions
): HTTPSimpleRouterCallback => {
  return async (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse
  ): Promise<boolean> => {
    // The remainder of the url will serve as the path of the file.
    const filePath: string | null = match.remainder;

    // If the file is null, then we won't know what to open so send 404.
    if (filePath === null) return true;

    // Merges the given root with the file name.
    const completePath: string = path.join(rootPath, filePath);

    // Makes sure the complete path is inside the rootPath.
    if (
      completePath.length < rootPath.length ||
      completePath.substring(0, rootPath.length) !== rootPath
    )
      return true;

    // Writes the file.
    try {
      await response.file(completePath);
    } catch (error) {
      return true;
    }

    // Goes to the next piece of middleware.
    return false;
  };
};

export default useStatic;
