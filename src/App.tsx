import { useMemo, useState } from "react";
import {
  ArrowDownLeft, ArrowDownRight, ArrowUpRight, BarChart3, Bell, ChevronDown,
  CircleHelp, ClipboardList, Download, FileText, LayoutDashboard, Menu, Package,
  Plus, Search, Settings2, ShoppingBag, TrendingUp, X, Check, CalendarDays,
} from "lucide-react";
import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType } from "docx";
import { saveAs } from "file-saver";

type Product = { id: string; name: string; unit: string; price: number; category: string };
type Sale = { id: string; productId: string; productName: string; quantity: number; unitPrice: number; soldAt: string; employee: string };
type ReturnRecord = { id: string; productName: string; quantity: number; returnedAt: string; reason: string };
type Page = "Overview" | "Sales" | "Products" | "Returns" | "Reports";

const initialProducts: Product[] = [
  { id: "p1", name: "Milk — 500ml", unit: "bottle", price: 12, category: "Dairy" },
  { id: "p2", name: "White Bread", unit: "loaf", price: 18, category: "Bakery" },
  { id: "p3", name: "Mineral Water", unit: "bottle", price: 8, category: "Drinks" },
  { id: "p4", name: "Cooking Oil — 2L", unit: "bottle", price: 65, category: "Groceries" },
];
const today = new Date().toISOString().slice(0, 10);
const initialSales: Sale[] = [
  { id: "s1", productId: "p1", productName: "Milk — 500ml", quantity: 24, unitPrice: 12, soldAt: today, employee: "Chanda M." },
  { id: "s2", productId: "p2", productName: "White Bread", quantity: 12, unitPrice: 18, soldAt: today, employee: "Chanda M." },
  { id: "s3", productId: "p3", productName: "Mineral Water", quantity: 36, unitPrice: 8, soldAt: today, employee: "Chanda M." },
  { id: "s4", productId: "p1", productName: "Milk — 500ml", quantity: 18, unitPrice: 12, soldAt: today, employee: "Chanda M." },
];
const initialReturns: ReturnRecord[] = [
  { id: "r1", productName: "White Bread", quantity: 2, returnedAt: today, reason: "Customer return" },
];

const money = (value: number) => new Intl.NumberFormat("en-ZM", { style: "currency", currency: "ZMW", maximumFractionDigits: 2 }).format(value);
const dateLabel = (value: string) => new Date(value + "T12:00:00").toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });

function App() {
  const [page, setPage] = useState<Page>("Overview");
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sales, setSales] = useState<Sale[]>(initialSales);
  const [returns, setReturns] = useState<ReturnRecord[]>(initialReturns);
  const [search, setSearch] = useState("");
  const [showSaleForm, setShowSaleForm] = useState(false);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showReturnForm, setShowReturnForm] = useState(false);
  const [notice, setNotice] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [reportMonth, setReportMonth] = useState(today.slice(0, 7));
  const [saleProduct, setSaleProduct] = useState(initialProducts[0].id);
  const [saleQty, setSaleQty] = useState("1");
  const [salePrice, setSalePrice] = useState(String(initialProducts[0].price));
  const [saleDate, setSaleDate] = useState(today);
  const [saleEmployee, setSaleEmployee] = useState("Chanda M.");
  const [newName, setNewName] = useState("");
  const [newUnit, setNewUnit] = useState("unit");
  const [newPrice, setNewPrice] = useState("");
  const [newCategory, setNewCategory] = useState("General");
  const [returnProduct, setReturnProduct] = useState(initialProducts[0].id);
  const [returnQty, setReturnQty] = useState("1");
  const [returnDate, setReturnDate] = useState(today);
  const [returnReason, setReturnReason] = useState("");

  const thisMonthSales = useMemo(() => sales.filter((s) => s.soldAt.slice(0, 7) === reportMonth), [sales, reportMonth]);
  const monthValue = thisMonthSales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
  const monthUnits = thisMonthSales.reduce((sum, sale) => sum + sale.quantity, 0);
  const todaySales = sales.filter((s) => s.soldAt === today);
  const todayValue = todaySales.reduce((sum, sale) => sum + sale.quantity * sale.unitPrice, 0);
  const filteredSales = sales.filter((s) => (s.productName + s.employee + s.soldAt).toLowerCase().includes(search.toLowerCase()));
  const filteredProducts = products.filter((p) => (p.name + p.category).toLowerCase().includes(search.toLowerCase()));
  const reportProducts = products.map((p) => ({
    ...p,
    units: thisMonthSales.filter((s) => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0),
    value: thisMonthSales.filter((s) => s.productId === p.id).reduce((sum, s) => sum + s.quantity * s.unitPrice, 0),
  })).filter((p) => p.units > 0 || p.value > 0);

  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3200);
  }

  function handleSaleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((p) => p.id === saleProduct);
    const quantity = Number(saleQty);
    const unitPrice = Number(salePrice);
    if (!product || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0 || !saleEmployee.trim()) {
      notify("Check the sale details and try again.");
      return;
    }
    setSales((current) => [{ id: crypto.randomUUID(), productId: product.id, productName: product.name, quantity, unitPrice, soldAt: saleDate, employee: saleEmployee.trim() }, ...current]);
    setShowSaleForm(false);
    setSaleQty("1");
    notify("Sale recorded in this prototype.");
  }

  function handleProductSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!newName.trim() || !newUnit.trim() || Number(newPrice) < 0 || newPrice === "") {
      notify("Add a product name, unit and valid price.");
      return;
    }
    const product = { id: crypto.randomUUID(), name: newName.trim(), unit: newUnit.trim(), price: Number(newPrice), category: newCategory.trim() || "General" };
    setProducts((current) => [...current, product]);
    setSaleProduct(product.id);
    setSalePrice(String(product.price));
    setReturnProduct(product.id);
    setShowProductForm(false);
    setNewName("");
    setNewPrice("");
    notify("Product added in this prototype.");
  }

  function handleReturnSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const product = products.find((p) => p.id === returnProduct);
    const quantity = Number(returnQty);
    if (!product || !Number.isFinite(quantity) || quantity <= 0) {
      notify("Choose a product and enter a valid quantity.");
      return;
    }
    setReturns((current) => [{ id: crypto.randomUUID(), productName: product.name, quantity, returnedAt: returnDate, reason: returnReason.trim() || "Not specified" }, ...current]);
    setShowReturnForm(false);
    setReturnQty("1");
    setReturnReason("");
    notify("Return recorded separately from sales.");
  }

  function reportText() {
    const label = new Date(reportMonth + "-15T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    const lines = [
      "STOCK & SALES TRACKER — MONTHLY SALES REPORT",
      "Business: My Business",
      "Period: " + label,
      "",
      "DATE | PRODUCT | EMPLOYEE | UNITS | UNIT PRICE | TOTAL",
      ...thisMonthSales.slice().sort((a, b) => a.soldAt.localeCompare(b.soldAt)).map((s) => `${s.soldAt} | ${s.productName} | ${s.employee} | ${s.quantity} | ${money(s.unitPrice)} | ${money(s.quantity * s.unitPrice)}`),
      "",
      "PRODUCT SUMMARY",
      ...reportProducts.map((p) => `${p.name}: ${p.units} ${p.unit}(s) sold — ${money(p.value)}`),
      "",
      `TOTAL UNITS SOLD: ${monthUnits}`,
      `TOTAL SALES VALUE: ${money(monthValue)}`,
      "Returns are tracked separately and are not deducted from sales totals.",
    ];
    return lines.join("\n");
  }

  async function exportDocx() {
    const rows = [
      new TableRow({ children: ["Date", "Product", "Employee", "Units", "Unit price", "Total"].map((text) => new TableCell({ children: [new Paragraph({ text, bold: true })] })) }),
      ...thisMonthSales.map((s) => new TableRow({ children: [s.soldAt, s.productName, s.employee, String(s.quantity), money(s.unitPrice), money(s.quantity * s.unitPrice)].map((text) => new TableCell({ children: [new Paragraph(text)] })) })),
    ];
    const doc = new Document({ sections: [{ children: [
      new Paragraph({ text: "Monthly Sales Report", heading: "Heading1" }),
      new Paragraph("Business: My Business"),
      new Paragraph("Period: " + new Date(reportMonth + "-15T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })),
      new Paragraph(" "),
      new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } }),
      new Paragraph(" "),
      new Paragraph({ text: "Product summary", heading: "Heading2" }),
      ...reportProducts.map((p) => new Paragraph(`${p.name}: ${p.units} ${p.unit}(s) — ${money(p.value)}`)),
      new Paragraph({ text: `Total units sold: ${monthUnits}`, bold: true }),
      new Paragraph({ text: `Total sales value: ${money(monthValue)}`, bold: true }),
      new Paragraph("Returns are tracked separately and are not deducted from sales totals."),
    ] }] });
    const blob = await Packer.toBlob(doc);
    saveAs(blob, `sales-report-${reportMonth}.docx`);
  }

  async function exportReport(format: "txt" | "docx" | "copy") {
    if (format === "copy") {
      try {
        await navigator.clipboard.writeText(reportText());
        notify("Report copied to clipboard.");
      } catch {
        notify("Clipboard access was blocked. Use Download TXT instead.");
      }
    } else if (format === "txt") {
      saveAs(new Blob([reportText()], { type: "text/plain;charset=utf-8" }), `sales-report-${reportMonth}.txt`);
      notify("TXT report downloaded.");
    } else {
      try {
        await exportDocx();
        notify("Word report downloaded.");
      } catch {
        notify("Could not create the Word file. Please try again.");
      }
    }
  }

  const navItems: { label: Page; icon: typeof LayoutDashboard }[] = [
    { label: "Overview", icon: LayoutDashboard }, { label: "Sales", icon: ShoppingBag },
    { label: "Products", icon: Package }, { label: "Returns", icon: ArrowDownLeft },
    { label: "Reports", icon: BarChart3 },
  ];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark"><ShoppingBag size={20} strokeWidth={2.4} /></div>
          <div><strong>Stockwise</strong><span>SALES TRACKER</span></div>
          <button className="icon-button sidebar-close" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation"><X size={19} /></button>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <button className="business-switcher" onClick={() => notify("Business switching will be connected with account setup.")}>
          <div className="business-avatar">MB</div><span><strong>My Business</strong><small>Business workspace</small></span><ChevronDown size={16} />
        </button>
        <div className="nav-label">MENU</div>
        <nav className="nav-list" aria-label="Main navigation">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${page === label ? "active" : ""}`} onClick={() => { setPage(label); setMobileNavOpen(false); setSearch(""); }}>
              <Icon size={19} strokeWidth={1.9} /><span>{label}</span>
              {label === "Returns" && returns.length > 0 && <span className="nav-count">{returns.length}</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card"><div className="help-icon"><CircleHelp size={18} /></div><strong>Need a hand?</strong><p>Your sales records, all in one place.</p><button onClick={() => notify("Help centre will be added in a later version.")}>Explore help <ArrowUpRight size={14} /></button></div>
          <button className="nav-item settings-item" onClick={() => notify("Settings will be available after account setup.")}><Settings2 size={18} /><span>Settings</span></button>
          <div className="profile-row"><div className="profile-avatar">CM</div><div className="profile-copy"><strong>Chanda M.</strong><span>Employee account</span></div><button className="icon-button" onClick={() => notify("Profile settings are coming soon.")} aria-label="Profile options"><ChevronDown size={17} /></button></div>
        </div>
      </aside>

      {mobileNavOpen && <button className="mobile-scrim" onClick={() => setMobileNavOpen(false)} aria-label="Close navigation overlay" />}
      <main className="main-area">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={21} /></button>
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>{page}</strong></div>
          <div className="topbar-actions"><span className="today-pill"><span className="status-dot" /> Business workspace</span><button className="icon-button notification-button" aria-label="Notifications" onClick={() => notify("You're all caught up.")}><Bell size={19} /><i /></button><div className="top-avatar">CM</div></div>
        </header>
        <div className="page-content">
          {page === "Overview" && <>
            <div className="page-heading"><div><div className="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>Good morning, Chanda <span>✳</span></h1><p>Here's what's happening with your sales today.</p></div><button className="primary-button" onClick={() => setShowSaleForm(true)}><Plus size={18} /> Record a sale</button></div>
            <div className="stats-grid">
              <StatCard label="Sales today" value={money(todayValue)} icon={<TrendingUp size={19} />} tone="violet" detail={`${todaySales.length} sale entries recorded`} />
              <StatCard label="Units sold today" value={String(todaySales.reduce((sum, s) => sum + s.quantity, 0))} icon={<Package size={19} />} tone="blue" detail="Across all products" />
              <StatCard label="Sales this month" value={money(monthValue)} icon={<BarChart3 size={19} />} tone="green" detail={`${monthUnits} total units sold`} />
              <StatCard label="Returns recorded" value={String(returns.length)} icon={<ArrowDownLeft size={19} />} tone="orange" detail="Tracked separately from sales" />
            </div>
            <div className="content-grid">
              <section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent sales</h2><p>Your latest recorded transactions</p></div><button className="text-button" onClick={() => setPage("Sales")}>View all <ArrowUpRight size={15} /></button></div><SalesTable sales={sales.slice(0, 5)} /></section>
              <section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Keep your records up to date</p></div></div><button className="quick-action" onClick={() => setShowSaleForm(true)}><div className="quick-icon quick-purple"><Plus size={19} /></div><span><strong>Record a sale</strong><small>Add a new transaction</small></span><ArrowUpRight size={16} /></button><button className="quick-action" onClick={() => setShowProductForm(true)}><div className="quick-icon quick-blue"><Package size={19} /></div><span><strong>Add a product</strong><small>Update your product list</small></span><ArrowUpRight size={16} /></button><button className="quick-action" onClick={() => setShowReturnForm(true)}><div className="quick-icon quick-orange"><ArrowDownLeft size={19} /></div><span><strong>Record a return</strong><small>Log returned goods</small></span><ArrowUpRight size={16} /></button><button className="quick-action" onClick={() => setPage("Reports")}><div className="quick-icon quick-green"><FileText size={19} /></div><span><strong>View reports</strong><small>Review monthly performance</small></span><ArrowUpRight size={16} /></button></section>
            </div>
            <section className="panel product-panel"><div className="panel-heading"><div><h2>Top products</h2><p>By units sold this month</p></div><button className="text-button" onClick={() => setPage("Products")}>All products <ArrowUpRight size={15} /></button></div><div className="top-products">{reportProducts.sort((a,b) => b.units-a.units).slice(0, 4).map((p, i) => <div className="top-product" key={p.id}><div className={`product-symbol symbol-${i % 4}`}><Package size={18} /></div><div className="top-product-name"><strong>{p.name}</strong><span>{p.category}</span></div><div className="product-units"><strong>{p.units}</strong><span>units</span></div><div className="product-value">{money(p.value)}</div></div>)}{reportProducts.length === 0 && <EmptyState text="Record sales to see your top products here." />}</div></section>
            <p className="prototype-note"><span /> Prototype preview · Sample records are shown. Changes are not saved to a database yet.</p>
          </>}

          {page === "Sales" && <><PageHeader eyebrow="TRANSACTION HISTORY" title="Sales" description="Review and record every sale." action={<button className="primary-button" onClick={() => setShowSaleForm(true)}><Plus size={18} /> Record a sale</button>} /><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search product, employee, date..." /></div><span className="result-count">{filteredSales.length} entries</span></div><section className="panel table-panel"><SalesTable sales={filteredSales} /></section><p className="prototype-note"><span /> Sample data · Database persistence is not connected yet.</p></>}

          {page === "Products" && <><PageHeader eyebrow="YOUR CATALOGUE" title="Products" description="Manage the products you sell and their usual prices." action={<button className="primary-button" onClick={() => setShowProductForm(true)}><Plus size={18} /> Add product</button>} /><div className="toolbar"><div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." /></div><span className="result-count">{filteredProducts.length} products</span></div><section className="panel table-panel"><div className="data-table-wrap"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>UNIT</th><th>DEFAULT PRICE</th><th>UNITS SOLD THIS MONTH</th></tr></thead><tbody>{filteredProducts.map((p, i) => <tr key={p.id}><td><div className="table-product"><div className={`product-mini mini-${i % 4}`}><Package size={16} /></div><strong>{p.name}</strong></div></td><td><span className="category-pill">{p.category}</span></td><td>{p.unit}</td><td className="numeric-cell">{money(p.price)}</td><td className="numeric-cell">{thisMonthSales.filter((s) => s.productId === p.id).reduce((sum,s) => sum+s.quantity,0)}</td></tr>)}</tbody></table>{filteredProducts.length === 0 && <EmptyState text="No matching products. Add a product to get started." />}</div></section><p className="prototype-note"><span /> A sale keeps the price used at the time of sale, even if the default price changes later.</p></>}

          {page === "Returns" && <><PageHeader eyebrow="RETURN LOG" title="Returned goods" description="Record returns separately. Returned items are not automatically added back to sellable stock." action={<button className="primary-button" onClick={() => setShowReturnForm(true)}><Plus size={18} /> Record a return</button>} /><section className="panel table-panel"><div className="data-table-wrap"><table><thead><tr><th>PRODUCT</th><th>QUANTITY</th><th>RETURN DATE</th><th>REASON / NOTES</th></tr></thead><tbody>{returns.map((r) => <tr key={r.id}><td><div className="table-product"><div className="product-mini mini-orange"><ArrowDownLeft size={16} /></div><strong>{r.productName}</strong></div></td><td>{r.quantity}</td><td>{dateLabel(r.returnedAt)}</td><td>{r.reason}</td></tr>)}</tbody></table>{returns.length === 0 && <EmptyState text="No returns recorded yet." />}</div></section><div className="info-banner"><ArrowDownRight size={18} /><p><strong>Returns are kept separate</strong><br />Sales totals show the value of recorded sales. Returns are reported separately and are not automatically deducted.</p></div></>}

          {page === "Reports" && <><PageHeader eyebrow="BUSINESS INSIGHTS" title="Monthly reports" description="Choose a month, review the totals, and export a report." /><div className="report-controls panel"><div><label htmlFor="report-month">REPORTING PERIOD</label><div className="month-input"><CalendarDays size={17} /><input id="report-month" type="month" value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} /></div></div><div className="export-actions"><button className="secondary-button" onClick={() => void exportReport("copy")}><ClipboardList size={16} /> Copy text</button><button className="secondary-button" onClick={() => void exportReport("txt")}><Download size={16} /> Download TXT</button><button className="primary-button" onClick={() => void exportReport("docx")}><FileText size={16} /> Export Word</button></div></div><div className="report-stats"><StatCard label="Total units sold" value={String(monthUnits)} icon={<Package size={19} />} tone="blue" detail="All products combined" /><StatCard label="Total sales value" value={money(monthValue)} icon={<TrendingUp size={19} />} tone="green" detail="Based on recorded sale prices" /><StatCard label="Sales entries" value={String(thisMonthSales.length)} icon={<ShoppingBag size={19} />} tone="violet" detail="Transactions in selected month" /></div><section className="panel report-panel"><div className="panel-heading"><div><h2>Product summary</h2><p>Sales for {new Date(reportMonth + "-15T12:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" })}</p></div><span className="report-badge"><CalendarDays size={14} /> Monthly summary</span></div><div className="data-table-wrap"><table><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th><th>SALES VALUE</th></tr></thead><tbody>{reportProducts.map((p) => <tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.units} {p.unit}(s)</td><td className="numeric-cell">{money(p.value)}</td></tr>)}</tbody></table>{reportProducts.length === 0 && <EmptyState text="No sales for this month yet. Try another month or record a sale." />}</div><div className="report-total"><div><span>Total units sold</span><strong>{monthUnits}</strong></div><div><span>Total sales value</span><strong>{money(monthValue)}</strong></div></div></section><section className="panel report-panel"><div className="panel-heading"><div><h2>Transaction details</h2><p>Every recorded sale included in this report</p></div></div><SalesTable sales={thisMonthSales} /></section><div className="info-banner"><FileText size={18} /><p><strong>Report note</strong><br />Returns are shown in their own section and are not subtracted from sales totals. This avoids presenting an unverified net-sales figure.</p></div></>}

        </div>
      </main>

      {showSaleForm && <Modal title="Record a sale" description="Enter the details of this transaction." onClose={() => setShowSaleForm(false)}><form className="form-stack" onSubmit={handleSaleSubmit}><label>Product<select value={saleProduct} onChange={(e) => { const p = products.find((item) => item.id === e.target.value); setSaleProduct(e.target.value); if (p) setSalePrice(String(p.price)); }} required>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><button type="button" className="inline-add" onClick={() => { setShowSaleForm(false); setShowProductForm(true); }}><Plus size={15} /> Add a new product instead</button><div className="form-two-col"><label>Quantity (units)<input type="number" min="0.01" step="any" value={saleQty} onChange={(e) => setSaleQty(e.target.value)} required /></label><label>Unit price (ZMW)<input type="number" min="0" step="0.01" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} required /></label></div><label>Date sold<input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required /></label><label>Employee name<input value={saleEmployee} onChange={(e) => setSaleEmployee(e.target.value)} placeholder="Name shown in reports" required /></label><div className="sale-total-preview"><span>Total sale value</span><strong>{money(Math.max(0, Number(saleQty) || 0) * Math.max(0, Number(salePrice) || 0))}</strong></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowSaleForm(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={17} /> Save sale</button></div></form></Modal>}

      {showProductForm && <Modal title="Add a product" description="Add a product to your business catalogue." onClose={() => setShowProductForm(false)}><form className="form-stack" onSubmit={handleProductSubmit}><label>Product name<input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Maize meal — 25kg" required /></label><div className="form-two-col"><label>Unit<input value={newUnit} onChange={(e) => setNewUnit(e.target.value)} placeholder="bottle, bag, unit..." required /></label><label>Default price (ZMW)<input type="number" min="0" step="0.01" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} required /></label></div><label>Category<input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="e.g. Groceries" /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowProductForm(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={17} /> Add product</button></div></form></Modal>}

      {showReturnForm && <Modal title="Record a return" description="Keep returned goods separate from sales and stock assumptions." onClose={() => setShowReturnForm(false)}><form className="form-stack" onSubmit={handleReturnSubmit}><label>Product<select value={returnProduct} onChange={(e) => setReturnProduct(e.target.value)} required>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="form-two-col"><label>Quantity returned<input type="number" min="0.01" step="any" value={returnQty} onChange={(e) => setReturnQty(e.target.value)} required /></label><label>Date returned<input type="date" value={returnDate} onChange={(e) => setReturnDate(e.target.value)} required /></label></div><label>Reason / notes (optional)<textarea value={returnReason} onChange={(e) => setReturnReason(e.target.value)} placeholder="e.g. damaged packaging, customer changed mind" rows={3} /></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setShowReturnForm(false)}>Cancel</button><button type="submit" className="primary-button"><Check size={17} /> Save return</button></div></form></Modal>}

      {notice && <div className="toast" role="status"><Check size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Dismiss notification"><X size={15} /></button></div>}
    </div>
  );
}

function StatCard({ label, value, icon, tone, detail }: { label: string; value: string; icon: React.ReactNode; tone: string; detail: string }) {
  return <div className="stat-card"><div className="stat-top"><span>{label}</span><div className={`stat-icon ${tone}`}>{icon}</div></div><strong className="stat-value">{value}</strong><div className="stat-detail">{detail}</div></div>;
}
function PageHeader({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-heading subpage-heading"><div><div className="eyebrow">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}
function SalesTable({ sales }: { sales: Sale[] }) {
  return <div className="data-table-wrap"><table><thead><tr><th>PRODUCT</th><th>EMPLOYEE</th><th>DATE</th><th>UNITS</th><th className="align-right">TOTAL</th></tr></thead><tbody>{sales.map((s) => <tr key={s.id}><td><div className="table-product"><div className="product-mini"><Package size={16} /></div><div><strong>{s.productName}</strong><small>{money(s.unitPrice)} / unit</small></div></div></td><td><div className="employee-cell"><div className="employee-dot">{s.employee.split(" ").map((n) => n[0]).join("").slice(0,2)}</div>{s.employee}</div></td><td>{dateLabel(s.soldAt)}</td><td><span className="quantity-pill">{s.quantity}</span></td><td className="align-right numeric-cell">{money(s.quantity * s.unitPrice)}</td></tr>)}</tbody></table>{sales.length === 0 && <EmptyState text="No sales found. Record a sale to start building your history." />}</div>;
}
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon"><ClipboardList size={22} /></div><p>{text}</p></div>; }
function Modal({ title, description, onClose, children }: { title: string; description: string; onClose: () => void; children: React.ReactNode }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}><section className="modal-card" role="dialog" aria-modal="true" aria-label={title}><div className="modal-heading"><div><h2>{title}</h2><p>{description}</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={19} /></button></div>{children}</section></div>;
}
