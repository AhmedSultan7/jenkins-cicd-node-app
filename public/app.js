const taskForm = document.querySelector('#task-form');
const taskInput = document.querySelector('#task-title');
const taskList = document.querySelector('#task-list');
const searchInput = document.querySelector('#task-search');
const clearCompletedButton = document.querySelector('#clear-completed');
const toast = document.querySelector('#toast');
const filters = document.querySelector('.filter-tabs');

let tasks = [];
let activeFilter = 'all';
let searchTerm = '';
let toastTimer;

const icons = {
  check: '<svg viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="m3 8.2 3.1 3.1L13 4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

function showMessage(message) {
  toast.textContent = message;
  clearTimeout(toastTimer);
  if (message) {
    toastTimer = setTimeout(() => {
      toast.textContent = '';
    }, 4500);
  }
}

async function request(path, options) {
  const response = await fetch(path, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || 'Something went wrong. Please try again.');
  }
  return data;
}

function updateSummary() {
  const completed = tasks.filter((task) => task.done).length;
  const remaining = tasks.length - completed;
  document.querySelector('#total-count').textContent = tasks.length;
  document.querySelector('#active-count').textContent = remaining;
  document.querySelector('#done-count').textContent = completed;
  document.querySelector('#remaining-note').textContent = remaining === 1
    ? '1 task left to tackle'
    : `${remaining} tasks left to tackle`;
  clearCompletedButton.disabled = completed === 0;
}

function renderTasks() {
  updateSummary();
  const query = searchTerm.toLocaleLowerCase();
  const visibleTasks = tasks.filter((task) => {
    const matchesFilter = activeFilter === 'all'
      || (activeFilter === 'active' && !task.done)
      || (activeFilter === 'done' && task.done);
    return matchesFilter && task.title.toLocaleLowerCase().includes(query);
  });

  taskList.replaceChildren();
  if (visibleTasks.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    const icon = document.createElement('span');
    icon.className = 'empty-icon';
    icon.textContent = query ? '⌕' : activeFilter === 'done' ? '✦' : '✧';
    const title = document.createElement('strong');
    const description = document.createElement('span');

    if (query) {
      title.textContent = 'No matching tasks';
      description.textContent = 'Try another search or add a new task.';
    } else if (activeFilter === 'done') {
      title.textContent = 'Nothing completed just yet';
      description.textContent = 'Finished tasks will show up here.';
    } else if (activeFilter === 'active') {
      title.textContent = 'All caught up!';
      description.textContent = 'You have no tasks in progress.';
    } else {
      title.textContent = 'A fresh start';
      description.textContent = 'Add a task above and make today yours.';
    }

    empty.append(icon, title, description);
    taskList.append(empty);
    return;
  }

  visibleTasks.forEach((task) => {
    const row = document.createElement('article');
    row.className = `task-row${task.done ? ' is-done' : ''}`;

    const toggle = document.createElement('button');
    toggle.className = 'task-toggle';
    toggle.type = 'button';
    toggle.dataset.action = 'toggle';
    toggle.dataset.id = task.id;
    toggle.setAttribute('aria-label', `${task.done ? 'Mark as in progress' : 'Mark as completed'}: ${task.title}`);
    toggle.setAttribute('aria-pressed', String(task.done));
    toggle.innerHTML = icons.check;

    const title = document.createElement('span');
    title.className = 'task-title';
    title.textContent = task.title;

    const tag = document.createElement('span');
    tag.className = 'task-tag';
    tag.textContent = task.done ? 'Done' : 'In progress';

    const remove = document.createElement('button');
    remove.className = 'delete-task';
    remove.type = 'button';
    remove.dataset.action = 'delete';
    remove.dataset.id = task.id;
    remove.setAttribute('aria-label', `Delete task: ${task.title}`);
    remove.innerHTML = icons.trash;

    row.append(toggle, title, tag, remove);
    taskList.append(row);
  });
}

async function loadTasks() {
  taskList.setAttribute('aria-busy', 'true');
  try {
    tasks = await request('/api/tasks');
    renderTasks();
    showMessage('');
  } catch (error) {
    taskList.replaceChildren();
    showMessage(error.message);
  } finally {
    taskList.setAttribute('aria-busy', 'false');
  }
}

taskForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const title = taskInput.value.trim();
  if (!title) {
    taskInput.focus();
    return;
  }

  const submitButton = taskForm.querySelector('button[type="submit"]');
  submitButton.disabled = true;
  try {
    const task = await request('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    tasks.push(task);
    taskInput.value = '';
    activeFilter = 'all';
    filters.querySelectorAll('.filter-tab').forEach((button) => {
      const selected = button.dataset.filter === activeFilter;
      button.classList.toggle('is-selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    renderTasks();
    showMessage('');
    taskInput.focus();
  } catch (error) {
    showMessage(error.message);
  } finally {
    submitButton.disabled = false;
  }
});

filters.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  activeFilter = button.dataset.filter;
  filters.querySelectorAll('.filter-tab').forEach((tab) => {
    const selected = tab === button;
    tab.classList.toggle('is-selected', selected);
    tab.setAttribute('aria-pressed', String(selected));
  });
  renderTasks();
});

searchInput.addEventListener('input', () => {
  searchTerm = searchInput.value.trim();
  renderTasks();
});

taskList.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const id = button.dataset.id;
  const task = tasks.find((item) => String(item.id) === id);
  if (!task) return;

  button.disabled = true;
  try {
    if (button.dataset.action === 'toggle') {
      const updatedTask = await request(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ done: !task.done }),
      });
      tasks = tasks.map((item) => item.id === updatedTask.id ? updatedTask : item);
    } else {
      await request(`/api/tasks/${id}`, { method: 'DELETE' });
      tasks = tasks.filter((item) => item.id !== task.id);
    }
    renderTasks();
    showMessage('');
  } catch (error) {
    button.disabled = false;
    showMessage(error.message);
  }
});

clearCompletedButton.addEventListener('click', async () => {
  clearCompletedButton.disabled = true;
  try {
    await request('/api/tasks/completed', { method: 'DELETE' });
    tasks = tasks.filter((task) => !task.done);
    renderTasks();
    showMessage('');
  } catch (error) {
    showMessage(error.message);
    renderTasks();
  }
});

document.querySelector('#today-date').textContent = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
}).format(new Date());

loadTasks();
