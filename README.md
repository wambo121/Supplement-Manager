# ⚙️ Supplement Manager Plugin

A lightweight Obsidian plugin that organizes and automates your supplement schedule in a sortable table and calendar — perfect for anyone who wants a clear, no-nonsense overview of what to take and when.

## ✅ Features

- Add, edit and delete supplements with a simple form
- Sortable table view (name, amount, time, days, cycle, active status)
- Daily calendar view showing which supplements to take on each date
- Continuous and cyclic dosing schedules with optional repeat
- One‑click copy of weekly supplement plan (Templater code)
- Multi-language support via `languages.json`
- Responsive design
- You can change the Templater output in "SupplementTemplater.js" in the plugin folder

## 📦 Installation

**Obsidian Store**
- It's under review. So it takes some time

**Manual Installation**

1. Download the latest release from the Releases page
2. Unzip the plugin folder into your vault at: `.obsidian/plugins/supplement-manager`
3. In Obsidian, go to **Settings → Community Plugins**, enable Community Plugins, then enable **Supplement Manager Plugin**

**Alternative via BRAT**

If you use BRAT (Beta Reviewers Auto-update Tool), add the GitHub repo:
```
wambo121/supplement-manager
```

## 🧭 How to Use

1. Click the pill icon in the left ribbon to open the Supplement Manager view
2. Use the **+** button to add a new supplement; fill in name, dosage, time, days, and cycle details
3. Edit existing entries with the ✏️ button or delete with the 🗑️ button
4. Toggle the calendar panel (📅) to see supplements by date; click a day to view details
5. Click **Copy Templater Code** to copy a Templater-ready snippet of your weekly schedule

## ⚠️ Notes

- Compatible with Templater
- Data is stored in `data.json` inside the plugin folder — back it up if you need portability
- May conflict with plugins or themes that heavily modify tables or modals

## 🧪 Technical Details

- Uses Obsidian’s `Modal` for add/edit forms and `ItemView` for the main table/calendar UI
- IDs generated via `crypto.randomUUID()` for collision‑proof uniqueness
- Sorting and filtering done in plain JavaScript for performance
- Calendar uses native Date APIs to compute ISO weeks and daily schedules

## ✅ Tested With

- Obsidian Desktop v1.8.x+ (Windows)
- Default Light & Dark themes

## 🚀 Planned Features

- Make the main view the overwiew of the week
- Settings panel to choose time format
- Mobile compatibility
- Integration with popular plugin such as calendar
- Interactive charts/graphs of weekly and monthly supplement adherence
- Export your supplement schedule as CSV or PDF report
- Theme‑aware styling improvements for calendar and tables
- Improve loading times

💡 If you have suggestions on what to add feel free to let me know

## 📄 License

MIT License — free to use, modify, and distribute.

## 🙌 Support

🫶🏻 Like the project? Consider buying me a coffee or starring the repository on GitHub:

👉 https://github.com/wambo121/Supplement-Manager


[![Buy Me A Coffee](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/morganfrey)
