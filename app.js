const express = require('express');
const os = require('node:os');
const path = require('node:path');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const tasks = [
  { id: 1, title: 'Learn Jenkins', done: true },
  { id: 2, title: 'Build a Docker image', done: false },
];
let nextTaskId = 3;

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/api/info', (req, res) => {
  res.json({
    name: 'node-app',
    version: process.env.APP_VERSION || 'dev',
    hostname: os.hostname(),
    uptime: Math.round(process.uptime()),
  });
});

app.get('/api/tasks', (req, res) => res.json(tasks));

app.post('/api/tasks', (req, res) => {
  const body = req.body || {};
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (title.length > 120) {
    return res.status(400).json({ error: 'title must be 120 characters or fewer' });
  }

  const task = { id: nextTaskId++, title, done: false };
  tasks.push(task);
  res.status(201).json(task);
});

app.patch('/api/tasks/:id', (req, res) => {
  const task = tasks.find(({ id }) => id === Number(req.params.id));
  if (!task) return res.status(404).json({ error: 'task not found' });
  if (typeof (req.body || {}).done !== 'boolean') {
    return res.status(400).json({ error: 'done must be a boolean' });
  }

  task.done = req.body.done;
  res.json(task);
});

app.delete('/api/tasks/completed', (req, res) => {
  const remainingTasks = tasks.filter(({ done }) => !done);
  const deletedCount = tasks.length - remainingTasks.length;
  tasks.splice(0, tasks.length, ...remainingTasks);
  res.json({ deleted: deletedCount });
});

app.delete('/api/tasks/:id', (req, res) => {
  const index = tasks.findIndex(({ id }) => id === Number(req.params.id));
  if (index === -1) return res.status(404).json({ error: 'task not found' });

  const [task] = tasks.splice(index, 1);
  res.json(task);
});

module.exports = app;