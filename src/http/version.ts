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

export enum HTTPVersion {
  V1_1 = 'HTTP/1.1',
}

/**
 * Checks if the given http version is valid.
 * @param version the version to check.
 * @returns if the version is valid.
 */
export const isValidHttpVersion = (version: string): boolean => {
  return Object.values(HTTPVersion).includes(version as HTTPVersion);
};
