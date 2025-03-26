// #region 📦 Imports und Konstanten
const { Plugin, ItemView, Modal, normalizePath } = require('obsidian');
const path = require("path");

const VIEW_TYPE_SUPPLEMENTS = "supplement-manager-view";

// Load necessary files because i cant find a way for obsidian to download them directly
async function downloadFilesIfMissing(plugin) {
  const baseDir = plugin.manifest.dir;
  const files = [
    { name: 'languages.json', url: 'https://raw.githubusercontent.com/wambo121/supplement-manager/main/languages.json' },
    { name: 'SupplementTemplater.js', url: 'https://raw.githubusercontent.com/wambo121/supplement-manager/main/SupplementTemplater.js' }
  ];

  for (const { name, url } of files) {
    const filePath = normalizePath(`${baseDir}/${name}`);
    if (!(await plugin.app.vault.adapter.exists(filePath))) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        await plugin.app.vault.adapter.write(filePath, text);
        console.log(`✅ ${name} heruntergeladen.`);
      } catch (e) {
        console.error(`❌ Download-Error für ${name}:`, e);
      }
    }
  }
}


// #endregion

// #region 🌐 Globale Variablen
let lang;
let strings;
// #endregion

// #region 🛠️ Hilfsfunktionen

// Berechne die ISO-Woche eines Datums
function getISOWeek(date) {
  const tempDate = new Date(date.getTime());
  tempDate.setHours(0, 0, 0, 0);
  tempDate.setDate(tempDate.getDate() + 3 - (tempDate.getDay() + 6) % 7);
  const jan4 = new Date(tempDate.getFullYear(), 0, 4);
  const week1 = new Date(jan4.getTime());
  week1.setDate(jan4.getDate() + 3 - (jan4.getDay() + 6) % 7);
  const diff = tempDate - week1;
  return Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
}

// Berechne das Datum aus Jahr und ISO-Woche
function getDateFromISOWeek(year, week) {
  const jan4 = new Date(year, 0, 4);
  const week1 = new Date(jan4.getTime());
  week1.setDate(jan4.getDate() + 3 - (jan4.getDay() + 6) % 7);
  const targetDate = new Date(week1.getTime());
  targetDate.setDate(week1.getDate() + (week - 1) * 7);
  targetDate.setDate(targetDate.getDate() - (targetDate.getDay() + 6) % 7);
  return targetDate;
}

// Berechnet das Startdatum der ISO-Woche (Montag) für ein gegebenes Datum
function startOfISOWeek(date) {
  const tempDate = new Date(date.getTime());
  const day = tempDate.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  tempDate.setDate(tempDate.getDate() + diff);
  tempDate.setHours(0, 0, 0, 0);
  return tempDate;
}

// Berechne die Differenz in Wochen zwischen zwei Daten
function differenceInWeeks(date1, date2) {
  const d1 = startOfISOWeek(date1);
  const d2 = startOfISOWeek(date2);
  const diffTime = d1.getTime() - d2.getTime();
  return Math.round(diffTime / (7 * 24 * 60 * 60 * 1000));
}

// Hilfsfunktion: Prüft, ob zwei Daten denselben Tag haben
function isSameDay(date1, date2) {
  return date1.getFullYear() === date2.getFullYear() &&
         date1.getMonth() === date2.getMonth() &&
         date1.getDate() === date2.getDate();
}

// Hilfsfunktion: Prüft, ob date1 vor date2 liegt (nur Datum)
function isBefore(date1, date2) {
  return date1.getFullYear() < date2.getFullYear() ||
         (date1.getFullYear() === date2.getFullYear() && date1.getMonth() < date2.getMonth()) ||
         (date1.getFullYear() === date2.getFullYear() && date1.getMonth() === date2.getMonth() && date1.getDate() < date2.getDate());
}

// Formatiere das Datum als gggg-[W]WW
function formatWeek(date) {
  const year = date.getFullYear();
  const week = getISOWeek(date);
  return `${year}-[W]${week < 10 ? '0' + week : week}`;
}
// #endregion

// #region 💾 Datenmanagement

// Funktion zum Laden der Sprachdateien


async function loadLanguageStrings(plugin) {
  const filePath = normalizePath(`${plugin.manifest.dir}/languages.json`);
  const content = await plugin.app.vault.adapter.read(filePath);
  return JSON.parse(content);
}



// Funktion zum Laden der Daten
async function getSupplementData(plugin) {
  const filePath = `${plugin.manifest.dir}/data.json`;
  if (!(await plugin.app.vault.adapter.exists(filePath))) return [];
  const raw = await plugin.app.vault.adapter.read(filePath);
  return JSON.parse(raw);
}

// Funktion zum Speichern der Daten
async function saveSupplementData(plugin, data) {
  const filePath = `${plugin.manifest.dir}/data.json`;
  await plugin.app.vault.adapter.write(filePath, JSON.stringify(data, null, 2));
}
// #endregion

// #region 🧪 Supplement-Logik

// Bestimme die Supplemente für einen bestimmten Tag (Kalender-Modul)
function getSupplementsForDay(supplements, selectedDate) {
  const localDate = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate()
  );
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const selectedDayName = dayNames[localDate.getDay()];
  const weekStart = startOfISOWeek(selectedDate);
  const supplementsForDay = [];

  supplements.forEach(supplement => {
    if (!supplement.active) return;
    if (!supplement.days.includes(selectedDayName)) return;

    let includeSupplement = false;
    if (supplement.cycle.type === 'continuous') {
      includeSupplement = true;
    } else if (supplement.cycle.type === 'cyclic') {
      const startDate = new Date(supplement.cycle.start_date);
      if (isNaN(startDate.getTime())) {
        console.warn(`Ungültiges Startdatum für Supplement ${supplement.name}:`, supplement.cycle.start_date);
        return;
      }
      if (isBefore(selectedDate, startDate) && !isSameDay(selectedDate, startDate)) {
        includeSupplement = false;
      } else {
        const startWeek = startOfISOWeek(startDate);
        const diffWeeks = differenceInWeeks(weekStart, startWeek);
        const onWeeks = parseInt(supplement.cycle.on_weeks, 10);
        const offWeeks = parseInt(supplement.cycle.off_weeks, 10);
        if (isNaN(onWeeks) || isNaN(offWeeks)) {
          console.warn(`Ungültige on_weeks oder off_weeks für Supplement ${supplement.name}:`, {
            on_weeks: supplement.cycle.on_weeks,
            off_weeks: supplement.cycle.off_weeks
          });
          return;
        }
        const cycleLength = onWeeks + offWeeks;
        let inCycleWeek;
        if (!supplement.cycle.repeat) {
          if (diffWeeks < cycleLength) {
            inCycleWeek = diffWeeks % cycleLength;
            includeSupplement = inCycleWeek < onWeeks;
          } else {
            includeSupplement = false;
          }
        } else {
          inCycleWeek = diffWeeks % cycleLength;
          includeSupplement = inCycleWeek < onWeeks;
        }
        console.log("---- DEBUG Supplement:", supplement.name);
        console.log("StartDate:", startDate.toISOString());
        console.log("WeekStart:", weekStart.toISOString());
        console.log("DiffWeeks:", diffWeeks);
        console.log("OnWeeks:", onWeeks);
        console.log("OffWeeks:", offWeeks);
        console.log("CycleLength:", cycleLength);
        console.log("inCycleWeek:", inCycleWeek);
        console.log("Include?:", includeSupplement);
      }
    }
    if (includeSupplement) {
      supplementsForDay.push(supplement);
    }
  });

  return supplementsForDay;
}
// #endregion

// #region 🖼️ Modal-Klassen

// Modal für Supplemente an einem bestimmten Tag (Kalender-Modul)
class DaySupplementModal extends Modal {
  constructor(app, selectedDate, supplements) {
    super(app);
    this.selectedDate = selectedDate;
    this.supplements = supplements;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("supplement-manager");

    // Titel mit dem Datum
    const formattedDate = this.selectedDate.toLocaleDateString('de-DE', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    contentEl.createEl("h2", { text: `${strings[lang]["supplements_for_day"]} ${formattedDate}` });
    if (this.supplements.length === 0) {
      contentEl.createEl("p", { text: strings[lang]["no_supplements_for_day"] });
    } else {
      const table = contentEl.createEl("table", { cls: "day-supplement-table" });
      table.innerHTML = `
        <thead>
          <tr>
            <th>${strings[lang]["table_name"]}</th>
            <th>${strings[lang]["table_amount"]}</th>
            <th>${strings[lang]["table_time"]}</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tbody = table.querySelector("tbody");
      this.supplements.forEach(supplement => {
        const row = tbody.createEl("tr");
        row.createEl("td", { text: supplement.name });
        row.createEl("td", { text: supplement.amount });
        row.createEl("td", { text: supplement.time });
      });
    }
    const buttonDiv = contentEl.createEl("div", { cls: "modal-button-container" });
    const closeBtn = buttonDiv.createEl("button", { text: strings[lang]["close_button"], cls: "mod-cta" });
    closeBtn.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}

// Modal für Hinzufügen/Bearbeiten in der Hauptansicht
class SupplementModal extends Modal {
  constructor(app, onSubmit, initialData = null) {
    super(app);
    this.onSubmit = onSubmit;
    this.initialData = initialData;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("supplement-manager");

    contentEl.createEl("h2", { text: this.initialData ? strings[lang]["edit_supplement"] : strings[lang]["add_new_supplement"] });
    const form = contentEl.createEl("div", { cls: "supplement-form" });
    const basicSection = form.createEl("div", { cls: "form-section" });
    basicSection.createEl("h3", { text: strings[lang]["basic_data"] });

    const nameDiv = basicSection.createEl("div", { cls: "form-field" });
    nameDiv.createEl("label", { text: strings[lang]["name_label"], attr: { for: "name-input" } });
    const nameInput = nameDiv.createEl("input", { attr: { type: "text", id: "name-input", value: this.initialData?.name || "" } });

    const amountDiv = basicSection.createEl("div", { cls: "form-field" });
    amountDiv.createEl("label", { text: strings[lang]["amount_label"], attr: { for: "amount-input" } });
    const amountInput = amountDiv.createEl("input", { attr: { type: "text", id: "amount-input", value: this.initialData?.amount || "" } });

    const timeDiv = basicSection.createEl("div", { cls: "form-field" });
    timeDiv.createEl("label", { text: strings[lang]["time_label"], attr: { for: "time-input" } });
    const timeInput = timeDiv.createEl("input", { attr: { type: "text", id: "time-input", value: this.initialData?.time || "" } });

    // Einnahmetage
    const daysSection = form.createEl("div", { cls: "form-section" });
    daysSection.createEl("h3", { text: strings[lang]["days_label"] });
    const toggleAllWrapper = daysSection.createEl("div", { cls: "toggle-all-wrapper" });
    const toggleAllItem = toggleAllWrapper.createEl("div", { cls: "toggle-all-item" });
    const toggleAllLabel = toggleAllItem.createEl("label", { 
      text: strings[lang]["select_all_days"], 
      attr: { for: "toggle-all-days" } 
    });
    const toggleAllInput = toggleAllItem.createEl("input", { 
      attr: { type: "checkbox", id: "toggle-all-days", "aria-label": strings[lang]["select_all_days"] },
      cls: "toggle-all-checkbox" 
    });
    const daysWrapper = daysSection.createEl("div", { cls: "days-wrapper" });
    const daysList = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    daysList.forEach((day) => {
      const fullDay = strings[lang]["days_short"][day];
      const dayItem = daysWrapper.createEl("div", { cls: "day-item" });
      dayItem.createEl("label", { text: fullDay, attr: { for: `day-${day}` } });
      const cb = dayItem.createEl("input", { attr: { type: "checkbox", id: `day-${day}`, "data-day": day, "aria-label": `${strings[lang]["day_label"]} ${fullDay}` } });
      if (this.initialData?.days?.includes(day)) cb.checked = true;
    });
    toggleAllInput.addEventListener("change", () => {
      const checkboxes = daysWrapper.querySelectorAll("input[type=checkbox]");
      checkboxes.forEach(cb => cb.checked = toggleAllInput.checked);
    });

    const cycleSection = form.createEl("div", { cls: "form-section" });
    cycleSection.createEl("h3", { text: strings[lang]["cycle_details"] });
    const cycleTypeDiv = cycleSection.createEl("div", { cls: "form-field" });
    cycleTypeDiv.createEl("label", { text: strings[lang]["cycle_type"], attr: { for: "cycle-type" } });
    const cycleSelect = cycleTypeDiv.createEl("select", { attr: { id: "cycle-type" } });
    cycleSelect.innerHTML = `
      <option value="continuous" ${this.initialData?.cycle?.type === "continuous" ? "selected" : ""}>${strings[lang]["continuous"]}</option>
      <option value="cyclic" ${this.initialData?.cycle?.type === "cyclic" ? "selected" : ""}>${strings[lang]["cyclic"]}</option>
    `;
    const cycleDetails = cycleSection.createEl("div", { cls: "cycle-details" });
    cycleDetails.style.display = cycleSelect.value === "cyclic" ? "block" : "none";
    const onDiv = cycleDetails.createEl("div", { cls: "form-field" });
    onDiv.createEl("label", { text: strings[lang]["on_period"], attr: { for: "on-period" } });
    const onInput = onDiv.createEl("input", { attr: { type: "number", id: "on-period", value: this.initialData?.cycle?.on_weeks || "" } });
    const offDiv = cycleDetails.createEl("div", { cls: "form-field" });
    offDiv.createEl("label", { text: strings[lang]["off_period"], attr: { for: "off-period" } });
    const offInput = offDiv.createEl("input", { attr: { type: "number", id: "off-period", value: this.initialData?.cycle?.off_weeks || "" } });
    const startDiv = cycleDetails.createEl("div", { cls: "form-field" });
    startDiv.createEl("label", { text: strings[lang]["start_date"], attr: { for: "start-date" } });
    const startInput = startDiv.createEl("input", { attr: { type: "date", id: "start-date", value: this.initialData?.cycle?.start_date || "" } });
    const repeatDiv = cycleDetails.createEl("div", { cls: "form-field repeat-wrapper" });
    const repeatItem = repeatDiv.createEl("div", { cls: "repeat-item" });
    const repeatCb = repeatItem.createEl("input", { attr: { type: "checkbox", id: "repeat" } });
    if (this.initialData?.cycle?.repeat) repeatCb.checked = true;
    repeatItem.createEl("label", { text: strings[lang]["repeat"], attr: { for: "repeat" } });
    cycleSelect.onchange = () => {
      cycleDetails.style.display = cycleSelect.value === "cyclic" ? "block" : "none";
    };

    const activeSection = form.createEl("div", { cls: "form-section" });
    activeSection.createEl("h3", { text: strings[lang]["status"] });
    const activeWrapper = activeSection.createEl("div", { cls: "active-wrapper" });
    const activeItem = activeWrapper.createEl("div", { cls: "active-item" });
    const activeCb = activeItem.createEl("input", { attr: { type: "checkbox", id: "active" } });
    activeCb.checked = this.initialData ? this.initialData.active : true;
    activeItem.createEl("label", { text: strings[lang]["active_label"], attr: { for: "active" } });

    const buttonDiv = contentEl.createEl("div", { cls: "modal-button-container" });
    const saveBtn = buttonDiv.createEl("button", { text: strings[lang]["save_button"], cls: "mod-cta" });
    const cancelBtn = buttonDiv.createEl("button", { text: strings[lang]["cancel_button"], cls: "mod-warning" });
    saveBtn.onclick = () => {
      // Wenn vorhanden: bestehende ID wiederverwenden, sonst neue erzeugen
      const id = this.initialData?.id ?? crypto.randomUUID();
    
      const newSupplement = {
        id,
        name: nameInput.value,
        amount: amountInput.value,
        time: timeInput.value,
        days: Array.from(daysWrapper.querySelectorAll("input[type=checkbox]:checked"))
                   .map(cb => cb.getAttribute("data-day")),
        cycle: { type: cycleSelect.value },
        active: activeCb.checked
      };
    
      if (newSupplement.cycle.type === "cyclic") {
        newSupplement.cycle.on_weeks   = parseInt(onInput.value) || 0;
        newSupplement.cycle.off_weeks  = parseInt(offInput.value) || 0;
        newSupplement.cycle.start_date = startInput.value;
        newSupplement.cycle.repeat     = repeatCb.checked;
      }
    
      this.onSubmit(newSupplement);
      this.close();
    };

    cancelBtn.onclick = () => this.close();
  }

  onClose() {
    this.contentEl.empty();
  }
}
// #endregion

// #region 📋 Hauptansicht

class SupplementView extends ItemView {
  constructor(leaf, plugin) {
    super(leaf);
    this.plugin = plugin;
    this.currentDate = new Date();
    this.sortColumn = null;
    this.sortDirection = 'asc';
  }

  getViewType() { return VIEW_TYPE_SUPPLEMENTS; }
  getDisplayText() { return strings[lang]["supplement_manager_title"]; }

  async onOpen() {
    const container = this.containerEl.children[1];
    container.addClass("supplement-manager");
    container.empty();
    container.addClass("supplement-manager");
    container.style.padding = "20px";

    const supplements = await getSupplementData(this.plugin);

    let changed = false;
    supplements.forEach(s => {
      if (!s.id) {
        s.id = crypto.randomUUID();
        changed = true;
      }
    });

    if (changed) {
      await saveSupplementData(this.plugin, supplements);
    }


    const titleWrapper = container.createEl("div", { cls: "title-wrapper" });
    titleWrapper.style.display = "flex";
    titleWrapper.style.justifyContent = "space-between";
    titleWrapper.style.alignItems = "center";
    titleWrapper.style.marginBottom = "20px";

    const title = titleWrapper.createEl("h2", { text: strings[lang]["supplement_manager_title"] });

    const copyButton = titleWrapper.createEl("button", {
      text: strings[lang]["copy_weekly_plan"],
      cls: "copy-button"
    });

    copyButton.addEventListener("click", async () => {
      const codeToCopy = '<%- String(await window.generateWeeklySupplementPlan(tp.file.title)) %>';
      try {
        await navigator.clipboard.writeText(codeToCopy);
        copyButton.innerText = strings[lang]["copied"];
        setTimeout(() => {
          copyButton.innerText = strings[lang]["copy_weekly_plan"];
        }, 2000);
      } catch (err) {
        console.error("Fehler beim Kopieren:", err);
        copyButton.innerText = strings[lang]["copy_error"];
        setTimeout(() => {
          copyButton.innerText = strings[lang]["copy_weekly_plan"];
        }, 2000);
      }
    });

    const table = container.createEl("table", { cls: "supplement-table" });
    table.innerHTML = `
      <thead>
        <tr>
          <th data-sort="name">${strings[lang]["table_name"]}</th>
          <th data-sort="amount">${strings[lang]["table_amount"]}</th>
          <th data-sort="time">${strings[lang]["table_time"]}</th>
          <th data-sort="days">${strings[lang]["table_days"]}</th>
          <th data-sort="cycle.type">${strings[lang]["table_cycle_type"]}</th>
          <th data-sort="cycle.on_weeks">${strings[lang]["table_on_period"]}</th>
          <th data-sort="cycle.off_weeks">${strings[lang]["table_off_period"]}</th>
          <th data-sort="cycle.start_date">${strings[lang]["table_start_date"]}</th>
          <th data-sort="cycle.repeat">${strings[lang]["table_repeat"]}</th>
          <th data-sort="active">${strings[lang]["table_active"]}</th>
          <th>${strings[lang]["table_actions"]}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const thead = table.querySelector("thead");
    const tbody = table.querySelector("tbody");

    const sortData = (data, column, direction) => {
      return [...data].sort((a, b) => {
        let valA, valB;
        switch (column) {
          case 'name': valA = a.name || ''; valB = b.name || ''; break;
          case 'amount': valA = a.amount || ''; valB = b.amount || ''; break;
          case 'time': valA = a.time || ''; valB = b.time || ''; break;
          case 'days': valA = a.days ? a.days.join(', ') : ''; valB = b.days ? b.days.join(', ') : ''; break;
          case 'cycle.type': valA = a.cycle.type || ''; valB = b.cycle.type || ''; break;
          case 'cycle.on_weeks': valA = a.cycle.type === 'cyclic' ? (a.cycle.on_weeks || 0) : -1; valB = b.cycle.type === 'cyclic' ? (b.cycle.on_weeks || 0) : -1; break;
          case 'cycle.off_weeks': valA = a.cycle.type === 'cyclic' ? (a.cycle.off_weeks || 0) : -1; valB = b.cycle.type === 'cyclic' ? (b.cycle.off_weeks || 0) : -1; break;
          case 'cycle.start_date': valA = a.cycle.type === 'cyclic' ? (a.cycle.start_date || '') : ''; valB = b.cycle.type === 'cyclic' ? (b.cycle.start_date || '') : ''; break;
          case 'cycle.repeat': valA = a.cycle.type === 'cyclic' ? (a.cycle.repeat ? 1 : 0) : -1; valB = b.cycle.type === 'cyclic' ? (b.cycle.repeat ? 1 : 0) : -1; break;
          case 'active': valA = a.active ? 1 : 0; valB = b.active ? 1 : 0; break;
          default: return 0;
        }
        if (typeof valA === 'string' && typeof valB === 'string') {
          return direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else {
          return direction === 'asc' ? valA - valB : valB - valA;
        }
      });
    };

    const renderTable = () => {
      tbody.empty();
      const sortedSupplements = this.sortColumn ? sortData(supplements, this.sortColumn, this.sortDirection) : supplements;
      sortedSupplements.forEach((supplement, index) => {
        const row = tbody.createEl("tr");
        const isCyclic = supplement.cycle.type === "cyclic";
        const translatedDays = supplement.days ? supplement.days.map(day => strings[lang]["days_short"][day] || day).join(", ") : "-";
        const translatedTime = strings[lang]["time_labels"]?.[supplement.time] || supplement.time || "-";
        const translatedCycleType = strings[lang][supplement.cycle.type] || supplement.cycle.type || "-";
        const translatedRepeat = isCyclic ? (supplement.cycle.repeat ? strings[lang]["yes"] : strings[lang]["no"]) : "-";
        const translatedActive = supplement.active ? strings[lang]["yes"] : strings[lang]["no"];
        row.createEl("td", { text: supplement.name || "-", attr: { "data-label": strings[lang]["table_name"], "data-value": supplement.name || "-" } });
        row.createEl("td", { text: supplement.amount || "-", attr: { "data-label": strings[lang]["table_amount"], "data-value": supplement.amount || "-" } });
        row.createEl("td", { text: translatedTime, attr: { "data-label": strings[lang]["table_time"], "data-value": translatedTime } });
        row.createEl("td", { text: translatedDays, attr: { "data-label": strings[lang]["table_days"], "data-value": translatedDays } });
        row.createEl("td", { text: translatedCycleType, attr: { "data-label": strings[lang]["table_cycle_type"], "data-value": translatedCycleType } });
        row.createEl("td", { text: isCyclic ? supplement.cycle.on_weeks || "-" : "-", attr: { "data-label": strings[lang]["table_on_period"], "data-value": isCyclic ? supplement.cycle.on_weeks || "-" : "-" } });
        row.createEl("td", { text: isCyclic ? supplement.cycle.off_weeks || "-" : "-", attr: { "data-label": strings[lang]["table_off_period"], "data-value": isCyclic ? supplement.cycle.off_weeks || "-" : "-" } });
        row.createEl("td", { text: isCyclic ? supplement.cycle.start_date || "-" : "-", attr: { "data-label": strings[lang]["table_start_date"], "data-value": isCyclic ? supplement.cycle.start_date || "-" : "-" } });
        row.createEl("td", { text: translatedRepeat, attr: { "data-label": strings[lang]["table_repeat"], "data-value": translatedRepeat } });
        row.createEl("td", { text: translatedActive, attr: { "data-label": strings[lang]["table_active"], "data-value": translatedActive } });
        const actionCell = row.createEl("td", { attr: { "data-label": strings[lang]["table_actions"] } });
        const buttonWrapper = actionCell.createEl("div", { cls: "action-buttons" });
        const editBtn = actionCell.createEl("button", { text: "✏️", cls: "mod-cta" });
        const deleteBtn = actionCell.createEl("button", { text: "🗑️", cls: "mod-warning" });
        deleteBtn.style.marginLeft = "8px";
        editBtn.onclick = () => {
          new SupplementModal(this.app, async (newSupplement) => {
            const idx = supplements.findIndex(s => s.id === newSupplement.id);
            if (idx >= 0) {
              supplements[idx] = newSupplement;
            } else {
              supplements.push(newSupplement);
            }
            await saveSupplementData(this.plugin, supplements);
            renderTable();
            renderCalendar();
          }, supplement).open();
        };

        deleteBtn.onclick = async () => {
          supplements.splice(index, 1);
          await saveSupplementData(this.plugin, supplements);
          renderTable();
          renderCalendar();
        };
      });
    };

    thead.querySelectorAll('th[data-sort]').forEach(th => {
      th.style.cursor = "pointer";
      th.addEventListener('click', () => {
        const column = th.getAttribute('data-sort');
        if (this.sortColumn === column) {
          this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          this.sortColumn = column;
          this.sortDirection = 'asc';
        }
        thead.querySelectorAll('th').forEach(header => {
          header.innerHTML = header.innerHTML.replace(/ (▲|▼)$/, '');
        });
        th.innerHTML += this.sortDirection === 'asc' ? ' ▲' : ' ▼';
        renderTable();
      });
    });

    const addBtn = container.createEl("button", { cls: "mod-cta" });
    addBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="21" height="21" fill="black" class="bi bi-plus" viewBox="0 0 16 16">
      <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
    </svg>`;
    addBtn.onclick = () => {
      new SupplementModal(this.app, async (newSupplement) => {
        supplements.push(newSupplement);
        await saveSupplementData(this.plugin, supplements);
        renderTable();
        renderCalendar();
      }).open();
    };
    

    // #region Kalendermodul 
    const calendarContainer = container.createEl("div", { cls: "calendar-container" });
    const toggleBtn = calendarContainer.createEl("button", { cls: "calendar-toggle", text: "📅" });
    toggleBtn.addEventListener("click", () => {
      calendarContainer.classList.toggle("collapsed");
    });
    const calendarWrapper = calendarContainer.createEl("div", { cls: "calendar-wrapper" });
    const calendarHeader = calendarWrapper.createEl("div", { cls: "calendar-header" });
    const prevBtn = calendarHeader.createEl("button", { cls: "calendar-nav-btn prev" });
    prevBtn.innerHTML = '<svg><polyline points="15 18 9 12 15 6"></polyline></svg>';
    const monthTitle = calendarHeader.createEl("h3", { cls: "calendar-month-title" });
    const nextBtn = calendarHeader.createEl("button", { cls: "calendar-nav-btn next" });
    nextBtn.innerHTML = '<svg><polyline points="15 18 9 12 15 6"></polyline></svg>';
    const calendarTable = calendarWrapper.createEl("table", { cls: "calendar-table" });
    const daysShort = strings[lang]["days_short"];
    calendarTable.innerHTML = `
      <thead>
        <tr>
          <th>${daysShort["Mon"]}</th>
          <th>${daysShort["Tue"]}</th>
          <th>${daysShort["Wed"]}</th>
          <th>${daysShort["Thu"]}</th>
          <th>${daysShort["Fri"]}</th>
          <th>${daysShort["Sat"]}</th>
          <th>${daysShort["Sun"]}</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const calendarTbody = calendarTable.querySelector("tbody");

    const renderCalendar = () => {
      calendarTbody.empty();
      const firstDayOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), 1);
      const lastDayOfMonth = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth() + 1, 0);
      const startDay = firstDayOfMonth.getDay() === 0 ? 6 : firstDayOfMonth.getDay() - 1;
      const daysInMonth = lastDayOfMonth.getDate();
      const monthNames = strings[lang]["months"];
      const monthName = monthNames[firstDayOfMonth.toLocaleDateString('en-US', { month: 'long' })];
      monthTitle.textContent = `${monthName} ${firstDayOfMonth.getFullYear()}`;
      let dayCounter = 1;
      let row = calendarTbody.createEl("tr");
      for (let i = 0; i < startDay; i++) {
        row.createEl("td", { text: "" });
      }
      while (dayCounter <= daysInMonth) {
        if (row.children.length === 7) {
          row = calendarTbody.createEl("tr");
        }
        const dayCell = row.createEl("td", { text: dayCounter.toString(), cls: "calendar-day" });
        const currentDay = new Date(this.currentDate.getFullYear(), this.currentDate.getMonth(), dayCounter);
        const today = new Date();
        if (
          currentDay.getDate() === today.getDate() &&
          currentDay.getMonth() === today.getMonth() &&
          currentDay.getFullYear() === today.getFullYear()
        ) {
          dayCell.classList.add("today");
        }
        dayCell.addEventListener("click", () => {
          const supplementsForDay = getSupplementsForDay(supplements, currentDay);
          new DaySupplementModal(this.app, currentDay, supplementsForDay).open();
        });
        dayCounter++;
      }
      while (row.children.length < 7) {
        row.createEl("td", { text: "" });
      }
    };

    prevBtn.addEventListener("click", () => {
      this.currentDate.setMonth(this.currentDate.getMonth() - 1);
      renderCalendar();
    });

    nextBtn.addEventListener("click", () => {
      this.currentDate.setMonth(this.currentDate.getMonth() + 1);
      renderCalendar();
    });
    // #endregion

    renderTable();
    renderCalendar();
  }
}
// #endregion

// #region 🔌 Plugin-Klasse
module.exports = class SupplementManagerPlugin extends Plugin {
  async onload() {
    await downloadFilesIfMissing(this);
    this.currentLanguage = window.localStorage.getItem("language") || "en";
    lang = this.currentLanguage;
    strings = await loadLanguageStrings(this);

    // Absoluten Pfad zum Plugin-Verzeichnis erstellen
    const vaultBasePath = this.app.vault.adapter.basePath;
    const pluginDir = path.join(vaultBasePath, this.manifest.dir);
    const supplementTemplaterPath = path.join(pluginDir, 'SupplementTemplater.js');

    console.log('Versuche, SupplementTemplater.js zu laden von:', supplementTemplaterPath);

    let generateWeeklySupplementPlan;
    try {
      const module = require(supplementTemplaterPath);
      generateWeeklySupplementPlan = module.generateWeeklySupplementPlan;
    } catch (error) {
      console.error('Fehler beim Laden von SupplementTemplater:', error);
      throw error;
    }

    // Globale Funktionen verfügbar machen
    window.startOfISOWeek = startOfISOWeek;
    window.differenceInWeeks = differenceInWeeks;
    window.getSupplementsForDay = getSupplementsForDay;
    window.getDateFromISOWeek = getDateFromISOWeek;
    window.formatWeek = formatWeek;
    window.getISOWeek = getISOWeek; // Neu: getISOWeek global machen
    window.generateWeeklySupplementPlan = async (weekString) =>
      String(await generateWeeklySupplementPlan(this, weekString));

    this.registerView(VIEW_TYPE_SUPPLEMENTS, leaf => new SupplementView(leaf, this));
    this.addRibbonIcon("pill", strings[lang]["add_button"], () => this.activateView());
  }

  onunload() {
    this.app.workspace.detachLeavesOfType(VIEW_TYPE_SUPPLEMENTS);
    // Globale Funktionen aufräumen (optional)
    delete window.startOfISOWeek;
    delete window.differenceInWeeks;
    delete window.getSupplementsForDay;
    delete window.getDateFromISOWeek;
    delete window.formatWeek;
    delete window.getISOWeek; // Aufräumen
    delete window.generateWeeklySupplementPlan;
  }

  async activateView() {
    const leaf = this.app.workspace.getLeaf("main");
    await leaf.setViewState({ type: VIEW_TYPE_SUPPLEMENTS, active: true });
  }
};
// #endregion