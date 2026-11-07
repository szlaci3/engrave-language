import { db } from '../../db/db';

const lowControlsKey = 'world-low-controls';

export async function getLowControls() {
  return (await db.settings.get(lowControlsKey))?.value === 'true';
}

export async function saveLowControls(value: boolean) {
  await db.settings.put({
    key: lowControlsKey,
    value: String(value),
    updatedAt: new Date().toISOString(),
  });
}
