import{i as g}from"./main-5K2X5mD3.js";import"./index-BNso8BPx.js";const v=["todOverride","fwm_tod_override"],h=["tod-day","tod-dawn","tod-dusk","tod-night"];function x(){try{for(const e of v){const t=localStorage.getItem(e);if(t&&String(t).trim())return String(t).trim()}}catch{}return""}function w(e){try{for(const t of v)e?localStorage.setItem(t,e):localStorage.removeItem(t)}catch{}}function D(e=new Date){const t=e.getHours();return t>=5&&t<=7?"dawn":t>=8&&t<=16?"day":t>=17&&t<=19?"dusk":"night"}function b(e){const t=document.body;if(!t)return;h.forEach(r=>t.classList.remove(r));const a=e||D();t.classList.add(`tod-${a}`),t.dataset.tod=a}function k(e){switch(e){case"day":return"🌞";case"dawn":return"🌅";case"dusk":return"🌆";case"night":return"🌙";default:return"🌓"}}function E(e){switch(e){case"day":return"Day";case"dawn":return"Dawn";case"dusk":return"Dusk";case"night":return"Night";default:return"Auto"}}function B(){if(document.getElementById("todDevPanelStyles"))return;const e=`
    #todDevBtn{
      min-width: 34px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 10px;
      border-radius: 10px;
      cursor: pointer;
      user-select: none;
      border: 1px solid color-mix(in oklab, var(--panel-border, rgba(255,255,255,.12)) 80%, transparent);
      background: color-mix(in oklab, var(--panel-bg, rgba(0,0,0,.25)) 85%, transparent);
      color: var(--text, inherit);
    }
    #todDevBtn:hover{
      filter: brightness(1.06);
    }
    #todDevPopover{
      position: fixed;
      z-index: 2147483647;
      min-width: 200px;
      padding: 10px;
      border-radius: 12px;
      border: 1px solid color-mix(in oklab, var(--panel-border, rgba(255,255,255,.12)) 80%, transparent);
      background: color-mix(in oklab, var(--panel-bg, rgba(20,20,20,.92)) 92%, transparent);
      box-shadow: 0 12px 30px rgba(0,0,0,.35);
      backdrop-filter: blur(8px);
    }
    #todDevPopover .todTitle{
      font-size: 12px;
      opacity: .8;
      margin: 0 0 8px 0;
    }
    #todDevPopover .todGrid{
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    #todDevPopover button.todOpt{
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 8px 10px;
      border-radius: 10px;
      border: 1px solid color-mix(in oklab, var(--panel-border, rgba(255,255,255,.12)) 70%, transparent);
      background: color-mix(in oklab, var(--panel-bg, rgba(0,0,0,.2)) 80%, transparent);
      color: inherit;
      cursor: pointer;
      font-weight: 600;
      font-size: 13px;
    }
    #todDevPopover button.todOpt:hover{ filter: brightness(1.06); }
    #todDevPopover button.todOpt[aria-pressed="true"]{
      outline: 2px solid color-mix(in oklab, var(--xp-blue, #4aa3ff) 70%, transparent);
      outline-offset: 1px;
    }
    #todDevPopover .todFoot{
      margin-top: 8px;
      font-size: 11px;
      opacity: .75;
      line-height: 1.25;
    }
  `,t=document.createElement("style");t.id="todDevPanelStyles",t.textContent=e,document.head.appendChild(t)}function O(){if(!g())return;const e=document.getElementById("themeBtn"),t=document.getElementById("settingsBtn");if(!e||!t||!e.parentElement||document.getElementById("todDevBtn"))return;B();const a=document.createElement("div");a.style.position="relative",a.style.display="inline-flex",a.style.alignItems="center";const r=document.createElement("button");r.id="todDevBtn",r.type="button",r.title="Time of Day (Dev)";const n=document.createElement("div");n.id="todDevPopover",n.hidden=!0,n.innerHTML=`
    <div class="todTitle">Time of Day (Dev Override)</div>
    <div class="todGrid">
      <button class="todOpt" data-mode="" type="button">🌓 Auto</button>
      <button class="todOpt" data-mode="day" type="button">🌞 Day</button>
      <button class="todOpt" data-mode="dawn" type="button">🌅 Dawn</button>
      <button class="todOpt" data-mode="dusk" type="button">🌆 Dusk</button>
      <button class="todOpt" data-mode="night" type="button">🌙 Night</button>
    </div>
    <div class="todFoot">Tip: This only affects visuals. Clear override to return to real time.</div>
  `,a.appendChild(r),document.body.appendChild(n),e.parentElement.insertBefore(a,t);function p(){const i=x()||"";r.textContent=k(i),r.setAttribute("aria-label",`Time of Day: ${E(i)}`),n.querySelectorAll("button.todOpt").forEach(s=>{const d=s.getAttribute("data-mode")||"";s.setAttribute("aria-pressed",String(d===i))})}function f(o){w(o),b(o||""),p();try{window.dispatchEvent(new CustomEvent("fwm:tod-override-changed",{detail:{mode:o||null}}))}catch{}}function y(){const o=r.getBoundingClientRect(),i=n.hidden;i&&(n.style.visibility="hidden",n.hidden=!1);const s=n.offsetWidth||220,d=n.offsetHeight||140;let c=o.right-s,l=o.bottom+8;const u=8;c=Math.max(u,Math.min(c,window.innerWidth-s-u)),l+d>window.innerHeight-u&&(l=o.top-d-8),l=Math.max(u,Math.min(l,window.innerHeight-d-u)),n.style.left=`${c}px`,n.style.top=`${l}px`,i&&(n.hidden=!0,n.style.visibility="")}r.addEventListener("click",o=>{o.preventDefault(),o.stopPropagation(),n.hidden=!n.hidden,n.hidden||(y(),p())}),n.addEventListener("click",o=>{var d,c;const i=(c=(d=o.target)==null?void 0:d.closest)==null?void 0:c.call(d,"button.todOpt");if(!i)return;const s=i.getAttribute("data-mode")||"";f(s),n.hidden=!0});function m(){n.hidden||(n.hidden=!0)}document.addEventListener("click",o=>{a.contains(o.target)||n.contains(o.target)||m()}),document.addEventListener("keydown",o=>{o.key==="Escape"&&m()}),p(),typeof window.setTod!="function"&&(window.setTod=o=>f(o?String(o):""))}function T(){const e=()=>{O(),!document.getElementById("todDevBtn")&&g()&&setTimeout(e,250)};e()}export{T as initTodDevPanel};
