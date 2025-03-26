const path = require('path');

async function generateWeeklySupplementPlan(plugin, weekString) {
  // Lade die Supplement-Daten
  const dataPath = path.join(plugin.manifest.dir, 'data.json');
  let fileContent;
  try {
    fileContent = await plugin.app.vault.adapter.read(dataPath);
  } catch (error) {
    console.error('Fehler beim Lesen der Datei:', error);
    return '# Fehler beim Laden des Plans\n';
  }
  const supplements = JSON.parse(fileContent);

  // Variablen für KW und Jahr vorab definieren
  let currentWeek;
  let usedWeekNumber;
  let usedWeekYear;

  // Bestimme die Woche
  if (/^\d{4}-\[W\]\d{1,2}$/.test(weekString)) {
    // Falls weekString gültig ist (z.B. "2025-[W]13")
    const [year] = weekString.split('-');
    const weekNumber = +weekString.match(/\d{1,2}$/)[0];
    currentWeek = window.getDateFromISOWeek(+year, weekNumber);
    usedWeekNumber = weekNumber;
    usedWeekYear = +year;
  } else {
    // Fallback: Nächste Woche nehmen
    console.warn('Ungültiges weekString, verwende nächste Woche als Fallback:', weekString);
    const today = new Date();
    const currentWeekNumber = window.getISOWeek(today);
    const nextWeekNumber = currentWeekNumber + 1;
    const nextWeekYear = today.getFullYear();
    currentWeek = window.getDateFromISOWeek(nextWeekYear, nextWeekNumber);
    usedWeekNumber = nextWeekNumber;
    usedWeekYear = nextWeekYear;
  }

  // Zeig in der Konsole, welche KW (und welches Jahr) jetzt wirklich genutzt wird
  console.log('Berechnete KW für Supplements:', usedWeekNumber);
  console.log('Berechnetes Jahr für Supplements:', usedWeekYear);

  // Berechne die Supplemente für jeden Tag der Woche
  const weekStart = window.startOfISOWeek(currentWeek);
  console.log('weekStart:', weekStart);
  console.log('Formatierte Woche (Debug):', window.formatWeek(weekStart));

  const daysOfWeek = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(weekStart);
    day.setDate(weekStart.getDate() + i);
    const supplementsForDay = window.getSupplementsForDay(supplements, day);
    daysOfWeek.push({ day, supplements: supplementsForDay });
  }

  // Teile die Supplemente in tägliche und variable Einnahmen auf
  const dailySupplements = [];
  const specificDaysSupplements = [];
  const allDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Finde Supplemente, die an allen Tagen eingenommen werden
  const seenSupplements = new Set();
  daysOfWeek.forEach(({ day, supplements }) => {
    supplements.forEach(supplement => {
      if (!seenSupplements.has(supplement.name)) {
        seenSupplements.add(supplement.name);
        const isDaily = allDays.every(d => supplement.days.includes(d));
        (isDaily ? dailySupplements : specificDaysSupplements).push(supplement);
      }
    });
  });

  // Sortiere die Supplemente nach Zeit und Name
  const sortByTime = (a, b) => {
    const order = { 
      Morgen: 1, 
      Vormittag: 2, 
      Mittag: 3, 
      Nachmittag: 4, 
      Abend: 5, 
      Nacht: 6 
    };
    return (order[a.time] || 999) - (order[b.time] || 999) || a.name.localeCompare(b.name);
  };

  dailySupplements.sort(sortByTime);
  specificDaysSupplements.sort(sortByTime);

  // Erstelle den Plan mit der tatsächlich genutzten KW/Jahr
  let plan = `\n# 🧾 Supplement‑Plan für KW ${usedWeekNumber} (${usedWeekYear})\n\n`;

  // Hilfsfunktion, um Supplements je nach Einnahmezeit auszugeben
  const byTime = (time, arr) => {
    if (!arr.length) return '';
    return `### ${time === 'Morgen' ? '🕗 Morgens' : '🌙 Abends'}\n` +
           arr.filter(s => s.time === time).map(s => `- ${s.name} (${s.amount})`).join('\n') + '\n\n';
  };

  plan += byTime('Morgen', dailySupplements);
  plan += byTime('Abend', dailySupplements);

  // Variable Supplements tabellarisch auflisten
  if (specificDaysSupplements.length) {
    plan += '### 📅 Variable Einnahmen\n' +
      '|Supplement|Dose|Zeit|Mo|Di|Mi|Do|Fr|Sa|So|\n' +
      '|---|---|---|---|---|---|---|---|---|---|\n' +
      specificDaysSupplements.map(s => {
        const marks = allDays.map(d => s.days.includes(d) ? '✅' : '').join(' | ');
        return `| ${s.name} | ${s.amount} | ${s.time} | ${marks} |`;
      }).join('\n');
  }

  return plan;
}

module.exports = {
  generateWeeklySupplementPlan
};
