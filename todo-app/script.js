const taskInput = document.getElementById('taskInput');
const addTaskBtn = document.getElementById('addTaskBtn');
const taskList = document.getElementById('taskList');
const statsEl = document.getElementById('stats');

let tasks = JSON.parse(localStorage.getItem('tasks')) || [];

function saveTasks() {
  localStorage.setItem('tasks', JSON.stringify(tasks));
}

function renderTasks() {
  taskList.innerHTML = '';
  
  if (tasks.length === 0) {
    taskList.innerHTML = `<li class="empty-state">No tasks yet. Add one above!</li>`;
    updateStats();
    return;
  }
  
  tasks.forEach((task, index) => {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.index = index;
    li.innerHTML = `
      <span class="task-content">${escapeHtml(task.text)}</span>
      <button class="delete-btn" aria-label="Delete task">Delete</button>
    `;
    taskList.appendChild(li);
  });
  
  updateStats();
  bindDeleteEvents();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function addTask() {
  const text = taskInput.value.trim();
  
  if (!text) {
    taskInput.focus();
    return;
  }
  
  tasks.push({ text, createdAt: Date.now() });
  saveTasks();
  renderTasks();
  taskInput.value = '';
  taskInput.focus();
}

function deleteTask(index) {
  const taskItem = taskList.children[index];
  if (taskItem) {
    taskItem.classList.add('removing');
    
    setTimeout(() => {
      tasks.splice(index, 1);
      saveTasks();
      renderTasks();
    }, 200);
  }
}

function updateStats() {
  const count = tasks.length;
  statsEl.textContent = `${count} task${count !== 1 ? 's' : ''} remaining`;
}

function bindDeleteEvents() {
  const deleteBtns = taskList.querySelectorAll('.delete-btn');
  deleteBtns.forEach((btn, index) => {
    btn.addEventListener('click', () => deleteTask(index));
  });
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTask();
});

renderTasks();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { addTask, deleteTask, saveTasks };
}
