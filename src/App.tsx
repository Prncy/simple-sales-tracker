import { useEffect, useMemo, useState } from "react";
import type { FormEvent } from "react";
import {
  Activity, ArrowDownLeft, ArrowRight, BarChart3, CalendarDays, Check,
  ChevronDown, CircleHelp, Download, LayoutDashboard, LogOut,
  Menu, Package, Plus, RotateCcw, Settings, ShieldCheck, ShoppingBag,
  ShoppingCart, Store, Sun, Moon, Leaf, TrendingUp, X, ReceiptText
} from "lucide-react";
import { supabase, isSupabaseConfigured } from "./lib/supabase";

type Theme = "light" | "dark" | "graphite" | "green";
type Page = "Overview" | "Sales" | "Products" | "Returns" | "Receipts" | "Reports" | "Settings";
type Business = { id: string; name: string; currency_code: string; owner_user_id: string };
type Product = { id: string; name: string; category: string; unit_label: string; default_unit_price: number; is_active: boolean };
type Sale = { id: string; transaction_id: string; product_id: string; employee_name: string; quantity: number; unit_price: number; total_value: number; sold_on: string; sold_at: string; note?: string | null; products?: { name: string; unit_label: string } | null };
type ReceiptRecord = { id: string; transaction_id: string; receipt_number: string; total_amount: number; amount_received: number; change_due: number; created_at: string; business_id: string };
type SaleGroup = { id: string; employee_name: string; sold_on: string; note?: string | null; total_value: number; quantity: number; items: Sale[] };
type ReturnRecord = { id: string; product_id: string; employee_name: string; quantity: number; returned_on: string; reason?: string | null; products?: { name: string; unit_label: string } | null };

const pages: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Overview", icon: LayoutDashboard }, { name: "Sales", icon: ShoppingCart },
  { name: "Products", icon: Package }, { name: "Returns", icon: RotateCcw },
  { name: "Receipts", icon: ReceiptText }, { name: "Reports", icon: BarChart3 }, { name: "Settings", icon: Settings }
];
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const today = () => dateKey(new Date());
const money = (value: number, currency = "ZMW") => new Intl.NumberFormat("en-ZM", { style: "currency", currency, maximumFractionDigits: 2 }).format(Number(value || 0));
const readableDate = (value: string) => value ? new Date(value + "T00:00:00").toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
const groupSales = (rows: Sale[]): SaleGroup[] => {
  const groups = new Map<string, SaleGroup>();
  rows.forEach(row => {
    const id = row.transaction_id || row.id;
    const group = groups.get(id) ?? { id, employee_name: row.employee_name, sold_on: row.sold_on, note: row.note, total_value: 0, quantity: 0, items: [] };
    group.total_value += Number(row.total_value || 0); group.quantity += Number(row.quantity || 0); group.items.push(row); groups.set(id, group);
  });
  return Array.from(groups.values()).sort((a, b) => b.sold_on.localeCompare(a.sold_on));
};

async function fetchAllRows<T>(fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>) {
  const rows: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await fetchPage(from, from + 999);
    if (error) return { data: rows, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < 1000) return { data: rows, error: null };
    from += 1000;
  }
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("kwacha-sales-theme") ?? localStorage.getItem("stockwise-theme");
    return saved === "light" || saved === "dark" || saved === "green" || saved === "graphite" ? saved : "graphite";
  });
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [page, setPage] = useState<Page>("Overview");
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [returns, setReturns] = useState<ReturnRecord[]>([]);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);
  const [receiptEnabled, setReceiptEnabled] = useState(false);
  const [amountReceived, setAmountReceived] = useState("");
  const [saleItems, setSaleItems] = useState<{ key: number; product_id: string; quantity: string; unit_price: string }[]>([{ key: 1, product_id: "", quantity: "1", unit_price: "" }]);
  const [nextSaleItemKey, setNextSaleItemKey] = useState(2);
  const [savingSale, setSavingSale] = useState(false);
  const [dataLoading, setDataLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [productName, setProductName] = useState("");
  const [category, setCategory] = useState("General");
  const [unitLabel, setUnitLabel] = useState("unit");
  const [productPrice, setProductPrice] = useState("");
  const [saleDate, setSaleDate] = useState(today());
  const [employeeName, setEmployeeName] = useState("");
  const [saleNote, setSaleNote] = useState("");
  const [returnProduct, setReturnProduct] = useState("");
  const [returnQuantity, setReturnQuantity] = useState("1");
  const [returnDate, setReturnDate] = useState(today());
  const [returnReason, setReturnReason] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"daily" | "weekly" | "monthly" | "yearly">("monthly");
  const [reportDate, setReportDate] = useState(today());

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const callbackError = queryParams.get("error_description") || hashParams.get("error_description") || queryParams.get("error");
    const isAuthCallback = hashParams.has("access_token") || queryParams.has("code") || queryParams.has("token_hash");
    if (callbackError) setAuthError(callbackError.replace(/\+/g, " "));
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      setSession(data.session);
      setAuthLoading(false);
      if (sessionError) setAuthError(sessionError.message);
      if (data.session && isAuthCallback) setNotice("Email confirmed successfully. Your account is ready.");
      if (isAuthCallback || callbackError) window.history.replaceState({}, document.title, window.location.pathname);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user?.id || !supabase) { setBusiness(null); return; }
    let cancelled = false;
    setWorkspaceLoading(true);
    (async () => {
      const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", session.user.id).maybeSingle();
      if (!cancelled && profile?.display_name) setEmployeeName(profile.display_name);
      const { data, error: queryError } = await supabase.from("businesses").select("id,name,currency_code,owner_user_id").eq("owner_user_id", session.user.id).order("created_at", { ascending: true }).limit(1).maybeSingle();
      if (cancelled) return;
      if (queryError) setError(queryError.message);
      setBusiness(data as Business | null);
      setBusinessName((data as Business | null)?.name ?? "");
      setWorkspaceLoading(false);
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!business || !supabase) { setProducts([]); setSales([]); setReturns([]); return; }
    let cancelled = false;
    setDataLoading(true);
    (async () => {
      const [productResult, saleResult, returnResult, receiptResult] = await Promise.all([
        supabase.from("products").select("id,name,category,unit_label,default_unit_price,is_active").eq("business_id", business.id).eq("is_active", true).order("name"),
        fetchAllRows((from, to) => supabase!.from("sales").select("id,transaction_id,product_id,employee_name,quantity,unit_price,total_value,sold_on,sold_at,note,products!sales_product_id_fkey(name,unit_label)").eq("business_id", business.id).order("sold_on", { ascending: false }).range(from, to)),
        fetchAllRows((from, to) => supabase!.from("returns").select("id,product_id,employee_name,quantity,returned_on,reason,products!returns_product_id_fkey(name,unit_label)").eq("business_id", business.id).order("returned_on", { ascending: false }).range(from, to)),
        supabase.from("receipts").select("id,transaction_id,business_id,receipt_number,total_amount,amount_received,change_due,created_at").eq("business_id", business.id).order("created_at", { ascending: false })
      ]);
      if (cancelled) return;
      const queryError = productResult.error || saleResult.error || returnResult.error || receiptResult.error;
      if (queryError) setError(queryError.message);
      setProducts((productResult.data ?? []) as Product[]);
      setSales((saleResult.data ?? []) as unknown as Sale[]);
      setReturns((returnResult.data ?? []) as unknown as ReturnRecord[]);
      setReceipts((receiptResult.data ?? []) as ReceiptRecord[]);
      setDataLoading(false);
    })();
    return () => { cancelled = true; };
  }, [business?.id]);

  useEffect(() => {
    localStorage.setItem("kwacha-sales-theme", theme);
  }, [theme]);

  const groupedSales = useMemo(() => groupSales(sales), [sales]);
  const currentMonthSales = useMemo(() => sales.filter(s => s.sold_on?.slice(0, 7) === today().slice(0, 7)), [sales]);
  const currentMonthValue = currentMonthSales.reduce((sum, sale) => sum + Number(sale.total_value || 0), 0);
  const currentMonthUnits = currentMonthSales.reduce((sum, sale) => sum + Number(sale.quantity || 0), 0);
  const reportRows = useMemo(() => {
    const selected = new Date(reportDate + "T00:00:00");
    let start = reportDate, end = reportDate;
    if (reportPeriod === "weekly") {
      const day = (selected.getDay() + 6) % 7;
      const monday = new Date(selected); monday.setDate(selected.getDate() - day);
      const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
      start = dateKey(monday); end = dateKey(sunday);
    } else if (reportPeriod === "monthly") {
      start = dateKey(new Date(selected.getFullYear(), selected.getMonth(), 1));
      end = dateKey(new Date(selected.getFullYear(), selected.getMonth() + 1, 0));
    } else if (reportPeriod === "yearly") {
      start = selected.getFullYear() + "-01-01"; end = selected.getFullYear() + "-12-31";
    }
    const matchingSales = sales.filter(s => s.sold_on >= start && s.sold_on <= end);
    const matchingReturns = returns.filter(r => r.returned_on >= start && r.returned_on <= end);
    const grouped = new Map<string, { name: string; units: number; value: number }>();
    matchingSales.forEach(s => {
      const name = s.products?.name ?? products.find(p => p.id === s.product_id)?.name ?? "Archived product";
      const existing = grouped.get(name) ?? { name, units: 0, value: 0 };
      existing.units += Number(s.quantity || 0); existing.value += Number(s.total_value || 0); grouped.set(name, existing);
    });
    return { start, end, sales: matchingSales, returns: matchingReturns, products: Array.from(grouped.values()).sort((a,b) => b.value-a.value) };
  }, [sales, returns, products, reportDate, reportPeriod]);
  const reportValue = reportRows.sales.reduce((sum, s) => sum + Number(s.total_value || 0), 0);
  const reportUnits = reportRows.sales.reduce((sum, s) => sum + Number(s.quantity || 0), 0);

  async function handleAuth(event: FormEvent) {
    event.preventDefault(); setAuthError(""); setAuthMessage("");
    if (!supabase) return;
    setAuthLoading(true);
    try {
      if (authMode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: new URL(import.meta.env.BASE_URL, window.location.origin).toString(), data: { display_name: fullName.trim() } } });
        if (signUpError) throw signUpError;
        if (!data.session) {
          setAuthMessage("Check your email to confirm your account, then return here to sign in.");
        } else if (data.user) {
          await supabase.from("profiles").upsert({ id: data.user.id, display_name: fullName.trim() });
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (signInError) throw signInError;
      }
    } catch (e) { setAuthError(e instanceof Error ? e.message : "We couldn't authenticate you. Please try again."); }
    finally { setAuthLoading(false); }
  }

  async function createBusiness(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!supabase || !session?.user?.id) return;
    setWorkspaceLoading(true);
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({ id: session.user.id, display_name: employeeName.trim() });
      if (profileError) throw profileError;
      const { data, error: createError } = await supabase.from("businesses").insert({ owner_user_id: session.user.id, name: businessName.trim(), currency_code: "ZMW" }).select("id,name,currency_code,owner_user_id").single();
      if (createError) throw createError;
      setBusiness(data as Business); setNotice("Your business workspace is ready.");
    } catch (e) { setError(e instanceof Error ? e.message : "Couldn't create the business workspace."); }
    finally { setWorkspaceLoading(false); }
  }

  async function addProduct(event: FormEvent) {
    event.preventDefault(); if (!supabase || !business) return; setError(""); setNotice("");
    const price = Number(productPrice);
    if (!productName.trim() || !Number.isFinite(price) || price < 0) { setError("Enter a product name and a valid non-negative price."); return; }
    const { error: insertError } = await supabase.from("products").insert({ business_id: business.id, name: productName.trim(), category: category.trim() || "General", unit_label: unitLabel.trim() || "unit", default_unit_price: price, created_by: session.user.id });
    if (insertError) { setError(insertError.message); return; }
    setProductName(""); setCategory("General"); setUnitLabel("unit"); setProductPrice(""); setNotice("Product saved.");
    await reloadData();
  }

  function updateSaleItem(key: number, field: "product_id" | "quantity" | "unit_price", value: string) {
    setSaleItems(items => items.map(item => {
      if (item.key !== key) return item;
      if (field === "product_id") {
        const product = products.find(p => p.id === value);
        return { ...item, product_id: value, unit_price: product ? String(product.default_unit_price) : "" };
      }
      return { ...item, [field]: value };
    }));
  }

  const saleTotal = saleItems.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0) * Math.max(0, Number(item.unit_price) || 0), 0);
  const changeDue = Math.max(0, (Number(amountReceived) || 0) - saleTotal);

  async function addSale(event: FormEvent) {
    event.preventDefault(); if (!supabase || !business) return; setError(""); setNotice("");
    const validItems = saleItems.map(item => ({ product_id: item.product_id, quantity: Number(item.quantity), unit_price: Number(item.unit_price) }));
    if (!employeeName.trim() || validItems.some(item => !item.product_id || !Number.isFinite(item.quantity) || item.quantity <= 0 || !Number.isFinite(item.unit_price) || item.unit_price < 0)) {
      setError("Choose a product and enter a valid quantity and unit price for every line."); return;
    }
    if (receiptEnabled && (!amountReceived.trim() || !Number.isFinite(Number(amountReceived)) || Number(amountReceived) < saleTotal)) {
      setError("Amount received must be at least the overall sale total."); return;
    }
    setSavingSale(true);
    try {
      const { data, error: insertError } = await supabase.rpc("create_sale_with_receipt", {
        p_business_id: business.id,
        p_employee_name: employeeName.trim(),
        p_sold_on: saleDate,
        p_note: saleNote.trim() || null,
        p_items: validItems,
        p_receipt_enabled: receiptEnabled,
        p_amount_received: receiptEnabled ? Number(amountReceived) : null
      });
      if (insertError) throw insertError;
      const result = data as { receipt_number?: string | null; total_amount?: number };
      setSaleItems([{ key: nextSaleItemKey, product_id: "", quantity: "1", unit_price: "" }]);
      setNextSaleItemKey(key => key + 1);
      setAmountReceived(""); setReceiptEnabled(false); setSaleNote(""); setSaleDate(today());
      setNotice(result.receipt_number ? "Sale saved. Receipt " + result.receipt_number + " created." : "Sale recorded successfully.");
      await reloadData();
      if (result.receipt_number) setPage("Receipts");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save this sale. No partial sale should be recorded.");
    } finally { setSavingSale(false); }
  }

  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));

  function printReceipt(receipt: ReceiptRecord) {
    if (!business) return;
    const transactionItems = sales.filter(s => s.transaction_id === receipt.transaction_id);
    const popup = window.open("", "_blank", "width=420,height=720");
    if (!popup) { setError("Allow pop-ups to print a receipt."); return; }
    const itemRows = transactionItems.map(item => "<tr><td>" + escapeHtml(item.products?.name ?? "Product") + "<br><small>" + Number(item.quantity) + " × " + money(Number(item.unit_price), business.currency_code) + "</small></td><td style=\"text-align:right\">" + money(Number(item.total_value), business.currency_code) + "</td></tr>").join("");
    const html = "<!doctype html><html><head><title>" + escapeHtml(receipt.receipt_number) + "</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><style>body{font:14px system-ui,sans-serif;color:#111;padding:22px;max-width:360px;margin:auto}h1{text-align:center;font-size:22px}p{text-align:center;color:#555}.line{border-top:1px dashed #888;margin:14px 0}table{width:100%;border-collapse:collapse}td{padding:8px 0;vertical-align:top}.total{font-weight:700;font-size:17px}small{color:#555}button{width:100%;padding:10px;margin-top:16px}@media print{button{display:none}}</style></head><body><h1>" + escapeHtml(business.name) + "</h1><p>SALES RECEIPT</p><div class=\"line\"></div><p>Receipt: " + escapeHtml(receipt.receipt_number) + "<br>Date: " + escapeHtml(readableDate(receipt.created_at.slice(0,10))) + "<br>Served by: " + escapeHtml(transactionItems[0]?.employee_name ?? employeeName) + "</p><div class=\"line\"></div><table>" + itemRows + "</table><div class=\"line\"></div><table><tr class=\"total\"><td>Total</td><td style=\"text-align:right\">" + money(Number(receipt.total_amount), business.currency_code) + "</td></tr><tr><td>Amount received</td><td style=\"text-align:right\">" + money(Number(receipt.amount_received), business.currency_code) + "</td></tr><tr><td>Change</td><td style=\"text-align:right\">" + money(Number(receipt.change_due), business.currency_code) + "</td></tr></table><p>Thank you for your business.</p><button onclick=\"window.print()\">Print receipt</button><script>window.onload=()=>window.print()</script></body></html>";
    popup.document.write(html);
    popup.document.close();
  }

  async function addReturn(event: FormEvent) {
    event.preventDefault(); if (!supabase || !business) return; setError(""); setNotice("");
    const quantity = Number(returnQuantity);
    if (!returnProduct || !employeeName.trim() || quantity <= 0 || !Number.isFinite(quantity)) { setError("Choose a product and enter a valid quantity."); return; }
    const { error: insertError } = await supabase.from("returns").insert({ business_id: business.id, product_id: returnProduct, recorded_by: session.user.id, employee_name: employeeName.trim(), quantity, returned_on: returnDate, reason: returnReason.trim() || null });
    if (insertError) { setError(insertError.message); return; }
    setReturnQuantity("1"); setReturnReason(""); setReturnDate(today()); setNotice("Return recorded.");
    await reloadData();
  }

  async function reloadData() {
    if (!supabase || !business) return;
    const [p, s, r, rc] = await Promise.all([
      supabase.from("products").select("id,name,category,unit_label,default_unit_price,is_active").eq("business_id", business.id).eq("is_active", true).order("name"),
      fetchAllRows((from, to) => supabase!.from("sales").select("id,transaction_id,product_id,employee_name,quantity,unit_price,total_value,sold_on,sold_at,note,products!sales_product_id_fkey(name,unit_label)").eq("business_id", business.id).order("sold_on", { ascending: false }).range(from, to)),
      fetchAllRows((from, to) => supabase!.from("returns").select("id,product_id,employee_name,quantity,returned_on,reason,products!returns_product_id_fkey(name,unit_label)").eq("business_id", business.id).order("returned_on", { ascending: false }).range(from, to)),
      supabase.from("receipts").select("id,transaction_id,business_id,receipt_number,total_amount,amount_received,change_due,created_at").eq("business_id", business.id).order("created_at", { ascending: false })
    ]);
    if (p.error || s.error || r.error || rc.error) setError(p.error?.message || s.error?.message || r.error?.message || rc.error?.message || "Unable to refresh data.");
    setProducts((p.data ?? []) as Product[]); setSales((s.data ?? []) as unknown as Sale[]); setReturns((r.data ?? []) as unknown as ReturnRecord[]); setReceipts((rc.data ?? []) as ReceiptRecord[]);
  }

  async function signOut() {
    if (!supabase) return;
    const { error: signOutError } = await supabase.auth.signOut();
    if (signOutError) setError(signOutError.message);
    else { setBusiness(null); setProducts([]); setSales([]); setReturns([]); setReceipts([]); setPage("Overview"); }
  }

  function downloadReport() {
    const lines = [
      `Kwacha Sales ${reportPeriod} sales report`, `Business: ${business?.name ?? ""}`,
      `Period: ${readableDate(reportRows.start)} – ${readableDate(reportRows.end)}`,
      `Total sales: ${money(reportValue, business?.currency_code)}`, `Units sold: ${reportUnits}`,
      "", "Sales by product", ...reportRows.products.map(p => `${p.name}: ${p.units} units · ${money(p.value, business?.currency_code)}`),
      "", `Returns recorded: ${reportRows.returns.reduce((sum, r) => sum + Number(r.quantity || 0), 0)} units`,
      ...reportRows.returns.map(r => `${readableDate(r.returned_on)} · ${r.products?.name ?? "Product"} · ${r.quantity} units · ${r.reason ?? "No reason given"}`)
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `kwacha-sales-${reportPeriod}-report-${reportDate}.txt`; anchor.click(); URL.revokeObjectURL(url);
  }

  if (!isSupabaseConfigured) return <main className="config-screen"><div className="config-card"><span className="brand-mark"><Store /></span><h1>Kwacha Sales needs its connection settings</h1><p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to your deployment environment. No secret service-role key belongs in the browser.</p></div></main>;
  if (authLoading) return <main className="loading-screen"><div className="loading-mark"><Store /></div><p>Getting your workspace ready…</p></main>;
  if (!session) return (
    <main className="auth-layout" data-theme={theme}>
      <section className="auth-story">
        <a className="brand" href="#home"><span className="brand-mark"><Store size={20} /></span><span>Kwacha Sales<span className="brand-period">.</span></span></a>
        <div className="auth-story-copy"><span className="eyebrow"><span className="eyebrow-dot" /> SMALL BUSINESS, CLEARER NUMBERS</span><h1>Know your sales.<br /><span>Run your business.</span></h1><p>A straightforward place to record sales, keep product details, and understand how your business is doing.</p><div className="story-points"><span><Check size={16} /> Simple sales records</span><span><Check size={16} /> Reports when you need them</span><span><ShieldCheck size={16} /> Your business data stays yours</span></div></div>
        <p className="auth-footer">Made for everyday business · Kwacha Sales © 2026</p>
      </section>
      <section className="auth-form-panel" id="home"><div className="auth-card">
        <div className="auth-tabs"><button className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthMessage(""); }}>Create account</button><button className={authMode === "signin" ? "selected" : ""} onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthMessage(""); }}>Sign in</button></div>
        <p className="eyebrow">{authMode === "signup" ? "GET STARTED" : "WELCOME BACK"}</p><h2>{authMode === "signup" ? "Build a clearer picture." : "Good to see you again."}</h2><p className="muted">{authMode === "signup" ? "Create an account to set up your business workspace." : "Sign in to continue to your business."}</p>
        {authError && <div className="alert error" role="alert">{authError}</div>}{authMessage && <div className="alert success" role="status">{authMessage}</div>}
        <form className="form-stack" onSubmit={handleAuth}>
          {authMode === "signup" && <label>Full name<input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" placeholder="Your name" required /></label>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} placeholder="At least 8 characters" required /></label>
          <button className="button primary full" type="submit" disabled={authLoading}>{authLoading ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={17} /></button>
        </form><p className="privacy-note"><ShieldCheck size={15} /> Your password is handled securely by Supabase Auth.</p>
      </div><div className="theme-mini"><span>Appearance</span>{(["light","dark","graphite","green"] as Theme[]).map(t => <button key={t} className={theme === t ? "theme-dot selected" : "theme-dot"} data-theme-choice={t} aria-label={t + " theme"} title={t} onClick={() => setTheme(t)} />)}</div></section>
    </main>
  );

  if (workspaceLoading) return <main className="loading-screen"><div className="loading-mark"><Store /></div><p>Loading your business…</p></main>;
  if (!business) return <main className="onboarding-screen" data-theme={theme}><div className="onboarding-card"><span className="brand-mark"><Store /></span><p className="eyebrow">ONE QUICK STEP</p><h1>Set up your business</h1><p className="muted">This workspace keeps your products, sales, and reports together.</p>{error && <div className="alert error">{error}</div>}<form className="form-stack" onSubmit={createBusiness}><label>Business name<input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Banda General Dealers" maxLength={120} required /></label><label>Your name for sales records<input value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Name shown on transactions" maxLength={120} required /></label><div className="field-note">Default currency: ZMW (Zambian Kwacha)</div><button className="button primary full" disabled={workspaceLoading}>Create workspace <ArrowRight size={17} /></button></form></div></main>;

  return (
    <div className="app-frame" data-theme={theme}>
      <aside className={mobileNavOpen ? "sidebar open" : "sidebar"}>
        <a className="brand" href="#dashboard"><span className="brand-mark"><Store size={20} /></span><span>Kwacha Sales<span className="brand-period">.</span></span></a>
        <div className="business-switch"><span className="business-avatar">{business.name.slice(0,1).toUpperCase()}</span><span className="business-meta"><strong>{business.name}</strong><small>Business workspace</small></span><ChevronDown size={15} /></div>
        <p className="nav-label">WORKSPACE</p><nav>{pages.map(item => { const Icon = item.icon; return <button key={item.name} className={page === item.name ? "nav-item active" : "nav-item"} onClick={() => { setPage(item.name); setMobileNavOpen(false); setNotice(""); setError(""); }}><Icon size={18} /><span>{item.name}</span>{item.name === "Sales" && <span className="nav-count">{sales.length}</span>}</button>; })}</nav>
        <div className="sidebar-bottom"><div className="help-card"><CircleHelp size={18} /><div><strong>Need a hand?</strong><small>Keep your records up to date.</small></div></div><button className="nav-item signout" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button><div className="account-row"><span className="account-avatar">{(employeeName || email || "U").slice(0,1).toUpperCase()}</span><div><strong>{employeeName || session.user.email}</strong><small>{session.user.email}</small></div></div></div>
      </aside>
      {mobileNavOpen && <button className="nav-backdrop" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} />}
      <main className="main-panel">
        <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button><div><p className="breadcrumb">Workspace <span>/</span> {page}</p><h1>{page === "Overview" ? "Good business starts with clarity." : page}</h1></div><div className="top-actions"><span className="today-chip"><CalendarDays size={15} /> {new Date().toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</span><button className="icon-button" aria-label="Open settings" title="Settings" onClick={() => setPage("Settings")}><Settings size={18} /></button><span className="profile-chip">{(employeeName || "U").slice(0,1).toUpperCase()}</span></div></header>
        <div className="content-area">
          {notice && <div className="alert success" role="status"><Check size={16} /> {notice}<button onClick={() => setNotice("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {error && <div className="alert error" role="alert">{error}<button onClick={() => setError("")} aria-label="Dismiss"><X size={15}/></button></div>}
          {dataLoading && <div className="loading-strip">Syncing your saved records…</div>}
          {page === "Overview" && <><div className="welcome-row"><div><p className="eyebrow">YOUR BUSINESS AT A GLANCE</p><h2>Here's how things are moving.</h2><p className="muted">Your numbers, based on the sales you've recorded.</p></div><button className="button primary" onClick={() => { setPage("Sales"); setSaleItems([{ key: nextSaleItemKey, product_id: products[0]?.id ?? "", quantity: "1", unit_price: products[0] ? String(products[0].default_unit_price) : "" }]); setNextSaleItemKey(key => key + 1); }}><Plus size={17} /> Record a sale</button></div><div className="metric-grid"><Metric icon={TrendingUp} label="Sales this month" value={money(currentMonthValue,business.currency_code)} hint="Recorded sales value" tone="accent" /><Metric icon={ShoppingBag} label="Units sold this month" value={currentMonthUnits.toLocaleString()} hint="Total quantity recorded" tone="blue" /><Metric icon={Package} label="Active products" value={products.length.toString()} hint="In your product catalogue" tone="green" /><Metric icon={ArrowDownLeft} label="Returns recorded" value={returns.length.toString()} hint="All-time return entries" tone="orange" /></div><div className="dashboard-grid"><section className="panel recent-panel"><div className="panel-heading"><div><h3>Recent sales</h3><p>Latest transactions saved to your workspace</p></div><button className="text-button" onClick={() => setPage("Sales")}>View all <ArrowRight size={15}/></button></div>{sales.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Date</th><th>Quantity</th><th>Total</th></tr></thead><tbody>{groupedSales.slice(0,5).map(s => <tr key={s.id}><td><strong>{s.items.map(item => item.products?.name ?? products.find(p => p.id === item.product_id)?.name ?? "Product").join(", ")}</strong><small>{s.employee_name}</small></td><td>{readableDate(s.sold_on)}</td><td>{s.quantity}</td><td className="numeric">{money(s.total_value,business.currency_code)}</td></tr>)}</tbody></table></div> : <EmptyState icon={ShoppingCart} title="Your first sale starts here" description="Once you record a sale, it will appear here." action="Record a sale" onAction={() => setPage("Sales")} />}</section><section className="panel quick-panel"><div className="panel-heading"><div><h3>Quick actions</h3><p>Get straight to what you need</p></div></div><QuickAction icon={ShoppingCart} title="Record a sale" detail="Add a completed transaction" onClick={() => setPage("Sales")} /><QuickAction icon={Package} title="Add a product" detail="Set up a product and its price" onClick={() => setPage("Products")} /><QuickAction icon={RotateCcw} title="Record a return" detail="Keep returned goods documented" onClick={() => setPage("Returns")} /><QuickAction icon={BarChart3} title="View reports" detail="Summarise sales over time" onClick={() => setPage("Reports")} /></section></div></>}
          {page === "Products" && <><div className="section-intro"><div><p className="eyebrow">PRODUCT CATALOGUE</p><h2>Products your business sells</h2><p className="muted">Add the products you sell. You don't need to enter stock quantities.</p></div></div><div className="split-layout"><section className="panel"><div className="panel-heading"><div><h3>Add a product</h3><p>Prices can be changed without altering old sales.</p></div></div><form className="form-stack" onSubmit={addProduct}><label>Product name<input value={productName} onChange={e => setProductName(e.target.value)} placeholder="e.g. 2L cooking oil" maxLength={160} required /></label><div className="form-two"><label>Category<input value={category} onChange={e => setCategory(e.target.value)} placeholder="General" /></label><label>Unit label<input value={unitLabel} onChange={e => setUnitLabel(e.target.value)} placeholder="bottle, kg, item…" /></label></div><label>Default selling price ({business.currency_code})<input type="number" min="0" step="0.01" value={productPrice} onChange={e => setProductPrice(e.target.value)} placeholder="0.00" required /></label><button className="button primary" type="submit"><Plus size={16}/> Save product</button></form></section><section className="panel"><div className="panel-heading"><div><h3>Product list</h3><p>{products.length} active {products.length === 1 ? "product" : "products"}</p></div></div>{products.length ? <div className="product-list">{products.map(p => <div className="product-row" key={p.id}><span className="product-icon"><Package size={18}/></span><div className="product-meta"><strong>{p.name}</strong><small>{p.category} · per {p.unit_label}</small></div><strong className="product-price">{money(Number(p.default_unit_price),business.currency_code)}</strong></div>)}</div> : <EmptyState icon={Package} title="No products yet" description="Add your first product using the form." />}</section></div></>}
          {page === "Sales" && <><div className="section-intro"><div><p className="eyebrow">TRANSACTION LOG</p><h2>Record and review sales</h2><p className="muted">Add every item in one customer transaction. Receipts are optional.</p></div></div><div className="split-layout"><section className="panel"><div className="panel-heading"><div><h3>Record a sale</h3><p>One sale can include several different products.</p></div></div>{products.length ? <form className="form-stack" onSubmit={addSale}><div className="sale-lines">{saleItems.map((item,index) => <div className="sale-line" key={item.key}><div className="sale-line-heading"><strong>Item {index+1}</strong>{saleItems.length>1&&<button type="button" className="icon-button remove-line" aria-label="Remove item" onClick={()=>setSaleItems(items=>items.filter(line=>line.key!==item.key))}><X size={16}/></button>}</div><label>Product<select value={item.product_id} onChange={e=>updateSaleItem(item.key,"product_id",e.target.value)} required><option value="">Choose a product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {money(Number(p.default_unit_price),business.currency_code)}</option>)}</select></label><div className="form-two"><label>Quantity<input type="number" min="0.001" step="0.001" value={item.quantity} onChange={e=>updateSaleItem(item.key,"quantity",e.target.value)} required/></label><label>Unit price ({business.currency_code})<input type="number" min="0" step="0.01" value={item.unit_price} onChange={e=>updateSaleItem(item.key,"unit_price",e.target.value)} required/></label></div><div className="sale-line-total"><span>Item total</span><strong>{money((Number(item.quantity)||0)*(Number(item.unit_price)||0),business.currency_code)}</strong></div></div>)}</div><button className="button secondary add-line-button" type="button" onClick={()=>{setSaleItems(items=>[...items,{key:nextSaleItemKey,product_id:"",quantity:"1",unit_price:""}]);setNextSaleItemKey(key=>key+1);}}><Plus size={16}/> Add another product</button><div className="sale-total"><span>Overall total</span><strong>{money(saleTotal,business.currency_code)}</strong></div><label>Sale date<input type="date" value={saleDate} onChange={e=>setSaleDate(e.target.value)} required/></label><label>Employee name<input value={employeeName} onChange={e=>setEmployeeName(e.target.value)} maxLength={120} required/></label><label>Note <span className="optional">(optional)</span><textarea value={saleNote} onChange={e=>setSaleNote(e.target.value)} rows={2} placeholder="Any useful details…"/></label><div className="receipt-option"><label className="receipt-toggle"><input type="checkbox" checked={receiptEnabled} onChange={e=>{setReceiptEnabled(e.target.checked);if(!e.target.checked)setAmountReceived("");}}/><span className="toggle-track"/><span><strong>Create a receipt</strong><small>Save payment details and offer a printable receipt.</small></span></label>{receiptEnabled&&<div className="receipt-payment-fields"><label>Amount received ({business.currency_code})<input type="number" min={saleTotal} step="0.01" value={amountReceived} onChange={e=>setAmountReceived(e.target.value)} placeholder={saleTotal.toFixed(2)} required/></label><div className="change-summary"><span>Change due</span><strong>{money(changeDue,business.currency_code)}</strong></div><p className="field-note">The amount received must cover the sale total before a receipt can be issued.</p></div>}</div><button className="button primary" type="submit" disabled={savingSale}><Plus size={16}/>{savingSale?"Saving sale…":"Save sale"}{receiptEnabled?" & receipt":""}</button></form> : <EmptyState icon={Package} title="Add a product first" description="Create at least one product before recording a sale." action="Go to products" onAction={()=>setPage("Products")}/>}</section><section className="panel"><div className="panel-heading"><div><h3>Sales history</h3><p>{groupedSales.length} recorded transactions</p></div></div>{groupedSales.length?<div className="table-wrap"><table><thead><tr><th>Products / employee</th><th>Date</th><th>Units</th><th>Total</th></tr></thead><tbody>{groupedSales.map(s=><tr key={s.id}><td><strong>{s.items.map(item=>item.products?.name??products.find(p=>p.id===item.product_id)?.name??"Product").join(", ")}</strong><small>{s.employee_name}{s.note?" · "+s.note:""}</small></td><td>{readableDate(s.sold_on)}</td><td>{s.quantity}</td><td className="numeric">{money(s.total_value,business.currency_code)}</td></tr>)}</tbody></table></div>:<EmptyState icon={ShoppingCart} title="No sales recorded" description="Saved transactions will show here."/>}</section></div></>}
          {page === "Returns" && <><div className="section-intro"><div><p className="eyebrow">RETURNS LOG</p><h2>Keep returns transparent</h2><p className="muted">Returns are recorded separately and do not silently reduce sales totals.</p></div></div><div className="split-layout"><section className="panel"><div className="panel-heading"><div><h3>Record a return</h3><p>Document returned goods.</p></div></div>{products.length ? <form className="form-stack" onSubmit={addReturn}><label>Product<select value={returnProduct} onChange={e => setReturnProduct(e.target.value)} required><option value="">Choose a product</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="form-two"><label>Quantity returned<input type="number" min="0.001" step="0.001" value={returnQuantity} onChange={e => setReturnQuantity(e.target.value)} required /></label><label>Return date<input type="date" value={returnDate} onChange={e => setReturnDate(e.target.value)} required /></label></div><label>Recorded by<input value={employeeName} onChange={e => setEmployeeName(e.target.value)} required /></label><label>Reason <span className="optional">(optional)</span><textarea rows={2} value={returnReason} onChange={e => setReturnReason(e.target.value)} placeholder="e.g. Damaged packaging" /></label><button className="button primary"><Plus size={16}/> Save return</button></form> : <EmptyState icon={Package} title="Add a product first" description="Returns are linked to products in your catalogue." action="Go to products" onAction={() => setPage("Products")} />}</section><section className="panel"><div className="panel-heading"><div><h3>Returns history</h3><p>{returns.length} return entries</p></div></div>{returns.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Date</th><th>Quantity</th><th>Reason</th></tr></thead><tbody>{returns.map(r => <tr key={r.id}><td><strong>{r.products?.name ?? "Product"}</strong><small>{r.employee_name}</small></td><td>{readableDate(r.returned_on)}</td><td>{r.quantity}</td><td>{r.reason || "—"}</td></tr>)}</tbody></table></div> : <EmptyState icon={RotateCcw} title="No returns recorded" description="Any returns you record will appear here." />}</section></div></>}
          {page === "Receipts" && <><div className="section-intro"><div><p className="eyebrow">PAYMENT RECORDS</p><h2>Receipts</h2><p className="muted">Receipts are stored separately and do not create extra sales or change report totals.</p></div></div><section className="panel"><div className="panel-heading"><div><h3>Issued receipts</h3><p>{receipts.length} {receipts.length===1?"receipt":"receipts"} saved</p></div></div>{receipts.length?<div className="table-wrap"><table><thead><tr><th>Receipt</th><th>Date</th><th>Total</th><th>Received</th><th>Change</th><th>Print</th></tr></thead><tbody>{receipts.map(receipt=><tr key={receipt.id}><td><strong>{receipt.receipt_number}</strong></td><td>{readableDate(receipt.created_at.slice(0,10))}</td><td className="numeric">{money(Number(receipt.total_amount),business.currency_code)}</td><td className="numeric">{money(Number(receipt.amount_received),business.currency_code)}</td><td className="numeric">{money(Number(receipt.change_due),business.currency_code)}</td><td><button className="button secondary small-button" onClick={()=>printReceipt(receipt)}><ReceiptText size={15}/> Print</button></td></tr>)}</tbody></table></div>:<EmptyState icon={ReceiptText} title="No receipts yet" description="Turn on “Create a receipt” while recording a sale to save a receipt here." action="Record a sale" onAction={()=>setPage("Sales")}/>}</section></>}
          {page === "Reports" && <><div className="section-intro"><div><p className="eyebrow">SALES INSIGHTS</p><h2>Reports that answer real questions</h2><p className="muted">Choose a period to summarise saved sales and returns.</p></div><button className="button secondary" onClick={downloadReport}><Download size={16}/> Download TXT</button></div><section className="panel report-controls"><label>Report period<select value={reportPeriod} onChange={e => setReportPeriod(e.target.value as typeof reportPeriod)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="yearly">Yearly</option></select></label><label>Choose a date<input type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} /></label><div className="period-caption"><CalendarDays size={16}/> {readableDate(reportRows.start)} – {readableDate(reportRows.end)}</div></section><div className="metric-grid report-metrics"><Metric icon={TrendingUp} label="Sales value" value={money(reportValue,business.currency_code)} hint="Before returns" tone="accent"/><Metric icon={ShoppingBag} label="Units sold" value={reportUnits.toLocaleString()} hint="Recorded quantities" tone="blue"/><Metric icon={RotateCcw} label="Returned units" value={reportRows.returns.reduce((sum,r)=>sum+Number(r.quantity||0),0).toLocaleString()} hint="Listed separately" tone="orange"/></div><section className="panel"><div className="panel-heading"><div><h3>Sales by product</h3><p>{new Set(reportRows.sales.map(s => s.transaction_id || s.id)).size} transactions in this period</p></div></div>{reportRows.products.length ? <div className="table-wrap"><table><thead><tr><th>Product</th><th>Units sold</th><th>Sales value</th></tr></thead><tbody>{reportRows.products.map(p=><tr key={p.name}><td><strong>{p.name}</strong></td><td>{p.units}</td><td className="numeric">{money(p.value,business.currency_code)}</td></tr>)}</tbody></table></div> : <EmptyState icon={BarChart3} title="Nothing to report yet" description="Once sales are recorded in this period, the report will appear here."/>}</section><p className="report-footnote">Reports are calculated from saved transactions. Returns are shown separately and are not deducted from sales.</p></>}
          {page === "Settings" && <><div className="section-intro"><div><p className="eyebrow">YOUR PREFERENCES</p><h2>Make Kwacha Sales feel like yours</h2><p className="muted">Choose the appearance that feels right for your workspace.</p></div></div><section className="panel settings-panel"><div className="panel-heading"><div><h3>Appearance</h3><p>Your theme is saved in this browser.</p></div></div><div className="theme-grid">{([{id:"light",name:"Light",description:"Bright and clean",icon:Sun},{id:"dark",name:"Dark",description:"Low-light comfort",icon:Moon},{id:"graphite",name:"Graphite",description:"Quiet, modern neutrals",icon:Activity},{id:"green",name:"Evergreen",description:"A natural green accent",icon:Leaf}] as const).map(t => { const Icon=t.icon; return <button key={t.id} className={theme===t.id?"theme-card selected":"theme-card"} onClick={()=>setTheme(t.id)}><span className={"theme-swatch "+t.id}><Icon size={20}/></span><span className="theme-card-copy"><strong>{t.name}</strong><small>{t.description}</small></span>{theme===t.id&&<Check className="theme-check" size={17}/>}</button>; })}</div></section><section className="panel account-settings"><div className="panel-heading"><div><h3>Business details</h3><p>Workspace information</p></div></div><div className="detail-row"><span>Business name</span><strong>{business.name}</strong></div><div className="detail-row"><span>Currency</span><strong>{business.currency_code}</strong></div><div className="detail-row"><span>Signed in as</span><strong>{session.user.email}</strong></div><div className="detail-row"><span>Inventory tracking</span><span className="status-pill">Optional module · not enabled</span></div><p className="field-note">The product catalogue works without stock counts. We'll add the optional stock tracking workflow separately so it never blocks sales entry.</p></section></>}
          <footer className="content-footer"><span>Kwacha Sales · A clearer view of your business</span><span><ShieldCheck size={14}/> Your records are synced to your workspace</span></footer>
        </div>
      </main>
    </div>
  );
}

function Metric({ icon: Icon, label, value, hint, tone }: { icon: typeof TrendingUp; label: string; value: string; hint: string; tone: string }) {
  return <section className="metric-card"><div className={"metric-icon "+tone}><Icon size={18}/></div><span className="metric-label">{label}</span><strong className="metric-value">{value}</strong><small>{hint}</small></section>;
}
function EmptyState({ icon: Icon, title, description, action, onAction }: { icon: typeof Package; title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={22}/></span><h4>{title}</h4><p>{description}</p>{action && onAction && <button className="text-button" onClick={onAction}>{action} <ArrowRight size={15}/></button>}</div>;
}
function QuickAction({ icon: Icon, title, detail, onClick }: { icon: typeof ShoppingCart; title: string; detail: string; onClick: () => void }) {
  return <button className="quick-action" onClick={onClick}><span className="quick-icon"><Icon size={18}/></span><span><strong>{title}</strong><small>{detail}</small></span><ArrowRight size={16}/></button>;
}
