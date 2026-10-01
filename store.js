// Shared by index.html (script.js) and gestion.html (gestion.js).
// Projects come from localStorage when gestion.html has saved changes there,
// otherwise from mis-proyectos.json.
const PROJECTS_KEY = "mis-proyectos";

// Escapes text before it goes into innerHTML, so quotes or "<" in the data
// (e.g. the quoted phrase in project 3) can't break the markup.
function esc(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readStoredProjects() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PROJECTS_KEY));
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null; // storage blocked or corrupted JSON: fall back to the file
  }
}

async function getProjects() {
  const stored = readStoredProjects();
  if (stored) return stored;
  const response = await fetch("mis-proyectos.json");
  if (!response.ok) throw new Error(`HTTP ${response.status} loading mis-proyectos.json`);
  return response.json();
}

function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
}

function clearStoredProjects() {
  localStorage.removeItem(PROJECTS_KEY);
}
