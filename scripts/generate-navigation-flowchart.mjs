import { readFileSync, writeFileSync } from "node:fs";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const svgPath = "docs/hall-management-saas-navigation-flowchart.svg";
const pdfPath = "docs/hall-management-saas-navigation-flowchart.pdf";

const modules = [
  {
    group: "Workspace",
    items: [
      ["Dashboard", "Daily overview, attention needed, quick actions"],
      ["Calendar", "Availability, holds, full dates, Google sync"],
      ["Events", "Event records, clients, status, files, PDFs"],
      ["Kitchen", "Today, This Week, 4 Weeks, prep and workers"],
      ["Menu", "Items, packages, add-ons, quantity rules"],
      ["Clients", "Client portal, events, payments, documents"],
    ],
  },
  {
    group: "Operations",
    items: [
      ["Dining Manager", "Seating, tables, waiter count, dining sheet"],
      ["Hall Room Map", "Layout editor, room objects, hall presets"],
      ["Billing", "Transactions, invoices, event billing, payment emails"],
      ["Reports", "Revenue, booking, hall, kitchen, payment reports"],
    ],
  },
  {
    group: "Office",
    items: [
      ["Staff", "Workers, roles, schedules, assignments"],
      ["Vendors", "Vendor directory, services, costs, contacts"],
      ["Settings", "Platform, halls, roles, access, integrations"],
    ],
  },
];

const workflows = [
  {
    title: "Booking Flow",
    steps: ["Calendar", "New Booking", "Event Record", "Menu / Package", "Invoice / Payment", "Google Calendar", "PDFs"],
  },
  {
    title: "Kitchen Flow",
    steps: ["Confirmed Event", "Menu Quantities", "Kitchen Dashboard", "Worker Assignment", "Item Status", "Kitchen Sheet PDF"],
  },
  {
    title: "Billing Flow",
    steps: ["Event Balance", "Invoice", "Payment Email", "External Payment Link", "Staff Confirmation", "Transaction Review", "Status Update"],
  },
  {
    title: "Dining & Layout Flow",
    steps: ["Select Event", "Load Hall Map", "Adjust Seating", "Set Waiters", "Save Setup", "Dining Sheet"],
  },
];

function esc(value) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function node(x, y, w, h, title, subtitle, tone = "blue") {
  const tones = {
    blue: ["#eef7ff", "#1d6bff"],
    teal: ["#ecfbfb", "#11b6b6"],
    green: ["#ecfdf5", "#16a34a"],
    gold: ["#fff8e8", "#b9974d"],
    navy: ["#f8fafc", "#0f172a"],
  };
  const [bg, accent] = tones[tone] ?? tones.blue;

  return `
    <g>
      <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="18" fill="#fffdf8" stroke="url(#stroke)" stroke-width="1.5" filter="url(#softShadow)"/>
      <rect x="${x + 1.5}" y="${y + 1.5}" width="${w - 3}" height="${h - 3}" rx="16.5" fill="${bg}"/>
      <circle cx="${x + 30}" cy="${y + 30}" r="12" fill="${accent}" opacity="0.18"/>
      <circle cx="${x + 30}" cy="${y + 30}" r="5" fill="${accent}"/>
      <text x="${x + 52}" y="${y + 29}" class="nodeTitle">${esc(title)}</text>
      <foreignObject x="${x + 22}" y="${y + 52}" width="${w - 44}" height="${h - 62}">
        <div xmlns="http://www.w3.org/1999/xhtml" class="nodeText">${esc(subtitle)}</div>
      </foreignObject>
    </g>`;
}

function arrow(x1, y1, x2, y2) {
  return `<path d="M${x1} ${y1} C ${x1 + 40} ${y1}, ${x2 - 40} ${y2}, ${x2} ${y2}" fill="none" stroke="#b9974d" stroke-width="2" marker-end="url(#arrow)"/>`;
}

function workflowRow(x, y, title, steps) {
  const boxW = 138;
  const boxH = 52;
  const gap = 24;
  let svg = `<text x="${x}" y="${y - 16}" class="sectionTitle">${esc(title)}</text>`;
  steps.forEach((step, index) => {
    const bx = x + index * (boxW + gap);
    svg += `<rect x="${bx}" y="${y}" width="${boxW}" height="${boxH}" rx="14" fill="#ffffff" stroke="#d7dee8" filter="url(#tinyShadow)"/>`;
    svg += `<text x="${bx + boxW / 2}" y="${y + 31}" text-anchor="middle" class="flowText">${esc(step)}</text>`;
    if (index < steps.length - 1) {
      svg += `<path d="M${bx + boxW + 4} ${y + boxH / 2}h${gap - 8}" stroke="#11b6b6" stroke-width="2" marker-end="url(#arrowTeal)"/>`;
    }
  });
  return svg;
}

let moduleSvg = "";
const startX = 86;
const startY = 238;
const colW = 390;
const nodeW = 340;
const nodeH = 78;

modules.forEach((group, groupIndex) => {
  const x = startX + groupIndex * 450;
  moduleSvg += `<text x="${x}" y="${startY - 34}" class="groupLabel">${esc(group.group)}</text>`;
  group.items.forEach(([title, subtitle], itemIndex) => {
    const tone = groupIndex === 0 ? "blue" : groupIndex === 1 ? "teal" : "gold";
    moduleSvg += node(x, startY + itemIndex * 98, nodeW, nodeH, title, subtitle, tone);
  });
});

const settingsX = startX + 2 * 450;
const settingsY = startY + 2 * 98 + 39;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1900" viewBox="0 0 1600 1900">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf8f1"/>
      <stop offset="1" stop-color="#eef7f5"/>
    </linearGradient>
    <linearGradient id="stroke" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#1d6bff"/>
      <stop offset="0.46" stop-color="#11b6b6"/>
      <stop offset="0.76" stop-color="#49b86f"/>
      <stop offset="1" stop-color="#b9974d"/>
    </linearGradient>
    <filter id="softShadow" x="-15%" y="-15%" width="130%" height="130%">
      <feDropShadow dx="0" dy="9" stdDeviation="9" flood-color="#0f172a" flood-opacity="0.1"/>
    </filter>
    <filter id="tinyShadow" x="-15%" y="-20%" width="130%" height="140%">
      <feDropShadow dx="0" dy="5" stdDeviation="5" flood-color="#0f172a" flood-opacity="0.08"/>
    </filter>
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#b9974d"/>
    </marker>
    <marker id="arrowTeal" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto">
      <path d="M0,0 L8,3 L0,6 Z" fill="#11b6b6"/>
    </marker>
    <style>
      .title{font-family:Inter,Arial,sans-serif;font-size:50px;font-weight:900;fill:#0f172a}
      .subtitle{font-family:Inter,Arial,sans-serif;font-size:20px;font-weight:600;fill:#52647d}
      .tag{font-family:Inter,Arial,sans-serif;font-size:14px;font-weight:900;letter-spacing:4px;fill:#b9974d}
      .groupLabel{font-family:Inter,Arial,sans-serif;font-size:22px;font-weight:900;letter-spacing:4px;fill:#0f172a;text-transform:uppercase}
      .nodeTitle{font-family:Inter,Arial,sans-serif;font-size:18px;font-weight:900;fill:#0f172a}
      .nodeText{font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:650;line-height:1.35;color:#52647d}
      .sectionTitle{font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:900;fill:#0f172a}
      .flowText{font-family:Inter,Arial,sans-serif;font-size:13px;font-weight:850;fill:#0f172a}
      .noteTitle{font-family:Inter,Arial,sans-serif;font-size:24px;font-weight:900;fill:#0f172a}
      .note{font-family:Inter,Arial,sans-serif;font-size:16px;font-weight:650;fill:#52647d}
    </style>
  </defs>

  <rect width="1600" height="1900" fill="url(#bg)"/>
  <text x="80" y="86" class="tag">HALL MANAGEMENT SAAS</text>
  <text x="80" y="146" class="title">Recommended Navigation Flow Chart</text>
  <text x="80" y="184" class="subtitle">How users move through the platform from dashboard navigation to operational workflows.</text>

  <rect x="80" y="218" width="1340" height="700" rx="28" fill="#ffffff" opacity="0.72" stroke="#e5e0d6"/>
  <text x="80" y="212" class="sectionTitle">Main Sidebar Modules</text>
  ${moduleSvg}

  ${arrow(startX + nodeW, startY + 39, startX + colW + 60, startY + 2 * 98 + 39)}
  ${arrow(startX + nodeW, startY + 3 * 98 + 39, startX + colW + 60, startY + 0 * 98 + 39)}
  ${arrow(startX + nodeW, startY + 4 * 98 + 39, startX + colW + 60, startY + 0 * 98 + 39)}
  ${arrow(startX + colW + 60 + nodeW, startY + 2 * 98 + 39, settingsX, settingsY)}

  <rect x="80" y="980" width="1440" height="590" rx="28" fill="#ffffff" opacity="0.78" stroke="#e5e0d6"/>
  <text x="104" y="1030" class="sectionTitle">Core Business Workflows</text>
  ${workflowRow(104, 1088, workflows[0].title, workflows[0].steps)}
  ${workflowRow(104, 1234, workflows[1].title, workflows[1].steps)}
  ${workflowRow(104, 1380, workflows[2].title, workflows[2].steps)}
  ${workflowRow(104, 1526, workflows[3].title, workflows[3].steps)}

  <rect x="80" y="1628" width="1440" height="190" rx="28" fill="#fffdf8" stroke="url(#stroke)" stroke-width="2" filter="url(#softShadow)"/>
  <text x="116" y="1680" class="noteTitle">Recommended Build Logic</text>
  <text x="116" y="1724" class="note">1. Calendar creates bookings. 2. Events become the main record. 3. Menu drives kitchen quantities. 4. Dining uses hall layouts. 5. Billing tracks invoices, payments, and bank review.</text>
  <text x="116" y="1766" class="note">Settings controls platform branding, halls, user roles, feature access, payments/Gmail, Google Calendar, PDF branding, and activity logs.</text>
</svg>`;

writeFileSync(svgPath, svg, "utf8");

const doc = await PDFDocument.create();
const page = doc.addPage([1600, 1900]);
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

page.drawRectangle({ x: 0, y: 0, width: 1600, height: 1900, color: rgb(0.969, 0.957, 0.929) });
page.drawText("Hall Management SaaS - Recommended Navigation Flow Chart", {
  x: 80,
  y: 1800,
  size: 42,
  font: bold,
  color: rgb(0.058, 0.09, 0.165),
});
page.drawText("Open the SVG version for the full visual flow chart. This PDF companion summarizes the same approved structure.", {
  x: 80,
  y: 1758,
  size: 18,
  font,
  color: rgb(0.29, 0.36, 0.48),
});

let y = 1690;
for (const group of modules) {
  page.drawText(group.group, { x: 80, y, size: 24, font: bold, color: rgb(0.725, 0.592, 0.302) });
  y -= 34;
  for (const [title, subtitle] of group.items) {
    page.drawText(`${title}: ${subtitle}`, { x: 110, y, size: 16, font, color: rgb(0.058, 0.09, 0.165) });
    y -= 24;
  }
  y -= 24;
}

y -= 20;
page.drawText("Core Workflows", { x: 80, y, size: 28, font: bold, color: rgb(0.058, 0.09, 0.165) });
y -= 42;
for (const flow of workflows) {
  page.drawText(`${flow.title}: ${flow.steps.join(" -> ")}`, { x: 110, y, size: 16, font, color: rgb(0.29, 0.36, 0.48) });
  y -= 34;
}

const pdfBytes = await doc.save();
writeFileSync(pdfPath, pdfBytes);

console.log(`Created ${svgPath}`);
console.log(`Created ${pdfPath}`);
