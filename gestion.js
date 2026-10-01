// Project management page: create, read, update and delete the projects shown
// on the landing. Changes are saved in localStorage (key from store.js); the
// "Exportar JSON" button downloads them as a new mis-proyectos.json so they
// can be committed to Git. esc(), getProjects(), saveProjects() and
// clearStoredProjects() come from store.js.
(() => {
  let projects = [];
  let editing = null; // the project object being edited in the Update view

  const $ = (selector) => document.querySelector(selector);
  const views = document.querySelectorAll(".view");
  const items = document.querySelectorAll(".sidebar__item");
  const storageNote = $("#storage-note");
  const loadError = $("#load-error");

  function showMessage(el, text) {
    el.textContent = text;
    el.hidden = false;
  }

  // --- Persistence ---
  function persist() {
    saveProjects(projects);
    refreshStorageNote();
    refreshDatalists();
  }

  function refreshStorageNote() {
    if (readStoredProjects()) {
      showMessage(
        storageNote,
        "Estás viendo cambios guardados en este navegador. Para publicarlos, usa «Exportar JSON» y reemplaza mis-proyectos.json."
      );
    } else {
      storageNote.hidden = true;
    }
  }

  function refreshDatalists() {
    const unique = (key) => [...new Set(projects.map((p) => p[key]).filter(Boolean))];
    $("#dl-categories").innerHTML = unique("categoria").map((c) => `<option value="${esc(c)}">`).join("");
    $("#dl-tools").innerHTML = unique("herramienta").map((t) => `<option value="${esc(t)}">`).join("");
  }

  const nextId = () => Math.max(0, ...projects.map((p) => p.id ?? 0)) + 1;

  // --- Views ---
  function showView(name) {
    views.forEach((v) => { v.hidden = v.dataset.view !== name; });
    items.forEach((i) => i.classList.toggle("is-active", i.dataset.view === name));

    if (name === "list") renderList();
    if (name === "read") resetRead();
    if (name === "update") renderUpdate();
    if (name === "delete") renderDelete();
    if (name === "create") $("#create-message").hidden = true;
  }

  items.forEach((item) =>
    item.addEventListener("click", (e) => {
      e.preventDefault();
      showView(item.dataset.view);
    })
  );

  // --- Shared project card (list + read) ---
  function projectCard(p) {
    const stages = (p.etapas ?? []).map((s) => `<li>${esc(s)}</li>`).join("");
    const card = document.createElement("article");
    card.className = "card";
    card.innerHTML = `
      ${p.imagen ? `<img class="card__img" src="${esc(p.imagen)}" alt="${esc(p.nombre)}" loading="lazy" />` : ""}
      <div class="card__body">
        <p class="card__id">#${esc(p.id)}</p>
        ${p.enProceso ? '<span class="badge">En proceso</span>' : ""}
        <h3>${esc(p.nombre)}</h3>
        <p class="card__meta">${esc(p.categoria)} · ${esc(p.herramienta)}</p>
        <p>${esc(p.descripcion)}</p>
        <p class="card__meta">${esc(p.horasInvertidas)} h</p>
        ${stages ? `<ol class="stages">${stages}</ol>` : ""}
        ${p.enlace ? `<a class="card__link" href="${esc(p.enlace)}" target="_blank" rel="noopener">Ver proyecto</a>` : ""}
      </div>`;
    return card;
  }

  function renderList() {
    const view = $("#view-list");
    view.innerHTML = "<h2>Todos los proyectos</h2>";
    const grid = document.createElement("div");
    grid.className = "cards";
    projects.forEach((p) => grid.append(projectCard(p)));
    view.append(grid);
  }

  // --- Form shared by Create and Update ---
  function buildForm({ submitLabel, onSubmit, onCancel }) {
    const form = $("#tpl-form").content.firstElementChild.cloneNode(true);
    form.querySelector("[data-submit]").textContent = submitLabel;
    if (onCancel) {
      const cancel = form.querySelector("[data-cancel]");
      cancel.hidden = false;
      cancel.addEventListener("click", onCancel);
    }
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      onSubmit(readForm(form), form);
    });
    return form;
  }

  function readForm(form) {
    const f = form.elements;
    const data = {
      nombre: f.nombre.value.trim(),
      categoria: f.categoria.value.trim(),
      herramienta: f.herramienta.value.trim(),
      descripcion: f.descripcion.value.trim(),
      enProceso: f.enProceso.checked,
      destacado: f.destacado.checked,
      horasInvertidas: Number(f.horasInvertidas.value),
      etapas: f.etapas.value.split(",").map((s) => s.trim()).filter(Boolean),
    };
    // imagen and enlace are optional: only kept when they have a value.
    const imagen = f.imagen.value.trim();
    const enlace = f.enlace.value.trim();
    if (imagen) data.imagen = imagen;
    if (enlace) data.enlace = enlace;
    return data;
  }

  function fillForm(form, p) {
    const f = form.elements;
    f.nombre.value = p.nombre ?? "";
    f.categoria.value = p.categoria ?? "";
    f.herramienta.value = p.herramienta ?? "";
    f.imagen.value = p.imagen ?? "";
    f.descripcion.value = p.descripcion ?? "";
    f.horasInvertidas.value = p.horasInvertidas ?? 0;
    f.etapas.value = (p.etapas ?? []).join(", ");
    f.enlace.value = p.enlace ?? "";
    f.enProceso.checked = Boolean(p.enProceso);
    f.destacado.checked = Boolean(p.destacado);
  }

  // --- Create ---
  function mountCreate() {
    $("#create-slot").replaceChildren(
      buildForm({
        submitLabel: "Agregar proyecto",
        onSubmit(data, form) {
          const project = { id: nextId(), ...data };
          projects.unshift(project); // newest first
          persist();
          form.reset();
          showMessage($("#create-message"), `Proyecto «${project.nombre}» agregado (#${project.id}). Van ${projects.length} en total.`);
        },
      })
    );
  }

  // --- Read ---
  function resetRead() {
    $("#read-form").reset();
    $("#read-message").hidden = true;
    $("#read-result").innerHTML = "";
  }

  $("#read-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const id = Number($("#read-id").value); // input values are always text
    const found = projects.find((p) => p.id === id);
    const result = $("#read-result");
    result.innerHTML = "";
    if (found) {
      $("#read-message").hidden = true;
      result.append(projectCard(found));
    } else {
      showMessage($("#read-message"), `No existe un proyecto con el id ${id}.`);
    }
  });

  // --- Rows (Update + Delete) ---
  function projectRow(p, label, className, onClick) {
    const row = document.createElement("div");
    row.className = "row";
    row.innerHTML = `
      <div class="row__info">
        <strong>#${esc(p.id)} · ${esc(p.nombre)}</strong>
        <span>${esc(p.categoria)} · ${esc(p.herramienta)}</span>
      </div>`;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn ${className}`;
    btn.textContent = label;
    btn.addEventListener("click", onClick);
    row.append(btn);
    return row;
  }

  // --- Update ---
  function renderUpdate() {
    editing = null;
    $("#update-slot").replaceChildren();
    $("#update-message").hidden = true;
    renderUpdateList();
  }

  function renderUpdateList() {
    const list = $("#update-list");
    list.innerHTML = projects.length ? "" : "<p>No queda ningún proyecto.</p>";
    projects.forEach((p) => list.append(projectRow(p, "Editar", "btn--accent", () => startEdit(p))));
  }

  function startEdit(project) {
    editing = project; // reference, so saving edits the object in place
    const form = buildForm({
      submitLabel: "Guardar cambios",
      onCancel: () => renderUpdate(),
      onSubmit(data) {
        // Rebuild the object's fields, dropping imagen/enlace if emptied.
        delete editing.imagen;
        delete editing.enlace;
        Object.assign(editing, data);
        persist();
        const name = editing.nombre;
        $("#update-slot").replaceChildren();
        editing = null;
        renderUpdateList();
        showMessage($("#update-message"), `Proyecto «${name}» actualizado.`);
      },
    });
    fillForm(form, project);
    $("#update-slot").replaceChildren(form);
    $("#update-message").hidden = true;
    form.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // --- Delete ---
  function renderDelete() {
    const list = $("#delete-list");
    list.innerHTML = projects.length ? "" : "<p>No queda ningún proyecto.</p>";
    projects.forEach((p) =>
      list.append(
        projectRow(p, "Eliminar", "btn--danger", () => {
          if (!confirm(`¿Eliminar «${p.nombre}»? No se puede deshacer.`)) return;
          projects.splice(projects.indexOf(p), 1);
          persist();
          renderDelete();
        })
      )
    );
  }

  // --- Export / reset ---
  $("#btn-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(projects, null, 2) + "\n"], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "mis-proyectos.json";
    link.click();
    URL.revokeObjectURL(url);
  });

  $("#btn-reset").addEventListener("click", () => {
    if (!confirm("Esto descarta los cambios guardados en este navegador y vuelve a lo que dice mis-proyectos.json. ¿Seguro?")) return;
    clearStoredProjects();
    location.reload();
  });

  // --- Start ---
  async function init() {
    try {
      projects = await getProjects();
    } catch (error) {
      console.error("Could not load projects:", error);
      showMessage(
        loadError,
        "No se pudieron cargar los proyectos. Abre la página con un servidor local (extensión Live Server de VS Code o npx serve dentro de esta carpeta) en vez de abrir el archivo directamente."
      );
      return;
    }
    refreshStorageNote();
    refreshDatalists();
    mountCreate();
    showView("list");
  }

  init();
})();
