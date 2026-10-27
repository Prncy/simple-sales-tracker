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

type LegalPage = "terms" | "privacy" | null;
type PasswordStrength = { score: number; label: string; feedback: string[] };
function assessPassword(value: string): PasswordStrength {
  const checks = [
    value.length >= 8,
    value.length >= 12,
    /[a-z]/.test(value) && /[A-Z]/.test(value),
    /\d/.test(value),
    /[^A-Za-z0-9]/.test(value)
  ];
  const score = checks.filter(Boolean).length;
  const label = !value ? "Not entered" : score <= 2 ? "Weak" : score === 3 ? "Fair" : score === 4 ? "Good" : "Strong";
  const feedback: string[] = [];
  if (value.length < 8) feedback.push("Use at least 8 characters");
  else if (value.length < 12) feedback.push("A longer password (12+ characters) is safer");
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value)) feedback.push("Mix uppercase and lowercase letters");
  if (!/\d/.test(value)) feedback.push("Add a number");
  if (!/[^A-Za-z0-9]/.test(value)) feedback.push("Add a symbol");
  return { score, label, feedback };
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("kwacha-sales-theme") ?? localStorage.getItem("stockwise-theme");
    return saved === "light" || saved === "dark" || saved === "green" || saved === "graphite" ? saved : "graphite";
  });
  const [session, setSession] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [authScreen, setAuthScreen] = useState<"auth" | "forgot" | "reset">(() => new URLSearchParams(window.location.hash.replace(/^#/, "")).get("type") === "recovery" ? "reset" : "auth");
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirmPassword, setResetConfirmPassword] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [legalPage, setLegalPage] = useState<LegalPage>(null);
  const passwordStrength = assessPassword(password);
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
    const updateOnlineStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnlineStatus);
    window.addEventListener("offline", updateOnlineStatus);
    return () => { window.removeEventListener("online", updateOnlineStatus); window.removeEventListener("offline", updateOnlineStatus); };
  }, []);

  useEffect(() => {
    if (!supabase) { setAuthLoading(false); return; }
    const queryParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const callbackError = queryParams.get("error_description") || hashParams.get("error_description") || queryParams.get("error");
    const isAuthCallback = hashParams.has("access_token") || queryParams.has("code") || queryParams.has("token_hash");
    if (hashParams.get("type") === "recovery" || queryParams.get("type") === "recovery") setAuthScreen("reset");
    if (callbackError) setAuthError(callbackError.replace(/\+/g, " "));
    supabase.auth.getSession().then(({ data, error: sessionError }) => {
      setSession(data.session);
      setAuthLoading(false);
      if (sessionError) setAuthError(sessionError.message);
      if (data.session && isAuthCallback) setNotice("Email confirmed successfully. Your account is ready.");
      if (isAuthCallback || callbackError) window.history.replaceState({}, document.title, window.location.pathname);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      setSession(nextSession);
      if (event === "PASSWORD_RECOVERY") setAuthScreen("reset");
    });
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
    if (authMode === "signup") {
      if (password !== confirmPassword) { setAuthError("Your passwords don't match yet."); return; }
      if (passwordStrength.score < 3 || password.length < 8) { setAuthError("Please choose a stronger password before creating your account."); return; }
      if (!termsAccepted) { setAuthError("Please agree to the Terms of Use and acknowledge the Privacy Policy to continue."); return; }
    }
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

  async function requestPasswordReset(event: FormEvent) {
    event.preventDefault(); setAuthError(""); setAuthMessage("");
    if (!supabase) return;
    setAuthLoading(true);
    try {
      const redirectTo = new URL(import.meta.env.BASE_URL, window.location.origin).toString();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
      if (resetError) throw resetError;
      setAuthMessage("If an account exists for that email, a password-reset link has been sent. Check your inbox and spam folder.");
    } catch (e) { setAuthError(e instanceof Error ? e.message : "We couldn't send a reset link. Please try again."); }
    finally { setAuthLoading(false); }
  }

  async function saveRecoveredPassword(event: FormEvent) {
    event.preventDefault(); setAuthError(""); setAuthMessage("");
    if (!supabase) return;
    const strength = assessPassword(resetPassword);
    if (resetPassword !== resetConfirmPassword) { setAuthError("Your passwords don't match yet."); return; }
    if (resetPassword.length < 8 || strength.score < 3) { setAuthError("Please choose a stronger password before continuing."); return; }
    setPasswordSaving(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: resetPassword });
      if (updateError) throw updateError;
      await supabase.auth.signOut();
      setSession(null); setPassword(""); setResetPassword(""); setResetConfirmPassword("");
      setAuthMode("signin"); setAuthScreen("auth");
      setAuthMessage("Your password has been reset. Sign in with your new password.");
      window.history.replaceState({}, document.title, window.location.pathname);
    } catch (e) { setAuthError(e instanceof Error ? e.message : "We couldn't update your password. Request a new reset link and try again."); }
    finally { setPasswordSaving(false); }
  }

  async function changeAccountPassword(event: FormEvent) {
    event.preventDefault(); setError(""); setNotice("");
    if (!supabase || !session?.user?.email) return;
    const strength = assessPassword(newPassword);
    if (newPassword !== confirmNewPassword) { setError("Your new passwords don't match."); return; }
    if (newPassword.length < 8 || strength.score < 3) { setError("Choose a stronger password before saving."); return; }
    setPasswordSaving(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: session.user.email, password: currentPassword });
      if (verifyError) throw new Error("Your current password wasn't accepted. Please check it and try again.");
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) throw updateError;
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
      setNotice("Password changed successfully.");
    } catch (e) { setError(e instanceof Error ? e.message : "We couldn't change your password. Please try again."); }
    finally { setPasswordSaving(false); }
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
  if (authScreen === "forgot") return (
    <main className="auth-layout" data-theme={theme}>
      <section className="auth-story"><a className="brand" href="#home"><span className="brand-mark"><Store size={20}/></span><span>Kwacha Sales<span className="brand-period">.</span></span></a><div className="auth-story-copy"><span className="eyebrow">ACCOUNT RECOVERY</span><h1>Back to business.<br/><span>We can help.</span></h1><p>Request a secure password reset link using the email address on your account.</p></div><div className="auth-footer"><span>Kwacha Sales · Simple sales. Clear numbers.</span></div></section>
      <section className="auth-form-panel"><div className="auth-card"><button type="button" className="text-button back-to-auth" onClick={() => { setAuthScreen("auth"); setAuthError(""); setAuthMessage(""); }}>← Back to sign in</button><p className="eyebrow">ACCOUNT RECOVERY</p><h2>Forgot your password?</h2><p className="muted">Enter your email and we will send a reset link if an account matches.</p>
        {authError && <div className="alert error" role="alert">{authError}</div>}{authMessage && <div className="alert success" role="status">{authMessage}</div>}
        <form className="form-stack" onSubmit={requestPasswordReset}><label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required/></label><button className="button primary full" type="submit" disabled={authLoading}>{authLoading?"Sending link…":"Send reset link"} <ArrowRight size={17}/></button></form>
        <p className="privacy-note"><ShieldCheck size={15}/> For privacy, this screen will not reveal whether an account exists for that email.</p></div></section>
    </main>
  );

  if (authScreen === "reset") return (
    <main className="auth-layout" data-theme={theme}>
      <section className="auth-story"><a className="brand" href="#home"><span className="brand-mark"><Store size={20}/></span><span>Kwacha Sales<span className="brand-period">.</span></span></a><div className="auth-story-copy"><span className="eyebrow">ACCOUNT SECURITY</span><h1>A fresh start.<br/><span>A stronger password.</span></h1><p>Choose a new password to get back to your business workspace.</p></div><div className="auth-footer"><span>Kwacha Sales · Simple sales. Clear numbers.</span></div></section>
      <section className="auth-form-panel"><div className="auth-card"><p className="eyebrow">RESET PASSWORD</p><h2>Choose a new password.</h2><p className="muted">Use a strong password you do not use for another account.</p>
        {authError && <div className="alert error" role="alert">{authError}</div>}
        <form className="form-stack" onSubmit={saveRecoveredPassword}>
          <label>New password<input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} autoComplete="new-password" minLength={8} required placeholder="At least 8 characters"/></label>
          <div className="password-strength"><div className="strength-heading"><span>Password strength</span><strong data-strength={assessPassword(resetPassword).label.toLowerCase()}>{assessPassword(resetPassword).label}</strong></div><div className="strength-meter" role="img" aria-label={"Password strength: " + assessPassword(resetPassword).label}>{[1,2,3,4,5].map(level=><span key={level} className={assessPassword(resetPassword).score>=level?"filled":""} data-strength={assessPassword(resetPassword).label.toLowerCase()}/>)}</div><p>{assessPassword(resetPassword).feedback.join(" · ") || "Use a unique password for this account."}</p></div>
          <label>Confirm new password<input type="password" value={resetConfirmPassword} onChange={e=>setResetConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} required placeholder="Enter it again"/><span className={resetConfirmPassword.length===0?"field-help":resetConfirmPassword===resetPassword?"field-help match":"field-help mismatch"}>{resetConfirmPassword.length===0?"Confirm your new password.":resetConfirmPassword===resetPassword?"Passwords match.":"Passwords do not match."}</span></label>
          <button className="button primary full" type="submit" disabled={passwordSaving}>{passwordSaving?"Updating password…":"Save new password"} <ArrowRight size={17}/></button>
        </form></div></section>
    </main>
  );
  if (!session) return (
    <main className="auth-layout" data-theme={theme}>
      <section className="auth-story">
        <a className="brand" href="#home"><span className="brand-mark"><Store size={20} /></span><span>Kwacha Sales<span className="brand-period">.</span></span></a>
        <div className="auth-story-copy"><span className="eyebrow"><span className="eyebrow-dot" /> SMALL BUSINESS, CLEARER NUMBERS</span><h1>Know your sales.<br /><span>Run your business.</span></h1><p>A straightforward place to record sales, keep product details, and understand how your business is doing.</p><div className="story-points"><span><Check size={16} /> Simple sales records</span><span><Check size={16} /> Reports when you need them</span><span><ShieldCheck size={16} /> Your business data stays yours</span></div></div>
        <div className="auth-footer"><span>Made for everyday business · Kwacha Sales © 2026</span><span className="legal-footer-links"><button type="button" onClick={() => setLegalPage("terms")}>Terms of Use</button><button type="button" onClick={() => setLegalPage("privacy")}>Privacy Policy</button></span></div>
      </section>
      <section className="auth-form-panel" id="home"><div className="auth-card">
        <div className="auth-tabs"><button type="button" className={authMode === "signup" ? "selected" : ""} onClick={() => { setAuthMode("signup"); setAuthError(""); setAuthMessage(""); setConfirmPassword(""); setTermsAccepted(false); }}>Create account</button><button type="button" className={authMode === "signin" ? "selected" : ""} onClick={() => { setAuthMode("signin"); setAuthError(""); setAuthMessage(""); setConfirmPassword(""); setTermsAccepted(false); }}>Sign in</button></div>
        <p className="eyebrow">{authMode === "signup" ? "GET STARTED" : "WELCOME BACK"}</p><h2>{authMode === "signup" ? "Build a clearer picture." : "Good to see you again."}</h2><p className="muted">{authMode === "signup" ? "Create an account to set up your business workspace." : "Sign in to continue to your business."}</p>
        {authError && <div className="alert error" role="alert">{authError}</div>}{authMessage && <div className="alert success" role="status">{authMessage}</div>}
        <form className="form-stack" onSubmit={handleAuth}>
          {authMode === "signup" && <label>Full name<input value={fullName} onChange={e => setFullName(e.target.value)} autoComplete="name" placeholder="Your name" required /></label>}
          <label>Email address<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="you@example.com" required /></label>
          <label>Password<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={authMode === "signup" ? "new-password" : "current-password"} minLength={8} placeholder="At least 8 characters" required aria-describedby={authMode === "signup" ? "password-strength-help" : undefined} />
            {authMode === "signup" && <div className="password-strength" id="password-strength-help" aria-live="polite">
              <div className="strength-heading"><span>Password strength</span><strong data-strength={passwordStrength.label.toLowerCase().replace(" ", "-")}>{passwordStrength.label}</strong></div>
              <div className="strength-meter" role="img" aria-label={`Password strength: ${passwordStrength.label}`}>{[1,2,3,4,5].map(level => <span key={level} className={passwordStrength.score >= level ? "filled" : ""} data-strength={passwordStrength.label.toLowerCase().replace(" ", "-")} />)}</div>
              <p>{passwordStrength.feedback.length ? passwordStrength.feedback.join(" · ") : "Good mix. Consider using a unique passphrase you don't use elsewhere."}</p>
            </div>}
          </label>
          {authMode === "signin" && <button type="button" className="text-button forgot-link" onClick={() => { setAuthScreen("forgot"); setAuthError(""); setAuthMessage(""); }}>Forgot password?</button>}
          {authMode === "signup" && <label>Confirm password<input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} autoComplete="new-password" minLength={8} placeholder="Enter the same password again" required aria-invalid={confirmPassword.length > 0 && confirmPassword !== password} aria-describedby="confirm-password-help" />
            <span className={confirmPassword.length === 0 ? "field-help" : confirmPassword === password ? "field-help match" : "field-help mismatch"} id="confirm-password-help">{confirmPassword.length === 0 ? "Re-enter your password to confirm it." : confirmPassword === password ? "Passwords match." : "Passwords do not match yet."}</span>
          </label>}
          {authMode === "signup" && <div className="terms-consent"><input id="terms-accepted" type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} required /><label htmlFor="terms-accepted">I agree to the <button type="button" className="inline-legal-link" onClick={() => setLegalPage("terms")}>Terms of Use</button> and acknowledge the <button type="button" className="inline-legal-link" onClick={() => setLegalPage("privacy")}>Privacy Policy</button>.</label></div>}
          <button className="button primary full" type="submit" disabled={authLoading}>{authLoading ? "Please wait…" : authMode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={17} /></button>
        </form><p className="privacy-note"><ShieldCheck size={15} /> Your password is handled securely by Supabase Auth.</p>
      </div><div className="theme-mini"><span>Appearance</span>{(["light","dark","graphite","green"] as Theme[]).map(t => <button key={t} className={theme === t ? "theme-dot selected" : "theme-dot"} data-theme-choice={t} aria-label={t + " theme"} title={t} onClick={() => setTheme(t)} />)}</div></section>
      {legalPage && <div className="legal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setLegalPage(null); }}><section className="legal-dialog" role="dialog" aria-modal="true" aria-labelledby="legal-dialog-title"><header className="legal-dialog-header"><div><p className="eyebrow">KWACHA SALES · LAST UPDATED 27 OCTOBER 2026</p><h2 id="legal-dialog-title">{legalPage === "terms" ? "Terms of Use" : "Privacy Policy"}</h2></div><button type="button" className="legal-close" aria-label="Close document" onClick={() => setLegalPage(null)}><X size={19} /></button></header>
        <div className="legal-document">
          {legalPage === "terms" ? <>
            <p>These Terms of Use explain the conditions for using Kwacha Sales. By creating an account or using the service, you agree to these terms. If you do not agree, do not use the service.</p>
            <h3>1. The service</h3><p>Kwacha Sales provides tools for recording product sales, products, returns and receipts, and viewing business reports. Features may change as the service develops. We may temporarily suspend access for maintenance, security, or operational reasons.</p>
            <h3>2. Your account</h3><p>Provide accurate registration information, keep your sign-in credentials confidential, and tell us promptly if you suspect unauthorized access. You are responsible for activity carried out through your account, except where applicable law says otherwise. You must be legally able to enter into these terms.</p>
            <h3>3. Business records and acceptable use</h3><p>You are responsible for the accuracy and lawfulness of the information you enter, including product prices, sales, returns, employee details, and receipt amounts. Only enter personal information you are authorized to use. Do not misuse the service, attempt unauthorized access, interfere with its operation, or use it for unlawful activity.</p>
            <h3>4. Reports and financial decisions</h3><p>Reports and totals are provided as record-keeping aids. They are not accounting, tax, legal, or financial advice and may be affected by incorrect or incomplete entries. You remain responsible for checking your records and meeting your tax, accounting, consumer-protection, and other legal obligations.</p>
            <h3>5. Data, backups and security</h3><p>We use access controls intended to keep business records available only to authorized users. No online service can promise perfect security or uninterrupted availability. You should keep any additional records or backups you need for your business.</p>
            <h3>6. Availability and changes</h3><p>We aim to keep the service useful and reliable, but provide it on an evolving basis. Features may be updated, discontinued, or temporarily unavailable. We will make reasonable efforts to communicate material changes where appropriate.</p>
            <h3>7. Disclaimer and liability</h3><p>To the extent permitted by applicable law, the service is provided without a guarantee that it will be error-free or always available. Nothing in these terms excludes a right or liability that cannot lawfully be excluded. To the extent permitted by law, Kwacha Sales is not responsible for indirect losses arising from reliance on inaccurate entries, interruptions, or inability to use the service.</p>
            <h3>8. Suspension and termination</h3><p>You may stop using the service at any time. We may restrict or suspend access where reasonably necessary to protect users, investigate abuse, comply with law, or address a serious breach of these terms.</p>
            <h3>9. Privacy and updates</h3><p>Our Privacy Policy explains how information is handled. We may update these terms as the service changes. Continued use after an update takes effect means you accept the revised terms where permitted by law.</p>
            <h3>10. Applicable law and contact</h3><p>These terms are subject to applicable laws of Zambia and any mandatory consumer protections that apply to you. For questions about these terms, contact the Kwacha Sales service operator through the contact channel provided to you for this service.</p>
          </> : <>
            <p>This Privacy Policy describes how Kwacha Sales handles information when you create an account and use the service.</p>
            <h3>1. Information we collect</h3><p><strong>Account information:</strong> your email address, account identifier, and the name you provide. <strong>Business information:</strong> business name, product catalogue, prices, sales, quantities, returns, employee names entered into records, receipt totals, amounts received, and change due. <strong>Technical and security information:</strong> authentication/session data managed by our identity provider and limited database security counters used to control repeated write requests.</p>
            <h3>2. How information is used</h3><p>We use this information to create and secure accounts, provide sales tracking and reporting, save business records, generate receipts, troubleshoot issues, prevent abuse, and maintain the service. We do not use your sales records to provide personalized advertising in this version of the service.</p>
            <h3>3. Where information is stored and service providers</h3><p>Account and business data are stored using Supabase authentication and database infrastructure. The web application is hosted using GitHub Pages. These providers process technical information as needed to deliver their services and may process or store information in locations outside Zambia. Their own terms and privacy practices may also apply.</p>
            <h3>4. Sharing</h3><p>We do not sell your personal information. Information may be processed by the providers described above, disclosed when required by law, or shared where reasonably necessary to protect the service, its users, or legal rights. Business records should only be accessible to authorized users under the configured access controls.</p>
            <h3>5. Security</h3><p>We use measures such as authenticated access, database access policies, and request limits intended to protect information. No security measure is perfect, so avoid storing sensitive information that the service does not need and protect your account credentials.</p>
            <h3>6. Retention and your choices</h3><p>We retain account and business information while needed to operate the service, maintain business records, resolve disputes, and meet legal obligations. The current app may not provide an in-app account deletion feature. To request access, correction, or deletion, contact the Kwacha Sales service operator through the contact channel provided to you. Some information may need to be retained where the law permits or requires it.</p>
            <h3>7. Children</h3><p>Kwacha Sales is intended for business users and is not designed for children to create accounts independently.</p>
            <h3>8. Changes and privacy rights</h3><p>This policy may be updated as the service changes. Depending on applicable law, you may have rights to access, correct, object to certain processing, or request deletion of your personal information. We will handle requests in accordance with applicable law, including relevant Zambian data-protection requirements.</p>
            <h3>9. Contact</h3><p>For privacy questions or requests, contact the Kwacha Sales service operator through the contact channel provided to you for this service. Before public launch, the operator should publish a monitored privacy contact address.</p>
          </>}
        </div><footer className="legal-dialog-footer"><button type="button" className="button primary" onClick={() => setLegalPage(null)}>Close</button></footer></section></div>}
    </main>
  );

  if (workspaceLoading) return <main className="loading-screen"><div className="loading-mark"><Store /></div><p>Loading your business…</p></main>;
  if (!business) return <main className="onboarding-screen" data-theme={theme}><div className="onboarding-card"><span className="brand-mark"><Store /></span><p className="eyebrow">ONE QUICK STEP</p><h1>Set up your business</h1><p className="muted">This workspace keeps your products, sales, and reports together.</p>{error && <div className="alert error">{error}</div>}<form className="form-stack" onSubmit={createBusiness}><label>Business name<input value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Banda General Dealers" maxLength={120} required /></label><label>Your name for sales records<input value={employeeName} onChange={e => setEmployeeName(e.target.value)} placeholder="Name shown on transactions" maxLength={120} required /></label><div className="field-note">Default currency: ZMW (Zambian Kwacha)</div><button className="button primary full" disabled={workspaceLoading}>Create workspace <ArrowRight size={17} /></button></form></div></main>;

  return (
    <div className="app-frame" data-theme={theme}>
      {!isOnline && <div className="offline-banner" role="status"><strong>You’re offline.</strong> Kwacha Sales can open, but saving sales, products, returns, and receipts requires an internet connection. Reconnect before recording transactions.</div>}
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
          {page === "Settings" && <><div className="section-intro"><div><p className="eyebrow">YOUR PREFERENCES</p><h2>Make Kwacha Sales feel like yours</h2><p className="muted">Choose the appearance that feels right for your workspace.</p></div></div><section className="panel settings-panel"><div className="panel-heading"><div><h3>Appearance</h3><p>Your theme is saved in this browser.</p></div></div><div className="theme-grid">{([{id:"light",name:"Light",description:"Bright and clean",icon:Sun},{id:"dark",name:"Dark",description:"Low-light comfort",icon:Moon},{id:"graphite",name:"Graphite",description:"Quiet, modern neutrals",icon:Activity},{id:"green",name:"Evergreen",description:"A natural green accent",icon:Leaf}] as const).map(t => { const Icon=t.icon; return <button key={t.id} className={theme===t.id?"theme-card selected":"theme-card"} onClick={()=>setTheme(t.id)}><span className={"theme-swatch "+t.id}><Icon size={20}/></span><span className="theme-card-copy"><strong>{t.name}</strong><small>{t.description}</small></span>{theme===t.id&&<Check className="theme-check" size={17}/>}</button>; })}</div></section><section className="panel password-settings"><div className="panel-heading"><div><h3>Change password</h3><p>Confirm your current password before saving a new one.</p></div></div>
<form className="form-stack password-change-form" onSubmit={changeAccountPassword}>
  <label>Current password<input type="password" value={currentPassword} onChange={e=>setCurrentPassword(e.target.value)} autoComplete="current-password" required/></label>
  <label>New password<input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required/></label>
  <div className="password-strength"><div className="strength-heading"><span>Password strength</span><strong data-strength={assessPassword(newPassword).label.toLowerCase()}>{assessPassword(newPassword).label}</strong></div><div className="strength-meter" role="img" aria-label={"Password strength: " + assessPassword(newPassword).label}>{[1,2,3,4,5].map(level=><span key={level} className={assessPassword(newPassword).score>=level?"filled":""} data-strength={assessPassword(newPassword).label.toLowerCase()}/>)}</div><p>{assessPassword(newPassword).feedback.join(" · ") || "Use a unique password for this account."}</p></div>
  <label>Confirm new password<input type="password" value={confirmNewPassword} onChange={e=>setConfirmNewPassword(e.target.value)} autoComplete="new-password" minLength={8} required/><span className={confirmNewPassword.length===0?"field-help":confirmNewPassword===newPassword?"field-help match":"field-help mismatch"}>{confirmNewPassword.length===0?"Enter your new password again.":confirmNewPassword===newPassword?"Passwords match.":"Passwords do not match."}</span></label>
  <button className="button primary" type="submit" disabled={passwordSaving}>{passwordSaving?"Changing password…":"Change password"} <ArrowRight size={16}/></button>
</form></section>
<section className="panel account-settings"><div className="panel-heading"><div><h3>Business details</h3><p>Workspace information</p></div></div><div className="detail-row"><span>Business name</span><strong>{business.name}</strong></div><div className="detail-row"><span>Currency</span><strong>{business.currency_code}</strong></div><div className="detail-row"><span>Signed in as</span><strong>{session.user.email}</strong></div><div className="detail-row"><span>Inventory tracking</span><span className="status-pill">Optional module · not enabled</span></div><p className="field-note">The product catalogue works without stock counts. We'll add the optional stock tracking workflow separately so it never blocks sales entry.</p></section></>}
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
