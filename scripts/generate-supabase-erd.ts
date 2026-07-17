import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { chromium } from "playwright";

type ColumnRow = {
  tableName: string;
  columnName: string;
  ordinalPosition: number;
  dataType: string;
  isNullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isUnique: boolean;
};

type ForeignKeyRow = {
  constraintName: string;
  sourceTable: string;
  sourceColumn: string;
  targetTable: string;
  targetColumn: string;
};

type TableInfo = {
  name: string;
  columns: ColumnRow[];
  group: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadEnvFile(filePath: string) {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([^#][^=]+)=(.*)$/);
    if (!match) continue;
    const name = match[1].trim();
    const value = match[2].trim().replace(/^"(.*)"$/, "$1");
    process.env[name] ??= value;
  }
}

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function csv(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

const groupDefinitions = [
  {
    name: "Organization & Access",
    color: "#245a82",
    tables: [
      "organizations",
      "users",
      "organization_memberships",
      "user_access",
      "organization_settings",
      "notification_preferences"
    ]
  },
  {
    name: "Bookings & Events",
    color: "#0f766e",
    tables: [
      "clients",
      "halls",
      "event_types",
      "events",
      "booking_reservations",
      "holiday_blocked_dates",
      "activity_logs"
    ]
  },
  {
    name: "Menu, Packages & Venue Setup",
    color: "#9a5b13",
    tables: [
      "menu_categories",
      "menu_items",
      "packages",
      "add_ons",
      "tablecloth_options",
      "member_shuls"
    ]
  },
  {
    name: "Kitchen & Operations",
    color: "#7c3f91",
    tables: [
      "kitchen_workers",
      "kitchen_item_statuses",
      "kitchen_notifications",
      "school_cycles"
    ]
  },
  {
    name: "Billing, Payments & Communication",
    color: "#a23535",
    tables: [
      "invoices",
      "payment_transactions",
      "payment_settings",
      "email_logs"
    ]
  },
  {
    name: "Files & Documents",
    color: "#4f5f73",
    tables: ["file_folders", "stored_files", "generated_pdfs"]
  },
  {
    name: "Vendors & Supporting Data",
    color: "#477037",
    tables: ["vendors"]
  }
];

function groupFor(tableName: string) {
  return (
    groupDefinitions.find((definition) => definition.tables.includes(tableName))
      ?.name ?? "Other Public Tables"
  );
}

function orderedGroups(tableNames: string[]) {
  const groups = groupDefinitions
    .map((definition) => ({
      ...definition,
      tables: definition.tables.filter((table) => tableNames.includes(table))
    }))
    .filter((definition) => definition.tables.length > 0);
  const known = new Set(groups.flatMap((group) => group.tables));
  const otherTables = tableNames.filter((name) => !known.has(name)).sort();
  if (otherTables.length > 0) {
    groups.push({
      name: "Other Public Tables",
      color: "#626b76",
      tables: otherTables
    });
  }
  return groups;
}

async function main() {
  loadEnvFile(path.resolve(".env.local"));
  loadEnvFile(path.resolve(".env"));
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required.");
  const connectionUrl = new URL(databaseUrl);
  if (
    connectionUrl.searchParams.get("sslmode") === "require" &&
    !connectionUrl.searchParams.has("uselibpqcompat")
  ) {
    connectionUrl.searchParams.set("uselibpqcompat", "true");
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: connectionUrl.toString() })
  });

  try {
    const columns = await prisma.$queryRaw<ColumnRow[]>`
      SELECT
        table_class.relname::text AS "tableName",
        attribute.attname::text AS "columnName",
        attribute.attnum::integer AS "ordinalPosition",
        pg_catalog.format_type(attribute.atttypid, attribute.atttypmod)::text AS "dataType",
        (NOT attribute.attnotnull)::boolean AS "isNullable",
        pg_catalog.pg_get_expr(default_value.adbin, default_value.adrelid)::text AS "defaultValue",
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_constraint AS primary_key
          WHERE primary_key.conrelid = table_class.oid
            AND primary_key.contype = 'p'
            AND attribute.attnum = ANY(primary_key.conkey)
        )::boolean AS "isPrimaryKey",
        EXISTS (
          SELECT 1
          FROM pg_catalog.pg_constraint AS unique_key
          WHERE unique_key.conrelid = table_class.oid
            AND unique_key.contype = 'u'
            AND array_length(unique_key.conkey, 1) = 1
            AND attribute.attnum = ANY(unique_key.conkey)
        )::boolean AS "isUnique"
      FROM pg_catalog.pg_class AS table_class
      JOIN pg_catalog.pg_namespace AS namespace
        ON namespace.oid = table_class.relnamespace
      JOIN pg_catalog.pg_attribute AS attribute
        ON attribute.attrelid = table_class.oid
      LEFT JOIN pg_catalog.pg_attrdef AS default_value
        ON default_value.adrelid = table_class.oid
       AND default_value.adnum = attribute.attnum
      WHERE namespace.nspname = 'public'
        AND table_class.relkind IN ('r', 'p')
        AND attribute.attnum > 0
        AND NOT attribute.attisdropped
      ORDER BY table_class.relname, attribute.attnum
    `;

    const foreignKeys = await prisma.$queryRaw<ForeignKeyRow[]>`
      SELECT
        constraint_record.conname::text AS "constraintName",
        source_table.relname::text AS "sourceTable",
        source_attribute.attname::text AS "sourceColumn",
        target_table.relname::text AS "targetTable",
        target_attribute.attname::text AS "targetColumn"
      FROM pg_catalog.pg_constraint AS constraint_record
      JOIN pg_catalog.pg_class AS source_table
        ON source_table.oid = constraint_record.conrelid
      JOIN pg_catalog.pg_namespace AS source_namespace
        ON source_namespace.oid = source_table.relnamespace
      JOIN pg_catalog.pg_class AS target_table
        ON target_table.oid = constraint_record.confrelid
      CROSS JOIN LATERAL generate_subscripts(constraint_record.conkey, 1) AS key_position
      JOIN pg_catalog.pg_attribute AS source_attribute
        ON source_attribute.attrelid = source_table.oid
       AND source_attribute.attnum = constraint_record.conkey[key_position]
      JOIN pg_catalog.pg_attribute AS target_attribute
        ON target_attribute.attrelid = target_table.oid
       AND target_attribute.attnum = constraint_record.confkey[key_position]
      WHERE constraint_record.contype = 'f'
        AND source_namespace.nspname = 'public'
      ORDER BY source_table.relname, constraint_record.conname, key_position
    `;

    const tableMap = new Map<string, TableInfo>();
    for (const column of columns) {
      const current = tableMap.get(column.tableName) ?? {
        name: column.tableName,
        columns: [],
        group: groupFor(column.tableName),
        x: 0,
        y: 0,
        width: 350,
        height: 0
      };
      current.columns.push(column);
      tableMap.set(column.tableName, current);
    }

    const tables = [...tableMap.values()];
    const groups = orderedGroups(tables.map(({ name }) => name));
    const foreignKeyByColumn = new Map(
      foreignKeys.map((foreignKey) => [
        `${foreignKey.sourceTable}.${foreignKey.sourceColumn}`,
        foreignKey
      ])
    );

    const canvasWidth = 1560;
    const outerMargin = 42;
    const groupPadding = 24;
    const groupTitleHeight = 48;
    const columnGap = 24;
    const rowGap = 24;
    const tableWidth = 350;
    const tableHeaderHeight = 42;
    const columnHeight = 25;
    const columnsPerRow = 4;
    let cursorY = 132;
    const groupBoxes: Array<{
      name: string;
      color: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }> = [];

    for (const group of groups) {
      const groupTables = group.tables
        .map((name) => tableMap.get(name))
        .filter((table): table is TableInfo => Boolean(table));
      const rowCount = Math.ceil(groupTables.length / columnsPerRow);
      const rowHeights: number[] = [];
      for (let row = 0; row < rowCount; row += 1) {
        const members = groupTables.slice(
          row * columnsPerRow,
          (row + 1) * columnsPerRow
        );
        rowHeights.push(
          Math.max(
            ...members.map(
              (table) =>
                tableHeaderHeight + table.columns.length * columnHeight + 10
            )
          )
        );
      }
      const groupHeight =
        groupTitleHeight +
        groupPadding +
        rowHeights.reduce((sum, height) => sum + height, 0) +
        Math.max(0, rowCount - 1) * rowGap +
        groupPadding;
      groupBoxes.push({
        name: group.name,
        color: group.color,
        x: outerMargin,
        y: cursorY,
        width: canvasWidth - outerMargin * 2,
        height: groupHeight
      });

      let rowY = cursorY + groupTitleHeight + groupPadding;
      groupTables.forEach((table, index) => {
        const row = Math.floor(index / columnsPerRow);
        const column = index % columnsPerRow;
        if (row > 0 && index % columnsPerRow === 0) {
          rowY += rowHeights[row - 1] + rowGap;
        }
        table.x =
          outerMargin + groupPadding + column * (tableWidth + columnGap);
        table.y = rowY;
        table.width = tableWidth;
        table.height =
          tableHeaderHeight + table.columns.length * columnHeight + 10;
      });
      cursorY += groupHeight + 28;
    }

    const canvasHeight = cursorY + 28;
    const generatedAt = new Date().toISOString();
    const svg: string[] = [];
    svg.push(
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasWidth}" height="${canvasHeight}" viewBox="0 0 ${canvasWidth} ${canvasHeight}" role="img" aria-labelledby="title description">`,
      `<title id="title">Hall Management SaaS Platform — Complete Database ERD</title>`,
      `<desc id="description">Complete public Supabase schema with ${tables.length} tables, ${columns.length} columns, and ${foreignKeys.length} foreign-key relationships.</desc>`,
      `<defs>`,
      `<filter id="shadow" x="-10%" y="-10%" width="120%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="#17202a" flood-opacity="0.12"/></filter>`,
      `<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#8ca0b3"/></marker>`,
      `<style>text{font-family:Inter,Segoe UI,Arial,sans-serif}.table-title{font-size:14px;font-weight:700;fill:#fff}.column{font-size:10.5px;fill:#253343}.type{font-size:9.5px;fill:#68788b}.badge{font-size:8px;font-weight:700}.group-title{font-size:17px;font-weight:800;fill:#fff}.subtitle{font-size:12px;fill:#66768a}.relation{fill:none;stroke:#93a5b6;stroke-width:1.2;stroke-opacity:.55;marker-end:url(#arrow)}.relation:hover{stroke:#d97706;stroke-width:2.5;stroke-opacity:1}</style>`,
      `</defs>`,
      `<rect width="100%" height="100%" fill="#f5f7fa"/>`,
      `<text x="42" y="48" font-size="27" font-weight="800" fill="#17202a">Hall Management SaaS Platform</text>`,
      `<text x="42" y="76" font-size="18" font-weight="700" fill="#245a82">Complete Supabase Database ERD — public schema</text>`,
      `<text x="42" y="102" class="subtitle">${tables.length} tables • ${columns.length} columns • ${foreignKeys.length} foreign-key relationships • Generated ${escapeXml(generatedAt)}</text>`,
      `<g id="groups">`
    );

    for (const box of groupBoxes) {
      svg.push(
        `<rect x="${box.x}" y="${box.y}" width="${box.width}" height="${box.height}" rx="16" fill="#ffffff" stroke="${box.color}" stroke-width="1.5"/>`,
        `<path d="M ${box.x + 16} ${box.y} H ${box.x + box.width - 16} Q ${box.x + box.width} ${box.y} ${box.x + box.width} ${box.y + 16} V ${box.y + groupTitleHeight} H ${box.x} V ${box.y + 16} Q ${box.x} ${box.y} ${box.x + 16} ${box.y} Z" fill="${box.color}"/>`,
        `<text x="${box.x + 20}" y="${box.y + 31}" class="group-title">${escapeXml(box.name)}</text>`
      );
    }
    svg.push(`</g>`, `<g id="relationships">`);

    for (const foreignKey of foreignKeys) {
      const source = tableMap.get(foreignKey.sourceTable);
      const target = tableMap.get(foreignKey.targetTable);
      if (!source || !target) continue;
      const sourceColumnIndex = source.columns.findIndex(
        ({ columnName }) => columnName === foreignKey.sourceColumn
      );
      const targetColumnIndex = target.columns.findIndex(
        ({ columnName }) => columnName === foreignKey.targetColumn
      );
      const sourceY =
        source.y +
        tableHeaderHeight +
        sourceColumnIndex * columnHeight +
        columnHeight / 2;
      const targetY =
        target.y +
        tableHeaderHeight +
        targetColumnIndex * columnHeight +
        columnHeight / 2;
      const sourceIsLeft = source.x <= target.x;
      const sourceX = sourceIsLeft ? source.x + source.width : source.x;
      const targetX = sourceIsLeft ? target.x : target.x + target.width;
      const bend = Math.max(35, Math.abs(targetX - sourceX) * 0.34);
      const pathData = `M ${sourceX} ${sourceY} C ${sourceX + (sourceIsLeft ? bend : -bend)} ${sourceY}, ${targetX + (sourceIsLeft ? -bend : bend)} ${targetY}, ${targetX} ${targetY}`;
      svg.push(
        `<path class="relation" d="${pathData}"><title>${escapeXml(`${foreignKey.sourceTable}.${foreignKey.sourceColumn} → ${foreignKey.targetTable}.${foreignKey.targetColumn}`)}</title></path>`
      );
    }
    svg.push(`</g>`, `<g id="tables">`);

    for (const table of tables) {
      const group = groups.find(({ name }) => name === table.group);
      const color = group?.color ?? "#626b76";
      svg.push(
        `<g id="table-${escapeXml(table.name)}" filter="url(#shadow)">`,
        `<rect x="${table.x}" y="${table.y}" width="${table.width}" height="${table.height}" rx="9" fill="#fff" stroke="#c7d1dc"/>`,
        `<path d="M ${table.x + 9} ${table.y} H ${table.x + table.width - 9} Q ${table.x + table.width} ${table.y} ${table.x + table.width} ${table.y + 9} V ${table.y + tableHeaderHeight} H ${table.x} V ${table.y + 9} Q ${table.x} ${table.y} ${table.x + 9} ${table.y} Z" fill="${color}"/>`,
        `<text x="${table.x + 14}" y="${table.y + 27}" class="table-title">${escapeXml(table.name)}</text>`
      );
      table.columns.forEach((column, index) => {
        const y = table.y + tableHeaderHeight + index * columnHeight;
        const foreignKey = foreignKeyByColumn.get(
          `${table.name}.${column.columnName}`
        );
        if (index % 2 === 1) {
          svg.push(
            `<rect x="${table.x + 1}" y="${y}" width="${table.width - 2}" height="${columnHeight}" fill="#f7f9fb"/>`
          );
        }
        let badgeX = table.x + 10;
        if (column.isPrimaryKey) {
          svg.push(
            `<rect x="${badgeX}" y="${y + 6}" width="20" height="13" rx="3" fill="#fff1c7"/><text x="${badgeX + 4}" y="${y + 16}" class="badge" fill="#8b5a00">PK</text>`
          );
          badgeX += 24;
        }
        if (foreignKey) {
          svg.push(
            `<rect x="${badgeX}" y="${y + 6}" width="20" height="13" rx="3" fill="#dcecff"/><text x="${badgeX + 4}" y="${y + 16}" class="badge" fill="#245a82">FK</text>`
          );
          badgeX += 24;
        }
        if (column.isUnique && !column.isPrimaryKey) {
          svg.push(
            `<rect x="${badgeX}" y="${y + 6}" width="18" height="13" rx="3" fill="#e5f5e2"/><text x="${badgeX + 4}" y="${y + 16}" class="badge" fill="#477037">UQ</text>`
          );
          badgeX += 22;
        }
        svg.push(
          `<text x="${badgeX}" y="${y + 17}" class="column">${escapeXml(column.columnName)}</text>`,
          `<text x="${table.x + table.width - 10}" y="${y + 17}" text-anchor="end" class="type">${escapeXml(column.dataType)}${column.isNullable ? " ?" : ""}</text>`
        );
      });
      svg.push(`</g>`);
    }
    svg.push(`</g>`, `</svg>`);

    const outputDirectory = path.resolve("client-handoff");
    mkdirSync(outputDirectory, { recursive: true });
    const svgPath = path.join(
      outputDirectory,
      "hall-management-full-database-erd.svg"
    );
    const csvPath = path.join(
      outputDirectory,
      "hall-management-database-dictionary.csv"
    );
    const htmlPath = path.join(
      outputDirectory,
      "hall-management-full-database-erd.html"
    );
    const svgDocument = svg.join("\n");
    writeFileSync(svgPath, svgDocument, "utf8");

    const csvRows = [
      [
        "group",
        "table_name",
        "column_position",
        "column_name",
        "postgres_type",
        "nullable",
        "default",
        "primary_key",
        "unique",
        "foreign_key_reference"
      ]
        .map(csv)
        .join(","),
      ...columns.map((column) => {
        const foreignKey = foreignKeyByColumn.get(
          `${column.tableName}.${column.columnName}`
        );
        return [
          groupFor(column.tableName),
          column.tableName,
          column.ordinalPosition,
          column.columnName,
          column.dataType,
          column.isNullable ? "YES" : "NO",
          column.defaultValue,
          column.isPrimaryKey ? "YES" : "NO",
          column.isUnique ? "YES" : "NO",
          foreignKey
            ? `${foreignKey.targetTable}.${foreignKey.targetColumn}`
            : ""
        ]
          .map(csv)
          .join(",");
      })
    ];
    writeFileSync(csvPath, `${csvRows.join("\r\n")}\r\n`, "utf8");

    const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Hall Management SaaS Platform — Complete Database ERD</title>
  <style>
    html,body{margin:0;background:#e9edf2;font-family:Inter,Segoe UI,Arial,sans-serif}
    header{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 18px;background:#17202a;color:#fff;box-shadow:0 2px 10px #0003}
    header strong{font-size:14px} header span{font-size:12px;color:#c9d5e0}
    main{padding:18px} img{display:block;width:100%;height:auto;background:#fff;box-shadow:0 8px 30px #17202a22}
    @media print{header{display:none}main{padding:0}img{box-shadow:none}}
  </style>
</head>
<body>
  <header><strong>Complete Supabase Database ERD</strong><span>Use browser zoom to inspect • Print to PDF for client delivery</span></header>
  <main><img src="hall-management-full-database-erd.svg" alt="Complete database entity relationship diagram" /></main>
</body>
</html>`;
    writeFileSync(htmlPath, html, "utf8");

    const pngPath = path.join(
      outputDirectory,
      "hall-management-full-database-erd.png"
    );
    const pdfPath = path.join(
      outputDirectory,
      "hall-management-full-database-erd.pdf"
    );
    const installedBrowserPaths = [
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"
    ];
    const executablePath = installedBrowserPaths.find((candidate) =>
      existsSync(candidate)
    );
    const browser = await chromium.launch({ headless: true, executablePath });
    try {
      const page = await browser.newPage({
        viewport: { width: canvasWidth, height: 900 },
        deviceScaleFactor: 1.5
      });
      await page.setContent(
        `<style>html,body{margin:0;padding:0;background:#f5f7fa}svg{display:block}@page{size:${canvasWidth}px ${canvasHeight}px;margin:0}</style>${svgDocument}`,
        { waitUntil: "load" }
      );
      await page.screenshot({ path: pngPath, fullPage: true });
      await page.pdf({
        path: pdfPath,
        width: `${canvasWidth}px`,
        height: `${canvasHeight}px`,
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" }
      });
    } finally {
      await browser.close();
    }

    console.log(
      JSON.stringify(
        {
          tables: tables.length,
          columns: columns.length,
          foreignKeys: foreignKeys.length,
          canvas: `${canvasWidth}x${canvasHeight}`,
          files: [svgPath, pngPath, pdfPath, htmlPath, csvPath]
        },
        null,
        2
      )
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
