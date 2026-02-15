const form = document.getElementById("taskForm");
const titleEl = document.getElementById("title");
const subjectEl = document.getElementById("subject");
const dueEl = document.getElementById("due");

const listEl = document.getElementById("taskList");
const emptyStateEl = document.getElementById("emptyState");
const countEl = document.getElementById("count");
const filtersEl = document.getElementById("filters");

const submitBtn = document.getElementById("submitBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");
const editHint = document.getElementById("editHint");

const searchEl = document.getElementById("search");
const sortSelect = document.getElementById("sortSelect");

const STORAGE_KEY = "study_planner_tasks_v1";

let tasks = loadTasks();
let currentFilter = "all";
let editingId = null;
let searchQuery = "";
let currentSort = "due";

render();

/* -------------------- Events -------------------- */

form.addEventListener("submit", (e) => {
  e.preventDefault();

  const title = titleEl.value.trim();
  const subject = subjectEl.value.trim();
  const due = dueEl.value;

  if (!title) return;

  // Update existing task
  if (editingId) {
    tasks = tasks.map((t) =>
      t.id === editingId ? { ...t, title, subject, due } : t
    );
    saveTasks(tasks);
    exitEditMode();
    render();
    return;
  }

  // Add new task
  const task = {
    id: (crypto.randomUUID
      ? crypto.randomUUID()
      : String(Date.now()) + Math.random().toString(16).slice(2)),
    title,
    subject,
    due,
    done: false,
    createdAt: Date.now(),
  };

  tasks.unshift(task);
  saveTasks(tasks);

  form.reset();
  titleEl.focus();
  render();
});

filtersEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-filter]");
  if (!btn) return;

  currentFilter = btn.dataset.filter;

  [...filtersEl.querySelectorAll(".chip")].forEach((ch) =>
    ch.classList.remove("active")
  );
  btn.classList.add("active");

  render();
});

listEl.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;

  const id = li.dataset.id;

  const toggleBtn = e.target.closest("[data-action='toggle']");
  const deleteBtn = e.target.closest("[data-action='delete']");
  const editBtn = e.target.closest("[data-action='edit']");

  if (toggleBtn) {
    tasks = tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t));
    saveTasks(tasks);
    render();
    return;
  }

  if (editBtn) {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    enterEditMode(task);
    return;
  }

  if (deleteBtn) {
    tasks = tasks.filter((t) => t.id !== id);
    saveTasks(tasks);
    render();
    return;
  }
});

cancelEditBtn.addEventListener("click", exitEditMode);

// Search
searchEl.addEventListener("input", (e) => {
  searchQuery = e.target.value.trim().toLowerCase();
  render();
});

// Sort
sortSelect.addEventListener("change", (e) => {
  currentSort = e.target.value;
  render();
});

/* -------------------- Render -------------------- */

function render() {
  const filtered = applyFilter(tasks, currentFilter);
  const searched = applySearch(filtered, searchQuery);

  let sorted = [...searched];

  if (currentSort === "due") {
    sorted.sort((a, b) => {
      const aHas = !!a.due;
      const bHas = !!b.due;

      if (aHas && bHas) return a.due.localeCompare(b.due);
      if (aHas && !bHas) return -1;
      if (!aHas && bHas) return 1;
      return b.createdAt - a.createdAt; // fallback
    });
  }

  if (currentSort === "newest") {
    sorted.sort((a, b) => b.createdAt - a.createdAt);
  }

  if (currentSort === "oldest") {
    sorted.sort((a, b) => a.createdAt - b.createdAt);
  }

  listEl.innerHTML = sorted.map(taskToHTML).join("");
  emptyStateEl.style.display = sorted.length === 0 ? "block" : "none";

  const total = tasks.length;
  const doneCount = tasks.filter((t) => t.done).length;
  const pendingCount = total - doneCount;

  countEl.textContent = `Total: ${total} | Pending: ${pendingCount} | Completed: ${doneCount}`;
}

function applyFilter(items, filter) {
  if (filter === "pending") return items.filter((t) => !t.done);
  if (filter === "done") return items.filter((t) => t.done);
  return items;
}

function applySearch(items, query) {
  if (!query) return items;
  return items.filter((t) => {
    const title = (t.title || "").toLowerCase();
    const subject = (t.subject || "").toLowerCase();
    return title.includes(query) || subject.includes(query);
  });
}

function taskToHTML(task) {
  const dueText = task.due ? formatDate(task.due) : "No due date";
  const subjectText = task.subject ? task.subject : "No subject";
  const isOverdue = task.due && !task.done && task.due < todayYYYYMMDD();

  return `
    <li class="item ${task.done ? "done" : ""}" data-id="${task.id}">
      <input type="checkbox" ${task.done ? "checked" : ""} data-action="toggle" aria-label="Mark done" />
      <div class="meta">
        <div class="titleRow">
          <span class="taskTitle">${escapeHTML(task.title)}</span>
          <span class="badge ${isOverdue ? "overdue" : ""}">
            ${task.done ? "Done" : isOverdue ? "Overdue" : "Pending"}
          </span>
        </div>
        <div class="sub">
          <span>📚 ${escapeHTML(subjectText)}</span>
          <span>📅 ${escapeHTML(dueText)}</span>
        </div>
      </div>
      <div class="actions">
        <button class="iconBtn" data-action="toggle">${task.done ? "Undo" : "Done"}</button>
        <button class="iconBtn" data-action="edit">Edit</button>
        <button class="iconBtn" data-action="delete">Delete</button>
      </div>
    </li>
  `;
}

/* -------------------- Edit Mode -------------------- */

function enterEditMode(task) {
  editingId = task.id;

  titleEl.value = task.title;
  subjectEl.value = task.subject || "";
  dueEl.value = task.due || "";

  editHint.style.display = "block";
  cancelEditBtn.style.display = "inline-block";
  submitBtn.textContent = "Update Task";

  titleEl.focus();
}

function exitEditMode() {
  editingId = null;
  form.reset();

  editHint.style.display = "none";
  cancelEditBtn.style.display = "none";
  submitBtn.textContent = "Add Task";
}

/* -------------------- Storage -------------------- */

function saveTasks(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/* -------------------- Utils -------------------- */

function formatDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function todayYYYYMMDD() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (ch) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return map[ch];
  });
}
