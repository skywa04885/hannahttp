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

export interface MemoryCacheEntry<T> {
  value: T;
  expire?: number;
  timeout: NodeJS.Timeout | null;
}

export class MemoryCache<K, V> {
  protected _map: Map<K, MemoryCacheEntry<V>>;

  /**
   * Constructs a new cache class.
   */
  public constructor() {
    this._map = new Map<K, MemoryCacheEntry<V>>();
  }

  /**
   * Gets a value from the cache.
   * @param key the key to get the value from.
   * @returns either null or the value.
   */
  public get(key: K): V| undefined {
    // Gets the object.
    const obj: MemoryCacheEntry<V> | undefined = this._map.get(key);

    // If the object is null, return null
    //  else return the value.
    if (!obj) return undefined;
    else return obj.value;
  }

  /**
   * Puts a new value in the cache.
   * @param key the key of the value to put in the map.
   * @param value the value to put in the map.
   * @param ttl the time to live, after which it will be removed.
   * @returns the current instance.
   */
  public put(
    key: K,
    value: V,
    ttl: number | null = null
  ): this {
    // Gets the old object.
    const old: MemoryCacheEntry<V> | undefined = this._map.get(key);

    // If there is an old record, clear it's timeout
    //  we won't remove it, since it will be overwritten.
    if (old && old.timeout) clearTimeout(old.timeout);

    // Calculates the expiration time.
    const expire: number | undefined =
      !ttl ? undefined : new Date().getTime() + ttl;

    // Creates the timer, this will be used to automatically
    //  clear something from the cache.
    const timeout: NodeJS.Timeout | null =
      ttl === null
        ? null
        : setTimeout(() => {
            this._map.delete(key);
          }, ttl);

    // Creates the new object to insert into the map.
    const obj: MemoryCacheEntry<V> = {
      expire,
      timeout,
      value,
    };

    // Inserts the new object into the map.
    this._map.set(key, obj);

    // Returns the current instance.
    return this;
  }
}

