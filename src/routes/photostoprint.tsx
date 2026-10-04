import { useEffect,useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { KioskButton } from "@/components/kiosk/KioskButton";
import { clearAuth,getStaffRole,loadAuth,saveAuth,signIn,signOut,signedPhotoUrl,supabaseRest } from "@/lib/supabase";
type S={id:string;phone:string;created_at:string;status:string;printed_photo_count:number}; type P={id:string;storage_path:string;photo_number:number;url:string;selected:boolean};

function Login({onReady}:{onReady:()=>void}){
  const[e,setE]=useState("");const[p,setP]=useState("");const[err,setErr]=useState("");
  const go=async()=>{try{const s=await signIn(e,p);const r=await getStaffRole(s.access_token);if(!r)throw Error("Usuário sem permissão.");saveAuth(s);onReady()}catch(x){clearAuth();setErr(x instanceof Error?x.message:"Falha ao entrar")}};
  return <div className="flex min-h-screen items-center justify-center p-8"><div className="w-full max-w-md rounded-3xl border border-border bg-card p-8"><h1 className="font-display text-5xl text-cream">Photo to Print</h1><p className="mt-2 text-muted-foreground">Acesso do atendimento</p><input className="mt-8 w-full rounded-xl border bg-background p-4" placeholder="E-mail" value={e} onChange={x=>setE(x.target.value)}/><input className="mt-3 w-full rounded-xl border bg-background p-4" placeholder="Senha" type="password" value={p} onChange={x=>setP(x.target.value)} onKeyDown={x=>x.key==="Enter"&&go()}/>{err&&<p className="mt-3 text-destructive">{err}</p>}<KioskButton className="mt-6 w-full" onClick={go}>Entrar</KioskButton></div></div>
}

function App({token,onLogout}:{token:string;onLogout:()=>void}){
  const[phone,setPhone]=useState("");const[sessions,setSessions]=useState<S[]>([]);const[selected,setSelected]=useState<S|null>(null);const[photos,setPhotos]=useState<P[]>([]);
  const[printing,setPrinting]=useState(false);const[printError,setPrintError]=useState("");

  const search=async()=>{
    const d=phone.replace(/\D/g,"");if(d.length<10)return;
    const r=await supabaseRest(`/rest/v1/sessions?select=id,phone,created_at,status,printed_photo_count&phone=eq.${d}&order=created_at.desc&limit=20`,{},token);
    setSessions(await r.json());setSelected(null);setPhotos([]);setPrintError("");
  };

  const open=async(s:S)=>{
    setSelected(s);setPrintError("");
    const r=await supabaseRest(`/rest/v1/session_photos?select=id,storage_path,photo_number&session_id=eq.${s.id}&order=photo_number.asc`,{},token);
    const ps=await r.json() as Array<{id:string;storage_path:string;photo_number:number}>;
    setPhotos(await Promise.all(ps.map(async x=>({...x,url:await signedPhotoUrl(x.storage_path,token),selected:true}))));
  };

  const printed=async()=>{
    if(!selected)return;
    const n=photos.filter(x=>x.selected).length;if(!n)return;
    await supabaseRest(`/rest/v1/sessions?id=eq.${selected.id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({status:"printed",printed_at:new Date().toISOString(),printed_photo_count:n})},token);
    setSelected({...selected,status:"printed",printed_photo_count:n});
    setSessions(a=>a.map(s=>s.id===selected.id?{...s,status:"printed",printed_photo_count:n}:s));
    alert(n+" foto(s) marcada(s) como impressa(s).");
  };

  const printSelected=()=>{
    const selectedCount=photos.filter(x=>x.selected).length;
    if(!selectedCount||printing)return;
    setPrintError("");
    setPrinting(true);
    window.setTimeout(()=>{
      window.print();
      setPrinting(false);
    },100);
  };

  const toggleAll=()=>{
    const allSelected=photos.length>0&&photos.every(x=>x.selected);
    setPhotos(a=>a.map(x=>({...x,selected:!allSelected})));
  };

  return <><div className="min-h-screen p-6 md:p-10 print:hidden">
    <div className="mx-auto max-w-7xl">
      <div className="flex justify-between"><div><h1 className="font-display text-5xl text-cream">Fotos para imprimir</h1><p className="text-muted-foreground">Pesquise pelo telefone.</p></div><KioskButton variant="ghost" onClick={onLogout}>Sair</KioskButton></div>
      <div className="mt-8 flex gap-3"><input className="flex-1 rounded-xl border bg-card p-4 text-xl" placeholder="(24) 99999-9999" value={phone} onChange={x=>setPhone(x.target.value)} onKeyDown={x=>x.key==="Enter"&&search()}/><KioskButton onClick={search}>Buscar</KioskButton></div>
      <div className="mt-8 grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border bg-card p-4"><h2 className="font-semibold text-cream">Sessões</h2>{sessions.map(s=><button key={s.id} onClick={()=>open(s)} className="mt-2 w-full rounded-xl border p-4 text-left"><div className="text-cream">{new Date(s.created_at).toLocaleString("pt-BR")}</div><div className="text-sm text-muted-foreground">{s.status} · {s.printed_photo_count} impressas</div></button>)}</div>
        <div className="rounded-2xl border bg-card p-4">
          {!selected?<p className="py-16 text-center text-muted-foreground">Selecione uma sessão.</p>:<>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="text-2xl text-cream">{selected.phone}</h2><p className="text-sm text-muted-foreground">{new Date(selected.created_at).toLocaleString("pt-BR")}</p></div>
              <div className="flex flex-wrap gap-2">
                <KioskButton variant="outline" onClick={toggleAll}>{photos.length>0&&photos.every(x=>x.selected)?"Desmarcar todas":"Selecionar todas"}</KioskButton>
                <KioskButton disabled={!photos.some(x=>x.selected)||printing} onClick={printSelected}>{printing?"Abrindo impressão…":"Imprimir selecionadas"}</KioskButton>
                <KioskButton variant="outline" disabled={!photos.some(x=>x.selected)} onClick={printed}>Marcar como impressas</KioskButton>
              </div>
            </div>
            {printError&&<p className="mt-4 text-destructive">{printError}</p>}
            <p className="mt-4 text-sm text-muted-foreground">Selecione as fotos que deseja imprimir. O botão de impressão abrirá a janela de impressão do computador.</p>
            <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">{photos.map(x=><label key={x.id} className={`rounded-xl border p-2 cursor-pointer ${x.selected?"border-primary ring-2 ring-primary/30":""}`}><img src={x.url} className="aspect-video w-full rounded-lg object-cover"/><div className="p-2 flex items-center gap-2"><input type="checkbox" checked={x.selected} onChange={()=>setPhotos(a=>a.map(y=>y.id===x.id?{...y,selected:!y.selected}:y))}/><span>Foto {x.photo_number}</span></div></label>)}</div>
          </>}
        </div>
      </div>
    </div>
  </div><PrintView photos={photos}/></>;
}

function PrintView({photos}:{photos:P[]}){
  const selected=photos.filter(x=>x.selected);
  return <div className="hidden print:block print:bg-white">
    {selected.map((photo,index)=><div key={photo.id} className="flex min-h-[100vh] items-center justify-center p-0 [break-after:page]">
      <img src={photo.url} alt={`Foto ${photo.photo_number}`} className="max-h-[100vh] max-w-[100vw] object-contain" />
      {index===selected.length-1&&<span className="hidden">.</span>}
    </div>)}
  </div>
}

export const Route=createFileRoute("/photostoprint")({component:Page});
function Page(){
  const[a,setA]=useState(loadAuth());const[r,setR]=useState<string|null>(null);
  useEffect(()=>{if(a)getStaffRole(a.access_token).then(setR).catch(()=>setR(null))},[a]);
  if(!a||!r)return <Login onReady={()=>setA(loadAuth())}/>;
  return <App token={a.access_token} onLogout={()=>{signOut(a.access_token);setA(null);setR(null)}}/>;
}