import { db } from "../db/connection";
import { defaultSettings, Settings } from "../domain/models";
export const SettingsRepository = {
  async load(): Promise<Settings> {
    const rows = await db().getAllAsync<{ key: string; value: string }>(
      "SELECT * FROM app_settings",
    );
    const result = { ...defaultSettings };
    for (const row of rows)
      if (row.key in result)
        try {
          Object.assign(result, { [row.key]: JSON.parse(row.value) });
        } catch {
          /* Keep default for corrupt legacy preference. */
        }
    return result;
  },
  async save<K extends keyof Settings>(key: K, value: Settings[K]) {
    await db().runAsync(
      "INSERT INTO app_settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      key,
      JSON.stringify(value),
    );
  },
};
