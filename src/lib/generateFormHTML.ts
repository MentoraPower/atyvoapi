const SUPABASE_URL = "https://wenmrdqdmjidloivjycs.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indlbm1yZHFkbWppZGxvaXZqeWNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDM2MjIsImV4cCI6MjA4NzUxOTYyMn0.bqYggYJwWABreY9MCx3vkHvSAbrXyBgVcL_X-dvcd_o";

/**
 * Gera o formulário de AGENDAMENTO (fluxo original, para contas normais).
 */
export function generateFormHTML(
  name: string,
  product: string,
  bgColor = "transparent",
  textColor = "#111111"
): string {
  const n = name.trim();

  const fatOptions = [
    "Até R$ 3.000",
    "R$ 3.000 a R$ 10.000",
    "R$ 10.000 a R$ 30.000",
    "Acima de R$ 30.000",
  ];
  const fatLabels = fatOptions
    .map(
      (v, i) =>
        `<label id="fat-label-${i}" onclick="selectFat(${i})" style="display:flex;align-items:center;gap:10px;padding:12px 14px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;color:#374151;transition:all 0.18s;cursor:pointer;"><span id="fat-dot-${i}" style="width:18px;height:18px;border-radius:50%;border:2px solid #d1d5db;flex-shrink:0;transition:all 0.18s;"></span>${v}</label>`
    )
    .join("");

  const bitLabels = ["Sim", "Não"]
    .map(
      (v, i) =>
        `<label id="bit-label-${i}" onclick="selectBit(${i})" style="flex:1;display:flex;align-items:center;justify-content:center;padding:12px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;color:#374151;transition:all 0.18s;cursor:pointer;">${v}</label>`
    )
    .join("");

  const curLabels = ["Online", "Presencial", "Não faço"]
    .map(
      (v, i) =>
        `<label id="cur-label-${i}" onclick="selectCur(${i})" style="flex:1;min-width:100px;display:flex;align-items:center;justify-content:center;padding:12px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;color:#374151;transition:all 0.18s;cursor:pointer;">${v}</label>`
    )
    .join("");

  const parLabels = ["Sim", "Não"]
    .map(
      (v, i) =>
        `<label id="par-label-${i}" onclick="selectPar(${i})" style="flex:1;display:flex;align-items:center;justify-content:center;padding:12px;border:1.5px solid #e5e7eb;border-radius:12px;font-size:14px;color:#374151;transition:all 0.18s;cursor:pointer;">${v}</label>`
    )
    .join("");

  const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"]
    .map(
      (d) =>
        `<div style="text-align:center;font-size:11px;font-weight:600;color:#9ca3af;padding:4px 0;">${d}</div>`
    )
    .join("");

  const script = `
var SUPABASE_URL='${SUPABASE_URL}';
var SUPABASE_KEY='${SUPABASE_ANON_KEY}';
var contactData={};
var selectedDate=null;
var selectedTime=null;
var months=["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];
var calDate=new Date();
var fatIdx=-1,bitIdx=-1,curIdx=-1,parIdx=-1;

function selectFat(i){fatIdx=i;for(var j=0;j<4;j++){var l=document.getElementById("fat-label-"+j);var d=document.getElementById("fat-dot-"+j);if(j===i){l.style.borderColor="#111";l.style.background="#f9fafb";d.style.borderColor="#111";d.style.background="#111";}else{l.style.borderColor="#e5e7eb";l.style.background="";d.style.borderColor="#d1d5db";d.style.background="";}}}
function selectBit(i){bitIdx=i;for(var j=0;j<2;j++){var l=document.getElementById("bit-label-"+j);if(j===i){l.style.borderColor="#111";l.style.background="#f9fafb";l.style.fontWeight="600";}else{l.style.borderColor="#e5e7eb";l.style.background="";l.style.fontWeight="400";}}}
function selectCur(i){curIdx=i;for(var j=0;j<3;j++){var l=document.getElementById("cur-label-"+j);if(j===i){l.style.borderColor="#111";l.style.background="#f9fafb";l.style.fontWeight="600";}else{l.style.borderColor="#e5e7eb";l.style.background="";l.style.fontWeight="400";}}}
function selectPar(i){parIdx=i;for(var j=0;j<2;j++){var l=document.getElementById("par-label-"+j);if(j===i){l.style.borderColor="#111";l.style.background="#f9fafb";l.style.fontWeight="600";}else{l.style.borderColor="#e5e7eb";l.style.background="";l.style.fontWeight="400";}}}
function showErr(msg){var e=document.getElementById("error-msg");e.style.display="block";e.textContent=msg;}
function hideErr(){document.getElementById("error-msg").style.display="none";}

function submitStep1(){
  hideErr();
  var name=document.getElementById("f-name").value.trim();
  var email=document.getElementById("f-email").value.trim();
  var phone=document.getElementById("f-phone").value.trim();
  if(!name){showErr("Preencha seu nome");return;}
  if(!email||email.indexOf("@")<0){showErr("E-mail inválido");return;}
  if(!phone){showErr("Preencha seu telefone");return;}
  contactData={name:name,email:email,phone:phone};
  document.getElementById("step1").style.display="none";
  document.getElementById("step2").style.display="block";
}

function renderCalendar(){
  var y=calDate.getFullYear(),m=calDate.getMonth();
  document.getElementById("cal-month-label").textContent=months[m]+" "+y;
  var first=new Date(y,m,1).getDay();
  var days=new Date(y,m+1,0).getDate();
  var today=new Date();today.setHours(0,0,0,0);
  var html="";
  for(var i=0;i<first;i++)html+="<div></div>";
  var base="text-align:center;padding:8px 4px;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;transition:all 0.18s;";
  for(var d=1;d<=days;d++){
    var date=new Date(y,m,d);date.setHours(0,0,0,0);
    var isPast=date<today;
    var sel=selectedDate&&selectedDate.getFullYear()===y&&selectedDate.getMonth()===m&&selectedDate.getDate()===d;
    if(isPast){html+="<div style='"+base+"color:#d1d5db;cursor:default;'>"+d+"</div>";}
    else if(sel){html+="<div style='"+base+"background:#111;color:#fff;' onclick='selectDay("+d+")'>"+d+"</div>";}
    else{html+="<div style='"+base+"color:#111;' onmouseover=\"this.style.background='#f3f4f6'\" onmouseout=\"this.style.background=''\" onclick='selectDay("+d+")'>"+d+"</div>";}
  }
  document.getElementById("cal-days").innerHTML=html;
}

function prevMonth(){calDate.setMonth(calDate.getMonth()-1);renderCalendar();}
function nextMonth(){calDate.setMonth(calDate.getMonth()+1);renderCalendar();}
function padZ(n){return String(n).length===1?"0"+String(n):String(n);}

function selectDay(d){
  var y=calDate.getFullYear(),m=calDate.getMonth();
  selectedDate=new Date(y,m,d);
  renderCalendar();
  document.getElementById("step2").style.display="none";
  document.getElementById("step3").style.display="block";
  var dateStr=y+"-"+padZ(m+1)+"-"+padZ(d);
  document.getElementById("step3-date").textContent="Horários para "+d+"/"+padZ(m+1)+"/"+y;
  loadSlots(dateStr);
}

function loadSlots(dateStr){
  var container=document.getElementById("slots-container");
  container.innerHTML="<div style='grid-column:1/-1;text-align:center;padding:20px;color:#9ca3af;font-size:14px;'>Carregando horários...</div>";
  var dayOfWeek=selectedDate.getDay();
  Promise.all([
    fetch(SUPABASE_URL+"/rest/v1/appointments?select=appointment_time&appointment_date=eq."+dateStr,{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY}}),
    fetch(SUPABASE_URL+"/rest/v1/blocked_slots?select=start_time,end_time&day_of_week=eq."+dayOfWeek,{headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY}})
  ]).then(function(res){
    return Promise.all([res[0].json(),res[1].json()]);
  }).then(function(data){
    var booked=data[0].map(function(x){return x.appointment_time;});
    var blocked=data[1];
    var allSlots=[];
    for(var h=8;h<=19;h++){for(var min=0;min<60;min+=30){allSlots.push(padZ(h)+":"+padZ(min));}}
    var available=allSlots.filter(function(t){
      var isBlocked=blocked.some(function(b){return t>=b.start_time&&t<b.end_time;});
      return booked.indexOf(t)<0&&!isBlocked;
    });
    if(available.length===0){container.innerHTML="<div style='grid-column:1/-1;text-align:center;padding:20px;color:#9ca3af;font-size:14px;'>Nenhum horário disponível</div>";return;}
    container.innerHTML=available.map(function(t){return "<button class='slot-btn' onclick=\\\"selectSlot('"+t+"')\\\" id='slot-"+t.replace(":","minus")+"' style='padding:12px 8px;border:1.5px solid #e5e7eb;border-radius:12px;background:#fff;font-size:14px;font-weight:500;color:#374151;cursor:pointer;transition:all 0.18s;'>"+t+"</button>";}).join("");
  }).catch(function(){container.innerHTML="<div style='grid-column:1/-1;text-align:center;color:#ef4444;font-size:14px;'>Erro ao carregar horários</div>";});
}

function selectSlot(t){
  selectedTime=t;
  document.querySelectorAll(".slot-btn").forEach(function(b){b.style.borderColor="#e5e7eb";b.style.background="#fff";b.style.color="#374151";});
  var btn=document.getElementById("slot-"+t.replace(":","minus"));
  if(btn){btn.style.borderColor="#111";btn.style.background="#111";btn.style.color="#fff";}
  var conf=document.getElementById("confirm-btn");
  var y=selectedDate.getFullYear(),mo=selectedDate.getMonth()+1,d=selectedDate.getDate();
  conf.style.display="block";conf.textContent="Confirmar — "+padZ(d)+"/"+padZ(mo)+"/"+y+" às "+t;
}

function goBack(){selectedTime=null;document.getElementById("step3").style.display="none";document.getElementById("step2").style.display="block";}

function confirmBooking(){
  if(!selectedDate||!selectedTime)return;
  document.getElementById("step3").style.display="none";
  document.getElementById("step-loading").style.display="block";
  var dateStr=selectedDate.getFullYear()+"-"+padZ(selectedDate.getMonth()+1)+"-"+padZ(selectedDate.getDate());
  var payload=Object.assign({},contactData,{appointment_date:dateStr,appointment_time:selectedTime});
  fetch(SUPABASE_URL+"/rest/v1/appointments",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json",Prefer:"return=representation"},body:JSON.stringify(payload)})
  .then(function(r){return r.json();})
  .then(function(data){
    if(data&&data[0]&&data[0].id){
      fetch(SUPABASE_URL+"/functions/v1/sync-single-appointment",{method:"POST",headers:{apikey:SUPABASE_KEY,Authorization:"Bearer "+SUPABASE_KEY,"Content-Type":"application/json"},body:JSON.stringify({appointment_id:data[0].id,action:"create"})}).catch(function(){});
    }
    document.getElementById("step-loading").style.display="none";
    document.getElementById("step-done").style.display="block";
    var mo=selectedDate.getMonth()+1;
    document.getElementById("done-info").textContent="📅 "+padZ(selectedDate.getDate())+"/"+padZ(mo)+"/"+selectedDate.getFullYear()+" às "+selectedTime;
  }).catch(function(){
    document.getElementById("step-loading").style.display="none";
    document.getElementById("step3").style.display="block";
    alert("Erro ao confirmar. Tente novamente.");
  });
}
`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>Agendar com ${n}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    .mes-form { display:block !important; width:100% !important; max-width:100% !important; box-sizing:border-box !important; }
    .mes-form * { box-sizing:border-box !important; }
    .mes-form input[type=text], .mes-form input[type=email], .mes-form input[type=tel] { display:block !important; width:100% !important; max-width:100% !important; min-width:0 !important; -webkit-appearance:none !important; appearance:none !important; }
    .mes-form button { display:block !important; width:100% !important; max-width:100% !important; }
    .mes-form .step-anim { animation:fadeIn 0.3s ease; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    .mes-form .slot-btn:hover { border-color:#666 !important; background:#f3f4f6 !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:${bgColor};color:${textColor};">
<div id="mes-form-wrap" class="mes-form" style="display:block;width:100%;max-width:100%;box-sizing:border-box;font-family:'Space Grotesk',sans-serif;">
  <div style="display:block;width:100%;max-width:100%;">

    <!-- Step 1: Dados pessoais -->
    <div id="step1" class="step-anim" style="display:block;width:100%;max-width:100%;">
      <div style="display:flex;flex-direction:column;gap:12px;width:100%;max-width:100%;">
        <input id="f-name" type="text" placeholder="Nome completo *" required style="display:block;width:100%;max-width:100%;height:54px;border:1.5px solid #e5e7eb;border-radius:12px;padding:0 14px;font-size:14px;color:#111;outline:none;background:#fff;font-family:'Space Grotesk',sans-serif;" />
        <input id="f-email" type="email" placeholder="E-mail *" required style="display:block;width:100%;max-width:100%;height:54px;border:1.5px solid #e5e7eb;border-radius:12px;padding:0 14px;font-size:14px;color:#111;outline:none;background:#fff;font-family:'Space Grotesk',sans-serif;" />
        <input id="f-phone" type="tel" placeholder="WhatsApp / Telefone *" required style="display:block;width:100%;max-width:100%;height:54px;border:1.5px solid #e5e7eb;border-radius:12px;padding:0 14px;font-size:14px;color:#111;outline:none;background:#fff;font-family:'Space Grotesk',sans-serif;" />
        <div id="error-msg" style="display:none;background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:10px 14px;color:#dc2626;font-size:13px;width:100%;"></div>
        <button id="mes-submit-btn" onclick="submitStep1()" style="display:block;width:100%;max-width:100%;height:52px;border-radius:14px;background:#111;color:#fff;font-size:15px;font-weight:600;border:none;cursor:pointer;margin-top:4px;font-family:'Space Grotesk',sans-serif;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'">Continuar →</button>
      </div>
    </div>

    <!-- Step 2: Calendário -->
    <div id="step2" style="display:none;" class="step-anim">
      <div style="text-align:center;margin-bottom:28px;">
        <h2 style="font-size:22px;font-weight:700;color:#111;margin-bottom:6px;">Escolha uma data</h2>
        <p style="color:#888;font-size:14px;">Selecione o melhor dia para seu atendimento</p>
      </div>
      <div style="width:100%;padding:0;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <button onclick="prevMonth()" style="background:none;border:1px solid #e5e7eb;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:16px;">&#8249;</button>
          <span id="cal-month-label" style="font-size:15px;font-weight:600;color:#111;"></span>
          <button onclick="nextMonth()" style="background:none;border:1px solid #e5e7eb;border-radius:8px;padding:6px 12px;cursor:pointer;font-size:16px;">&#8250;</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:8px;">
          ${weekDays}
        </div>
        <div id="cal-days" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;"></div>
      </div>
    </div>

    <!-- Step 3: Horários -->
    <div id="step3" style="display:none;" class="step-anim">
      <button onclick="goBack()" style="background:none;border:none;cursor:pointer;color:#888;font-size:14px;margin-bottom:16px;">← Voltar</button>
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="font-size:22px;font-weight:700;color:#111;margin-bottom:6px;">Escolha um horário</h2>
        <p id="step3-date" style="color:#888;font-size:14px;"></p>
      </div>
      <div style="width:100%;padding:0;">
        <div id="slots-container" style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;"></div>
        <button id="confirm-btn" onclick="confirmBooking()" style="display:none;width:100%;height:52px;border-radius:14px;background:#111;color:#fff;font-size:15px;font-weight:600;border:none;cursor:pointer;margin-top:20px;" onmouseover="this.style.opacity='0.85'" onmouseout="this.style.opacity='1'"></button>
      </div>
    </div>

    <!-- Step: Done -->
    <div id="step-done" style="display:none;" class="step-anim">
      <div style="text-align:center;padding:48px 24px;">
        <div style="width:72px;height:72px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:36px;">✅</div>
        <h2 style="font-size:22px;font-weight:700;color:#111;margin-bottom:10px;">Agendamento Confirmado!</h2>
        <p style="color:#888;font-size:14px;line-height:1.6;">Você receberá a confirmação no e-mail. Até lá!</p>
        <div id="done-info" style="margin-top:20px;display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:#f3f4f6;border-radius:10px;font-size:14px;font-weight:600;color:#111;"></div>
      </div>
    </div>

    <!-- Step: Loading -->
    <div id="step-loading" style="display:none;" class="step-anim">
      <div style="text-align:center;padding:64px 24px;">
        <div style="width:56px;height:56px;border:3px solid #e5e7eb;border-top-color:#111;border-radius:50%;animation:spin 0.8s linear infinite;margin:0 auto 20px;"></div>
        <p style="color:#888;font-size:14px;">Confirmando agendamento...</p>
      </div>
    </div>

  </div>
</div>
<script>
${script}
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',renderCalendar);}
</script>
</body>
</html>`;
}

/**
 * Gera o formulário de QUALIFICAÇÃO DE LEADS (para bergehpatrick@gmail.com).
 * Step 1: Nome, Email, Telefone
 * Step 2: Faturamento mensal (3 opções em botões quadrados)
 * Step 3: Maior dificuldade no mercado da beleza (textarea)
 */
export function generateLeadFormHTML(
  formName: string,
  product: string,
  bgColor = "transparent",
  textColor = "#111111",
  ownerId: string,
  formId: string
): string {
  const script = `
try {
var SUPABASE_URL='${SUPABASE_URL}';
var SUPABASE_KEY='${SUPABASE_ANON_KEY}';
var OWNER_ID='${ownerId}';
var FORM_ID='${formId}';
var PRODUCT='${product.replace(/'/g, "\\\\'")}';
var contactData={};
var fatIdx=-1;
var fatVals=["Até R$ 3.000","De R$ 3.000 a R$ 5.000","De R$ 5.000 a R$ 10.000","Acima de R$ 10.000"];
var utmParams=(function(){
  try{
    var p=new URLSearchParams(window.location.search);
    return {
      utm_source:p.get('utm_source')||null,
      utm_medium:p.get('utm_medium')||null,
      utm_campaign:p.get('utm_campaign')||null,
      utm_content:p.get('utm_content')||null,
      utm_term:p.get('utm_term')||null
    };
  }catch(e){return{utm_source:null,utm_medium:null,utm_campaign:null,utm_content:null,utm_term:null};}
})();

function showErr(msg){
  var e=document.getElementById("global-error");
  if(e){e.textContent=msg;e.style.display="block";}
}
function hideErr(){
  var e=document.getElementById("global-error");
  if(e){e.textContent="";e.style.display="none";}
}
function setProgress(step){
  for(var i=1;i<=3;i++){
    var dots=document.querySelectorAll("#step"+i+" .progress-dot");
    for(var d=0;d<dots.length;d++){
      if(d<step) dots[d].classList.add("active");
      else dots[d].classList.remove("active");
    }
  }
}
function areaScrollHint(){
  var list=document.querySelector('#step3 .fat-list');
  if(!list)return;
  var max=list.scrollHeight-list.clientHeight;
  if(max<=0)return;
  var peak=Math.min(max,160);
  var start=null;
  var dur1=320;
  var dur2=700;
  function scrollDown(ts){
    if(!start)start=ts;
    var p=Math.min((ts-start)/dur1,1);
    list.scrollTop=p*peak;
    if(p<1)requestAnimationFrame(scrollDown);
    else{start=null;requestAnimationFrame(scrollUp);}
  }
  function scrollUp(ts){
    if(!start)start=ts;
    var p=Math.min((ts-start)/dur2,1);
    var ease=1-(1-p)*(1-p);
    list.scrollTop=peak*(1-ease);
    if(p<1)requestAnimationFrame(scrollUp);
  }
  setTimeout(function(){requestAnimationFrame(scrollDown);},120);
}
function goToStep(from,to,stepNum){
  try{
    var f=document.getElementById(from);
    var t=document.getElementById(to);
    if(f)f.style.display="none";
    if(t){t.style.display="flex";}
    hideErr();
    setProgress(stepNum||1);
    window.scrollTo(0,0);
    if(to==="step3")areaScrollHint();
  }catch(ex){console.error("goToStep error",ex);}
}

function selectFat(i){
  fatIdx=i;
  for(var j=0;j<4;j++){
    var l=document.getElementById("fat-"+j);
    if(!l)continue;
    if(j===i){
      l.classList.add("selected");
    } else {
      l.classList.remove("selected");
    }
  }
}


function selectArea(el,val){
  document.querySelectorAll("#step3 .fat-opt").forEach(function(opt){
    opt.classList.remove("selected");
  });
  el.classList.add("selected");
  var hidden=document.getElementById("f-area");
  if(hidden)hidden.value=val;
}

function submitStep1(){
  try{
    hideErr();
    var nameEl=document.getElementById("f-name");
    var emailEl=document.getElementById("f-email");
    var phoneEl=document.getElementById("f-phone");
    var name=(nameEl?nameEl.value:"").trim();
    var email=(emailEl?emailEl.value:"").trim();
    var phone=(phoneEl?phoneEl.value:"").trim();
    if(!name){showErr("Preencha seu nome completo");return;}
    if(!email||email.indexOf("@")<0){showErr("Preencha um e-mail válido");return;}
    if(!phone){showErr("Preencha seu WhatsApp ou telefone");return;}
    contactData.name=name;
    contactData.email=email;
    contactData.phone=phone;
    goToStep("step1","step2",2);
  }catch(ex){console.error("submitStep1 error",ex);}
}

function submitStep2(){
  try{
    hideErr();
    if(fatIdx<0){showErr("Selecione seu faturamento mensal");return;}
    contactData.faturamento=fatVals[fatIdx];
    goToStep("step2","step3",3);
  }catch(ex){console.error("submitStep2 error",ex);}
}

function submitStep3(){
  try{
    hideErr();
    var areaEl=document.getElementById("f-area");
    var area=(areaEl?areaEl.value:"").trim();
    if(!area){showErr("Selecione sua área de atuação");return;}
    contactData.area_beleza=area;
    goToStep("step3","step-loading",3);
    var payload={
      owner_id:OWNER_ID,
      form_id:FORM_ID||null,
      product:PRODUCT||null,
      name:contactData.name||"",
      email:contactData.email||"",
      phone:contactData.phone||"",
      faturamento:contactData.faturamento||null,
      area_beleza:contactData.area_beleza||null,
      utm_source:utmParams.utm_source,
      utm_medium:utmParams.utm_medium,
      utm_campaign:utmParams.utm_campaign,
      utm_content:utmParams.utm_content,
      utm_term:utmParams.utm_term
    };
    fetch(SUPABASE_URL+"/rest/v1/form_submissions",{
      method:"POST",
      headers:{
        "apikey":SUPABASE_KEY,
        "Authorization":"Bearer "+SUPABASE_KEY,
        "Content-Type":"application/json",
        "Prefer":"return=minimal"
      },
      body:JSON.stringify(payload)
    }).then(function(res){
      var stepLoading=document.getElementById("step-loading");
      if(stepLoading)stepLoading.style.display="none";
      if(res.ok){
        var stepDone=document.getElementById("step-done");
        if(stepDone)stepDone.style.display="block";
        // Dispara email com ebook via Edge Function (keepalive garante envio mesmo após redirect)
        fetch(SUPABASE_URL+"/functions/v1/send-lead-email",{
          method:"POST",
          keepalive:true,
          headers:{
            "apikey":SUPABASE_KEY,
            "Authorization":"Bearer "+SUPABASE_KEY,
            "Content-Type":"application/json"
          },
          body:JSON.stringify({name:contactData.name||"",email:contactData.email||""})
        }).catch(function(e){console.warn("Email send failed:",e);});
        setTimeout(function(){ window.location.href="https://biteti.co/acesso"; }, 3000);
      } else {
        res.text().then(function(txt){
          var stepErr=document.getElementById("step-error");
          if(stepErr){
            stepErr.style.display="block";
            var msg=stepErr.querySelector(".err-msg");
            if(msg)msg.textContent="Erro ao enviar: "+txt;
          }
        });
      }
    }).catch(function(err){
      console.error("submitLead error",err);
      var stepLoading=document.getElementById("step-loading");
      if(stepLoading)stepLoading.style.display="none";
      var stepErr=document.getElementById("step-error");
      if(stepErr){
        stepErr.style.display="block";
        var msg=stepErr.querySelector(".err-msg");
        if(msg)msg.textContent="Erro de conexão. Tente novamente.";
      }
    });
  }catch(ex){console.error("submitStep3 error",ex);}
}
} catch(globalErr){ console.error("Form script error:", globalErr); }
`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <title>${product}</title>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
  <style>
    * { box-sizing:border-box; margin:0; padding:0; }
    body { background:${bgColor};color:${textColor};font-family:'Space Grotesk',sans-serif; }
    .wrap { width:100%;max-width:480px;margin:0 auto;padding:16px; }
    .step { display:flex;flex-direction:column;gap:14px; }
    .step-hidden { display:none; }
    @keyframes fadeIn { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes spin { to{transform:rotate(360deg)} }
    @keyframes loadbar { 0%{transform:translateX(-100%)} 50%{transform:translateX(150%)} 100%{transform:translateX(-100%)} }
    .anim { animation:fadeIn 0.3s ease; }
    .label-field { font-size:13px;font-weight:600;color:#374151;margin-bottom:4px;display:block; }
    input[type=text],input[type=tel] {
      display:block;width:100%;height:54px;
      border:1.5px solid #e5e7eb;border-radius:12px;
      padding:0 16px;font-size:15px;color:#111;
      outline:none;background:#fff;
      font-family:'Space Grotesk',sans-serif;
      transition:border-color 0.2s;
    }
    input[type=text]:focus,input[type=tel]:focus { border-color:#e5e7eb; }
    textarea {
      display:block;width:100%;min-height:140px;
      border:1.5px solid #e5e7eb;border-radius:12px;
      padding:14px 16px;font-size:15px;color:#111;
      outline:none;background:#fff;resize:vertical;
      font-family:'Space Grotesk',sans-serif;
      line-height:1.5;transition:border-color 0.2s;
    }
    textarea:focus { border-color:#e5e7eb; }
    textarea::placeholder { color:#9ca3af; }
    .btn-primary {
      display:block;width:auto;min-width:180px;max-width:260px;
      height:50px;padding:0 36px;
      border-radius:999px;background:#111;color:#fff;
      font-size:15px;font-weight:600;border:none;cursor:pointer;
      font-family:'Space Grotesk',sans-serif;transition:opacity 0.2s;
      margin:0 auto;
    }
    .btn-primary:hover { opacity:0.85; }
    .btn-back {
      display:block;width:auto;min-width:110px;
      height:50px;padding:0 22px;
      border-radius:999px;background:transparent;color:#6b7280;
      font-size:15px;font-weight:500;border:1.5px solid #e5e7eb;cursor:pointer;
      font-family:'Space Grotesk',sans-serif;transition:all 0.2s;
    }
    .btn-back:hover { border-color:#bbb;color:#374151; }
    .btn-row { display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:8px; }
    .fat-list { display:flex;flex-direction:column;gap:10px; }
    .fat-opt {
      display:flex;align-items:center;gap:10px;
      padding:10px 14px;
      border:1.5px solid #e5e7eb;border-radius:12px;
      font-size:13px;font-weight:500;color:#374151;
      cursor:pointer;background:#fff;
      transition:all 0.2s;
      position:relative;
    }
    .fat-opt:hover { border-color:#e5e7eb;background:#fff; }
    .fat-opt .fat-icon { display:none; }
    .fat-opt .fat-text { flex:1; }
    .fat-opt .fat-text strong { display:block;font-size:13px;font-weight:600;color:#111;margin-bottom:1px; }
    .fat-opt .fat-text span { font-size:11px;color:#9ca3af; }
    .fat-opt .fat-check { width:17px;height:17px;border-radius:50%;border:2px solid #e5e7eb;flex-shrink:0;transition:all 0.2s; }
    .fat-opt.selected { border-color:#111;background:#f8f8f8; }
    .fat-opt.selected .fat-check { background:#111;border-color:#111;box-shadow:inset 0 0 0 3px #fff; }
    @keyframes fatIn {
      from { opacity:0;transform:translateY(12px); }
      to   { opacity:1;transform:translateY(0); }
    }
    .fat-opt-in { opacity:0;animation:fatIn 0.32s ease forwards; }
    textarea {
      display:block;width:100%;min-height:160px;
      border:2px solid #e5e7eb;border-radius:14px;
      padding:16px 18px;font-size:15px;color:#111;
      outline:none;background:#fff;resize:none;
      font-family:'Space Grotesk',sans-serif;
      line-height:1.6;transition:border-color 0.2s;
    }
    textarea:focus { border-color:#e5e7eb; }
    textarea::placeholder { color:#c4c4c4; }
    .q-title { font-size:18px;font-weight:700;color:#111; }
    .q-sub { font-size:13px;color:#888;margin-top:4px; }
    #global-error {
      display:none;background:#fef2f2;
      border:1px solid #fecaca;border-radius:10px;
      padding:10px 14px;color:#dc2626;font-size:13px;
    }
    .progress { display:flex;gap:6px;margin-bottom:6px; }
    .progress-dot { height:4px;border-radius:2px;flex:1;background:#e5e7eb;transition:background 0.3s; }
    .progress-dot.active { background:#111; }
  </style>
</head>
<body>
<div class="wrap">

  <!-- Erro global -->
  <div id="global-error" style="margin-bottom:10px;"></div>

  <!-- Step 1: Dados pessoais -->
  <div id="step1" class="step anim">
    <div>
      <div class="progress">
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
        <div class="progress-dot"></div>
      </div>
    </div>
    <div>
      <p style="font-size:17px;color:#374151;line-height:1.5;">Preencha seus <strong style="color:#111;">dados</strong> para continuar</p>
    </div>
    <div>
      <input id="f-name" type="text" placeholder="Nome completo *" autocomplete="name" />
    </div>
    <div>
      <input id="f-email" type="text" placeholder="E-mail *" autocomplete="email" />
    </div>
    <div>
      <input id="f-phone" type="tel" placeholder="WhatsApp / Telefone *" autocomplete="tel" />
    </div>
    <button class="btn-primary" onclick="submitStep1()">Próximo ›</button>
  </div>

  <!-- Step 2: Faturamento -->
  <div id="step2" class="step anim step-hidden">
    <div>
      <div class="progress">
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot"></div>
      </div>

    </div>
    <div>
      <p class="q-title">Qual é o seu faturamento mensal?</p>
      <p class="q-sub">Selecione a opção que melhor representa você</p>
    </div>
    <div class="fat-list" style="max-height:260px;overflow-y:auto;padding-right:4px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;gap:8px;">
      <div id="fat-0" class="fat-opt fat-opt-in" onclick="selectFat(0)" style="animation-delay:0ms">
        <div class="fat-text"><strong>Até R$ 3.000</strong><span>Estou começando minha jornada</span></div>
        <div class="fat-check"></div>
      </div>
      <div id="fat-1" class="fat-opt fat-opt-in" onclick="selectFat(1)" style="animation-delay:60ms">
        <div class="fat-text"><strong>De R$ 3.000 a R$ 5.000</strong><span>Já tenho clientes e faturamento</span></div>
        <div class="fat-check"></div>
      </div>
      <div id="fat-2" class="fat-opt fat-opt-in" onclick="selectFat(2)" style="animation-delay:120ms">
        <div class="fat-text"><strong>De R$ 5.000 a R$ 10.000</strong><span>Negócio em crescimento</span></div>
        <div class="fat-check"></div>
      </div>
      <div id="fat-3" class="fat-opt fat-opt-in" onclick="selectFat(3)" style="animation-delay:180ms">
        <div class="fat-text"><strong>Acima de R$ 10.000</strong><span>Negócio consolidado</span></div>
        <div class="fat-check"></div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn-back" onclick="goToStep('step2','step1',1)">‹ Voltar</button>
      <button class="btn-primary" onclick="submitStep2()" style="margin:0;">Próximo ›</button>
    </div>
  </div>

  <!-- Step 3: Dificuldade -->
  <div id="step3" class="step anim step-hidden">
    <div>
      <div class="progress">
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
        <div class="progress-dot active"></div>
      </div>

    </div>
    <div>
      <p class="q-title">Qual é a sua área de atuação?</p>
      <p class="q-sub">Nos conte em qual segmento da beleza você trabalha</p>
    </div>
    <div class="fat-list" style="max-height:240px;overflow-y:auto;padding-right:4px;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;gap:7px;">
      <div class="fat-opt" onclick="selectArea(this,'Cílios')"><div class="fat-text"><strong>Cílios</strong><span>Lash designer, extensão de cílios</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'Sobrancelhas')"><div class="fat-text"><strong>Sobrancelhas</strong><span>Designer de sobrancelhas, henna, micro</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'Maquiagem')"><div class="fat-text"><strong>Maquiagem</strong><span>Make up artist, maquiadora</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'Estética')"><div class="fat-text"><strong>Estética</strong><span>Esteticista, skincare, tratamentos</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'Cabelos')"><div class="fat-text"><strong>Cabelos</strong><span>Cabeleireira, colorista, escovista</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'Unhas')"><div class="fat-text"><strong>Unhas</strong><span>Manicure, nail designer, alongamento</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'HOF (harmonização)')"><div class="fat-text"><strong>HOF (harmonização)</strong><span>Harmonização orofacial, procedimentos</span></div><div class="fat-check"></div></div>
      <div class="fat-opt" onclick="selectArea(this,'Outro')"><div class="fat-text"><strong>Outro</strong><span>Outro segmento da beleza</span></div><div class="fat-check"></div></div>
    </div>
    <input type="hidden" id="f-area" value="" />
    <div class="btn-row">
      <button class="btn-back" onclick="goToStep('step3','step2',2)">‹ Voltar</button>
      <button class="btn-primary" onclick="submitStep3()" style="margin:0;">Enviar ›</button>
    </div>
  </div>

  <!-- Loading -->
  <div id="step-loading" class="step-hidden anim" style="text-align:center;padding:80px 24px;">
    <div style="width:100%;max-width:220px;margin:0 auto;height:3px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
      <div style="height:100%;width:40%;background:#111;border-radius:99px;animation:loadbar 1.2s ease-in-out infinite;"></div>
    </div>
  </div>

  <!-- Sucesso -->
  <div id="step-done" class="step-hidden anim" style="text-align:center;padding:48px 24px;">
    <h2 style="font-size:24px;font-weight:700;color:#111;margin-bottom:10px;">Dados Enviados</h2>
    <p style="color:#555;font-size:15px;line-height:1.6;margin-bottom:24px;">Seu Ebook foi enviado ao seu email</p>
    <div style="width:100%;max-width:220px;margin:0 auto 12px;height:3px;background:#e5e7eb;border-radius:99px;overflow:hidden;">
      <div style="height:100%;width:40%;background:#111;border-radius:99px;animation:loadbar 1.2s ease-in-out infinite;"></div>
    </div>
    <p style="color:#bbb;font-size:11px;letter-spacing:0.5px;">Não saia dessa tela</p>
  </div>

  <!-- Erro de envio -->
  <div id="step-error" class="step-hidden anim" style="text-align:center;padding:48px 24px;">
    <div style="font-size:36px;margin-bottom:16px;">⚠️</div>
    <h2 style="font-size:18px;font-weight:700;color:#111;margin-bottom:8px;">Algo deu errado</h2>
    <p class="err-msg" style="color:#dc2626;font-size:13px;margin-bottom:16px;"></p>
    <button class="btn-primary" onclick="location.reload()" style="max-width:200px;margin:0 auto;">Tentar novamente</button>
  </div>

</div>
<script>
${script}
</script>
</body>
</html>`;
}

