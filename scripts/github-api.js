import { spawnSync } from 'node:child_process';

export async function githubClient() {
  let token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN;
  if (!token) {
    const credential = spawnSync('git', ['credential', 'fill'], {
      input: 'protocol=https\nhost=github.com\n\n', encoding: 'utf8',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
    });
    token = credential.stdout?.split('\n').find(line => line.startsWith('password='))?.slice(9).trim();
  }
  if (!token) throw new Error('Autentique o Git no GitHub antes de publicar. Nenhuma credencial é incluída nos pacotes.');
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'User-Agent': 'PokemonSimulator-release', 'X-GitHub-Api-Version': '2022-11-28' };
  async function request(route, options = {}) {
    const response = await fetch(`https://api.github.com${route}`, {
      ...options, headers: { ...headers, ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    if (response.status === 204) return null;
    const data = await response.json();
    if (!response.ok) { const error = new Error(`GitHub HTTP ${response.status}: ${data.message}`); error.status = response.status; throw error; }
    return data;
  }
  return { request, headers };
}
