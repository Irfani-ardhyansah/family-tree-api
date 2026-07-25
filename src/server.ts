import './shared/types/express';
import { createApp } from './app';
import { env } from './config/env';
import { startMediaTtlJob } from './modules/media/media.ttl';

const app = createApp();

app.listen(env.port, () => {
  console.log(`Server running on http://localhost:${env.port}`);
  console.log(`Environment: ${env.nodeEnv}`);
  startMediaTtlJob();
});
