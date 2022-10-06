export enum HTTPVersion {
  V1_0 = 'HTTP/1.0',
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
