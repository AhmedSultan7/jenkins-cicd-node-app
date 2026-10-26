const test = require('node:test');
const assert = require('node:assert');
const app = require('./app');

let server, base;

test.before(() => new Promise((resolve) => {
  server = app.listen(0, () => {
    base = `http://localhost:${server.address().port}`;
    resolve();
  });
}));
test.after(() => server.close());

test('GET / serves the Focusboard dashboard', async () => {
  const res = await fetch(`${base}/`);
  const html = await res.text();

  assert.strictEqual(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(html, /Make room for/);
});

test('GET /health returns ok', async () => {
  const res = await fetch(`${base}/health`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(await res.json(), { status: 'ok' });
});

test('GET /api/tasks returns a list', async () => {
  const res = await fetch(`${base}/api/tasks`);
  assert.ok(Array.isArray(await res.json()));
});

test('POST /api/tasks rejects an empty body', async () => {
  const res = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  });
  assert.strictEqual(res.status, 400);
});

test('POST /api/tasks trims and creates a task', async () => {
  const res = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: '  Review pull request  ' }),
  });
  const task = await res.json();

  assert.strictEqual(res.status, 201);
  assert.strictEqual(task.title, 'Review pull request');
  assert.strictEqual(task.done, false);
});

test('PATCH /api/tasks/:id updates completion state', async () => {
  const createRes = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Test task' }),
  });
  const task = await createRes.json();
  const res = await fetch(`${base}/api/tasks/${task.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ done: true }),
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).done, true);
});

test('DELETE /api/tasks/completed clears completed tasks', async () => {
  const res = await fetch(`${base}/api/tasks/completed`, { method: 'DELETE' });
  const result = await res.json();
  const remainingRes = await fetch(`${base}/api/tasks`);
  const remainingTasks = await remainingRes.json();

  assert.strictEqual(res.status, 200);
  assert.ok(result.deleted > 0);
  assert.ok(remainingTasks.every((task) => !task.done));
});

test('DELETE /api/tasks/:id removes a task', async () => {
  const createRes = await fetch(`${base}/api/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'Task to remove' }),
  });
  const task = await createRes.json();
  const res = await fetch(`${base}/api/tasks/${task.id}`, { method: 'DELETE' });

  assert.strictEqual(res.status, 200);
  assert.strictEqual((await res.json()).id, task.id);
});