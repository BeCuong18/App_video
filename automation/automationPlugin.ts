import type { Plugin } from 'vite';

export const createAutomationPlugin = (): Plugin => {
  return {
    name: 'flow-automation-endpoint',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/automation/run', async (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Method Not Allowed' }));
          return;
        }

        try {
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve, reject) => {
            req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
            req.on('end', () => resolve());
            req.on('error', (err) => reject(err));
          });

          const rawBody = Buffer.concat(chunks).toString('utf8');
          const payload = rawBody ? JSON.parse(rawBody) : {};
          const prompts = Array.isArray(payload.prompts) ? payload.prompts : [];

          if (!prompts.length) {
            throw new Error('Thiếu danh sách prompt để tự động hoá.');
          }

          const { runFlowAutomation } = await import('./flowAutomation.mjs');

          const promptsData = {
            projectName: payload.projectName || 'Prompt Project',
            prompts: prompts.map((item: any, index: number) => ({
              scene_number: item.scene_number ?? index + 1,
              scene_title: item.scene_title || item.title || `Prompt ${index + 1}`,
              prompt_text: item.prompt_text || item.prompt || item.text || ''
            }))
          };

          const options = {
            downloadDirectory: payload.downloadDirectory || undefined,
            batchSize: payload.batchSize ? Number(payload.batchSize) : undefined,
            headless: Boolean(payload.headless),
            browserExecutablePath: payload.browserExecutablePath || undefined,
            userDataDir: payload.userDataDir || undefined
          };

          await runFlowAutomation({
            promptsData,
            ...options
          });

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ status: 'ok', message: 'Đã khởi chạy tự động hoá. Theo dõi tiến trình trên cửa sổ Chrome.' }));
        } catch (error: any) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: error?.message || 'Không thể khởi chạy tự động hoá.' }));
        }
      });
    }
  };
};
