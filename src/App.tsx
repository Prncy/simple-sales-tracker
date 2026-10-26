import { useEffect, useState, type FormEvent } from "react";
import "./auth.css";
import type { Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "./lib/supabase";
import { BarChart3, LogOut, Package, Plus, ShoppingBag, ArrowDownLeft, FileText, LayoutDashboard, Download } from "lucide-react";

type Product = { id:string; name:string; category:string; unit:string; price:number };
type Sale = { id:string; productId:string; productName:string; quantity:number; unitPrice:number; soldAt:string; employee:string };
type ReturnRecord = { id:string; productId:string; productName:string; quantity:number; returnedAt:string; reason:string };
type Business = { id:string; name:string; currency_code:string };
type Page = "Overview"|"Sales"|"Products"|"Returns"|"Reports";
const today = new Date().toISOString().slice(0,10);
const money=(n:number,currency="ZMW")=>new Intl.NumberFormat("en-ZM",{style:"currency",currency,maximumFractionDigits:2}).format(n);
const dateLabel=(v:string)=>new Date(v+"T12:00:00").toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"});

export default function App(){
 const [session,setSession]=useState<Session|null>(null);
 const [authLoading,setAuthLoading]=useState(true);
 const [authMode,setAuthMode]=useState<"signin"|"signup">("signup");
 const [authError,setAuthError]=useState("");
 const [authBusy,setAuthBusy]=useState(false);
 const [displayName,setDisplayName]=useState("");
 const [email,setEmail]=useState("");
 const [password,setPassword]=useState("");
 useEffect(()=>{
  if(!supabase){setAuthLoading(false);return;}
  supabase.auth.getSession().then(({data})=>{setSession(data.session);setAuthLoading(false);});
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,next)=>{setSession(next);});
  return ()=>subscription.unsubscribe();
 },[]);
 async function authenticate(e:FormEvent){
  e.preventDefault(); if(!supabase)return; setAuthBusy(true);setAuthError("");
  try{
   if(authMode==="signup"){
    const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{display_name:displayName.trim()}}});
    if(error)throw error;
    if(!data.session){setAuthError("Account created. Check your email to confirm, then sign in.");return;}
    await supabase.from("profiles").upsert({id:data.user!.id,display_name:displayName.trim()});
   }else{
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;
   }
  }catch(err){setAuthError(err instanceof Error?err.message:"Could not authenticate.");}
  finally{setAuthBusy(false);}
 }
 if(!isSupabaseConfigured)return <AuthShell title="Connect your Supabase project" message="Add the project URL and publishable key to your environment before using authentication." />;
 if(authLoading)return <AuthShell title="Loading Stockwise…" message="Checking your account session." />;
 if(!session)return <div className="auth-page"><div className="auth-card"><div className="brand-mark"><ShoppingBag size={20}/></div><div className="eyebrow">STOCK & SALES TRACKER</div><h1>{authMode==="signup"?"Create your account":"Welcome back"}</h1><p>{authMode==="signup"?"Create an employee account to start tracking business sales.":"Sign in to continue to your business workspace."}</p><form className="form-stack" onSubmit={authenticate}>{authMode==="signup"&&<label>Your name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} autoComplete="name" required/></label>}<label>Email address<input type="email" value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" required/></label><label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete={authMode==="signup"?"new-password":"current-password"} minLength={6} required/></label>{authError&&<div className="auth-error" role="alert">{authError}</div>}<button className="primary-button" disabled={authBusy}>{authBusy?"Please wait…":authMode==="signup"?"Create account":"Sign in"}</button></form><button className="auth-switch" onClick={()=>{setAuthMode(authMode==="signup"?"signin":"signup");setAuthError("");}}>{authMode==="signup"?"Already have an account? Sign in":"New to Stockwise? Create an account"}</button><small className="auth-foot">Your account data is protected by Supabase authentication and database access policies.</small></div></div>;
 return <Workspace session={session} onSignOut={()=>supabase?.auth.signOut()}/>;
}

function AuthShell({title,message}:{title:string;message:string}){return <div className="auth-page"><div className="auth-card"><div className="brand-mark"><ShoppingBag size={20}/></div><h1>{title}</h1><p>{message}</p></div></div>}

function Workspace({session,onSignOut}:{session:Session;onSignOut:()=>void}){
 const [business,setBusiness]=useState<Business|null>(null);
 const [businessName,setBusinessName]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [products,setProducts]=useState<Product[]>([]);
 const [sales,setSales]=useState<Sale[]>([]);
 const [returns,setReturns]=useState<ReturnRecord[]>([]);
 const [page,setPage]=useState<Page>("Overview");
 const [showProduct,setShowProduct]=useState(false);
 const [showSale,setShowSale]=useState(false);
 const [showReturn,setShowReturn]=useState(false);
 const [notice,setNotice]=useState("");
 const [month,setMonth]=useState(today.slice(0,7));
 const [search,setSearch]=useState("");
 const [employee,setEmployee]=useState(session.user.user_metadata?.display_name||session.user.email||"Employee");
 const currency=business?.currency_code||"ZMW";
 const notify=(m:string)=>{setNotice(m);window.setTimeout(()=>setNotice(""),3000);};
 async function loadBusiness(){
  if(!supabase)return;
  setLoading(true);setError("");
  const {data,error}=await supabase.from("businesses").select("id,name,currency_code").eq("owner_user_id",session.user.id).order("created_at").limit(1).maybeSingle();
  if(error){setError(error.message);setLoading(false);return;}
  if(!data){setBusiness(null);setLoading(false);return;}
  setBusiness(data as Business);
  const [p,s,r]=await Promise.all([
   supabase.from("products").select("id,name,category,unit_label,default_unit_price").eq("business_id",data.id).eq("is_active",true).order("name"),
   supabase.from("sales").select("id,product_id,employee_name,quantity,unit_price,sold_on,products(name)").eq("business_id",data.id).order("sold_on",{ascending:false}),
   supabase.from("returns").select("id,product_id,employee_name,quantity,returned_on,reason,products(name)").eq("business_id",data.id).order("returned_on",{ascending:false})
  ]);
  if(p.error||s.error||r.error){setError(p.error?.message||s.error?.message||r.error?.message||"Could not load records.");setLoading(false);return;}
  setProducts((p.data||[]).map((x:any)=>({id:x.id,name:x.name,category:x.category,unit:x.unit_label,price:Number(x.default_unit_price)})));
  setSales((s.data||[]).map((x:any)=>({id:x.id,productId:x.product_id,productName:x.products?.name||"Product",quantity:Number(x.quantity),unitPrice:Number(x.unit_price),soldAt:x.sold_on,employee:x.employee_name})));
  setReturns((r.data||[]).map((x:any)=>({id:x.id,productId:x.product_id,productName:x.products?.name||"Product",quantity:Number(x.quantity),returnedAt:x.returned_on,reason:x.reason||"Not specified"})));
  setLoading(false);
 }
 useEffect(()=>{void loadBusiness();},[session.user.id]);
 async function createBusiness(e:FormEvent){e.preventDefault();if(!supabase)return;setError("");const name=businessName.trim();if(!name)return;const {data,error}=await supabase.from("businesses").insert({owner_user_id:session.user.id,name,currency_code:"ZMW"}).select("id,name,currency_code").single();if(error){setError(error.message);return;}setBusiness(data as Business);setBusinessName("");void loadBusiness();}
 async function addProduct(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!business)return;const f=new FormData(e.currentTarget);const name=String(f.get("name")).trim(),unit=String(f.get("unit")).trim(),category=String(f.get("category")).trim()||"General",price=Number(f.get("price"));if(!name||!unit||!Number.isFinite(price)||price<0)return;const {error}=await supabase.from("products").insert({business_id:business.id,name,unit_label:unit,category,default_unit_price:price,created_by:session.user.id});if(error){notify(error.message);return;}setShowProduct(false);await loadBusiness();notify("Product saved.");}
 async function addSale(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!business)return;const f=new FormData(e.currentTarget),product=products.find(p=>p.id===String(f.get("product_id"))),qty=Number(f.get("quantity")),price=Number(f.get("price")),date=String(f.get("date")),person=String(f.get("employee")).trim();if(!product||qty<=0||!Number.isFinite(qty)||price<0||!person)return;const {error}=await supabase.from("sales").insert({business_id:business.id,product_id:product.id,recorded_by:session.user.id,employee_name:person,quantity:qty,unit_price:price,sold_on:date,sold_at:date+"T12:00:00Z"});if(error){notify(error.message);return;}setShowSale(false);await loadBusiness();notify("Sale saved to your database.");}
 async function addReturn(e:FormEvent<HTMLFormElement>){e.preventDefault();if(!supabase||!business)return;const f=new FormData(e.currentTarget),product=products.find(p=>p.id===String(f.get("product_id"))),qty=Number(f.get("quantity")),date=String(f.get("date")),reason=String(f.get("reason")).trim();if(!product||qty<=0||!Number.isFinite(qty))return;const {error}=await supabase.from("returns").insert({business_id:business.id,product_id:product.id,recorded_by:session.user.id,employee_name:employee.trim()||"Employee",quantity:qty,returned_on:date,reason:reason||null});if(error){notify(error.message);return;}setShowReturn(false);await loadBusiness();notify("Return saved separately from sales.");}
 const monthSales=sales.filter(s=>s.soldAt.slice(0,7)===month), monthValue=monthSales.reduce((sum,s)=>sum+s.quantity*s.unitPrice,0), monthUnits=monthSales.reduce((sum,s)=>sum+s.quantity,0);
 const todaySales=sales.filter(s=>s.soldAt===today),todayValue=todaySales.reduce((sum,s)=>sum+s.quantity*s.unitPrice,0);
 const reportProducts=products.map(p=>({...p,units:monthSales.filter(s=>s.productId===p.id).reduce((n,s)=>n+s.quantity,0),value:monthSales.filter(s=>s.productId===p.id).reduce((n,s)=>n+s.quantity*s.unitPrice,0)})).filter(p=>p.units>0);
 const filteredSales=sales.filter(s=>(s.productName+s.employee+s.soldAt).toLowerCase().includes(search.toLowerCase()));
 const filteredProducts=products.filter(p=>(p.name+p.category).toLowerCase().includes(search.toLowerCase()));
 const reportText=()=>["STOCK & SALES TRACKER — MONTHLY SALES REPORT","Business: "+business?.name,"Period: "+month,"","DATE | PRODUCT | EMPLOYEE | UNITS | UNIT PRICE | TOTAL",...monthSales.map(s=>`${s.soldAt} | ${s.productName} | ${s.employee} | ${s.quantity} | ${money(s.unitPrice,currency)} | ${money(s.quantity*s.unitPrice,currency)}`),"","PRODUCT SUMMARY",...reportProducts.map(p=>`${p.name}: ${p.units} ${p.unit}(s) sold — ${money(p.value,currency)}`),"",`TOTAL UNITS SOLD: ${monthUnits}`,`TOTAL SALES VALUE: ${money(monthValue,currency)}`,"Returns are tracked separately."].join("\n");
 if(loading)return <AuthShell title="Loading your workspace…" message="Fetching your business records." />;
 if(!business)return <div className="auth-page"><div className="auth-card"><div className="brand-mark"><ShoppingBag size={20}/></div><div className="eyebrow">BUSINESS SETUP</div><h1>Set up your business</h1><p>Create a workspace to save products, sales and returns.</p><form className="form-stack" onSubmit={createBusiness}><label>Business name<input value={businessName} onChange={e=>setBusinessName(e.target.value)} placeholder="e.g. Banda General Dealers" required/></label>{error&&<div className="auth-error">{error}</div>}<button className="primary-button">Create business</button></form><button className="auth-switch" onClick={onSignOut}>Sign out</button></div></div>;
 const nav: {label:Page;icon:any}[]=[{label:"Overview",icon:LayoutDashboard},{label:"Sales",icon:ShoppingBag},{label:"Products",icon:Package},{label:"Returns",icon:ArrowDownLeft},{label:"Reports",icon:BarChart3}];
 return <div className="app-shell"><aside className="sidebar"><div className="brand"><div className="brand-mark"><ShoppingBag size={20}/></div><div><strong>Stockwise</strong><span>SALES TRACKER</span></div></div><div className="workspace-label">WORKSPACE</div><div className="business-switcher"><div className="business-avatar">{business.name.slice(0,2).toUpperCase()}</div><span><strong>{business.name}</strong><small>Business workspace</small></span></div><div className="nav-label">MENU</div><nav className="nav-list">{nav.map(({label,icon:Icon})=><button key={label} className={`nav-item ${page===label?"active":""}`} onClick={()=>setPage(label)}><Icon size={19}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><button className="nav-item" onClick={onSignOut}><LogOut size={18}/><span>Sign out</span></button><div className="profile-row"><div className="profile-avatar">{(session.user.user_metadata?.display_name||session.user.email||"U").slice(0,1).toUpperCase()}</div><div className="profile-copy"><strong>{session.user.user_metadata?.display_name||session.user.email}</strong><span>Signed in</span></div></div></div></aside>
 <main className="main-area"><header className="topbar"><div className="breadcrumbs"><span>{business.name}</span><span className="crumb-slash">/</span><strong>{page}</strong></div><div className="topbar-actions"><span className="today-pill"><span className="status-dot"/> Saved workspace</span></div></header><div className="page-content">
 {error&&<div className="auth-error">{error}</div>}
 {page==="Overview"&&<><div className="page-heading"><div><div className="eyebrow">YOUR BUSINESS AT A GLANCE</div><h1>Welcome, {session.user.user_metadata?.display_name||"there"}</h1><p>Your records are now saved to your Supabase database.</p></div><button className="primary-button" onClick={()=>setShowSale(true)}><Plus size={18}/> Record a sale</button></div><div className="stats-grid"><Stat label="Sales today" value={money(todayValue,currency)} detail={todaySales.length+" sale entries"} /><Stat label="Units sold today" value={String(todaySales.reduce((n,s)=>n+s.quantity,0))} detail="Across all products"/><Stat label="Sales this month" value={money(monthValue,currency)} detail={monthUnits+" total units"}/><Stat label="Returns recorded" value={String(returns.length)} detail="Tracked separately"/></div><div className="content-grid"><section className="panel recent-panel"><div className="panel-heading"><div><h2>Recent sales</h2><p>Latest saved transactions</p></div><button className="text-button" onClick={()=>setPage("Sales")}>View all</button></div><SalesTable sales={sales.slice(0,5)} currency={currency}/></section><section className="panel quick-panel"><div className="panel-heading"><div><h2>Quick actions</h2><p>Keep records up to date</p></div></div><button className="quick-action" onClick={()=>setShowSale(true)}><span><strong>Record a sale</strong><small>Add transaction</small></span><Plus size={16}/></button><button className="quick-action" onClick={()=>setShowProduct(true)}><span><strong>Add a product</strong><small>Update catalogue</small></span><Plus size={16}/></button><button className="quick-action" onClick={()=>setShowReturn(true)}><span><strong>Record a return</strong><small>Log returned goods</small></span><Plus size={16}/></button></section></div></>}
 {page==="Products"&&<><PageHeader title="Products" description="Manage products and default prices." action={<button className="primary-button" onClick={()=>setShowProduct(true)}><Plus size={18}/> Add product</button>}/><SearchBox search={search} setSearch={setSearch}/><section className="panel table-panel"><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>UNIT</th><th>DEFAULT PRICE</th></tr></thead><tbody>{filteredProducts.map(p=><tr key={p.id}><td><strong>{p.name}</strong></td><td>{p.category}</td><td>{p.unit}</td><td>{money(p.price,currency)}</td></tr>)}</tbody></table>{!filteredProducts.length&&<Empty text="No products yet. Add your first product."/ >}</section></>}
 {page==="Sales"&&<><PageHeader title="Sales" description="Review recorded transactions." action={<button className="primary-button" onClick={()=>setShowSale(true)}><Plus size={18}/> Record a sale</button>}/><SearchBox search={search} setSearch={setSearch}/><section className="panel table-panel"><SalesTable sales={filteredSales} currency={currency}/></section></>}
 {page==="Returns"&&<><PageHeader title="Returned goods" description="Returns are stored separately and are not automatically added to stock." action={<button className="primary-button" onClick={()=>setShowReturn(true)}><Plus size={18}/> Record return</button>}/><section className="panel table-panel"><table><thead><tr><th>PRODUCT</th><th>QUANTITY</th><th>RETURN DATE</th><th>REASON</th></tr></thead><tbody>{returns.map(r=><tr key={r.id}><td>{r.productName}</td><td>{r.quantity}</td><td>{dateLabel(r.returnedAt)}</td><td>{r.reason}</td></tr>)}</tbody></table>{!returns.length&&<Empty text="No returns recorded yet."/ >}</section></>}
 {page==="Reports"&&<><PageHeader title="Monthly reports" description="Review monthly totals and export your report."/><div className="report-controls panel"><label>REPORTING PERIOD<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><div className="export-actions"><button className="secondary-button" onClick={()=>{const blob=new Blob([reportText()],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`sales-report-${month}.txt`;a.click();URL.revokeObjectURL(url);}}> <Download size={16}/> Download TXT</button><button className="secondary-button" onClick={()=>void navigator.clipboard.writeText(reportText()).then(()=>notify("Report copied."))}><FileText size={16}/> Copy text</button></div></div><div className="report-stats"><Stat label="Units sold" value={String(monthUnits)} detail="All products"/><Stat label="Sales value" value={money(monthValue,currency)} detail="Recorded sale prices"/><Stat label="Sales entries" value={String(monthSales.length)} detail="Selected month"/></div><section className="panel report-panel"><h2>Product summary</h2><table><thead><tr><th>PRODUCT</th><th>UNITS SOLD</th><th>SALES VALUE</th></tr></thead><tbody>{reportProducts.map(p=><tr key={p.id}><td>{p.name}</td><td>{p.units} {p.unit}(s)</td><td>{money(p.value,currency)}</td></tr>)}</tbody></table><p><strong>Total units:</strong> {monthUnits} &nbsp; <strong>Total value:</strong> {money(monthValue,currency)}</p></section><section className="panel report-panel"><h2>Transaction details</h2><SalesTable sales={monthSales} currency={currency}/></section></>}
 </div></main>
 {showProduct&&<Modal title="Add product" close={()=>setShowProduct(false)}><form className="form-stack" onSubmit={addProduct}><label>Product name<input name="name" required/></label><div className="form-two-col"><label>Unit<input name="unit" placeholder="bottle, bag, unit" required/></label><label>Default price (ZMW)<input name="price" type="number" min="0" step="0.01" required/></label></div><label>Category<input name="category" defaultValue="General"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowProduct(false)}>Cancel</button><button className="primary-button">Save product</button></div></form></Modal>}
 {showSale&&<Modal title="Record a sale" close={()=>setShowSale(false)}><form className="form-stack" onSubmit={addSale}><label>Product<select name="product_id" required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="form-two-col"><label>Quantity<input name="quantity" type="number" min="0.001" step="any" defaultValue="1" required/></label><label>Unit price (ZMW)<input name="price" type="number" min="0" step="0.01" defaultValue={products[0]?.price??0} required/></label></div><label>Date<input name="date" type="date" defaultValue={today} required/></label><label>Employee name<input name="employee" value={employee} onChange={e=>setEmployee(e.target.value)} required/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowSale(false)}>Cancel</button><button className="primary-button">Save sale</button></div></form></Modal>}
 {showReturn&&<Modal title="Record a return" close={()=>setShowReturn(false)}><form className="form-stack" onSubmit={addReturn}><label>Product<select name="product_id" required>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></label><div className="form-two-col"><label>Quantity<input name="quantity" type="number" min="0.001" step="any" defaultValue="1" required/></label><label>Date<input name="date" type="date" defaultValue={today} required/></label></div><label>Reason / notes<input name="reason" placeholder="Optional"/></label><div className="modal-actions"><button type="button" className="secondary-button" onClick={()=>setShowReturn(false)}>Cancel</button><button className="primary-button">Save return</button></div></form></Modal>}
 {notice&&<div className="toast" role="status">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
 </div>;
}
function Stat({label,value,detail}:{label:string;value:string;detail:string}){return <div className="stat-card"><div className="stat-top"><span>{label}</span></div><strong className="stat-value">{value}</strong><div className="stat-detail">{detail}</div></div>}
function PageHeader({title,description,action}:{title:string;description:string;action?:React.ReactNode}){return <div className="page-heading subpage-heading"><div><div className="eyebrow">BUSINESS WORKSPACE</div><h1>{title}</h1><p>{description}</p></div>{action}</div>}
function SearchBox({search,setSearch}:{search:string;setSearch:(s:string)=>void}){return <div className="toolbar"><div className="search-box"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search…"/></div></div>}
function SalesTable({sales,currency}:{sales:Sale[];currency:string}){return <div className="data-table-wrap"><table><thead><tr><th>PRODUCT</th><th>EMPLOYEE</th><th>DATE</th><th>UNITS</th><th>TOTAL</th></tr></thead><tbody>{sales.map(s=><tr key={s.id}><td>{s.productName}<small>{money(s.unitPrice,currency)} / unit</small></td><td>{s.employee}</td><td>{dateLabel(s.soldAt)}</td><td>{s.quantity}</td><td>{money(s.quantity*s.unitPrice,currency)}</td></tr>)}</tbody></table>{!sales.length&&<Empty text="No sales records yet."/ >}</div>}
function Empty({text}:{text:string}){return <div className="empty-state"><p>{text}</p></div>}
function Modal({title,close,children}:{title:string;close:()=>void;children:React.ReactNode}){return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}><section className="modal-card" role="dialog" aria-modal="true"><div className="modal-heading"><h2>{title}</h2><button className="icon-button" onClick={close}>×</button></div>{children}</section></div>}
