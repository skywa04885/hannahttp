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
import { HTTPClientHandler } from "../HTTPClientHandler";
import { HTTPPathMatch } from "../HTTPPathMatch";
import { HTTPRequest } from "../HTTPRequest";
import { HTTPResponse } from "../HTTPResponse";
import { HTTPRouterCallback, HTTPRouterNextFunction } from "../HTTPRouter";

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
): HTTPRouterCallback => {
  return (
    match: HTTPPathMatch,
    request: HTTPRequest,
    response: HTTPResponse,
    next: HTTPRouterNextFunction
  ): any => {
    // The remainder of the url will serve as the path of the file.
    const filePath: string | null = match.remainder;

    // If the file is null, then we won't know what to open so send 404.
    if (filePath === null) return response.text("No file specified!", 404);

    // Merges the given root with the file name.
    const completePath: string = path.join(rootPath, filePath);

    // Makes sure the complete path is inside the rootPath.
    if (
      completePath.length < rootPath.length ||
      completePath.substring(0, rootPath.length) !== rootPath
    )
      return response.text(
        `File '${completePath}' not inside root directory: '${rootPath}', suck it! I actually kept that in mind.`
      );

    // Writes the file.
    return response.file(completePath);
  };
};

export default useStatic;
