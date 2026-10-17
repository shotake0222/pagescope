import type { FC } from 'hono/jsx';
import { Icon, Layout } from './layout';

export const MessagePage: FC<{ title: string; body: string; status?: number }> = (p) => (
  <Layout title={`${p.title} - PageScope`} noindex bodyClass="bg-slate-950 text-slate-400 flex flex-col items-center justify-center min-h-screen p-6 text-center antialiased">
    <div class="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mb-4">
      <Icon name="warn" class="w-8 h-8 text-slate-500" />
    </div>
    <h1 class="text-xl font-bold text-white mb-2">{p.title}</h1>
    <p class="text-sm">{p.body}</p>
    <a href="/" class="mt-8 text-xs text-emerald-400 hover:underline">PageScope トップへ</a>
  </Layout>
);
