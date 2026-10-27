import { useState } from "react";
import {
  ArrowDownLeft, ArrowUpRight, BarChart3, Bell, ChevronDown, ChevronLeft,
  ChevronRight, CircleHelp, ClipboardList, Download, Eye, EyeOff, LayoutDashboard,
  LockKeyhole, Mail, Package, Plus, Search, Settings, ShoppingBag, Sparkles,
  TrendingUp, UserRound, Users, Wallet
} from "lucide-react";
import "./preview.css";

type View = "Overview" | "Sales" | "Products" | "Reports";

const products = [
  { name: "Premium cooking oil", category: "Groceries", stock: 42, price: 185 },
  { name: "Maize meal 25kg", category: "Food & staples", stock: 18, price: 320 },
  { name: "Laundry soap", category: "Household", stock: 65, price: 28 },
  { name: "Sugar 2kg", category: "Groceries", stock: 27, price: 72 },
];
const sales = [
  { customer: "Walk-in customer", product: "Premium cooking oil", date: "Today, 10:42", amount: 370, status: "Completed" },
  { customer: "Mary Phiri", product: "Maize meal 25kg", date: "Today, 09:18", amount: 640, status: "Completed" },
  { customer: "Walk-in customer", product: "Laundry soap", date: "Yesterday", amount: 84, status: "Completed" },
  { customer: "John Banda", product: "Sugar 2kg", date: "Yesterday", amount: 144, status: "Completed" },
];

export default function Preview() {
  const [view, setView] = useState<View>("Overview");
  const [authMode, setAuthMode] = useState<"signup" | "signin">("signup");
  const [showWorkspace, setShowWorkspace] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");

  if (!showWorkspace) {
    return <main className="preview-auth">
      <div className="preview-auth-brand"><div className="preview-logo"><ShoppingBag size={22}/></div><span>Stockwise</span></div>
      <section className="preview-auth-card">
        <div className="preview-auth-heading"><span className="preview-kicker">STOCK & SALES TRACKER</span><h1>{authMode === "signup" ? "Create your account" : "Welcome back"}</h1><p>{authMode === "signup" ? "A clearer picture of your business starts here." : "Sign in to your Stockwise workspace."}</p></div>
        <form onSubmit={e=>{e.preventDefault();setShowWorkspace(true);setNotice("You're viewing the UI preview. Authentication will be connected in phase 2.");}}>
          {authMode === "signup" && <label>Your name<div className="preview-input"><UserRound size={17}/><input required value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Prince Banda"/></div></label>}
          <label>Email address<div className="preview-input"><Mail size={17}/><input required type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com"/></div></label>
          <label>Password<div className="preview-input"><LockKeyhole size={17}/><input required minLength={6} type={showPassword?"text":"password"} placeholder="At least 6 characters"/><button type="button" aria-label="Toggle password visibility" onClick={()=>setShowPassword(v=>!v)}>{showPassword?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></label>
          {authMode === "signin" && <button type="button" className="preview-forgot" onClick={()=>setNotice("Password reset will be available when authentication is connected.")}>Forgot password?</button>}
          <button className="preview-auth-submit">{authMode === "signup" ? "Create account" : "Sign in"} <ArrowUpRight size={17}/></button>
        </form>
        <div className="preview-auth-switch">{authMode === "signup" ? "Already have an account?" : "New to Stockwise?"}<button onClick={()=>setAuthMode(authMode==="signup"?"signin":"signup")}>{authMode==="signup"?"Sign in":"Create an account"}</button></div>
        <div className="preview-auth-note"><LockKeyhole size={14}/> Your business records stay private and secure.</div>
        <button className="preview-demo-link" onClick={()=>setShowWorkspace(true)}>Preview the dashboard <ChevronRight size={15}/></button>
      </section>
      <p className="preview-auth-footer">© 2026 Stockwise · A simple way to stay on top of sales.</p>
      {notice && <div className="preview-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
    </main>;
  }

  const filtered = products.filter(p=>(p.name+p.category).toLowerCase().includes(search.toLowerCase()));
  return <main className="preview-app">
    <aside className="preview-sidebar">
      <div className="preview-brand"><div className="preview-logo"><ShoppingBag size={20}/></div><div><b>Stockwise</b><small>SALES TRACKER</small></div></div>
      <div className="preview-workspace-label">YOUR WORKSPACE</div>
      <button className="preview-workspace"><span className="preview-workspace-avatar">BG</span><span><b>Banda General Dealers</b><small>Business workspace</small></span><ChevronDown size={15}/></button>
      <div className="preview-nav-label">MENU</div>
      <nav className="preview-nav">{([{label:"Overview",icon:LayoutDashboard},{label:"Sales",icon:ShoppingBag},{label:"Products",icon:Package},{label:"Reports",icon:BarChart3}] as const).map(({label,icon:Icon})=><button key={label} className={view===label?"active":""} onClick={()=>setView(label)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="preview-sidebar-bottom"><button><Settings size={17}/> Settings</button><button><CircleHelp size={17}/> Help & support</button><div className="preview-profile"><div className="preview-profile-avatar">{(name||"P").slice(0,1).toUpperCase()}</div><div><b>{name||"Preview user"}</b><small>{email||"preview@stockwise.app"}</small></div><button aria-label="Sign out preview" onClick={()=>setShowWorkspace(false)}><ArrowDownLeft size={16}/></button></div></div>
    </aside>
    <section className="preview-main"><header className="preview-topbar"><div className="preview-breadcrumb">Banda General Dealers <span>/</span> <b>{view}</b></div><div className="preview-top-actions"><span className="preview-status"><i/> Preview mode</span><button className="preview-bell" aria-label="Notifications"><Bell size={18}/><i/></button><div className="preview-profile-avatar">{(name||"P").slice(0,1).toUpperCase()}</div></div></header>
      <div className="preview-content">
        <div className="preview-page-heading"><div><span className="preview-kicker">{view==="Overview"?"YOUR BUSINESS AT A GLANCE":"BUSINESS WORKSPACE"}</span><h1>{view==="Overview"?"Good morning, "+(name.split(" ")[0]||"there")+" 👋":view}</h1><p>{view==="Overview"?"Here’s what’s happening with your business today.":"A sample view of your "+view.toLowerCase()+" workspace."}</p></div><button className="preview-primary" onClick={()=>setNotice("Actions will be enabled when we connect the database.")}><Plus size={17}/> {view==="Products"?"Add product":"Record a sale"}</button></div>
        {view==="Overview" && <>
          <div className="preview-stats">
            <Stat title="Sales today" value="K 1,234.50" change="+12.8%" icon={Wallet} color="purple" note="vs. yesterday"/>
            <Stat title="Units sold" value="28" change="+8.2%" icon={ShoppingBag} color="blue" note="today"/>
            <Stat title="Sales this month" value="K 18,420" change="+6.4%" icon={TrendingUp} color="green" note="vs. last month"/>
            <Stat title="Products" value="152" change="12 low" icon={Package} color="orange" note="items in catalogue"/>
          </div>
          <div className="preview-dashboard-grid"><section className="preview-panel preview-chart-panel"><div className="preview-panel-heading"><div><h2>Sales overview</h2><p>Your sales performance this week</p></div><button className="preview-period">This week <ChevronDown size={14}/></button></div><div className="preview-chart-amount">K 8,642.00 <span>↑ 14.6%</span></div><div className="preview-chart"><div className="preview-chart-y"><span>3k</span><span>2k</span><span>1k</span><span>0</span></div><div className="preview-chart-bars">{[42,65,48,78,57,92,68].map((h,i)=><div key={i} className="preview-chart-day"><div className="preview-bar-track"><div className={i===5?"preview-bar highlight":"preview-bar"} style={{height:h+"%"}}/></div><span>{["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][i]}</span></div>)}</div></div></section>
            <section className="preview-panel preview-quick-panel"><div className="preview-panel-heading"><div><h2>Quick actions</h2><p>Get things done faster</p></div><Sparkles size={18} className="preview-sparkle"/></div><button onClick={()=>setNotice("Record sale will be available when Supabase is connected.")}><span className="preview-quick-icon violet"><ShoppingBag size={17}/></span><span><b>Record a sale</b><small>Add a new transaction</small></span><ChevronRight size={16}/></button><button onClick={()=>setView("Products")}><span className="preview-quick-icon blue"><Package size={17}/></span><span><b>Add a product</b><small>Update your catalogue</small></span><ChevronRight size={16}/></button><button onClick={()=>setView("Reports")}><span className="preview-quick-icon green"><ClipboardList size={17}/></span><span><b>View reports</b><small>Check business performance</small></span><ChevronRight size={16}/></button></section>
          </div>
          <section className="preview-panel preview-table-panel"><div className="preview-panel-heading"><div><h2>Recent sales</h2><p>Latest transactions across your business</p></div><button className="preview-text-button" onClick={()=>setView("Sales")}>View all <ArrowUpRight size={15}/></button></div><SalesTable/></section>
        </>}
        {view==="Products"&&<section className="preview-panel preview-table-panel"><div className="preview-panel-heading"><div><h2>Product catalogue</h2><p>Keep track of the products you sell.</p></div><button className="preview-primary" onClick={()=>setNotice("Adding products will be available in phase 2.")}><Plus size={16}/> Add product</button></div><div className="preview-search"><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search products…"/></div><table><thead><tr><th>PRODUCT</th><th>CATEGORY</th><th>IN STOCK</th><th>UNIT PRICE</th></tr></thead><tbody>{filtered.map(p=><tr key={p.name}><td><b>{p.name}</b></td><td>{p.category}</td><td><span className={p.stock<20?"preview-stock-low":"preview-stock"}>{p.stock} units</span></td><td>K {p.price.toFixed(2)}</td></tr>)}</tbody></table></section>}
        {view==="Sales"&&<section className="preview-panel preview-table-panel"><div className="preview-panel-heading"><div><h2>Sales transactions</h2><p>Review recent sales activity.</p></div><button className="preview-primary" onClick={()=>setNotice("Recording a sale will be enabled in phase 2.")}><Plus size={16}/> Record sale</button></div><SalesTable/></section>}
        {view==="Reports"&&<div className="preview-stats"><Stat title="Revenue this month" value="K 18,420" change="+6.4%" icon={Wallet} color="purple" note="vs. last month"/><Stat title="Transactions" value="246" change="+18" icon={ClipboardList} color="blue" note="this month"/><Stat title="Average sale" value="K 74.88" change="+2.1%" icon={BarChart3} color="green" note="per transaction"/></div>}
        <div className="preview-demo-banner"><Sparkles size={16}/><span><b>Interactive UI preview</b> — sample data only. Login, database actions, and persistence will be connected in the next phase.</span></div>
      </div>
    </section>
    {notice&&<div className="preview-notice">{notice}<button onClick={()=>setNotice("")}>×</button></div>}
  </main>;
}

function Stat({title,value,change,icon:Icon,color,note}:{title:string;value:string;change:string;icon:any;color:string;note:string}) {
  return <div className="preview-stat"><div className="preview-stat-top"><span>{title}</span><span className={"preview-stat-icon "+color}><Icon size={18}/></span></div><strong>{value}</strong><div className="preview-stat-note"><span>{change}</span> {note}</div></div>;
}
function SalesTable(){return <div className="preview-table-wrap"><table><thead><tr><th>CUSTOMER</th><th>PRODUCT</th><th>DATE</th><th>AMOUNT</th><th>STATUS</th></tr></thead><tbody>{sales.map((s,i)=><tr key={i}><td><b>{s.customer}</b></td><td>{s.product}</td><td>{s.date}</td><td><b>K {s.amount.toFixed(2)}</b></td><td><span className="preview-sale-status">{s.status}</span></td></tr>)}</tbody></table></div>}
