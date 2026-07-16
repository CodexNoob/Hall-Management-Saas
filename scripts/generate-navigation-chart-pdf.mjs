import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { writeFile } from "node:fs/promises";

const outputPath = "docs/hall-management-saas-recommended-navigation-chart.pdf";

const colors = {
  navy: rgb(0.058, 0.09, 0.165),
  blueGray: rgb(0.29, 0.36, 0.48),
  muted: rgb(0.42, 0.48, 0.58),
  gold: rgb(0.725, 0.592, 0.302),
  cream: rgb(0.969, 0.957, 0.929),
  line: rgb(0.85, 0.87, 0.9),
  white: rgb(1, 1, 1),
};

const doc = await PDFDocument.create();
const font = await doc.embedFont(StandardFonts.Helvetica);
const bold = await doc.embedFont(StandardFonts.HelveticaBold);

const pageSize = [612, 792];
const margin = 48;
const contentWidth = pageSize[0] - margin * 2;
let page;
let y;

function addPage() {
  page = doc.addPage(pageSize);
  y = pageSize[1] - margin;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: pageSize[0],
    height: pageSize[1],
    color: colors.cream,
  });

  page.drawText("Hall Management SaaS", {
    x: margin,
    y: pageSize[1] - 30,
    size: 10,
    font: bold,
    color: colors.gold,
  });

  page.drawText("Function & Navigation Chart", {
    x: pageSize[0] - margin - 160,
    y: pageSize[1] - 30,
    size: 9,
    font,
    color: colors.muted,
  });
}

function ensureSpace(height) {
  if (y - height < margin) {
    addPage();
  }
}

function wrapText(text, size, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      if (current) lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function paragraph(text, options = {}) {
  const size = options.size ?? 10;
  const lineHeight = options.lineHeight ?? 15;
  const usedFont = options.bold ? bold : font;
  const color = options.color ?? colors.blueGray;
  const lines = wrapText(text, size, options.width ?? contentWidth);
  ensureSpace(lines.length * lineHeight + 4);

  for (const line of lines) {
    page.drawText(line, {
      x: options.x ?? margin,
      y,
      size,
      font: usedFont,
      color,
    });
    y -= lineHeight;
  }

  y -= options.after ?? 4;
}

function title(text) {
  ensureSpace(72);
  page.drawText(text, {
    x: margin,
    y,
    size: 28,
    font: bold,
    color: colors.navy,
  });
  y -= 36;
}

function subtitle(text) {
  paragraph(text, { size: 11, lineHeight: 16, color: colors.blueGray, after: 14 });
}

function section(text) {
  ensureSpace(38);
  y -= 4;
  page.drawText(text, {
    x: margin,
    y,
    size: 16,
    font: bold,
    color: colors.navy,
  });
  y -= 8;
  page.drawLine({
    start: { x: margin, y },
    end: { x: margin + contentWidth, y },
    thickness: 1,
    color: colors.gold,
  });
  y -= 18;
}

function bullet(text, level = 0) {
  const x = margin + level * 18;
  const bulletX = x;
  const textX = x + 14;
  const size = 10;
  const lineHeight = 14;
  const lines = wrapText(text, size, contentWidth - level * 18 - 14);
  ensureSpace(lines.length * lineHeight + 2);

  page.drawText("-", {
    x: bulletX,
    y,
    size,
    font: bold,
    color: colors.gold,
  });

  lines.forEach((line, index) => {
    page.drawText(line, {
      x: textX,
      y: y - index * lineHeight,
      size,
      font,
      color: colors.blueGray,
    });
  });

  y -= lines.length * lineHeight + 2;
}

function card(titleText, items) {
  const lineHeight = 14;
  const wrapped = items.flatMap((item) => wrapText(item, 9.5, contentWidth - 44));
  const height = 42 + wrapped.length * lineHeight;
  ensureSpace(height + 12);

  page.drawRectangle({
    x: margin,
    y: y - height + 12,
    width: contentWidth,
    height,
    color: colors.white,
    borderColor: colors.line,
    borderWidth: 1,
  });

  page.drawText(titleText, {
    x: margin + 16,
    y: y - 12,
    size: 13,
    font: bold,
    color: colors.navy,
  });

  let innerY = y - 34;
  for (const item of items) {
    const lines = wrapText(item, 9.5, contentWidth - 44);
    page.drawText("-", {
      x: margin + 18,
      y: innerY,
      size: 9.5,
      font: bold,
      color: colors.gold,
    });
    lines.forEach((line, index) => {
      page.drawText(line, {
        x: margin + 32,
        y: innerY - index * lineHeight,
        size: 9.5,
        font,
        color: colors.blueGray,
      });
    });
    innerY -= lines.length * lineHeight;
  }

  y -= height + 10;
}

function twoColumnList(leftTitle, leftItems, rightTitle, rightItems) {
  const gap = 18;
  const colWidth = (contentWidth - gap) / 2;
  const leftLines = leftItems.flatMap((item) => wrapText(item, 9, colWidth - 28)).length;
  const rightLines = rightItems.flatMap((item) => wrapText(item, 9, colWidth - 28)).length;
  const height = 34 + Math.max(leftLines, rightLines) * 13;
  ensureSpace(height + 12);

  function drawColumn(x, titleText, items) {
    page.drawRectangle({
      x,
      y: y - height + 10,
      width: colWidth,
      height,
      color: colors.white,
      borderColor: colors.line,
      borderWidth: 1,
    });
    page.drawText(titleText, {
      x: x + 12,
      y: y - 12,
      size: 12,
      font: bold,
      color: colors.navy,
    });
    let rowY = y - 31;
    for (const item of items) {
      const lines = wrapText(item, 9, colWidth - 28);
      page.drawText("-", { x: x + 12, y: rowY, size: 9, font: bold, color: colors.gold });
      lines.forEach((line, index) => {
        page.drawText(line, { x: x + 24, y: rowY - index * 13, size: 9, font, color: colors.blueGray });
      });
      rowY -= lines.length * 13;
    }
  }

  drawColumn(margin, leftTitle, leftItems);
  drawColumn(margin + colWidth + gap, rightTitle, rightItems);
  y -= height + 12;
}

function workflow(titleText, steps) {
  card(titleText, steps.map((step, index) => `${index + 1}. ${step}`));
}

addPage();

title("Hall Management SaaS");
page.drawText("Recommended Function & Navigation Chart", {
  x: margin,
  y,
  size: 18,
  font: bold,
  color: colors.gold,
});
y -= 28;
subtitle(
  "Senior developer recommended structure for the production Hall Management SaaS platform. This chart separates the software into clear business modules before backend implementation begins."
);

section("Recommended Main Navigation");
card("Main Menu / Dashboard", [
  "Daily operating overview",
  "Upcoming events",
  "Attention needed",
  "Quick actions",
]);
card("Bookings & Calendar", [
  "Calendar View",
  "New Booking",
  "Holds",
  "Full Dates",
  "Availability",
  "Google Calendar Sync",
]);
card("Events", [
  "Event Manager",
  "Event Details",
  "Client Information",
  "Event Status",
  "Event Menu",
  "Event Payments",
  "Event Files",
  "Event PDFs",
]);
card("Kitchen Operations", [
  "Kitchen Dashboard",
  "Today",
  "This Week",
  "4 Weeks",
  "Prep Items",
  "Worker Assignments",
  "Kitchen Sheet PDF",
]);
card("Dining & Layout", [
  "Dining Manager",
  "Seating Layout",
  "Table Setup",
  "Waiter Count",
  "Hall Room Map",
  "Hall Layout Presets",
]);
card("Menu Management", [
  "Menu Items",
  "Packages",
  "Add-ons",
  "Hall Menu Rules",
  "Quantity Rules",
]);
card("Billing & Payments", [
  "Billing Dashboard",
  "Transactions",
  "Invoices",
  "Event Billing",
  "Payment Emails",
  "Payment Status",
  "Bank Review",
]);
card("Clients", [
  "Client List",
  "Clients",
  "Client Events",
  "Client Payments",
  "Client Documents",
]);
card("Staff & Vendors", [
  "Staff",
  "Workers",
  "Kitchen Workers",
  "Assignments",
  "Vendors",
]);
card("Reports", [
  "Revenue Reports",
  "Booking Reports",
  "Hall Performance",
  "Kitchen Reports",
  "Payment Reports",
]);
card("Settings", [
  "Platform Settings",
  "Halls",
  "Hall Performance Rules",
  "User Types / Role Templates",
  "User Access",
  "Feature Access Control",
  "Payments / Gmail",
  "Google Calendar",
  "PDF / Branding Settings",
  "Activity Logs",
]);

section("Recommended Sidebar");
twoColumnList(
  "Workspace",
  ["01 Dashboard", "02 Calendar", "03 Events", "04 Kitchen", "05 Menu", "06 Clients"],
  "Operations",
  ["07 Dining Manager", "08 Hall Room Map", "09 Billing", "10 Reports"]
);
card("Office", ["11 Staff", "12 Vendors", "13 Settings"]);

section("Why This Structure Is Better");
bullet("Calendar and Bookings are grouped because booking starts from date availability.");
bullet("Events becomes the main record center after a booking is created.");
bullet("Kitchen, Dining, and Menu are separated because they are different operational workflows.");
bullet("Billing is its own module because payments, invoices, bank review, and transaction posting are complex.");
bullet("Clients deserves its own module, not only a portal.");
bullet("Reports should be separate from Dashboard. Dashboard is daily operations; Reports are business analysis.");
bullet("Settings stays focused on configuration, roles, permissions, integrations, and branding.");

section("Core Business Workflows");
workflow("Booking Flow", [
  "Check date availability in Calendar.",
  "Create a new booking.",
  "Select client, hall, event type, date, and time.",
  "Set event status: hold, confirmed, cancelled, or completed.",
  "Attach menu, package, add-ons, and event notes.",
  "Create payment or invoice record.",
  "Sync event to Google Calendar.",
  "Generate kitchen, dining, or event PDF when needed.",
]);
workflow("Kitchen Flow", [
  "Confirmed event appears in Kitchen Operations.",
  "Menu items generate prep quantities.",
  "Kitchen manager reviews Today, This Week, and 4 Weeks views.",
  "Workers are assigned to prep items.",
  "Item statuses are updated.",
  "Kitchen sheet PDF is generated.",
]);
workflow("Billing Flow", [
  "Invoice or payment balance is created from event.",
  "Payment email can be sent through Gmail.",
  "Client pays through external payment link.",
  "Staff confirms payment result.",
  "Transaction is reviewed and posted.",
  "Payment status updates on the event.",
]);
workflow("Dining & Layout Flow", [
  "Select event in Dining Manager.",
  "Load hall layout from Hall Room Map.",
  "Adjust seating, tables, and waiter count.",
  "Save dining setup.",
  "Generate dining sheet.",
]);

section("Suggested Build Phases");
card("Phase 1 - Planning Approval", [
  "Approve function and navigation chart.",
  "Approve role and permission structure.",
  "Approve database schema and module priorities.",
]);
card("Phase 2 - Core Platform", [
  "Authentication",
  "User sync",
  "Roles and feature access",
  "Halls",
  "Calendar",
  "Event Manager",
]);
card("Phase 3 - Operations", [
  "Kitchen Dashboard",
  "Menu Management",
  "Dining Manager",
  "Hall Room Map",
  "Staff assignments",
]);
card("Phase 4 - Finance and Integrations", [
  "Billing Dashboard",
  "Invoices",
  "Payment email flow",
  "Google Calendar sync",
  "PDF generation",
  "File uploads",
  "Activity logs",
]);
card("Phase 5 - Clients and Polish", [
  "Client portal",
  "Reports",
  "Mobile responsiveness",
  "Testing",
  "Deployment",
]);

section("Client Approval Notes");
paragraph(
  "Recommended next step: send this navigation chart to the client and ask for approval of module names, sidebar order, role access expectations, and which modules should be included in the first production release.",
  { size: 11, lineHeight: 16, color: colors.blueGray }
);

const pages = doc.getPages();
pages.forEach((pdfPage, index) => {
  pdfPage.drawText(`Page ${index + 1} of ${pages.length}`, {
    x: pageSize[0] - margin - 70,
    y: 24,
    size: 8,
    font,
    color: colors.muted,
  });
});

const pdfBytes = await doc.save();
await writeFile(outputPath, pdfBytes);
console.log(outputPath);
