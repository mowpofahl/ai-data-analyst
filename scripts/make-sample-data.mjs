// Generates public/samples/sales.csv: a fictional store's orders for 2025,
// with a few deliberate data quality issues so the warnings have something to show.
import { writeFileSync } from "node:fs";

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

const regions = ["Midwest", "Northeast", "South", "West"];
const segments = ["Consumer", "Small Business", "Enterprise"];
const products = {
  Electronics: [["Wireless Headphones", 89], ["Bluetooth Speaker", 59], ["Laptop Stand", 39], ["USB-C Hub", 45]],
  Furniture: [["Office Chair", 229], ["Standing Desk", 449], ["Bookshelf", 129]],
  "Office Supplies": [["Notebook Pack", 12], ["Gel Pens (12)", 9], ["Desk Organizer", 24], ["Printer Paper", 35]],
};
const regionBoost = { Midwest: 1.0, Northeast: 1.15, South: 0.9, West: 1.25 };

const rows = [];
for (let i = 1; i <= 2400; i++) {
  const month = Math.floor(rand() * 12);
  const day = 1 + Math.floor(rand() * 28);
  const date = new Date(Date.UTC(2025, month, day)).toISOString().slice(0, 10);
  const category = pick(Object.keys(products));
  const [product, price] = pick(products[category]);
  const region = pick(regions);
  const segment = pick(segments);
  const seasonal = month >= 10 ? 1.6 : 1; // holiday bump
  let units = Math.max(1, Math.round((1 + rand() * 4) * regionBoost[region] * seasonal * (segment === "Enterprise" ? 3 : 1)));
  if (i === 777) units = 250; // one bulk order outlier
  const discount = rand() < 0.3 ? pick([0.05, 0.1, 0.15, 0.2]) : 0;
  const revenue = +(units * price * (1 - discount)).toFixed(2);
  rows.push({
    order_id: `ORD-${String(i).padStart(5, "0")}`,
    order_date: date,
    region,
    customer_segment: segment,
    category,
    product,
    units,
    unit_price: price,
    discount: rand() < 0.04 ? "" : discount, // ~4% missing discounts
    revenue,
  });
}
// A few exact duplicate rows, as if an export ran twice.
for (const i of [10, 250, 900, 1500, 2100, 2300]) rows.push({ ...rows[i] });

const header = Object.keys(rows[0]);
const csv = [header.join(","), ...rows.map((r) => header.map((h) => r[h]).join(","))].join("\n") + "\n";
writeFileSync(new URL("../public/samples/sales.csv", import.meta.url), csv);
console.log(`Wrote ${rows.length} rows`);
