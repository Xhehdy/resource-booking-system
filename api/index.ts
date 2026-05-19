import { createApp } from '../server.js';

let appPromise: ReturnType<typeof createApp> | undefined;

export default async function handler(req: any, res: any) {
    appPromise ??= createApp({ enableVite: false, serveStatic: false });
    const app = await appPromise;
    return app(req, res);
}
